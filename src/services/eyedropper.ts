/**
 * 吸管取色工具。
 *
 * 优先用浏览器原生 EyeDropper API（Chrome/Edge 113+）：可在全屏任意位置吸色。
 * 不支持时返回 null，由调用方降级为「点原图取像素色」。
 */

/** 原生 EyeDropper 类型（标准库尚未内置，按需声明）。 */
interface EyeDropperResult {
  sRGBHex: string;
}
interface EyeDropperLike {
  open: (options?: { signal?: AbortSignal }) => Promise<EyeDropperResult>;
}
type EyeDropperCtor = new () => EyeDropperLike;

/** 当前浏览器是否支持原生吸管。 */
export function supportsEyeDropper(): boolean {
  return typeof window !== 'undefined' && 'EyeDropper' in window;
}

/**
 * 调用原生吸管取色，返回 #hex；用户取消或不支持返回 null。
 */
export async function pickColorWithEyeDropper(): Promise<string | null> {
  const Ctor = (window as unknown as { EyeDropper?: EyeDropperCtor }).EyeDropper;
  if (!Ctor) return null;
  try {
    const dropper = new Ctor();
    const { sRGBHex } = await dropper.open();
    return sRGBHex;
  } catch {
    // 用户按 Esc 取消等
    return null;
  }
}

/**
 * 降级取色：在给定图片元素上，按点击位置取像素颜色。
 * @param img 已加载的 <img>（同源/ dataURL，可读像素）
 * @param clientX 点击的视口 x
 * @param clientY 点击的视口 y
 * @returns #hex，越界或失败返回 null
 */
export function pickColorFromImage(
  img: HTMLImageElement,
  clientX: number,
  clientY: number,
): string | null {
  const rect = img.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return null;
  // 点击位置 → 图片自然像素坐标
  const relX = (clientX - rect.left) / rect.width;
  const relY = (clientY - rect.top) / rect.height;
  if (relX < 0 || relX > 1 || relY < 0 || relY > 1) return null;

  const nw = img.naturalWidth || img.width;
  const nh = img.naturalHeight || img.height;
  const px = Math.min(nw - 1, Math.max(0, Math.floor(relX * nw)));
  const py = Math.min(nh - 1, Math.max(0, Math.floor(relY * nh)));

  const canvas = document.createElement('canvas');
  canvas.width = nw;
  canvas.height = nh;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  try {
    ctx.drawImage(img, 0, 0, nw, nh);
    const { data } = ctx.getImageData(px, py, 1, 1);
    return rgbToHex(data[0], data[1], data[2]);
  } catch {
    return null;
  }
}

function toHex2(n: number): string {
  return Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
}

function rgbToHex(r: number, g: number, b: number): string {
  return `#${toHex2(r)}${toHex2(g)}${toHex2(b)}`;
}
