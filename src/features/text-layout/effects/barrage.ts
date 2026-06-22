import type { EffectParams } from '@/types/layout';
import { clamp, drawChar, flatChars, mulberry32, randomBetween, type RenderContext } from './shared';

/**
 * 横排弹幕模式（顺序可读 + 行列错落）：文字按原文顺序横排。
 * 每行统一字号、行内从左到右等距；行与行之间字号不同、整行横向位置错落，
 * 行从上到下推进，可顺着读出内容。错落以「行」为单位，行内整齐。
 */
export function drawBarrage(rc: RenderContext, text: string, params: EffectParams): void {
  const { ctx, width, height, scale } = rc;
  const rng = mulberry32(params.seed);
  const chars = flatChars(text);
  const count = Math.max(1, chars.length);

  const minSize = Math.min(params.minSize, params.maxSize) * scale;
  const maxSize = Math.max(params.minSize, params.maxSize) * scale;
  const blurMax = params.blur * scale;
  const pad = params.padding * scale;
  const scatter = params.spread / 100;

  const availableWidth = Math.max(80, width - pad * 2);
  const rowGap = maxSize * 1.5;

  // 先按顺序切行：每行先定一个统一字号，按该字号算容量，装满再换行
  type Row = { chars: string[]; size: number; charGap: number };
  const rows: Row[] = [];
  let i = 0;
  while (i < count) {
    const size = randomBetween(rng, minSize, maxSize);
    const charGap = size * 1.12;
    const perRow = Math.max(1, Math.floor(availableWidth / charGap));
    const take = Math.min(perRow, count - i);
    rows.push({ chars: chars.slice(i, i + take), size, charGap });
    i += take;
  }

  // 行整体纵向居中
  const totalHeight = (rows.length - 1) * rowGap;
  const startY = clamp(
    height / 2 - totalHeight / 2,
    pad + maxSize * 0.6,
    height - pad - maxSize * 0.6,
  );

  rows.forEach((row, r) => {
    const rowY = startY + r * rowGap;
    const rowWidth = (row.chars.length - 1) * row.charGap;
    // 整行横向错落：在居中基础上按 scatter 左右浮动
    const rowJitter = randomBetween(rng, -1, 1) * scatter * availableWidth * 0.16;
    const xStart = clamp(
      width / 2 - rowWidth / 2 + rowJitter,
      pad + row.size * 0.5,
      width - pad - row.size * 0.5 - rowWidth,
    );
    const depthBlur = Math.pow(rng(), 1.6) * blurMax * 0.5;
    const alpha = clamp(1 - depthBlur / Math.max(1, blurMax + 6), 0.6, 1);

    row.chars.forEach((char, j) => {
      const x = xStart + j * row.charGap;
      drawChar(rc, char, x, rowY, row.size, 0, alpha, depthBlur);
    });
  });

  const gradient = ctx.createLinearGradient(0, height * 0.62, 0, height);
  gradient.addColorStop(0, 'rgba(0,0,0,0)');
  gradient.addColorStop(1, 'rgba(0,0,0,0.26)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
}
