import { create } from 'zustand';
import type { EffectMode, EffectParams } from '@/types/layout';
import { DEFAULT_MODE, getPreset } from '@/data/effectPresets';
import { extractLayout } from '@/services/layoutExtractor';

type Status = 'idle' | 'extracting' | 'ready' | 'error';

interface TextLayoutState {
  inputText: string;
  mode: EffectMode;
  params: EffectParams;
  /** imageFill 用的已加载图片（不入持久化） */
  image: HTMLImageElement | null;
  imageName: string | null;
  status: Status;
  errorMessage: string | null;

  setInputText: (text: string) => void;
  /** 切换模式：套用该模式的预设参数 */
  setMode: (mode: EffectMode) => void;
  /** 微调单个参数 */
  setParam: <K extends keyof EffectParams>(key: K, value: EffectParams[K]) => void;
  setImage: (image: HTMLImageElement | null, name: string | null) => void;
  /** 重掷随机种子 */
  reseed: () => void;
  runExtract: () => Promise<void>;
  reset: () => void;
}

export const useTextLayoutStore = create<TextLayoutState>((set, get) => ({
  inputText: '',
  mode: DEFAULT_MODE,
  params: { ...getPreset(DEFAULT_MODE).params },
  image: null,
  imageName: null,
  status: 'idle',
  errorMessage: null,

  setInputText: (text) => set({ inputText: text }),

  setMode: (mode) => set({ mode, params: { ...getPreset(mode).params } }),

  setParam: (key, value) => set((s) => ({ params: { ...s.params, [key]: value } })),

  setImage: (image, name) => set({ image, imageName: name }),

  reseed: () =>
    set((s) => ({ params: { ...s.params, seed: Math.floor(Math.random() * 9998) + 1 } })),

  runExtract: async () => {
    const { inputText, mode } = get();
    set({ status: 'extracting', errorMessage: null });
    try {
      const recipe = await extractLayout({ text: inputText, preferredMode: mode });
      set({ mode: recipe.mode, params: recipe.params, status: 'ready' });
    } catch (e) {
      set({
        status: 'error',
        errorMessage: e instanceof Error ? e.message : '抽取失败，请重试',
      });
    }
  },

  reset: () =>
    set({
      inputText: '',
      mode: DEFAULT_MODE,
      params: { ...getPreset(DEFAULT_MODE).params },
      image: null,
      imageName: null,
      status: 'idle',
      errorMessage: null,
    }),
}));
