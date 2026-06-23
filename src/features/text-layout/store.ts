import { create } from 'zustand';
import type { EffectMode, EffectParams, RenderStyle } from '@/types/layout';
import type { Background } from '@/types/catalog';
import { DEFAULT_MODE } from '@/data/effectCatalog';
import { DEFAULT_PALETTE_ID } from '@/data/paletteLibrary';
import { getImage } from '@/data/imageLibrary';
import { randomizeParams, resolveStyle } from '@/services/params';
import { extractLayout } from '@/services/layoutExtractor';
import { detectFontColor } from './colorUtils';

type Status = 'idle' | 'generating' | 'ready' | 'error';

const INITIAL_BG: Background = { type: 'palette', paletteId: DEFAULT_PALETTE_ID };

/** 选择态："random" = 交给内容自动决策；具体值 = 锁定。 */
export const RANDOM = 'random' as const;
export type Preferred<T extends string> = typeof RANDOM | T;

/**
 * 链路生产测试器状态。
 * 流程：选效果/配色（可锁定或随机）→ generate()（后台决策 + 区间随机）→ 出图 + 决策读数。
 */
interface TextLayoutState {
  inputText: string;
  hasResult: boolean;

  // —— 选择态（界面可选/可随机）——
  preferredMode: Preferred<EffectMode>;
  preferredPaletteId: Preferred<string>;

  // —— 后台决策出的整套配方（只读展示 + 渲染用）——
  mode: EffectMode;
  params: EffectParams;
  style: RenderStyle;
  background: Background;
  source: 'mock' | 'model';
  bgImage: HTMLImageElement | null;

  status: Status;
  errorMessage: string | null;

  setInputText: (text: string) => void;
  setPreferredMode: (mode: Preferred<EffectMode>) => void;
  setPreferredPaletteId: (id: Preferred<string>) => void;
  /** 生成一版（随机新种子） */
  generate: () => Promise<void>;
  /** 换一版（同选择，新随机，得到不同参数/配色） */
  regenerate: () => Promise<void>;
  reset: () => void;
}

/**
 * 加载背景图（图片库 url），完成后写入 store。
 * 图库未指定 fontColor 时，按图片明暗自动判黑/白并覆盖 style.fontColor。
 */
function loadBgImage(
  set: (fn: (s: TextLayoutState) => Partial<TextLayoutState>) => void,
  bg: Background,
): void {
  if (bg.type !== 'image') {
    set(() => ({ bgImage: null }));
    return;
  }
  const entry = getImage(bg.imageId);
  if (!entry) {
    set(() => ({ bgImage: null }));
    return;
  }
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => {
    set((s) => {
      const fontColor = entry.fontColor ?? detectFontColor(img);
      return { bgImage: img, style: { ...s.style, fontColor } };
    });
  };
  img.onerror = () => {
    console.error('bgImage.load.failed', entry.url);
    set(() => ({ bgImage: null }));
  };
  img.src = entry.url;
}

async function runGenerate(
  set: (fn: (s: TextLayoutState) => Partial<TextLayoutState>) => void,
  get: () => TextLayoutState,
): Promise<void> {
  const { inputText, preferredMode, preferredPaletteId } = get();
  set(() => ({ status: 'generating', errorMessage: null }));
  try {
    const recipe = await extractLayout({
      text: inputText,
      preferredMode: preferredMode === RANDOM ? undefined : preferredMode,
      preferredPaletteId: preferredPaletteId === RANDOM ? undefined : preferredPaletteId,
    });
    set(() => ({
      mode: recipe.mode,
      params: recipe.params,
      style: recipe.style,
      background: recipe.background,
      source: recipe.source,
      hasResult: true,
      status: 'ready',
    }));
    loadBgImage(set, recipe.background);
  } catch (e) {
    set(() => ({
      status: 'error',
      errorMessage: e instanceof Error ? e.message : '生成失败，请重试',
    }));
  }
}

export const useTextLayoutStore = create<TextLayoutState>((set, get) => ({
  inputText: '',
  hasResult: false,

  preferredMode: RANDOM,
  preferredPaletteId: RANDOM,

  mode: DEFAULT_MODE,
  params: randomizeParams(DEFAULT_MODE, 1),
  style: resolveStyle(INITIAL_BG),
  background: INITIAL_BG,
  source: 'mock',
  bgImage: null,

  status: 'idle',
  errorMessage: null,

  setInputText: (text) => set(() => ({ inputText: text })),
  setPreferredMode: (mode) => set(() => ({ preferredMode: mode })),
  setPreferredPaletteId: (id) => set(() => ({ preferredPaletteId: id })),

  generate: () => runGenerate(set, get),
  regenerate: () => runGenerate(set, get),

  reset: () =>
    set(() => ({
      inputText: '',
      hasResult: false,
      preferredMode: RANDOM,
      preferredPaletteId: RANDOM,
      mode: DEFAULT_MODE,
      params: randomizeParams(DEFAULT_MODE, 1),
      style: resolveStyle(INITIAL_BG),
      background: INITIAL_BG,
      source: 'mock',
      bgImage: null,
      status: 'idle',
      errorMessage: null,
    })),
}));
