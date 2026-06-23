import { useState } from 'react';
import type { AspectRatio, Resolution } from '@/types/background';
import {
  MOTION_OPTIONS,
  MEDIUM_OPTIONS,
  LIGHT_OPTIONS,
  COLOR_OPTIONS,
  MOOD_OPTIONS,
  BACKGROUND_PRESETS,
} from '@/data/backgroundOptions';
import { useBackgroundStore } from '@/features/background/store';
import { LayerPicker } from '@/features/background/LayerPicker';
import { PresetPicker } from '@/features/background/PresetPicker';
import { downloadImage } from '@/features/background/downloadImage';
import { resolveImageSrc } from '@/services/imageClient';
import { ToolHeader } from '@/components/ToolHeader';
import { ResultPanel } from '@/components/ResultPanel';
import { IconDownload } from '@/components/icons';

const RATIOS: AspectRatio[] = ['9:16', '3:4', '2:3', '1:1', '3:2', '4:3', '16:9'];
const RESOLUTIONS: Resolution[] = ['1k', '2k', '4k'];

export function BackgroundPage() {
  const [downloading, setDownloading] = useState(false);
  const {
    selection,
    ratio,
    resolution,
    extraKeywords,
    status,
    errorMessage,
    result,
    lastPrompt,
    setLayer,
    applySelection,
    setRatio,
    setResolution,
    setExtraKeywords,
    previewPrompt,
    generate,
    cancel,
  } = useBackgroundStore();

  const generating = status === 'generating';
  const imageSrc = result ? resolveImageSrc(result) : '';

  const handleDownload = async () => {
    if (!imageSrc) return;
    setDownloading(true);
    try {
      await downloadImage(imageSrc, `bg-${selection.motion}-${selection.color}-${ratio}.png`);
    } catch (e) {
      console.error('background.download.failed', e);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="min-h-full">
      <ToolHeader
        title="氛围背景图生成器"
        subtitle="Atmospheric Motion Background System · 组合 Motion / Medium / Light / Color / Mood 五层，生成统一品牌语言的抽象氛围背景"
      />
      <main className="mx-auto grid max-w-6xl grid-cols-1 gap-8 p-6 sm:p-8 lg:grid-cols-2">
        <section className="flex flex-col gap-5">
          <div>
            <div className="pop-label mb-2">推荐组合</div>
            <PresetPicker
              presets={BACKGROUND_PRESETS}
              current={selection}
              onApply={applySelection}
            />
          </div>

          <LayerPicker
            title="Motion 运动"
            options={MOTION_OPTIONS}
            selected={selection.motion}
            onSelect={(id) => setLayer('motion', id)}
          />
          <LayerPicker
            title="Medium 介质"
            options={MEDIUM_OPTIONS}
            selected={selection.medium}
            onSelect={(id) => setLayer('medium', id)}
          />
          <LayerPicker
            title="Light 光感"
            options={LIGHT_OPTIONS}
            selected={selection.light}
            onSelect={(id) => setLayer('light', id)}
          />
          <LayerPicker
            title="Color 色彩"
            options={COLOR_OPTIONS}
            selected={selection.color}
            onSelect={(id) => setLayer('color', id)}
          />
          <LayerPicker
            title="Mood 情绪"
            options={MOOD_OPTIONS}
            selected={selection.mood}
            onSelect={(id) => setLayer('mood', id)}
          />

          <div>
            <label className="pop-label mb-2 block">自定义补充词（可选）</label>
            <input
              type="text"
              value={extraKeywords}
              onChange={(e) => setExtraKeywords(e.target.value)}
              placeholder="如 camera sweep blur, minimal composition…"
              className="pop-input"
            />
          </div>
          <div className="flex flex-wrap gap-6">
            <div>
              <div className="pop-label mb-2">比例</div>
              <div className="flex flex-wrap gap-2">
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
              <div className="pop-label mb-2">分辨率</div>
              <div className="flex gap-2">
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

          <details className="pop-card-flat p-3">
            <summary className="cursor-pointer font-mono text-xs font-semibold text-ink-3">
              查看当前 Prompt
            </summary>
            <p className="mt-2 text-xs leading-relaxed text-ink-2">{previewPrompt()}</p>
          </details>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={generate}
              disabled={generating}
              className="pop-btn-primary flex-1"
            >
              {generating ? '生成中…' : '生成背景图'}
            </button>
            {generating && (
              <button type="button" onClick={cancel} className="pop-btn-secondary">
                取消
              </button>
            )}
          </div>
          {status === 'error' && <p className="pop-callout-err">{errorMessage}</p>}
          {/* [LEFT3] */}
        </section>
        <ResultPanel>
          {generating ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-sm text-ink-3">
              <span className="pop-spinner h-8 w-8" />
              正在生成氛围背景…
            </div>
          ) : imageSrc ? (
            <div className="flex flex-col gap-3">
              <div className="relative">
                <img
                  src={imageSrc}
                  alt="生成的氛围背景图"
                  className="w-full rounded-pop border-2 border-ink"
                />
                <button
                  type="button"
                  onClick={handleDownload}
                  disabled={downloading}
                  className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full border-2 border-ink bg-paper text-ink shadow-sticker-sm transition hover:bg-cream-soft disabled:opacity-50"
                  title={downloading ? '下载中…' : '下载图片'}
                  aria-label="下载图片"
                >
                  <IconDownload />
                </button>
              </div>
              {lastPrompt && status === 'done' && (
                <p className="text-xs leading-relaxed text-ink-3">本次 Prompt：{lastPrompt}</p>
              )}
            </div>
          ) : (
            <div className="flex h-full items-center justify-center px-6 text-center text-sm text-ink-3">
              选好五层组合后点击「生成背景图」
            </div>
          )}
        </ResultPanel>
      </main>
    </div>
  );
}
