/**
 * 表情情绪仓库（持久化到 localStorage）。
 *
 * 默认提供 9 个常用情绪（对应九宫格 9 格），用户可增加 / 修改 / 删除。
 * 九宫格出图时按当前情绪列表顺序填充每一格。
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { StickerEmotion } from '@/types/sticker';

/** 默认 9 个情绪（中文标签 + 英文片段）。 */
export const DEFAULT_EMOTIONS: StickerEmotion[] = [
  { id: 'happy', label: '开心', en: 'happy, cheerful smile' },
  { id: 'shy', label: '害羞', en: 'shy, blushing' },
  { id: 'aggrieved', label: '委屈', en: 'aggrieved, teary eyes, pouting' },
  { id: 'angry', label: '生气', en: 'angry, frowning' },
  { id: 'surprised', label: '惊讶', en: 'surprised, shocked, wide eyes' },
  { id: 'coquettish', label: '撒娇', en: 'acting cute, coquettish, adorable' },
  { id: 'sleepy', label: '困倦', en: 'sleepy, drowsy, yawning' },
  { id: 'smug', label: '得意', en: 'smug, proud, confident grin' },
  { id: 'gentle', label: '温柔', en: 'gentle, tender, soft smile' },
];

interface EmotionState {
  emotions: StickerEmotion[];
  /** 新增情绪；label/en 必填，返回是否成功（重复或空则失败） */
  addEmotion: (label: string, en: string) => boolean;
  /** 修改情绪；label/en 必填，返回是否成功 */
  updateEmotion: (id: string, label: string, en: string) => boolean;
  /** 删除情绪 */
  removeEmotion: (id: string) => void;
  /** 恢复默认 9 个 */
  resetEmotions: () => void;
}

/** 由英文片段派生稳定 id。 */
function makeId(en: string): string {
  const slug = en.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 24);
  return `${slug || 'emotion'}-${Date.now().toString(36)}`;
}

function isDuplicate(list: StickerEmotion[], label: string, excludeId?: string): boolean {
  const target = label.trim().toLowerCase();
  return list.some((e) => e.id !== excludeId && e.label.trim().toLowerCase() === target);
}

export const useEmotionStore = create<EmotionState>()(
  persist(
    (set, get) => ({
      emotions: DEFAULT_EMOTIONS,

      addEmotion: (label, en) => {
        const l = label.trim();
        const e = en.trim();
        if (!l || !e) return false;
        if (isDuplicate(get().emotions, l)) return false;
        set((s) => ({ emotions: [...s.emotions, { id: makeId(e), label: l, en: e }] }));
        return true;
      },

      updateEmotion: (id, label, en) => {
        const l = label.trim();
        const e = en.trim();
        if (!l || !e) return false;
        if (isDuplicate(get().emotions, l, id)) return false;
        set((s) => ({
          emotions: s.emotions.map((item) =>
            item.id === id ? { ...item, label: l, en: e } : item,
          ),
        }));
        return true;
      },

      removeEmotion: (id) =>
        set((s) => ({ emotions: s.emotions.filter((e) => e.id !== id) })),

      resetEmotions: () => set({ emotions: DEFAULT_EMOTIONS }),
    }),
    { name: 'popop-sticker-emotions' },
  ),
);
