import { create } from 'zustand';
import type { EffectMode, EffectParams, RenderStyle } from '@/types/layout';
import type { Background } from '@/types/catalog';
import { DEFAULT_MODE } from '@/data/effectCatalog';
import { DEFAULT_PALETTE_ID } from '@/data/paletteLibrary';
import { getImage } from '@/data/imageLibrary';
import { randomizeParams, resolveStyle } from '@/services/params';
import { extractLayout } from '@/services/layoutExtractor';

type Status = 'idle' | 'extracting' | 'ready' | 'error';

const INITIAL_BG: Background = { type: 'palette', paletteId: DEFAULT_PALETTE_ID };

interface TextLayoutState {
  inputText: string;
  mode: EffectMode;
  params: EffectParams;
  background: Background;
  style: RenderStyle;
  /** imageFill 上传图（fillShape='image' 时，不入持久化） */
  shapeImage: HTMLImageElement | null;
  shapeImageName: string | null;
  /** 背景图（来自图片库，已加载） */
  bgImage: HTMLImageElement | null;
  status: Status;
  errorMessage: string | null;

  setInputText: (text: string) => void;
  /** 切换效果：在该效果区间内随机出参数 */
  setMode: (mode: EffectMode) => void;
  /** 微调单个数值参数（调试用） */
  setParam: <K extends keyof EffectParams>(key: K, value: EffectParams[K]) => void;
  /** 选择背景（配色或图片，二选一） */
  setBackground: (bg: Background) => void;
  setShapeImage: (image: HTMLImageElement | null, name: string | null) => void;
  /** 重掷随机种子并在区间内重新随机参数 */
  reseed: () => void;
  runExtract: () => Promise<void>;
  reset: () => void;
}

/** 加载背景图（图片库 url），完成后写入 store。 */
function loadBgImage(set: (partial: Partial<TextLayoutState>) => void, bg: Background): void {
  if (bg.type !== 'image') {
    set({ bgImage: null });
    return;
  }
  const entry = getImage(bg.imageId);
  if (!entry) {
    set({ bgImage: null });
    return;
  }
  const img = new Image();
  img.onload = () => set({ bgImage: img });
  img.onerror = () => {
    console.error('bgImage.load.failed', entry.url);
    set({ bgImage: null });
  };
  img.src = entry.url;
}

export const useTextLayoutStore = create<TextLayoutState>((set, get) => ({
  inputText: '',
  mode: DEFAULT_MODE,
  params: randomizeParams(DEFAULT_MODE, 1),
  background: INITIAL_BG,
  style: resolveStyle(INITIAL_BG),
  shapeImage: null,
  shapeImageName: null,
  bgImage: null,
  status: 'idle',
  errorMessage: null,

  setInputText: (text) => set({ inputText: text }),

  setMode: (mode) => {
    const prev = get().params;
    // 切换效果时保留离散项（形状/方向），数值在新效果区间内随机
    set({
      mode,
      params: randomizeParams(mode, prev.seed, {
        fillShape: prev.fillShape,
        fillDirection: prev.fillDirection,
      }),
    });
  },

  setParam: (key, value) => set((s) => ({ params: { ...s.params, [key]: value } })),

  setBackground: (bg) => {
    set({ background: bg, style: resolveStyle(bg) });
    loadBgImage(set, bg);
  },

  setShapeImage: (image, name) => set({ shapeImage: image, shapeImageName: name }),

  reseed: () =>
    set((s) => ({
      params: randomizeParams(s.mode, Math.floor(Math.random() * 9_999_999) + 1, {
        fillShape: s.params.fillShape,
        fillDirection: s.params.fillDirection,
      }),
    })),

  runExtract: async () => {
    const { inputText, mode } = get();
    set({ status: 'extracting', errorMessage: null });
    try {
      const recipe = await extractLayout({ text: inputText, preferredMode: mode });
      set({ mode: recipe.mode, params: recipe.params, style: recipe.style, status: 'ready' });
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
      params: randomizeParams(DEFAULT_MODE, 1),
      background: INITIAL_BG,
      style: resolveStyle(INITIAL_BG),
      shapeImage: null,
      shapeImageName: null,
      bgImage: null,
      status: 'idle',
      errorMessage: null,
    }),
}));
