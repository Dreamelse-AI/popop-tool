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
    <div className="min-h-full bg-neutral-100">
      <header className="border-b border-neutral-200 bg-white px-8 py-4">
        <Link to="/" className="text-sm text-neutral-500 hover:text-neutral-900">
          ← 返回工具站
        </Link>
        <div className="mt-1 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-neutral-900">视觉资产生产引擎</h1>
            <p className="mt-1 text-sm text-neutral-500">
              Emotion × Type × DNA 三态组合（锁定 / 多选随机 / 不选全随机）→ 批量生成视觉资产
            </p>
          </div>
          <Link
            to="/tools/visual-asset/gallery"
            className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm text-neutral-600 hover:border-neutral-500"
          >
            图库
          </Link>
        </div>
      </header>
      <main className="mx-auto grid max-w-6xl grid-cols-1 gap-8 p-8 lg:grid-cols-2">
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

          <div className="rounded-lg border border-neutral-200 bg-white p-4">
            <div className="mb-3 text-sm font-semibold text-neutral-700">
              DNA · {schema.type}
            </div>
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
              <div className="mb-1.5 text-sm font-semibold text-neutral-700">数量</div>
              <input
                type="number"
                min={1}
                max={50}
                value={count}
                onChange={(e) => setCount(Number(e.target.value))}
                className="w-20 rounded-md border border-neutral-300 px-3 py-1.5 text-sm focus:border-neutral-900 focus:outline-none"
              />
            </div>
            <div>
              <div className="mb-1.5 text-sm font-semibold text-neutral-700">比例</div>
              <div className="flex flex-wrap gap-1.5">
                {RATIOS.map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRatio(r)}
                    className={
                      r === ratio
                        ? 'rounded-md border border-neutral-900 bg-neutral-900 px-2.5 py-1 text-xs font-medium text-white'
                        : 'rounded-md border border-neutral-200 bg-white px-2.5 py-1 text-xs text-neutral-600 hover:border-neutral-400'
                    }
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <div className="mb-1.5 text-sm font-semibold text-neutral-700">分辨率</div>
              <div className="flex gap-1.5">
                {RESOLUTIONS.map((res) => (
                  <button
                    key={res}
                    type="button"
                    onClick={() => setResolution(res)}
                    className={
                      res === resolution
                        ? 'rounded-md border border-neutral-900 bg-neutral-900 px-2.5 py-1 text-xs font-medium text-white'
                        : 'rounded-md border border-neutral-200 bg-white px-2.5 py-1 text-xs text-neutral-600 hover:border-neutral-400'
                    }
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
              className="flex-1 rounded-lg bg-neutral-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-neutral-700 disabled:cursor-not-allowed disabled:bg-neutral-300"
            >
              {generating ? '生成中…' : `生成 ${count} 张`}
            </button>
            {generating && (
              <button
                type="button"
                onClick={cancel}
                className="rounded-lg border border-neutral-300 px-4 py-3 text-sm font-medium text-neutral-600 hover:border-neutral-500"
              >
                取消
              </button>
            )}
          </div>
          {status === 'error' && (
            <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">{errorMessage}</p>
          )}
        </section>
        <section className="flex flex-col gap-4">
          {/* [RIGHT] */}
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold text-neutral-700">
              结果 {items.length > 0 && `（${doneItems.length}/${items.length}）`}
            </div>
            {doneItems.length > 0 && (
              <button
                type="button"
                onClick={handleDownloadAll}
                className="text-xs text-neutral-500 hover:text-neutral-900"
              >
                批量下载（{doneItems.length}）
              </button>
            )}
          </div>
          {items.length === 0 ? (
            <div className="flex h-64 items-center justify-center rounded-xl border border-dashed border-neutral-300 bg-white px-6 text-center text-sm text-neutral-400">
              选好组合后点击「生成」，结果会在这里逐张出现
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="flex flex-col overflow-hidden rounded-lg border border-neutral-200 bg-white"
                >
                  <div className="flex aspect-[3/4] items-center justify-center bg-neutral-50">
                    {item.status === 'done' && item.url ? (
                      <img
                        src={item.url}
                        alt={item.config.emotion}
                        className="h-full w-full cursor-zoom-in object-cover"
                        onClick={() => setLightboxUrl(item.url!)}
                      />
                    ) : item.status === 'error' ? (
                      <div className="flex flex-col items-center gap-2 px-2 text-center">
                        <span className="text-xs text-red-500">{item.error}</span>
                        <button
                          type="button"
                          onClick={() => void retryItem(item.id)}
                          className="rounded-md border border-neutral-300 px-2 py-0.5 text-xs text-neutral-600 hover:border-neutral-500"
                        >
                          重试
                        </button>
                      </div>
                    ) : (
                      <span className="h-6 w-6 animate-spin rounded-full border-2 border-neutral-300 border-t-neutral-900" />
                    )}
                  </div>
                  <div className="flex items-center justify-between gap-1 px-2 py-1.5">
                    <button
                      type="button"
                      onClick={() => setDetailId(item.id)}
                      className="truncate text-left text-xs text-neutral-500 hover:text-neutral-900"
                      title="查看完整配置 / prompt"
                    >
                      {item.config.emotion} · {item.config.type}
                    </button>
                    {item.status === 'done' && item.url && (
                      <button
                        type="button"
                        onClick={() => handleDownload(item.url!, item.id)}
                        className="shrink-0 text-xs text-neutral-400 hover:text-neutral-900"
                      >
                        下载
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>

      {detailItem && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setDetailId(null)}
        >
          <div
            className="max-h-[85vh] w-full max-w-lg overflow-auto rounded-xl bg-white p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-neutral-800">配置详情</h2>
              <button
                type="button"
                onClick={() => setDetailId(null)}
                className="text-neutral-400 hover:text-neutral-900"
                aria-label="关闭"
              >
                ✕
              </button>
            </div>
            {detailItem.url && (
              <img
                src={detailItem.url}
                alt=""
                className="mb-3 w-full cursor-zoom-in rounded-lg"
                onClick={() => setLightboxUrl(detailItem.url!)}
              />
            )}
            <div className="mb-1 text-xs font-semibold text-neutral-500">结构化配置</div>
            <pre className="mb-3 overflow-auto rounded-md bg-neutral-50 p-3 text-xs text-neutral-700">
              {JSON.stringify(detailItem.config, null, 2)}
            </pre>
            <div className="mb-1 text-xs font-semibold text-neutral-500">展开后的 Prompt</div>
            <p className="rounded-md bg-neutral-50 p-3 text-xs leading-relaxed text-neutral-700">
              {detailItem.prompt || '（尚未生成）'}
            </p>
          </div>
        </div>
      )}

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
