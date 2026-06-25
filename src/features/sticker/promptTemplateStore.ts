/**
 * 表情包提示词「骨架字段」模板仓库（持久化到 localStorage）。
 *
 * 完整出图 prompt = 骨架字段（本仓库，可逐字段改/恢复默认）
 *                + 情绪段（来自 emotionStore，动态）
 *                + 主题/风格段（用户主输入框）。
 *
 * 骨架字段平时只读展示，点击单个字段才进入编辑，可一键恢复该字段或全部默认。
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/** 骨架字段 key（决定拼装顺序与 UI 展示顺序）。 */
export type PromptFieldKey = 'layout' | 'consistency' | 'crop' | 'background';

/** 单个骨架字段的元信息。 */
export interface PromptField {
  key: PromptFieldKey;
  /** 中文标签（UI 展示） */
  label: string;
  /** 英文正文（注入 prompt） */
  text: string;
}

/** 骨架字段默认值（英文，注入 image prompt）。 */
export const DEFAULT_FIELDS: Record<PromptFieldKey, string> = {
  layout:
    'Create a single square (1:1) image containing a 3x3 grid (9 cells) of expression stickers of the SAME character. Divide the canvas evenly into 3 rows and 3 columns of equal square cells, with clear separation and no overlap between cells.',
  consistency:
    'Keep the character identity and outfit strictly consistent across all 9 cells, matching the provided reference image.',
  crop:
    'In every cell, place the character centered with generous margin / padding around it, so each cell can be safely center-cropped to a 1:1 square without cutting off the character.',
  background:
    'Use a clean, flat, uniform solid background in a saturated color that strongly contrasts with the character (for example deep teal or vivid blue), avoiding white, gray and skin tones, no gradients, no shadows, no extra decorations, so the subject — including any white or light-colored clothing — can be cleanly and accurately cut out.',
};

/** 字段中文标签。 */
export const FIELD_LABELS: Record<PromptFieldKey, string> = {
  layout: '布局（九宫格）',
  consistency: '人物一致性',
  crop: '居中留边（便于裁剪）',
  background: '抠图背景',
};

/** 字段拼装/展示顺序。 */
export const FIELD_ORDER: PromptFieldKey[] = ['layout', 'consistency', 'crop', 'background'];

interface PromptTemplateState {
  fields: Record<PromptFieldKey, string>;
  /** 修改单个字段（空字符串会被忽略，需用恢复默认还原） */
  setField: (key: PromptFieldKey, text: string) => void;
  /** 恢复单个字段为默认 */
  resetField: (key: PromptFieldKey) => void;
  /** 恢复全部字段为默认 */
  resetAll: () => void;
}

export const usePromptTemplateStore = create<PromptTemplateState>()(
  persist(
    (set) => ({
      fields: { ...DEFAULT_FIELDS },
      setField: (key, text) =>
        set((s) => ({ fields: { ...s.fields, [key]: text } })),
      resetField: (key) =>
        set((s) => ({ fields: { ...s.fields, [key]: DEFAULT_FIELDS[key] } })),
      resetAll: () => set({ fields: { ...DEFAULT_FIELDS } }),
    }),
    { name: 'popop-sticker-prompt-template' },
  ),
);
