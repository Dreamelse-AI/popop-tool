/**
 * 批量名字生成图片 store。
 *
 * 把「基础元素（空行分隔的多个内容）× 题材类型 × 风格提示词」组合成每个内容一条
 * 出图任务，可选交给模型整理扩写后批量并发出图。展示整体进度，支持单条重试、
 * 单张/批量下载、单条/批量删除。
 *
 * 出图复用 services/imageClient（apimart gpt-image-2），并发 worker 池与
 * 视觉资产引擎一致；扩写复用 services/textPromptExpander。
 */

import { create } from 'zustand';
import { generateImageByPrompt, ImageGenError } from '@/services/imageClient';
import {
  expandTextToPrompt,
  joinParts,
  type ExpandVia,
} from '@/services/textPromptExpander';

/** 批量生成的默认并发上限（小并发，避免打爆 apimart）。 */
const DEFAULT_CONCURRENCY = 3;
const MIN_CONCURRENCY = 1;
const MAX_CONCURRENCY = 8;
/** 单张出图失败的自动重试次数（瞬时错误退避重试）。 */
const AUTO_RETRY_MAX = 2;
/** 一批可生成的内容条数上限。 */
const MAX_ITEMS = 200;

type Status = 'idle' | 'generating' | 'done' | 'error';
type ItemStatus = 'pending' | 'generating' | 'done' | 'error';
/** 单条所处阶段：扩写中 / 出图中。 */
type ItemPhase = 'expanding' | 'imaging';

export interface NameImageItem {
  id: string;
  /** 该条对应的基础元素原文。 */
  element: string;
  status: ItemStatus;
  phase?: ItemPhase;
  /** 实际送去出图的完整 prompt。 */
  prompt: string;
  /** 扩写来源标记（AI 扩写 / 本地兜底）。 */
  expandedVia?: ExpandVia;
  url?: string;
  error?: string;
}

interface NameImageState {
  /** 基础元素输入框原文（空行分隔多个内容）。 */
  elementsText: string;
  /** 题材类型（如人物形象、音乐封面）。 */
  subject: string;
  /** 风格提示词。 */
  style: string;
  /** 输出比例（默认 1:1）。 */
  ratio: string;
  resolution: string;
  /** 是否交给模型整理扩写。 */
  useExpander: boolean;
  concurrency: number;

  status: Status;
  errorMessage: string | null;
  items: NameImageItem[];

  _abort: AbortController | null;

  setElementsText: (v: string) => void;
  setSubject: (v: string) => void;
  setStyle: (v: string) => void;
  setRatio: (r: string) => void;
  setResolution: (r: string) => void;
  setUseExpander: (v: boolean) => void;
  setConcurrency: (n: number) => void;

  generate: () => Promise<void>;
  retryItem: (id: string) => Promise<void>;
  retryAllFailed: () => Promise<void>;
  removeItem: (id: string) => void;
  /** 清空所有结果。 */
  clearItems: () => void;
  cancel: () => void;
  reset: () => void;
}

/** 把输入框文本按空行拆成多个基础元素（去空、去重保序）。 */
export function parseElements(text: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const block of text.split(/\n\s*\n/)) {
    const v = block.trim();
    if (!v || seen.has(v)) continue;
    seen.add(v);
    out.push(v);
  }
  return out;
}

/** 判断是否瞬时错误（可自动重试）：网关繁忙 / 超时 / 网络抖动。 */
function isTransientError(e: unknown): boolean {
  if (e instanceof ImageGenError) {
    if (e.status && e.status >= 500) return true;
    return /超时|繁忙|暂时不可用|网络/.test(e.message);
  }
  return e instanceof Error && /超时|繁忙|网络|timeout|network/i.test(e.message);
}

function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(t);
        reject(new DOMException('aborted', 'AbortError'));
      },
      { once: true },
    );
  });
}

export const useNameImageStore = create<NameImageState>((set, get) => ({
  elementsText: '',
  subject: '',
  style: '',
  ratio: '1:1',
  resolution: '1k',
  useExpander: true,
  concurrency: DEFAULT_CONCURRENCY,

  status: 'idle',
  errorMessage: null,
  items: [],
  _abort: null,

  setElementsText: (v) => set({ elementsText: v }),
  setSubject: (v) => set({ subject: v }),
  setStyle: (v) => set({ style: v }),
  setRatio: (ratio) => set({ ratio }),
  setResolution: (resolution) => set({ resolution }),
  setUseExpander: (useExpander) => set({ useExpander }),
  setConcurrency: (n) =>
    set({
      concurrency: Math.max(
        MIN_CONCURRENCY,
        Math.min(MAX_CONCURRENCY, Math.floor(n) || DEFAULT_CONCURRENCY),
      ),
    }),

  generate: async () => {
    get()._abort?.abort();
    const controller = new AbortController();
    const { elementsText, subject, style, ratio, resolution, useExpander, concurrency } = get();

    const elements = parseElements(elementsText);
    if (elements.length === 0) {
      set({ status: 'error', errorMessage: '请先在左侧填写至少一个基础元素（用空行分隔多个）' });
      return;
    }
    if (elements.length > MAX_ITEMS) {
      set({ status: 'error', errorMessage: `一批最多 ${MAX_ITEMS} 个内容，当前 ${elements.length} 个` });
      return;
    }

    const batchTs = Date.now();
    const items: NameImageItem[] = elements.map((element, i) => ({
      id: `${batchTs}-${i}`,
      element,
      status: 'pending',
      prompt: '',
    }));
    // 累加在已有结果之前，不顶掉上一批
    set((s) => ({
      status: 'generating',
      errorMessage: null,
      items: [...items, ...s.items],
      _abort: controller,
    }));

    const update = (id: string, patch: Partial<NameImageItem>) => {
      if (get()._abort !== controller) return;
      set((s) => ({ items: s.items.map((it) => (it.id === id ? { ...it, ...patch } : it)) }));
    };

    // 单条：整理扩写 → 出图，带瞬时错误自动退避重试
    const produceOne = async (item: NameImageItem): Promise<void> => {
      update(item.id, { status: 'generating', phase: 'expanding', error: undefined });
      for (let attempt = 0; attempt <= AUTO_RETRY_MAX; attempt++) {
        if (controller.signal.aborted) return;
        try {
          update(item.id, { status: 'generating', phase: 'expanding' });
          const { prompt, via } = await expandTextToPrompt(
            { element: item.element, subject, style },
            useExpander,
            controller.signal,
          );
          update(item.id, { prompt, expandedVia: via, phase: 'imaging' });
          const image = await generateImageByPrompt(prompt, { size: ratio, resolution }, controller.signal);
          update(item.id, { status: 'done', phase: undefined, url: image.url });
          return;
        } catch (e) {
          if (e instanceof DOMException && e.name === 'AbortError') return;
          const last = attempt === AUTO_RETRY_MAX;
          if (!last && isTransientError(e)) {
            update(item.id, { status: 'generating', error: undefined });
            try {
              await delay(1000 * (attempt + 1), controller.signal);
            } catch {
              return;
            }
            continue;
          }
          const msg =
            e instanceof ImageGenError ? e.message : e instanceof Error ? e.message : '生成失败';
          update(item.id, { status: 'error', phase: undefined, error: msg });
          return;
        }
      }
    };

    // 小并发 worker 池：每个 worker 依次领取下一个待处理项
    let cursor = 0;
    const runOne = async (): Promise<void> => {
      while (true) {
        if (controller.signal.aborted) return;
        const idx = cursor++;
        if (idx >= items.length) return;
        await produceOne(items[idx]);
      }
    };

    const poolSize = Math.min(Math.max(1, concurrency), items.length);
    const workers = Array.from({ length: poolSize }, runOne);
    await Promise.all(workers);

    if (get()._abort === controller) {
      set({ status: 'done', _abort: null });
    }
  },

  retryItem: async (id) => {
    const target = get().items.find((it) => it.id === id);
    if (!target) return;
    const { subject, style, ratio, resolution, useExpander } = get();
    const controller = get()._abort ?? new AbortController();

    set((s) => ({
      items: s.items.map((it) =>
        it.id === id ? { ...it, status: 'generating', phase: 'expanding', error: undefined } : it,
      ),
    }));

    try {
      const { prompt, via } = await expandTextToPrompt(
        { element: target.element, subject, style },
        useExpander,
        controller.signal,
      );
      set((s) => ({
        items: s.items.map((it) =>
          it.id === id ? { ...it, prompt, expandedVia: via, phase: 'imaging' } : it,
        ),
      }));
      const image = await generateImageByPrompt(prompt, { size: ratio, resolution }, controller.signal);
      set((s) => ({
        items: s.items.map((it) =>
          it.id === id ? { ...it, status: 'done', phase: undefined, url: image.url } : it,
        ),
      }));
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return;
      const msg = e instanceof ImageGenError ? e.message : e instanceof Error ? e.message : '生成失败';
      set((s) => ({
        items: s.items.map((it) =>
          it.id === id ? { ...it, status: 'error', phase: undefined, error: msg } : it,
        ),
      }));
    }
  },

  retryAllFailed: async () => {
    const failedIds = get().items.filter((it) => it.status === 'error').map((it) => it.id);
    for (const id of failedIds) {
      await get().retryItem(id);
    }
  },

  removeItem: (id) => set((s) => ({ items: s.items.filter((it) => it.id !== id) })),

  clearItems: () => set({ items: [], status: 'idle', errorMessage: null }),

  cancel: () => {
    get()._abort?.abort();
    set({ status: 'idle', _abort: null });
  },

  reset: () => {
    get()._abort?.abort();
    set({
      elementsText: '',
      subject: '',
      style: '',
      ratio: '1:1',
      resolution: '1k',
      useExpander: true,
      concurrency: DEFAULT_CONCURRENCY,
      status: 'idle',
      errorMessage: null,
      items: [],
      _abort: null,
    });
  },
}));

/** 给 UI 预览用：拼接（不扩写）后的完整 prompt 示例。 */
export function previewJoinedPrompt(element: string, subject: string, style: string): string {
  return joinParts({ element, subject, style });
}
