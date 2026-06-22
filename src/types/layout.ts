/**
 * 文字排版链路的核心契约类型（特效排版范式）。
 *
 * 链路：输入文字 → [结构抽取] → LayoutRecipe → [Canvas 渲染] → 4:3 文字图片
 *
 * 与语义排版不同，这里的排版是「生成式视觉特效」：
 * 每种 EffectMode 对应一套 Canvas 逐字绘制算法，参数 + 随机种子决定具体形态。
 *
 * 算法范式参考自「文字排版效果生成器 @shiemezz」
 * https://shiemezz9.github.io/text-layout-generator/
 */

/** 画布固定输出尺寸：4:3，1080 * 810（导出像素） */
export const CANVAS_WIDTH = 1080;
export const CANVAS_HEIGHT = 810;
export const CANVAS_RATIO = '4 / 3';

/** 输入文字硬上限（字符数） */
export const MAX_INPUT_LENGTH = 500;

/** 支持的排版特效模式。 */
export type EffectMode =
  | 'rain' // 竖排雨落层次
  | 'barrage' // 横排弹幕模式
  | 'tearBlur' // 泪水模糊
  | 'imageFill'; // 图片填充字

/** imageFill 的填充形状来源。 */
export type FillShape =
  | 'heart' // 爱心
  | 'star' // 星星
  | 'circle' // 圆形
  | 'diamond' // 菱形
  | 'image'; // 上传图片

/**
 * 特效渲染的「数值参数」。所有可在区间内随机的旋钮收在这里，渲染算法只读这份参数。
 * 数值基于 1080*810 画布；导出高清时由渲染器统一缩放。
 *
 * 注意：字体/配色不在此处——它们走 RenderStyle（来自配色库或图片库），
 * 数值参数与视觉风格解耦。
 */
export interface EffectParams {
  /** 最小字号(px) */
  minSize: number;
  /** 最大字号(px) */
  maxSize: number;
  /** 随机模糊上限(px) */
  blur: number;
  /** 内边距(px)：rain/barrage/tearBlur/imageFill 通用边距 */
  padding: number;
  /** 随机种子：相同种子 + 相同输入 = 相同结果 */
  seed: number;

  /** rain/barrage：错落程度；tearBlur：模糊圆数量（百分比 0-100） */
  spread: number;

  /** tearBlur：字间距(px) */
  tearLetterSpacing: number;
  /** tearBlur：行间距（相对字号百分比） */
  tearLineSpacing: number;
  /** tearBlur：模糊圆半径(px) */
  tearBlurRadius: number;

  /** imageFill：填充方向 */
  fillDirection: 'horizontal' | 'vertical';
  /** imageFill：填充形状（内置形状或上传图片） */
  fillShape: FillShape;
  /** imageFill：上传图片明暗阈值(0-255)，低于阈值视为形状内部（仅 fillShape='image' 用） */
  imageThreshold: number;
}

/**
 * 渲染视觉风格：字体 + 配色 + 可选背景图。
 * 由背景选择（配色库/图片库）解析而来，渲染算法据此上色。
 */
export interface RenderStyle {
  /** 字体族（CSS font-family） */
  fontFamily: string;
  /** 文字颜色 */
  fontColor: string;
  /** 背景色（纯色或 CSS 渐变）；有 bgImageUrl 时作为图片底色 */
  bgColor: string;
  /** 背景图地址（可选，来自图片库） */
  bgImageUrl?: string;
  /** 背景图上的遮罩色（保证文字可读，可选） */
  overlay?: string;
}

/**
 * 结构抽取结果：渲染一张图所需的完整配方。
 * 这是渲染层消费的稳定契约（已把模型的离散选择解析为具体 style + 随机出的 params）。
 */
export interface LayoutRecipe {
  /** 排版效果模式 */
  mode: EffectMode;
  /** 区间随机出的数值参数 */
  params: EffectParams;
  /** 解析后的渲染风格（字体/配色/背景图） */
  style: RenderStyle;
  /** 后台决策出的背景选择（配色/图片，供测试器展示读数） */
  background: import('./catalog').Background;
  /** imageFill 时后台决策的形状（供测试器展示读数） */
  shape?: FillShape;
  /** 抽取来源：mock 阶段为 'mock'，后端接上后为 'model' */
  source: 'mock' | 'model';
}

/** 结构抽取请求参数。 */
export interface ExtractLayoutInput {
  text: string;
  /** 可选：用户指定偏好的模式，抽取层可参考 */
  preferredMode?: EffectMode;
  /** 可选：指定随机种子（用于"换一版"复现/变体）；不传则随机 */
  seed?: number;
}
