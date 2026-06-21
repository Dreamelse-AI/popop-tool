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

/**
 * 特效渲染参数。所有可调旋钮收在这里，渲染算法只读这份参数。
 * 数值基于 1080*810 画布；导出高清时由渲染器统一缩放。
 */
export interface EffectParams {
  /** 字体族（CSS font-family） */
  fontFamily: string;
  /** 字体颜色 */
  fontColor: string;
  /** 背景颜色 */
  bgColor: string;
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

  /** rain/barrage：主轴中心位置（百分比 0-100）。rain 为横轴 Y，barrage 为竖轴 X */
  axisCenter: number;

  /** tearBlur：字间距(px) */
  tearLetterSpacing: number;
  /** tearBlur：行间距（相对字号百分比） */
  tearLineSpacing: number;
  /** tearBlur：模糊圆半径(px) */
  tearBlurRadius: number;
  /** tearBlur：分散程度（控制模糊圆数量，百分比 0-100） */
  spread: number;

  /** imageFill：填充方向 */
  fillDirection: 'horizontal' | 'vertical';
  /** imageFill：图片明暗阈值(0-255)，低于阈值视为形状内部 */
  imageThreshold: number;
}

/**
 * 结构抽取结果：决定用哪种特效 + 初始参数。
 * 这是后端要返回的稳定契约。
 */
export interface LayoutRecipe {
  /** 推荐特效模式 */
  mode: EffectMode;
  /** 推荐特效参数（用户可在 UI 覆盖） */
  params: EffectParams;
  /** 抽取来源：mock 阶段为 'mock'，后端接上后为 'model' */
  source: 'mock' | 'model';
}

/** 结构抽取请求参数。 */
export interface ExtractLayoutInput {
  text: string;
  /** 可选：用户指定偏好的模式，抽取层可参考 */
  preferredMode?: EffectMode;
}
