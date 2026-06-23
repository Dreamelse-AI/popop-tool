/**
 * 目录契约（catalog）：排版效果库 / 配色库 / 图片库 的机器可读定义。
 *
 * 设计原则：目录是「单一事实源」，同时被两处消费——
 *   1) 拼进 prompt：告诉模型有哪些可选项及各自适用场景（whenToUse）
 *   2) 渲染引擎：照模型输出的 id 去渲染
 *
 * 分工：模型只选「离散项」（effectId / 背景）；
 *       数值参数（字号/模糊/边距…）由本地在区间内随机（见 randomizeParams）。
 */

import type { EffectMode } from './layout';

/** 数值参数的随机区间：[最小, 最大]。生成时在区间内随机取值。 */
export type ParamRange = [min: number, max: number];

/** 可被区间随机的数值参数键（seed 不在内，单独处理）。 */
export type NumericParamKey =
  | 'minSize'
  | 'maxSize'
  | 'blur'
  | 'padding'
  | 'spread'
  | 'tearLetterSpacing'
  | 'tearLineSpacing'
  | 'tearBlurRadius'
  | 'titleSize'
  | 'listLineSpacing';

/**
 * 单个参数的规格：自描述（键 + 标签 + 单位 + 区间 + 步进）。
 * 这是参数的「单一事实源」，同时供：
 *   - randomizeParams：按 range 在区间内随机
 *   - UI 滑杆：用 label/unit/range/step 渲染
 */
export interface ParamSpec {
  key: NumericParamKey;
  /** UI 显示的中文标签 */
  label: string;
  /** 单位，如 'px' / '%'；无单位可省 */
  unit?: string;
  /** 随机区间，同时作为滑杆上下界 */
  range: ParamRange;
  /** 滑杆步进，默认 1 */
  step?: number;
}

/** 排版效果库的一条目录项。 */
export interface EffectEntry {
  /** 渲染调度用的模式 id */
  id: EffectMode;
  /** 展示名 */
  name: string;
  /** 给模型判断「何时该选它」的描述，会拼进 prompt */
  whenToUse: string;
  /** 该效果的参数规格清单（只列本效果实际用到的参数，无空字段） */
  params: ParamSpec[];
  /** 缩略图强调色（仅 UI 选择列表用） */
  swatch: string;
}

/** 配色库的一条目录项：一套审过的安全配色。 */
export interface PaletteEntry {
  /** 唯一 id（模型输出用） */
  id: string;
  /** 所属大类（如「深夜/孤独系」），仅用于 UI 分组展示 */
  category: string;
  /** 展示名 */
  name: string;
  /** 适用气质，拼进 prompt 供模型选 */
  mood: string;
  /** 背景色：纯色 '#16110d'，或两段渐变 '#A → #B'（渲染时转 CSS 线性渐变） */
  bgColor: string;
  /** 文字主色（已与 bgColor 校验过对比度） */
  fontColor: string;
  /** 字体气质倾向：serif（抒情/杂志感）/ sans（现代/科技感）。渲染时据此选字体栈 */
  font: import('@/features/text-layout/typography').FontKind;
  /** 可选强调色 */
  accent?: string;
}

/**
 * 图片库的一条目录项：一张可作背景的氛围图。
 * 图片来自「视觉资产生产引擎」的产出，通过 tags 与情绪/类型关联检索。
 */
export interface ImageEntry {
  /** 唯一 id（模型输出用） */
  id: string;
  /** 展示名 */
  name: string;
  /** 适用气质，拼进 prompt 供模型选 */
  mood: string;
  /** 关联标签（情绪/主题等），用于和视觉资产引擎产出对齐检索 */
  tags: string[];
  /** 背景图地址（视觉资产引擎产出） */
  url: string;
  /**
   * 压在此图上的文字色。
   * 缺省时由运行时按图片明暗自动判定黑/白（见 detectFontColor）。
   */
  fontColor?: string;
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
}
