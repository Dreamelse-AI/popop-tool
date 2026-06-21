/**
 * 文字排版链路的核心契约类型。
 *
 * 链路：输入文字 → [结构抽取] → LayoutSchema → [模板渲染] → 3:4 文字图片
 *
 * LayoutSchema 是整条链路的稳定契约：
 * - 现阶段由前端 mock 规则生成（src/services/layoutExtractor）
 * - 后端接上后改为模型抽取，只换实现，调用方与渲染层不动
 */

/** 画布固定输出尺寸：3:4，1080 * 1440（导出像素） */
export const CANVAS_WIDTH = 1080;
export const CANVAS_HEIGHT = 1440;
export const CANVAS_RATIO = '3 / 4';

/** 输入文字硬上限（字符数） */
export const MAX_INPUT_LENGTH = 500;

/** 排版块的语义角色。模型抽取时按内容判定，渲染层按角色套样式。 */
export type BlockRole =
  | 'title' // 主标题
  | 'subtitle' // 副标题 / 引言
  | 'paragraph' // 正文段落
  | 'list' // 列表（要点）
  | 'quote' // 引用 / 金句
  | 'caption' // 落款 / 注脚
  | 'divider'; // 分隔符（无文字）

/** 单个排版块。 */
export interface LayoutBlock {
  id: string;
  role: BlockRole;
  /** 文字内容。divider 为空。list 用 items 承载。 */
  text?: string;
  /** list 角色的条目。 */
  items?: string[];
  /** 可选强调标记，渲染层可据此加重/变色。 */
  emphasis?: boolean;
}

/**
 * 结构抽取结果。这是后端要返回的稳定契约。
 */
export interface LayoutSchema {
  /** 抽取出的语义块序列。 */
  blocks: LayoutBlock[];
  /** 模型/规则推荐的模板 id（渲染层可被用户覆盖）。 */
  recommendedTemplateId: string;
  /** 整体气质标签，供模板做细节微调或前端展示。 */
  mood?: 'calm' | 'serious' | 'warm' | 'energetic' | 'minimal';
  /** 抽取来源，便于调试：mock 阶段为 'mock'，后端接上后为 'model'。 */
  source: 'mock' | 'model';
}

/** 结构抽取请求参数。 */
export interface ExtractLayoutInput {
  text: string;
  /** 可选：用户指定偏好的模板，抽取层可参考。 */
  preferredTemplateId?: string;
}
