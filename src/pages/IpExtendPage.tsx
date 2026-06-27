import { useState } from 'react';
import type { AspectRatio, Resolution } from '@/types/visualAsset';
import { useIpExtendStore } from '@/features/ip-extend/store';
import { useIpLibraryStore } from '@/features/ip-extend/ipLibraryStore';
import { IpProfileManager } from '@/features/ip-extend/IpProfileManager';
import { SceneSelector } from '@/features/ip-extend/SceneSelector';
import { describeIpConfig } from '@/services/ipPromptBuilder';
import { downloadImage } from '@/utils/downloadImage';
import { ToolHeader } from '@/components/ToolHeader';
import { Lightbox } from '@/components/Lightbox';
import { ResultPanel } from '@/components/ResultPanel';
import { IconDownload } from '@/components/icons';

const RATIOS: AspectRatio[] = ['1:1', '9:16', '3:4', '2:3', '3:2', '4:3', '16:9'];
const RESOLUTIONS: Resolution[] = ['1k', '2k', '4k'];

export function IpExtendPage() {
  const {
    selection,
    scene,
    count,
    ratio,
    resolution,
    concurrency,
    status,
    errorMessage,
    items,
    toggle,
    clearDimension,
    setScene,
    setCount,
    setRatio,
    setResolution,
    setConcurrency,
    generate,
    retryItem,
    retryAllFailed,
    cancel,
  } = useIpExtendStore();

  const currentId = useIpLibraryStore((s) => s.currentId);
  const profiles = useIpLibraryStore((s) => s.profiles);
  const current = profiles.find((p) => p.id === currentId) ?? null;
  const hasCharacter = (current?.characterImages.length ?? 0) > 0;

  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  const generating = status === 'generating';
  const doneItems = items.filter((i) => i.status === 'done' && i.url);
  const total = items.length;
  const doneCount = items.filter((i) => i.status === 'done').length;
  const errorCount = items.filter((i) => i.status === 'error').length;
  const finishedCount = doneCount + errorCount;
  const progressPct = total > 0 ? Math.round((finishedCount / total) * 100) : 0;

  const handleDownloadAll = () => {
    doneItems.forEach((it, i) => {
      setTimeout(() => downloadImage(it.url!, `ip-${it.id}.png`), i * 300);
    });
  };

  return (
    <div className="min-h-full">
      <ToolHeader
        title="IP 延展工具"
        subtitle="上传 IP 形象 + 表情包参考 → 选场景/动作/情绪 → 批量生成同一 IP 的延展插画"
      />
      <main className="mx-auto grid max-w-6xl grid-cols-1 gap-8 p-6 sm:p-8 lg:grid-cols-2">
        <section className="flex flex-col gap-5">
          <IpProfileManager />

          <SceneSelector
            selection={selection}
            scene={scene}
            onToggle={toggle}
            onClear={clearDimension}
            onSceneChange={setScene}
          />

          <div className="flex flex-wrap items-end gap-6">
            <div>
              <div className="pop-label mb-1.5">数量</div>
              <input
                type="number"
                min={1}
                max={50}
                value={count}
                onChange={(e) => setCount(Number(e.target.value))}
                className="pop-input w-20 py-1.5"
              />
            </div>
            <div>
              <div className="pop-label mb-1.5">并发</div>
              <input
                type="number"
                min={1}
                max={6}
                value={concurrency}
                onChange={(e) => setConcurrency(Number(e.target.value))}
                className="pop-input w-16 py-1.5"
                title="同时进行的出图任务数（1-6）"
              />
            </div>
            <div>
              <div className="pop-label mb-1.5">比例</div>
              <div className="flex flex-wrap gap-1.5">
                {RATIOS.map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRatio(r)}
                    className={r === ratio ? 'pop-toggle-on' : 'pop-toggle'}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <div className="pop-label mb-1.5">分辨率</div>
              <div className="flex gap-1.5">
                {RESOLUTIONS.map((res) => (
                  <button
                    key={res}
                    type="button"
                    onClick={() => setResolution(res)}
                    className={res === resolution ? 'pop-toggle-on' : 'pop-toggle'}
                  >
                    {res.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => void generate()}
              disabled={generating || !hasCharacter}
              className="pop-btn-primary flex-1"
              title={hasCharacter ? undefined : '请先选中 IP 并上传至少一张形象图'}
            >
              {generating ? '生成中…' : `生成 ${count} 张`}
            </button>
            {generating && (
              <button type="button" onClick={cancel} className="pop-btn-secondary">
                取消
              </button>
            )}
          </div>
          {!hasCharacter && (
            <p className="text-xs text-ink-3">提示：选中一个 IP 档案并上传至少一张「IP 形象图」后即可生成。</p>
          )}
          {status === 'error' && errorMessage && <p className="pop-callout-err">{errorMessage}</p>}
        </section>

        <ResultPanel>
          {items.length === 0 ? (
            <div className="flex h-full items-center justify-center text-center text-sm text-ink-3">
              选好 IP 与场景后点击「生成」，延展图会在这里逐张出现
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <div className="rounded-pop border-2 border-ink bg-paper p-3">
                <div className="mb-1.5 flex items-center justify-between text-xs font-semibold text-ink-2">
                  <span>
                    进度 {finishedCount}/{total}
                  </span>
                  <span className="tabular-nums text-ink-3">{progressPct}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full border border-cream-line bg-soft">
                  <div
                    className="h-full bg-ink transition-all duration-300"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
                  <span className="text-ok">完成 {doneCount}</span>
                  {errorCount > 0 && <span className="text-err">失败 {errorCount}</span>}
                  {errorCount > 0 && !generating && (
                    <button type="button" onClick={() => void retryAllFailed()} className="pop-link">
                      重试全部失败（{errorCount}）
                    </button>
                  )}
                  {doneItems.length > 0 && (
                    <button type="button" onClick={handleDownloadAll} className="pop-link ml-auto">
                      批量下载（{doneItems.length}）
                    </button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {items.map((item) => (
                  <div
                    key={item.id}
                    className="flex flex-col overflow-hidden rounded-pop border-2 border-ink bg-paper shadow-sticker-sm"
                  >
                    <div
                      className="flex items-center justify-center bg-soft"
                      style={{ aspectRatio: (item.ratio ?? ratio).replace(':', ' / ') }}
                    >
                      {item.status === 'done' && item.url ? (
                        <img
                          src={item.url}
                          alt={describeIpConfig(item.config)}
                          className="h-full w-full cursor-zoom-in object-cover"
                          onClick={() => setLightboxUrl(item.url!)}
                        />
                      ) : item.status === 'error' ? (
                        <div className="flex flex-col items-center gap-2 px-2 text-center">
                          <span className="text-xs text-err">{item.error}</span>
                          <button type="button" onClick={() => void retryItem(item.id)} className="pop-toggle">
                            重试
                          </button>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-1.5">
                          <span className="pop-spinner h-6 w-6" />
                          <span className="text-[10px] text-ink-3">
                            {item.phase === 'imaging' ? '出图中…' : '排队中…'}
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center justify-between gap-1 border-t-2 border-ink px-2 py-1.5">
                      <span
                        className="truncate text-xs font-semibold text-ink-2"
                        title={describeIpConfig(item.config)}
                      >
                        {describeIpConfig(item.config)}
                      </span>
                      {item.status === 'done' && item.url && (
                        <div className="flex shrink-0 items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => void downloadImage(item.url!, `ip-${item.id}.png`)}
                            className="text-ink-3 transition hover:text-ink"
                            title="下载"
                            aria-label="下载"
                          >
                            <IconDownload />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </ResultPanel>
      </main>

      <Lightbox url={lightboxUrl} onClose={() => setLightboxUrl(null)} />
    </div>
  );
}
