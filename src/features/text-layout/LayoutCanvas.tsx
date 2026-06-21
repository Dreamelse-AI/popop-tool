import { forwardRef } from 'react';
import type { CSSProperties } from 'react';
import type { LayoutBlock, LayoutSchema } from '@/types/layout';
import { CANVAS_HEIGHT, CANVAS_WIDTH } from '@/types/layout';
import type { TemplateDefinition } from '@/types/template';

interface LayoutCanvasProps {
  schema: LayoutSchema;
  template: TemplateDefinition;
  /** 显示缩放比例（导出时传 1 拿原始尺寸）。默认按容器宽度自适应由外层控制。 */
  scale?: number;
}

function renderBlock(block: LayoutBlock, template: TemplateDefinition) {
  const style = template.roleStyles[block.role] as CSSProperties | undefined;

  switch (block.role) {
    case 'divider':
      return (
        <hr
          key={block.id}
          style={{ border: 'none', borderTop: '2px solid currentColor', opacity: 0.3, width: '100%' }}
        />
      );
    case 'list':
      return (
        <ul key={block.id} style={{ ...style, margin: 0, paddingLeft: '1.2em' }}>
          {(block.items ?? []).map((item, i) => (
            <li key={i} style={{ marginBottom: '0.4em' }}>
              {item}
            </li>
          ))}
        </ul>
      );
    default:
      return (
        <div key={block.id} style={style}>
          {block.text}
        </div>
      );
  }
}

/**
 * 3:4 文字排版画布。内部固定 1080*1440，通过 transform scale 缩放显示，
 * 保证预览与导出像素一致。
 */
export const LayoutCanvas = forwardRef<HTMLDivElement, LayoutCanvasProps>(
  ({ schema, template, scale = 1 }, ref) => {
    return (
      <div
        ref={ref}
        style={{
          width: CANVAS_WIDTH,
          height: CANVAS_HEIGHT,
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
          overflow: 'hidden',
          boxSizing: 'border-box',
          ...template.canvasStyle,
        }}
      >
        <div style={{ width: '100%', height: '100%', boxSizing: 'border-box', ...template.contentStyle }}>
          {schema.blocks.map((block) => renderBlock(block, template))}
        </div>
      </div>
    );
  },
);

LayoutCanvas.displayName = 'LayoutCanvas';
