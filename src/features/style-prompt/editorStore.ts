/**
 * 画风工作台 store：三列布局的「选中项 + 草稿 + 脏标记」状态机。
 *
 * 选中项可能是：
 *   - 一条已存画风（key = 字符串 id）
 *   - 一个草稿（key = `draft-xxx`，尚未入库）
 * 中间面板编辑的是「当前选中项的缓冲副本」(fields)，与 baseline 对比得出 dirty，
 * 决定「保存」按钮是否亮起。草稿态右上角显示「新增到画风库」，已存态显示「删除 + 保存」。
 *
 * 图标两步法：用户选新图 → 调 upload_icon 拿 StorageObject 暂存到 pendingIcon（同时本地预览 iconPreview），
 * 真正生效在 save（把 pendingIcon 作为 style_icon 传回）。
 */

import { create } from 'zustand';
import type {
  StylePrompt,
  StylePromptStatus,
  StylePromptLanguage,
  StorageObject,
} from '@/types/stylePrompt';

/** 选中项的 key：字符串 id（已存画风）或 draft 字符串（草稿）。 */
export type SelectionKey = string;

/** 中间面板正在编辑的画风字段。 */
export interface StyleFields {
  styleName: string;
  stylePrompt: string;
  priority: number;
  status: StylePromptStatus;
  language: StylePromptLanguage;
  /** 当前封面预览 URL（已存图标签名直链，或新上传图标的临时 url）。 */
  iconPreview: string;
  /** 本次新上传的图标对象（save 时作为 style_icon 传回）；null = 未换图。 */
  pendingIcon: StorageObject | null;
}

/** 一个未入库的草稿。 */
export interface StyleDraft {
  key: string; // `draft-xxx`
  fields: StyleFields;
}

const EMPTY_FIELDS: StyleFields = {
  styleName: '',
  stylePrompt: '',
  priority: 0,
  status: 1,
  language: '',
  iconPreview: '',
  pendingIcon: null,
};

function fieldsFromStyle(s: StylePrompt): StyleFields {
  return {
    styleName: s.styleName,
    stylePrompt: s.stylePrompt,
    priority: s.priority,
    status: s.status,
    language: s.language,
    iconPreview: s.styleIcon,
    pendingIcon: null,
  };
}

function fieldsEqual(a: StyleFields, b: StyleFields): boolean {
  return (
    a.styleName === b.styleName &&
    a.stylePrompt === b.stylePrompt &&
    a.priority === b.priority &&
    a.status === b.status &&
    a.language === b.language &&
    // 换了新图标即视为脏；iconPreview 仅预览不参与（已通过 pendingIcon 体现）
    (a.pendingIcon?.url ?? '') === (b.pendingIcon?.url ?? '')
  );
}

interface StyleEditorState {
  /** 当前选中项 key；null 表示无选中。 */
  selected: SelectionKey | null;
  /** 草稿列表（点「+」新建产生）。 */
  drafts: StyleDraft[];
  /** 中间面板的编辑缓冲。 */
  fields: StyleFields;
  /** 选中项的原始值（用于 dirty 对比；草稿原始值为空字段）。 */
  baseline: StyleFields;

  /** 是否为草稿（selected 是 draft-key）。 */
  isDraft: () => boolean;
  /** 当前是否有未保存改动。 */
  isDirty: () => boolean;

  /** 选中一条已存画风，载入其字段。 */
  selectStyle: (s: StylePrompt) => void;
  /** 选中一个草稿。 */
  selectDraft: (key: string) => void;
  /** 新建一个空草稿并选中，返回其 key。 */
  addDraft: () => string;
  /** 移除一个草稿（入库成功或放弃时）。 */
  removeDraft: (key: string) => void;
  /** 更新编辑缓冲中的字段。 */
  setField: <K extends keyof StyleFields>(key: K, value: StyleFields[K]) => void;
  /** 设置新上传的图标（同时更新预览）。 */
  setPendingIcon: (obj: StorageObject) => void;
  /** 清空图标（移除当前封面，且不带新图标）。 */
  clearIcon: () => void;
  /** 把 baseline 重置为当前 fields（保存成功后调，清掉 dirty）。 */
  commitBaseline: () => void;
  /** 初始化：列表加载后若无选中，默认建一个草稿并选中。 */
  ensureSelection: () => void;
}

export const useStyleEditorStore = create<StyleEditorState>((set, get) => ({
  selected: null,
  drafts: [],
  fields: { ...EMPTY_FIELDS },
  baseline: { ...EMPTY_FIELDS },

  isDraft: () => {
    const sel = get().selected;
    return typeof sel === 'string' && sel.startsWith('draft-');
  },
  isDirty: () => !fieldsEqual(get().fields, get().baseline),

  selectStyle: (s) => {
    const f = fieldsFromStyle(s);
    set({ selected: s.id, fields: { ...f }, baseline: { ...f } });
  },

  selectDraft: (key) => {
    const d = get().drafts.find((x) => x.key === key);
    const f = d ? d.fields : { ...EMPTY_FIELDS };
    set({ selected: key, fields: { ...f }, baseline: { ...EMPTY_FIELDS } });
  },

  addDraft: () => {
    const key = `draft-${Date.now()}`;
    const draft: StyleDraft = { key, fields: { ...EMPTY_FIELDS } };
    set((s) => ({
      drafts: [...s.drafts, draft],
      selected: key,
      fields: { ...EMPTY_FIELDS },
      baseline: { ...EMPTY_FIELDS },
    }));
    return key;
  },

  removeDraft: (key) =>
    set((s) => ({ drafts: s.drafts.filter((d) => d.key !== key) })),

  setField: (key, value) =>
    set((s) => {
      const fields = { ...s.fields, [key]: value };
      const drafts =
        typeof s.selected === 'string' && s.selected.startsWith('draft-')
          ? s.drafts.map((d) => (d.key === s.selected ? { ...d, fields } : d))
          : s.drafts;
      return { fields, drafts };
    }),

  setPendingIcon: (obj) =>
    set((s) => {
      const fields = { ...s.fields, pendingIcon: obj, iconPreview: obj.url };
      const drafts =
        typeof s.selected === 'string' && s.selected.startsWith('draft-')
          ? s.drafts.map((d) => (d.key === s.selected ? { ...d, fields } : d))
          : s.drafts;
      return { fields, drafts };
    }),

  clearIcon: () =>
    set((s) => {
      const fields = { ...s.fields, pendingIcon: null, iconPreview: '' };
      const drafts =
        typeof s.selected === 'string' && s.selected.startsWith('draft-')
          ? s.drafts.map((d) => (d.key === s.selected ? { ...d, fields } : d))
          : s.drafts;
      return { fields, drafts };
    }),

  commitBaseline: () =>
    set((s) => {
      const fields = { ...s.fields, pendingIcon: null };
      return { fields, baseline: { ...fields } };
    }),

  ensureSelection: () => {
    if (get().selected === null) get().addDraft();
  },
}));
