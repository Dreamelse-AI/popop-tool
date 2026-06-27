import { useMemo, useState } from 'react';
import { ToolHeader } from '@/components/ToolHeader';
import { Lightbox } from '@/components/Lightbox';
import { PromptDropzone } from '@/features/prompt-extraction/PromptDropzone';
import { LayoutParamCard } from '@/features/layout-param/LayoutParamCard';
import { resolveTemplate, useLayoutParamStore } from '@/features/layout-param/store';
import {
  downloadCsv,
  downloadJson,
  downloadMarkdown,
} from '@/features/layout-param/exportTemplate';

/**
 * 排版参数提取工具页：拖入/粘贴图片 → AI 读出排版规则 → 左图右参数（可代码编辑）→ 导出参数表。
 *
 * 产物定位：一套「排版参数模版/原子」，只描述文字如何排布，不含文案内容与背景色，
 * 后续可填充不同文字、组合不同背景复用。
 */
export function LayoutParamPage() {
  const { records, busy, addFiles, setDraftJson, reanalyze, remove, clearAll, cancel } =
    useLayoutParamStore();
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  const doneTemplates = useMemo(
    () =>
      records
        .filter((r) => r.status === 'done')
        .map((r) => resolveTemplate(r))
        .filter((t): t is NonNullable<typeof t> => t !== null),
    [records],
  );

  const hasDone = doneTemplates.length > 0;

  return (
    <div className="min-h-full">
      <ToolHeader
        title="排版参数提取"
        subtitle="拖入 / 粘贴图片，AI 读出排版规则，左图右参数（可直接改代码），导出可复用的排版参数表"
        actions={
          records.length > 0 ? (
            <button type="button" onClick={busy ? cancel : clearAll} className="pop-link">
              {busy ? '取消' : '清空'}
            </button>
          ) : undefined
        }
      />

      <main className="mx-auto max-w-6xl space-y-6 p-6 sm:p-8">
        <PromptDropzone onFiles={(fs) => void addFiles(fs)} busy={busy} />

        {hasDone && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-pop-lg border-2 border-ink bg-cream-soft px-4 py-3 shadow-sticker">
            <span className="pop-label">
              批量导出全部
              <span className="ml-2 font-mono text-[11px] font-normal text-ink-3">
                {doneTemplates.length} 套模版
              </span>
            </span>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => downloadJson(doneTemplates)} className="pop-btn-secondary px-3 py-1.5 text-xs">
                导出 JSON
              </button>
              <button type="button" onClick={() => downloadCsv(doneTemplates)} className="pop-btn-secondary px-3 py-1.5 text-xs">
                导出 CSV
              </button>
              <button type="button" onClick={() => downloadMarkdown(doneTemplates)} className="pop-btn-secondary px-3 py-1.5 text-xs">
                导出 Markdown
              </button>
            </div>
          </div>
        )}

        {records.length === 0 ? (
          <div className="pop-empty h-40">
            还没有图片。拖入或粘贴排版参考图，AI 会读出字号 / 字重 / 对齐 / 锚点等排版规则。
          </div>
        ) : (
          <section className="space-y-4">
            {records.map((rec, i) => (
              <LayoutParamCard
                key={rec.id}
                record={rec}
                index={i}
                onChangeJson={(json) => setDraftJson(rec.id, json)}
                onReanalyze={() => void reanalyze(rec.id)}
                onRemove={() => remove(rec.id)}
                onPreview={(url) => setLightboxUrl(url)}
              />
            ))}
          </section>
        )}
      </main>

      <Lightbox url={lightboxUrl} onClose={() => setLightboxUrl(null)} />
    </div>
  );
}
