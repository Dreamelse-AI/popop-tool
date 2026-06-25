import { useRef, useState, type DragEvent } from 'react';

interface PaletteDropzoneProps {
  /** 接收一个图片文件（拖入或选择） */
  onFile: (file: File) => void;
  /** 是否正在分析（禁用交互、显示状态） */
  busy: boolean;
}

/**
 * 配色上传拖拽框：支持把图片拖进来，或点击选择。
 * 只取第一张图片文件交给上层分析。
 */
export function PaletteDropzone({ onFile, busy }: PaletteDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const pickFirstImage = (files: FileList | null): File | null => {
    if (!files) return null;
    return Array.from(files).find((f) => f.type.startsWith('image/')) ?? null;
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    if (busy) return;
    const file = pickFirstImage(e.dataTransfer.files);
    if (file) onFile(file);
  };

  const handleSelect = (files: FileList | null) => {
    const file = pickFirstImage(files);
    if (file) onFile(file);
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        if (!busy) setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      onClick={() => !busy && inputRef.current?.click()}
      role="button"
      tabIndex={0}
      aria-disabled={busy}
      onKeyDown={(e) => {
        if ((e.key === 'Enter' || e.key === ' ') && !busy) inputRef.current?.click();
      }}
      className={
        dragging
          ? 'flex min-h-44 cursor-pointer flex-col items-center justify-center rounded-pop-lg border-2 border-ink bg-cream-soft p-6 text-center shadow-sticker transition'
          : 'flex min-h-44 cursor-pointer flex-col items-center justify-center rounded-pop-lg border-2 border-dashed border-cream-2 bg-paper p-6 text-center transition hover:bg-cream-soft'
      }
    >
      {busy ? (
        <>
          <span className="pop-spinner mb-3" aria-hidden="true" />
          <span className="font-display text-sm font-bold text-ink">分析配色中…</span>
          <span className="mt-1 font-mono text-[11px] text-ink-3">提取主色 + AI 命名</span>
        </>
      ) : (
        <>
          <span className="font-display text-3xl leading-none text-ink-3">＋</span>
          <span className="mt-2 font-display text-sm font-bold text-ink">
            {dragging ? '松手放入图片' : '拖入图片，或点击选择'}
          </span>
          <span className="mt-1 font-mono text-[11px] text-ink-3">
            自动识别配色 · 命名 · 情绪场景
          </span>
        </>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => handleSelect(e.target.files)}
      />
    </div>
  );
}
