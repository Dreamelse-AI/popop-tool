/**
 * MoodPic 图库服务：列表 / 批量删除 / 保存。
 *
 * 对接后台接口 /admin/api/moodpic/*（X-Admin-Token 鉴权，由反代层注入）：
 *   - POST /admin/api/moodpic/save         → { asset_id }   登记一张外部出图 URL（后端搬运到自有桶）
 *   - POST /admin/api/moodpic/list         → { items, total } 分页（按创建时间倒序）
 *   - POST /admin/api/moodpic/batch_delete → {}              幂等批量删除（软删 + 异步清对象）
 *
 * 响应风格：统一信封 {code,msg,data}，HTTP 恒 200（鉴权失败除外），走 arcaPost。
 * 归属用户恒为系统账号（user_id=system）。字段 snake_case，这里做映射。
 */

import type {
  MoodPicAsset,
  MoodPicListResult,
} from '@/types/moodpic';
import type { AssetConfig } from '@/types/visualAsset';
import { arcaPost } from './arcaClient';

const BASE = '/admin/api/moodpic';

/** 列出图库（分页，按创建时间倒序）。 */
export async function listMoodPics(
  page: number,
  pageSize: number,
): Promise<MoodPicListResult> {
  return listViaArca(page, pageSize);
}

/** 批量删除（软删库记录 + 异步清理对象，由后端完成；幂等）。 */
export async function batchDeleteMoodPics(assetIds: string[]): Promise<void> {
  return batchDeleteViaArca(assetIds);
}

// ==================== arca 契约对接（snake_case） ====================

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

/** POST /admin/api/moodpic/list —— 分页列出图库（按创建时间倒序）。 */
async function listViaArca(page: number, pageSize: number): Promise<MoodPicListResult> {
  const data = await arcaPost<{ page: number; page_size: number }, ArcaMoodpicListResp>(
    `${BASE}/list`,
    { page, page_size: pageSize },
  );
  return {
    items: (data.items ?? []).map(toAsset),
    total: data.total ?? 0,
  };
}

/** POST /admin/api/moodpic/batch_delete —— 批量删除（软删 + 异步清对象，幂等）。 */
async function batchDeleteViaArca(assetIds: string[]): Promise<void> {
  await arcaPost<{ asset_ids: string[] }, Record<string, never>>(
    `${BASE}/batch_delete`,
    { asset_ids: assetIds },
  );
}

// [SAVE_CHAIN] 出图后存档：调 /admin/api/moodpic/save 登记图片 url。
// apimart 出图已返回可访问 url，后端负责把它搬运到自有桶（moodpic/ 前缀）并登记元数据。

/** 存档入参（前端拿到 apimart 直链后调用）。 */
export interface SaveMoodPicInput {
  imageUrl: string;
  prompt: string;
  config: AssetConfig;
  ratio: string;
  resolution: string;
}

/** 存档结果。 */
export interface SaveMoodPicResult {
  assetId: string;
}

/**
 * 把一张已出图的资产登记到图库。
 * POST /admin/api/moodpic/save（X-Admin-Token 鉴权，由反代注入）
 * 请求 snake_case 扁平字段：image_url 必填（http(s) 绝对地址），其余 optional；
 * 后端负责下载该 url 并转存到自有桶（moodpic/ 前缀）。
 */
export async function saveMoodPic(
  input: SaveMoodPicInput,
  signal?: AbortSignal,
): Promise<SaveMoodPicResult> {
  const data = await arcaPost<
    {
      image_url: string;
      prompt: string;
      config_json: string;
      ratio: string;
      resolution: string;
    },
    { asset_id?: string }
  >(
    `${BASE}/save`,
    {
      image_url: input.imageUrl,
      prompt: input.prompt,
      config_json: JSON.stringify(input.config),
      ratio: input.ratio,
      resolution: input.resolution,
    },
    signal,
  );
  return { assetId: data.asset_id ?? '' };
}
