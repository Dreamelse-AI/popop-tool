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

/**
 * 接入开关（过渡期）。
 *   true  → 本地 localStorage 临时画风库（后端 internal 接口经公网网关 504、且后端将重搭新框架，先让前端跑通）
 *   false → 走真实 arca 接口（后端新框架/对外接口就绪后置 false 即可，UI 不动）
 */
const USE_MOCK = true;

// ==================== 本地 mock 实现（localStorage） ====================
const LOCAL_KEY = 'popop-style-prompt-library';

function readLocal(): StylePrompt[] {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    return raw ? (JSON.parse(raw) as StylePrompt[]) : [];
  } catch {
    return [];
  }
}

function writeLocal(items: StylePrompt[]): void {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(items));
  } catch {
    // 忽略写入失败（如配额满），不阻断主流程
  }
}

/** 按优先级降序、其次新创建在前。 */
function sortLocal(items: StylePrompt[]): StylePrompt[] {
  return [...items].sort((a, b) => b.priority - a.priority || b.id - a.id);
}

function listLocal(): StylePrompt[] {
  return sortLocal(readLocal());
}

function createLocal(input: CreateStylePromptInput): number {
  const now = new Date().toISOString();
  const id = Date.now();
  const item: StylePrompt = {
    id,
    styleName: input.styleName,
    styleIcon: input.styleIcon ?? '',
    stylePrompt: input.stylePrompt ?? '',
    priority: input.priority,
    status: 1,
    createdAt: now,
    updatedAt: now,
  };
  writeLocal([item, ...readLocal()]);
  return id;
}

function updateLocal(input: UpdateStylePromptInput): void {
  const now = new Date().toISOString();
  writeLocal(
    readLocal().map((it) =>
      it.id === input.id
        ? {
            ...it,
            styleName: input.styleName ?? it.styleName,
            styleIcon: input.styleIcon ?? it.styleIcon,
            stylePrompt: input.stylePrompt ?? it.stylePrompt,
            priority: input.priority ?? it.priority,
            updatedAt: now,
          }
        : it,
    ),
  );
}

function deleteLocal(id: number): void {
  writeLocal(readLocal().filter((it) => it.id !== id));
}

// ==================== arca 契约对接 ====================

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
  if (USE_MOCK) return listLocal();
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
  if (USE_MOCK) return createLocal(input);
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
  if (USE_MOCK) {
    updateLocal(input);
    return;
  }
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
  if (USE_MOCK) {
    deleteLocal(id);
    return;
  }
  await arcaPost<{ id: number }, Record<string, never>>(
    '/internal/ops/style_prompt/delete',
    { id },
    signal,
  );
}
