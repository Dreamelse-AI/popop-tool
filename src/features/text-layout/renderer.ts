import type { EffectMode, EffectParams, RenderStyle } from '@/types/layout';
import type { RenderContext } from './effects/shared';
import { fillCanvasBackground } from './colorUtils';
import { drawRain } from './effects/rain';
import { drawBarrage } from './effects/barrage';
import { drawTearBlur } from './effects/tearBlur';
import { drawMagazineCover } from './effects/magazineCover';
import { drawPullQuote } from './effects/pullQuote';
import { drawVerticalList } from './effects/verticalList';

export interface RenderOptions {
  mode: EffectMode;
  text: string;
  params: EffectParams;
  /** 渲染风格：字体/配色/背景图 */
  style: RenderStyle;
  /** 背景图（来自图片库，已加载） */
  bgImage?: HTMLImageElement | null;
  /** 整体缩放：预览传 1，导出高清传 >1 */
  scale?: number;
  /** 字体粗细 */
  fontWeight?: string;
}

/** 以 cover 方式把图片铺满画布。 */
function drawCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  width: number,
  height: number,
): void {
  const scale = Math.max(width / img.width, height / img.height);
  const w = img.width * scale;
  const h = img.height * scale;
  ctx.drawImage(img, (width - w) / 2, (height - h) / 2, w, h);
}

/**
 * 排版渲染调度：先铺背景（配色或背景图 + 遮罩），再按 mode 分派到对应特效算法。
 * 所有特效共用 RenderContext，尺寸基于 1080*810 * scale。
 */
export function renderLayout(canvas: HTMLCanvasElement, options: RenderOptions): void {
  const {
    mode,
    text,
    params,
    style,
    bgImage = null,
    scale = 1,
    fontWeight = '400',
  } = options;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const width = canvas.width;
  const height = canvas.height;

  // 背景：底色（纯色/渐变）→（可选）背景图 →（可选）遮罩
  ctx.save();
  ctx.clearRect(0, 0, width, height);
  fillCanvasBackground(ctx, style.bgColor, width, height);
  if (style.bgImageUrl && bgImage) {
    drawCover(ctx, bgImage, width, height);
    if (style.overlay) {
      ctx.fillStyle = style.overlay;
      ctx.fillRect(0, 0, width, height);
    }
  }
  ctx.restore();

  const rc: RenderContext = {
    ctx,
    width,
    height,
    fontFamily: style.fontFamily,
    fontKind: style.fontKind,
    fontColor: style.fontColor,
    accent: style.accent,
    fontWeight,
    scale,
  };

  switch (mode) {
    case 'rain':
      drawRain(rc, text, params);
      break;
    case 'barrage':
      drawBarrage(rc, text, params);
      break;
    case 'tearBlur':
      drawTearBlur(rc, text, params);
      break;
    case 'magazineCover':
      drawMagazineCover(rc, text, params);
      break;
    case 'pullQuote':
      drawPullQuote(rc, text, params);
      break;
    case 'verticalList':
      drawVerticalList(rc, text, params);
      break;
  }
}
