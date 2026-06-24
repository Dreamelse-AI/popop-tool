import { useState } from 'react';
import {
  usePromptTemplateStore,
  FIELD_ORDER,
  FIELD_LABELS,
  DEFAULT_FIELDS,
  type PromptFieldKey,
} from './promptTemplateStore';
import { useStickerStore } from './store';

/**
 * 提示词骨架字段：把固定骨架拆成命名字段，平时只读展示，点击单个字段才进入编辑。
 * 支持单字段恢复默认 / 全部恢复默认。改动持久化在本地（promptTemplateStore）。
 * background 字段仅在抠图模式下生效，非抠图时标注「当前不生效」。
 */
export function PromptSkeletonFields() {
  const fields = usePromptTemplateStore((s) => s.fields);
  const setField = usePromptTemplateStore((s) => s.setField);
  const resetField = usePromptTemplateStore((s) => s.resetField);
  const resetAll = usePromptTemplateStore((s) => s.resetAll);
  const matting = useStickerStore((s) => s.matting);

  const [open, setOpen] = useState(false);
  const [editingKey, setEditingKey] = useState<PromptFieldKey | null>(null);
  const [draft, setDraft] = useState('');

  const startEdit = (key: PromptFieldKey) => {
    setEditingKey(key);
    setDraft(fields[key]);
  };
  const commit = () => {
    if (editingKey) setField(editingKey, draft.trim() || DEFAULT_FIELDS[editingKey]);
    setEditingKey(null);
  };

  const isCustom = (key: PromptFieldKey) => fields[key] !== DEFAULT_FIELDS[key];

  return (
    <div className="pop-card">
      <div className="mb-1 flex items-center justify-between">
        <span className="pop-label">
          提示词骨架
          <span className="ml-2 font-mono text-[11px] font-normal text-ink-3">
            固定结构，点击字段可改
          </span>
        </span>
        <button type="button" onClick={() => setOpen((v) => !v)} className="pop-link">
          {open ? '收起 ▲' : '展开 ▼'}
        </button>
      </div>

      {open && (
        <div className="flex flex-col gap-2">
          {FIELD_ORDER.map((key) => {
            const inactive = key === 'background' && matting !== 'colorKey';
            const editing = editingKey === key;
            return (
              <div key={key} className="rounded-pop border border-cream-line p-2">
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-xs font-semibold text-ink-2">
                    {FIELD_LABELS[key]}
                    {isCustom(key) && <span className="ml-1.5 text-[10px] text-ok">已改</span>}
                    {inactive && <span className="ml-1.5 text-[10px] text-ink-3">当前不生效</span>}
                  </span>
                  <div className="flex items-center gap-2">
                    {isCustom(key) && !editing && (
                      <button type="button" onClick={() => resetField(key)} className="pop-link">
                        恢复默认
                      </button>
                    )}
                    {!editing ? (
                      <button type="button" onClick={() => startEdit(key)} className="pop-link">
                        修改
                      </button>
                    ) : (
                      <button type="button" onClick={commit} className="pop-link">
                        完成
                      </button>
                    )}
                  </div>
                </div>
                {editing ? (
                  <textarea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    rows={4}
                    autoFocus
                    className="pop-textarea resize-y font-mono text-[11px]"
                  />
                ) : (
                  <p
                    className={
                      inactive
                        ? 'cursor-pointer font-mono text-[11px] leading-relaxed text-ink-3 line-through'
                        : 'cursor-pointer font-mono text-[11px] leading-relaxed text-ink-2'
                    }
                    onClick={() => startEdit(key)}
                    title="点击修改"
                  >
                    {fields[key]}
                  </p>
                )}
              </div>
            );
          })}

          <div className="flex items-center justify-between border-t-2 border-dashed border-cream-line pt-2">
            <span className="text-[11px] text-ink-3">
              情绪段由「表情情绪」自动注入，主题段在上方输入框填写
            </span>
            <button type="button" onClick={resetAll} className="pop-link">
              全部恢复默认
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
