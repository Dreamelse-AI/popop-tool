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
 *   4. 两套方案：从主色板里挑「彼此对比度达标」的两个代表色 c1/c2，
 *      方案A = c1 底 + c2 字，方案B = c2 底 + c1 字（互换）。
 *      若主色里挑不出对比达标的一对，才用黑/白补足某一极，保证文字可读。
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
    const schemes = buildSchemes(top);

    return { colors, schemes };
  } finally {
    bitmap.close();
  }
}

const BLACK: RGB = { r: 11, g: 11, b: 11 };
const WHITE: RGB = { r: 255, g: 255, b: 255 };
/** 一对颜色可作「底/字」的最低对比度（AA 正文 4.5，配色卡标题放宽到 3.5）。 */
const MIN_PAIR_CONTRAST = 3.5;

/**
 * 从主色板构造两套方案：
 *   - 找一对彼此对比度最高且达标的主色 c1/c2；
 *   - 方案A = c1 底 + c2 字，方案B 互换。
 * 若没有任何一对主色达标，则用首要主色 + 黑/白兜底（取对比更高者）。
 */
function buildSchemes(palette: RGB[]): [SchemeColors, SchemeColors] {
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
