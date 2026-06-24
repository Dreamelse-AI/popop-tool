import type { EffectParams } from '@/types/layout';
import {
  clamp,
  drawHairline,
  drawLine,
  fitTextBlock,
  measureLine,
  paragraphs,
  wrapByWidth,
  type RenderContext,
} from './shared';
import { KICKER_TRACKING_EM, MONO_STACK, weightForSize } from '../typography';

/**
 * 竖向分条式（借鉴 guizang M14/S10 的纯文字版面，非代码拷贝）。
 * 顶部 kicker + 标题 → 若干条「序号 + 短句」逐行，条间发丝线。
 * 文案约定：首段为标题，其余每段为一条。
 *
 * 硬约束：标题与条目字号都按可用区域 + 字数自动计算，四周留安全边距，绝不溢出。
 */
export function drawVerticalList(rc: RenderContext, text: string, params: EffectParams): void {
  const { ctx, width, height, scale } = rc;
  const pad = params.padding * scale;

  const segs = paragraphs(text);
  const title = segs.length > 1 ? segs[0] : '';
  const items = segs.length > 1 ? segs.slice(1) : segs;

  const maxWidth = width - pad * 2;
  let y = pad;

  // 顶部 kicker
  const kickerSize = 21 * scale;
  drawLine(
    ctx,
    `LIST · ${items.length} 条`,
    pad,
    y + kickerSize,
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
  y += kickerSize * 2.2;

  // 标题：限制最多占可用高度的 30%，字号自适应（最多 2 行）
  if (title) {
    const titleAreaH = (height - pad - y) * 0.3;
    const titleMax = clamp(params.titleSize, 40, 96) * scale;
    const tFit = fitTextBlock(
      ctx,
      [title],
      maxWidth,
      titleAreaH,
      rc.fontFamily,
      (s) => weightForSize(s / scale, rc.fontKind),
      { lineHeightRatio: 1.18, min: 28 * scale, max: titleMax, letterRatio: 0.06 },
    );
    const tStyle = {
      size: tFit.size,
      weight: weightForSize(tFit.size / scale, rc.fontKind),
      family: rc.fontFamily,
      color: rc.fontColor,
      letterSpacing: tFit.size * 0.06,
    };
    for (const line of tFit.lines) {
      drawLine(ctx, line, pad, y + tFit.lineHeight / 2, tStyle, 'left');
      y += tFit.lineHeight;
    }
    y += tFit.size * 0.4;
  }

  // 条目区：纵向均分剩余空间
  const listTop = y;
  const listBottom = height - pad;
  const available = Math.max(60 * scale, listBottom - listTop);
  const rowGap = available / Math.max(1, items.length);

  // 条目字号：受行高约束（不超过行内可用高度），并保证不低于可读下限
  const itemSize = clamp(rowGap * 0.36, 22 * scale, 40 * scale);
  const numSize = clamp(itemSize * 0.9, 20 * scale, 36 * scale);
  const itemWeight = weightForSize(itemSize / scale, rc.fontKind);
  const indent = pad + numSize * 2.6;
  const itemMaxWidth = width - indent - pad;

  items.forEach((item, i) => {
    const rowY = listTop + i * rowGap;
    drawHairline(ctx, pad, rowY, maxWidth, rc.accent, Math.max(1, scale));
    const cy = rowY + rowGap / 2;
    // 序号（mono、强调色）
    drawLine(
      ctx,
      String(i + 1).padStart(2, '0'),
      pad,
      cy,
      {
        size: numSize,
        weight: 600,
        family: MONO_STACK,
        color: rc.accent,
        letterSpacing: numSize * 0.05,
      },
      'left',
    );
    // 条目正文：截断到单行宽度（自动换行取第一行，加省略提示）
    const itemStyle = {
      size: itemSize,
      weight: itemWeight,
      family: rc.fontFamily,
      color: rc.fontColor,
      letterSpacing: itemSize * 0.02,
    };
    const wrapped = wrapByWidth(
      (s) => measureLine(ctx, s, itemStyle),
      item,
      itemMaxWidth,
    );
    const shown = wrapped.length > 1 ? `${wrapped[0]}…` : wrapped[0];
    drawLine(ctx, shown, indent, cy, itemStyle, 'left');
  });
}
