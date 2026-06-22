/**
 * 用户自定义 Style pack 仓库（持久化到 localStorage）。
 *
 * Style 不再预置默认值，完全由用户自己填：名称 + 提示词，可保存可删除。
 * 生成引擎与扩写器通过 store 拿到当前 style 列表（AssetOption[]）参与三态随机与 prompt 注入。
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AssetOption } from '@/types/visualAsset';

interface CustomStyleState {
  styles: AssetOption[];
  /** 新增一个 style pack；name/prompt 必填，返回是否成功（重名或空则失败） */
  addStyle: (name: string, prompt: string) => boolean;
  removeStyle: (id: string) => void;
}

/** 由名称派生稳定 id（小写连字符）。 */
function toId(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, '-');
}

export const useCustomStyleStore = create<CustomStyleState>()(
  persist(
    (set, get) => ({
      styles: [],
      addStyle: (name, prompt) => {
        const trimmedName = name.trim();
        const trimmedPrompt = prompt.trim();
        if (!trimmedName || !trimmedPrompt) return false;
        const id = toId(trimmedName);
        if (get().styles.some((s) => s.id === id)) return false; // 重名
        set((s) => ({
          styles: [...s.styles, { id, name: trimmedName, promptFragment: trimmedPrompt }],
        }));
        return true;
      },
      removeStyle: (id) =>
        set((s) => ({ styles: s.styles.filter((x) => x.id !== id) })),
    }),
    { name: 'popop-visual-asset-styles' },
  ),
);
