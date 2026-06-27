import { useState } from 'react';
import type { LayoutParamRecord } from '@/types/layoutParam';
import { resolveTemplate } from './store';
import { downloadCsv, downloadJson, downloadMarkdown } from './exportTemplate';

interface LayoutParamCardProps {
  record: LayoutParamRecord;
  index: number;
  onChangeJson: (json: string) => void;
  onReanalyze: () => void;
  onRemove: () => void;
  onPreview: (url: string) => void;
}

/**
 * 单条记录卡片：左图 + 右侧参数。
 * 右侧分两层：① 解析后的参数摘要（人读）② 可手动编辑的 JSON 草稿（代码用，实时校验）。
 */
export function LayoutParamCard({
  record,
  index,
  onChangeJson,
  onReanalyze,
  onRemove,
  onPreview,
}: LayoutParamCardProps) {
  const [showJson, setShowJson] = useState(true);
  const template = resolveTemplate(record);

  return (
    <div className="grid grid-cols-1 gap-4 rounded-pop-lg border-2 border-ink bg-paper p-4 shadow-sticker lg:grid-cols-[260px_1fr]">
      <LeftImage record={record} index={index} onPreview={onPreview} onReanalyze={onReanalyze} />

      <div className="min-w-0 space-y-3">
        {record.status === 'error' && (
          <div className="pop-callout-err">{record.error ?? '分析失败'}</div>
        )}

        {record.status === 'analyzing' && (
          <div className="flex items-center gap-2 text-sm text-ink-2">
            <span className="pop-spinner h-4 w-4" aria-hidden="true" />
            正在读取排版规则…
          </div>
        )}

        {template && (
          <>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="font-display text-lg font-extrabold text-ink">{template.name}</div>
                <div className="mt-0.5 text-xs text-ink-2">{template.vibe}</div>
              </div>
              <button type="button" onClick={onRemove} className="pop-link shrink-0">
                移除
              </button>
            </div>

            <CanvasSummary template={template} />
            <BlockTable template={template} />

            <div className="flex items-center justify-between gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowJson((v) => !v)}
                className="pop-link"
              >
                {showJson ? '收起 JSON ▲' : '展开 JSON 编辑 ▼'}
              </button>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => downloadJson([template])} className="pop-toggle">
                  JSON
                </button>
                <button type="button" onClick={() => downloadCsv([template])} className="pop-toggle">
                  CSV
                </button>
                <button
                  type="button"
                  onClick={() => downloadMarkdown([template])}
                  className="pop-toggle"
                >
                  MD
                </button>
              </div>
            </div>

            {showJson && (
              <div>
                <textarea
                  value={record.draftJson}
                  onChange={(e) => onChangeJson(e.target.value)}
                  spellCheck={false}
                  rows={14}
                  className="w-full resize-y rounded-pop border-2 border-ink bg-cream-soft p-3 font-mono text-[12px] leading-relaxed text-ink outline-none focus:bg-paper"
                />
                {record.jsonError && (
                  <div className="mt-1 font-mono text-[11px] text-err">{record.jsonError}</div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/** 左列：源图 + 序号 + 重新分析。 */
function LeftImage({
  record,
  index,
  onPreview,
  onReanalyze,
}: {
  record: LayoutParamRecord;
  index: number;
  onPreview: (url: string) => void;
  onReanalyze: () => void;
}) {
  return (
    <div className="space-y-2">
      <div className="relative overflow-hidden rounded-pop border-2 border-ink bg-soft">
        <span className="absolute left-2 top-2 z-10 rounded-full border-2 border-ink bg-paper px-2 py-0.5 font-mono text-[11px] font-bold text-ink">
          #{index + 1}
        </span>
        {record.sourceUrl ? (
          <button
            type="button"
            onClick={() => onPreview(record.sourceUrl)}
            className="block w-full"
            aria-label="查看大图"
          >
            <img src={record.sourceUrl} alt="" className="block max-h-[320px] w-full object-contain" />
          </button>
        ) : (
          <div className="flex h-40 items-center justify-center text-xs text-ink-3">读取中…</div>
        )}
      </div>
      {(record.status === 'done' || record.status === 'error') && (
        <button
          type="button"
          onClick={onReanalyze}
          className="pop-btn-secondary w-full px-3 py-2 text-xs"
        >
          重新分析
        </button>
      )}
    </div>
  );
}

/** 画布 + 节奏摘要。 */
function CanvasSummary({ template }: { template: import('@/types/layoutParam').LayoutParamTemplate }) {
  const { canvas, rhythm } = template;
  const chips = [
    canvas.ratio,
    `${canvas.referenceWidth}×${canvas.referenceHeight}`,
    `边距 ${canvas.padding}`,
    `${canvas.gridColumns} 栏`,
    `字阶 ${rhythm.scaleRatio}`,
    rhythm.density,
    `对齐 ${rhythm.alignmentMood}`,
  ];
  return (
    <div className="flex flex-wrap gap-1.5">
      {chips.map((c) => (
        <span key={c} className="pop-tag-cream">
          {c}
        </span>
      ))}
    </div>
  );
}

/** 文本块参数表（人读）。 */
function BlockTable({ template }: { template: import('@/types/layoutParam').LayoutParamTemplate }) {
  return (
    <div className="overflow-x-auto rounded-pop border-2 border-ink">
      <table className="w-full min-w-[520px] border-collapse text-left text-xs">
        <thead>
          <tr className="border-b-2 border-ink bg-cream-soft font-mono text-[10.5px] uppercase text-ink-2">
            <th className="px-2 py-1.5">角色</th>
            <th className="px-2 py-1.5">字体</th>
            <th className="px-2 py-1.5">字号</th>
            <th className="px-2 py-1.5">字重</th>
            <th className="px-2 py-1.5">行高</th>
            <th className="px-2 py-1.5">字距</th>
            <th className="px-2 py-1.5">对齐</th>
            <th className="px-2 py-1.5">锚点</th>
          </tr>
        </thead>
        <tbody>
          {template.blocks.map((b, i) => (
            <tr key={i} className="border-b border-line last:border-b-0">
              <td className="px-2 py-1.5 font-semibold text-ink">{b.role}</td>
              <td className="px-2 py-1.5 text-ink-2">{b.fontKind}</td>
              <td className="px-2 py-1.5 font-mono text-ink-2">{b.fontSize}</td>
              <td className="px-2 py-1.5 font-mono text-ink-2">{b.fontWeight}</td>
              <td className="px-2 py-1.5 font-mono text-ink-2">{b.lineHeight}</td>
              <td className="px-2 py-1.5 font-mono text-ink-2">{b.letterSpacing}</td>
              <td className="px-2 py-1.5 text-ink-2">{b.textAlign}</td>
              <td className="px-2 py-1.5 text-ink-2">{b.anchor}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
