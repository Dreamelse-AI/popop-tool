/**
 * 目录契约（catalog）：排版效果库 / 配色库 / 图片库 的机器可读定义。
 *
 * 设计原则：目录是「单一事实源」，同时被两处消费——
 *   1) 拼进 prompt：告诉模型有哪些可选项及各自适用场景（whenToUse）
 *   2) 渲染引擎：照模型输出的 id 去渲染
 *
 * 分工：模型只选「离散项」（effectId / 背景 / 形状）；
 *       数值参数（字号/模糊/边距…）由本地在区间内随机（见 randomizeParams）。
 */

import type { EffectMode, EffectParams, FillShape } from './layout';

/** 数值参数的随机区间：[最小, 最大]。生成时在区间内随机取值。 */
export type ParamRange = [min: number, max: number];

/** 一个效果可随机的数值参数区间集合（只列该效果实际用到的项）。 */
export type EffectParamRanges = Partial<
  Record<Extract<keyof EffectParams, string>, ParamRange>
>;

/** 排版效果库的一条目录项。 */
export interface EffectEntry {
  /** 渲染调度用的模式 id */
  id: EffectMode;
  /** 展示名 */
  name: string;
  /** 给模型判断「何时该选它」的描述，会拼进 prompt */
  whenToUse: string;
  /** 该效果数值参数的随机区间（生产链路在此区间内随机） */
  paramRanges: EffectParamRanges;
  /** 缩略图强调色（仅 UI 选择列表用） */
  swatch: string;
  /** 该效果是否需要形状（仅 imageFill = true） */
  needsShape?: boolean;
}

/** 配色库的一条目录项：一套审过的安全配色。 */
export interface PaletteEntry {
  /** 唯一 id（模型输出用） */
  id: string;
  /** 展示名 */
  name: string;
  /** 适用气质，拼进 prompt 供模型选 */
  mood: string;
  /** 背景色（纯色或 CSS 渐变） */
  bgColor: string;
  /** 文字主色（已与 bgColor 校验过对比度） */
  fontColor: string;
  /** 可选强调色 */
  accent?: string;
}

/** 图片库的一条目录项：一张可作背景的氛围图。 */
export interface ImageEntry {
  /** 唯一 id（模型输出用） */
  id: string;
  /** 展示名 */
  name: string;
  /** 适用气质，拼进 prompt 供模型选 */
  mood: string;
  /** 背景图地址（氛围图工具产出） */
  url: string;
  /** 压在此图上推荐的文字色（保证可读） */
  fontColor: string;
  /** 图上叠加的遮罩（保证文字可读），CSS 颜色，可选 */
  overlay?: string;
}

/**
 * 背景：配色库与图片库「二选一」。
 * 渲染时据此决定底色还是底图。
 */
export type Background =
  | { type: 'palette'; paletteId: string }
  | { type: 'image'; imageId: string };

/**
 * 模型生成时一并吐出的结构化输出（调用格式 schema）。
 * 注意：不含任何数值参数——数值由本地区间随机补齐。
 */
export interface GenerationOutput {
  /** 模型生成的文案（≤500 字） */
  text: string;
  /** 选用的排版效果 id */
  effectId: EffectMode;
  /** 背景：配色或图片，二选一 */
  background: Background;
  /** 仅 effectId='imageFill' 时需要：填充形状 */
  shapeId?: FillShape;
}
