import { useEffect, useState } from 'react';
import { usePaletteStore } from '@/features/palette/store';
import { PaletteDropzone } from '@/features/palette/PaletteDropzone';
import { PaletteDraftEditor } from '@/features/palette/PaletteDraftEditor';
import { ToolHeader } from '@/components/ToolHeader';
import { Lightbox } from '@/components/Lightbox';
import type { PaletteEntry } from '@/types/palette';

/** 情绪配色库工具页：拖图/粘贴识别配色 → 命名/情绪词 → 永久存储 + 表格管理。 */
export function PalettePage() {
  const {
    items,
    total,
    listStatus,
    listError,
    drafts,
    analyzingCount,
    analyzeError,
    deletingId,
    load,
    analyzeFiles,
    updateDraft,
    updateScheme,
    swapScheme,
    discardDraft,
    discardAllDrafts,
    saveDraft,
    saveAllDrafts,
    remove,
  } = usePaletteStore();

  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [savingAll, setSavingAll] = useState(false);

  useEffect(() => {
    void load();
  }, [load]);

  const handleDelete = (entry: PaletteEntry) => {
    const label = entry.schemes[0]?.name || entry.id;
    const ok = window.confirm(`确认删除「${label}」？此操作会从配色库移除，不可恢复。`);
    if (ok) void remove(entry.id);
  };

  const handleSaveAll = async () => {
    setSavingAll(true);
    try {
      await saveAllDrafts();
    } finally {
      setSavingAll(false);
    }
  };

  return (
    <div className="min-h-full">
      <ToolHeader
        title="情绪配色库"
        subtitle={`拖入 / 粘贴图片自动识别配色与命名，永久存储在服务器 · 已存 ${total} 条`}
      />

      <main className="mx-auto max-w-6xl space-y-6 p-6 sm:p-8">
        <PaletteDropzone onFiles={(fs) => void analyzeFiles(fs)} analyzing={analyzingCount > 0} />
        {analyzeError && <div className="pop-callout-err">{analyzeError}</div>}

        {drafts.length > 0 && (
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="pop-label">
                待确认草稿
                <span className="ml-2 font-mono text-[11px] font-normal text-ink-3">
                  {drafts.length} 条
                </span>
              </span>
              {drafts.length > 1 && (
                <div className="flex items-center gap-2">
                  <button type="button" onClick={discardAllDrafts} className="pop-link" disabled={savingAll}>
                    全部丢弃
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleSaveAll()}
                    disabled={savingAll}
                    className="pop-btn-primary px-3 py-1.5 text-xs"
                  >
                    {savingAll ? '保存中…' : `全部保存（${drafts.length}）`}
                  </button>
                </div>
              )}
            </div>
            {drafts.map((d, i) => (
              <PaletteDraftEditor
                key={d.key}
                draft={d}
                saving={d.saving || savingAll}
                errorMessage={d.error}
                index={i}
                onChangeMeta={(patch) => updateDraft(d.key, patch)}
                onChangeScheme={(si, patch) => updateScheme(d.key, si, patch)}
                onSwapScheme={(si) => swapScheme(d.key, si)}
                onSave={() => void saveDraft(d.key)}
                onDiscard={() => discardDraft(d.key)}
              />
            ))}
          </section>
        )}

        <section>
          {listStatus === 'loading' && (
            <div className="flex h-40 items-center justify-center text-sm text-ink-3">加载中…</div>
          )}
          {listStatus === 'error' && <div className="pop-callout-err">{listError}</div>}
          {listStatus === 'ready' && items.length === 0 && drafts.length === 0 && (
            <div className="pop-empty h-40">配色库还是空的。拖入或粘贴一张图，识别后即可永久保存。</div>
          )}
          {items.length > 0 && (
            <PaletteTable
              items={items}
              deletingId={deletingId}
              onPreview={(url) => setLightboxUrl(url)}
              onDelete={handleDelete}
            />
          )}
        </section>
      </main>

      <Lightbox url={lightboxUrl} onClose={() => setLightboxUrl(null)} />
    </div>
  );
}

interface PaletteTableProps {
  items: PaletteEntry[];
  deletingId: string | null;
  onPreview: (url: string) => void;
  onDelete: (entry: PaletteEntry) => void;
}

/** 配色记录表格：原始图 / 主色板 / id / 两套方案（名字+底+字+情绪）/ 操作。 */
function PaletteTable({ items, deletingId, onPreview, onDelete }: PaletteTableProps) {
  return (
    <div className="overflow-x-auto rounded-pop-lg border-2 border-ink bg-paper shadow-sticker">
      <table className="w-full min-w-[820px] border-collapse text-left text-sm">
        <thead>
          <tr className="border-b-2 border-ink bg-cream-soft font-mono text-[11px] uppercase text-ink-2">
            <Th>原始图</Th>
            <Th>主色板</Th>
            <Th>id</Th>
            <Th>方案 A</Th>
            <Th>方案 B</Th>
            <Th>操作</Th>
          </tr>
        </thead>
        <tbody>
          {items.map((entry) => (
            <tr key={entry.id} className="border-b border-line align-top last:border-b-0">
              <Td>
                <button
                  type="button"
                  onClick={() => onPreview(entry.imageUrl)}
                  className="block h-14 w-14 overflow-hidden rounded-pop border-2 border-ink bg-soft"
                  aria-label="查看大图"
                >
                  <img src={entry.imageUrl} alt={entry.schemes[0]?.name ?? ''} className="h-full w-full object-cover" />
                </button>
              </Td>
              <Td>
                <div className="flex max-w-[7rem] flex-wrap gap-1">
                  {entry.colors.map((c) => (
                    <span
                      key={c}
                      title={c}
                      className="h-5 w-5 rounded border-2 border-ink"
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </Td>
              <Td>
                <code className="font-mono text-xs text-ink-2">{entry.id}</code>
              </Td>
              {[0, 1].map((i) => (
                <Td key={i}>
                  <SchemeCell scheme={entry.schemes[i]} />
                </Td>
              ))}
              <Td>
                <button
                  type="button"
                  onClick={() => onDelete(entry)}
                  disabled={deletingId === entry.id}
                  className="pop-btn-danger px-2.5 py-1 text-xs"
                >
                  {deletingId === entry.id ? '删除中…' : '删除'}
                </button>
              </Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** 方案单元格：名字 + 底/字色预览块 + 两个色值 + 情绪词。 */
function SchemeCell({ scheme }: { scheme?: import('@/types/palette').PaletteScheme }) {
  if (!scheme) return <span className="text-ink-3">—</span>;
  return (
    <div className="min-w-[9rem]">
      <div
        className="mb-1 flex h-9 items-center justify-center rounded border-2 border-ink text-center"
        style={{ background: scheme.bgColor, color: scheme.fontColor }}
      >
        <span className="font-display text-xs font-extrabold">{scheme.name || '预览'}</span>
      </div>
      <div className="flex items-center gap-1">
        <SwatchValue value={scheme.bgColor} />
        <SwatchValue value={scheme.fontColor} />
      </div>
      {scheme.mood && <div className="mt-1 text-[11px] text-ink-2">{scheme.mood}</div>}
    </div>
  );
}

/** 颜色单元格：色块 + hex/渐变文本。 */
function SwatchValue({ value }: { value: string }) {
  const isHex = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(value.trim());
  return (
    <div className="flex items-center gap-1.5">
      <span
        className="h-5 w-5 shrink-0 rounded border-2 border-ink bg-soft"
        style={{ background: value }}
        title={value}
      />
      <code className="font-mono text-[11px] text-ink-2" title={isHex ? undefined : value}>
        {isHex ? value : '渐变'}
      </code>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="whitespace-nowrap px-3 py-2.5 font-semibold">{children}</th>;
}

function Td({ children }: { children: React.ReactNode }) {
  return <td className="px-3 py-3">{children}</td>;
}
