/**
 * 九宫格切图：把一张 3×3 表情大图切成 9 张方图（纯前端 Canvas，零额外调用）。
 *
 * 输入是一张可能跨域的图片直链（apimart 临时直链）。为了能在 Canvas 上读取像素并切割，
 * 先 fetch 成 blob 再走 createImageBitmap，避免跨域污染画布（taint）导致 toDataURL 报错。
 */

import { STICKER_GRID } from '@/types/sticker';

/**
 * 把可能跨域的图片直链包成同源代理 URL，规避 CORS（apimart 出图直链所在 host 无 CORS 头，
 * 前端直接 fetch 读像素会被拦截）。data:/blob: 与同源 URL 原样返回。
 */
export function toProxiedUrl(src: string): string {
  if (src.startsWith('data:') || src.startsWith('blob:')) return src;
  if (src.startsWith('/')) return src; // 已是同源相对路径
  return `/api/img-proxy?url=${encodeURIComponent(src)}`;
}

/**
 * 把跨域大图取到本地，返回 { bitmap, objectUrl }。
 * objectUrl 是同源 blob: 地址，可直接喂 <img src> 秒开（避免再次走远程下载）。
 * 调用方用完 objectUrl 后应在合适时机 URL.revokeObjectURL 释放。
 */
async function loadBitmapWithBlobUrl(
  src: string,
  signal?: AbortSignal,
): Promise<{ bitmap: ImageBitmap; objectUrl: string }> {
  const res = await fetch(toProxiedUrl(src), { signal });
  if (!res.ok) throw new Error(`加载大图失败（${res.status}）`);
  const blob = await res.blob();
  const bitmap = await createImageBitmap(blob);
  return { bitmap, objectUrl: URL.createObjectURL(blob) };
}

/** sliceGrid 结果：9 张切图 + 大图的本地 blob URL（供 Lightbox 秒开复用）。 */
export interface SliceResult {
  cells: string[];
  /** 大图的同源 blob: 地址，用完需 revoke */
  gridObjectUrl: string;
}

/**
 * 把九宫格大图切成 9 张 1:1 正方形表情，按行优先（左→右、上→下）。
 *
 * 几何：大图按 3×3 等分成 9 个格子（格子比例继承大图，通常是竖条），
 * 再从每个格子里居中裁出边长 = min(格子宽, 格子高) 的正方形，保证单表情统一 1:1。
 *
 * 同时把大图取成本地 blob URL 一并返回，避免 Lightbox 再次从远程下载 2K 大图。
 *
 * @param src 九宫格大图直链
 * @param signal 可选取消信号
 */
export async function sliceGrid(src: string, signal?: AbortSignal): Promise<SliceResult> {
  const { bitmap, objectUrl } = await loadBitmapWithBlobUrl(src, signal);
  try {
    // 以图片实际尺寸均分；非整除时用 floor，丢弃边缘 1~2px，避免越界
    const cellW = Math.floor(bitmap.width / STICKER_GRID);
    const cellH = Math.floor(bitmap.height / STICKER_GRID);
    if (cellW <= 0 || cellH <= 0) throw new Error('大图尺寸异常，无法切分');

    // 单表情统一裁成 1:1：边长取格子短边，在格子内居中裁
    const side = Math.min(cellW, cellH);
    const offsetX = Math.floor((cellW - side) / 2);
    const offsetY = Math.floor((cellH - side) / 2);

    const canvas = document.createElement('canvas');
    canvas.width = side;
    canvas.height = side;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('无法创建画布上下文');

    const out: string[] = [];
    for (let row = 0; row < STICKER_GRID; row++) {
      for (let col = 0; col < STICKER_GRID; col++) {
        ctx.clearRect(0, 0, side, side);
        ctx.drawImage(
          bitmap,
          col * cellW + offsetX,
          row * cellH + offsetY,
          side,
          side,
          0,
          0,
          side,
          side,
        );
        out.push(canvas.toDataURL('image/png'));
      }
    }
    return { cells: out, gridObjectUrl: objectUrl };
  } finally {
    bitmap.close();
  }
}
