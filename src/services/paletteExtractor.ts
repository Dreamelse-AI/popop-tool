/**
 * 配色提取：纯前端 canvas 实现，不调用任何 AI。
 *
 * 目标：提色更准、且产出能直接用的「两套配色方案」。
 *
 * 思路：
 *   1. 缩小采样到离屏 canvas。
 *   2. 量化：HSV 分桶聚合频次，按「频次 × 饱和度权重」排序——
 *      避免浅色照片里大片低饱和灰白霸榜、把代表色拖灰（旧版痛点）。
 *   3. 主色板：取加权靠前、彼此不接近的若干色。
 *   4. 渐变检测：判断整图是否为「颜色随位置平滑过渡」的渐变（含多色渐变）；
 *      判定方式 = 沿 水平/垂直/两对角 四个方向分带，找「带内方差最小」的方向，
 *      该方向带内方差占总方差比例足够低、且首尾色差足够大 → 认定为渐变。
 *   5. 两套方案：
 *      - 普通图（纯色底）：从主色板挑「彼此对比度最高且达标」的一对色 c1/c2，
 *        方案A = c1 底 + c2 字，方案B = c2 底 + c1 字（互换）；挑不出达标对才用黑/白兜底。
 *      - 渐变图：方案A/B 均为渐变底（方向与起止色不同），字色按渐变中点明度自动取黑/白。
 *      （仅渐变背景用「自动黑/白字」，纯色背景用配色互换，字色来自主色板。）
 *
 * 全程本地，离线可跑；图片像素来自用户上传（同源/本地 dataURL，无 CORS 问题）。
 */

/** 一套配色方案：底色 + 字色。 */
export interface SchemeColors {
  bgColor: string;
  fontColor: string;
}

export interface ExtractResult {
  /** 主色板（hex，按加权排序，最多 maxColors 个） */
  colors: string[];
  /** 两套配色方案（A/B 互换关系，平等无主次） */
  schemes: [SchemeColors, SchemeColors];
}

/** 采样画布长边（越大越精确越慢；120 兼顾准确与速度）。 */
const SAMPLE_EDGE = 120;
/** 每通道量化位数：5 位 → 每通道 32 档。 */
const QUANT_BITS = 5;
const QUANT_SHIFT = 8 - QUANT_BITS;

interface Bucket {
  count: number;
  r: number;
  g: number;
  b: number;
  /** 加权分（频次 × 饱和度权重），排序用 */
  score: number;
}

function toHex2(n: number): string {
  return Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
}

function rgbToHex(r: number, g: number, b: number): string {
  return `#${toHex2(r)}${toHex2(g)}${toHex2(b)}`;
}

/** sRGB 通道线性化（WCAG 相对亮度用）。 */
function linearize(channel: number): number {
  const c = channel / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/** WCAG 相对亮度（0=黑，1=白）。 */
function relLuminance(r: number, g: number, b: number): number {
  return 0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b);
}

/** WCAG 对比度（1~21），值越大越易读。 */
function contrastRatioRgb(a: RGB, b: RGB): number {
  const la = relLuminance(a.r, a.g, a.b);
  const lb = relLuminance(b.r, b.g, b.b);
  const [hi, lo] = la >= lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/** HSV 饱和度（0~1），用于给鲜艳色更高权重。 */
function saturation(r: number, g: number, b: number): number {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  return max === 0 ? 0 : (max - min) / max;
}

/** 两色欧氏距离平方（RGB），用于去重相近色。 */
function distSq(a: RGB, b: RGB): number {
  const dr = a.r - b.r;
  const dg = a.g - b.g;
  const db = a.b - b.b;
  return dr * dr + dg * dg + db * db;
}

interface RGB {
  r: number;
  g: number;
  b: number;
}

/**
 * 从图片 data URL 提取配色与两套方案。
 * @param dataUrl 图片 base64 data URL（来自上传文件）
 * @param maxColors 最多返回主色数（默认 6）
 */
export async function extractPalette(
  dataUrl: string,
  maxColors = 6,
): Promise<ExtractResult> {
  const blob = await (await fetch(dataUrl)).blob();
  const bitmap = await createImageBitmap(blob);
  try {
    const { width, height } = bitmap;
    const longEdge = Math.max(width, height);
    const scale = longEdge > SAMPLE_EDGE ? SAMPLE_EDGE / longEdge : 1;
    const w = Math.max(1, Math.round(width * scale));
    const h = Math.max(1, Math.round(height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw new Error('无法创建画布上下文');
    ctx.drawImage(bitmap, 0, 0, w, h);
    const { data } = ctx.getImageData(0, 0, w, h);

    const buckets = quantize(data);
    const top = pickTopColors(buckets, maxColors);
    const colors = top.map((b) => rgbToHex(b.r, b.g, b.b));
    const gradient = detectGradient(data, w, h);
    const schemes = buildSchemes(top, gradient);

    return { colors, schemes };
  } finally {
    bitmap.close();
  }
}

const BLACK_HEX = '#0b0b0b';
const WHITE_HEX = '#ffffff';
const BLACK: RGB = { r: 11, g: 11, b: 11 };
const WHITE: RGB = { r: 255, g: 255, b: 255 };

/** 按底色深浅自动取字色：和黑/白比，谁对比高用谁。 */
function autoFontColor(bg: RGB): string {
  return contrastRatioRgb(bg, BLACK) >= contrastRatioRgb(bg, WHITE) ? BLACK_HEX : WHITE_HEX;
}

/** 渐变底取「中点色」近似其整体明度，用于决定黑/白字。 */
function gradientMidColor(stops: RGB[]): RGB {
  return stops[Math.floor(stops.length / 2)] ?? WHITE;
}

/** 一对颜色可作「底/字」的最低对比度（AA 正文 4.5，配色卡标题放宽到 3.5）。 */
const MIN_PAIR_CONTRAST = 3.5;

/**
 * 从主色板构造两套方案：
 *   - 渐变图：方案A/B 均为渐变底（135° / 315° 两个方向，起止/顺序不同），
 *     字色按渐变中点明度自动取黑/白（仅渐变背景用自动黑白）。
 *   - 纯色图：从主色板挑「彼此对比度最高且达标」的一对色 c1/c2，
 *     方案A = c1 底 + c2 字，方案B = c2 底 + c1 字（互换）；
 *     挑不出对比达标的一对时，才用首要主色 + 黑/白兜底，保证可读。
 */
function buildSchemes(palette: RGB[], gradient: RGB[] | null): [SchemeColors, SchemeColors] {
  if (gradient && gradient.length >= 2) {
    const reversed = [...gradient].reverse();
    const bgA = `linear-gradient(135deg, ${gradient
      .map((c, i) => `${rgbToHex(c.r, c.g, c.b)} ${pctOf(i, gradient.length)}%`)
      .join(', ')})`;
    const bgB = `linear-gradient(315deg, ${reversed
      .map((c, i) => `${rgbToHex(c.r, c.g, c.b)} ${pctOf(i, reversed.length)}%`)
      .join(', ')})`;
    return [
      { bgColor: bgA, fontColor: autoFontColor(gradientMidColor(gradient)) },
      { bgColor: bgB, fontColor: autoFontColor(gradientMidColor(reversed)) },
    ];
  }

  // 纯色：找一对彼此对比度最高且达标的主色，A/B 互换底/字
  let best: [RGB, RGB] | null = null;
  let bestContrast = 0;
  for (let i = 0; i < palette.length; i++) {
    for (let j = i + 1; j < palette.length; j++) {
      const c = contrastRatioRgb(palette[i], palette[j]);
      if (c > bestContrast) {
        bestContrast = c;
        best = [palette[i], palette[j]];
      }
    }
  }

  let c1: RGB;
  let c2: RGB;
  if (best && bestContrast >= MIN_PAIR_CONTRAST) {
    [c1, c2] = best;
  } else {
    // 主色互相对比都不够：用最主要的主色配黑/白
    c1 = palette[0] ?? WHITE;
    c2 = contrastRatioRgb(c1, BLACK) >= contrastRatioRgb(c1, WHITE) ? BLACK : WHITE;
  }

  const hex1 = rgbToHex(c1.r, c1.g, c1.b);
  const hex2 = rgbToHex(c2.r, c2.g, c2.b);
  return [
    { bgColor: hex1, fontColor: hex2 },
    { bgColor: hex2, fontColor: hex1 },
  ];
}

/** 渐变 stop 的位置百分比。 */
function pctOf(i: number, len: number): number {
  return len <= 1 ? 0 : Math.round((i / (len - 1)) * 100);
}

/** 量化像素到 bucket，聚合频次与平均色，并算加权分。 */
function quantize(data: Uint8ClampedArray): Map<number, Bucket> {
  const buckets = new Map<number, Bucket>();
  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3];
    if (a < 125) continue; // 跳过透明像素
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const key =
      ((r >> QUANT_SHIFT) << (QUANT_BITS * 2)) |
      ((g >> QUANT_SHIFT) << QUANT_BITS) |
      (b >> QUANT_SHIFT);
    const bucket = buckets.get(key);
    if (bucket) {
      bucket.count++;
      bucket.r += r;
      bucket.g += g;
      bucket.b += b;
    } else {
      buckets.set(key, { count: 1, r, g, b, score: 0 });
    }
  }
  // 平均色 + 加权分：低饱和（灰白）降权，避免霸榜把代表色拖灰
  for (const bucket of buckets.values()) {
    bucket.r /= bucket.count;
    bucket.g /= bucket.count;
    bucket.b /= bucket.count;
    const sat = saturation(bucket.r, bucket.g, bucket.b);
    bucket.score = bucket.count * (0.25 + 0.75 * sat);
  }
  return buckets;
}

/** 最小色差平方阈值：低于此视为同色，去重（约 36 的 RGB 距离）。 */
const MERGE_DIST_SQ = 36 * 36;

/** 取加权分最高、且彼此不太接近的前 N 个颜色。 */
function pickTopColors(buckets: Map<number, Bucket>, maxColors: number): Bucket[] {
  const sorted = [...buckets.values()].sort((a, b) => b.score - a.score);
  const picked: Bucket[] = [];
  for (const cand of sorted) {
    if (picked.length >= maxColors) break;
    if (picked.some((p) => distSq(p, cand) < MERGE_DIST_SQ)) continue;
    picked.push(cand);
  }
  return picked;
}

// ==================== 渐变检测 ====================

/** 分带数：把图片沿某方向切成若干带，估计带内/带间色彩分布。 */
const GRAD_BANDS = 16;
/** 带内方差占总方差比例上限：越低说明颜色越「随位置平滑变化」（=渐变）。 */
const GRAD_WITHIN_RATIO_MAX = 0.18;
/** 渐变首尾色差平方下限：太接近说明几乎纯色，不算渐变。 */
const GRAD_ENDPOINT_DIST_SQ_MIN = 40 * 40;
/**
 * 平滑度闸：相邻带「最大单步色差 / 总步长」上限。
 * - 真渐变：变化均摊到每一带，最大单步只占一小部分（≈1/带数），比例小。
 * - 硬边色块（如两个/几个纯色块）：变化几乎全集中在分界处一两个台阶，
 *   最大单步占比接近 1，会被此闸挡掉，避免误判为渐变。
 */
const GRAD_MAX_STEP_RATIO = 0.45;
/** 相邻 stop 合并阈值（色差平方），多色渐变去重用。 */
const GRAD_STOP_MERGE_SQ = 24 * 24;
/** 渐变最多保留的 stop 数（多色渐变）。 */
const GRAD_MAX_STOPS = 5;

interface BandAcc {
  count: number;
  r: number;
  g: number;
  b: number;
  /** 各通道平方和，用于带内方差 */
  sqr: number;
  sqg: number;
  sqb: number;
}

/** 四个投影方向：水平 / 垂直 / 两对角。 */
type Direction = 'h' | 'v' | 'd1' | 'd2';
const DIRECTIONS: Direction[] = ['h', 'v', 'd1', 'd2'];

/** 像素 (x,y) 在某方向上的归一化投影 t∈[0,1]。 */
function project(dir: Direction, x: number, y: number, w: number, h: number): number {
  switch (dir) {
    case 'h':
      return w <= 1 ? 0 : x / (w - 1);
    case 'v':
      return h <= 1 ? 0 : y / (h - 1);
    case 'd1':
      return (x / Math.max(1, w - 1) + y / Math.max(1, h - 1)) / 2;
    case 'd2':
      return (x / Math.max(1, w - 1) + (1 - y / Math.max(1, h - 1))) / 2;
  }
}

/**
 * 检测整图是否为「沿某方向平滑过渡」的渐变（含多色渐变）。
 * @returns 是渐变则返回有序 stop 颜色数组（≥2），否则 null。
 */
function detectGradient(data: Uint8ClampedArray, w: number, h: number): RGB[] | null {
  // 全局均值与总方差
  let gr = 0;
  let gg = 0;
  let gb = 0;
  let n = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 125) continue;
    gr += data[i];
    gg += data[i + 1];
    gb += data[i + 2];
    n++;
  }
  if (n === 0) return null;
  gr /= n;
  gg /= n;
  gb /= n;
  let totalVar = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 125) continue;
    totalVar += (data[i] - gr) ** 2 + (data[i + 1] - gg) ** 2 + (data[i + 2] - gb) ** 2;
  }
  totalVar /= n;
  if (totalVar < 1) return null; // 几乎纯色，不是渐变

  let bestDir: Direction | null = null;
  let bestRatio = Infinity;
  let bestBands: BandAcc[] = [];

  for (const dir of DIRECTIONS) {
    const bands: BandAcc[] = Array.from({ length: GRAD_BANDS }, () => ({
      count: 0,
      r: 0,
      g: 0,
      b: 0,
      sqr: 0,
      sqg: 0,
      sqb: 0,
    }));
    let idx = 0;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++, idx += 4) {
        if (data[idx + 3] < 125) continue;
        const t = project(dir, x, y, w, h);
        const bi = Math.min(GRAD_BANDS - 1, Math.max(0, Math.floor(t * GRAD_BANDS)));
        const band = bands[bi];
        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];
        band.count++;
        band.r += r;
        band.g += g;
        band.b += b;
        band.sqr += r * r;
        band.sqg += g * g;
        band.sqb += b * b;
      }
    }
    // 带内方差（各带方差按像素数加权平均）
    let withinVar = 0;
    let filled = 0;
    for (const band of bands) {
      if (band.count === 0) continue;
      filled++;
      const mr = band.r / band.count;
      const mg = band.g / band.count;
      const mb = band.b / band.count;
      const vr = band.sqr / band.count - mr * mr;
      const vg = band.sqg / band.count - mg * mg;
      const vb = band.sqb / band.count - mb * mb;
      withinVar += (band.count / n) * (vr + vg + vb);
    }
    if (filled < GRAD_BANDS) continue; // 有空带，方向不连续，跳过
    const ratio = withinVar / totalVar;
    if (ratio < bestRatio) {
      bestRatio = ratio;
      bestDir = dir;
      bestBands = bands;
    }
  }

  if (!bestDir || bestRatio > GRAD_WITHIN_RATIO_MAX) return null;

  // 还原有序 stop 颜色（按带顺序的带均色）
  const stops: RGB[] = bestBands
    .filter((b) => b.count > 0)
    .map((b) => ({ r: b.r / b.count, g: b.g / b.count, b: b.b / b.count }));
  if (stops.length < 2) return null;

  // 首尾色差太小 → 视为纯色
  if (distSq(stops[0], stops[stops.length - 1]) < GRAD_ENDPOINT_DIST_SQ_MIN) return null;

  // 平滑度闸：渐变应「逐带均匀变化」，色块图则「变化集中在分界台阶」。
  // 计算相邻带色差（欧氏距离）之和与最大单步，若最大单步占比过高 → 是色块拼接，不是渐变。
  let totalStep = 0;
  let maxStep = 0;
  for (let i = 1; i < stops.length; i++) {
    const step = Math.sqrt(distSq(stops[i - 1], stops[i]));
    totalStep += step;
    if (step > maxStep) maxStep = step;
  }
  if (totalStep <= 0) return null;
  if (maxStep / totalStep > GRAD_MAX_STEP_RATIO) return null;

  return mergeStops(stops);
}

/** 合并相邻相近的 stop，保留首尾，最多 GRAD_MAX_STOPS 个，得到简洁多色渐变。 */
function mergeStops(stops: RGB[]): RGB[] {
  const merged: RGB[] = [stops[0]];
  for (let i = 1; i < stops.length; i++) {
    const last = merged[merged.length - 1];
    if (distSq(last, stops[i]) >= GRAD_STOP_MERGE_SQ) {
      merged.push(stops[i]);
    }
  }
  // 确保包含真实首尾
  const tail = stops[stops.length - 1];
  if (distSq(merged[merged.length - 1], tail) > 1) merged.push(tail);
  if (merged.length <= GRAD_MAX_STOPS) return merged;

  // 超出则等距下采样到 GRAD_MAX_STOPS 个（保头保尾）
  const out: RGB[] = [];
  for (let k = 0; k < GRAD_MAX_STOPS; k++) {
    const pos = Math.round((k / (GRAD_MAX_STOPS - 1)) * (merged.length - 1));
    out.push(merged[pos]);
  }
  return out;
}
