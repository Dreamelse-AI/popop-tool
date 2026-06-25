import { useMemo, useState } from 'react';
import { useNameImageStore, parseElements } from '@/features/batch-name-image/store';
import { downloadImage } from '@/features/background/downloadImage';
import { ToolHeader } from '@/components/ToolHeader';
import { Lightbox } from '@/components/Lightbox';
import { ResultPanel } from '@/components/ResultPanel';
import { IconDownload } from '@/components/icons';

const RATIOS = ['1:1', '9:16', '3:4', '2:3', '3:2', '4:3', '16:9'];
const RESOLUTIONS = ['1k', '2k', '4k'];

export function BatchNameImagePage() {
  const {
    elementsText,
    subject,
    style,
    ratio,
    resolution,
    useExpander,
    concurrency,
    status,
    errorMessage,
    items,
    setElementsText,
    setSubject,
    setStyle,
    setRatio,
    setResolution,
    setUseExpander,
    setConcurrency,
    generate,
    retryItem,
    retryAllFailed,
    removeItem,
    clearItems,
    cancel,
  } = useNameImageStore();

  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  const generating = status === 'generating';
  const elementCount = useMemo(() => parseElements(elementsText).length, [elementsText]);
  const doneItems = items.filter((i) => i.status === 'done' && i.url);

  const total = items.length;
  const doneCount = items.filter((i) => i.status === 'done').length;
  const errorCount = items.filter((i) => i.status === 'error').length;
  const expandingCount = items.filter((i) => i.status === 'generating' && i.phase === 'expanding').length;
  const imagingCount = items.filter((i) => i.status === 'generating' && i.phase === 'imaging').length;
  const finishedCount = doneCount + errorCount;
  const progressPct = total > 0 ? Math.round((finishedCount / total) * 100) : 0;

  const handleDownload = (url: string, id: string) => {
    void downloadImage(url, `name-image-${id}.png`);
  };

  const handleDownloadAll = () => {
    doneItems.forEach((it, i) => {
      setTimeout(() => downloadImage(it.url!, `name-image-${it.id}.png`), i * 300);
    });
  };

  return (
    <div className="min-h-full">
      <ToolHeader
        title="批量名字生图"
        subtitle="基础元素（空行分隔多个内容）× 题材类型 × 风格 → 整理扩写后批量生成对应图片"
      />
      <main className="mx-auto grid max-w-6xl grid-cols-1 gap-8 p-6 sm:p-8 lg:grid-cols-2">
        {/* [LEFT] */}
        <section className="flex flex-col gap-5">
          <div>
            <div className="pop-label mb-1.5">基础元素</div>
            <textarea
              value={elementsText}
              onChange={(e) => setElementsText(e.target.value)}
              placeholder={'每段一个内容，用空行分隔多个，例如：\n\n张三\n\n李四\n\n王五'}
              className="pop-textarea h-44 w-full font-mono text-sm leading-relaxed"
            />
            <p className="mt-1 text-[11px] text-ink-3">
              空行分隔识别为多个内容，已识别 <span className="font-semibold text-ink-2">{elementCount}</span> 个
            </p>
          </div>
        {/* [LEFT_SUBJECT] */}
          <div>
            <div className="pop-label mb-1.5">题材类型</div>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="如：人物形象、音乐封面、产品海报…"
              className="pop-input w-full"
            />
          </div>

          <div>
            <div className="pop-label mb-1.5">风格提示词</div>
            <textarea
              value={style}
              onChange={(e) => setStyle(e.target.value)}
              placeholder="如：扁平插画风，明快撞色，柔和光影…"
              className="pop-textarea h-20 w-full"
            />
          </div>
        {/* [LEFT_OPTS] */}
          <div className="flex flex-wrap items-end gap-6">
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
        {/* [LEFT_OPTS2] */}
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
            <div>
              <div className="pop-label mb-1.5">并发</div>
              <input
                type="number"
                min={1}
                max={8}
                value={concurrency}
                onChange={(e) => setConcurrency(Number(e.target.value))}
                className="pop-input w-16 py-1.5"
                title="同时进行的出图任务数（1-8）"
              />
            </div>
          </div>
        {/* [LEFT_EXPANDER] */}
          <label className="flex cursor-pointer items-start gap-2.5 rounded-pop border-2 border-ink bg-paper p-3">
            <input
              type="checkbox"
              checked={useExpander}
              onChange={(e) => setUseExpander(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 accent-ink"
            />
            <span className="text-xs leading-relaxed text-ink-2">
              <span className="font-semibold text-ink">交给模型整理扩写</span>
              <br />
              把「题材 + 基础元素 + 风格」交给模型整理成更完整的画面描述再出图；关闭则直接按逗号拼接出图。
            </span>
          </label>
        {/* [LEFT_ACTIONS] */}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={generate}
              disabled={generating || elementCount === 0}
              className="pop-btn-primary flex-1"
            >
              {generating ? '生成中…' : elementCount > 0 ? `生成 ${elementCount} 张` : '生成'}
            </button>
            {generating && (
              <button type="button" onClick={cancel} className="pop-btn-secondary">
                取消
              </button>
            )}
          </div>
          {status === 'error' && <p className="pop-callout-err">{errorMessage}</p>}
        </section>
        {/* [RIGHT] */}
        <ResultPanel>
          {items.length === 0 ? (
            <div className="flex h-full items-center justify-center text-center text-sm text-ink-3">
              填好左侧内容后点击「生成」，每个基础元素会在这里生成一张对应图片
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {/* [PROGRESS] */}
              <div className="rounded-pop border-2 border-ink bg-paper p-3">
                <div className="mb-1.5 flex items-center justify-between text-xs font-semibold text-ink-2">
                  <span>
                    进度 {finishedCount}/{total}
                    {expandingCount > 0 && <span className="ml-1 text-ink-3">· 整理中 {expandingCount}</span>}
                    {imagingCount > 0 && <span className="ml-1 text-ink-3">· 出图中 {imagingCount}</span>}
                  </span>
                  <span className="tabular-nums text-ink-3">{progressPct}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full border border-cream-line bg-soft">
                  <div className="h-full bg-ink transition-all duration-300" style={{ width: `${progressPct}%` }} />
                </div>
                {/* [PROGRESS_ACTIONS] */}
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
                  <span className="text-ok">完成 {doneCount}</span>
                  {errorCount > 0 && <span className="text-err">失败 {errorCount}</span>}
                  {errorCount > 0 && !generating && (
                    <button type="button" onClick={() => void retryAllFailed()} className="pop-link">
                      重试全部失败（{errorCount}）
                    </button>
                  )}
                  {!generating && (
                    <button type="button" onClick={clearItems} className="pop-link">
                      清空
                    </button>
                  )}
                  {doneItems.length > 0 && (
                    <button type="button" onClick={handleDownloadAll} className="pop-link ml-auto">
                      批量保存（{doneItems.length}）
                    </button>
                  )}
                </div>
              </div>
              {/* [GRID] */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {items.map((item) => (
                  <div
                    key={item.id}
                    className="flex flex-col overflow-hidden rounded-pop border-2 border-ink bg-paper shadow-sticker-sm"
                  >
                    <div className="relative flex aspect-square items-center justify-center bg-soft">
                      {/* [CARD_IMG] */}
                      {item.status === 'done' && item.url ? (
                        <img
                          src={item.url}
                          alt={item.element}
                          className="h-full w-full cursor-zoom-in object-cover"
                          onClick={() => setLightboxUrl(item.url!)}
                        />
                      ) : item.status === 'error' ? (
                        <div className="flex flex-col items-center gap-2 px-2 text-center">
                          <span className="line-clamp-3 text-xs text-err">{item.error}</span>
                          <button type="button" onClick={() => void retryItem(item.id)} className="pop-toggle">
                            重试
                          </button>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-1.5">
                          <span className="pop-spinner h-6 w-6" />
                          <span className="text-[10px] text-ink-3">
                            {item.phase === 'imaging' ? '出图中…' : item.phase === 'expanding' ? '整理中…' : '排队中…'}
                          </span>
                        </div>
                      )}
                      {/* [CARD_DELETE] */}
                      <button
                        type="button"
                        onClick={() => removeItem(item.id)}
                        className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full border-2 border-ink bg-paper text-xs font-bold text-ink-2 shadow-sticker-sm transition hover:bg-err hover:text-paper"
                        title="删除这张"
                        aria-label="删除"
                      >
                        ✕
                      </button>
                    </div>
                    {/* [CARD_FOOTER] */}
                    <div className="flex items-center justify-between gap-1 border-t-2 border-ink px-2 py-1.5">
                      <span
                        className="truncate text-left text-xs font-semibold text-ink-2"
                        title={item.prompt || item.element}
                      >
                        {item.element}
                      </span>
                      {item.status === 'done' && item.url && (
                        <button
                          type="button"
                          onClick={() => handleDownload(item.url!, item.id)}
                          className="shrink-0 text-ink-3 transition hover:text-ink"
                          title="保存这张"
                          aria-label="保存"
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
      <Lightbox url={lightboxUrl} onClose={() => setLightboxUrl(null)} />
    </div>
  );
}
