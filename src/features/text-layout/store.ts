import { create } from 'zustand';
import type { EffectMode, EffectParams, FillShape, RenderStyle } from '@/types/layout';
import type { Background } from '@/types/catalog';
import { DEFAULT_MODE } from '@/data/effectCatalog';
import { DEFAULT_PALETTE_ID } from '@/data/paletteLibrary';
import { getImage } from '@/data/imageLibrary';
import { randomizeParams, resolveStyle } from '@/services/params';
import { extractLayout } from '@/services/layoutExtractor';

type Status = 'idle' | 'generating' | 'ready' | 'error';

const INITIAL_BG: Background = { type: 'palette', paletteId: DEFAULT_PALETTE_ID };

/**
 * 链路生产测试器状态。
 * 流程：输入文案 → generate()（后台按框架自动决策 + 区间随机）→ 出图 + 决策读数。
 * 界面不做手动风格选择；这些都由 extractLayout 自动产出。
 */
interface TextLayoutState {
  inputText: string;
  /** 是否已产出一版结果 */
  hasResult: boolean;

  // —— 后台决策出的整套配方（只读展示 + 渲染用）——
  mode: EffectMode;
  params: EffectParams;
  style: RenderStyle;
  background: Background;
  shape?: FillShape;
  source: 'mock' | 'model';
  /** 背景图（图片库背景时加载） */
  bgImage: HTMLImageElement | null;

  status: Status;
  errorMessage: string | null;

  setInputText: (text: string) => void;
  /** 生成一版（随机新种子） */
  generate: () => Promise<void>;
  /** 换一版（同文案，新随机，得到不同效果/配色/参数） */
  regenerate: () => Promise<void>;
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

async function runGenerate(
  set: (partial: Partial<TextLayoutState>) => void,
  get: () => TextLayoutState,
): Promise<void> {
  const { inputText } = get();
  set({ status: 'generating', errorMessage: null });
  try {
    const recipe = await extractLayout({ text: inputText });
    set({
      mode: recipe.mode,
      params: recipe.params,
      style: recipe.style,
      background: recipe.background,
      shape: recipe.shape,
      source: recipe.source,
      hasResult: true,
      status: 'ready',
    });
    loadBgImage(set, recipe.background);
  } catch (e) {
    set({
      status: 'error',
      errorMessage: e instanceof Error ? e.message : '生成失败，请重试',
    });
  }
}

export const useTextLayoutStore = create<TextLayoutState>((set, get) => ({
  inputText: '',
  hasResult: false,

  mode: DEFAULT_MODE,
  params: randomizeParams(DEFAULT_MODE, 1),
  style: resolveStyle(INITIAL_BG),
  background: INITIAL_BG,
  shape: undefined,
  source: 'mock',
  bgImage: null,

  status: 'idle',
  errorMessage: null,

  setInputText: (text) => set({ inputText: text }),

  generate: () => runGenerate(set, get),
  regenerate: () => runGenerate(set, get),

  reset: () =>
    set({
      inputText: '',
      hasResult: false,
      mode: DEFAULT_MODE,
      params: randomizeParams(DEFAULT_MODE, 1),
      style: resolveStyle(INITIAL_BG),
      background: INITIAL_BG,
      shape: undefined,
      source: 'mock',
      bgImage: null,
      status: 'idle',
      errorMessage: null,
    }),
}));
