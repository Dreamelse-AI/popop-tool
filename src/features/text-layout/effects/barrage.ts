import type { EffectParams } from '@/types/layout';
import { clamp, drawChar, flatChars, mulberry32, randomBetween, type RenderContext } from './shared';

/**
 * 横排弹幕模式（顺序可读 + 错落）：文字按原文顺序横排。
 * 行内从左到右、行与行从上到下推进，可顺着读出内容；
 * 字号在 min~max 间起伏、位置带轻微纵向抖动，营造弹幕错落而非死板网格。
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
  const jitter = (params.spread / 100) * maxSize * 0.6;

  const visibleLeft = pad;
  const visibleRight = width - pad;
  const rowGap = maxSize * 1.5;

  // 先按顺序把字分配到各行（从左到右放满一行再换下一行）
  type Glyph = { char: string; size: number; gap: number };
  const rows: Glyph[][] = [];
  let current: Glyph[] = [];
  let usedWidth = 0;
  for (let i = 0; i < count; i++) {
    const size = randomBetween(rng, minSize, maxSize);
    const gap = size * randomBetween(rng, 1.0, 1.22);
    if (usedWidth + gap > visibleRight - visibleLeft && current.length) {
      rows.push(current);
      current = [];
      usedWidth = 0;
    }
    current.push({ char: chars[i], size, gap });
    usedWidth += gap;
  }
  if (current.length) rows.push(current);

  // 行整体纵向居中
  const totalHeight = (rows.length - 1) * rowGap;
  const startY = clamp(
    height / 2 - totalHeight / 2,
    pad + maxSize * 0.6,
    height - pad - maxSize * 0.6,
  );

  rows.forEach((row, r) => {
    const rowWidth = row.reduce((sum, g) => sum + g.gap, 0) - (row[row.length - 1]?.gap ?? 0);
    let x = width / 2 - rowWidth / 2;
    const rowY = startY + r * rowGap;
    row.forEach((g, i) => {
      const yJitter = randomBetween(rng, -jitter, jitter);
      const depthBlur = Math.pow(rng(), 2) * blurMax * 0.5;
      const alpha = clamp(1 - depthBlur / Math.max(1, blurMax + 6), 0.55, 1);
      drawChar(
        rc,
        g.char,
        x,
        rowY + yJitter,
        g.size,
        params.fontFamily,
        params.fontColor,
        0,
        alpha,
        depthBlur,
      );
      if (i < row.length - 1) x += g.gap;
    });
  });

  const gradient = ctx.createLinearGradient(0, height * 0.62, 0, height);
  gradient.addColorStop(0, 'rgba(0,0,0,0)');
  gradient.addColorStop(1, 'rgba(0,0,0,0.26)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
}
