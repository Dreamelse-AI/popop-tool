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
  SaveMoodPicInput,
} from '@/types/moodpic';

/** 后端图库接口是否就绪。后端联调时置 false。 */
const USE_MOCK = true;

// [MOCK_STORE]
/** mock 内存库（仅开发态占位，刷新即清空，不做持久化）。 */
const mockDb: MoodPicAsset[] = [];

/** 列出图库（分页）。 */
export async function listMoodPics(
  page: number,
  pageSize: number,
): Promise<MoodPicListResult> {
  if (USE_MOCK) {
    const start = (page - 1) * pageSize;
    return {
      items: mockDb.slice(start, start + pageSize),
      total: mockDb.length,
    };
  }
  return listViaArca(page, pageSize);
}

/** 批量删除（删 OSS 对象 + 库记录由后端完成）。 */
export async function batchDeleteMoodPics(assetIds: string[]): Promise<void> {
  if (USE_MOCK) {
    for (const id of assetIds) {
      const idx = mockDb.findIndex((a) => a.assetId === id);
      if (idx >= 0) mockDb.splice(idx, 1);
    }
    return;
  }
  return batchDeleteViaArca(assetIds);
}

/** 保存一条资产（前端已上传 OSS 后调用）。 */
export async function saveMoodPic(input: SaveMoodPicInput): Promise<MoodPicAsset> {
  if (USE_MOCK) {
    const asset: MoodPicAsset = {
      assetId: `mock-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      url: input.url,
      prompt: input.prompt,
      config: input.config,
      ratio: input.ratio,
      resolution: input.resolution,
      createdAt: new Date().toISOString(),
    };
    mockDb.unshift(asset);
    return asset;
  }
  return saveViaArca(input);
}

// [ARCA_IMPL] 后端定稿后实现：复用 arcaPost，对齐 arca.api 字段（snake_case）。
async function listViaArca(_page: number, _pageSize: number): Promise<MoodPicListResult> {
  // 例：const data = await arcaPost('/moodpic/list', { page, page_size: pageSize });
  throw new Error('图库列表接口尚未接入 arca');
}

async function batchDeleteViaArca(_assetIds: string[]): Promise<void> {
  // 例：await arcaPost('/moodpic/batch_delete', { asset_ids: assetIds });
  throw new Error('图库批量删除接口尚未接入 arca');
}

async function saveViaArca(_input: SaveMoodPicInput): Promise<MoodPicAsset> {
  // 例：const data = await arcaPost('/moodpic/save', { image, prompt, config_json, ratio, resolution });
  throw new Error('图库保存接口尚未接入 arca');
}
