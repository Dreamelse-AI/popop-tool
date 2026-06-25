/**
 * 配色情绪库状态。
 *
 * 职责：
 *   - 加载/保存/删除服务端记录
 *   - 处理一次「拖入/选择图片 → 提取主色 → AI 命名 → 生成待确认草稿」
 *   - 草稿字段可编辑，确认后保存为永久记录
 *
 * 写链路：图片 base64 经 /api/palette/save 落到服务端文件存储（非浏览器本地）。
 */

import { create } from 'zustand';
import type { PaletteDraft, PaletteEntry } from '@/types/palette';
import { listPalettes, savePalette, deletePalette } from '@/services/paletteClient';
import { extractPalette } from '@/services/paletteExtractor';
import { nameColors } from '@/services/paletteNamer';
import { fileToDataUrl } from './fileToDataUrl';

type ListStatus = 'idle' | 'loading' | 'ready' | 'error';

interface PaletteState {
  items: PaletteEntry[];
  total: number;
  listStatus: ListStatus;
  listError: string | null;

  /** 当前待确认草稿（上传分析完成后出现，保存或丢弃后清空） */
  draft: PaletteDraft | null;
  /** 是否正在分析上传的图（提取 + AI 命名） */
  analyzing: boolean;
  /** 分析阶段错误 */
  analyzeError: string | null;
  /** 是否正在保存草稿 */
  saving: boolean;
  /** 正在删除的 id */
  deletingId: string | null;

  load: () => Promise<void>;
  /** 处理用户拖入/选择的文件：分析并生成草稿 */
  analyzeFile: (file: File) => Promise<void>;
  /** 编辑草稿字段 */
  updateDraft: (patch: Partial<PaletteDraft>) => void;
  /** 丢弃当前草稿 */
  discardDraft: () => void;
  /** 保存草稿为永久记录 */
  saveDraft: () => Promise<void>;
  /** 删除一条记录 */
  remove: (id: string) => Promise<void>;
}

export const usePaletteStore = create<PaletteState>((set, get) => ({
  items: [],
  total: 0,
  listStatus: 'idle',
  listError: null,

  draft: null,
  analyzing: false,
  analyzeError: null,
  saving: false,
  deletingId: null,

  load: async () => {
    set({ listStatus: 'loading', listError: null });
    try {
      const res = await listPalettes();
      set({ items: res.items, total: res.total, listStatus: 'ready' });
    } catch (e) {
      set({
        listStatus: 'error',
        listError: e instanceof Error ? e.message : '加载失败',
      });
    }
  },

  analyzeFile: async (file) => {
    set({ analyzing: true, analyzeError: null });
    try {
      const imageDataUrl = await fileToDataUrl(file);
      const { colors, bgColor, fontColor } = await extractPalette(imageDataUrl);
      const naming = await nameColors(colors);
      const draft: PaletteDraft = {
        id: uniqueId(naming.id, get().items),
        name: naming.name,
        mood: naming.mood,
        scene: naming.scene,
        bgColor,
        fontColor,
        colors,
        imageDataUrl,
      };
      set({ draft, analyzing: false });
    } catch (e) {
      set({
        analyzing: false,
        analyzeError: e instanceof Error ? e.message : '分析图片失败',
      });
    }
  },

  updateDraft: (patch) =>
    set((s) => (s.draft ? { draft: { ...s.draft, ...patch } } : {})),

  discardDraft: () => set({ draft: null, analyzeError: null }),

  saveDraft: async () => {
    const draft = get().draft;
    if (!draft) return;
    set({ saving: true });
    try {
      await savePalette({
        id: draft.id,
        name: draft.name,
        mood: draft.mood,
        bgColor: draft.bgColor,
        fontColor: draft.fontColor,
        scene: draft.scene,
        colors: draft.colors,
        imageDataUrl: draft.imageDataUrl,
      });
      set({ draft: null });
      await get().load();
    } catch (e) {
      set({ analyzeError: e instanceof Error ? e.message : '保存失败' });
    } finally {
      set({ saving: false });
    }
  },

  remove: async (id) => {
    set({ deletingId: id });
    try {
      await deletePalette(id);
      set((s) => ({
        items: s.items.filter((i) => i.id !== id),
        total: Math.max(0, s.total - 1),
      }));
    } catch (e) {
      set({ listError: e instanceof Error ? e.message : '删除失败' });
    } finally {
      set({ deletingId: null });
    }
  },
}));

/** 保证 id 在当前已存记录里唯一：冲突则追加短随机后缀。 */
function uniqueId(base: string, items: PaletteEntry[]): string {
  const used = new Set(items.map((i) => i.id));
  if (!used.has(base)) return base;
  let candidate = base;
  while (used.has(candidate)) {
    candidate = `${base}-${Math.random().toString(36).slice(2, 5)}`;
  }
  return candidate;
}
