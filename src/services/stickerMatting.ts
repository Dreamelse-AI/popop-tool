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

/** 把 Blob 读成 data URL。 */
function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('读取抠图结果失败'));
    reader.readAsDataURL(blob);
  });
}

/**
 * 对单张表情图去背景，返回透明 PNG 的 data URL。
 *
 * 注：保留 colorKey 入参签名是为了兼容调用方；ML 抠图不依赖背景色，参数实际不再使用。
 * @param dataUrl 输入图（已切好的单格 PNG）
 */
export async function removeBackgroundByColorKey(
  dataUrl: string,
  _opts?: ColorKeyOptions,
): Promise<string> {
  const resultBlob = await removeBackground(dataUrl, {
    // 输出 PNG 保留 alpha 通道
    output: { format: 'image/png' },
  });
  return blobToDataUrl(resultBlob);
}

/** 兼容旧导出：ML 抠图不依赖背景色/容差，这里仅作占位保留。 */
export const DEFAULT_COLOR_KEY: ColorKeyOptions = {
  bgColor: { r: 0, g: 0, b: 0 },
  tolerance: 60,
  feather: 1,
};
