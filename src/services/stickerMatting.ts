/**
 * 色键抠图：把纯色背景的表情图去背景成透明 PNG（纯前端，零调用）。
 *
 * 原理：生图时要求模型输出纯色背景（默认纯绿 chroma key），前端逐像素比对，
 * 与背景基准色的欧氏距离 ≤ 容差的像素 alpha 置 0（透明）。
 * 可选边缘羽化：对「接近阈值边界」的像素做 alpha 渐变，柔化硬边。
 *
 * 局限（已知）：发丝、半透明边缘等细节抠不干净，这是色键法的固有限制；
 * 若效果不达标，再切到后端/ML 抠图方案（见对话中的方案）。
 */

import type { ColorKeyOptions } from '@/types/sticker';

/** 把 data URL 加载成 ImageBitmap。 */
async function loadBitmap(dataUrl: string): Promise<ImageBitmap> {
  const res = await fetch(dataUrl);
  const blob = await res.blob();
  return createImageBitmap(blob);
}

/** 颜色欧氏距离。 */
function colorDistance(
  r: number,
  g: number,
  b: number,
  bg: { r: number; g: number; b: number },
): number {
  const dr = r - bg.r;
  const dg = g - bg.g;
  const db = b - bg.b;
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

/**
 * 对单张表情图做色键去背景，返回透明 PNG 的 data URL。
 * @param dataUrl 输入图（已切好的单格 PNG）
 * @param opts 色键参数（背景色 / 容差 / 羽化）
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

    const { bgColor, tolerance, feather } = opts;
    // 羽化区间：[tolerance, tolerance+feather] 内线性过渡，避免一刀切的锯齿边
    const featherEnd = tolerance + Math.max(0, feather);

    for (let i = 0; i < data.length; i += 4) {
      const dist = colorDistance(data[i], data[i + 1], data[i + 2], bgColor);
      if (dist <= tolerance) {
        data[i + 3] = 0; // 背景：全透明
      } else if (feather > 0 && dist < featherEnd) {
        // 边界过渡带：按距离线性提升 alpha
        const ratio = (dist - tolerance) / (featherEnd - tolerance);
        data[i + 3] = Math.round(data[i + 3] * ratio);
      }
    }

    ctx.putImageData(imageData, 0, 0);
    return canvas.toDataURL('image/png');
  } finally {
    bitmap.close();
  }
}

/** 默认色键参数：纯绿背景，中等容差，轻微羽化。 */
export const DEFAULT_COLOR_KEY: ColorKeyOptions = {
  bgColor: { r: 0, g: 255, b: 0 },
  tolerance: 120,
  feather: 40,
};
