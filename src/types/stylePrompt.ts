/**
 * 画风（config_character_style_prompt 表）前端类型。
 *
 * 对接后台接口 /admin/api/style_prompts*（X-Admin-Token 鉴权，裸 JSON + HTTP 状态码）。
 * 后端字段 snake_case，这里映射成前端驼峰；service 层负责双向转换。
 */

/** 画风状态：1-启用，2-停用。 */
export type StylePromptStatus = 1 | 2;

/** 画风语言：""(通用) / ja / ko / en。 */
export type StylePromptLanguage = '' | 'ja' | 'ko' | 'en';

/**
 * 后端图标上传返回的存储对象（StorageObject）。
 * 整个对象原样回传给 save 的 style_icon 即可（后端实际只依赖 url）。
 */
export interface StorageObject {
  bucket_name: string;
  object_key: string;
  object_type: string;
  url: string;
  request_id?: string;
  description?: string | null;
}

/** 单条画风配置（前端用驼峰）。 */
export interface StylePrompt {
  /** 主键 ID（后端字符串下发，避免 JS 大整数精度丢失）。 */
  id: string;
  /** 画风名称（全局唯一，作为 i18n key）。 */
  styleName: string;
  /** 画风封面图 / icon 的签名直链；无图标为 ""。 */
  styleIcon: string;
  /** 画风 prompt 内容。 */
  stylePrompt: string;
  /** 优先级，越大越靠前。 */
  priority: number;
  /** 状态：1-启用，2-停用。 */
  status: StylePromptStatus;
  /** 语言：""(通用) / ja / ko / en。 */
  language: StylePromptLanguage;
  /** 创建时间（后端原样字符串）。 */
  createdAt: string;
  /** 更新时间（后端原样字符串）。 */
  updatedAt: string;
}

/**
 * 保存画风入参（新建 / 更新统一）。
 * id 空或 "0" → 新建；否则按 id 更新。
 * styleIcon 仅在本次换图时带（StorageObject）；不传 = 保持原图标。
 */
export interface SaveStylePromptInput {
  id?: string;
  styleName: string;
  stylePrompt: string;
  priority: number;
  status: StylePromptStatus;
  language: StylePromptLanguage;
  styleIcon?: StorageObject;
}
