import type { EffectParams } from '@/types/layout';
import {
  clamp,
  drawHairline,
  drawLine,
  measureLine,
  paragraphs,
  wrapByWidth,
  type RenderContext,
} from './shared';
import { KICKER_TRACKING_EM, MONO_STACK, weightForSize } from '../typography';

/**
 * 拉引文式（借鉴 guizang M04 Pull Quote 的纯文字版面，非代码拷贝）。
 * 超大居中引文 + 上方安静 kicker + 下方发丝线与来源行。克制、有章法。
 * 文案约定：首段为引文主体，第二段（若有）为来源/出处。
 */
export function drawPullQuote(rc: RenderContext, text: string, params: EffectParams): void {
  const { ctx, width, height, scale } = rc;
  const pad = params.padding * scale;

  const segs = paragraphs(text);
  const quoteText = segs[0];
  const sourceText = segs[1] ?? '';

  const maxWidth = width - pad * 2;
  const quoteSize = clamp(params.titleSize, 44, 120) * scale;
  const quoteWeight = weightForSize(quoteSize / scale, rc.fontKind);
  const quoteStyle = {
    size: quoteSize,
    weight: quoteWeight,
    family: rc.fontFamily,
    color: rc.fontColor,
    letterSpacing: quoteSize * 0.04,
  };
  const lines = wrapByWidth((s) => measureLine(ctx, s, quoteStyle), quoteText, maxWidth);

  // 顶部 kicker
  const kickerSize = 22 * scale;
  drawLine(
    ctx,
    'QUOTE · 留给你的',
    width / 2,
    pad + kickerSize,
    {
      size: kickerSize,
      weight: 500,
      family: MONO_STACK,
      color: rc.accent,
      letterSpacing: kickerSize * KICKER_TRACKING_EM,
      uppercase: true,
    },
    'center',
  );

  // 居中引文块
  const lineH = quoteSize * 1.22;
  const blockH = lines.length * lineH;
  let y = height / 2 - blockH / 2;
  for (const line of lines) {
    drawLine(ctx, line, width / 2, y + lineH / 2, quoteStyle, 'center');
    y += lineH;
  }

  // 底部来源行（发丝线 + mono）
  const srcSize = 20 * scale;
  const srcY = height - pad - srcSize;
  drawHairline(ctx, width / 2 - maxWidth * 0.18, srcY - srcSize * 1.3, maxWidth * 0.36, rc.accent, Math.max(1, scale));
  if (sourceText) {
    drawLine(
      ctx,
      sourceText,
      width / 2,
      srcY,
      {
        size: srcSize,
        weight: 500,
        family: MONO_STACK,
        color: rc.fontColor,
        letterSpacing: srcSize * 0.16,
        alpha: 0.82,
        uppercase: true,
      },
      'center',
    );
  }
}
