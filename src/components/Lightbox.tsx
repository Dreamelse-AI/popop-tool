interface LightboxProps {
  /** 大图地址，为空则不渲染 */
  url: string | null;
  onClose: () => void;
  /** 透明图（如抠完图的表情）：不加描边/圆角，避免被误认成抠图残留 */
  transparent?: boolean;
}

/** 全屏看大图浮层，sticker 风格描边。点遮罩或按钮关闭。 */
export function Lightbox({ url, onClose, transparent = false }: LightboxProps) {
  if (!url) return null;
  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-ink/85 p-4"
      onClick={onClose}
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute right-5 top-5 flex h-9 w-9 items-center justify-center rounded-full border-2 border-cream bg-ink text-lg leading-none text-cream"
        aria-label="关闭大图"
      >
        ✕
      </button>
      <img
        src={url}
        alt=""
        className={
          transparent
            ? 'max-h-[92vh] max-w-[92vw] object-contain'
            : 'max-h-[92vh] max-w-[92vw] rounded-pop-lg border-[3px] border-cream object-contain'
        }
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
}
