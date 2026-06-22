import { Link } from 'react-router-dom';
import type { AspectRatio, Resolution, AssetType } from '@/types/visualAsset';
import {
  EMOTION_OPTIONS,
  TYPE_OPTIONS,
  DNA_SCHEMAS,
  ENABLED_TYPES,
} from '@/data/visualAssetCatalog';
import { useVisualAssetStore } from '@/features/visual-asset/store';
import { ChipGroup } from '@/features/visual-asset/ChipGroup';
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
    cancel,
  } = useVisualAssetStore();

  const generating = status === 'generating';

  // 当前 type：用户选了就用第一个，否则默认第一个已启用 type（决定 DNA 展开哪套）
  const activeType: AssetType = (selection.type[0] as AssetType) ?? ENABLED_TYPES[0];
  const schema = DNA_SCHEMAS[activeType];

  // 仅展示已启用的 type 选项（第一版只 Abstract）
  const typeOptions = TYPE_OPTIONS.filter((t) => ENABLED_TYPES.includes(t.id as AssetType));

  const handleDownload = (url: string, id: string) => {
    void downloadImage(url, `asset-${id}.png`);
  };

  return (
    <div className="min-h-full bg-neutral-100">
      <header className="border-b border-neutral-200 bg-white px-8 py-4">
        <Link to="/" className="text-sm text-neutral-500 hover:text-neutral-900">
          ← 返回工具站
        </Link>
        <h1 className="mt-1 text-xl font-bold text-neutral-900">视觉资产生产引擎</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Emotion × Type × DNA 三态组合（锁定 / 多选随机 / 不选全随机）→ 批量生成视觉资产
        </p>
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
          <div className="text-sm font-semibold text-neutral-700">
            结果 {items.length > 0 && `（${items.filter((i) => i.status === 'done').length}/${items.length}）`}
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
                        className="h-full w-full object-cover"
                      />
                    ) : item.status === 'error' ? (
                      <span className="px-2 text-center text-xs text-red-500">{item.error}</span>
                    ) : (
                      <span className="h-6 w-6 animate-spin rounded-full border-2 border-neutral-300 border-t-neutral-900" />
                    )}
                  </div>
                  <div className="flex items-center justify-between gap-1 px-2 py-1.5">
                    <span className="truncate text-xs text-neutral-500" title={`${item.config.emotion} · ${item.config.type}`}>
                      {item.config.emotion}
                    </span>
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
    </div>
  );
}
