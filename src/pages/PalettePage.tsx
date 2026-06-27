import { usePaletteStore } from '@/features/palette/store';
import { PaletteDropzone } from '@/features/palette/PaletteDropzone';
import { PaletteDraftEditor } from '@/features/palette/PaletteDraftEditor';
import { ToolHeader } from '@/components/ToolHeader';

/** 情绪配色库工具页：拖图/粘贴识别配色 → 命名/情绪词 → 导出 CSV 色值表下载（纯前端）。 */
export function PalettePage() {
  const {
    drafts,
    analyzingCount,
    analyzeError,
    analyzeFiles,
    updateDraft,
    updateScheme,
    swapScheme,
    discardDraft,
    discardAllDrafts,
    exportDraft,
    exportAllDrafts,
  } = usePaletteStore();

  return (
    <div className="min-h-full">
      <ToolHeader
        title="情绪配色库"
        subtitle="拖入 / 粘贴图片自动识别配色与命名，确认后导出 CSV 色值表"
      />

      <main className="mx-auto max-w-6xl space-y-6 p-6 sm:p-8">
        <PaletteDropzone onFiles={(fs) => void analyzeFiles(fs)} analyzing={analyzingCount > 0} />
        {analyzeError && <div className="pop-callout-err">{analyzeError}</div>}

        {drafts.length > 0 ? (
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="pop-label">
                识别结果
                <span className="ml-2 font-mono text-[11px] font-normal text-ink-3">
                  {drafts.length} 条
                </span>
              </span>
              <div className="flex items-center gap-2">
                <button type="button" onClick={discardAllDrafts} className="pop-link">
                  全部清空
                </button>
                <button
                  type="button"
                  onClick={exportAllDrafts}
                  className="pop-btn-primary px-3 py-1.5 text-xs"
                >
                  导出全部 CSV（{drafts.length}）
                </button>
              </div>
            </div>
            {drafts.map((d, i) => (
              <PaletteDraftEditor
                key={d.key}
                draft={d}
                index={i}
                onChangeMeta={(patch) => updateDraft(d.key, patch)}
                onChangeScheme={(si, patch) => updateScheme(d.key, si, patch)}
                onSwapScheme={(si) => swapScheme(d.key, si)}
                onExport={() => exportDraft(d.key)}
                onDiscard={() => discardDraft(d.key)}
              />
            ))}
          </section>
        ) : (
          analyzingCount === 0 && (
            <div className="pop-empty h-40">
              还没有识别结果。拖入或粘贴一张图，识别后即可导出 CSV 色值表。
            </div>
          )
        )}
      </main>
    </div>
  );
}
