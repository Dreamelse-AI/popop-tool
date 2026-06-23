import { useState } from 'react';
import { useCustomStyleStore } from './customStyleStore';

interface StyleManagerProps {
  /** 当前选中的 style id 数组（三态） */
  selected: string[];
  onToggle: (id: string) => void;
  onClear: () => void;
}

/**
 * Style 风格管理：用户自填（名称 + 提示词）、可保存、可删除。
 * 已保存的风格以三态 chip 形式参与选择（不选=全部随机，锁定，多选随机）。
 */
export function StyleManager({ selected, onToggle, onClear }: StyleManagerProps) {
  const styles = useCustomStyleStore((s) => s.styles);
  const addStyle = useCustomStyleStore((s) => s.addStyle);
  const removeStyle = useCustomStyleStore((s) => s.removeStyle);

  const [name, setName] = useState('');
  const [prompt, setPrompt] = useState('');
  const [error, setError] = useState<string | null>(null);

  const hint =
    styles.length === 0
      ? '未添加'
      : selected.length === 0
        ? '随机'
        : selected.length === 1
          ? '锁定'
          : `${selected.length} 选随机`;

  const handleAdd = () => {
    if (!name.trim() || !prompt.trim()) {
      setError('名称和提示词都要填');
      return;
    }
    const ok = addStyle(name, prompt);
    if (!ok) {
      setError('名称重复或无效');
      return;
    }
    setName('');
    setPrompt('');
    setError(null);
  };

  const handleRemove = (id: string) => {
    if (selected.includes(id)) onToggle(id); // 删除前先取消选中
    removeStyle(id);
  };

  return (
    <div className="pop-card">
      <div className="mb-2 flex items-center justify-between">
        <span className="pop-label">
          Style 风格
          <span className="ml-2 font-mono text-[11px] font-normal text-ink-3">{hint}</span>
        </span>
        {selected.length > 0 && (
          <button type="button" onClick={onClear} className="pop-link">
            清空选择
          </button>
        )}
      </div>

      {styles.length === 0 ? (
        <p className="mb-3 text-xs text-ink-3">
          还没有风格。在下方填名称和提示词，保存后即可参与生成。
        </p>
      ) : (
        <div className="mb-3 flex flex-wrap gap-1.5">
          {styles.map((s) => {
            const active = selected.includes(s.id);
            return (
              <span
                key={s.id}
                className={
                  active
                    ? 'inline-flex items-center gap-1 rounded-full border-2 border-ink bg-cream px-3 py-1 text-xs font-bold text-ink shadow-sticker-sm'
                    : 'inline-flex items-center gap-1 rounded-full border-2 border-ink bg-paper px-3 py-1 text-xs font-semibold text-ink'
                }
              >
                <button
                  type="button"
                  onClick={() => onToggle(s.id)}
                  title={s.promptFragment}
                  className="max-w-[160px] truncate"
                >
                  {s.name}
                </button>
                <button
                  type="button"
                  onClick={() => handleRemove(s.id)}
                  aria-label={`删除 ${s.name}`}
                  className="text-ink-3 hover:text-err"
                >
                  ✕
                </button>
              </span>
            );
          })}
        </div>
      )}

      <div className="flex flex-col gap-2 border-t-2 border-dashed border-cream-line pt-3">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="风格名称，如 Apple Intelligence"
          className="pop-input py-1.5"
        />
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="风格提示词（英文，描述整体视觉风格）"
          rows={2}
          className="pop-textarea resize-y py-1.5"
        />
        <div className="flex items-center justify-between">
          {error ? (
            <span className="text-xs text-err">{error}</span>
          ) : (
            <span className="text-xs text-ink-3">保存后存在本地浏览器</span>
          )}
          <button type="button" onClick={handleAdd} className="pop-btn-primary px-3 py-1.5 text-xs">
            保存风格
          </button>
        </div>
      </div>
    </div>
  );
}
