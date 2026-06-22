/**
 * Atmospheric Motion Background System v1.0 的核心契约类型。
 *
 * 链路：选 5 层（Motion/Medium/Light/Color/Mood）→ [拼装 prompt]
 *   → BackgroundRecipe → [调用图像生成 API] → 氛围背景图
 *
 * 设计目标：生成「情绪/空气/光/流动」的抽象氛围背景，而非具体物体或场景。
 * 所有图片继承固定的品牌视觉底座（见 data/backgroundOptions.ts 的 BRAND_BASE）。
 */

/** 系统的五个组合层。 */
export type BackgroundLayer = 'motion' | 'medium' | 'light' | 'color' | 'mood';

/** 运动层：定义视觉流动方式。 */
export type MotionId = 'breeze' | 'flow' | 'wave' | 'orbit' | 'burst';

/** 介质层：决定视觉质感。 */
export type MediumId = 'air' | 'cloud' | 'silk' | 'glass' | 'light';

/** 光感层。 */
export type LightId = 'softBloom' | 'daylight' | 'pearl' | 'neon' | 'spotlight';

/** 色彩层。 */
export type ColorId = 'calmMint' | 'dreamLavender' | 'oceanBlue' | 'sunset' | 'midnight';

/** 情绪层。 */
export type MoodId = 'relaxed' | 'dreamy' | 'premium' | 'energetic' | 'nostalgic';

/** 单个层选项的元信息（纯数据，UI 与 prompt 拼装共用）。 */
export interface LayerOption<TId extends string> {
  id: TId;
  /** UI 展示名（英文原名） */
  name: string;
  /** 情绪/关键词中文标签，用于卡片副标题 */
  mood: string;
  /** 注入最终 prompt 的英文片段（逗号分隔的短语） */
  promptFragment: string;
}

/** 一次背景生成的完整选择（五层各选一个）。 */
export interface BackgroundSelection {
  motion: MotionId;
  medium: MediumId;
  light: LightId;
  color: ColorId;
  mood: MoodId;
}

/** 输出图片比例（apimart size 字段直接透传）。 */
export type AspectRatio = '9:16' | '3:4' | '1:1' | '4:3' | '16:9';

/** 输出分辨率档位（apimart resolution 字段）。 */
export type Resolution = '1k' | '2k' | '4k';

/** 生成参数：选择 + 输出规格 + 可选自定义补充词。 */
export interface BackgroundRecipe {
  selection: BackgroundSelection;
  ratio: AspectRatio;
  resolution: Resolution;
  /** 用户追加的自定义关键词（可选，拼到 prompt 末尾） */
  extraKeywords?: string;
}

/** 推荐组合预设。 */
export interface BackgroundPreset {
  id: string;
  /** 预设中文名，如「放松慵懒」 */
  name: string;
  /** 一句话描述风格 */
  description: string;
  selection: BackgroundSelection;
}

/** 图像生成请求体（发给同源代理，代理再转发给 apimart）。 */
export interface GenerateImageRequest {
  prompt: string;
  size: AspectRatio;
  resolution: Resolution;
  /** 生成张数，固定 1 */
  n: number;
}

/** 图像生成响应里的单张结果。 */
export interface GeneratedImage {
  /** 直链 URL（apimart 返回 url 时） */
  url?: string;
  /** base64（apimart 返回 b64_json 时） */
  b64Json?: string;
}
