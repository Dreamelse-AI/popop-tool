import { create } from 'zustand';
import type { MoodPicAsset } from '@/types/moodpic';
import { listMoodPics, batchDeleteMoodPics } from '@/services/moodpicGallery';

const PAGE_SIZE = 24;

type GalleryStatus = 'idle' | 'loading' | 'ready' | 'error';

interface GalleryState {
  items: MoodPicAsset[];
  total: number;
  page: number;
  status: GalleryStatus;
  errorMessage: string | null;
  /** 选中的 assetId 集合（批量删除用） */
  selected: Set<string>;
  deleting: boolean;

  load: (page?: number) => Promise<void>;
  toggleSelect: (assetId: string) => void;
  selectAll: () => void;
  clearSelection: () => void;
  deleteSelected: () => Promise<void>;
}

export const useGalleryStore = create<GalleryState>((set, get) => ({
  items: [],
  total: 0,
  page: 1,
  status: 'idle',
  errorMessage: null,
  selected: new Set(),
  deleting: false,

  load: async (page = 1) => {
    set({ status: 'loading', errorMessage: null });
    try {
      const res = await listMoodPics(page, PAGE_SIZE);
      set({ items: res.items, total: res.total, page, status: 'ready' });
    } catch (e) {
      set({
        status: 'error',
        errorMessage: e instanceof Error ? e.message : '加载图库失败',
      });
    }
  },

  toggleSelect: (assetId) =>
    set((s) => {
      const next = new Set(s.selected);
      if (next.has(assetId)) next.delete(assetId);
      else next.add(assetId);
      return { selected: next };
    }),

  selectAll: () =>
    set((s) => ({ selected: new Set(s.items.map((i) => i.assetId)) })),

  clearSelection: () => set({ selected: new Set() }),

  deleteSelected: async () => {
    const ids = Array.from(get().selected);
    if (ids.length === 0) return;
    set({ deleting: true });
    try {
      await batchDeleteMoodPics(ids);
      set({ selected: new Set() });
      await get().load(get().page);
    } catch (e) {
      set({
        status: 'error',
        errorMessage: e instanceof Error ? e.message : '删除失败',
      });
    } finally {
      set({ deleting: false });
    }
  },
}));
