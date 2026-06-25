/**
 * 情绪配色库状态。
 *
 * 职责：
 *   - 加载/保存/删除服务端记录
 *   - 处理一批「拖入/选择/粘贴图片 → 提取主色 → AI 命名 → 生成待确认草稿」
 *   - 多张图各自成一条草稿，字段可编辑，逐条或批量保存
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

/** 一条待确认草稿（带本地 key，便于多张并存时定位编辑/删除/保存）。 */
export interface DraftItem extends PaletteDraft {
  /** 本地唯一 key（非后端 id），用于列表渲染与定位 */
  key: string;
  /** 该草稿是否正在保存 */
  saving: boolean;
  /** 该草稿保存错误 */
  error: string | null;
}

interface PaletteState {
  items: PaletteEntry[];
  total: number;
  listStatus: ListStatus;
  listError: string | null;

  /** 待确认草稿队列（多张图各一条） */
  drafts: DraftItem[];
  /** 正在分析的图片数量（>0 显示分析中） */
  analyzingCount: number;
  /** 分析阶段错误（最近一次） */
  analyzeError: string | null;
  /** 正在删除的 id */
  deletingId: string | null;

  load: () => Promise<void>;
  /** 处理一批用户拖入/选择/粘贴的文件：逐个分析并加入草稿队列 */
  analyzeFiles: (files: File[]) => Promise<void>;
  /** 编辑某条草稿字段 */
  updateDraft: (key: string, patch: Partial<PaletteDraft>) => void;
  /** 丢弃某条草稿 */
  discardDraft: (key: string) => void;
  /** 丢弃全部草稿 */
  discardAllDrafts: () => void;
  /** 保存某条草稿为永久记录 */
  saveDraft: (key: string) => Promise<void>;
  /** 保存全部草稿 */
  saveAllDrafts: () => Promise<void>;
  /** 删除一条记录 */
  remove: (id: string) => Promise<void>;
}

let keySeq = 0;
function nextKey(): string {
  keySeq += 1;
  return `draft-${Date.now()}-${keySeq}`;
}

export const usePaletteStore = create<PaletteState>((set, get) => ({
  items: [],
  total: 0,
  listStatus: 'idle',
  listError: null,

  drafts: [],
  analyzingCount: 0,
  analyzeError: null,
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

  analyzeFiles: async (files) => {
    const images = files.filter((f) => f.type.startsWith('image/'));
    if (images.length === 0) return;
    set((s) => ({ analyzingCount: s.analyzingCount + images.length, analyzeError: null }));

    // 逐张分析，分析完一张就追加一条草稿（先到先显示）
    await Promise.all(
      images.map(async (file) => {
        try {
          const imageDataUrl = await fileToDataUrl(file);
          const { colors, bgColor, fontColor } = await extractPalette(imageDataUrl);
          const naming = await nameColors(colors);
          const draft: DraftItem = {
            key: nextKey(),
            id: uniqueId(naming.id, get()),
            name: naming.name,
            mood: naming.mood,
            bgColor,
            fontColor,
            colors,
            imageDataUrl,
            saving: false,
            error: null,
          };
          set((s) => ({ drafts: [...s.drafts, draft], analyzingCount: s.analyzingCount - 1 }));
        } catch (e) {
          set((s) => ({
            analyzingCount: s.analyzingCount - 1,
            analyzeError: e instanceof Error ? e.message : '分析图片失败',
          }));
        }
      }),
    );
  },

  updateDraft: (key, patch) =>
    set((s) => ({
      drafts: s.drafts.map((d) => (d.key === key ? { ...d, ...patch } : d)),
    })),

  discardDraft: (key) =>
    set((s) => ({ drafts: s.drafts.filter((d) => d.key !== key) })),

  discardAllDrafts: () => set({ drafts: [], analyzeError: null }),

  saveDraft: async (key) => {
    const draft = get().drafts.find((d) => d.key === key);
    if (!draft || draft.saving) return;
    set((s) => ({
      drafts: s.drafts.map((d) => (d.key === key ? { ...d, saving: true, error: null } : d)),
    }));
    try {
      await savePalette({
        id: draft.id,
        name: draft.name,
        mood: draft.mood,
        bgColor: draft.bgColor,
        fontColor: draft.fontColor,
        colors: draft.colors,
        imageDataUrl: draft.imageDataUrl,
      });
      // 保存成功：移除该草稿
      set((s) => ({ drafts: s.drafts.filter((d) => d.key !== key) }));
      await get().load();
    } catch (e) {
      set((s) => ({
        drafts: s.drafts.map((d) =>
          d.key === key
            ? { ...d, saving: false, error: e instanceof Error ? e.message : '保存失败' }
            : d,
        ),
      }));
    }
  },

  saveAllDrafts: async () => {
    // 串行保存，避免并发写与 id 冲突；逐条复用 saveDraft
    const keys = get().drafts.map((d) => d.key);
    for (const key of keys) {
      await get().saveDraft(key);
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

/**
 * 保证 id 唯一：既不与已存记录冲突，也不与当前草稿队列里的 id 冲突。
 * 冲突则追加短随机后缀。
 */
function uniqueId(base: string, state: PaletteState): string {
  const used = new Set<string>([
    ...state.items.map((i) => i.id),
    ...state.drafts.map((d) => d.id),
  ]);
  if (!used.has(base)) return base;
  let candidate = base;
  while (used.has(candidate)) {
    candidate = `${base}-${Math.random().toString(36).slice(2, 5)}`;
  }
  return candidate;
}
