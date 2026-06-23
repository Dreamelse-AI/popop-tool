import type { ReactNode } from 'react';

interface ResultPanelProps {
  children: ReactNode;
}

/**
 * 工具页右侧统一结果区：全屏高度虚线框，sticky 钉在视口（上下留固定安全间距），
 * 不随左侧表单滚动。内容超出时仅面板内部滚动。无标题栏。
 * 所有生成类工具页右侧都用它，保证一致。
 */
export function ResultPanel({ children }: ResultPanelProps) {
  return (
    <section className="lg:sticky lg:top-6 lg:self-start">
      <div className="flex h-[calc(100vh-3rem)] flex-col overflow-auto rounded-pop-lg border-2 border-dashed border-cream-2 bg-paper/40 p-4">
        {children}
      </div>
    </section>
  );
}
