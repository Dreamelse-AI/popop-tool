/**
 * 表情包提示词预设仓库（持久化到 localStorage）。
 *
 * 参照视觉资产引擎的 customStyleStore：用户自填名称 + 提示词，可保存、可修改、可删除。
 * 与 customStyleStore 的差异：本仓库提示词是「整条出图 prompt」（含风格/文案），
 * 且补上了「修改（updatePrompt）」能力。
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { StickerPrompt } from '@/types/sticker';

interface StickerPromptState {
  prompts: StickerPrompt[];
  /** 新增一条预设；name/prompt 必填，返回新建项 id；重名或空返回 null */
  addPrompt: (name: string, prompt: string) => string | null;
  /** 修改一条预设；name/prompt 必填，返回是否成功（重名或空则失败） */
  updatePrompt: (id: string, name: string, prompt: string) => boolean;
  /** 删除一条预设 */
  removePrompt: (id: string) => void;
}

/** 由名称派生稳定 id（小写连字符 + 时间戳后缀，避免改名后 id 漂移影响选中态）。 */
function makeId(name: string): string {
  const slug = name.trim().toLowerCase().replace(/\s+/g, '-').slice(0, 24);
  return `${slug || 'prompt'}-${Date.now().toString(36)}`;
}

/** 判断名称是否与其他预设重复（排除自身）。 */
function isDuplicateName(
  list: StickerPrompt[],
  name: string,
  excludeId?: string,
): boolean {
  const target = name.trim().toLowerCase();
  return list.some((p) => p.id !== excludeId && p.name.trim().toLowerCase() === target);
}

export const useStickerPromptStore = create<StickerPromptState>()(
  persist(
    (set, get) => ({
      prompts: [],

      addPrompt: (name, prompt) => {
        const trimmedName = name.trim();
        const trimmedPrompt = prompt.trim();
        if (!trimmedName || !trimmedPrompt) return null;
        if (isDuplicateName(get().prompts, trimmedName)) return null;
        const id = makeId(trimmedName);
        set((s) => ({
          prompts: [
            { id, name: trimmedName, prompt: trimmedPrompt, updatedAt: Date.now() },
            ...s.prompts,
          ],
        }));
        return id;
      },

      updatePrompt: (id, name, prompt) => {
        const trimmedName = name.trim();
        const trimmedPrompt = prompt.trim();
        if (!trimmedName || !trimmedPrompt) return false;
        if (isDuplicateName(get().prompts, trimmedName, id)) return false;
        set((s) => ({
          prompts: s.prompts.map((p) =>
            p.id === id
              ? { ...p, name: trimmedName, prompt: trimmedPrompt, updatedAt: Date.now() }
              : p,
          ),
        }));
        return true;
      },

      removePrompt: (id) =>
        set((s) => ({ prompts: s.prompts.filter((p) => p.id !== id) })),
    }),
    { name: 'popop-sticker-prompts' },
  ),
);
