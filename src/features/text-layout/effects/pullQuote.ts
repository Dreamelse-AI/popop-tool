import type { EffectParams } from '@/types/layout';
import {
  clamp,
  drawHairline,
  drawLine,
  fitTextBlock,
  paragraphs,
  type RenderContext,
} from './shared';
import { KICKER_TRACKING_EM, MONO_STACK, weightForSize } from '../typography';

/**
 * 拉引文式（借鉴 guizang M04 Pull Quote 的纯文字版面，非代码拷贝）。
 * 超大居中引文 + 上方安静 kicker + 下方发丝线与来源行。克制、有章法。
 * 文案约定：首段为引文主体，第二段（若有）为来源/出处。
 *
 * 硬约束：引文字号按可用区域 + 字数自动计算，四周留安全边距，绝不溢出画布。
 */
export function drawPullQuote(rc: RenderContext, text: string, params: EffectParams): void {
  const { ctx, width, height, scale } = rc;
  const pad = params.padding * scale;

  const segs = paragraphs(text);
  const quoteText = segs[0];
  const sourceText = segs[1] ?? '';

  const maxWidth = width - pad * 2;
  const kickerSize = 22 * scale;
  const srcSize = 20 * scale;

  // 预留顶部 kicker、底部来源行（发丝线 + 文字）
  const topReserve = kickerSize * 2.6;
  const bottomReserve = srcSize * 3.2;
  const areaTop = pad + topReserve;
  const areaBottom = height - pad - bottomReserve;
  const areaH = Math.max(60 * scale, areaBottom - areaTop);

  const quoteMax = clamp(params.titleSize, 44, 120) * scale;
  const fit = fitTextBlock(
    ctx,
    [quoteText],
    maxWidth,
    areaH,
    rc.fontFamily,
    (s) => weightForSize(s / scale, rc.fontKind),
    { lineHeightRatio: 1.22, min: 28 * scale, max: quoteMax, letterRatio: 0.04 },
  );

  // 顶部 kicker
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

  // 居中引文块（在引文区内纵向居中）
  const quoteStyle = {
    size: fit.size,
    weight: weightForSize(fit.size / scale, rc.fontKind),
    family: rc.fontFamily,
    color: rc.fontColor,
    letterSpacing: fit.size * 0.04,
  };
  let y = areaTop + (areaH - fit.blockHeight) / 2;
  for (const line of fit.lines) {
    drawLine(ctx, line, width / 2, y + fit.lineHeight / 2, quoteStyle, 'center');
    y += fit.lineHeight;
  }

  // 底部来源行（发丝线 + mono）
  const srcY = height - pad - srcSize;
  drawHairline(
    ctx,
    width / 2 - maxWidth * 0.18,
    srcY - srcSize * 1.3,
    maxWidth * 0.36,
    rc.accent,
    Math.max(1, scale),
  );
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
