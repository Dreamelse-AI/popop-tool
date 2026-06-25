/**
 * 画风图标上传：选本地图 → 调后端 upload_icon（multipart）拿 StorageObject → 暂存。
 *
 * 两步法：上传只是「暂存」，真正生效在画风 save（把 StorageObject 作为 style_icon 传回）。
 * 支持显示已有封面（签名直链）/ 新上传预览、替换、清空。单张。
 * 限制：jpg / png / webp / gif，≤ 8MB（与后端一致）。
 */

import { useRef, useState } from 'react';
import { uploadStyleIcon } from '@/services/stylePrompt';
import type { StorageObject } from '@/types/stylePrompt';

const MAX_BYTES = 8 * 1024 * 1024;
const ACCEPT_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

interface CoverUploaderProps {
  /** 当前封面预览 URL（已有图标签名直链或新上传 url）。 */
  value: string;
  /** 上传成功（拿到 StorageObject）后回调。 */
  onUpload: (obj: StorageObject) => void;
  /** 清空封面回调。 */
  onClear: () => void;
}

export function CoverUploader({ value, onUpload, onClear }: CoverUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFiles = async (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    if (!ACCEPT_TYPES.includes(file.type)) {
      setError('仅支持 jpg / png / webp / gif');
      return;
    }
    if (file.size > MAX_BYTES) {
      setError('图片不能超过 8MB');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const obj = await uploadStyleIcon(file);
      onUpload(obj);
    } catch (e) {
      setError(e instanceof Error ? e.message : '上传图标失败');
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <div>
      <div className="pop-label mb-1.5">封面图</div>
      <div className="flex items-start gap-3">
        {value ? (
          <div className="group relative h-24 w-24 overflow-hidden rounded-pop border-2 border-ink bg-soft">
            <img src={value} alt="封面" className="h-full w-full object-cover" />
            <button
              type="button"
              onClick={onClear}
              aria-label="移除封面"
              className="absolute right-0.5 top-0.5 flex h-5 w-5 items-center justify-center rounded-full border border-cream bg-ink text-xs text-cream opacity-0 transition group-hover:opacity-100"
            >
              ✕
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
            className="flex h-24 w-24 flex-col items-center justify-center rounded-pop border-2 border-dashed border-cream-2 text-xs text-ink-3 transition hover:bg-cream-soft hover:text-ink disabled:cursor-not-allowed"
          >
            {busy ? (
              '上传中…'
            ) : (
              <>
                <span className="text-lg leading-none">＋</span>
                <span className="mt-1">上传封面</span>
              </>
            )}
          </button>
        )}
        {value && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
            className="pop-link"
          >
            {busy ? '上传中…' : '替换'}
          </button>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT_TYPES.join(',')}
        className="hidden"
        onChange={(e) => void handleFiles(e.target.files)}
      />
      {error && <p className="mt-2 text-xs text-err">{error}</p>}
    </div>
  );
}
