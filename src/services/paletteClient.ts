/**
 * 情绪配色库客户端。
 *
 * 存储分两层，便于后端表单接口就绪后无缝替换：
 *   1. 图片 → OSS：POST /api/palette/upload { data_url } → { url }（公开、永久）。
 *   2. 表单元数据 → 过渡存储：当前用 localStorage（metaStore）；后端给出独立
 *      「存表单」接口后，仅替换 metaStore 的实现即可，调用方与图片链路不变。
 *
 * 注意（过渡期已知代价）：localStorage 按浏览器存，换设备/清缓存会丢元数据；
 * 但图片已永久在 OSS，迁到后端接口后历史可重新登记。
 */

import type {
  PaletteEntry,
  PaletteListResult,
  SavePaletteInput,
} from '@/types/palette';

const BASE = '/api/palette';
/** 元数据过渡存储 key（仅本浏览器）。 */
const META_KEY = 'popop-palette-entries';

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

/**
 * 上传图片到 OSS，返回公开 url。
 * @param dataUrl 图片 base64 data URL
 */
export async function uploadPaletteImage(dataUrl: string): Promise<string> {
  let res: Response;
  try {
    res = await fetch(`${BASE}/upload`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data_url: dataUrl }),
    });
  } catch {
    throw new PaletteApiError('图片上传失败，请检查连接后重试');
  }
  const data = await parseEnvelope<{ url: string; object_key: string }>(res);
  if (!data.url) throw new PaletteApiError('图片上传未返回地址');
  return data.url;
}

// ==================== 元数据过渡存储（localStorage） ====================
// 后端「存表单」接口就绪后，把以下三个函数体替换为接口调用即可。

function readMeta(): PaletteEntry[] {
  try {
    const raw = localStorage.getItem(META_KEY);
    const list = raw ? (JSON.parse(raw) as PaletteEntry[]) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function writeMeta(list: PaletteEntry[]): void {
  try {
    localStorage.setItem(META_KEY, JSON.stringify(list));
  } catch {
    // 配额满等忽略，不阻断主流程
  }
}

/** 列出全部配色（按创建时间倒序）。 */
export async function listPalettes(): Promise<PaletteListResult> {
  const items = readMeta().sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  return { items, total: items.length };
}

/**
 * 保存一条配色：图片已在调用前上传好（imageUrl 为 OSS 公开地址），
 * 这里只把元数据落过渡存储。
 */
export async function savePalette(input: SavePaletteInput): Promise<PaletteEntry> {
  const list = readMeta();
  if (list.some((e) => e.id === input.id)) {
    throw new PaletteApiError(`id「${input.id}」已存在，请换一个`);
  }
  const entry: PaletteEntry = {
    id: input.id,
    schemes: input.schemes,
    colors: input.colors,
    imageUrl: input.imageUrl,
    createdAt: new Date().toISOString(),
  };
  writeMeta([entry, ...list]);
  return entry;
}

/** 删除一条配色（仅删元数据；OSS 图片对象由后端最终方案统一清理）。 */
export async function deletePalette(id: string): Promise<void> {
  writeMeta(readMeta().filter((e) => e.id !== id));
}
