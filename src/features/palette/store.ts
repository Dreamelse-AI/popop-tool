/**
 * 情绪配色库状态（纯前端，无服务器存储）。
 *
 * 职责：
 *   - 处理一批「拖入/选择/粘贴图片 → 提取主色 → AI 命名 → 生成待确认草稿」
 *   - 多张图各自成一条草稿，字段可编辑
 *   - 逐条或批量导出为 CSV 色值表下载（不落服务器、不存本地）
 */

import { create } from 'zustand';
import type { PaletteDraft, PaletteScheme } from '@/types/palette';
import { extractPalette } from '@/services/paletteExtractor';
import { nameColors } from '@/services/paletteNamer';
import { fileToDataUrl } from './fileToDataUrl';
import { downloadPaletteCsv } from './exportCsv';

/** 一条待确认草稿（带本地 key，便于多张并存时定位编辑/删除）。 */
export interface DraftItem extends PaletteDraft {
  /** 本地唯一 key，用于列表渲染与定位 */
  key: string;
}

interface PaletteState {
  /** 待确认草稿队列（多张图各一条） */
  drafts: DraftItem[];
  /** 正在分析的图片数量（>0 显示分析中） */
  analyzingCount: number;
  /** 分析阶段错误（最近一次） */
  analyzeError: string | null;

  /** 处理一批用户拖入/选择/粘贴的文件：逐个分析并加入草稿队列 */
  analyzeFiles: (files: File[]) => Promise<void>;
  /** 编辑某条草稿字段 */
  updateDraft: (key: string, patch: Partial<PaletteDraft>) => void;
  /** 编辑某条草稿里某套方案的字段（schemeIndex: 0|1） */
  updateScheme: (key: string, schemeIndex: number, patch: Partial<PaletteScheme>) => void;
  /** 互换某条草稿里某套方案的底色/字色 */
  swapScheme: (key: string, schemeIndex: number) => void;
  /** 丢弃某条草稿 */
  discardDraft: (key: string) => void;
  /** 丢弃全部草稿 */
  discardAllDrafts: () => void;
  /** 导出某条草稿为 CSV 下载 */
  exportDraft: (key: string) => void;
  /** 导出全部草稿为 CSV 下载 */
  exportAllDrafts: () => void;
}

let keySeq = 0;
function nextKey(): string {
  keySeq += 1;
  return `draft-${Date.now()}-${keySeq}`;
}

export const usePaletteStore = create<PaletteState>((set, get) => ({
  drafts: [],
  analyzingCount: 0,
  analyzeError: null,

  analyzeFiles: async (files) => {
    const images = files.filter((f) => f.type.startsWith('image/'));
    if (images.length === 0) return;
    set((s) => ({ analyzingCount: s.analyzingCount + images.length, analyzeError: null }));

    // 逐张分析，分析完一张就追加一条草稿（先到先显示）
    await Promise.all(
      images.map(async (file) => {
        try {
          const imageDataUrl = await fileToDataUrl(file);
          const { colors, schemes } = await extractPalette(imageDataUrl);
          const naming = await nameColors(colors, [
            schemes[0].bgColor,
            schemes[1].bgColor,
          ]);
          const draft: DraftItem = {
            key: nextKey(),
            id: uniqueId(naming.id, get()),
            schemes: [
              { ...schemes[0], name: naming.names[0], mood: naming.moods[0] },
              { ...schemes[1], name: naming.names[1], mood: naming.moods[1] },
            ],
            colors,
            imageDataUrl,
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

  updateScheme: (key, schemeIndex, patch) =>
    set((s) => ({
      drafts: s.drafts.map((d) =>
        d.key === key
          ? {
              ...d,
              schemes: d.schemes.map((sc, i) =>
                i === schemeIndex ? { ...sc, ...patch } : sc,
              ),
            }
          : d,
      ),
    })),

  swapScheme: (key, schemeIndex) =>
    set((s) => ({
      drafts: s.drafts.map((d) =>
        d.key === key
          ? {
              ...d,
              schemes: d.schemes.map((sc, i) =>
                i === schemeIndex
                  ? { ...sc, bgColor: sc.fontColor, fontColor: sc.bgColor }
                  : sc,
              ),
            }
          : d,
      ),
    })),

  discardDraft: (key) =>
    set((s) => ({ drafts: s.drafts.filter((d) => d.key !== key) })),

  discardAllDrafts: () => set({ drafts: [], analyzeError: null }),

  exportDraft: (key) => {
    const draft = get().drafts.find((d) => d.key === key);
    if (draft) downloadPaletteCsv([draft]);
  },

  exportAllDrafts: () => {
    const { drafts } = get();
    if (drafts.length > 0) downloadPaletteCsv(drafts);
  },
}));

/**
 * 保证 id 唯一：不与当前草稿队列里的 id 冲突，冲突则追加短随机后缀。
 */
function uniqueId(base: string, state: PaletteState): string {
  const used = new Set<string>(state.drafts.map((d) => d.id));
  if (!used.has(base)) return base;
  let candidate = base;
  while (used.has(candidate)) {
    candidate = `${base}-${Math.random().toString(36).slice(2, 5)}`;
  }
  return candidate;
}
