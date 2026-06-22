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

/**
 * 图片填充字（顺序可读 + 自动放大字号）：
 * 文字按原文顺序在形状内部铺一遍（不重复），自动选取「能容纳全部文字的最大字号」，
 * 让内容刚好填满形状且单字尽量大、清晰可读。
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
    drawPlaceholder(rc);
    return;
  }

  const chars = flatChars(text);
  const count = Math.max(1, chars.length);
  const pad = params.padding * scale;

  // 形状按 bounds 等比放进可用区，保持原始长宽比
  const areaW = width - pad * 2;
  const areaH = height - pad * 2;
  const shapeW = (mask.bounds.right - mask.bounds.left) * mask.width;
  const shapeH = (mask.bounds.bottom - mask.bounds.top) * mask.height;
  const fit = Math.min(areaW / shapeW, areaH / shapeH);
  const drawW = shapeW * fit;
  const drawH = shapeH * fit;
  const offsetX = (width - drawW) / 2;
  const offsetY = (height - drawH) / 2;

  const toMaskNorm = (x: number, y: number): [number, number] => [
    mask.bounds.left + ((x - offsetX) / drawW) * (mask.bounds.right - mask.bounds.left),
    mask.bounds.top + ((y - offsetY) / drawH) * (mask.bounds.bottom - mask.bounds.top),
  ];

  // 给定字号，按阅读顺序收集形状内的槽位
  const collectSlots = (size: number): Array<{ x: number; y: number }> => {
    const stepX = size * 0.95;
    const stepY = size * 1.24;
    const slots: Array<{ x: number; y: number }> = [];
    if (params.fillDirection === 'horizontal') {
      for (let y = offsetY + size * 0.55; y <= offsetY + drawH - size * 0.35; y += stepY) {
        for (let x = offsetX + size * 0.45; x <= offsetX + drawW - size * 0.35; x += stepX) {
          const [nx, ny] = toMaskNorm(x, y);
          if (maskContains(mask, nx, ny)) slots.push({ x, y });
        }
      }
    } else {
      for (let x = offsetX + size * 0.5; x <= offsetX + drawW - size * 0.35; x += stepX * 1.15) {
        for (let y = offsetY + size * 0.55; y <= offsetY + drawH - size * 0.35; y += stepY) {
          const [nx, ny] = toMaskNorm(x, y);
          if (maskContains(mask, nx, ny)) slots.push({ x, y });
        }
      }
    }
    return slots;
  };

  // 二分找「能容纳全部文字的最大字号」：字号越大槽位越少
  const minPx = 12 * scale;
  const maxPx = 160 * scale;
  let lo = minPx;
  let hi = maxPx;
  let bestSize = minPx;
  for (let iter = 0; iter < 18 && hi - lo > 0.5; iter++) {
    const mid = (lo + hi) / 2;
    if (collectSlots(mid).length >= count) {
      bestSize = mid; // 还能放下全部 → 尝试更大
      lo = mid;
    } else {
      hi = mid; // 放不下 → 缩小
    }
  }

  const size = bestSize;
  const slots = collectSlots(size);
  // 按原文顺序填一遍：内容只出现一次
  const used = Math.min(chars.length, slots.length);
  for (let i = 0; i < used; i++) {
    drawChar(rc, chars[i], slots[i].x, slots[i].y, size, params.fontFamily, params.fontColor, 0, 1, 0);
  }
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
