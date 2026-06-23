import { useRef, useState } from 'react';
import { filesToDataUrls } from './fileToDataUrl';

interface ReferenceUploaderProps {
  images: string[];
  onAdd: (dataUrls: string[]) => void;
  onRemove: (index: number) => void;
  onClear: () => void;
}

/**
 * 人物形象上传：选择本地图片 → 压缩转 base64 → 交给上层喂图生图。
 * 支持多张（最多 16 张，由 store 截断），可单张删除。
 */
export function ReferenceUploader({ images, onAdd, onRemove, onClear }: ReferenceUploaderProps) {
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
      onAdd(dataUrls);
    } catch (e) {
      setError(e instanceof Error ? e.message : '处理图片失败');
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <div className="pop-card">
      <div className="mb-2 flex items-center justify-between">
        <span className="pop-label">
          人物形象
          <span className="ml-2 font-mono text-[11px] font-normal text-ink-3">
            上传参考图，决定表情包里的人物
          </span>
        </span>
        {images.length > 0 && (
          <button type="button" onClick={onClear} className="pop-link">
            清空
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {images.map((src, i) => (
          <div
            key={i}
            className="group relative h-20 w-20 overflow-hidden rounded-pop border-2 border-ink bg-soft"
          >
            <img src={src} alt={`参考图 ${i + 1}`} className="h-full w-full object-cover" />
            <button
              type="button"
              onClick={() => onRemove(i)}
              aria-label={`删除参考图 ${i + 1}`}
              className="absolute right-0.5 top-0.5 flex h-5 w-5 items-center justify-center rounded-full border border-cream bg-ink text-xs text-cream opacity-0 transition group-hover:opacity-100"
            >
              ✕
            </button>
          </div>
        ))}

        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className="flex h-20 w-20 flex-col items-center justify-center rounded-pop border-2 border-dashed border-cream-2 text-xs text-ink-3 transition hover:bg-cream-soft hover:text-ink disabled:cursor-not-allowed"
        >
          {busy ? '处理中…' : (
            <>
              <span className="text-lg leading-none">＋</span>
              <span className="mt-1">上传</span>
            </>
          )}
        </button>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => void handleFiles(e.target.files)}
      />

      {error && <p className="mt-2 text-xs text-err">{error}</p>}
    </div>
  );
}
