import { clamp } from './shared';

/**
 * 形状蒙版：标出「形状内部」的归一化区域，供 imageFill 在内部铺字。
 * 与上传图片提取的 mask 结构一致，渲染层统一消费。
 */
export interface ShapeMask {
  width: number;
  height: number;
  mask: Uint8Array;
  bounds: { left: number; top: number; right: number; bottom: number };
}

export function maskContains(mask: ShapeMask, nx: number, ny: number): boolean {
  if (nx < 0 || nx > 1 || ny < 0 || ny > 1) return false;
  const x = clamp(Math.floor(nx * mask.width), 0, mask.width - 1);
  const y = clamp(Math.floor(ny * mask.height), 0, mask.height - 1);
  return mask.mask[y * mask.width + x] === 1;
}

/** 在归一化坐标系（0-1）里把形状画成填充路径。 */
type ShapePath = (ctx: CanvasRenderingContext2D, w: number, h: number) => void;

const SHAPE_PATHS: Record<'heart' | 'star' | 'circle' | 'diamond', ShapePath> = {
  circle(ctx, w, h) {
    const cx = w / 2;
    const cy = h / 2;
    const r = Math.min(w, h) * 0.46;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.closePath();
  },
  diamond(ctx, w, h) {
    const cx = w / 2;
    const cy = h / 2;
    const rx = w * 0.46;
    const ry = h * 0.46;
    ctx.beginPath();
    ctx.moveTo(cx, cy - ry);
    ctx.lineTo(cx + rx, cy);
    ctx.lineTo(cx, cy + ry);
    ctx.lineTo(cx - rx, cy);
    ctx.closePath();
  },
  star(ctx, w, h) {
    const cx = w / 2;
    const cy = h / 2;
    const outer = Math.min(w, h) * 0.48;
    const inner = outer * 0.42;
    const points = 5;
    ctx.beginPath();
    for (let i = 0; i < points * 2; i++) {
      const radius = i % 2 === 0 ? outer : inner;
      const angle = (Math.PI / points) * i - Math.PI / 2;
      const x = cx + Math.cos(angle) * radius;
      const y = cy + Math.sin(angle) * radius;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
  },
  heart(ctx, w, h) {
    // 参数方程心形，缩放到画布
    const cx = w / 2;
    const cy = h / 2;
    const s = Math.min(w, h) * 0.028;
    ctx.beginPath();
    for (let t = 0; t <= Math.PI * 2; t += 0.02) {
      const x = 16 * Math.sin(t) ** 3;
      const y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
      const px = cx + x * s;
      const py = cy - y * s;
      if (t === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
  },
};

/**
 * 程序化生成内置形状蒙版。把形状填充画到离屏画布，再二值化为 mask。
 */
export function buildShapeMask(shape: 'heart' | 'star' | 'circle' | 'diamond'): ShapeMask | null {
  const size = 480;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;

  ctx.fillStyle = '#000';
  SHAPE_PATHS[shape](ctx, size, size);
  ctx.fill();

  const pixels = ctx.getImageData(0, 0, size, size).data;
  const mask = new Uint8Array(size * size);
  let minX = size;
  let minY = size;
  let maxX = 0;
  let maxY = 0;
  let filled = 0;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;
      if (pixels[idx + 3] > 40) {
        mask[y * size + x] = 1;
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
    width: size,
    height: size,
    mask,
    bounds: {
      left: minX / size,
      top: minY / size,
      right: maxX / size,
      bottom: maxY / size,
    },
  };
}
