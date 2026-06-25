/**
 * 情绪配色库前端类型契约。
 *
 * 存储方案（过渡期）：
 *   - 图片：上传 OSS 拿公开 url（复用画风封面同款能力，永久、公开可访问）
 *   - 表单元数据：后端独立接口就绪前，前端 localStorage 暂存（见 paletteClient.ts）
 */

/** 一套配色方案：各自独立命名 + 底色 + 字色 + 情绪词（两套方案平等）。 */
export interface PaletteScheme {
  /** 该方案的名字（≤4 字） */
  name: string;
  /** 背景：#色值 或 CSS 渐变字符串 */
  bgColor: string;
  /** 字体色：#色值 */
  fontColor: string;
  /** 该方案的情绪词 */
  mood: string;
}

/** 一条已存储的配色记录（含两套平等方案，供不同场景调用）。 */
export interface PaletteEntry {
  /** 英文连字符 id */
  id: string;
  /** 两套配色方案（各自命名、互换底/字、情绪词可不同） */
  schemes: PaletteScheme[];
  /** 从原图提取的主色板（hex 数组） */
  colors: string[];
  /** 原图公开访问地址（OSS url） */
  imageUrl: string;
  /** 创建时间 ISO */
  createdAt: string;
}

/** 列表响应。 */
export interface PaletteListResult {
  items: PaletteEntry[];
  total: number;
}

/** 保存入参（前端已完成主色提取 + 上传 OSS + AI 命名）。 */
export interface SavePaletteInput {
  id: string;
  schemes: PaletteScheme[];
  colors: string[];
  /** 原图公开 url（已上传 OSS） */
  imageUrl: string;
}

/**
 * 上传后、保存前的待确认草稿：
 * 提取主色 + 两套方案（各自命名）+ AI 命名结果，用户可在表单里改字段再保存。
 */
export interface PaletteDraft {
  id: string;
  schemes: PaletteScheme[];
  colors: string[];
  /** 原图本地预览用 data URL（保存时已先传 OSS 换成公开 url） */
  imageDataUrl: string;
}
