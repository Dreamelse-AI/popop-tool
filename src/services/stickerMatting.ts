/**
 * Die-cut 贴纸抠图：把「纯色背景 + 角色带白色粗描边」的表情图去背景成透明 PNG。
 *
 * 为什么用泛洪填充而不是全局颜色阈值：
 *   角色本身可能含有与背景同色的区域（例如黑头发 vs 黑底）。全局阈值会把这些
 *   区域一起抠穿。改为「从图像四边对连通的背景色像素做 flood fill」后，只有与
 *   边缘连通的背景被去掉；角色内部即使有同色像素，因被白色粗描边阻断、与外部
 *   背景不连通，得以保留。这正是 die-cut 白描边「更好抠」的真正机制。
 *
 * 链路约定：生图时要求纯色背景（默认纯黑）+ 角色一圈白色粗描边（见 stickerPromptBuilder）。
 */

import type { ColorKeyOptions } from '@/types/sticker';

/** 把 data URL 加载成 ImageBitmap。 */
async function loadBitmap(dataUrl: string): Promise<ImageBitmap> {
  const res = await fetch(dataUrl);
  const blob = await res.blob();
  return createImageBitmap(blob);
}

/** 颜色到背景基准色的欧氏距离平方（省去开方，比较更快）。 */
function distSq(
  data: Uint8ClampedArray,
  idx: number,
  bg: { r: number; g: number; b: number },
): number {
  const dr = data[idx] - bg.r;
  const dg = data[idx + 1] - bg.g;
  const db = data[idx + 2] - bg.b;
  return dr * dr + dg * dg + db * db;
}

/**
 * 对单张贴纸图去背景：从四边泛洪填充抠掉与边缘连通的背景色像素，返回透明 PNG。
 * @param dataUrl 输入图（已切好的单格 PNG）
 * @param opts 抠图参数（背景基准色 / 容差 / 羽化）
 */
export async function removeBackgroundByColorKey(
  dataUrl: string,
  opts: ColorKeyOptions,
): Promise<string> {
  const bitmap = await loadBitmap(dataUrl);
  try {
    const { width, height } = bitmap;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw new Error('无法创建画布上下文');

    ctx.drawImage(bitmap, 0, 0);
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;

    const { tolerance } = opts;
    // flood fill 用「比对相似」的阈值（容差平方）
    const tolSq = tolerance * tolerance;
    // 背景基准色：取四角像素的平均，自适应模型实际出的底色（比写死更稳）
    const bg = sampleCornerColor(data, width, height);

    floodFillBackground(data, width, height, bg, tolSq);
    softenEdges(data, width, height, Math.max(0, opts.feather));

    ctx.putImageData(imageData, 0, 0);
    return canvas.toDataURL('image/png');
  } finally {
    bitmap.close();
  }
}

/** 取四角像素平均作为背景基准色（自适应实际底色）。 */
function sampleCornerColor(
  data: Uint8ClampedArray,
  width: number,
  height: number,
): { r: number; g: number; b: number } {
  const corners = [
    0,
    (width - 1) * 4,
    (height - 1) * width * 4,
    ((height - 1) * width + (width - 1)) * 4,
  ];
  let r = 0;
  let g = 0;
  let b = 0;
  for (const c of corners) {
    r += data[c];
    g += data[c + 1];
    b += data[c + 2];
  }
  return { r: r / 4, g: g / 4, b: b / 4 };
}

/** 从四边做 BFS 泛洪，把连通的背景色像素 alpha 置 0。 */
function floodFillBackground(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  bg: { r: number; g: number; b: number },
  tolSq: number,
): void {
  const total = width * height;
  const visited = new Uint8Array(total);
  // 用平铺数组当队列，避免 Array.shift 的 O(n) 开销
  const queue = new Int32Array(total);
  let head = 0;
  let tail = 0;

  const enqueueIfBg = (px: number): void => {
    if (px < 0 || px >= total || visited[px]) return;
    visited[px] = 1;
    if (distSq(data, px * 4, bg) <= tolSq) {
      queue[tail++] = px;
      data[px * 4 + 3] = 0; // 背景：透明
    }
  };

  // 种子：四条边的所有像素
  for (let x = 0; x < width; x++) {
    enqueueIfBg(x);
    enqueueIfBg((height - 1) * width + x);
  }
  for (let y = 0; y < height; y++) {
    enqueueIfBg(y * width);
    enqueueIfBg(y * width + (width - 1));
  }

  while (head < tail) {
    const px = queue[head++];
    const x = px % width;
    const y = (px / width) | 0;
    if (x > 0) enqueueIfBg(px - 1);
    if (x < width - 1) enqueueIfBg(px + 1);
    if (y > 0) enqueueIfBg(px - width);
    if (y < height - 1) enqueueIfBg(px + width);
  }
}

/** 对已透明区域的边界做一圈羽化，柔化硬锯齿（feather=半径像素）。 */
function softenEdges(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  feather: number,
): void {
  if (feather <= 0) return;
  // 简单一遍：与透明像素相邻的不透明边界像素，alpha 降一档，弱化白边硬切
  const total = width * height;
  const drop = Math.min(255, Math.round(255 / (feather + 1)));
  const snapshot = new Uint8Array(total);
  for (let p = 0; p < total; p++) snapshot[p] = data[p * 4 + 3];

  for (let p = 0; p < total; p++) {
    if (snapshot[p] === 0) continue;
    const x = p % width;
    const y = (p / width) | 0;
    const neighborTransparent =
      (x > 0 && snapshot[p - 1] === 0) ||
      (x < width - 1 && snapshot[p + 1] === 0) ||
      (y > 0 && snapshot[p - width] === 0) ||
      (y < height - 1 && snapshot[p + width] === 0);
    if (neighborTransparent) {
      data[p * 4 + 3] = Math.max(0, data[p * 4 + 3] - drop);
    }
  }
}

/** 默认抠图参数：纯黑背景，中等容差，轻微羽化。 */
export const DEFAULT_COLOR_KEY: ColorKeyOptions = {
  bgColor: { r: 0, g: 0, b: 0 },
  tolerance: 60,
  feather: 1,
};
