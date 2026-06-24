import { useState } from 'react';
import type { MattingMode } from '@/types/sticker';
import { useStickerStore } from '@/features/sticker/store';
import { PromptManager } from '@/features/sticker/PromptManager';
import { EmotionManager } from '@/features/sticker/EmotionManager';
import { ReferenceUploader } from '@/features/sticker/ReferenceUploader';
import { downloadImage } from '@/features/background/downloadImage';
import { ToolHeader } from '@/components/ToolHeader';
import { Lightbox } from '@/components/Lightbox';
import { ResultPanel } from '@/components/ResultPanel';
import { IconDownload } from '@/components/icons';

const MATTING_OPTIONS: { id: MattingMode; label: string }[] = [
  { id: 'colorKey', label: 'AI 抠图（去背景）' },
  { id: 'none', label: '不抠图（保留背景）' },
];

const STATUS_TEXT: Record<string, string> = {
  generating: '出图中（单次生成九宫格）…',
  slicing: '切图中…',
  matting: 'AI 抠图中（首次需下载模型，稍慢）…',
};

export function StickerPage() {
  const {
    referenceImages,
    prompt,
    matting,
    status,
    errorMessage,
    gridUrl,
    items,
    addReferenceImages,
    removeReferenceImage,
    clearReferenceImages,
    setPrompt,
    setMatting,
    generate,
    cancel,
  } = useStickerStore();

  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [lightboxTransparent, setLightboxTransparent] = useState(false);

  /** 打开单个表情大图：抠过图的是透明 PNG，关掉描边框 */
  const openItemLightbox = (dataUrl: string) => {
    setLightboxTransparent(matting === 'colorKey');
    setLightboxUrl(dataUrl);
  };
  /** 打开九宫格大图：始终带背景，用常规描边框 */
  const openGridLightbox = (url: string) => {
    setLightboxTransparent(false);
    setLightboxUrl(url);
  };

  const busy = status === 'generating' || status === 'slicing' || status === 'matting';
  const doneItems = items.filter((i) => i.status === 'done' && i.dataUrl);

  const handleDownloadAll = () => {
    doneItems.forEach((it, i) => {
      const name = `sticker-${it.index + 1}-${it.emotionLabel ?? ''}.png`;
      setTimeout(() => downloadImage(it.dataUrl!, name), i * 300);
    });
  };

  return (
    <div className="min-h-full">
      <ToolHeader
        title="表情包生成器"
        subtitle="上传人物形象 → 一次出图生成 3×3 九宫格 → 自动切成 9 张并去背景"
      />
      <main className="mx-auto grid max-w-6xl grid-cols-1 gap-8 p-6 sm:p-8 lg:grid-cols-2">
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
          <div className="pop-card flex flex-col gap-4">
            <div>
              <div className="pop-label mb-1.5">去背景</div>
              <div className="flex flex-wrap gap-1.5">
                {MATTING_OPTIONS.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setMatting(m.id)}
                    className={m.id === matting ? 'pop-toggle-on' : 'pop-toggle'}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
              {matting === 'colorKey' && (
                <p className="mt-1.5 text-xs text-ink-3">
                  用浏览器本地 AI 模型分割主体去背景，发丝级、无锯齿、不依赖背景色。首次使用会下载一次模型（稍慢），之后会缓存复用。
                </p>
              )}
            </div>
            {/* [RATIO_RES] */}
            {/* [RATIO_RES] */}
            <p className="text-xs text-ink-3">
              出图规格固定：九宫格大图 1:1 · 2K（3×3 均分），单个表情居中裁成 1:1。
            </p>
          </div>
          {/* [ACTIONS] */}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => void generate()}
              disabled={busy}
              className="pop-btn-primary flex-1"
            >
              {busy ? (STATUS_TEXT[status] ?? '处理中…') : '生成 9 个表情'}
            </button>
            {busy && (
              <button type="button" onClick={cancel} className="pop-btn-secondary">
                取消
              </button>
            )}
          </div>
          {status === 'error' && errorMessage && <p className="pop-callout-err">{errorMessage}</p>}
        </section>
        {/* [RIGHT] */}
        <ResultPanel>
          {items.length === 0 ? (
            <div className="flex h-full items-center justify-center text-center text-sm text-ink-3">
              上传人物图、写好提示词后点「生成」，9 个表情会在这里出现
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {doneItems.length > 0 && (
                <div className="flex items-center justify-end gap-3">
                  <button type="button" onClick={handleDownloadAll} className="pop-link">
                    批量下载（{doneItems.length}）
                  </button>
                  {gridUrl && (
                    <button type="button" onClick={() => openGridLightbox(gridUrl)} className="pop-link">
                      看九宫格大图
                    </button>
                  )}
                </div>
              )}
              <div className="grid grid-cols-3 gap-3">
                {items.map((item) => (
                  <div
                    key={item.id}
                    className="flex flex-col overflow-hidden rounded-pop border-2 border-ink bg-paper shadow-sticker-sm"
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
                          onClick={() => openItemLightbox(item.dataUrl!)}
                        />
                      ) : item.status === 'error' ? (
                        <span className="px-2 text-center text-xs text-err">{item.error}</span>
                      ) : (
                        <span className="pop-spinner h-6 w-6" />
                      )}
                    </div>
                    <div className="flex items-center justify-between border-t-2 border-ink px-2 py-1.5">
                      <span className="truncate text-xs font-semibold text-ink-2" title={item.emotionLabel}>
                        {item.emotionLabel ?? `#${item.index + 1}`}
                      </span>
                      {item.status === 'done' && item.dataUrl && (
                        <button
                          type="button"
                          onClick={() => downloadImage(item.dataUrl!, `sticker-${item.index + 1}.png`)}
                          className="shrink-0 text-ink-3 transition hover:text-ink"
                          title="下载"
                          aria-label="下载"
                        >
                          <IconDownload />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </ResultPanel>
      </main>
      <Lightbox url={lightboxUrl} onClose={() => setLightboxUrl(null)} transparent={lightboxTransparent} />
    </div>
  );
}
