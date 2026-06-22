/**
 * Visual Asset Production Engine v1 的核心契约类型。
 *
 * 五层：Emotion（情绪，主驱动）/ Subject（主体，当前锁 None）/ Type（类型，决定 DNA）
 *      / DNA（内容元素，字段集随 Type 变）/ Style（风格，prompt 展开后注入，当前全局单一）。
 *
 * 链路：三态选择 → [生成引擎随机展开 N 条结构化配置] → [扩写模型展开成 prompt]
 *      → [apimart 出图]。
 *
 * 规格关键点（来自需求文档）：
 *   - 输出结构化配置 { emotion, subject, type, style, dna }，不在此层生成 prompt
 *   - Subject 当前阶段固定 'None'
 *   - Type 决定 DNA 用哪一套字段
 *   - Optional 字段（weather/season）按需使用，不随机强加
 */

/** 图像类型：决定 DNA 字段集。 */
export type AssetType = 'abstract' | 'landscape' | 'environment';

/** 单个选项的统一元信息（UI 渲染 + 随机抽取 + prompt 拼装共用）。 */
export interface AssetOption {
  id: string;
  /** 英文名（展示 + mock 拼 prompt 用） */
  name: string;
  /** 中文标签（卡片副标题，可选） */
  label?: string;
  /** 注入 prompt 的英文片段；缺省时用 name */
  promptFragment?: string;
}

/** DNA 单个字段定义：字段 key + 展示名 + 选项 + 是否可选。 */
export interface DnaField {
  key: string;
  name: string;
  options: AssetOption[];
  /** 可选字段（如 weather/season）：不选则不加入配置，不参与随机强加 */
  optional?: boolean;
}

/** 某个 Type 对应的 DNA schema（有序字段列表）。 */
export interface DnaSchema {
  type: AssetType;
  fields: DnaField[];
}

/**
 * 三态选择：每个维度存字符串数组。
 *   []        → 不选 → 全域随机
 *   ['x']     → 锁定
 *   ['x','y'] → 限定随机（在选中里随机）
 */
export type TriStateSelection = string[];

/** 工具的整体选择状态。 */
export interface VisualAssetSelection {
  emotion: TriStateSelection;
  subject: TriStateSelection;
  type: TriStateSelection;
  style: TriStateSelection;
  /** DNA 各字段的三态选择，key 为 DnaField.key */
  dna: Record<string, TriStateSelection>;
}

/** 输出图片比例（apimart size 字段）。 */
export type AspectRatio = '9:16' | '3:4' | '1:1' | '4:3' | '16:9' | '2:3' | '3:2';

/** 输出分辨率档位（apimart resolution 字段，小写）。 */
export type Resolution = '1k' | '2k' | '4k';

/**
 * 生成引擎产出的单条结构化配置（即规格的 Output Format）。
 * dna 的值是各字段选中的【单个】option id（已由随机/锁定解析为确定值）。
 */
export interface AssetConfig {
  emotion: string;
  /** 主体 option id（'none' 表示无明确主体） */
  subject: string;
  type: AssetType;
  /** 风格 pack 的 option id */
  style: string;
  dna: Record<string, string>;
}

/** 批量生成的整体参数。 */
export interface GenerateParams {
  selection: VisualAssetSelection;
  count: number;
  ratio: AspectRatio;
  resolution: Resolution;
}

/** 单张生成结果项（含其来源配置，便于回看/复现）。 */
export type AssetItemStatus = 'pending' | 'generating' | 'done' | 'error';

export interface AssetResultItem {
  id: string;
  config: AssetConfig;
  /** 实际送去出图的 prompt（扩写后） */
  prompt: string;
  status: AssetItemStatus;
  /** 成功后的图片直链 */
  url?: string;
  /** 失败原因 */
  error?: string;
}
