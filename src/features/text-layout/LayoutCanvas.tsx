import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import type { EffectMode, EffectParams } from '@/types/layout';
import { CANVAS_HEIGHT, CANVAS_WIDTH } from '@/types/layout';
import { renderLayout } from './renderer';

interface LayoutCanvasProps {
  mode: EffectMode;
  text: string;
  params: EffectParams;
  image?: HTMLImageElement | null;
  fontWeight?: string;
  /** CSS 显示宽度（高度按 4:3 自动）。内部像素始终 1080×810。 */
  displayWidth: number;
}

export interface LayoutCanvasHandle {
  /** 导出高清 PNG dataURL（scale 倍像素）。 */
  exportPng: (scale?: number) => string | null;
}

/**
 * 4:3 文字排版画布（Canvas 2D）。
 * 内部固定 1080×810 像素，通过 CSS 缩放显示；导出时按需放大重绘。
 */
export const LayoutCanvas = forwardRef<LayoutCanvasHandle, LayoutCanvasProps>(
  ({ mode, text, params, image = null, fontWeight = '400', displayWidth }, ref) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      canvas.width = CANVAS_WIDTH;
      canvas.height = CANVAS_HEIGHT;
      renderLayout(canvas, { mode, text, params, image, scale: 1, fontWeight });
    }, [mode, text, params, image, fontWeight]);

    useImperativeHandle(
      ref,
      () => ({
        exportPng: (scale = 2) => {
          // 用离屏画布按 scale 倍重绘，保证导出清晰
          const out = document.createElement('canvas');
          out.width = CANVAS_WIDTH * scale;
          out.height = CANVAS_HEIGHT * scale;
          renderLayout(out, { mode, text, params, image, scale, fontWeight });
          return out.toDataURL('image/png');
        },
      }),
      [mode, text, params, image, fontWeight],
    );

    return (
      <canvas
        ref={canvasRef}
        style={{
          width: displayWidth,
          height: (displayWidth * CANVAS_HEIGHT) / CANVAS_WIDTH,
          display: 'block',
        }}
      />
    );
  },
);

LayoutCanvas.displayName = 'LayoutCanvas';
