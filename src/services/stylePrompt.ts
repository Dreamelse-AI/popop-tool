/**
 * 画风配置服务：列表 / 新增 / 修改 / 删除。
 *
 * 对接 arca.api 运营侧画风配置接口（@server group: internal_ops，无 JWT 鉴权）：
 *   - POST /internal/ops/style_prompt/list   → ListStylePromptResp
 *   - POST /internal/ops/style_prompt/create → CreateStylePromptResp
 *   - POST /internal/ops/style_prompt/update → UpdateStylePromptResp（空）
 *   - POST /internal/ops/style_prompt/delete → DeleteStylePromptResp（空）
 *
 * 数据源：dreamelse.config_character_style_prompt 表。
 * 字段 snake_case 严格对齐 .api，这里做 snake_case ↔ 驼峰映射。
 * 走统一封装 arcaPost（同源 /arca 反代，解 {code,msg,data} 信封）。
 */

import type {
  StylePrompt,
  StylePromptStatus,
  CreateStylePromptInput,
  UpdateStylePromptInput,
} from '@/types/stylePrompt';
import { arcaPost } from './arcaClient';

/** arca 契约：OpsStylePromptItem（snake_case 原样）。 */
interface OpsStylePromptItem {
  id: number;
  style_name: string;
  style_icon: string;
  style_prompt: string;
  priority: number;
  status: number;
  created_at: string;
  updated_at: string;
}

interface ListStylePromptResp {
  items: OpsStylePromptItem[] | null;
}

/** 契约 item → 前端 StylePrompt。 */
function toStylePrompt(it: OpsStylePromptItem): StylePrompt {
  return {
    id: it.id,
    styleName: it.style_name ?? '',
    styleIcon: it.style_icon ?? '',
    stylePrompt: it.style_prompt ?? '',
    priority: it.priority ?? 0,
    status: (it.status === 2 ? 2 : 1) as StylePromptStatus,
    createdAt: it.created_at ?? '',
    updatedAt: it.updated_at ?? '',
  };
}

/**
 * 列出全部画风（后端按优先级降序）。
 * 对应：POST /internal/ops/style_prompt/list
 */
export async function listStylePrompts(signal?: AbortSignal): Promise<StylePrompt[]> {
  const data = await arcaPost<Record<string, never>, ListStylePromptResp>(
    '/internal/ops/style_prompt/list',
    {},
    signal,
  );
  return (data.items ?? []).map(toStylePrompt);
}

/**
 * 新增画风，返回新建 ID。
 * 对应：POST /internal/ops/style_prompt/create（CreateStylePromptReq）
 */
export async function createStylePrompt(
  input: CreateStylePromptInput,
  signal?: AbortSignal,
): Promise<number> {
  const data = await arcaPost<
    {
      style_name: string;
      style_icon: string;
      style_prompt: string;
      priority: number;
    },
    { id: number }
  >(
    '/internal/ops/style_prompt/create',
    {
      style_name: input.styleName,
      style_icon: input.styleIcon ?? '',
      style_prompt: input.stylePrompt ?? '',
      priority: input.priority,
    },
    signal,
  );
  return data.id;
}

/**
 * 修改画风（除 id 外字段可选，仅传需要改的）。
 * 对应：POST /internal/ops/style_prompt/update（UpdateStylePromptReq）
 */
export async function updateStylePrompt(
  input: UpdateStylePromptInput,
  signal?: AbortSignal,
): Promise<void> {
  const body: Record<string, unknown> = { id: input.id };
  if (input.styleName !== undefined) body.style_name = input.styleName;
  if (input.styleIcon !== undefined) body.style_icon = input.styleIcon;
  if (input.stylePrompt !== undefined) body.style_prompt = input.stylePrompt;
  if (input.priority !== undefined) body.priority = input.priority;
  await arcaPost<Record<string, unknown>, Record<string, never>>(
    '/internal/ops/style_prompt/update',
    body,
    signal,
  );
}

/**
 * 删除画风。
 * 对应：POST /internal/ops/style_prompt/delete（DeleteStylePromptReq）
 */
export async function deleteStylePrompt(id: number, signal?: AbortSignal): Promise<void> {
  await arcaPost<{ id: number }, Record<string, never>>(
    '/internal/ops/style_prompt/delete',
    { id },
    signal,
  );
}
