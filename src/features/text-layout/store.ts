import { create } from 'zustand';
import type { LayoutSchema } from '@/types/layout';
import { DEFAULT_TEMPLATE_ID } from '@/data/templates';
import { extractLayout } from '@/services/layoutExtractor';

type Status = 'idle' | 'extracting' | 'ready' | 'error';

interface TextLayoutState {
  inputText: string;
  templateId: string;
  schema: LayoutSchema | null;
  status: Status;
  errorMessage: string | null;

  setInputText: (text: string) => void;
  setTemplateId: (id: string) => void;
  runExtract: () => Promise<void>;
  reset: () => void;
}

export const useTextLayoutStore = create<TextLayoutState>((set, get) => ({
  inputText: '',
  templateId: DEFAULT_TEMPLATE_ID,
  schema: null,
  status: 'idle',
  errorMessage: null,

  setInputText: (text) => set({ inputText: text }),

  setTemplateId: (id) => {
    set({ templateId: id });
    // 已有结构时切模板只换样式，无需重新抽取
  },

  runExtract: async () => {
    const { inputText, templateId } = get();
    set({ status: 'extracting', errorMessage: null });
    try {
      const schema = await extractLayout({ text: inputText, preferredTemplateId: templateId });
      set({
        schema,
        templateId: schema.recommendedTemplateId,
        status: 'ready',
      });
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
      schema: null,
      status: 'idle',
      errorMessage: null,
      templateId: DEFAULT_TEMPLATE_ID,
    }),
}));
