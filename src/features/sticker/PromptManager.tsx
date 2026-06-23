import { useState } from 'react';
import { useStickerPromptStore } from './promptStore';

interface PromptManagerProps {
  /** 当前提示词正文（受控） */
  value: string;
  /** 提示词正文变化 */
  onChange: (prompt: string) => void;
}

/**
 * 提示词管理：填写/保存/修改/删除可复用的提示词预设，并把选中预设套用到输入框。
 * 预设持久化在浏览器本地（localStorage）。
 */
export function PromptManager({ value, onChange }: PromptManagerProps) {
  const prompts = useStickerPromptStore((s) => s.prompts);
  const addPrompt = useStickerPromptStore((s) => s.addPrompt);
  const updatePrompt = useStickerPromptStore((s) => s.updatePrompt);
  const removePrompt = useStickerPromptStore((s) => s.removePrompt);

  const [name, setName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSave = () => {
    if (!name.trim()) {
      setError('请填预设名称');
      return;
    }
    if (!value.trim()) {
      setError('提示词不能为空');
      return;
    }
    const ok = editingId
      ? updatePrompt(editingId, name, value)
      : addPrompt(name, value) !== null;
    if (!ok) {
      setError('名称重复或内容无效');
      return;
    }
    setName('');
    setEditingId(null);
    setError(null);
  };

  const handleApply = (id: string) => {
    const target = prompts.find((p) => p.id === id);
    if (!target) return;
    onChange(target.prompt);
    setName(target.name);
    setEditingId(id);
    setError(null);
  };

  const handleRemove = (id: string) => {
    removePrompt(id);
    if (editingId === id) {
      setEditingId(null);
      setName('');
    }
  };

  const handleNewDraft = () => {
    setEditingId(null);
    setName('');
    setError(null);
  };

  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-4">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-semibold text-neutral-700">
          提示词
          <span className="ml-2 text-xs font-normal text-neutral-400">
            含风格 / 文案 / 表情描述
          </span>
        </span>
        {editingId && (
          <button
            type="button"
            onClick={handleNewDraft}
            className="text-xs text-neutral-400 hover:text-neutral-700"
          >
            新建（不覆盖当前预设）
          </button>
        )}
      </div>

      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="描述你想要的表情包：风格、人物气质、9 个表情的情绪、要带的文案等。例如：3D 卡通盲盒风格，圆润可爱，分别是开心、大笑、生气、哭、惊讶、害羞、思考、比心、调皮，配中文文案"
        rows={5}
        className="w-full resize-y rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-neutral-900 focus:outline-none"
      />

      <div className="mt-2 flex items-center gap-2">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={editingId ? '预设名称（修改中）' : '预设名称，便于复用'}
          className="flex-1 rounded-md border border-neutral-300 px-3 py-1.5 text-sm focus:border-neutral-900 focus:outline-none"
        />
        <button
          type="button"
          onClick={handleSave}
          className="shrink-0 rounded-md bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-neutral-700"
        >
          {editingId ? '更新预设' : '保存预设'}
        </button>
      </div>
      {error ? (
        <p className="mt-1.5 text-xs text-red-500">{error}</p>
      ) : (
        <p className="mt-1.5 text-xs text-neutral-400">预设存在本地浏览器，可随时套用 / 修改 / 删除</p>
      )}

      {prompts.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5 border-t border-neutral-100 pt-3">
          {prompts.map((p) => {
            const active = editingId === p.id;
            return (
              <span
                key={p.id}
                className={
                  active
                    ? 'inline-flex items-center gap-1 rounded-full border border-neutral-900 bg-neutral-900 px-3 py-1 text-xs font-medium text-white'
                    : 'inline-flex items-center gap-1 rounded-full border border-neutral-200 bg-white px-3 py-1 text-xs text-neutral-600'
                }
              >
                <button
                  type="button"
                  onClick={() => handleApply(p.id)}
                  title={p.prompt}
                  className="max-w-[160px] truncate"
                >
                  {p.name}
                </button>
                <button
                  type="button"
                  onClick={() => handleRemove(p.id)}
                  aria-label={`删除 ${p.name}`}
                  className={
                    active ? 'text-white/70 hover:text-white' : 'text-neutral-400 hover:text-red-500'
                  }
                >
                  ✕
                </button>
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}
