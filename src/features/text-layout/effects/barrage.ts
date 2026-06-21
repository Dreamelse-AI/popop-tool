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
 * 横排弹幕模式：与雨落同构，改为横向行排列，围绕竖轴中心散开。
 * 字号/模糊随机，底部叠暗渐变。
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
  const centerX = width * (params.axisCenter / 100);

  const visibleLeft = pad;
  const visibleRight = width - pad;
  const visibleTop = pad;
  const visibleBottom = height - pad;
  const availableWidth = Math.max(80, visibleRight - visibleLeft);
  const availableHeight = Math.max(80, visibleBottom - visibleTop);

  const lines = textLines(text);
  const flat = lines.flat();
  let drawn = 0;

  const rowCount = Math.max(4, Math.ceil(count / 20), Math.floor(Math.sqrt(count) * 1.15));
  const rowGap = availableHeight / rowCount;

  for (let r = 0; r < rowCount && drawn < count; r++) {
    const size = randomBetween(rng, minSize, maxSize);
    const blur = Math.pow(rng(), 1.2) * blurMax;
    const alpha = clamp(1 - blur / Math.max(1, blurMax + 3), 0.12, 1);
    const y = visibleTop + rowGap * (r + 0.5) + randomBetween(rng, -rowGap * 0.14, rowGap * 0.14);
    const charGap = size * randomBetween(rng, 0.9, 1.2);
    const desiredLetters = Math.max(4, Math.floor(randomBetween(rng, 6, 22)));
    const maxVisibleLetters = Math.max(1, Math.floor((availableWidth - size) / charGap) + 1);
    const rowLetters = Math.min(desiredLetters, maxVisibleLetters, count - drawn);
    const rowWidth = (rowLetters - 1) * charGap;
    const centerJitter = randomBetween(rng, -1, 1) * availableWidth * 0.08;
    const centeredStart = centerX - rowWidth / 2 + centerJitter;
    const xStart = clamp(centeredStart, visibleLeft, Math.max(visibleLeft, visibleRight - rowWidth));
    const slightAngle = randomBetween(rng, -0.035, 0.035);
    const depthScale = randomBetween(rng, 0.78, 1.08);

    for (let i = 0; i < rowLetters && drawn < count; i++) {
      const x = xStart + i * charGap;
      const fade = i < 2 ? 0.68 + i * 0.16 : 1;
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

  const gradient = ctx.createLinearGradient(0, height * 0.58, 0, height);
  gradient.addColorStop(0, 'rgba(0,0,0,0)');
  gradient.addColorStop(1, 'rgba(0,0,0,0.3)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
}
