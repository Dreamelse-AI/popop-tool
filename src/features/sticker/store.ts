/**
 * 表情包生成 store：编排「上传人物图 → 图生图九宫格 → 切图 → 抠图」全链路。
 *
 * 关键设计：整条链路只有 1 次出图调用（图生图），切图与抠图全在前端，
 * 把调用次数与成本压到最低。
 */

import { create } from 'zustand';
import type {
  ColorKeyOptions,
  MattingMode,
  StickerItem,
  StickerTaskStatus,
} from '@/types/sticker';
import { STICKER_COUNT } from '@/types/sticker';
import { generateImageByReference, ImageGenError } from '@/services/imageClient';
import { buildStickerPrompt } from '@/services/stickerPromptBuilder';
import { sliceGrid } from '@/services/stickerSlicer';
import { removeBackgroundByColorKey, DEFAULT_COLOR_KEY } from '@/services/stickerMatting';
import { useEmotionStore } from './emotionStore';

/**
 * 固定出图规格（不再让用户选，避免「全图比例 vs 单表情比例」语义混淆）：
 *   - 九宫格大图统一 1:1：3×3 均分后每格天然就是 1:1，裁单表情几乎零损失，
 *     且 1:1 是 gpt-image-2 最稳的比例（异化比例模型遵循度差、易构图崩）
 *   - 单个表情统一从每格居中裁成 1:1
 */
const GRID_RATIO = '1:1';
const GRID_RESOLUTION = '2k';

interface StickerState {
  /** 人物参考图（base64 data URI） */
  referenceImages: string[];
  /** 当前提示词正文 */
  prompt: string;
  matting: MattingMode;
  colorKey: ColorKeyOptions;

  status: StickerTaskStatus;
  errorMessage: string | null;
  /** 九宫格大图直链（生成成功后） */
  gridUrl: string | null;
  /** 9 张表情结果 */
  items: StickerItem[];

  _abort: AbortController | null;

  addReferenceImages: (dataUrls: string[]) => void;
  removeReferenceImage: (index: number) => void;
  clearReferenceImages: () => void;
  setPrompt: (p: string) => void;
  setMatting: (m: MattingMode) => void;
  setColorKey: (patch: Partial<ColorKeyOptions>) => void;
  /** 跑完整链路：图生图 → 切图 → 抠图 */
  generate: () => Promise<void>;
  cancel: () => void;
  reset: () => void;
}

const MAX_REFERENCE_IMAGES = 16;

export const useStickerStore = create<StickerState>((set, get) => ({
  referenceImages: [],
  prompt: '',
  matting: 'colorKey',
  colorKey: { ...DEFAULT_COLOR_KEY },

  status: 'idle',
  errorMessage: null,
  gridUrl: null,
  items: [],
  _abort: null,

  addReferenceImages: (dataUrls) =>
    set((s) => ({
      referenceImages: [...s.referenceImages, ...dataUrls].slice(0, MAX_REFERENCE_IMAGES),
    })),

  removeReferenceImage: (index) =>
    set((s) => ({ referenceImages: s.referenceImages.filter((_, i) => i !== index) })),

  clearReferenceImages: () => set({ referenceImages: [] }),

  setPrompt: (prompt) => set({ prompt }),
  setMatting: (matting) => set({ matting }),
  setColorKey: (patch) => set((s) => ({ colorKey: { ...s.colorKey, ...patch } })),

  generate: async () => {
    const { referenceImages, prompt, matting, colorKey } = get();
    if (referenceImages.length === 0) {
      set({ status: 'error', errorMessage: '请先上传至少一张人物形象图' });
      return;
    }
    if (!prompt.trim()) {
      set({ status: 'error', errorMessage: '请填写或选择一条提示词' });
      return;
    }

    get()._abort?.abort();
    const controller = new AbortController();

    // 取当前情绪列表，按序填到九宫格 9 格（多退少补到 9 格内）
    const emotions = useEmotionStore.getState().emotions.slice(0, STICKER_COUNT);

    // 初始化 9 个待处理项
    const items: StickerItem[] = Array.from({ length: STICKER_COUNT }, (_, i) => ({
      id: `${Date.now()}-${i}`,
      index: i,
      emotionLabel: emotions[i]?.label,
      status: 'pending',
    }));
    set({
      status: 'generating',
      errorMessage: null,
      gridUrl: null,
      items,
      _abort: controller,
    });

    try {
      // 1. 单次图生图，出一张九宫格大图
      const fullPrompt = buildStickerPrompt(prompt, emotions, matting);
      const image = await generateImageByReference(
        fullPrompt,
        referenceImages,
        { size: GRID_RATIO, resolution: GRID_RESOLUTION },
        controller.signal,
      );
      if (get()._abort !== controller) return;
      set({ gridUrl: image.url, status: 'slicing' });

      // 2. 前端切成 9 张
      const cells = await sliceGrid(image.url, controller.signal);
      if (get()._abort !== controller) return;

      // 3. 可选抠图（逐张，纯前端）
      const needMatting = matting === 'colorKey';
      set({ status: needMatting ? 'matting' : 'done' });

      const finalItems = get().items.map((it) => ({ ...it }));
      for (let i = 0; i < finalItems.length; i++) {
        if (controller.signal.aborted) return;
        const cell = cells[i];
        if (!cell) {
          finalItems[i] = { ...finalItems[i], status: 'error', error: '切图缺失' };
          set({ items: [...finalItems] });
          continue;
        }
        try {
          const dataUrl = needMatting
            ? await removeBackgroundByColorKey(cell, colorKey)
            : cell;
          finalItems[i] = { ...finalItems[i], status: 'done', dataUrl };
        } catch (e) {
          finalItems[i] = {
            ...finalItems[i],
            status: 'error',
            error: e instanceof Error ? e.message : '处理失败',
          };
        }
        set({ items: [...finalItems] });
      }

      if (get()._abort === controller) {
        set({ status: 'done', _abort: null });
      }
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return;
      if (get()._abort !== controller) return;
      const msg =
        e instanceof ImageGenError ? e.message : e instanceof Error ? e.message : '生成失败';
      set({ status: 'error', errorMessage: msg, _abort: null });
    }
  },

  cancel: () => {
    get()._abort?.abort();
    set({ status: 'idle', _abort: null });
  },

  reset: () => {
    get()._abort?.abort();
    set({
      status: 'idle',
      errorMessage: null,
      gridUrl: null,
      items: [],
      _abort: null,
    });
  },
}));
