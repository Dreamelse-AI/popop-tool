/**
 * IP 延展生成 store：编排「选 IP 档案 → 取参考图 → 随机展开延展配置 → 图生图 → 自动存档」。
 *
 * 复用 visual-asset 的批量范式：小并发 worker 池 + 瞬时错误退避重试 + 单条/批量重试。
 * 与 visual-asset 的区别：走图生图（generateImageByReference），参考图来自当前选中的 IP 档案，
 * prompt 走本地结构化拼接（ipPromptBuilder），保证角色一致。
 */

import { create } from 'zustand';
import type { AspectRatio, Resolution } from '@/types/visualAsset';
import type { IpExtendSelection, IpResultItem } from '@/types/ipExtend';
import { generateIpConfigs } from '@/services/ipExtendEngine';
import { buildIpExtendPrompt } from '@/services/ipPromptBuilder';
import {
  appendOutputSpecToPrompt,
  generateImageByReference,
  ImageGenError,
  resolveOutputSpec,
} from '@/services/imageClient';
import { useIpLibraryStore, getCurrentProfile } from './ipLibraryStore';

/** 批量默认并发上限（小并发，避免打爆 apimart）。 */
const DEFAULT_CONCURRENCY = 2;
const MIN_CONCURRENCY = 1;
const MAX_CONCURRENCY = 6;
/** 单张出图失败的自动重试次数（瞬时错误退避重试）。 */
const AUTO_RETRY_MAX = 2;
/** 批量数量上限。 */
const MAX_COUNT = 50;
/** 图生图参考图上限（apimart image_urls 上限 16，留余量）。 */
const MAX_REFERENCE = 8;

type Status = 'idle' | 'generating' | 'done' | 'error';

interface IpExtendState {
  selection: IpExtendSelection;
  /** 用户自由场景描述（所有条目共享）。 */
  scene: string;
  count: number;
  ratio: AspectRatio;
  resolution: Resolution;
  concurrency: number;

  status: Status;
  errorMessage: string | null;
  items: IpResultItem[];

  _abort: AbortController | null;

  toggle: (dimension: keyof IpExtendSelection, id: string) => void;
  clearDimension: (dimension: keyof IpExtendSelection) => void;
  setScene: (s: string) => void;
  setCount: (n: number) => void;
  setRatio: (r: AspectRatio) => void;
  setResolution: (r: Resolution) => void;
  setConcurrency: (n: number) => void;
  generate: () => Promise<void>;
  retryItem: (id: string) => Promise<void>;
  retryAllFailed: () => Promise<void>;
  cancel: () => void;
  reset: () => void;
}

const EMPTY_SELECTION: IpExtendSelection = { action: [], emotion: [], illustration: [] };

/** 判断瞬时错误（可自动重试）：网关繁忙 / 超时 / 网络抖动。 */
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

/** 取当前 IP 档案的参考图 URL 列表（形象图优先，其次表情包图，截断到上限）。 */
function currentReferenceUrls(): { urls: string[]; ipName?: string } {
  const profile = getCurrentProfile(useIpLibraryStore.getState());
  if (!profile) return { urls: [] };
  const urls = [
    ...profile.characterImages.map((i) => i.url),
    ...profile.stickerImages.map((i) => i.url),
  ].slice(0, MAX_REFERENCE);
  return { urls, ipName: profile.name };
}

export const useIpExtendStore = create<IpExtendState>((set, get) => ({
  selection: { ...EMPTY_SELECTION },
  scene: '',
  count: 4,
  ratio: '1:1',
  resolution: '2k',
  concurrency: DEFAULT_CONCURRENCY,
  status: 'idle',
  errorMessage: null,
  items: [],
  _abort: null,

  toggle: (dimension, id) =>
    set((s) => {
      const cur = s.selection[dimension];
      const next = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id];
      return { selection: { ...s.selection, [dimension]: next } };
    }),

  clearDimension: (dimension) =>
    set((s) => ({ selection: { ...s.selection, [dimension]: [] } })),

  setScene: (scene) => set({ scene }),
  setCount: (n) => set({ count: Math.max(1, Math.min(MAX_COUNT, Math.floor(n) || 1)) }),
  setRatio: (ratio) => set({ ratio }),
  setResolution: (resolution) => set({ resolution }),
  setConcurrency: (n) =>
    set({
      concurrency: Math.max(
        MIN_CONCURRENCY,
        Math.min(MAX_CONCURRENCY, Math.floor(n) || DEFAULT_CONCURRENCY),
      ),
    }),

  // [GENERATE]
  generate: async () => {
    const { urls, ipName } = currentReferenceUrls();
    if (urls.length === 0) {
      set({ status: 'error', errorMessage: '请先选择一个 IP 档案并上传至少一张形象图' });
      return;
    }

    get()._abort?.abort();
    const controller = new AbortController();
    const { selection, scene, count, ratio, resolution, concurrency } = get();

    const configs = generateIpConfigs(selection, count, scene);
    const outputSpec = resolveOutputSpec(ratio, resolution);

    const newItems: IpResultItem[] = configs.map((config, i) => ({
      id: `${Date.now()}-${i}`,
      config,
      prompt: '',
      status: 'pending',
      ratio,
      resolution,
    }));
    // 累加在已有结果之前，不顶掉上一批
    set((s) => ({
      status: 'generating',
      errorMessage: null,
      items: [...newItems, ...s.items],
      _abort: controller,
    }));

    const update = (id: string, patch: Partial<IpResultItem>) => {
      if (get()._abort !== controller) return;
      set((s) => ({ items: s.items.map((it) => (it.id === id ? { ...it, ...patch } : it)) }));
    };

    const produceOne = async (item: IpResultItem): Promise<void> => {
      for (let attempt = 0; attempt <= AUTO_RETRY_MAX; attempt++) {
        if (controller.signal.aborted) return;
        try {
          update(item.id, { status: 'generating', phase: 'expanding', error: undefined });
          const prompt = buildIpExtendPrompt(item.config, ipName);
          const finalPrompt = appendOutputSpecToPrompt(prompt, outputSpec);
          update(item.id, { prompt: finalPrompt, phase: 'imaging' });
          const image = await generateImageByReference(
            prompt,
            urls,
            { size: ratio, resolution },
            controller.signal,
          );
          update(item.id, {
            status: 'done',
            phase: undefined,
            url: image.url,
            prompt: image.prompt,
          });
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

    let cursor = 0;
    const runOne = async (): Promise<void> => {
      while (true) {
        if (controller.signal.aborted) return;
        const idx = cursor++;
        if (idx >= newItems.length) return;
        await produceOne(newItems[idx]);
      }
    };

    const poolSize = Math.min(Math.max(1, concurrency), newItems.length);
    await Promise.all(Array.from({ length: poolSize }, runOne));

    if (get()._abort === controller) {
      set({ status: 'done', _abort: null });
    }
  },

  // [RETRY] 重试单条（重新出图，配置不变）
  retryItem: async (id) => {
    const target = get().items.find((it) => it.id === id);
    if (!target) return;
    const { urls, ipName } = currentReferenceUrls();
    if (urls.length === 0) {
      set((s) => ({
        items: s.items.map((it) =>
          it.id === id ? { ...it, status: 'error', error: '当前没有可用的 IP 参考图' } : it,
        ),
      }));
      return;
    }
    const ratio = target.ratio ?? get().ratio;
    const resolution = target.resolution ?? get().resolution;
    const outputSpec = resolveOutputSpec(ratio, resolution);
    const controller = get()._abort ?? new AbortController();

    set((s) => ({
      items: s.items.map((it) =>
        it.id === id ? { ...it, status: 'generating', phase: 'imaging', error: undefined } : it,
      ),
    }));

    try {
      const prompt = buildIpExtendPrompt(target.config, ipName);
      const finalPrompt = appendOutputSpecToPrompt(prompt, outputSpec);
      const image = await generateImageByReference(
        prompt,
        urls,
        { size: ratio, resolution },
        controller.signal,
      );
      set((s) => ({
        items: s.items.map((it) =>
          it.id === id
            ? { ...it, status: 'done', phase: undefined, url: image.url, prompt: finalPrompt }
            : it,
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

  cancel: () => {
    get()._abort?.abort();
    set({ status: 'idle', _abort: null });
  },

  reset: () => {
    get()._abort?.abort();
    set({
      selection: { ...EMPTY_SELECTION },
      scene: '',
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
