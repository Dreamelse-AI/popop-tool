/**
 * MoodPic 图库类型契约（前端侧）。
 *
 * 对应后端待新增的 arca 图库接口（见 docs/moodpic-storage-plan.md）。
 * 字段先按需求语义定义；后端契约（arca.api）定稿后以其 snake_case 为准再对齐。
 */

import type { AssetConfig } from './visualAsset';

/** 一条已永久存储的图库资产。 */
export interface MoodPicAsset {
  /** 后端资产 id */
  assetId: string;
  /** 可直接渲染的图片 URL（后端给 CDN 签名直链） */
  url: string;
  /** 扩写后实际出图用的 prompt */
  prompt: string;
  /** 结构化配置（来源可回看） */
  config: AssetConfig;
  ratio: string;
  resolution: string;
  /** 创建时间（ISO 字符串） */
  createdAt: string;
}

/** 分页列表响应。 */
export interface MoodPicListResult {
  items: MoodPicAsset[];
  total: number;
}

/** 保存一条资产的入参（前端已上传 OSS 后调用）。 */
export interface SaveMoodPicInput {
  url: string;
  objectKey: string;
  prompt: string;
  config: AssetConfig;
  ratio: string;
  resolution: string;
}
