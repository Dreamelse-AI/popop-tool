/**
 * 画风库 store：列表 + 增 / 改 / 删。
 *
 * 数据走 services/stylePrompt（arca /internal/ops/style_prompt/*）。
 * 纯 Zustand + fetch（仓库无 React Query），列表用 status 驱动四态。
 */

import { create } from 'zustand';
import type {
  StylePrompt,
  CreateStylePromptInput,
  UpdateStylePromptInput,
} from '@/types/stylePrompt';
import {
  listStylePrompts,
  createStylePrompt,
  updateStylePrompt,
  deleteStylePrompt,
} from '@/services/stylePrompt';

type ListStatus = 'idle' | 'loading' | 'done' | 'error';

interface StyleLibraryState {
  items: StylePrompt[];
  status: ListStatus;
  errorMessage: string | null;
  /** 正在执行写操作（增改删）的提交态，禁用按钮防重复提交。 */
  submitting: boolean;

  load: () => Promise<void>;
  create: (input: CreateStylePromptInput) => Promise<boolean>;
  update: (input: UpdateStylePromptInput) => Promise<boolean>;
  remove: (id: number) => Promise<boolean>;
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

  create: async (input) => {
    set({ submitting: true });
    try {
      await createStylePrompt(input);
      await get().load();
      return true;
    } catch (e) {
      set({ errorMessage: e instanceof Error ? e.message : '新增画风失败' });
      return false;
    } finally {
      set({ submitting: false });
    }
  },

  update: async (input) => {
    set({ submitting: true });
    try {
      await updateStylePrompt(input);
      await get().load();
      return true;
    } catch (e) {
      set({ errorMessage: e instanceof Error ? e.message : '修改画风失败' });
      return false;
    } finally {
      set({ submitting: false });
    }
  },

  remove: async (id) => {
    set({ submitting: true });
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
