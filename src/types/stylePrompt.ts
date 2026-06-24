/**
 * 画风（config_character_style_prompt 表）前端类型。
 *
 * 对应 arca.api 运营侧画风配置接口：OpsStylePromptItem。
 * 后端字段 snake_case，这里映射成前端驼峰；service 层负责双向转换。
 */

/** 画风状态：1-有效，2-失效。 */
export type StylePromptStatus = 1 | 2;

/** 单条画风配置（前端用驼峰）。 */
export interface StylePrompt {
  /** 主键 ID（后端自增 int64，未超 2^53 安全范围，用 number 承载）。 */
  id: number;
  /** 画风名称。 */
  styleName: string;
  /** 画风封面图 / icon 的 URL（复用作封面图）。 */
  styleIcon: string;
  /** 画风 prompt 内容。 */
  stylePrompt: string;
  /** 优先级，越大越靠前。 */
  priority: number;
  /** 状态：1-有效，2-失效。 */
  status: StylePromptStatus;
  /** 创建时间（后端原样字符串）。 */
  createdAt: string;
  /** 更新时间（后端原样字符串）。 */
  updatedAt: string;
}

/** 新增画风入参（前端驼峰）。 */
export interface CreateStylePromptInput {
  styleName: string;
  styleIcon?: string;
  stylePrompt?: string;
  priority: number;
}

/** 修改画风入参（前端驼峰，除 id 外均可选）。 */
export interface UpdateStylePromptInput {
  id: number;
  styleName?: string;
  styleIcon?: string;
  stylePrompt?: string;
  priority?: number;
}
