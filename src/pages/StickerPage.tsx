import { Link } from 'react-router-dom';
import { useState } from 'react';
import type { AspectRatio, Resolution } from '@/types/visualAsset';
import type { MattingMode } from '@/types/sticker';
import { useStickerStore } from '@/features/sticker/store';
import { PromptManager } from '@/features/sticker/PromptManager';
import { EmotionManager } from '@/features/sticker/EmotionManager';
import { ReferenceUploader } from '@/features/sticker/ReferenceUploader';
import { downloadImage } from '@/features/background/downloadImage';

const RATIOS: AspectRatio[] = ['1:1', '3:4', '4:3', '9:16', '16:9'];
const RESOLUTIONS: Resolution[] = ['1k', '2k', '4k'];
const MATTING_OPTIONS: { id: MattingMode; label: string }[] = [
  { id: 'colorKey', label: '色键抠图（去背景）' },
  { id: 'none', label: '不抠图（保留背景）' },
];

const STATUS_TEXT: Record<string, string> = {
  generating: '出图中（单次生成九宫格）…',
  slicing: '切图中…',
  matting: '抠图中…',
};

export function StickerPage() {
  const {
    referenceImages,
    prompt,
    ratio,
    resolution,
    matting,
    status,
    errorMessage,
    gridUrl,
    items,
    addReferenceImages,
    removeReferenceImage,
    clearReferenceImages,
    setPrompt,
    setRatio,
    setResolution,
    setMatting,
    generate,
    cancel,
  } = useStickerStore();

  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  const busy = status === 'generating' || status === 'slicing' || status === 'matting';
  const doneItems = items.filter((i) => i.status === 'done' && i.dataUrl);

  const handleDownloadAll = () => {
    doneItems.forEach((it, i) => {
      const name = `sticker-${it.index + 1}-${it.emotionLabel ?? ''}.png`;
      setTimeout(() => downloadImage(it.dataUrl!, name), i * 300);
    });
  };

  return (
    <div className="min-h-full bg-neutral-100">
      <header className="border-b border-neutral-200 bg-white px-8 py-4">
        <Link to="/" className="text-sm text-neutral-500 hover:text-neutral-900">
          ← 返回工具站
        </Link>
        <div className="mt-1">
          <h1 className="text-xl font-bold text-neutral-900">表情包生成器</h1>
          <p className="mt-1 text-sm text-neutral-500">
            上传人物形象 → 一次出图生成 3×3 九宫格 → 自动切成 9 张并去背景
          </p>
        </div>
      </header>
      <main className="mx-auto grid max-w-6xl grid-cols-1 gap-8 p-8 lg:grid-cols-2">
        <section className="flex flex-col gap-5">
          <ReferenceUploader
            images={referenceImages}
            onAdd={addReferenceImages}
            onRemove={removeReferenceImage}
            onClear={clearReferenceImages}
          />

          <PromptManager value={prompt} onChange={setPrompt} />

          <EmotionManager />
          {/* [CONTROLS] */}
          <div className="flex flex-col gap-4 rounded-lg border border-neutral-200 bg-white p-4">
            <div>
              <div className="mb-1.5 text-sm font-semibold text-neutral-700">去背景</div>
              <div className="flex flex-wrap gap-1.5">
                {MATTING_OPTIONS.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setMatting(m.id)}
                    className={
                      m.id === matting
                        ? 'rounded-md border border-neutral-900 bg-neutral-900 px-2.5 py-1 text-xs font-medium text-white'
                        : 'rounded-md border border-neutral-200 bg-white px-2.5 py-1 text-xs text-neutral-600 hover:border-neutral-400'
                    }
                  >
                    {m.label}
                  </button>
                ))}
              </div>
              {matting === 'colorKey' && (
                <p className="mt-1.5 text-xs text-neutral-400">
                  会要求模型出纯绿背景，再按颜色阈值抠掉。发丝等细节可能抠不净，效果不满意可改用「不抠图」。
                </p>
              )}
            </div>
            {/* [RATIO_RES] */}
            <div className="flex flex-wrap items-end gap-6">
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
          </div>
          {/* [ACTIONS] */}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => void generate()}
              disabled={busy}
              className="flex-1 rounded-lg bg-neutral-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-neutral-700 disabled:cursor-not-allowed disabled:bg-neutral-300"
            >
              {busy ? (STATUS_TEXT[status] ?? '处理中…') : '生成 9 个表情'}
            </button>
            {busy && (
              <button
                type="button"
                onClick={cancel}
                className="rounded-lg border border-neutral-300 px-4 py-3 text-sm font-medium text-neutral-600 hover:border-neutral-500"
              >
                取消
              </button>
            )}
          </div>
          {status === 'error' && errorMessage && (
            <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">{errorMessage}</p>
          )}
        </section>
        {/* [RIGHT] */}
        <section className="flex flex-col gap-4">
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
              上传人物图、写好提示词后点「生成」，9 个表情会在这里出现
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-3">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="flex flex-col overflow-hidden rounded-lg border border-neutral-200 bg-white"
                >
                  <div
                    className="flex aspect-square items-center justify-center"
                    style={{
                      backgroundImage:
                        'linear-gradient(45deg,#eee 25%,transparent 25%),linear-gradient(-45deg,#eee 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#eee 75%),linear-gradient(-45deg,transparent 75%,#eee 75%)',
                      backgroundSize: '16px 16px',
                      backgroundPosition: '0 0,0 8px,8px -8px,-8px 0',
                    }}
                  >
                    {item.status === 'done' && item.dataUrl ? (
                      <img
                        src={item.dataUrl}
                        alt={`表情 ${item.index + 1}`}
                        className="h-full w-full cursor-zoom-in object-contain"
                        onClick={() => setLightboxUrl(item.dataUrl!)}
                      />
                    ) : item.status === 'error' ? (
                      <span className="px-2 text-center text-xs text-red-500">{item.error}</span>
                    ) : (
                      <span className="h-6 w-6 animate-spin rounded-full border-2 border-neutral-300 border-t-neutral-900" />
                    )}
                  </div>
                  <div className="flex items-center justify-between px-2 py-1.5">
                    <span className="truncate text-xs text-neutral-500" title={item.emotionLabel}>
                      {item.emotionLabel ?? `#${item.index + 1}`}
                    </span>
                    {item.status === 'done' && item.dataUrl && (
                      <button
                        type="button"
                        onClick={() => downloadImage(item.dataUrl!, `sticker-${item.index + 1}.png`)}
                        className="text-xs text-neutral-400 hover:text-neutral-900"
                      >
                        下载
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {gridUrl && (
            <button
              type="button"
              onClick={() => setLightboxUrl(gridUrl)}
              className="self-start text-xs text-neutral-400 hover:text-neutral-900"
            >
              查看原始九宫格大图
            </button>
          )}
        </section>
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
