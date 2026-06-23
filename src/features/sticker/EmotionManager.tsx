import { useState } from 'react';
import { useEmotionStore } from './emotionStore';

/**
 * 情绪管理：九宫格 9 格对应的情绪，可增加 / 修改 / 删除 / 恢复默认。
 * 持久化在浏览器本地。出图时按此列表顺序逐格注入。
 */
export function EmotionManager() {
  const emotions = useEmotionStore((s) => s.emotions);
  const addEmotion = useEmotionStore((s) => s.addEmotion);
  const updateEmotion = useEmotionStore((s) => s.updateEmotion);
  const removeEmotion = useEmotionStore((s) => s.removeEmotion);
  const resetEmotions = useEmotionStore((s) => s.resetEmotions);

  const [label, setLabel] = useState('');
  const [en, setEn] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const overflow = emotions.length > 9;

  const handleSave = () => {
    if (!label.trim() || !en.trim()) {
      setError('中文标签和英文描述都要填');
      return;
    }
    const ok = editingId
      ? updateEmotion(editingId, label, en)
      : addEmotion(label, en);
    if (!ok) {
      setError('标签重复或内容无效');
      return;
    }
    setLabel('');
    setEn('');
    setEditingId(null);
    setError(null);
  };

  const handleEdit = (id: string) => {
    const t = emotions.find((e) => e.id === id);
    if (!t) return;
    setLabel(t.label);
    setEn(t.en);
    setEditingId(id);
    setError(null);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setLabel('');
    setEn('');
    setError(null);
  };

  return (
    <div className="pop-card">
      <div className="mb-2 flex items-center justify-between">
        <span className="pop-label">
          表情情绪
          <span className="ml-2 font-mono text-[11px] font-normal text-ink-3">
            九宫格按顺序取前 9 个
          </span>
        </span>
        <button type="button" onClick={resetEmotions} className="pop-link">
          恢复默认
        </button>
      </div>

      <div className="mb-3 flex flex-wrap gap-1.5">
        {emotions.map((e, i) => {
          const active = editingId === e.id;
          const ignored = i >= 9;
          return (
            <span
              key={e.id}
              className={active ? 'pop-chip-tag-on' : ignored ? 'pop-chip-tag-muted' : 'pop-chip-tag'}
            >
              <button
                type="button"
                onClick={() => handleEdit(e.id)}
                title={e.en}
                className="max-w-[120px] truncate"
              >
                {i < 9 ? `${i + 1}.` : ''} {e.label}
              </button>
              <button
                type="button"
                onClick={() => removeEmotion(e.id)}
                aria-label={`删除 ${e.label}`}
                className="text-ink-3 hover:text-err"
              >
                ✕
              </button>
            </span>
          );
        })}
      </div>

      {overflow && (
        <p className="mb-2 text-xs text-warn">
          当前 {emotions.length} 个，超出 9 个的（虚线）不会出现在九宫格里。
        </p>
      )}

      <div className="flex flex-col gap-2 border-t-2 border-dashed border-cream-line pt-3">
        <div className="flex gap-2">
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="中文标签，如 期待"
            className="pop-input w-28 shrink-0 py-1.5"
          />
          <input
            type="text"
            value={en}
            onChange={(e) => setEn(e.target.value)}
            placeholder="英文描述，如 excited, looking forward"
            className="pop-input flex-1 py-1.5"
          />
        </div>
        <div className="flex items-center justify-between">
          {error ? (
            <span className="text-xs text-err">{error}</span>
          ) : (
            <span className="text-xs text-ink-3">
              {editingId ? '修改中…' : '英文描述用于让模型更准确理解情绪'}
            </span>
          )}
          <div className="flex gap-2">
            {editingId && (
              <button
                type="button"
                onClick={handleCancelEdit}
                className="pop-btn-secondary px-3 py-1.5 text-xs"
              >
                取消
              </button>
            )}
            <button
              type="button"
              onClick={handleSave}
              className="pop-btn-primary px-3 py-1.5 text-xs"
            >
              {editingId ? '更新' : '添加情绪'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
