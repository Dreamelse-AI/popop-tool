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
 * 边缘去白边（defringe）：温和清理抠图后半透明边缘的杂边。
 *
 * 为什么不做「反预乘还色」：当主体本身是白/浅色（如白裙子），反预乘会把浅色边缘误当成
 * 被背景污染而过度处理，反而吃掉白色服装边缘。这里只做最轻量的清理：
 *   - alpha 极低（< LOW）的像素清零，去掉若隐若现的羽化杂边
 *   - 其余像素保持 ML 输出的原始 alpha 与颜色，避免误伤浅色主体
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
      const LOW = 16; // 低于此 alpha 视为杂边，清零（调低，减少对主体边缘的侵蚀）

      for (let i = 0; i < d.length; i += 4) {
        if (d[i + 3] !== 0 && d[i + 3] < LOW) d[i + 3] = 0;
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
