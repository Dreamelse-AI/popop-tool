/**
 * 九宫格切图：把一张 3×3 表情大图切成 9 张方图（纯前端 Canvas，零额外调用）。
 *
 * 输入是一张可能跨域的图片直链（apimart 临时直链）。为了能在 Canvas 上读取像素并切割，
 * 先 fetch 成 blob 再走 createImageBitmap，避免跨域污染画布（taint）导致 toDataURL 报错。
 */

import { STICKER_GRID } from '@/types/sticker';

/** 把图片直链加载成 ImageBitmap（先 fetch blob，规避 canvas 跨域污染）。 */
async function loadBitmap(src: string, signal?: AbortSignal): Promise<ImageBitmap> {
  const res = await fetch(src, { signal });
  if (!res.ok) throw new Error(`加载大图失败（${res.status}）`);
  const blob = await res.blob();
  return createImageBitmap(blob);
}

/**
 * 把九宫格大图切成 9 张方图，按行优先（左→右、上→下）返回 data URL 数组。
 * @param src 九宫格大图直链
 * @param signal 可选取消信号
 * @returns 9 个 PNG data URL
 */
export async function sliceGrid(src: string, signal?: AbortSignal): Promise<string[]> {
  const bitmap = await loadBitmap(src, signal);
  try {
    // 以图片实际尺寸均分；非整除时用 floor，丢弃边缘 1~2px，避免越界
    const cellW = Math.floor(bitmap.width / STICKER_GRID);
    const cellH = Math.floor(bitmap.height / STICKER_GRID);
    if (cellW <= 0 || cellH <= 0) throw new Error('大图尺寸异常，无法切分');

    const canvas = document.createElement('canvas');
    canvas.width = cellW;
    canvas.height = cellH;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('无法创建画布上下文');

    const out: string[] = [];
    for (let row = 0; row < STICKER_GRID; row++) {
      for (let col = 0; col < STICKER_GRID; col++) {
        ctx.clearRect(0, 0, cellW, cellH);
        ctx.drawImage(
          bitmap,
          col * cellW,
          row * cellH,
          cellW,
          cellH,
          0,
          0,
          cellW,
          cellH,
        );
        out.push(canvas.toDataURL('image/png'));
      }
    }
    return out;
  } finally {
    bitmap.close();
  }
}
