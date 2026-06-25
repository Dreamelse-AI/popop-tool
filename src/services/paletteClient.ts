/**
 * 情绪配色库 API 客户端。
 *
 * 走同源 /api/palette（dev 由 vite 中间件、生产由 Express 提供），
 * 统一信封 { code, msg, data }，code=0 成功。
 */

import type {
  PaletteEntry,
  PaletteListResult,
  SavePaletteInput,
} from '@/types/palette';

const BASE = '/api/palette';

export class PaletteApiError extends Error {}

interface Envelope<T> {
  code: number;
  msg: string;
  data: T;
}

async function parseEnvelope<T>(res: Response): Promise<T> {
  if (!res.ok && res.status >= 500) {
    throw new PaletteApiError(`请求失败（${res.status}）`);
  }
  let json: Envelope<T>;
  try {
    json = (await res.json()) as Envelope<T>;
  } catch {
    throw new PaletteApiError('响应解析失败');
  }
  if (json.code !== 0) {
    throw new PaletteApiError(json.msg || `业务错误（code=${json.code}）`);
  }
  return json.data;
}

/** 列出全部配色（服务端已按创建时间倒序）。 */
export async function listPalettes(): Promise<PaletteListResult> {
  let res: Response;
  try {
    res = await fetch(`${BASE}/list`);
  } catch {
    throw new PaletteApiError('网络请求失败，请检查连接后重试');
  }
  return parseEnvelope<PaletteListResult>(res);
}

/** 保存一条配色（含 base64 原图）。 */
export async function savePalette(input: SavePaletteInput): Promise<PaletteEntry> {
  let res: Response;
  try {
    res = await fetch(`${BASE}/save`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
  } catch {
    throw new PaletteApiError('网络请求失败，请检查连接后重试');
  }
  return parseEnvelope<PaletteEntry>(res);
}

/** 删除一条配色（含原图文件）。 */
export async function deletePalette(id: string): Promise<void> {
  let res: Response;
  try {
    res = await fetch(`${BASE}/${encodeURIComponent(id)}`, { method: 'DELETE' });
  } catch {
    throw new PaletteApiError('网络请求失败，请检查连接后重试');
  }
  await parseEnvelope<null>(res);
}
