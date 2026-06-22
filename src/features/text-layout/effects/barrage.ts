import type { EffectParams } from '@/types/layout';
import { clamp, drawChar, flatChars, mulberry32, randomBetween, type RenderContext } from './shared';

/**
 * 横排弹幕模式（顺序可读）：文字按原文顺序横排。
 * 行内从左到右、行与行从上到下推进，可顺着读出内容。
 * 保留轻微字号/模糊浮动营造弹幕层次，但不打乱阅读顺序。
 */
export function drawBarrage(rc: RenderContext, text: string, params: EffectParams): void {
  const { ctx, width, height, scale } = rc;
  const rng = mulberry32(params.seed);
  const chars = flatChars(text);
  const count = Math.max(1, chars.length);

  const baseSize = clamp(params.minSize, 12, 160) * scale;
  const blurMax = params.blur * scale;
  const pad = params.padding * scale;

  const availableWidth = Math.max(80, width - pad * 2);
  const charGap = baseSize * 1.12;
  // 每行能放多少字（从左到右）
  const perRow = Math.max(1, Math.floor(availableWidth / charGap));
  const rowCount = Math.ceil(count / perRow);
  const rowGap = baseSize * 1.5;
  // 整体竖向居中
  const totalHeight = (rowCount - 1) * rowGap;
  const startY = clamp(height / 2 - totalHeight / 2, pad + baseSize * 0.5, height - pad - baseSize * 0.5);

  let drawn = 0;
  for (let r = 0; r < rowCount && drawn < count; r++) {
    const y = startY + r * rowGap;
    const rowLetters = Math.min(perRow, count - drawn);
    const rowWidth = (rowLetters - 1) * charGap;
    const xStart = width / 2 - rowWidth / 2;

    for (let i = 0; i < rowLetters && drawn < count; i++) {
      const x = xStart + i * charGap;
      const depthBlur = Math.pow(rng(), 2) * blurMax * 0.5;
      const alpha = clamp(1 - depthBlur / Math.max(1, blurMax + 6), 0.55, 1);
      const sizeJitter = randomBetween(rng, 0.94, 1.06);
      drawChar(
        rc,
        chars[drawn],
        x,
        y,
        baseSize * sizeJitter,
        params.fontFamily,
        params.fontColor,
        0,
        alpha,
        depthBlur,
      );
      drawn++;
    }
  }

  const gradient = ctx.createLinearGradient(0, height * 0.62, 0, height);
  gradient.addColorStop(0, 'rgba(0,0,0,0)');
  gradient.addColorStop(1, 'rgba(0,0,0,0.26)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
}
