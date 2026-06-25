/**
 * 画风管理服务：列表 / 保存（新建+更新）/ 启停 / 删除 / 图标上传。
 *
 * 对接后台接口 /admin/api/style_prompts*（X-Admin-Token 鉴权，由反代层注入）：
 *   - GET  /admin/api/style_prompts             → { items: [...] }  全部未删画风（含停用）
 *   - POST /admin/api/style_prompts/save        → { ok, id }        id 空/"0" 新建，否则更新
 *   - POST /admin/api/style_prompts/toggle      → { ok }            启用/停用
 *   - POST /admin/api/style_prompts/delete      → { ok }            软删
 *   - POST /admin/api/style_prompts/upload_icon → StorageObject     multipart 图标上传（暂存）
 *
 * ⚠️ 这组接口是「裸 JSON + HTTP 状态码」风格（与 MoodPic 信封不同），统一走 arcaAdmin*。
 * 字段 snake_case 严格对齐文档，这里做 snake_case ↔ 驼峰映射。
 */

import type {
  StylePrompt,
  StylePromptStatus,
  StylePromptLanguage,
  StorageObject,
  SaveStylePromptInput,
} from '@/types/stylePrompt';
import { arcaAdmin, arcaAdminUpload } from './arcaClient';

const BASE = '/admin/api/style_prompts';

/** 后端列表项（snake_case 原样，id 为字符串）。 */
interface AdminStylePromptItem {
  id: string;
  style_name: string;
  style_prompt: string;
  priority: number;
  status: number;
  language: string;
  style_icon: string;
  created_at: string;
  updated_at: string;
}

interface ListResp {
  items: AdminStylePromptItem[] | null;
}

/** 归一语言字段（未知值按通用 "" 处理）。 */
function toLanguage(v: string): StylePromptLanguage {
  return v === 'ja' || v === 'ko' || v === 'en' ? v : '';
}

/** 契约 item → 前端 StylePrompt。 */
function toStylePrompt(it: AdminStylePromptItem): StylePrompt {
  return {
    id: it.id,
    styleName: it.style_name ?? '',
    styleIcon: it.style_icon ?? '',
    stylePrompt: it.style_prompt ?? '',
    priority: it.priority ?? 0,
    status: (it.status === 2 ? 2 : 1) as StylePromptStatus,
    language: toLanguage(it.language ?? ''),
    createdAt: it.created_at ?? '',
    updatedAt: it.updated_at ?? '',
  };
}

/**
 * 列出全部未删画风（含停用），后端按 priority DESC, id DESC。
 * GET /admin/api/style_prompts
 */
export async function listStylePrompts(signal?: AbortSignal): Promise<StylePrompt[]> {
  const data = await arcaAdmin<ListResp>(BASE, { method: 'GET', signal });
  return (data?.items ?? []).map(toStylePrompt);
}

/**
 * 保存画风（新建 / 更新）。id 空或 "0" → 新建；否则按 id 更新。
 * POST /admin/api/style_prompts/save → { ok, id }
 * 返回保存后的画风 id（字符串）。
 */
export async function saveStylePrompt(
  input: SaveStylePromptInput,
  signal?: AbortSignal,
): Promise<string> {
  const body: Record<string, unknown> = {
    id: input.id ?? '',
    style_name: input.styleName,
    style_prompt: input.stylePrompt,
    priority: input.priority,
    status: input.status,
    language: input.language,
  };
  // 仅本次换图时带 style_icon（后端只依赖 url，故只发 url 字段）；不传 = 保持原图标
  if (input.styleIcon) body.style_icon = { url: input.styleIcon.url };

  const data = await arcaAdmin<{ ok: boolean; id: string }>(`${BASE}/save`, {
    method: 'POST',
    body,
    signal,
  });
  return data?.id ?? input.id ?? '';
}

/**
 * 启用 / 停用画风。
 * POST /admin/api/style_prompts/toggle → { ok }
 */
export async function toggleStylePrompt(
  id: string,
  status: StylePromptStatus,
  signal?: AbortSignal,
): Promise<void> {
  await arcaAdmin<{ ok: boolean }>(`${BASE}/toggle`, {
    method: 'POST',
    body: { id, status },
    signal,
  });
}

/**
 * 删除画风（软删）。
 * POST /admin/api/style_prompts/delete → { ok }
 */
export async function deleteStylePrompt(id: string, signal?: AbortSignal): Promise<void> {
  await arcaAdmin<{ ok: boolean }>(`${BASE}/delete`, {
    method: 'POST',
    body: { id },
    signal,
  });
}

/**
 * 上传画风图标（暂存），返回 StorageObject。
 * 仅在 save 成功后图标才真正生效（把整个对象原样作为 save 的 style_icon 传回）。
 * POST /admin/api/style_prompts/upload_icon（multipart，字段名 file）
 */
export async function uploadStyleIcon(file: File, signal?: AbortSignal): Promise<StorageObject> {
  return arcaAdminUpload<StorageObject>(`${BASE}/upload_icon`, file, signal);
}
