/**
 * 表情包生成器的核心契约类型。
 *
 * 链路：上传人物形象图 → 写生图提示词（含风格/文案，可存可改可删）
 *      → 单次 gpt-image-2 图生图出一张 3×3 九宫格大图
 *      → 前端 Canvas 切成 9 张方图
 *      → 色键抠图（纯背景阈值去背景）成透明 PNG
 *      → 复用 MoodPic 存储链路落库/图库。
 *
 * 设计目标：一次生图调用拿到 9 个表情，切图与抠图全在前端完成，
 *          把联网/出图调用次数与成本压到最低。
 */

import type { AspectRatio, Resolution } from './visualAsset';

/** 九宫格固定 3×3。 */
export const STICKER_GRID = 3;
/** 一张九宫格切出的表情数量。 */
export const STICKER_COUNT = STICKER_GRID * STICKER_GRID;

/** 一个可复用的提示词预设（用户自填，含风格/文案，本地持久化）。 */
export interface StickerPrompt {
  id: string;
  /** 预设名称（展示用，便于区分） */
  name: string;
  /** 实际送去出图的提示词正文（含风格、文案描述） */
  prompt: string;
  /** 创建/更新时间戳（ms），用于排序 */
  updatedAt: number;
}

/** 一个表情情绪（九宫格里每格对应一个，可增删改）。 */
export interface StickerEmotion {
  id: string;
  /** 中文标签（展示用） */
  label: string;
  /** 英文片段（注入 prompt，提升模型理解准确度） */
  en: string;
}

/** 抠图（去背景）模式。 */
export type MattingMode = 'none' | 'colorKey';

/** 色键抠图参数：背景基准色 + 容差。 */
export interface ColorKeyOptions {
  /** 背景基准色（生图时要求的纯色背景，默认纯绿） */
  bgColor: { r: number; g: number; b: number };
  /** 颜色距离容差（0~441，越大去得越狠） */
  tolerance: number;
  /** 边缘羽化像素（柔化抠图硬边，0 表示不羽化） */
  feather: number;
}

/** 一次表情包生成的输入参数。 */
export interface StickerGenerateParams {
  /** 人物形象参考图（base64 data URI，喂给图生图 image_urls） */
  referenceImages: string[];
  /** 实际出图用的提示词正文 */
  prompt: string;
  /** 九宫格 9 格各自的情绪（按行优先顺序，长度应为 9） */
  emotions: StickerEmotion[];
  /** 输出比例（九宫格用 1:1 最稳，保证每格近似方形） */
  ratio: AspectRatio;
  /** 输出分辨率档位 */
  resolution: Resolution;
  /** 抠图模式 */
  matting: MattingMode;
  /** 色键抠图参数（matting=colorKey 时生效） */
  colorKey: ColorKeyOptions;
}

/** 单个表情结果项的状态。 */
export type StickerItemStatus = 'pending' | 'processing' | 'done' | 'error';

/** 九宫格切出的单个表情结果。 */
export interface StickerItem {
  id: string;
  /** 在九宫格中的序号（0~8，行优先） */
  index: number;
  /** 该格对应的情绪标签（展示用，可能为空） */
  emotionLabel?: string;
  status: StickerItemStatus;
  /** 处理完成后的图片（data URL，已切图 + 可选抠图） */
  dataUrl?: string;
  /** 失败原因 */
  error?: string;
}

/** 整次生成任务的状态。 */
export type StickerTaskStatus =
  | 'idle'
  | 'generating'
  | 'slicing'
  | 'matting'
  | 'done'
  | 'error';
