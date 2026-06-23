import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useGalleryStore } from '@/features/visual-asset/galleryStore';
import { downloadImage } from '@/features/background/downloadImage';

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
    <div className="min-h-full bg-neutral-100">
      <header className="border-b border-neutral-200 bg-white px-8 py-4">
        <Link to="/tools/visual-asset" className="text-sm text-neutral-500 hover:text-neutral-900">
          ← 返回视觉资产引擎
        </Link>
        <div className="mt-1 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-neutral-900">MoodPic 图库</h1>
            <p className="mt-1 text-sm text-neutral-500">
              已存储 {total} 张 · 选中 {selected.size} 张
            </p>
          </div>
          <div className="flex items-center gap-2">
            {hasSelection ? (
              <button
                type="button"
                onClick={clearSelection}
                className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm text-neutral-600 hover:border-neutral-500"
              >
                取消选择
              </button>
            ) : (
              items.length > 0 && (
                <button
                  type="button"
                  onClick={selectAll}
                  className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm text-neutral-600 hover:border-neutral-500"
                >
                  全选
                </button>
              )
            )}
            <button
              type="button"
              onClick={handleDelete}
              disabled={!hasSelection || deleting}
              className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:bg-neutral-300"
            >
              {deleting ? '删除中…' : `批量删除${hasSelection ? `（${selected.size}）` : ''}`}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl p-8">
        {status === 'loading' && (
          <div className="flex h-64 items-center justify-center text-sm text-neutral-400">
            加载中…
          </div>
        )}
        {status === 'error' && (
          <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">{errorMessage}</div>
        )}
        {status === 'ready' && items.length === 0 && (
          <div className="flex h-64 items-center justify-center rounded-xl border border-dashed border-neutral-300 bg-white px-6 text-center text-sm text-neutral-400">
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
                      ? 'overflow-hidden rounded-lg border-2 border-neutral-900 bg-white'
                      : 'overflow-hidden rounded-lg border-2 border-transparent bg-white shadow-sm'
                  }
                >
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => toggleSelect(item.assetId)}
                      className="block aspect-[3/4] w-full bg-neutral-50"
                      aria-pressed={active}
                    >
                      <img src={item.url} alt={item.prompt} className="h-full w-full object-cover" />
                    </button>
                    <span
                      className={
                        active
                          ? 'absolute left-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-neutral-900 text-xs text-white'
                          : 'absolute left-2 top-2 h-5 w-5 rounded-full border border-white/80 bg-black/20'
                      }
                    >
                      {active ? '✓' : ''}
                    </span>
                    <button
                      type="button"
                      onClick={() => setLightboxUrl(item.url)}
                      className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-black/40 text-xs text-white hover:bg-black/70"
                      aria-label="查看大图"
                      title="查看大图"
                    >
                      ⤢
                    </button>
                  </div>
                  <div className="flex items-center justify-between gap-1 px-2 py-1.5">
                    <span className="truncate text-xs text-neutral-500" title={item.prompt}>
                      {item.config.emotion} · {item.config.type}
                    </span>
                    <button
                      type="button"
                      onClick={() => downloadImage(item.url, `moodpic-${item.assetId}.png`)}
                      className="shrink-0 text-xs text-neutral-400 hover:text-neutral-900"
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

      {lightboxUrl && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/85 p-4"
          onClick={() => setLightboxUrl(null)}
        >
          <button
            type="button"
            onClick={() => setLightboxUrl(null)}
            className="absolute right-5 top-5 text-2xl leading-none text-white/80 hover:text-white"
            aria-label="关闭大图"
          >
            ✕
          </button>
          <img
            src={lightboxUrl}
            alt=""
            className="max-h-[92vh] max-w-[92vw] rounded-lg object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
