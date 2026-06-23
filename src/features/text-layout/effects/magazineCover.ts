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
 * 杂志封面式（借鉴 guizang M01/M16 的纯文字版面，非代码拷贝）。
 * 顶部 kicker 元信息行 → 中部大标题（衬线、越大越细、宽字距）→ 底部发丝线 + issue 条。
 * 文案约定：首段为标题，其余段拼成底部 issue 条。
 */
export function drawMagazineCover(rc: RenderContext, text: string, params: EffectParams): void {
  const { ctx, width, height, scale } = rc;
  const pad = params.padding * scale;

  const segs = paragraphs(text);
  const titleText = segs[0];
  const stripText = segs.slice(1).join('  ·  ');

  const maxWidth = width - pad * 2;
  const titleSize = clamp(params.titleSize, 48, 132) * scale;
  const titleWeight = weightForSize(titleSize / scale, rc.fontKind);
  const titleStyle = {
    size: titleSize,
    weight: titleWeight,
    family: rc.fontFamily,
    color: rc.fontColor,
    letterSpacing: titleSize * 0.1,
  };
  const titleLines = wrapByWidth(
    (s) => measureLine(ctx, s, titleStyle),
    titleText,
    maxWidth,
  );

  // 顶部 kicker（mono、强调色、大写、宽字距）
  const kickerSize = 22 * scale;
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

  // 中部标题块（左对齐，纵向居中偏上）
  const lineH = titleSize * 1.16;
  const blockH = titleLines.length * lineH;
  let y = clamp(height * 0.46 - blockH / 2, pad + kickerSize * 3, height - pad - blockH);
  for (const line of titleLines) {
    drawLine(ctx, line, pad, y + lineH / 2, titleStyle, 'left');
    y += lineH;
  }

  // 底部发丝线 + issue 条（mono、宽字距）
  if (stripText) {
    const stripSize = 19 * scale;
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
