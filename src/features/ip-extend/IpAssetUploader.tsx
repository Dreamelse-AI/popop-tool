/**
 * IP 素材上传行：一组缩略图 + 上传按钮。选图后转 base64 在内存里用（暂不上传存储）。
 * 用于「IP 形象图」与「表情包参考图」两组（role 区分）。
 */

import { useRef, useState } from 'react';
import type { IpAssetImage, IpAssetRole } from '@/types/ipExtend';
import { filesToDataUrls } from '@/features/sticker/fileToDataUrl';

interface IpAssetUploaderProps {
  label: string;
  hint: string;
  role: IpAssetRole;
  images: IpAssetImage[];
  /** 上传成功（已落 OSS）后回调。 */
  onAdd: (images: IpAssetImage[]) => void;
  onRemove: (url: string) => void;
  /** 是否禁用（如未选中 IP 档案时）。 */
  disabled?: boolean;
}

export function IpAssetUploader({
  label,
  hint,
  role,
  images,
  onAdd,
  onRemove,
  disabled,
}: IpAssetUploaderProps) {
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
      onAdd(dataUrls.map((url) => ({ url, role })));
    } catch (e) {
      setError(e instanceof Error ? e.message : '处理图片失败');
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <div>
      <div className="pop-label mb-1.5">
        {label}
        <span className="ml-2 font-mono text-[11px] font-normal text-ink-3">{hint}</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {images.map((img) => (
          <div
            key={img.url}
            className="group relative h-20 w-20 overflow-hidden rounded-pop border-2 border-ink bg-soft"
          >
            <img src={img.url} alt={label} className="h-full w-full object-cover" />
            <button
              type="button"
              onClick={() => onRemove(img.url)}
              aria-label="移除"
              className="absolute right-0.5 top-0.5 flex h-5 w-5 items-center justify-center rounded-full border border-cream bg-ink text-xs text-cream opacity-0 transition group-hover:opacity-100"
            >
              ✕
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy || disabled}
          className="flex h-20 w-20 flex-col items-center justify-center rounded-pop border-2 border-dashed border-cream-2 text-xs text-ink-3 transition hover:bg-cream-soft hover:text-ink disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? (
            '上传中…'
          ) : (
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
        accept="image/jpeg,image/png,image/webp,image/gif"
        multiple
        className="hidden"
        onChange={(e) => void handleFiles(e.target.files)}
      />
      {error && <p className="mt-2 text-xs text-err">{error}</p>}
    </div>
  );
}
