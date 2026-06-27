/**
 * 排版参数提取工具 store。
 *
 * 一张图片 = 一条记录（record），流程：
 *   1. 转 data URI（压缩）
 *   2. 调多模态模型 → LayoutParamTemplate（排版参数模版）
 *   3. 右侧以 JSON 草稿呈现，可手动编辑（实时校验），导出时以草稿为准
 *
 * 多张图用并发 worker 池处理（同提示词提取工具）。
 * 纯前端：不落服务器，导出文件即产物。
 */

import { create } from 'zustand';
import { fileToDataUrl } from '@/features/palette/fileToDataUrl';
import { extractLayoutParam } from '@/services/layoutParamExtractor';
import type { LayoutParamRecord, LayoutParamTemplate } from '@/types/layoutParam';
import { MAX_BATCH } from '@/types/layoutParam';

/** 并发上限，避免打爆 apimart。 */
const CONCURRENCY = 2;

interface LayoutParamState {
  records: LayoutParamRecord[];
  /** 是否有分析任务进行中（控制全局按钮态）。 */
  busy: boolean;
  /** 当前批次取消器。 */
  _abort: AbortController | null;

  /** 接收一批图片文件，逐个建记录并自动分析。 */
  addFiles: (files: File[]) => Promise<void>;
  /** 编辑某条记录的 JSON 草稿（实时校验）。 */
  setDraftJson: (id: string, json: string) => void;
  /** 重新分析某条记录。 */
  reanalyze: (id: string) => Promise<void>;
  /** 移除一条记录。 */
  remove: (id: string) => void;
  /** 清空全部并取消进行中任务。 */
  clearAll: () => void;
  /** 取消进行中任务。 */
  cancel: () => void;
}

export const useLayoutParamStore = create<LayoutParamState>((set, get) => ({
  records: [],
  busy: false,
  _abort: null,

  addFiles: async (files) => {
    const images = files.filter((f) => f.type.startsWith('image/')).slice(0, MAX_BATCH);
    if (images.length === 0) return;

    const controller = get()._abort ?? new AbortController();
    const newRecords: LayoutParamRecord[] = images.map((_, i) => ({
      id: `${Date.now()}-${i}-${Math.random().toString(36).slice(2, 6)}`,
      sourceUrl: '',
      status: 'pending',
      draftJson: '',
    }));

    set((s) => ({
      records: [...newRecords, ...s.records],
      busy: true,
      _abort: controller,
    }));

    // 先把每张图转 data URI（失败的记录直接落 error）
    await Promise.all(
      newRecords.map(async (rec, i) => {
        try {
          const url = await fileToDataUrl(images[i]);
          patch(set, rec.id, { sourceUrl: url });
        } catch (e) {
          const msg = e instanceof Error ? e.message : '读取图片失败';
          patch(set, rec.id, { status: 'error', error: msg });
        }
      }),
    );

    const ids = newRecords.map((r) => r.id);
    let cursor = 0;
    const runOne = async (): Promise<void> => {
      while (true) {
        if (controller.signal.aborted) return;
        const idx = cursor++;
        if (idx >= ids.length) return;
        await analyzeOne(get, set, ids[idx], controller.signal);
      }
    };
    const workers = Array.from({ length: Math.min(CONCURRENCY, ids.length) }, runOne);
    await Promise.all(workers);

    if (get()._abort === controller) set({ busy: false, _abort: null });
  },

  setDraftJson: (id, json) => {
    let jsonError: string | undefined;
    try {
      JSON.parse(json);
    } catch {
      jsonError = 'JSON 格式有误，无法解析';
    }
    patch(set, id, { draftJson: json, jsonError });
  },

  reanalyze: async (id) => {
    const rec = get().records.find((r) => r.id === id);
    if (!rec || !rec.sourceUrl) return;
    const controller = get()._abort ?? new AbortController();
    set({ busy: true, _abort: controller });
    await analyzeOne(get, set, id, controller.signal);
    if (get()._abort === controller && !anyBusy(get)) set({ busy: false, _abort: null });
  },

  remove: (id) => set((s) => ({ records: s.records.filter((r) => r.id !== id) })),

  clearAll: () => {
    get()._abort?.abort();
    set({ records: [], busy: false, _abort: null });
  },

  cancel: () => {
    get()._abort?.abort();
    set({ busy: false, _abort: null });
  },
}));

type SetState = (fn: (s: LayoutParamState) => Partial<LayoutParamState>) => void;
type GetState = () => LayoutParamState;

/** 局部更新某条记录。 */
function patch(set: SetState, id: string, p: Partial<LayoutParamRecord>): void {
  set((s) => ({ records: s.records.map((r) => (r.id === id ? { ...r, ...p } : r)) }));
}

/** 是否仍有记录在分析中。 */
function anyBusy(get: GetState): boolean {
  return get().records.some((r) => r.status === 'analyzing');
}

/** 分析单条记录：调模型 → 写入模版 + 初始化 JSON 草稿。 */
async function analyzeOne(
  get: GetState,
  set: SetState,
  id: string,
  signal: AbortSignal,
): Promise<void> {
  const rec = get().records.find((r) => r.id === id);
  if (!rec || !rec.sourceUrl) return;
  patch(set, id, { status: 'analyzing', error: undefined });
  try {
    const template = await extractLayoutParam(rec.sourceUrl, id, signal);
    patch(set, id, {
      status: 'done',
      template,
      draftJson: JSON.stringify(template, null, 2),
      jsonError: undefined,
    });
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') return;
    const msg = e instanceof Error ? e.message : '分析失败';
    patch(set, id, { status: 'error', error: `分析失败：${msg}` });
  }
}

/** 从一条记录的 JSON 草稿安全解析出模版（解析失败回退到原 template）。 */
export function resolveTemplate(rec: LayoutParamRecord): LayoutParamTemplate | null {
  if (rec.jsonError) return rec.template ?? null;
  if (!rec.draftJson.trim()) return rec.template ?? null;
  try {
    return JSON.parse(rec.draftJson) as LayoutParamTemplate;
  } catch {
    return rec.template ?? null;
  }
}
