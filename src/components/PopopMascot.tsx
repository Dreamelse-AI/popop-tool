interface PopopMascotProps {
  size?: number;
  className?: string;
  /** 配色：color=奶油彩色实心（默认），watermark=淡色水印（hero 角落装饰） */
  variant?: 'color' | 'watermark';
}

/**
 * POPOP 吉祥物。矢量 SVG（设计师提供的源文件），无限放大不糊。
 * - color：奶油彩色实心，用于品牌展示
 * - watermark：淡色水印版，用于 hero 角落等装饰
 * 图源 public/popop-mascot.svg 与 popop-mascot-dark.svg。
 */
export function PopopMascot({ size = 32, className, variant = 'color' }: PopopMascotProps) {
  const src = variant === 'watermark' ? '/popop-mascot-dark.svg' : '/popop-mascot.svg';
  return (
    <img
      src={src}
      height={size}
      alt="POPOP"
      className={className}
      style={{ height: size, width: 'auto', objectFit: 'contain' }}
    />
  );
}
