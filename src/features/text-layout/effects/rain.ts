import type { EffectParams } from '@/types/layout';
import {
  clamp,
  drawChar,
  flatChars,
  mulberry32,
  randomBetween,
  textLines,
  type RenderContext,
} from './shared';

/**
 * 竖排雨落层次：文字拆成单字，分若干竖列从上往下排。
 * 字号/模糊随机，越模糊越透明形成前后景层次，底部叠暗渐变。
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
  const axisY = height * (params.axisCenter / 100);

  const columnCount = Math.max(5, Math.ceil(count / 18), Math.floor(Math.sqrt(count) * 1.3));
  const colGap = (width - pad * 2) / columnCount;
  const visibleTop = pad;
  const visibleBottom = height - pad;
  const availableHeight = Math.max(80, visibleBottom - visibleTop);

  const lines = textLines(text);
  const flat = lines.flat();
  let drawn = 0;

  for (let c = 0; c < columnCount && drawn < count; c++) {
    const size = randomBetween(rng, minSize, maxSize);
    const blur = Math.pow(rng(), 1.2) * blurMax;
    const alpha = clamp(1 - blur / Math.max(1, blurMax + 3), 0.12, 1);
    const x = pad + c * colGap + randomBetween(rng, colGap * 0.15, colGap * 0.85);
    const charGap = size * randomBetween(rng, 0.9, 1.28);
    const desiredLetters = Math.max(4, Math.floor(randomBetween(rng, 5, 18)));
    const maxVisibleLetters = Math.max(1, Math.floor((availableHeight - size) / charGap) + 1);
    const columnLetters = Math.min(desiredLetters, maxVisibleLetters, count - drawn);
    const columnHeight = (columnLetters - 1) * charGap;
    const centerJitter = randomBetween(rng, -1, 1) * availableHeight * 0.045;
    const minStart = visibleTop + size * 0.55;
    const maxStart = visibleBottom - size * 0.55 - columnHeight;
    const centeredStart = axisY - columnHeight / 2 + centerJitter;
    const yStart =
      minStart > maxStart ? height / 2 - columnHeight / 2 : clamp(centeredStart, minStart, maxStart);
    const slightAngle = randomBetween(rng, -0.035, 0.035);
    const depthScale = randomBetween(rng, 0.78, 1.08);

    for (let j = 0; j < columnLetters && drawn < count; j++) {
      const y = yStart + j * charGap;
      const fade = j < 2 ? 0.68 + j * 0.16 : 1;
      const char = flat.length ? flat[drawn % flat.length] : '字';
      drawChar(
        rc,
        char,
        x,
        y,
        size * depthScale,
        params.fontFamily,
        params.fontColor,
        slightAngle,
        alpha * fade,
        blur,
      );
      drawn++;
    }
  }

  // 底部暗渐变，增强纵深
  const gradient = ctx.createLinearGradient(0, height * 0.58, 0, height);
  gradient.addColorStop(0, 'rgba(0,0,0,0)');
  gradient.addColorStop(1, 'rgba(0,0,0,0.38)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
}
