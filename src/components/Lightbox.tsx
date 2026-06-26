import { useEffect } from 'react';

interface LightboxProps {
  /** 大图地址，为空则不渲染 */
  url: string | null;
  onClose: () => void;
  /** 透明图（如抠完图的表情）：不加描边/圆角，避免被误认成抠图残留 */
  transparent?: boolean;
}

/** 全屏看大图浮层，点遮罩 / 关闭按钮 / Esc 关闭。 */
export function Lightbox({ url, onClose, transparent = false }: LightboxProps) {
  useEffect(() => {
    if (!url) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose, url]);

  if (!url) return null;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-ink/80 p-4 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="查看大图"
    >
      <div className="relative max-h-[92vh] max-w-[92vw]" onClick={(event) => event.stopPropagation()}>
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 z-10 rounded-full border-2 border-cream bg-ink px-3 py-1.5 text-xs font-bold text-cream shadow-sticker-sm hover:bg-ink-2"
          aria-label="关闭大图"
        >
          关闭 ×
        </button>
        <img
          src={url}
          alt=""
          className={
            transparent
              ? 'max-h-[92vh] max-w-[92vw] object-contain'
              : 'max-h-[92vh] max-w-[92vw] rounded-pop-lg border-[3px] border-cream object-contain shadow-sticker-lg'
          }
        />
      </div>
    </div>
  );
}
