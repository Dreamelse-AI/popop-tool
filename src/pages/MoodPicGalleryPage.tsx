import { useEffect, useState } from 'react';
import { useGalleryStore } from '@/features/visual-asset/galleryStore';
import { downloadImage } from '@/utils/downloadImage';
import { ToolHeader } from '@/components/ToolHeader';
import { Lightbox } from '@/components/Lightbox';

export function MoodPicGalleryPage() {
  const {
    items,
    total,
    status,
    errorMessage,
    selected,
    deleting,
    load,
    toggleSelect,
    selectAll,
    clearSelection,
    deleteSelected,
  } = useGalleryStore();

  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  useEffect(() => {
    void load(1);
  }, [load]);

  const hasSelection = selected.size > 0;

  const handleDelete = () => {
    if (!hasSelection) return;
    const ok = window.confirm(`确认删除选中的 ${selected.size} 张？此操作会从存储中永久删除，不可恢复。`);
    if (ok) void deleteSelected();
  };

  return (
    <div className="min-h-full">
      <ToolHeader
        backTo="/tools/visual-asset"
        backLabel="返回视觉资产引擎"
        title="MoodPic 图库"
        subtitle={`已存储 ${total} 张 · 选中 ${selected.size} 张`}
        actions={
          <>
            {hasSelection ? (
              <button type="button" onClick={clearSelection} className="pop-btn-secondary px-3 py-1.5 text-xs">
                取消选择
              </button>
            ) : (
              items.length > 0 && (
                <button type="button" onClick={selectAll} className="pop-btn-secondary px-3 py-1.5 text-xs">
                  全选
                </button>
              )
            )}
            <button
              type="button"
              onClick={handleDelete}
              disabled={!hasSelection || deleting}
              className="pop-btn-danger px-3 py-1.5 text-xs"
            >
              {deleting ? '删除中…' : `批量删除${hasSelection ? `（${selected.size}）` : ''}`}
            </button>
          </>
        }
      />

      <main className="mx-auto max-w-6xl p-6 sm:p-8">
        {status === 'loading' && (
          <div className="flex h-64 items-center justify-center text-sm text-ink-3">加载中…</div>
        )}
        {status === 'error' && <div className="pop-callout-err">{errorMessage}</div>}
        {status === 'ready' && items.length === 0 && (
          <div className="pop-empty h-64">
            图库还是空的。去视觉资产引擎生成并存档后，这里会出现作品。
          </div>
        )}
        {items.length > 0 && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {items.map((item) => {
              const active = selected.has(item.assetId);
              return (
                <div
                  key={item.assetId}
                  className={
                    active
                      ? 'overflow-hidden rounded-pop border-2 border-ink bg-paper shadow-sticker'
                      : 'overflow-hidden rounded-pop border-2 border-ink bg-paper shadow-sticker-sm'
                  }
                >
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => toggleSelect(item.assetId)}
                      className="block aspect-[3/4] w-full bg-soft"
                      aria-pressed={active}
                    >
                      <img src={item.url} alt={item.prompt} className="h-full w-full object-cover" />
                    </button>
                    <span
                      className={
                        active
                          ? 'absolute left-2 top-2 flex h-5 w-5 items-center justify-center rounded-full border-2 border-cream bg-ink text-xs text-cream'
                          : 'absolute left-2 top-2 h-5 w-5 rounded-full border-2 border-white/80 bg-ink/20'
                      }
                    >
                      {active ? '✓' : ''}
                    </span>
                    <button
                      type="button"
                      onClick={() => setLightboxUrl(item.url)}
                      className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full border border-cream bg-ink/60 text-xs text-cream hover:bg-ink"
                      aria-label="查看大图"
                      title="查看大图"
                    >
                      ⤢
                    </button>
                  </div>
                  <div className="flex items-center justify-between gap-1 border-t-2 border-ink px-2 py-1.5">
                    <span className="truncate text-xs font-semibold text-ink-2" title={item.prompt}>
                      {item.config.emotion} · {item.config.type}
                    </span>
                    <button
                      type="button"
                      onClick={() => downloadImage(item.url, `moodpic-${item.assetId}.png`)}
                      className="pop-link shrink-0"
                    >
                      下载
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      <Lightbox url={lightboxUrl} onClose={() => setLightboxUrl(null)} />
    </div>
  );
}
