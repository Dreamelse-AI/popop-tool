/**
 * IP 延展工具的核心契约类型。
 *
 * 链路：上传 IP 形象图 + 一套表情包图（转 base64 在内存里用，刷新即清空，暂不持久化）
 *      → 选场景（动作/情绪/插画类型预设三态 + 自由场景文本）→ 随机展开 N 条延展配置
 *      → 本地拼 prompt → apimart 图生图（参考图保证角色一致）→ 本地下载。
 *
 * 注：存储（OSS / 图库）暂未接入，后续再加。当前 IP 档案仅存在于本次会话内存中。
 *
 * 复用 visualAsset 的 AspectRatio / Resolution / AssetOption。
 */

import type { AspectRatio, Resolution } from './visualAsset';

/** 一张 IP 素材图（base64 data URI，喂给 apimart 图生图）。 */
export interface IpAssetImage {
  /** base64 data URI（data:image/...;base64,xxx）。 */
  url: string;
  /** 素材角色：character=IP 形象主图，sticker=表情包参考图。 */
  role: IpAssetRole;
}

/** IP 素材在出图时扮演的角色。 */
export type IpAssetRole = 'character' | 'sticker';

/**
 * 一个 IP 档案：一组素材集合。当前仅存在于会话内存（刷新清空），后续接入存储再持久化。
 */
export interface IpProfile {
  id: string;
  /** 用户起的 IP 名称（如 "波波"）。 */
  name: string;
  /** IP 形象主图（至少 1 张，作为角色一致性的主参考）。 */
  characterImages: IpAssetImage[];
  /** 一套表情包参考图（可选，进一步约束风格/表情基底）。 */
  stickerImages: IpAssetImage[];
  /** 创建时间（ISO 字符串）。 */
  createdAt: string;
}

/**
 * 一条延展配置（由场景选择随机/锁定展开成的确定组合）。
 * 各维度存单个 option id；空串表示该维度本条不约束。
 */
export interface IpExtendConfig {
  /** 动作 option id。 */
  action: string;
  /** 情绪 option id。 */
  emotion: string;
  /** 插画类型 option id。 */
  illustration: string;
  /** 用户自由场景描述（所有条目共享，原样注入 prompt）。 */
  scene: string;
}

/** 场景三态选择（每个维度存 id 数组，空=随机，1=锁定，多=限定随机）。 */
export interface IpExtendSelection {
  action: string[];
  emotion: string[];
  illustration: string[];
}

/** 单张延展结果项的状态。 */
export type IpItemStatus = 'pending' | 'generating' | 'done' | 'error';

/** 单张延展结果项。 */
export interface IpResultItem {
  id: string;
  /** 来源配置，便于回看/复现/重试。 */
  config: IpExtendConfig;
  /** 实际送去出图的完整 prompt。 */
  prompt: string;
  status: IpItemStatus;
  /** generating 细分阶段：expanding 拼 prompt / imaging 出图中。 */
  phase?: 'expanding' | 'imaging';
  /** 成功后的图片直链。 */
  url?: string;
  ratio?: AspectRatio;
  resolution?: Resolution;
  /** 失败原因。 */
  error?: string;
}
