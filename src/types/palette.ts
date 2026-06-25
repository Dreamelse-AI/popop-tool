/**
 * 配色情绪库前端类型契约。
 *
 * 对应服务端 server/paletteStore.ts 的 PaletteRecord（camelCase 一致，路由层不做转换）。
 */

/** 一条已永久存储的配色记录。 */
export interface PaletteEntry {
  /** 英文连字符 id */
  id: string;
  /** 名字（≤4 字） */
  name: string;
  /** 情绪词 */
  mood: string;
  /** 背景：#色值 或 CSS 渐变字符串 */
  bgColor: string;
  /** 字体色：#色值 */
  fontColor: string;
  /** 从原图提取的主色板（hex 数组） */
  colors: string[];
  /** 原图访问地址（同源 /api/palette/image/<file>） */
  imageUrl: string;
  /** 创建时间 ISO */
  createdAt: string;
}

/** 列表响应。 */
export interface PaletteListResult {
  items: PaletteEntry[];
  total: number;
}

/** 保存入参（前端已完成主色提取 + AI 命名）。 */
export interface SavePaletteInput {
  id: string;
  name: string;
  mood: string;
  bgColor: string;
  fontColor: string;
  colors: string[];
  /** 原图 base64 data URL */
  imageDataUrl: string;
}

/**
 * 上传后、保存前的待确认草稿：
 * 提取主色 + AI 命名结果，用户可在表单里改字段再保存。
 */
export interface PaletteDraft {
  id: string;
  name: string;
  mood: string;
  bgColor: string;
  fontColor: string;
  colors: string[];
  imageDataUrl: string;
}
