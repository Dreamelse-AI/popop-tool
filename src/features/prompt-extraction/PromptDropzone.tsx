import { useEffect, useRef, useState, type DragEvent } from 'react';

interface PromptDropzoneProps {
  /** 接收一批图片文件（拖入 / 选择 / 粘贴），多张一起处理。 */
  onFiles: (files: File[]) => void;
  /** 是否有分析/生成任务进行中（仅展示状态，不阻断继续添加）。 */
  busy: boolean;
}

/** 从 FileList 里筛出图片文件。 */
function pickImages(files: FileList | null): File[] {
  if (!files) return [];
  return Array.from(files).filter((f) => f.type.startsWith('image/'));
}

/**
 * 提示词提取上传框：支持拖入、点击选择（可多选）、以及 Ctrl/Cmd+V 粘贴图片。
 * 多张图片一并交给上层逐个建组分析。
 */
export function PromptDropzone({ onFiles, busy }: PromptDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [pasteHint, setPasteHint] = useState('');

  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const files: File[] = [];
      const items = e.clipboardData?.items ?? [];
      for (const item of items) {
        if (item.kind === 'file' && item.type.startsWith('image/')) {
          const f = item.getAsFile();
          if (f) files.push(f);
        }
      }
      if (files.length > 0) {
        e.preventDefault();
        onFiles(files);
        setPasteHint(`已粘贴 ${files.length} 张`);
        window.setTimeout(() => setPasteHint(''), 1500);
      }
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [onFiles]);

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    const imgs = pickImages(e.dataTransfer.files);
    if (imgs.length > 0) onFiles(imgs);
  };

  const handleSelect = (files: FileList | null) => {
    const imgs = pickImages(files);
    if (imgs.length > 0) onFiles(imgs);
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click();
      }}
      className={
        dragging
          ? 'flex min-h-44 cursor-pointer flex-col items-center justify-center rounded-pop-lg border-2 border-ink bg-cream-soft p-6 text-center shadow-sticker transition'
          : 'flex min-h-44 cursor-pointer flex-col items-center justify-center rounded-pop-lg border-2 border-dashed border-cream-2 bg-paper p-6 text-center transition hover:bg-cream-soft'
      }
    >
      <span className="font-display text-3xl leading-none text-ink-3">＋</span>
      <span className="mt-2 font-display text-sm font-bold text-ink">
        {dragging ? '松手放入图片' : '拖入图片，或点击选择（可多选）'}
      </span>
      <span className="mt-1 font-mono text-[11px] text-ink-3">
        支持 Ctrl/⌘+V 粘贴 · 上传后自动分析提示词并生成验证图
      </span>
      {busy && (
        <span className="mt-2 inline-flex items-center gap-2 font-mono text-[11px] text-ink-2">
          <span className="pop-spinner" aria-hidden="true" />
          处理中…
        </span>
      )}
      {pasteHint && <span className="mt-1 font-mono text-[11px] text-ok">{pasteHint}</span>}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => handleSelect(e.target.files)}
      />
    </div>
  );
}
