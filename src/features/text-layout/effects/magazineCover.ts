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
 * 顶部 kicker 元信息行 → 中部大标题（衬线、越大越细、宽字距）→ 底部发丝线 + issue 条。
 * 文案约定：首段为标题，其余段拼成底部 issue 条。
 *
 * 硬约束：标题字号按可用区域 + 字数自动计算，四周留安全边距，绝不溢出画布。
 */
export function drawMagazineCover(rc: RenderContext, text: string, params: EffectParams): void {
  const { ctx, width, height, scale } = rc;
  const pad = params.padding * scale;

  const segs = paragraphs(text);
  const titleText = segs[0];
  const stripText = segs.slice(1).join('  ·  ');

  const maxWidth = width - pad * 2;
  const kickerSize = 22 * scale;
  const stripSize = 19 * scale;

  // 预留：顶部 kicker 带（kicker + 间隙），底部 issue 条带（仅在有内容时）
  const topReserve = kickerSize * 2.6;
  const bottomReserve = stripText ? stripSize * 3 : pad * 0.5;
  const titleAreaTop = pad + topReserve;
  const titleAreaBottom = height - pad - bottomReserve;
  const titleAreaH = Math.max(60 * scale, titleAreaBottom - titleAreaTop);

  // 标题字号自适应：上限取参数（随机区间），下限保证可读
  const titleMax = clamp(params.titleSize, 48, 132) * scale;
  const fit = fitTextBlock(
    ctx,
    [titleText],
    maxWidth,
    titleAreaH,
    rc.fontFamily,
    (s) => weightForSize(s / scale, rc.fontKind),
    { lineHeightRatio: 1.16, min: 28 * scale, max: titleMax, letterRatio: 0.1 },
  );

  // 顶部 kicker（mono、强调色、大写、宽字距）
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

  // 中部标题块（左对齐，在标题区内纵向居中）
  const titleStyle = {
    size: fit.size,
    weight: weightForSize(fit.size / scale, rc.fontKind),
    family: rc.fontFamily,
    color: rc.fontColor,
    letterSpacing: fit.size * 0.1,
  };
  let y = titleAreaTop + (titleAreaH - fit.blockHeight) / 2;
  for (const line of fit.lines) {
    drawLine(ctx, line, pad, y + fit.lineHeight / 2, titleStyle, 'left');
    y += fit.lineHeight;
  }

  // 底部发丝线 + issue 条
  if (stripText) {
    const stripY = height - pad - stripSize;
    drawHairline(ctx, pad, stripY - stripSize * 1.1, maxWidth, rc.accent, Math.max(1, scale));
    drawLine(
      ctx,
      stripText,
      pad,
      stripY,
      {
        size: stripSize,
        weight: 500,
        family: MONO_STACK,
        color: rc.fontColor,
        letterSpacing: stripSize * 0.18,
        alpha: 0.85,
        uppercase: true,
      },
      'left',
    );
  }
}
