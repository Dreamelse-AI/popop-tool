/**
 * 文件 → 压缩后的 base64 data URL（单张）。
 *
 * 配色提取与永久存储都用这张图：长边压到上限以控制体积（存盘 + 传输）。
 * 输出 JPEG 会丢透明，但配色场景下原图多为照片/截图，体积优先；
 * 若是 PNG 且较小则原样保留，兼顾带透明的设计图。
 */

/** 长边上限（px）。 */
const MAX_EDGE = 1280;
/** 小于此体积的图不重新编码，原样返回（保留 PNG 透明等）。 */
const SKIP_RECODE_BYTES = 600 * 1024;

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('读取图片失败'));
    reader.readAsDataURL(file);
  });
}

/** 把单个图片文件转成（必要时压缩后的）base64 data URL。 */
export async function fileToDataUrl(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('请选择图片文件');
  }
  const raw = await readAsDataUrl(file);
  if (file.size <= SKIP_RECODE_BYTES) return raw;

  const blob = await (await fetch(raw)).blob();
  const bitmap = await createImageBitmap(blob);
  try {
    const { width, height } = bitmap;
    const longEdge = Math.max(width, height);
    if (longEdge <= MAX_EDGE) return raw;

    const scale = MAX_EDGE / longEdge;
    const w = Math.round(width * scale);
    const h = Math.round(height * scale);
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return raw;
    ctx.drawImage(bitmap, 0, 0, w, h);
    return canvas.toDataURL('image/jpeg', 0.9);
  } finally {
    bitmap.close();
  }
}
