import type { EffectParams } from '@/types/layout';
import { drawChar, flatChars, type RenderContext } from './shared';
import { buildShapeMask, maskContains, type ShapeMask } from './maskShapes';

/** 从上传图片提取 mask：alpha 足够且亮度低于阈值的像素视为「形状内部」。 */
export function buildImageMask(img: HTMLImageElement, threshold: number): ShapeMask | null {
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

/** 按 fillShape 取得 mask：内置形状程序生成，'image' 取上传图。 */
function resolveMask(params: EffectParams, image: HTMLImageElement | null): ShapeMask | null {
  if (params.fillShape === 'image') {
    return image ? buildImageMask(image, params.imageThreshold) : null;
  }
  return buildShapeMask(params.fillShape);
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

/**
 * 图片填充字：在形状轮廓内部铺满文字。
 * 形状来自内置（爱心/星星/圆形/菱形）或上传图片。
 */
export function drawImageFill(
  rc: RenderContext,
  text: string,
  params: EffectParams,
  image: HTMLImageElement | null,
): void {
  const { width, height, scale } = rc;
  const mask = resolveMask(params, image);

  if (!mask) {
    // fillShape='image' 但还没上传：提示占位
    drawPlaceholder(rc);
    return;
  }

  // 把形状按 bounds 居中等比放进画布可用区，保持形状原始长宽比
  const size = params.minSize * scale;
  const pad = params.padding * scale;
  const areaW = width - pad * 2;
  const areaH = height - pad * 2;
  const shapeW = (mask.bounds.right - mask.bounds.left) * mask.width;
  const shapeH = (mask.bounds.bottom - mask.bounds.top) * mask.height;
  const fit = Math.min(areaW / shapeW, areaH / shapeH);
  const drawW = shapeW * fit;
  const drawH = shapeH * fit;
  const offsetX = (width - drawW) / 2;
  const offsetY = (height - drawH) / 2;

  // 画布坐标 → mask 归一化坐标
  const toMaskNorm = (x: number, y: number): [number, number] => [
    mask.bounds.left + ((x - offsetX) / drawW) * (mask.bounds.right - mask.bounds.left),
    mask.bounds.top + ((y - offsetY) / drawH) * (mask.bounds.bottom - mask.bounds.top),
  ];

  const stepX = size * 0.95;
  const stepY = size * 1.24;
  const chars = flatChars(text);

  if (params.fillDirection === 'horizontal') {
    const rows: Array<Array<{ x: number; y: number }>> = [];
    for (let y = offsetY + size * 0.55; y <= offsetY + drawH - size * 0.35; y += stepY) {
      const row: Array<{ x: number; y: number }> = [];
      for (let x = offsetX + size * 0.45; x <= offsetX + drawW - size * 0.35; x += stepX) {
        const [nx, ny] = toMaskNorm(x, y);
        if (maskContains(mask, nx, ny)) row.push({ x, y });
      }
      if (row.length) rows.push(row);
    }
    fillSlots(rc, rows, chars, params, size);
  } else {
    const columns: Array<Array<{ x: number; y: number }>> = [];
    for (let x = offsetX + size * 0.5; x <= offsetX + drawW - size * 0.35; x += stepX * 1.15) {
      const column: Array<{ x: number; y: number }> = [];
      for (let y = offsetY + size * 0.55; y <= offsetY + drawH - size * 0.35; y += stepY) {
        const [nx, ny] = toMaskNorm(x, y);
        if (maskContains(mask, nx, ny)) column.push({ x, y });
      }
      if (column.length) columns.push(column);
    }
    fillSlots(rc, columns, chars, params, size);
  }
}

function fillSlots(
  rc: RenderContext,
  groups: Array<Array<{ x: number; y: number }>>,
  chars: string[],
  params: EffectParams,
  size: number,
): void {
  const total = groups.reduce((s, g) => s + g.length, 0);
  const want = chars.length || total;
  centeredGroups(groups, Math.min(want, total)).forEach((slot, index) => {
    const char = chars.length ? chars[index % chars.length] : '字';
    drawChar(rc, char, slot.x, slot.y, size, params.fontFamily, params.fontColor, 0, 1, 0);
  });
}

/** fillShape='image' 但未上传图片时的占位提示。 */
function drawPlaceholder(rc: RenderContext): void {
  const { ctx, width, height } = rc;
  ctx.save();
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  ctx.font = `${24 * rc.scale}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('请上传一张形状图片', width / 2, height / 2);
  ctx.restore();
}
