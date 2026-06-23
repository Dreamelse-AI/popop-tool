import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

interface ToolHeaderProps {
  /** 返回链接地址，默认回工具站首页 */
  backTo?: string;
  /** 返回按钮的无障碍标签 */
  backLabel?: string;
  /** 工具标题 */
  title: string;
  /** 副标题描述 */
  subtitle?: ReactNode;
  /** 右侧操作区（按钮等） */
  actions?: ReactNode;
}

/**
 * 工具页统一顶栏：sticker 风格，粗黑下边。
 * 返回用箭头 icon，与标题左右并排。所有工具页头部都用它，保证视觉与返回链路一致。
 */
export function ToolHeader({
  backTo = '/',
  backLabel = '返回工具站',
  title,
  subtitle,
  actions,
}: ToolHeaderProps) {
  return (
    <header className="pop-topbar px-6 py-4 sm:px-8">
      <div className="mx-auto flex max-w-6xl items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <Link
            to={backTo}
            aria-label={backLabel}
            title={backLabel}
            className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-pop border-2 border-ink bg-paper text-ink shadow-sticker-sm transition hover:bg-cream-soft active:translate-x-[1px] active:translate-y-[1px]"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </Link>
          <div className="min-w-0">
            <h1 className="font-display text-2xl font-extrabold tracking-tight text-ink">{title}</h1>
            {subtitle && <p className="mt-1 max-w-2xl text-sm text-ink-2">{subtitle}</p>}
          </div>
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>
    </header>
  );
}
