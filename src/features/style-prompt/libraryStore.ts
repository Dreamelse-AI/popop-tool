/**
 * 画风库 store：列表 + 保存（新建/更新）+ 启停 + 删除。
 *
 * 数据走 services/stylePrompt（/admin/api/style_prompts*，X-Admin-Token 鉴权）。
 * 纯 Zustand + fetch（仓库无 React Query），列表用 status 驱动四态。
 */

import { create } from 'zustand';
import type { StylePrompt, StylePromptStatus, SaveStylePromptInput } from '@/types/stylePrompt';
import {
  listStylePrompts,
  saveStylePrompt,
  toggleStylePrompt,
  deleteStylePrompt,
} from '@/services/stylePrompt';

type ListStatus = 'idle' | 'loading' | 'done' | 'error';

interface StyleLibraryState {
  items: StylePrompt[];
  status: ListStatus;
  errorMessage: string | null;
  /** 正在执行写操作（保存/启停/删除）的提交态，禁用按钮防重复提交。 */
  submitting: boolean;

  load: () => Promise<void>;
  /** 保存（新建/更新），返回保存后的 id；失败返回 null。 */
  save: (input: SaveStylePromptInput) => Promise<string | null>;
  /** 启用/停用某条画风。 */
  toggle: (id: string, status: StylePromptStatus) => Promise<boolean>;
  /** 删除某条画风。 */
  remove: (id: string) => Promise<boolean>;
}

export const useStyleLibraryStore = create<StyleLibraryState>((set, get) => ({
  items: [],
  status: 'idle',
  errorMessage: null,
  submitting: false,

  load: async () => {
    set({ status: 'loading', errorMessage: null });
    try {
      const items = await listStylePrompts();
      set({ items, status: 'done' });
    } catch (e) {
      const msg = e instanceof Error ? e.message : '加载画风列表失败';
      set({ status: 'error', errorMessage: msg });
    }
  },

  save: async (input) => {
    set({ submitting: true, errorMessage: null });
    try {
      const id = await saveStylePrompt(input);
      await get().load();
      return id;
    } catch (e) {
      set({ errorMessage: e instanceof Error ? e.message : '保存画风失败' });
      return null;
    } finally {
      set({ submitting: false });
    }
  },

  toggle: async (id, status) => {
    set({ submitting: true, errorMessage: null });
    try {
      await toggleStylePrompt(id, status);
      set((s) => ({ items: s.items.map((it) => (it.id === id ? { ...it, status } : it)) }));
      return true;
    } catch (e) {
      set({ errorMessage: e instanceof Error ? e.message : '操作失败' });
      return false;
    } finally {
      set({ submitting: false });
    }
  },

  remove: async (id) => {
    set({ submitting: true, errorMessage: null });
    try {
      await deleteStylePrompt(id);
      set((s) => ({ items: s.items.filter((it) => it.id !== id) }));
      return true;
    } catch (e) {
      set({ errorMessage: e instanceof Error ? e.message : '删除画风失败' });
      return false;
    } finally {
      set({ submitting: false });
    }
  },
}));
