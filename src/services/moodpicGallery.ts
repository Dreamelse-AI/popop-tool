/**
 * MoodPic 图库服务：列表 / 批量删除 / 保存。
 *
 * 与 promptExpander 同款边界：
 *   - USE_MOCK=true  → 本地内存 mock（后端接口未就绪时，前端骨架可独立跑通）
 *   - USE_MOCK=false → 调 arca 图库接口（后端定稿后实现 *ViaArca）
 *
 * 对接规范见 docs/moodpic-storage-plan.md 与 arca-integration 规范。
 * 真正接 arca 时：路径/字段对齐 arca.api（snake_case），走 arcaPost，JWT 鉴权。
 */

import type {
  MoodPicAsset,
  MoodPicListResult,
} from '@/types/moodpic';
import type { AssetConfig } from '@/types/visualAsset';
import { arcaPost } from './arcaClient';

/**
 * 接入开关：
 *   - 读链路（list / batchDelete）已接 arca 真实接口（后端豁免 JWT 后可联调）
 *   - 写链路（save）仍走本地，因线上压缩+直传 OSS 链路暂未封装（产品决定后续再做）
 */
const READ_VIA_ARCA = true;

// [LOCAL_STORE]
/**
 * 过渡期本地图库：持久化到 localStorage，刷新不丢。
 * 注意：仅本机本浏览器，不跨设备；apimart 图直链约 24h 过期，过期后图打不开。
 * 后端 arca 图库接口就绪后置 USE_MOCK=false，切真实 OSS 永久存储。
 */
const LOCAL_KEY = 'popop-moodpic-gallery';

function readLocal(): MoodPicAsset[] {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    return raw ? (JSON.parse(raw) as MoodPicAsset[]) : [];
  } catch {
    return [];
  }
}

function writeLocal(items: MoodPicAsset[]): void {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(items));
  } catch {
    // 忽略写入失败（如配额满），不阻断主流程
  }
}

/** 列出图库（分页）。 */
export async function listMoodPics(
  page: number,
  pageSize: number,
): Promise<MoodPicListResult> {
  if (READ_VIA_ARCA) return listViaArca(page, pageSize);
  const all = readLocal();
  const start = (page - 1) * pageSize;
  return {
    items: all.slice(start, start + pageSize),
    total: all.length,
  };
}

/** 批量删除（软删库记录 + 异步清理 OSS 对象，由后端完成）。 */
export async function batchDeleteMoodPics(assetIds: string[]): Promise<void> {
  if (READ_VIA_ARCA) return batchDeleteViaArca(assetIds);
  const idSet = new Set(assetIds);
  writeLocal(readLocal().filter((a) => !idSet.has(a.assetId)));
}

// [ARCA_IMPL] 对齐 arca.api（dev 分支 MoodPic 模块）字段，snake_case。

/** arca 契约：MoodpicAssetItem（部分字段透传）。 */
interface ArcaTosObject {
  bucket_name?: string;
  object_key?: string;
  object_type?: string;
  url?: string;
}
interface ArcaMoodpicItem {
  asset_id: string;
  image: ArcaTosObject;
  prompt: string;
  config_json: string;
  ratio: string;
  resolution: string;
  created_at: number; // unix 毫秒
}
interface ArcaMoodpicListResp {
  items: ArcaMoodpicItem[] | null;
  total: number;
}

/** 安全解析 config_json；失败给一个最小可用的占位配置。 */
function parseConfig(configJson: string): AssetConfig {
  try {
    return JSON.parse(configJson) as AssetConfig;
  } catch {
    return { emotion: '', subject: 'none', type: 'abstract', style: '', dna: {} };
  }
}

/** 契约 item → 前端 MoodPicAsset。 */
function toAsset(it: ArcaMoodpicItem): MoodPicAsset {
  return {
    assetId: it.asset_id,
    url: it.image?.url ?? '',
    prompt: it.prompt,
    config: parseConfig(it.config_json),
    ratio: it.ratio,
    resolution: it.resolution,
    createdAt: new Date(it.created_at).toISOString(),
  };
}

/** POST /moodpic/list —— 分页列出当前用户图库（按创建时间倒序）。 */
async function listViaArca(page: number, pageSize: number): Promise<MoodPicListResult> {
  const data = await arcaPost<{ page: number; page_size: number }, ArcaMoodpicListResp>(
    '/moodpic/list',
    { page, page_size: pageSize },
  );
  return {
    items: (data.items ?? []).map(toAsset),
    total: data.total ?? 0,
  };
}

/** POST /moodpic/batch_delete —— 批量删除（软删 + 异步清 OSS）。 */
async function batchDeleteViaArca(assetIds: string[]): Promise<void> {
  await arcaPost<{ asset_ids: string[] }, Record<string, never>>(
    '/moodpic/batch_delete',
    { asset_ids: assetIds },
  );
}

// [UPLOAD_CHAIN] 出图后自动写链路：调本服务端 /api/moodpic/upload
// （服务端拉 apimart 图字节 → 传 OSS → 登记 arca /moodpic/save）。

/** 写链路入参（前端拿到 apimart 直链后调用）。 */
export interface UploadMoodPicInput {
  imageUrl: string;
  prompt: string;
  config: AssetConfig;
  ratio: string;
  resolution: string;
}

/** 写链路结果。skipped=true 表示服务端未配 OSS，前端回退本地暂存。 */
export interface UploadMoodPicResult {
  skipped?: boolean;
  assetId?: string;
  url?: string;
}

/**
 * 把一张已出图的资产存档（永久化）。
 * 由服务端完成「拉图 → 传 OSS → 登记 arca」，前端不接触任何密钥、也不受 CORS 限制。
 */
export async function uploadMoodPic(
  input: UploadMoodPicInput,
  signal?: AbortSignal,
): Promise<UploadMoodPicResult> {
  const res = await fetch('/api/moodpic/upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      imageUrl: input.imageUrl,
      prompt: input.prompt,
      configJson: JSON.stringify(input.config),
      ratio: input.ratio,
      resolution: input.resolution,
    }),
    signal,
  });
  if (!res.ok) {
    let message = `存档失败（${res.status}）`;
    try {
      const j = (await res.json()) as { error?: string };
      if (j.error) message = j.error;
    } catch {
      // 忽略解析失败，用默认文案
    }
    throw new Error(message);
  }
  return (await res.json()) as UploadMoodPicResult;
}
