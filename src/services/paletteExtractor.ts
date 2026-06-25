/**
 * 配色提取：纯前端 canvas 实现，不调用任何 AI。
 *
 * 思路：
 *   1. 把图片画到一个缩小的离屏 canvas（采样足够、又不卡）。
 *   2. 量化：每个像素 RGB 各取高位（缩 bucket），按出现频次聚合。
 *   3. 取频次最高的若干 bucket 作为主色，去掉过近的颜色避免重复。
 *   4. 推导建议：背景色用占比最大的主色，字体色按背景明度取黑/白保证对比。
 *
 * 全程本地，离线可跑；图片像素来自用户上传（同源/本地 dataURL，无 CORS 问题）。
 */

export interface ExtractResult {
  /** 主色板（hex，按占比从高到低，最多 maxColors 个） */
  colors: string[];
  /** 建议背景色（hex） */
  bgColor: string;
  /** 建议字体色（hex，对背景有足够对比） */
  fontColor: string;
}

/** 采样画布长边（越大越精确越慢；100 足够提取主色）。 */
const SAMPLE_EDGE = 100;
/** 每通道量化位数：5 位 → 每通道 32 档，bucket 适中。 */
const QUANT_BITS = 5;
const QUANT_SHIFT = 8 - QUANT_BITS;

interface Bucket {
  count: number;
  r: number;
  g: number;
  b: number;
}

/** 把 0-255 分量转两位 hex。 */
function toHex2(n: number): string {
  return Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
}

function rgbToHex(r: number, g: number, b: number): string {
  return `#${toHex2(r)}${toHex2(g)}${toHex2(b)}`;
}

/** 相对亮度（sRGB 感知亮度近似），用于挑字体色。 */
function luminance(r: number, g: number, b: number): number {
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

/** 两色欧氏距离平方（RGB），用于去重相近色。 */
function distSq(a: Bucket, b: Bucket): number {
  const dr = a.r - b.r;
  const dg = a.g - b.g;
  const db = a.b - b.b;
  return dr * dr + dg * dg + db * db;
}

/**
 * 从图片 data URL 提取配色。
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
    const bg = top[0];
    const bgColor = colors[0] ?? '#ffffff';
    const fontColor = bg && luminance(bg.r, bg.g, bg.b) > 0.55 ? '#0b0b0b' : '#ffffff';

    return { colors, bgColor, fontColor };
  } finally {
    bitmap.close();
  }
}

/** 量化像素到 bucket，聚合频次与平均色。 */
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
      buckets.set(key, { count: 1, r, g, b });
    }
  }
  // 把累加值转成平均色
  for (const bucket of buckets.values()) {
    bucket.r /= bucket.count;
    bucket.g /= bucket.count;
    bucket.b /= bucket.count;
  }
  return buckets;
}

/** 最小色差平方阈值：低于此视为同色，去重（约 40 的 RGB 距离）。 */
const MERGE_DIST_SQ = 40 * 40;

/** 取频次最高、且彼此不太接近的前 N 个颜色。 */
function pickTopColors(buckets: Map<number, Bucket>, maxColors: number): Bucket[] {
  const sorted = [...buckets.values()].sort((a, b) => b.count - a.count);
  const picked: Bucket[] = [];
  for (const cand of sorted) {
    if (picked.length >= maxColors) break;
    if (picked.some((p) => distSq(p, cand) < MERGE_DIST_SQ)) continue;
    picked.push(cand);
  }
  return picked;
}
