import { create } from 'zustand';
import type {
  AspectRatio,
  BackgroundLayer,
  BackgroundSelection,
  GeneratedImage,
  Resolution,
} from '@/types/background';
import { DEFAULT_SELECTION } from '@/data/backgroundOptions';
import { buildPrompt } from '@/services/promptBuilder';
import { generateBackground, ImageGenError } from '@/services/imageClient';

type Status = 'idle' | 'generating' | 'done' | 'error';

interface BackgroundState {
  selection: BackgroundSelection;
  ratio: AspectRatio;
  resolution: Resolution;
  extraKeywords: string;

  status: Status;
  errorMessage: string | null;
  /** 最近一次生成的图片 */
  result: GeneratedImage | null;
  /** 最近一次实际发送的 prompt（供用户查看/复制） */
  lastPrompt: string | null;

  /** 进行中请求的取消控制器（不入状态比较，仅内部持有） */
  _abort: AbortController | null;

  setLayer: <K extends BackgroundLayer>(layer: K, id: BackgroundSelection[K]) => void;
  applySelection: (selection: BackgroundSelection) => void;
  setRatio: (ratio: AspectRatio) => void;
  setResolution: (resolution: Resolution) => void;
  setExtraKeywords: (text: string) => void;
  /** 当前选择拼出的 prompt 预览（不触发请求） */
  previewPrompt: () => string;
  generate: () => Promise<void>;
  cancel: () => void;
  reset: () => void;
}

const INITIAL = {
  selection: { ...DEFAULT_SELECTION },
  ratio: '9:16' as AspectRatio,
  resolution: '2k' as Resolution,
  extraKeywords: '',
  status: 'idle' as Status,
  errorMessage: null,
  result: null,
  lastPrompt: null,
  _abort: null,
};

export const useBackgroundStore = create<BackgroundState>((set, get) => ({
  ...INITIAL,

  setLayer: (layer, id) =>
    set((s) => ({ selection: { ...s.selection, [layer]: id } })),

  applySelection: (selection) => set({ selection: { ...selection } }),

  setRatio: (ratio) => set({ ratio }),

  setResolution: (resolution) => set({ resolution }),

  setExtraKeywords: (text) => set({ extraKeywords: text }),

  previewPrompt: () => {
    const { selection, extraKeywords } = get();
    return buildPrompt(selection, extraKeywords);
  },

  generate: async () => {
    // 取消上一次未完成请求，避免竞态
    get()._abort?.abort();
    const controller = new AbortController();

    const { selection, ratio, resolution, extraKeywords } = get();
    const prompt = buildPrompt(selection, extraKeywords);

    set({
      status: 'generating',
      errorMessage: null,
      lastPrompt: prompt,
      _abort: controller,
    });

    try {
      const image = await generateBackground(
        { selection, ratio, resolution, extraKeywords },
        controller.signal,
      );
      // 若期间被新请求取消，则不覆盖
      if (get()._abort !== controller) return;
      set({ status: 'done', result: image, _abort: null });
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return;
      if (get()._abort !== controller) return;
      const msg =
        e instanceof ImageGenError
          ? e.message
          : e instanceof Error
            ? e.message
            : '生成失败，请重试';
      set({ status: 'error', errorMessage: msg, _abort: null });
    }
  },

  cancel: () => {
    get()._abort?.abort();
    set({ status: 'idle', _abort: null });
  },

  reset: () => {
    get()._abort?.abort();
    set({ ...INITIAL, selection: { ...DEFAULT_SELECTION } });
  },
}));
