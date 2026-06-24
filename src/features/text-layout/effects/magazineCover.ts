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
 * 杂志封面式（借鉴 guizang M01/M16 的纯文字版面，非代码拷贝）。
 * 顶部 kicker 元信息行 → 中部正文（衬线、越大越细、宽字距，完整显示全部内容）→ 底部发丝线装饰。
 *
 * 硬约束：正文字号按可用区域 + 字数自动计算，四周留安全边距，绝不溢出画布。
 * 全部输入内容都作为正文显示，按段落保留分段。
 */
export function drawMagazineCover(rc: RenderContext, text: string, params: EffectParams): void {
  const { ctx, width, height, scale } = rc;
  const pad = params.padding * scale;

  // 整段输入都作为正文（按段落分段），不再把内容拆到别处
  const segs = paragraphs(text);

  const maxWidth = width - pad * 2;
  const kickerSize = 22 * scale;

  // 预留：顶部 kicker 带 + 底部发丝线装饰带
  const topReserve = kickerSize * 2.6;
  const bottomReserve = kickerSize * 1.6;
  const bodyAreaTop = pad + topReserve;
  const bodyAreaBottom = height - pad - bottomReserve;
  const bodyAreaH = Math.max(60 * scale, bodyAreaBottom - bodyAreaTop);

  // 正文字号自适应：上限取参数（随机区间），下限保证可读
  const titleMax = clamp(params.titleSize, 48, 132) * scale;
  const fit = fitTextBlock(
    ctx,
    segs,
    maxWidth,
    bodyAreaH,
    rc.fontFamily,
    (s) => weightForSize(s / scale, rc.fontKind),
    { lineHeightRatio: 1.18, min: 28 * scale, max: titleMax, letterRatio: 0.08 },
  );

  // 顶部 kicker（mono、强调色、大写、宽字距）—— 固定装饰，不占内容
  drawLine(
    ctx,
    'EDITORIAL · 2026',
    pad,
    pad + kickerSize,
    {
      size: kickerSize,
      weight: 500,
      family: MONO_STACK,
      color: rc.accent,
      letterSpacing: kickerSize * KICKER_TRACKING_EM,
      uppercase: true,
    },
    'left',
  );

  // 中部正文块（左对齐，在正文区内纵向居中）
  const bodyStyle = {
    size: fit.size,
    weight: weightForSize(fit.size / scale, rc.fontKind),
    family: rc.fontFamily,
    color: rc.fontColor,
    letterSpacing: fit.size * 0.08,
  };
  let y = bodyAreaTop + (bodyAreaH - fit.blockHeight) / 2;
  for (const line of fit.lines) {
    drawLine(ctx, line, pad, y + fit.lineHeight / 2, bodyStyle, 'left');
    y += fit.lineHeight;
  }

  // 底部发丝线装饰（固定，不占内容）
  drawHairline(ctx, pad, height - pad - kickerSize * 0.6, maxWidth * 0.4, rc.accent, Math.max(1, scale));
}
