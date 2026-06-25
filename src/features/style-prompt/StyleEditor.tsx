/**
 * 画风编辑弹窗（左侧画风库「编辑」用）。
 *
 * 字段：名称、封面图、画风 prompt、优先级。带入已有值，提交走 store.update。
 * （新增画风的入口在右侧测试区，测完直接入库，不走本弹窗。）
 */

import { useEffect, useState } from 'react';
import type { StylePrompt } from '@/types/stylePrompt';
import { useStyleLibraryStore } from './libraryStore';
import { CoverUploader } from './CoverUploader';

interface StyleEditorProps {
  /** 编辑目标；为 null 表示新增（兜底）。 */
  target: StylePrompt | null;
  onClose: () => void;
  onSaved?: () => void;
}

export function StyleEditor({ target, onClose, onSaved }: StyleEditorProps) {
  const isEdit = target !== null;
  const { create, update, submitting } = useStyleLibraryStore();

  const [styleName, setStyleName] = useState('');
  const [styleIcon, setStyleIcon] = useState('');
  const [stylePrompt, setStylePrompt] = useState('');
  const [priority, setPriority] = useState(0);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (target) {
      setStyleName(target.styleName);
      setStyleIcon(target.styleIcon);
      setStylePrompt(target.stylePrompt);
      setPriority(target.priority);
    } else {
      setStyleName('');
      setStyleIcon('');
      setStylePrompt('');
      setPriority(0);
    }
  }, [target]);

  const handleSubmit = async () => {
    setFormError(null);
    if (!styleName.trim()) {
      setFormError('画风名称必填');
      return;
    }
    const ok = isEdit
      ? await update({
          id: target.id,
          styleName: styleName.trim(),
          styleIcon,
          stylePrompt,
          priority,
        })
      : await create({
          styleName: styleName.trim(),
          styleIcon,
          stylePrompt,
          priority,
        });
    if (ok) {
      onSaved?.();
      onClose();
    } else {
      setFormError(useStyleLibraryStore.getState().errorMessage ?? '保存失败');
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/45 p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[88vh] w-full max-w-lg overflow-auto rounded-pop-xl border-2 border-ink bg-paper p-5 shadow-sticker-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-base font-extrabold text-ink">
            {isEdit ? '编辑画风' : '新增画风'}
          </h2>
          <button type="button" onClick={onClose} className="text-ink-3 hover:text-ink" aria-label="关闭">
            ✕
          </button>
        </div>

        <div className="flex flex-col gap-4">
          <div>
            <div className="pop-label mb-1.5">画风名称 *</div>
            <input
              value={styleName}
              onChange={(e) => setStyleName(e.target.value)}
              className="pop-input w-full py-1.5"
              placeholder="如：吉卜力水彩"
            />
          </div>

          <CoverUploader value={styleIcon} onChange={setStyleIcon} />

          <div>
            <div className="pop-label mb-1.5">画风 Prompt</div>
            <textarea
              value={stylePrompt}
              onChange={(e) => setStylePrompt(e.target.value)}
              rows={5}
              className="pop-input w-full resize-y py-2 font-mono text-xs leading-relaxed"
              placeholder="描述该画风的英文 prompt 片段"
            />
          </div>

          <div>
            <div className="pop-label mb-1.5">优先级</div>
            <input
              type="number"
              value={priority}
              onChange={(e) => setPriority(Math.floor(Number(e.target.value)) || 0)}
              className="pop-input w-28 py-1.5"
            />
            <span className="ml-2 text-xs text-ink-3">越大越靠前</span>
          </div>

          {formError && <p className="pop-callout-err">{formError}</p>}

          <div className="flex justify-end gap-3 pt-1">
            <button type="button" onClick={onClose} className="pop-btn-secondary">
              取消
            </button>
            <button
              type="button"
              onClick={() => void handleSubmit()}
              disabled={submitting}
              className="pop-btn-primary"
            >
              {submitting ? '保存中…' : '保存'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
