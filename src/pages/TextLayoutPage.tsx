import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
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
    <div className="min-h-full bg-neutral-100">
      <header className="border-b border-neutral-200 bg-white px-8 py-4">
        <Link to="/" className="text-sm text-neutral-500 hover:text-neutral-900">
          ← 返回工具站
        </Link>
        <h1 className="mt-1 text-xl font-bold text-neutral-900">文字自动化排版 · 链路测试器</h1>
        <p className="mt-1 text-sm text-neutral-500">
          输入文案（≤{MAX_INPUT_LENGTH} 字）→ 后台按框架自动选效果/配色并区间随机参数 → 产出 4:3（1080×810）成品图
        </p>
      </header>

      <main className="mx-auto grid max-w-6xl grid-cols-1 gap-8 p-8 lg:grid-cols-2">
        {/* 左侧：输入 + 后台决策读数 */}
        <section className="flex flex-col gap-5">
          <div>
            <label className="mb-2 block text-sm font-semibold text-neutral-700">输入文案</label>
            <textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="输入产品文案，支持换行分段…"
              rows={6}
              className="w-full resize-none rounded-lg border border-neutral-300 p-4 text-sm leading-relaxed focus:border-neutral-900 focus:outline-none"
            />
            <div className="mt-1 flex justify-between text-xs">
              <span className={overLimit ? 'text-red-500' : 'text-neutral-400'}>
                {inputText.length} / {MAX_INPUT_LENGTH}
              </span>
              {overLimit && <span className="text-red-500">已超出字数上限</span>}
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-neutral-700">
              排版效果 <span className="font-normal text-neutral-400">（可锁定，默认随机）</span>
            </label>
            <EffectPicker value={preferredMode} onChange={setPreferredMode} />
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-neutral-700">
              配色 <span className="font-normal text-neutral-400">（可锁定，默认随机）</span>
            </label>
            <PalettePicker value={preferredPaletteId} onChange={setPreferredPaletteId} />
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={generate}
              disabled={!canGenerate}
              className="flex-1 rounded-lg bg-neutral-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-neutral-700 disabled:cursor-not-allowed disabled:bg-neutral-300"
            >
              {busy ? '生成中…' : '生成'}
            </button>
            <button
              type="button"
              onClick={regenerate}
              disabled={!canGenerate || !hasResult}
              className="rounded-lg border border-neutral-900 px-5 py-3 text-sm font-semibold text-neutral-900 transition hover:bg-neutral-900 hover:text-white disabled:cursor-not-allowed disabled:border-neutral-300 disabled:text-neutral-300"
            >
              换一版
            </button>
          </div>

          {status === 'error' && (
            <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">{errorMessage}</p>
          )}

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
        <section className="flex flex-col items-center gap-5">
          <div className="text-sm font-semibold text-neutral-700">成品（4:3 · 1080×810）</div>
          <div className="overflow-hidden rounded-lg border border-neutral-300 shadow-sm">
            {hasResult ? (
              <LayoutCanvas
                ref={canvasRef}
                mode={mode}
                text={inputText}
                params={params}
                style={style}
                bgImage={bgImage}
                displayWidth={PREVIEW_WIDTH}
              />
            ) : (
              <div
                className="flex items-center justify-center bg-white px-6 text-center text-sm text-neutral-400"
                style={{ width: PREVIEW_WIDTH, height: (PREVIEW_WIDTH * 810) / 1080 }}
              >
                输入文案后点「生成」，后台自动出图
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={handleExport}
            disabled={!hasResult || exporting}
            className="rounded-lg border border-neutral-900 px-5 py-3 text-sm font-semibold text-neutral-900 transition hover:bg-neutral-900 hover:text-white disabled:cursor-not-allowed disabled:border-neutral-300 disabled:text-neutral-300"
          >
            {exporting ? '导出中…' : '导出 PNG'}
          </button>
        </section>
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
    <div className="rounded-xl border border-neutral-200 bg-white p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-bold text-neutral-900">后台决策读数</h2>
        <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-500">
          来源 {source === 'model' ? '模型' : 'mock 规则'}
        </span>
      </div>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
        <Row label="效果" value={effect.name} />
        <Row label="背景" value={bgLabel} />
      </dl>

      <div className="mt-4 border-t border-neutral-100 pt-3">
        <div className="mb-2 text-xs font-semibold text-neutral-500">区间随机参数</div>
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
      <dt className="shrink-0 text-neutral-400">{label}</dt>
      <dd className="truncate text-right font-medium text-neutral-800">{value}</dd>
    </div>
  );
}
