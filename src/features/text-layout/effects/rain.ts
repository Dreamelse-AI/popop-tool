import type { EffectParams } from '@/types/layout';
import { clamp, drawChar, flatChars, mulberry32, randomBetween, type RenderContext } from './shared';

/**
 * 竖排雨落层次（顺序可读 + 行列错落）：文字按原文顺序竖排。
 * 每列统一字号、列内自上而下等距；列与列之间字号不同、整列纵向位置错落，
 * 列从左到右推进，可顺着读出内容。错落以「列」为单位，列内整齐。
 */
export function drawRain(rc: RenderContext, text: string, params: EffectParams): void {
  const { ctx, width, height, scale } = rc;
  const rng = mulberry32(params.seed);
  const chars = flatChars(text);
  const count = Math.max(1, chars.length);

  const minSize = Math.min(params.minSize, params.maxSize) * scale;
  const maxSize = Math.max(params.minSize, params.maxSize) * scale;
  const blurMax = params.blur * scale;
  const pad = params.padding * scale;
  const scatter = params.spread / 100;

  const availableHeight = Math.max(80, height - pad * 2);
  const availableWidth = Math.max(80, width - pad * 2);
  let colGap = maxSize * 1.5;

  // 先按顺序切列：每列先定一个统一字号，按该字号算容量，装满再换列
  type Column = { chars: string[]; size: number; charGap: number };
  const columns: Column[] = [];
  let i = 0;
  while (i < count) {
    const size = randomBetween(rng, minSize, maxSize);
    const charGap = size * 1.32;
    const perColumn = Math.max(1, Math.floor(availableHeight / charGap));
    const take = Math.min(perColumn, count - i);
    columns.push({ chars: chars.slice(i, i + take), size, charGap });
    i += take;
  }

  // 横向自适应：列太多导致整体超宽时，按比例统一缩小字号/列距，硬保证不溢出
  let blockW = (columns.length - 1) * colGap + maxSize;
  let scaledMax = maxSize;
  if (blockW > availableWidth) {
    const k = availableWidth / blockW;
    colGap *= k;
    scaledMax *= k;
    columns.forEach((col) => {
      col.size *= k;
      col.charGap *= k;
    });
    blockW = availableWidth;
  }

  // 列整体横向居中
  const totalWidth = (columns.length - 1) * colGap;
  const startX = clamp(
    width / 2 - totalWidth / 2,
    pad + scaledMax * 0.6,
    width - pad - scaledMax * 0.6,
  );

  columns.forEach((col, c) => {
    const colX = startX + c * colGap;
    const columnHeight = (col.chars.length - 1) * col.charGap;
    // 整列纵向错落：在居中基础上按 scatter 上下浮动
    const colJitter = randomBetween(rng, -1, 1) * scatter * availableHeight * 0.18;
    const yStart = clamp(
      height / 2 - columnHeight / 2 + colJitter,
      pad + col.size * 0.5,
      height - pad - col.size * 0.5 - columnHeight,
    );
    // 整列统一一个模糊/透明度，做前后景层次
    const depthBlur = Math.pow(rng(), 1.6) * blurMax * 0.5;
    const alpha = clamp(1 - depthBlur / Math.max(1, blurMax + 6), 0.6, 1);

    col.chars.forEach((char, j) => {
      const y = yStart + j * col.charGap;
      drawChar(rc, char, colX, y, col.size, 0, alpha, depthBlur);
    });
  });

  // 底部暗渐变，增强纵深
  const gradient = ctx.createLinearGradient(0, height * 0.62, 0, height);
  gradient.addColorStop(0, 'rgba(0,0,0,0)');
  gradient.addColorStop(1, 'rgba(0,0,0,0.32)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
}
