import { toPng } from 'html-to-image';
import { CANVAS_HEIGHT, CANVAS_WIDTH } from '@/types/layout';

/**
 * 把画布 DOM 导出为 PNG 并触发下载。
 * 始终以 1080*1440 原始像素导出（忽略预览缩放）。
 */
export async function exportCanvasToPng(node: HTMLElement, fileName = 'layout.png'): Promise<void> {
  const dataUrl = await toPng(node, {
    width: CANVAS_WIDTH,
    height: CANVAS_HEIGHT,
    pixelRatio: 1,
    // 导出时抵消预览缩放，确保输出为原始尺寸
    style: { transform: 'scale(1)', transformOrigin: 'top left' },
    cacheBust: true,
  });

  const link = document.createElement('a');
  link.download = fileName;
  link.href = dataUrl;
  link.click();
}
