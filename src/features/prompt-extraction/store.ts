/**
 * 提示词提取与整理工具 store。
 *
 * 一张图片 = 一个 group，组内流程串行：
 *   1. 调多模态模型分析 → 得到 contentPrompt（内容词）+ stylePrompt（风格词），两块互不重叠
 *   2. 完整提示词 = 内容词 + 风格词（buildFullPrompt 拼接），用它调生图模型 → 验证图
 *
 * 多个 group 用并发 worker 池处理（同视觉资产引擎 / 画风测试）。
 * 内容词 / 风格词均可编辑，改任一块完整提示词实时跟着变；可「重新生成」（仅重出图）或「重新分析」。
 *
 * 模型调用复用：分析 services/promptExtractor，出图 services/imageClient（apimart gpt-image-2）。
 */

import { create } from 'zustand';
import { extractPromptsFromImage, buildFullPrompt } from '@/services/promptExtractor';
import { generateImageByPrompt, ImageGenError } from '@/services/imageClient';

/** 并发上限，避免打爆 apimart。 */
const CONCURRENCY = 2;

/** group 整体状态。 */
export type GroupStatus = 'pending' | 'analyzing' | 'generating' | 'done' | 'error';

/** 一张图对应的一整组流程数据。 */
export interface PromptGroup {
  id: string;
  /** 源图（base64 data URI），左列展示与分析输入。 */
  sourceUrl: string;
  status: GroupStatus;
  /** 内容提示词（可编辑）：主体/场景/动作/氛围，不含风格。 */
  contentPrompt: string;
  /** 关键画风提示词（可编辑），供后续画风工具复用。 */
  stylePrompt: string;
  /** 验证图直链。 */
  resultUrl?: string;
  /** 错误信息（分析或出图失败）。 */
  error?: string;
}

interface ExtractionState {
  ratio: string;
  resolution: string;
  groups: PromptGroup[];
  /** 是否有任务在进行（控制全局按钮态）。 */
  busy: boolean;
  _abort: AbortController | null;

  setRatio: (r: string) => void;
  setResolution: (r: string) => void;

  /** 接收一批图片（已转 data URI），逐个建组并自动跑完整流程。 */
  addImages: (dataUrls: string[]) => Promise<void>;
  /** 编辑某组内容提示词。 */
  setContentPrompt: (id: string, v: string) => void;
  /** 编辑某组画风提示词。 */
  setStylePrompt: (id: string, v: string) => void;
  /** 用当前 内容词+风格词 拼接出的完整提示词重新生成验证图（不重新分析）。 */
  regenerate: (id: string) => Promise<void>;
  /** 重新分析该组（再自动重新出图）。 */
  reanalyze: (id: string) => Promise<void>;
  /** 移除一组。 */
  removeGroup: (id: string) => void;
  /** 清空全部。 */
  clearAll: () => void;
  /** 取消全部进行中的任务。 */
  cancel: () => void;
}

export const useExtractionStore = create<ExtractionState>((set, get) => ({
  ratio: '1:1',
  resolution: '1k',
  groups: [],
  busy: false,
  _abort: null,

  setRatio: (ratio) => set({ ratio }),
  setResolution: (resolution) => set({ resolution }),

  addImages: async (dataUrls) => {
    const valid = dataUrls.filter(Boolean);
    if (valid.length === 0) return;

    const controller = get()._abort ?? new AbortController();
    const newGroups: PromptGroup[] = valid.map((url, i) => ({
      id: `${Date.now()}-${i}-${Math.random().toString(36).slice(2, 6)}`,
      sourceUrl: url,
      status: 'pending',
      contentPrompt: '',
      stylePrompt: '',
    }));

    set((s) => ({
      groups: [...newGroups, ...s.groups],
      busy: true,
      _abort: controller,
    }));

    const ids = newGroups.map((g) => g.id);
    let cursor = 0;
    const runOne = async (): Promise<void> => {
      while (true) {
        if (controller.signal.aborted) return;
        const idx = cursor++;
        if (idx >= ids.length) return;
        await runFullFlow(get, set, ids[idx], controller.signal);
      }
    };
    const workers = Array.from({ length: Math.min(CONCURRENCY, ids.length) }, runOne);
    await Promise.all(workers);

    if (get()._abort === controller) set({ busy: false, _abort: null });
  },

  setContentPrompt: (id, v) => patchGroup(set, id, { contentPrompt: v }),
  setStylePrompt: (id, v) => patchGroup(set, id, { stylePrompt: v }),

  regenerate: async (id) => {
    const group = get().groups.find((g) => g.id === id);
    if (!group || !buildFullPrompt(group.contentPrompt, group.stylePrompt)) return;
    const controller = get()._abort ?? new AbortController();
    patchGroup(set, id, { status: 'generating', error: undefined });
    try {
      await runGenerate(get, set, id, controller.signal);
    } finally {
      if (get()._abort === controller && !anyBusy(get)) set({ busy: false });
    }
  },

  reanalyze: async (id) => {
    const group = get().groups.find((g) => g.id === id);
    if (!group) return;
    const controller = get()._abort ?? new AbortController();
    set({ busy: true });
    await runFullFlow(get, set, id, controller.signal);
    if (get()._abort === controller && !anyBusy(get)) set({ busy: false, _abort: null });
  },

  removeGroup: (id) => set((s) => ({ groups: s.groups.filter((g) => g.id !== id) })),

  clearAll: () => {
    get()._abort?.abort();
    set({ groups: [], busy: false, _abort: null });
  },

  cancel: () => {
    get()._abort?.abort();
    set({ busy: false, _abort: null });
  },
}));

/** 局部更新某个 group。 */
function patchGroup(
  set: (fn: (s: ExtractionState) => Partial<ExtractionState>) => void,
  id: string,
  patch: Partial<PromptGroup>,
): void {
  set((s) => ({ groups: s.groups.map((g) => (g.id === id ? { ...g, ...patch } : g)) }));
}

/** 是否仍有 group 在进行中。 */
function anyBusy(get: () => ExtractionState): boolean {
  return get().groups.some((g) => g.status === 'analyzing' || g.status === 'generating');
}

type GetState = () => ExtractionState;
type SetState = (fn: (s: ExtractionState) => Partial<ExtractionState>) => void;

/** 完整流程：分析 → 出图。任一阶段失败则停在 error，由用户单独重试。 */
async function runFullFlow(
  get: GetState,
  set: SetState,
  id: string,
  signal: AbortSignal,
): Promise<void> {
  const ok = await runAnalyze(get, set, id, signal);
  if (!ok) return;
  await runGenerate(get, set, id, signal);
}

/** 分析阶段：返回是否成功（成功才继续出图）。 */
async function runAnalyze(
  get: GetState,
  set: SetState,
  id: string,
  signal: AbortSignal,
): Promise<boolean> {
  const group = get().groups.find((g) => g.id === id);
  if (!group) return false;
  patchGroup(set, id, { status: 'analyzing', error: undefined });
  try {
    const result = await extractPromptsFromImage(group.sourceUrl, signal);
    patchGroup(set, id, {
      contentPrompt: result.contentPrompt,
      stylePrompt: result.stylePrompt,
    });
    return true;
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') return false;
    const msg = e instanceof Error ? e.message : '分析失败';
    patchGroup(set, id, { status: 'error', error: `分析失败：${msg}` });
    return false;
  }
}

/** 出图阶段：用 内容词+风格词 拼接出的完整提示词生成验证图。 */
async function runGenerate(
  get: GetState,
  set: SetState,
  id: string,
  signal: AbortSignal,
): Promise<void> {
  const group = get().groups.find((g) => g.id === id);
  if (!group) return;
  const prompt = buildFullPrompt(group.contentPrompt, group.stylePrompt);
  if (!prompt) {
    patchGroup(set, id, { status: 'error', error: '提示词为空，无法生成' });
    return;
  }
  patchGroup(set, id, { status: 'generating', error: undefined });
  try {
    const { ratio, resolution } = get();
    const image = await generateImageByPrompt(prompt, { size: ratio, resolution }, signal);
    patchGroup(set, id, { status: 'done', resultUrl: image.url });
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') return;
    const msg =
      e instanceof ImageGenError ? e.message : e instanceof Error ? e.message : '生成失败';
    patchGroup(set, id, { status: 'error', error: `生成失败：${msg}` });
  }
}
