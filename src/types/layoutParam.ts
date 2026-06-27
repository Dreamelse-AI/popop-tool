/**
 * 排版参数模版（单一事实源）。
 *
 * 定位：这是「整体排版中的一个原子」——只描述「文字如何排布」的规则，
 * 不含具体文案内容，也不含背景/背景色（背景单独成块，后续组合）。
 * 一个模版后续可被填充不同文字、叠加不同背景，反复复用。
 *
 * 参数口径参考「文字自动化排版」效果参数表（typography.ts / EffectParams）：
 *   - 「越大越细」字重曲线、字号分档、小字加宽字距等
 * 但这里更通用：面向任意文案排版模版，不绑定某种特效算法。
 *
 * 所有数值基于「参考画布」(canvas.referenceWidth × referenceHeight)，
 * 实际渲染时按目标尺寸等比缩放。
 */

/** 字体气质：衬线 / 无衬线 / 等宽（小字标签）。 */
export type FontKind = 'serif' | 'sans' | 'mono';

/** 文本块在整体排版里的语义角色。 */
export type TextRole =
  | 'kicker' // 眉标 / 上标小字
  | 'title' // 主标题
  | 'subtitle' // 副标题
  | 'body' // 正文
  | 'caption' // 注释 / 说明小字
  | 'pageNumber' // 页码 / 角标
  | 'signature'; // 署名 / 落款

/** 水平对齐。 */
export type TextAlign = 'left' | 'center' | 'right' | 'justify';

/** 锚点：文本块在画布里的定位基准（九宫格）。 */
export type Anchor =
  | 'top-left'
  | 'top-center'
  | 'top-right'
  | 'center-left'
  | 'center'
  | 'center-right'
  | 'bottom-left'
  | 'bottom-center'
  | 'bottom-right';

/** 书写方向：横排 / 竖排。 */
export type WritingMode = 'horizontal' | 'vertical';

/** 字形变换。 */
export type TextTransform = 'none' | 'uppercase' | 'lowercase' | 'capitalize';

/** 单个文本块的排版参数（不含文字内容、不含颜色）。 */
export interface TextBlockParam {
  /** 语义角色 */
  role: TextRole;
  /** 字体气质 */
  fontKind: FontKind;
  /** 字号(px，基于参考画布) */
  fontSize: number;
  /** 字重(100-900) */
  fontWeight: number;
  /** 行高（相对字号倍数，如 1.2） */
  lineHeight: number;
  /** 字距(em)，可为负 */
  letterSpacing: number;
  /** 水平对齐 */
  textAlign: TextAlign;
  /** 定位锚点 */
  anchor: Anchor;
  /** 书写方向 */
  writingMode: WritingMode;
  /** 字形变换（主要针对西文） */
  textTransform: TextTransform;
  /** 建议单行最多字符数（排版换行/防溢出依据） */
  maxCharsPerLine: number;
  /** 最大行数（超出需缩字号或截断） */
  maxLines: number;
  /** 相对锚点的旋转角度(deg)，0 为不旋转 */
  rotation: number;
  /** 该块相对画布高度的纵向占位起点(%)，用于多块垂直排布参考；可选 */
  offsetYPercent?: number;
}

/** 画布 / 容器层参数。 */
export interface CanvasParam {
  /** 宽高比，如 '4:3' '3:4' '1:1' '9:16' */
  ratio: string;
  /** 参考画布宽(px)，所有字号/边距以此为基准 */
  referenceWidth: number;
  /** 参考画布高(px) */
  referenceHeight: number;
  /** 安全边距(px)：上右下左统一值（内容不越界） */
  padding: number;
  /** 栅格列数（无栅格填 1） */
  gridColumns: number;
  /** 文本块之间的垂直间距(px) */
  blockGap: number;
}

/** 整体节奏 / 风格倾向（供组合与命名参考，不含颜色）。 */
export interface RhythmParam {
  /** 字号阶梯比例（相邻层级字号比，如 1.5 = 黄金比附近） */
  scaleRatio: number;
  /** 视觉密度：'airy'(疏朗) | 'balanced'(均衡) | 'dense'(密实) */
  density: 'airy' | 'balanced' | 'dense';
  /** 整体对齐基调：'left' | 'center' | 'mixed' */
  alignmentMood: 'left' | 'center' | 'mixed';
}

/** 一套完整的排版参数模版。 */
export interface LayoutParamTemplate {
  /** 模版 id（稳定标识，导出/组合时用） */
  id: string;
  /** 模版名称（AI 给出的一句话气质命名，可编辑） */
  name: string;
  /** 适用场景 / 排版气质描述（中文一句话） */
  vibe: string;
  /** 画布层参数 */
  canvas: CanvasParam;
  /** 文本块（按视觉从上到下/主到次排列） */
  blocks: TextBlockParam[];
  /** 整体节奏参数 */
  rhythm: RhythmParam;
}

/** 一条记录：源图 + 分析出的模版 + 状态（页面/store 消费）。 */
export interface LayoutParamRecord {
  /** 记录 id */
  id: string;
  /** 源图（base64 data URI），左列展示与分析输入 */
  sourceUrl: string;
  /** 处理状态 */
  status: 'pending' | 'analyzing' | 'done' | 'error';
  /** 分析出的模版（done 时存在） */
  template?: LayoutParamTemplate;
  /** 右侧 JSON 编辑器的当前文本（可手动编辑，与 template 解耦保存草稿） */
  draftJson: string;
  /** JSON 草稿是否解析失败（实时校验） */
  jsonError?: string;
  /** 错误信息（分析失败） */
  error?: string;
}

/** 分析输入硬上限：单次最多图片数（防止打爆模型并发）。 */
export const MAX_BATCH = 20;
