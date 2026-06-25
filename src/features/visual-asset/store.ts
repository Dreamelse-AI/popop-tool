import { create } from 'zustand';
import type {
  VisualAssetSelection,
  AspectRatio,
  Resolution,
  AssetResultItem,
} from '@/types/visualAsset';
import { generateConfigs } from '@/services/visualAssetEngine';
import { expandToPrompt } from '@/services/promptExpander';
import {
  appendOutputSpecToPrompt,
  generateImageByPrompt,
  ImageGenError,
  resolveOutputSpec,
} from '@/services/imageClient';
import { saveMoodPic } from '@/services/moodpicGallery';
import { useCustomStyleStore } from './customStyleStore';

/** 批量生成的默认并发上限（小并发，避免打爆 apimart）。 */
const DEFAULT_CONCURRENCY = 3;
/** 并发可选范围。 */
const MIN_CONCURRENCY = 1;
const MAX_CONCURRENCY = 8;
/** 单张出图失败的自动重试次数（瞬时错误退避重试）。 */
const AUTO_RETRY_MAX = 2;
/** 批量数量上限（支持上百张）。 */
const MAX_COUNT = 200;

type Status = 'idle' | 'generating' | 'done' | 'error';

interface VisualAssetState {
  selection: VisualAssetSelection;
  count: number;
  ratio: AspectRatio;
  resolution: Resolution;
  /** 并发数（同时进行的出图任务数） */
  concurrency: number;

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
  setConcurrency: (n: number) => void;
  applySelection: (sel: VisualAssetSelection) => void;
  generate: () => Promise<void>;
  /** 重试单条结果项（重新扩写并出图，配置不变） */
  retryItem: (id: string) => Promise<void>;
  /** 重试所有失败项 */
  retryAllFailed: () => Promise<void>;
  /** 重试单条的自动存档（出图成功但存档失败时用） */
  archiveItem: (id: string) => Promise<void>;
  /** 图片加载完成后记录浏览器读到的真实宽高。 */
  noteImageSize: (id: string, width: number, height: number) => void;
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
    signal?.addEventListener('abort', () => {
      clearTimeout(t);
      reject(new DOMException('aborted', 'AbortError'));
    }, { once: true });
  });
}

export const useVisualAssetStore = create<VisualAssetState>((set, get) => ({
  selection: { ...EMPTY_SELECTION },
  count: 4,
  ratio: '1:1',
  resolution: '2k',
  concurrency: DEFAULT_CONCURRENCY,
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

  setCount: (n) => set({ count: Math.max(1, Math.min(MAX_COUNT, Math.floor(n) || 1)) }),
  setRatio: (ratio) => set({ ratio }),
  setResolution: (resolution) => set({ resolution }),
  setConcurrency: (n) =>
    set({ concurrency: Math.max(MIN_CONCURRENCY, Math.min(MAX_CONCURRENCY, Math.floor(n) || DEFAULT_CONCURRENCY)) }),
  applySelection: (selection) => set({ selection: { ...selection } }),
  // [GENERATE]
  generate: async () => {
    get()._abort?.abort();
    const controller = new AbortController();
    const { selection, count, ratio, resolution, concurrency } = get();
    const styles = useCustomStyleStore.getState().styles;

    const configs = generateConfigs(selection, count, styles.map((s) => s.id));
    if (configs.length === 0) {
      set({ status: 'error', errorMessage: '没有可生成的组合，请调整选择' });
      return;
    }

    const outputSpec = resolveOutputSpec(ratio, resolution);

    // 初始化结果项（pending）
    const items: AssetResultItem[] = configs.map((config, i) => ({
      id: `${Date.now()}-${i}`,
      config,
      prompt: '',
      status: 'pending',
      ratio,
      resolution,
      requestSize: outputSpec.requestSize,
      pixelSize: outputSpec.pixelSize,
    }));
    // 累加在已有结果之前，不顶掉上一批
    set((s) => ({
      status: 'generating',
      errorMessage: null,
      items: [...items, ...s.items],
      _abort: controller,
    }));

    /** 更新单条结果项。 */
    const update = (id: string, patch: Partial<AssetResultItem>) => {
      if (get()._abort !== controller) return;
      set((s) => ({
        items: s.items.map((it) => (it.id === id ? { ...it, ...patch } : it)),
      }));
    };
    // [WORKER]
    // 单张：扩写 → 出图，带瞬时错误自动退避重试
    const produceOne = async (item: AssetResultItem): Promise<void> => {
      update(item.id, { status: 'generating', phase: 'expanding', error: undefined });
      for (let attempt = 0; attempt <= AUTO_RETRY_MAX; attempt++) {
        if (controller.signal.aborted) return;
        try {
          update(item.id, { status: 'generating', phase: 'expanding' });
          const { prompt, via } = await expandToPrompt(item.config, styles, controller.signal);
          const finalPrompt = appendOutputSpecToPrompt(prompt, outputSpec);
          update(item.id, { prompt: finalPrompt, expandedVia: via, phase: 'imaging' });
          const image = await generateImageByPrompt(
            prompt,
            { size: ratio, resolution },
            controller.signal,
          );
          update(item.id, {
            status: 'done',
            phase: undefined,
            url: image.url,
            prompt: image.prompt,
            requestSize: image.outputSpec.requestSize,
            pixelSize: image.outputSpec.pixelSize,
          });
          // 出图成功后自动存档（永久化），失败不影响出图结果展示
          void get().archiveItem(item.id);
          return;
        } catch (e) {
          if (e instanceof DOMException && e.name === 'AbortError') return;
          const last = attempt === AUTO_RETRY_MAX;
          if (!last && isTransientError(e)) {
            // 退避：1s, 2s …
            update(item.id, { status: 'generating', error: undefined });
            try {
              await delay(1000 * (attempt + 1), controller.signal);
            } catch {
              return; // aborted during backoff
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
  // [RETRY]
  retryItem: async (id) => {
    const target = get().items.find((it) => it.id === id);
    if (!target) return;
    const current = get();
    const ratio = target.ratio ?? current.ratio;
    const resolution = target.resolution ?? current.resolution;
    const outputSpec = resolveOutputSpec(ratio, resolution);
    const styles = useCustomStyleStore.getState().styles;
    const controller = get()._abort ?? new AbortController();

    set((s) => ({
      items: s.items.map((it) =>
        it.id === id ? { ...it, status: 'generating', phase: 'expanding', error: undefined } : it,
      ),
    }));

    try {
      const { prompt, via } = await expandToPrompt(target.config, styles, controller.signal);
      const finalPrompt = appendOutputSpecToPrompt(prompt, outputSpec);
      set((s) => ({
        items: s.items.map((it) =>
          it.id === id
            ? {
                ...it,
                prompt: finalPrompt,
                expandedVia: via,
                phase: 'imaging',
                ratio,
                resolution,
                requestSize: outputSpec.requestSize,
                pixelSize: outputSpec.pixelSize,
              }
            : it,
        ),
      }));
      const image = await generateImageByPrompt(prompt, { size: ratio, resolution }, controller.signal);
      set((s) => ({
        items: s.items.map((it) =>
          it.id === id
            ? {
                ...it,
                status: 'done',
                phase: undefined,
                prompt: image.prompt,
                expandedVia: via,
                url: image.url,
                ratio,
                resolution,
                requestSize: image.outputSpec.requestSize,
                pixelSize: image.outputSpec.pixelSize,
              }
            : it,
        ),
      }));
      void get().archiveItem(id);
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return;
      const msg = e instanceof ImageGenError ? e.message : e instanceof Error ? e.message : '生成失败';
      set((s) => ({
        items: s.items.map((it) => (it.id === id ? { ...it, status: 'error', phase: undefined, error: msg } : it)),
      }));
    }
  },
  // [RETRY_ALL] 重试所有失败项（串行触发，复用单条重试）
  retryAllFailed: async () => {
    const failedIds = get().items.filter((it) => it.status === 'error').map((it) => it.id);
    for (const id of failedIds) {
      await get().retryItem(id);
    }
  },
  // [ARCHIVE] 出图后自动存档：前端直接调 arca /moodpic/save 登记图片 url
  archiveItem: async (id) => {
    const item = get().items.find((it) => it.id === id);
    if (!item || item.status !== 'done' || !item.url || item.savedAssetId) return;
    const ratio = item.ratio ?? get().ratio;
    const resolution = item.resolution ?? get().resolution;

    set((s) => ({
      items: s.items.map((it) =>
        it.id === id ? { ...it, archiveStatus: 'archiving', archiveError: undefined } : it,
      ),
    }));

    try {
      const result = await saveMoodPic({
        imageUrl: item.url,
        prompt: item.prompt,
        config: item.config,
        ratio,
        resolution,
      });
      set((s) => ({
        items: s.items.map((it) =>
          it.id === id
            ? { ...it, archiveStatus: 'archived', savedAssetId: result.assetId }
            : it,
        ),
      }));
    } catch (e) {
      const msg = e instanceof Error ? e.message : '存档失败';
      set((s) => ({
        items: s.items.map((it) =>
          it.id === id ? { ...it, archiveStatus: 'archive-error', archiveError: msg } : it,
        ),
      }));
    }
  },
  noteImageSize: (id, width, height) =>
    set((s) => ({
      items: s.items.map((it) => (it.id === id ? { ...it, actualWidth: width, actualHeight: height } : it)),
    })),
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
      ratio: '1:1',
      resolution: '2k',
      concurrency: DEFAULT_CONCURRENCY,
      status: 'idle',
      errorMessage: null,
      items: [],
      _abort: null,
    });
  },
}));
