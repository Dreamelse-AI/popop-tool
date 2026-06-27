/**
 * 情绪配色库前端类型契约。
 *
 * 方案：纯前端本地识别 → 草稿编辑 → 导出 CSV 色值表下载。
 * 不依赖任何服务器存储（无 OSS、无 localStorage、无后端表单接口）。
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

/**
 * 一条待确认/可导出的配色草稿：
 * 提取主色 + 两套方案（各自命名）+ AI 命名结果，用户可在表单里改字段再导出。
 */
export interface PaletteDraft {
  id: string;
  schemes: PaletteScheme[];
  colors: string[];
  /** 原图本地预览用 data URL（仅本地展示/取色，不上传） */
  imageDataUrl: string;
}
