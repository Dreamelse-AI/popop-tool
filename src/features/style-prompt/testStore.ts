/**
 * 画风生图测试 store（仅负责出图，不再持有画风字段）。
 *
 * 画风字段（名称/封面/prompt/优先级）由 editorStore 管理；
 * 出图时把「画风 prompt + 人物/其他提示词」拼接成最终 prompt，单/多张并发出图。
 * 出图复用 services/imageClient（apimart gpt-image-2），并发 worker 池同视觉资产引擎。
 */

import { create } from 'zustand';
import { generateImageByPrompt, ImageGenError } from '@/services/imageClient';

/** 并发上限，避免打爆 apimart。 */
const CONCURRENCY = 3;

type TestStatus = 'idle' | 'generating' | 'done' | 'error';
type ItemStatus = 'pending' | 'generating' | 'done' | 'error';

export interface TestResultItem {
  id: string;
  status: ItemStatus;
  /** 实际送去出图的完整 prompt。 */
  prompt: string;
  url?: string;
  error?: string;
}

interface StyleTestState {
  /** 人物 / 其他附加提示词（仅测试用，不入库）。 */
  extraPrompt: string;
  count: number;
  ratio: string;
  resolution: string;

  status: TestStatus;
  errorMessage: string | null;
  items: TestResultItem[];

  _abort: AbortController | null;

  setExtraPrompt: (v: string) => void;
  setCount: (n: number) => void;
  setRatio: (r: string) => void;
  setResolution: (r: string) => void;
  /** 用给定画风 prompt 出图（画风 prompt 由调用方从 editorStore 传入）。 */
  generate: (stylePrompt: string) => Promise<void>;
  retryItem: (id: string) => Promise<void>;
  cancel: () => void;
  reset: () => void;
}

/** 拼接最终 prompt：画风 + 附加提示词，去空后用逗号连接。 */
export function buildTestPrompt(stylePrompt: string, extra: string): string {
  return [stylePrompt.trim(), extra.trim()].filter(Boolean).join(', ');
}

export const useStyleTestStore = create<StyleTestState>((set, get) => ({
  extraPrompt: '',
  count: 1,
  ratio: '1:1',
  resolution: '1k',
  status: 'idle',
  errorMessage: null,
  items: [],
  _abort: null,

  setExtraPrompt: (v) => set({ extraPrompt: v }),
  setCount: (n) => set({ count: Math.max(1, Math.min(20, Math.floor(n) || 1)) }),
  setRatio: (ratio) => set({ ratio }),
  setResolution: (resolution) => set({ resolution }),

  generate: async (stylePrompt) => {
    get()._abort?.abort();
    const controller = new AbortController();
    const { extraPrompt, count, ratio, resolution } = get();

    const prompt = buildTestPrompt(stylePrompt, extraPrompt);
    if (!prompt) {
      set({ status: 'error', errorMessage: '请先填写画风 prompt 或提示词' });
      return;
    }

    const items: TestResultItem[] = Array.from({ length: count }, (_, i) => ({
      id: `${Date.now()}-${i}`,
      status: 'pending',
      prompt,
    }));
    set((s) => ({
      status: 'generating',
      errorMessage: null,
      items: [...items, ...s.items],
      _abort: controller,
    }));

    const update = (id: string, patch: Partial<TestResultItem>) => {
      if (get()._abort !== controller) return;
      set((s) => ({ items: s.items.map((it) => (it.id === id ? { ...it, ...patch } : it)) }));
    };

    let cursor = 0;
    const runOne = async (): Promise<void> => {
      while (true) {
        if (controller.signal.aborted) return;
        const idx = cursor++;
        if (idx >= items.length) return;
        const item = items[idx];
        update(item.id, { status: 'generating' });
        try {
          const image = await generateImageByPrompt(
            item.prompt,
            { size: ratio, resolution },
            controller.signal,
          );
          update(item.id, { status: 'done', url: image.url });
        } catch (e) {
          if (e instanceof DOMException && e.name === 'AbortError') return;
          const msg =
            e instanceof ImageGenError ? e.message : e instanceof Error ? e.message : '生成失败';
          update(item.id, { status: 'error', error: msg });
        }
      }
    };

    const workers = Array.from({ length: Math.min(CONCURRENCY, items.length) }, runOne);
    await Promise.all(workers);

    if (get()._abort === controller) set({ status: 'done', _abort: null });
  },

  retryItem: async (id) => {
    const target = get().items.find((it) => it.id === id);
    if (!target) return;
    const { ratio, resolution } = get();
    const controller = get()._abort ?? new AbortController();

    set((s) => ({
      items: s.items.map((it) =>
        it.id === id ? { ...it, status: 'generating', error: undefined } : it,
      ),
    }));
    try {
      const image = await generateImageByPrompt(
        target.prompt,
        { size: ratio, resolution },
        controller.signal,
      );
      set((s) => ({
        items: s.items.map((it) => (it.id === id ? { ...it, status: 'done', url: image.url } : it)),
      }));
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return;
      const msg = e instanceof Error ? e.message : '生成失败';
      set((s) => ({
        items: s.items.map((it) => (it.id === id ? { ...it, status: 'error', error: msg } : it)),
      }));
    }
  },

  cancel: () => {
    get()._abort?.abort();
    set({ status: 'idle', _abort: null });
  },

  reset: () => {
    get()._abort?.abort();
    set({
      extraPrompt: '',
      items: [],
      status: 'idle',
      errorMessage: null,
      _abort: null,
    });
  },
}));
