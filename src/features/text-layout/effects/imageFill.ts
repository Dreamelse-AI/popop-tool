import type { EffectParams } from '@/types/layout';
import { clamp, drawChar, flatChars, type RenderContext } from './shared';

/** 图片轮廓 mask：把上传图按明暗阈值二值化，标出形状内部区域。 */
interface ImageMask {
  width: number;
  height: number;
  mask: Uint8Array;
  bounds: { left: number; top: number; right: number; bottom: number };
}

/** 从图片提取 mask：alpha 足够且亮度低于阈值的像素视为「形状内部」。 */
export function buildImageMask(img: HTMLImageElement, threshold: number): ImageMask | null {
  const sample = document.createElement('canvas');
  const maxSide = 520;
  const ratio = Math.min(maxSide / img.width, maxSide / img.height, 1);
  sample.width = Math.max(1, Math.round(img.width * ratio));
  sample.height = Math.max(1, Math.round(img.height * ratio));
  const sctx = sample.getContext('2d', { willReadFrequently: true });
  if (!sctx) return null;
  sctx.drawImage(img, 0, 0, sample.width, sample.height);
  const pixels = sctx.getImageData(0, 0, sample.width, sample.height).data;
  const mask = new Uint8Array(sample.width * sample.height);

  let minX = sample.width;
  let minY = sample.height;
  let maxX = 0;
  let maxY = 0;
  let filled = 0;

  for (let y = 0; y < sample.height; y++) {
    for (let x = 0; x < sample.width; x++) {
      const idx = (y * sample.width + x) * 4;
      const alpha = pixels[idx + 3];
      const brightness = pixels[idx] * 0.299 + pixels[idx + 1] * 0.587 + pixels[idx + 2] * 0.114;
      if (alpha > 24 && brightness <= threshold) {
        mask[y * sample.width + x] = 1;
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
        filled++;
      }
    }
  }

  if (!filled) return null;
  return {
    width: sample.width,
    height: sample.height,
    mask,
    bounds: {
      left: minX / sample.width,
      top: minY / sample.height,
      right: maxX / sample.width,
      bottom: maxY / sample.height,
    },
  };
}

function maskContains(mask: ImageMask, nx: number, ny: number): boolean {
  if (nx < 0 || nx > 1 || ny < 0 || ny > 1) return false;
  const x = clamp(Math.floor(nx * mask.width), 0, mask.width - 1);
  const y = clamp(Math.floor(ny * mask.height), 0, mask.height - 1);
  return mask.mask[y * mask.width + x] === 1;
}

/** 取居中、连续的填充槽位，避免文字稀疏散落。 */
function centeredGroups<T>(groups: T[][], count: number): T[] {
  const active = groups.filter((g) => g.length);
  const total = active.reduce((sum, g) => sum + g.length, 0);
  if (!total || !count) return [];
  if (count >= total) return active.flat();

  let start = Math.floor(active.length / 2);
  let end = start;
  let capacity = active[start].length;
  while (capacity < count && (start > 0 || end < active.length - 1)) {
    const leftCap = start > 0 ? active[start - 1].length : -1;
    const rightCap = end < active.length - 1 ? active[end + 1].length : -1;
    if (rightCap >= leftCap) {
      end++;
      capacity += active[end].length;
    } else {
      start--;
      capacity += active[start].length;
    }
  }
  return active
    .slice(start, end + 1)
    .flat()
    .slice(0, count);
}

/** 无图时的椭圆兜底形状。 */
function drawEllipseFallback(rc: RenderContext, text: string, params: EffectParams): void {
  const { ctx, width, height, scale } = rc;
  const size = params.minSize * scale;
  const chars = flatChars(text);
  const cx = width / 2;
  const cy = height / 2;
  const rx = width * 0.3;
  const ry = height * 0.34;
  const slots: Array<{ x: number; y: number }> = [];

  for (let y = cy - ry; y <= cy + ry; y += size * 1.25) {
    for (let x = cx - rx; x <= cx + rx; x += size * 0.95) {
      if (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1) {
        slots.push({ x, y });
      }
    }
  }

  ctx.save();
  ctx.strokeStyle = 'rgba(0,0,0,0.08)';
  ctx.strokeRect(cx - rx, cy - ry, rx * 2, ry * 2);
  ctx.restore();

  const used = centeredGroups([slots], chars.length || slots.length);
  used.forEach((slot, index) => {
    const char = chars.length ? chars[index % chars.length] : '字';
    drawChar(rc, char, slot.x, slot.y, size, params.fontFamily, params.fontColor, 0, 1, 0);
  });
}

/**
 * 图片填充字：在上传图片的形状轮廓内部铺满文字。
 * 无图片时退化为椭圆形状兜底。
 */
export function drawImageFill(
  rc: RenderContext,
  text: string,
  params: EffectParams,
  image: HTMLImageElement | null,
): void {
  const { width, height, scale } = rc;

  if (!image) {
    drawEllipseFallback(rc, text, params);
    return;
  }

  const mask = buildImageMask(image, params.imageThreshold);
  if (!mask) {
    drawEllipseFallback(rc, text, params);
    return;
  }

  const size = params.minSize * scale;
  const pad = params.padding * scale;
  const areaX = pad;
  const areaY = pad;
  const areaW = width - pad * 2;
  const areaH = height - pad * 2;
  const left = areaX + mask.bounds.left * areaW;
  const right = areaX + mask.bounds.right * areaW;
  const top = areaY + mask.bounds.top * areaH;
  const bottom = areaY + mask.bounds.bottom * areaH;
  const stepX = size * 0.95;
  const stepY = size * 1.24;
  const chars = flatChars(text);

  const toNorm = (x: number, y: number): [number, number] => [
    (x - areaX) / areaW,
    (y - areaY) / areaH,
  ];

  if (params.fillDirection === 'horizontal') {
    const rows: Array<Array<{ x: number; y: number }>> = [];
    for (let y = top + size * 0.55; y <= bottom - size * 0.35; y += stepY) {
      const row: Array<{ x: number; y: number }> = [];
      for (let x = left + size * 0.45; x <= right - size * 0.35; x += stepX) {
        const [nx, ny] = toNorm(x, y);
        if (maskContains(mask, nx, ny)) row.push({ x, y });
      }
      if (row.length) rows.push(row);
    }
    const total = rows.reduce((s, r) => s + r.length, 0);
    const want = chars.length || total;
    centeredGroups(rows, Math.min(want, total)).forEach((slot, index) => {
      const char = chars.length ? chars[index % chars.length] : '字';
      drawChar(rc, char, slot.x, slot.y, size, params.fontFamily, params.fontColor, 0, 1, 0);
    });
  } else {
    const columns: Array<Array<{ x: number; y: number }>> = [];
    for (let x = left + size * 0.5; x <= right - size * 0.35; x += stepX * 1.15) {
      const column: Array<{ x: number; y: number }> = [];
      for (let y = top + size * 0.55; y <= bottom - size * 0.35; y += stepY) {
        const [nx, ny] = toNorm(x, y);
        if (maskContains(mask, nx, ny)) column.push({ x, y });
      }
      if (column.length) columns.push(column);
    }
    const total = columns.reduce((s, c) => s + c.length, 0);
    const want = chars.length || total;
    centeredGroups(columns, Math.min(want, total)).forEach((slot, index) => {
      const char = chars.length ? chars[index % chars.length] : '字';
      drawChar(rc, char, slot.x, slot.y, size, params.fontFamily, params.fontColor, 0, 1, 0);
    });
  }
}
