import { useRef, useState } from 'react';
import { MAX_INPUT_LENGTH } from '@/types/layout';
import type { EffectMode, EffectParams } from '@/types/layout';
import type { Background } from '@/types/catalog';
import { useTextLayoutStore } from '@/features/text-layout/store';
import { LayoutCanvas, type LayoutCanvasHandle } from '@/features/text-layout/LayoutCanvas';
import { EffectPicker } from '@/features/text-layout/EffectPicker';
import { PalettePicker } from '@/features/text-layout/PalettePicker';
import { getEffect } from '@/data/effectCatalog';
import { getPalette } from '@/data/paletteLibrary';
import { getImage } from '@/data/imageLibrary';
import { downloadDataUrl } from '@/features/text-layout/exportImage';
import { ToolHeader } from '@/components/ToolHeader';
import { ResultPanel } from '@/components/ResultPanel';
import { IconDownload } from '@/components/icons';

const PREVIEW_WIDTH = 460;

/**
 * 链路生产测试器：输入文案 → 后台按框架自动决策（效果/配色 + 区间随机参数）→ 出图。
 * 界面只负责：喂文案、看成品、读后台这次到底选了什么（决策读数）、换一版、导出。
 * 不在前端做手动风格选择，也不展示提示词——那些都在后台 layoutExtractor / buildPrompt 里。
 */
export function TextLayoutPage() {
  const canvasRef = useRef<LayoutCanvasHandle>(null);
  const [exporting, setExporting] = useState(false);
  const {
    inputText,
    hasResult,
    preferredMode,
    preferredPaletteId,
    mode,
    params,
    style,
    background,
    source,
    bgImage,
    status,
    errorMessage,
    setInputText,
    setPreferredMode,
    setPreferredPaletteId,
    generate,
    regenerate,
  } = useTextLayoutStore();

  const overLimit = inputText.length > MAX_INPUT_LENGTH;
  const busy = status === 'generating';
  const canGenerate = inputText.trim().length > 0 && !overLimit && !busy;

  const handleExport = () => {
    if (!canvasRef.current) return;
    setExporting(true);
    try {
      const dataUrl = canvasRef.current.exportPng(2);
      if (dataUrl) {
        downloadDataUrl(dataUrl, `text-layout-${mode}-1080x810.png`);
      }
    } catch (e) {
      console.error('export.failed', e);
      alert('导出失败，请重试');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="min-h-full">
      <ToolHeader
        title="文字自动化排版 · 链路测试器"
        subtitle={`输入文案（≤${MAX_INPUT_LENGTH} 字）→ 后台按框架自动选效果/配色并区间随机参数 → 产出 4:3（1080×810）成品图`}
      />

      <main className="mx-auto grid max-w-6xl grid-cols-1 gap-8 p-6 sm:p-8 lg:grid-cols-2">
        {/* 左侧：输入 + 后台决策读数 */}
        <section className="flex flex-col gap-5">
          <div>
            <label className="pop-label mb-2 block">输入文案</label>
            <textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="输入产品文案，支持换行分段…"
              rows={6}
              className="pop-textarea"
            />
            <div className="mt-1 flex justify-between text-xs">
              <span className={overLimit ? 'text-err' : 'text-ink-3'}>
                {inputText.length} / {MAX_INPUT_LENGTH}
              </span>
              {overLimit && <span className="text-err">已超出字数上限</span>}
            </div>
          </div>

          <div>
            <label className="pop-label mb-2 block">
              排版效果 <span className="font-normal text-ink-3">（可锁定，默认随机）</span>
            </label>
            <EffectPicker value={preferredMode} onChange={setPreferredMode} />
          </div>

          <div>
            <label className="pop-label mb-2 block">
              配色 <span className="font-normal text-ink-3">（可锁定，默认随机）</span>
            </label>
            <PalettePicker value={preferredPaletteId} onChange={setPreferredPaletteId} />
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={generate}
              disabled={!canGenerate}
              className="pop-btn-primary flex-1"
            >
              {busy ? '生成中…' : '生成'}
            </button>
            <button
              type="button"
              onClick={regenerate}
              disabled={!canGenerate || !hasResult}
              className="pop-btn-secondary"
            >
              换一版
            </button>
          </div>

          {status === 'error' && <p className="pop-callout-err">{errorMessage}</p>}

          {hasResult && (
            <DecisionReadout
              mode={mode}
              params={params}
              background={background}
              source={source}
            />
          )}
        </section>

        {/* 右侧：成品预览 + 导出 */}
        <ResultPanel>
          {hasResult ? (
            <div className="flex flex-col gap-3">
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleExport}
                  disabled={exporting}
                  className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-ink bg-paper text-ink shadow-sticker-sm transition hover:bg-cream-soft disabled:opacity-50"
                  title={exporting ? '导出中…' : '导出 PNG'}
                  aria-label="导出 PNG"
                >
                  <IconDownload />
                </button>
              </div>
              <div className="self-center overflow-hidden rounded-pop border-2 border-ink">
                <LayoutCanvas
                  ref={canvasRef}
                  mode={mode}
                  text={inputText}
                  params={params}
                  style={style}
                  bgImage={bgImage}
                  displayWidth={PREVIEW_WIDTH}
                />
              </div>
            </div>
          ) : (
            <div className="flex h-full items-center justify-center px-6 text-center text-sm text-ink-3">
              输入文案后点「生成」，后台自动出图
            </div>
          )}
        </ResultPanel>
      </main>
    </div>
  );
}

interface DecisionReadoutProps {
  mode: EffectMode;
  params: EffectParams;
  background: Background;
  source: 'mock' | 'model';
}

/** 后台这一版到底选了什么 + 随机出的参数，纯只读，用于核对链路产出。 */
function DecisionReadout({ mode, params, background, source }: DecisionReadoutProps) {
  const effect = getEffect(mode);
  const bgLabel =
    background.type === 'palette'
      ? `配色 · ${getPalette(background.paletteId).name}`
      : `图片 · ${getImage(background.imageId)?.name ?? background.imageId}`;

  const paramRows = effect.params.map((spec) => {
    const value = params[spec.key as keyof EffectParams];
    return { label: spec.label, value: `${value}${spec.unit ?? ''}` };
  });

  return (
    <div className="pop-card">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-display text-sm font-extrabold text-ink">后台决策读数</h2>
        <span className="pop-tag-cream">
          来源 {source === 'model' ? '模型' : 'mock 规则'}
        </span>
      </div>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
        <Row label="效果" value={effect.name} />
        <Row label="背景" value={bgLabel} />
      </dl>

      <div className="mt-4 border-t-2 border-dashed border-cream-line pt-3">
        <div className="mb-2 text-xs font-semibold text-ink-3">区间随机参数</div>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
          {paramRows.map((r) => (
            <Row key={r.label} label={r.label} value={r.value} />
          ))}
        </dl>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <dt className="shrink-0 text-ink-3">{label}</dt>
      <dd className="truncate text-right font-semibold text-ink">{value}</dd>
    </div>
  );
}
