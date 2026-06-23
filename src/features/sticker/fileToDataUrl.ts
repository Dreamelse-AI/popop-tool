/**
 * 把本地图片文件读成 base64 data URI，用于喂给 gpt-image-2 图生图（image_urls）。
 *
 * 同时做轻量压缩：长边超过上限时按比例缩放，避免参考图过大（单图上限 20M）。
 */

/** 参考图长边上限（px）。超出则等比缩小，控制 base64 体积。 */
const MAX_EDGE = 1536;

/** 读文件为 data URL。 */
function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('读取图片失败'));
    reader.readAsDataURL(file);
  });
}

/** 把 data URL 缩放到长边不超过 MAX_EDGE，返回 JPEG data URL（控制体积）。 */
async function downscale(dataUrl: string): Promise<string> {
  const res = await fetch(dataUrl);
  const blob = await res.blob();
  const bitmap = await createImageBitmap(blob);
  try {
    const { width, height } = bitmap;
    const longEdge = Math.max(width, height);
    if (longEdge <= MAX_EDGE) return dataUrl;

    const scale = MAX_EDGE / longEdge;
    const w = Math.round(width * scale);
    const h = Math.round(height * scale);
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return dataUrl;
    ctx.drawImage(bitmap, 0, 0, w, h);
    return canvas.toDataURL('image/jpeg', 0.9);
  } finally {
    bitmap.close();
  }
}

/**
 * 把多个图片文件转成（必要时压缩后的）base64 data URI 数组。
 * 非图片文件会被跳过。
 */
export async function filesToDataUrls(files: FileList | File[]): Promise<string[]> {
  const list = Array.from(files).filter((f) => f.type.startsWith('image/'));
  const out: string[] = [];
  for (const file of list) {
    const raw = await readAsDataUrl(file);
    out.push(await downscale(raw));
  }
  return out;
}
