import { Link } from 'react-router-dom';
import { useState } from 'react';
import type { AspectRatio, Resolution, AssetType } from '@/types/visualAsset';
import {
  EMOTION_OPTIONS,
  SUBJECT_OPTIONS,
  TYPE_OPTIONS,
  DNA_SCHEMAS,
  ENABLED_TYPES,
} from '@/data/visualAssetCatalog';
import { useVisualAssetStore } from '@/features/visual-asset/store';
import { ChipGroup } from '@/features/visual-asset/ChipGroup';
import { StyleManager } from '@/features/visual-asset/StyleManager';
import { downloadImage } from '@/features/background/downloadImage';
import { ToolHeader } from '@/components/ToolHeader';
import { Lightbox } from '@/components/Lightbox';
import { ResultPanel } from '@/components/ResultPanel';
import { IconDownload } from '@/components/icons';

const RATIOS: AspectRatio[] = ['9:16', '3:4', '2:3', '1:1', '3:2', '4:3', '16:9'];
const RESOLUTIONS: Resolution[] = ['1k', '2k', '4k'];

export function VisualAssetPage() {
  const {
    selection,
    count,
    ratio,
    resolution,
    status,
    errorMessage,
    items,
    toggle,
    clearDimension,
    setCount,
    setRatio,
    setResolution,
    generate,
    retryItem,
    archiveItem,
    cancel,
  } = useVisualAssetStore();

  const [detailId, setDetailId] = useState<string | null>(null);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  const generating = status === 'generating';
  const doneItems = items.filter((i) => i.status === 'done' && i.url);

  // 当前 type：用户选了就用第一个，否则默认第一个已启用 type（决定 DNA 展开哪套）
  const activeType: AssetType = (selection.type[0] as AssetType) ?? ENABLED_TYPES[0];
  const schema = DNA_SCHEMAS[activeType];

  // 仅展示已启用的 type 选项
  const typeOptions = TYPE_OPTIONS.filter((t) => ENABLED_TYPES.includes(t.id as AssetType));

  const handleDownload = (url: string, id: string) => {
    void downloadImage(url, `asset-${id}.png`);
  };

  const handleDownloadAll = () => {
    doneItems.forEach((it, i) => {
      // 稍微错开，避免浏览器拦截批量下载
      setTimeout(() => downloadImage(it.url!, `asset-${it.id}.png`), i * 300);
    });
  };

  const detailItem = detailId ? items.find((i) => i.id === detailId) : null;

  return (
    <div className="min-h-full">
      <ToolHeader
        title="视觉资产生产引擎"
        subtitle="Emotion × Type × DNA 三态组合（锁定 / 多选随机 / 不选全随机）→ 批量生成视觉资产"
        actions={
          <Link to="/tools/visual-asset/gallery" className="pop-btn-secondary px-3 py-1.5 text-xs">
            图库
          </Link>
        }
      />
      <main className="mx-auto grid max-w-6xl grid-cols-1 gap-8 p-6 sm:p-8 lg:grid-cols-2">
        <section className="flex flex-col gap-5">
          {/* [LEFT] */}
          <ChipGroup
            title="Emotion 情绪"
            options={EMOTION_OPTIONS}
            selected={selection.emotion}
            onToggle={(id) => toggle('emotion', id)}
            onClear={() => clearDimension('emotion')}
          />

          <ChipGroup
            title="Subject 主体"
            options={SUBJECT_OPTIONS}
            selected={selection.subject}
            onToggle={(id) => toggle('subject', id)}
            onClear={() => clearDimension('subject')}
          />

          <ChipGroup
            title="Type 类型"
            options={typeOptions}
            selected={selection.type}
            onToggle={(id) => toggle('type', id)}
            onClear={() => clearDimension('type')}
          />

          <div className="pop-card">
            <div className="pop-label mb-3">DNA · {schema.type}</div>
            <div className="flex flex-col gap-4">
              {schema.fields.map((field) => (
                <ChipGroup
                  key={field.key}
                  title={field.name}
                  options={field.options}
                  selected={selection.dna[field.key] ?? []}
                  onToggle={(id) => toggle(field.key, id)}
                  onClear={() => clearDimension(field.key)}
                  optional={field.optional}
                />
              ))}
            </div>
          </div>
          {/* [LEFT2] */}

          <StyleManager
            selected={selection.style}
            onToggle={(id) => toggle('style', id)}
            onClear={() => clearDimension('style')}
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
              onClick={generate}
              disabled={generating}
              className="pop-btn-primary flex-1"
            >
              {generating ? '生成中…' : `生成 ${count} 张`}
            </button>
            {generating && (
              <button type="button" onClick={cancel} className="pop-btn-secondary">
                取消
              </button>
            )}
          </div>
          {status === 'error' && <p className="pop-callout-err">{errorMessage}</p>}
        </section>
        <ResultPanel>
          {items.length === 0 ? (
            <div className="flex h-full items-center justify-center text-center text-sm text-ink-3">
              选好组合后点击「生成」，结果会在这里逐张出现
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {doneItems.length > 0 && (
                <div className="flex items-center justify-end gap-3">
                  <button type="button" onClick={handleDownloadAll} className="pop-link">
                    批量下载（{doneItems.length}）
                  </button>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {items.map((item) => (
                  <div
                    key={item.id}
                    className="flex flex-col overflow-hidden rounded-pop border-2 border-ink bg-paper shadow-sticker-sm"
                  >
                    <div className="flex aspect-[3/4] items-center justify-center bg-soft">
                      {item.status === 'done' && item.url ? (
                        <img
                          src={item.url}
                          alt={item.config.emotion}
                          className="h-full w-full cursor-zoom-in object-cover"
                          onClick={() => setLightboxUrl(item.url!)}
                        />
                      ) : item.status === 'error' ? (
                        <div className="flex flex-col items-center gap-2 px-2 text-center">
                          <span className="text-xs text-err">{item.error}</span>
                          <button
                            type="button"
                            onClick={() => void retryItem(item.id)}
                            className="pop-toggle"
                          >
                            重试
                          </button>
                        </div>
                      ) : (
                        <span className="pop-spinner h-6 w-6" />
                      )}
                    </div>
                    <div className="flex items-center justify-between gap-1 border-t-2 border-ink px-2 py-1.5">
                      <button
                        type="button"
                        onClick={() => setDetailId(item.id)}
                        className="truncate text-left text-xs font-semibold text-ink-2 hover:text-ink"
                        title="查看完整配置 / prompt"
                      >
                        {item.config.emotion} · {item.config.type}
                      </button>
                      {item.status === 'done' && item.url && (
                        <div className="flex shrink-0 items-center gap-1.5">
                          {item.archiveStatus === 'archiving' && (
                            <span className="text-[10px] text-ink-3" title="正在永久化存档">存档中…</span>
                          )}
                          {item.archiveStatus === 'archived' && (
                            <span className="text-[10px] text-ok" title="已永久存储到图库">已存档</span>
                          )}
                          {item.archiveStatus === 'archive-error' && (
                            <button
                              type="button"
                              onClick={() => void archiveItem(item.id)}
                              className="text-[10px] text-err hover:underline"
                              title={item.archiveError || '存档失败，点击重试'}
                            >
                              存档失败·重试
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleDownload(item.url!, item.id)}
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

      {detailItem && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/45 p-4"
          onClick={() => setDetailId(null)}
        >
          <div
            className="max-h-[85vh] w-full max-w-lg overflow-auto rounded-pop-xl border-2 border-ink bg-paper p-5 shadow-sticker-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-display text-sm font-extrabold text-ink">配置详情</h2>
              <button
                type="button"
                onClick={() => setDetailId(null)}
                className="text-ink-3 hover:text-ink"
                aria-label="关闭"
              >
                ✕
              </button>
            </div>
            {detailItem.url && (
              <img
                src={detailItem.url}
                alt=""
                className="mb-3 w-full cursor-zoom-in rounded-pop border-2 border-ink"
                onClick={() => setLightboxUrl(detailItem.url!)}
              />
            )}
            <div className="mb-1 text-xs font-semibold text-ink-3">结构化配置</div>
            <pre className="mb-3 overflow-auto rounded-pop border border-cream-line bg-code-bg p-3 font-mono text-xs text-ink-2">
              {JSON.stringify(detailItem.config, null, 2)}
            </pre>
            <div className="mb-1 text-xs font-semibold text-ink-3">展开后的 Prompt</div>
            <p className="rounded-pop border border-cream-line bg-code-bg p-3 text-xs leading-relaxed text-ink-2">
              {detailItem.prompt || '（尚未生成）'}
            </p>
          </div>
        </div>
      )}

      <Lightbox url={lightboxUrl} onClose={() => setLightboxUrl(null)} />
    </div>
  );
}
