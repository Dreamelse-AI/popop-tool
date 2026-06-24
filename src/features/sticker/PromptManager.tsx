import { useState } from 'react';
import { useStickerPromptStore } from './promptStore';
import { useEmotionStore } from './emotionStore';
import { useStickerStore } from './store';
import { buildStickerPrompt } from '@/services/stickerPromptBuilder';
import { STICKER_COUNT } from '@/types/sticker';

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
  const [showFull, setShowFull] = useState(false);

  const emotions = useEmotionStore((s) => s.emotions);
  const matting = useStickerStore((s) => s.matting);
  // 实时拼出最终送去出图的完整 prompt（与 store.generate 中一致），供用户审阅
  const fullPrompt = buildStickerPrompt(
    value || '（在上方填写主题/风格后这里会更新）',
    emotions.slice(0, STICKER_COUNT),
    matting,
  );

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
    <div className="pop-card">
      <div className="mb-2 flex items-center justify-between">
        <span className="pop-label">
          提示词
          <span className="ml-2 font-mono text-[11px] font-normal text-ink-3">
            含风格 / 文案 / 表情描述
          </span>
        </span>
        {editingId && (
          <button type="button" onClick={handleNewDraft} className="pop-link">
            新建（不覆盖当前预设）
          </button>
        )}
      </div>

      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="描述你想要的表情包：风格、人物气质、9 个表情的情绪、要带的文案等。例如：3D 卡通盲盒风格，圆润可爱，分别是开心、大笑、生气、哭、惊讶、害羞、思考、比心、调皮，配中文文案"
        rows={5}
        className="pop-textarea resize-y"
      />

      <div className="mt-2 rounded-pop border-2 border-dashed border-cream-line p-2">
        <button
          type="button"
          onClick={() => setShowFull((v) => !v)}
          className="flex w-full items-center justify-between text-xs font-semibold text-ink-2"
        >
          <span>完整提示词预览（含九宫格骨架 / 情绪 / 背景，实际送去出图的内容）</span>
          <span className="text-ink-3">{showFull ? '收起 ▲' : '展开 ▼'}</span>
        </button>
        {showFull && (
          <>
            <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap break-words rounded-pop border border-cream-line bg-code-bg p-2 font-mono text-[11px] leading-relaxed text-ink-2">
              {fullPrompt}
            </pre>
            <div className="mt-1.5 flex items-center justify-between">
              <span className="text-[11px] text-ink-3">
                上方输入框只写主题/风格段，其余骨架由系统自动拼接；情绪在「表情情绪」里改。
              </span>
              <button
                type="button"
                onClick={() => void navigator.clipboard?.writeText(fullPrompt)}
                className="pop-link shrink-0"
              >
                复制
              </button>
            </div>
          </>
        )}
      </div>

      <div className="mt-2 flex items-center gap-2">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={editingId ? '预设名称（修改中）' : '预设名称，便于复用'}
          className="pop-input flex-1 py-1.5"
        />
        <button
          type="button"
          onClick={handleSave}
          className="pop-btn-primary shrink-0 px-3 py-1.5 text-xs"
        >
          {editingId ? '更新预设' : '保存预设'}
        </button>
      </div>
      {error ? (
        <p className="mt-1.5 text-xs text-err">{error}</p>
      ) : (
        <p className="mt-1.5 text-xs text-ink-3">预设存在本地浏览器，可随时套用 / 修改 / 删除</p>
      )}

      {prompts.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5 border-t-2 border-dashed border-cream-line pt-3">
          {prompts.map((p) => {
            const active = editingId === p.id;
            return (
              <span key={p.id} className={active ? 'pop-chip-tag-on' : 'pop-chip-tag'}>
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
                  className="text-ink-3 hover:text-err"
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
