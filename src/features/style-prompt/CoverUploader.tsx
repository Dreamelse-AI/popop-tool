/**
 * 画风封面图上传：选本地图 → 转 base64 → 上传 OSS → 回填 url。
 * 支持显示已有封面、替换、清空。单张。
 */

import { useRef, useState } from 'react';
import { filesToDataUrls } from '@/features/sticker/fileToDataUrl';
import { uploadStyleCover } from '@/services/styleCover';

interface CoverUploaderProps {
  /** 当前封面 URL（已上传的）。 */
  value: string;
  /** 上传成功后回填 URL；清空时回传空串。 */
  onChange: (url: string) => void;
}

export function CoverUploader({ value, onChange }: CoverUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      const dataUrls = await filesToDataUrls(files);
      if (dataUrls.length === 0) {
        setError('请选择图片文件');
        return;
      }
      const url = await uploadStyleCover(dataUrls[0]);
      onChange(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : '上传封面失败');
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
              onClick={() => onChange('')}
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
        accept="image/*"
        className="hidden"
        onChange={(e) => void handleFiles(e.target.files)}
      />
      {error && <p className="mt-2 text-xs text-err">{error}</p>}
    </div>
  );
}
