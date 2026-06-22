import { create } from 'zustand';
import type {
  VisualAssetSelection,
  AspectRatio,
  Resolution,
  AssetResultItem,
} from '@/types/visualAsset';
import { generateConfigs } from '@/services/visualAssetEngine';
import { expandToPrompt } from '@/services/promptExpander';
import { generateImageByPrompt, ImageGenError } from '@/services/imageClient';
import { useCustomStyleStore } from './customStyleStore';

/** 批量生成的并发上限（小并发，避免打爆 apimart）。 */
const CONCURRENCY = 3;

type Status = 'idle' | 'generating' | 'done' | 'error';

interface VisualAssetState {
  selection: VisualAssetSelection;
  count: number;
  ratio: AspectRatio;
  resolution: Resolution;

  status: Status;
  errorMessage: string | null;
  items: AssetResultItem[];

  _abort: AbortController | null;

  /** 切换某维度某选项的三态选中（点一下加入/移除） */
  toggle: (dimension: string, id: string) => void;
  /** 清空某维度选择（回到全随机） */
  clearDimension: (dimension: string) => void;
  setCount: (n: number) => void;
  setRatio: (r: AspectRatio) => void;
  setResolution: (r: Resolution) => void;
  applySelection: (sel: VisualAssetSelection) => void;
  generate: () => Promise<void>;
  /** 重试单条结果项（重新扩写并出图，配置不变） */
  retryItem: (id: string) => Promise<void>;
  cancel: () => void;
  reset: () => void;
}

// [TOGGLE_HELPERS]
/** 读取某维度当前选中数组（emotion/type 顶层，其余视为 dna 字段）。 */
function readDim(sel: VisualAssetSelection, dim: string): string[] {
  if (dim === 'emotion') return sel.emotion;
  if (dim === 'subject') return sel.subject;
  if (dim === 'type') return sel.type;
  if (dim === 'style') return sel.style;
  return sel.dna[dim] ?? [];
}

/** 返回写入某维度新数组后的 selection（不可变更新）。 */
function writeDim(
  sel: VisualAssetSelection,
  dim: string,
  next: string[],
): VisualAssetSelection {
  if (dim === 'emotion') return { ...sel, emotion: next };
  if (dim === 'subject') return { ...sel, subject: next };
  if (dim === 'type') return { ...sel, type: next };
  if (dim === 'style') return { ...sel, style: next };
  return { ...sel, dna: { ...sel.dna, [dim]: next } };
}

/** 初始空选择（全维度全随机）。 */
const EMPTY_SELECTION: VisualAssetSelection = {
  emotion: [],
  subject: [],
  type: [],
  style: [],
  dna: {},
};

export const useVisualAssetStore = create<VisualAssetState>((set, get) => ({
  selection: { ...EMPTY_SELECTION },
  count: 4,
  ratio: '9:16',
  resolution: '2k',
  status: 'idle',
  errorMessage: null,
  items: [],
  _abort: null,

  // [ACTIONS]
  toggle: (dimension, id) =>
    set((s) => {
      const cur = readDim(s.selection, dimension);
      const next = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id];
      return { selection: writeDim(s.selection, dimension, next) };
    }),

  clearDimension: (dimension) =>
    set((s) => ({ selection: writeDim(s.selection, dimension, []) })),

  setCount: (n) => set({ count: Math.max(1, Math.min(50, Math.floor(n) || 1)) }),
  setRatio: (ratio) => set({ ratio }),
  setResolution: (resolution) => set({ resolution }),
  applySelection: (selection) => set({ selection: { ...selection } }),
  // [GENERATE]
  generate: async () => {
    get()._abort?.abort();
    const controller = new AbortController();
    const { selection, count, ratio, resolution } = get();
    const styles = useCustomStyleStore.getState().styles;

    const configs = generateConfigs(selection, count, styles.map((s) => s.id));
    if (configs.length === 0) {
      set({ status: 'error', errorMessage: '没有可生成的组合，请调整选择' });
      return;
    }

    // 初始化结果项（pending）
    const items: AssetResultItem[] = configs.map((config, i) => ({
      id: `${Date.now()}-${i}`,
      config,
      prompt: '',
      status: 'pending',
    }));
    set({ status: 'generating', errorMessage: null, items, _abort: controller });

    /** 更新单条结果项。 */
    const update = (id: string, patch: Partial<AssetResultItem>) => {
      if (get()._abort !== controller) return;
      set((s) => ({
        items: s.items.map((it) => (it.id === id ? { ...it, ...patch } : it)),
      }));
    };
    // [WORKER]
    // 小并发 worker 池：每个 worker 依次领取下一个待处理项
    let cursor = 0;
    const runOne = async (): Promise<void> => {
      while (true) {
        if (controller.signal.aborted) return;
        const idx = cursor++;
        if (idx >= items.length) return;
        const item = items[idx];
        update(item.id, { status: 'generating' });
        try {
          const prompt = await expandToPrompt(item.config, styles, controller.signal);
          const image = await generateImageByPrompt(
            prompt,
            { size: ratio, resolution },
            controller.signal,
          );
          update(item.id, { status: 'done', prompt, url: image.url });
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

    if (get()._abort === controller) {
      set({ status: 'done', _abort: null });
    }
  },
  // [RETRY]
  retryItem: async (id) => {
    const target = get().items.find((it) => it.id === id);
    if (!target) return;
    const { ratio, resolution } = get();
    const styles = useCustomStyleStore.getState().styles;
    const controller = get()._abort ?? new AbortController();

    set((s) => ({
      items: s.items.map((it) =>
        it.id === id ? { ...it, status: 'generating', error: undefined } : it,
      ),
    }));

    try {
      const prompt = await expandToPrompt(target.config, styles, controller.signal);
      const image = await generateImageByPrompt(prompt, { size: ratio, resolution }, controller.signal);
      set((s) => ({
        items: s.items.map((it) =>
          it.id === id ? { ...it, status: 'done', prompt, url: image.url } : it,
        ),
      }));
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return;
      const msg = e instanceof ImageGenError ? e.message : e instanceof Error ? e.message : '生成失败';
      set((s) => ({
        items: s.items.map((it) => (it.id === id ? { ...it, status: 'error', error: msg } : it)),
      }));
    }
  },
  // [CANCEL]
  cancel: () => {
    get()._abort?.abort();
    set({ status: 'idle', _abort: null });
  },

  reset: () => {
    get()._abort?.abort();
    set({
      selection: { ...EMPTY_SELECTION },
      count: 4,
      ratio: '9:16',
      resolution: '2k',
      status: 'idle',
      errorMessage: null,
      items: [],
      _abort: null,
    });
  },
}));
