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
    <div className="rounded-lg border border-neutral-200 bg-white p-4">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-semibold text-neutral-700">
          Style 风格
          <span className="ml-2 text-xs font-normal text-neutral-400">{hint}</span>
        </span>
        {selected.length > 0 && (
          <button
            type="button"
            onClick={onClear}
            className="text-xs text-neutral-400 hover:text-neutral-700"
          >
            清空选择
          </button>
        )}
      </div>

      {styles.length === 0 ? (
        <p className="mb-3 text-xs text-neutral-400">
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
                    ? 'inline-flex items-center gap-1 rounded-full border border-neutral-900 bg-neutral-900 px-3 py-1 text-xs font-medium text-white'
                    : 'inline-flex items-center gap-1 rounded-full border border-neutral-200 bg-white px-3 py-1 text-xs text-neutral-600'
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
                  className={active ? 'text-white/70 hover:text-white' : 'text-neutral-400 hover:text-red-500'}
                >
                  ✕
                </button>
              </span>
            );
          })}
        </div>
      )}

      <div className="flex flex-col gap-2 border-t border-neutral-100 pt-3">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="风格名称，如 Apple Intelligence"
          className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm focus:border-neutral-900 focus:outline-none"
        />
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="风格提示词（英文，描述整体视觉风格）"
          rows={2}
          className="resize-y rounded-md border border-neutral-300 px-3 py-1.5 text-sm focus:border-neutral-900 focus:outline-none"
        />
        <div className="flex items-center justify-between">
          {error ? (
            <span className="text-xs text-red-500">{error}</span>
          ) : (
            <span className="text-xs text-neutral-400">保存后存在本地浏览器</span>
          )}
          <button
            type="button"
            onClick={handleAdd}
            className="rounded-md bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-neutral-700"
          >
            保存风格
          </button>
        </div>
      </div>
    </div>
  );
}
