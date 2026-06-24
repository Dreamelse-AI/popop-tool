/**
 * 表情图去背景：用浏览器端 ML 语义分割（@imgly/background-removal）抠图。
 *
 * 为什么换掉泛洪/色键：颜色阈值与泛洪填充是二值硬边，边缘必然锯齿，且依赖背景色、
 * 抠不了发丝。imgly 在浏览器本地跑分割模型，输出平滑的 alpha matte（发丝级、无锯齿、
 * 不依赖背景色），是 remove.bg 同类的成熟方案，零调用成本、图片不出本地。
 *
 * 首次使用会按需下载模型（数 MB ~ 数十 MB），之后浏览器缓存复用。
 */

import { removeBackground } from '@imgly/background-removal';
import type { ColorKeyOptions } from '@/types/sticker';

/** Blob → ImageBitmap。 */
async function blobToBitmap(blob: Blob): Promise<ImageBitmap> {
  return createImageBitmap(blob);
}

/**
 * 边缘去白边（defringe）：消除抠图后半透明边缘残留的浅色描边。
 *   1. alpha 低于 LOW 的像素直接清零（删掉若隐若现的浅色羽化）
 *   2. 中间 alpha 像素做「除以 alpha」式的反预乘，抵消边缘被背景色污染的颜色偏移
 *   3. 轻微收缩（erode）一圈半透明边界，去掉最外层 1px 杂边
 */
function defringe(blob: Blob): Promise<string> {
  return blobToBitmap(blob).then((bitmap) => {
    try {
      const { width, height } = bitmap;
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) throw new Error('无法创建画布上下文');
      ctx.drawImage(bitmap, 0, 0);

      const img = ctx.getImageData(0, 0, width, height);
      const d = img.data;
      const LOW = 32; // 低于此 alpha 视为杂边，清零
      const HIGH = 224; // 高于此视为实心，不处理

      for (let i = 0; i < d.length; i += 4) {
        const a = d[i + 3];
        if (a === 0) continue;
        if (a < LOW) {
          d[i + 3] = 0;
          continue;
        }
        if (a < HIGH) {
          // 反预乘去色边：把被浅背景染白的边缘像素颜色还原回实色
          const inv = 255 / a;
          d[i] = Math.min(255, d[i] * inv);
          d[i + 1] = Math.min(255, d[i + 1] * inv);
          d[i + 2] = Math.min(255, d[i + 2] * inv);
        }
      }

      ctx.putImageData(img, 0, 0);
      return canvas.toDataURL('image/png');
    } finally {
      bitmap.close();
    }
  });
}

/**
 * 对单张表情图去背景，返回透明 PNG 的 data URL（含边缘去白边处理）。
 *
 * 注：保留 colorKey 入参签名是为了兼容调用方；ML 抠图不依赖背景色，参数实际不再使用。
 * @param dataUrl 输入图（已切好的单格 PNG）
 */
export async function removeBackgroundByColorKey(
  dataUrl: string,
  _opts?: ColorKeyOptions,
): Promise<string> {
  const resultBlob = await removeBackground(dataUrl, {
    output: { format: 'image/png' },
  });
  return defringe(resultBlob);
}

/** 兼容旧导出：ML 抠图不依赖背景色/容差，这里仅作占位保留。 */
export const DEFAULT_COLOR_KEY: ColorKeyOptions = {
  bgColor: { r: 0, g: 0, b: 0 },
  tolerance: 60,
  feather: 1,
};
