import type { EffectMode, EffectParams } from '@/types/layout';
import type { RenderContext } from './effects/shared';
import { drawRain } from './effects/rain';
import { drawBarrage } from './effects/barrage';
import { drawTearBlur } from './effects/tearBlur';
import { drawImageFill } from './effects/imageFill';

export interface RenderOptions {
  mode: EffectMode;
  text: string;
  params: EffectParams;
  /** imageFill 模式使用的已加载图片 */
  image?: HTMLImageElement | null;
  /** 整体缩放：预览传 1，导出高清传 >1 */
  scale?: number;
  /** 字体粗细 */
  fontWeight?: string;
}

/**
 * 排版渲染调度：把目标 canvas 清成背景色，按 mode 分派到对应特效算法。
 * 所有特效共用 RenderContext，尺寸基于 1080*810 * scale。
 */
export function renderLayout(canvas: HTMLCanvasElement, options: RenderOptions): void {
  const { mode, text, params, image = null, scale = 1, fontWeight = '400' } = options;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const width = canvas.width;
  const height = canvas.height;

  // 背景
  ctx.save();
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = params.bgColor;
  ctx.fillRect(0, 0, width, height);
  ctx.restore();

  const rc: RenderContext = { ctx, width, height, fontWeight, scale };

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
    case 'imageFill':
      drawImageFill(rc, text, params, image);
      break;
  }
}
