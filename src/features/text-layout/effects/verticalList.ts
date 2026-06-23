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
import { KICKER_TRACKING_EM, MIN_READABLE_BODY, MONO_STACK, weightForSize } from '../typography';

/**
 * 竖向分条式（借鉴 guizang M14/S10 的纯文字版面，非代码拷贝）。
 * 顶部标题 → 若干条「序号 + 短句」逐行，条间发丝线。比弹幕更结构化。
 * 文案约定：首段为标题，其余每段为一条；超出可容纳条数的截断。
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

  // 标题（区块标题档，越大越细）
  if (title) {
    const tSize = clamp(params.titleSize, 48, 96) * scale;
    const tStyle = {
      size: tSize,
      weight: weightForSize(tSize / scale, rc.fontKind),
      family: rc.fontFamily,
      color: rc.fontColor,
      letterSpacing: tSize * 0.06,
    };
    const tLines = wrapByWidth((s) => measureLine(ctx, s, tStyle), title, maxWidth);
    const tLineH = tSize * 1.18;
    for (const line of tLines.slice(0, 2)) {
      drawLine(ctx, line, pad, y + tLineH / 2, tStyle, 'left');
      y += tLineH;
    }
    y += tSize * 0.4;
  }

  // 条目区：纵向均分剩余空间，每条「序号 + 文字」+ 顶部发丝线
  const listTop = y;
  const listBottom = height - pad;
  const available = Math.max(80, listBottom - listTop);
  const rowGap = available / Math.max(1, items.length);

  const numSize = clamp(28 * scale, MIN_READABLE_BODY * scale, 40 * scale);
  const itemSize = clamp(rowGap * 0.34, MIN_READABLE_BODY * scale, 44 * scale);
  const itemWeight = weightForSize(itemSize / scale, rc.fontKind);

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
    // 条目正文（截断到单行宽度）
    const indent = pad + numSize * 2.4;
    const itemStyle = {
      size: itemSize,
      weight: itemWeight,
      family: rc.fontFamily,
      color: rc.fontColor,
      letterSpacing: itemSize * 0.02,
    };
    const oneLine = wrapByWidth((s) => measureLine(ctx, s, itemStyle), item, width - indent - pad)[0];
    drawLine(ctx, oneLine, indent, cy, itemStyle, 'left');
  });
}
