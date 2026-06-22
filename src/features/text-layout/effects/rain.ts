import type { EffectParams } from '@/types/layout';
import { clamp, drawChar, flatChars, mulberry32, randomBetween, type RenderContext } from './shared';

/**
 * 竖排雨落层次（顺序可读 + 错落）：文字按原文顺序竖排。
 * 列内自上而下、列与列从左到右推进，可顺着读出内容；
 * 字号在 min~max 间起伏、位置带轻微横向抖动，营造雨落错落而非死板网格。
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
  const jitter = (params.spread / 100) * maxSize * 0.6;

  const visibleTop = pad;
  const visibleBottom = height - pad;
  const colGap = maxSize * 1.5;

  // 先按顺序把字分配到各列（自上而下放满一列再换下一列）
  type Glyph = { char: string; size: number; gap: number };
  const columns: Glyph[][] = [];
  let current: Glyph[] = [];
  let usedHeight = 0;
  for (let i = 0; i < count; i++) {
    const size = randomBetween(rng, minSize, maxSize);
    const gap = size * randomBetween(rng, 1.18, 1.42);
    if (usedHeight + gap > visibleBottom - visibleTop && current.length) {
      columns.push(current);
      current = [];
      usedHeight = 0;
    }
    current.push({ char: chars[i], size, gap });
    usedHeight += gap;
  }
  if (current.length) columns.push(current);

  // 列整体横向居中
  const totalWidth = (columns.length - 1) * colGap;
  const startX = clamp(
    width / 2 - totalWidth / 2,
    pad + maxSize * 0.6,
    width - pad - maxSize * 0.6,
  );

  columns.forEach((col, c) => {
    const colHeight = col.reduce((sum, g) => sum + g.gap, 0) - (col[col.length - 1]?.gap ?? 0);
    let y = height / 2 - colHeight / 2;
    const colX = startX + c * colGap;
    col.forEach((g, j) => {
      const xJitter = randomBetween(rng, -jitter, jitter);
      const depthBlur = Math.pow(rng(), 2) * blurMax * 0.5;
      const alpha = clamp(1 - depthBlur / Math.max(1, blurMax + 6), 0.55, 1);
      drawChar(
        rc,
        g.char,
        colX + xJitter,
        y,
        g.size,
        params.fontFamily,
        params.fontColor,
        0,
        alpha,
        depthBlur,
      );
      if (j < col.length - 1) y += g.gap;
    });
  });

  // 底部暗渐变，增强纵深
  const gradient = ctx.createLinearGradient(0, height * 0.62, 0, height);
  gradient.addColorStop(0, 'rgba(0,0,0,0)');
  gradient.addColorStop(1, 'rgba(0,0,0,0.32)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
}
