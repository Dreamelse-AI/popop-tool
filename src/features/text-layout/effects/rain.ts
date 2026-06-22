import type { EffectParams } from '@/types/layout';
import { clamp, drawChar, flatChars, mulberry32, randomBetween, type RenderContext } from './shared';

/**
 * 竖排雨落层次（顺序可读）：文字按原文顺序竖排。
 * 列内自上而下、列与列从左到右推进，可顺着读出内容。
 * 保留轻微字号/模糊浮动营造层次，但不打乱阅读顺序。
 */
export function drawRain(rc: RenderContext, text: string, params: EffectParams): void {
  const { ctx, width, height, scale } = rc;
  const rng = mulberry32(params.seed);
  const chars = flatChars(text);
  const count = Math.max(1, chars.length);

  const baseSize = clamp(params.minSize, 12, 160) * scale;
  const blurMax = params.blur * scale;
  const pad = params.padding * scale;

  const availableHeight = Math.max(80, height - pad * 2);
  const charGap = baseSize * 1.32;
  // 每列能放多少字（自上而下）
  const perColumn = Math.max(1, Math.floor(availableHeight / charGap));
  const columnCount = Math.ceil(count / perColumn);
  const colGap = baseSize * 1.5;
  // 整体居中：所有列横向排布后整体居中
  const totalWidth = (columnCount - 1) * colGap;
  const startX = clamp(width / 2 - totalWidth / 2, pad + baseSize * 0.5, width - pad - baseSize * 0.5);

  let drawn = 0;
  for (let c = 0; c < columnCount && drawn < count; c++) {
    const x = startX + c * colGap;
    const columnLetters = Math.min(perColumn, count - drawn);
    const columnHeight = (columnLetters - 1) * charGap;
    const yStart = height / 2 - columnHeight / 2;

    for (let j = 0; j < columnLetters && drawn < count; j++) {
      const y = yStart + j * charGap;
      // 轻微的前后景：靠后的列略小略虚，但保证清晰可读
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

  // 底部暗渐变，增强纵深
  const gradient = ctx.createLinearGradient(0, height * 0.62, 0, height);
  gradient.addColorStop(0, 'rgba(0,0,0,0)');
  gradient.addColorStop(1, 'rgba(0,0,0,0.32)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
}
