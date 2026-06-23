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
 * 上方安静 kicker → 中部居中引文（完整显示全部内容）→ 下方发丝线装饰。
 *
 * 硬约束：引文字号按可用区域 + 字数自动计算，四周留安全边距，绝不溢出画布。
 * 全部输入内容都作为引文显示，按段落保留分段。
 */
export function drawPullQuote(rc: RenderContext, text: string, params: EffectParams): void {
  const { ctx, width, height, scale } = rc;
  const pad = params.padding * scale;

  // 整段输入都作为引文（按段落分段），不再把内容拆到来源行
  const segs = paragraphs(text);

  const maxWidth = width - pad * 2;
  const kickerSize = 22 * scale;

  // 预留顶部 kicker、底部发丝线装饰带
  const topReserve = kickerSize * 2.6;
  const bottomReserve = kickerSize * 1.8;
  const areaTop = pad + topReserve;
  const areaBottom = height - pad - bottomReserve;
  const areaH = Math.max(60 * scale, areaBottom - areaTop);

  const quoteMax = clamp(params.titleSize, 44, 120) * scale;
  const fit = fitTextBlock(
    ctx,
    segs,
    maxWidth,
    areaH,
    rc.fontFamily,
    (s) => weightForSize(s / scale, rc.fontKind),
    { lineHeightRatio: 1.24, min: 28 * scale, max: quoteMax, letterRatio: 0.04 },
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

  // 底部发丝线装饰（固定，不占内容）
  drawHairline(
    ctx,
    width / 2 - maxWidth * 0.18,
    height - pad - kickerSize * 0.8,
    maxWidth * 0.36,
    rc.accent,
    Math.max(1, scale),
  );
}
