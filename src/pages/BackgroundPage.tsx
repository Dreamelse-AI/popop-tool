import { useState } from 'react';
import { Link } from 'react-router-dom';
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

const RATIOS: AspectRatio[] = ['9:16', '3:4', '1:1', '4:3', '16:9'];
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
    <div className="min-h-full bg-neutral-100">
      <header className="border-b border-neutral-200 bg-white px-8 py-4">
        <Link to="/" className="text-sm text-neutral-500 hover:text-neutral-900">
          ← 返回工具站
        </Link>
        <h1 className="mt-1 text-xl font-bold text-neutral-900">氛围背景图生成器</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Atmospheric Motion Background System · 组合 Motion / Medium / Light / Color / Mood
          五层，生成统一品牌语言的抽象氛围背景
        </p>
      </header>
      <main className="mx-auto grid max-w-6xl grid-cols-1 gap-8 p-8 lg:grid-cols-2">
        <section className="flex flex-col gap-5">
          <div>
            <div className="mb-2 text-sm font-semibold text-neutral-700">推荐组合</div>
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
            <label className="mb-2 block text-sm font-semibold text-neutral-700">
              自定义补充词（可选）
            </label>
            <input
              type="text"
              value={extraKeywords}
              onChange={(e) => setExtraKeywords(e.target.value)}
              placeholder="如 camera sweep blur, minimal composition…"
              className="w-full rounded-lg border border-neutral-300 px-4 py-2.5 text-sm focus:border-neutral-900 focus:outline-none"
            />
          </div>
          <div className="flex flex-wrap gap-6">
            <div>
              <div className="mb-2 text-sm font-semibold text-neutral-700">比例</div>
              <div className="flex flex-wrap gap-2">
                {RATIOS.map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRatio(r)}
                    className={
                      r === ratio
                        ? 'rounded-md border border-neutral-900 bg-neutral-900 px-3 py-1 text-xs font-medium text-white'
                        : 'rounded-md border border-neutral-200 bg-white px-3 py-1 text-xs font-medium text-neutral-600 transition hover:border-neutral-400'
                    }
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <div className="mb-2 text-sm font-semibold text-neutral-700">分辨率</div>
              <div className="flex gap-2">
                {RESOLUTIONS.map((res) => (
                  <button
                    key={res}
                    type="button"
                    onClick={() => setResolution(res)}
                    className={
                      res === resolution
                        ? 'rounded-md border border-neutral-900 bg-neutral-900 px-3 py-1 text-xs font-medium text-white'
                        : 'rounded-md border border-neutral-200 bg-white px-3 py-1 text-xs font-medium text-neutral-600 transition hover:border-neutral-400'
                    }
                  >
                    {res.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <details className="rounded-lg border border-neutral-200 bg-white p-3">
            <summary className="cursor-pointer text-xs font-semibold text-neutral-500">
              查看当前 Prompt
            </summary>
            <p className="mt-2 text-xs leading-relaxed text-neutral-500">{previewPrompt()}</p>
          </details>
          {/* [LEFT3] */}
        </section>
        <section className="flex flex-col gap-4">
          <div className="flex gap-3">
            <button
              type="button"
              onClick={generate}
              disabled={generating}
              className="flex-1 rounded-lg bg-neutral-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-neutral-700 disabled:cursor-not-allowed disabled:bg-neutral-300"
            >
              {generating ? '生成中…' : '生成背景图'}
            </button>
            {generating && (
              <button
                type="button"
                onClick={cancel}
                className="rounded-lg border border-neutral-300 px-4 py-3 text-sm font-medium text-neutral-600 transition hover:border-neutral-500"
              >
                取消
              </button>
            )}
          </div>

          {status === 'error' && (
            <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">{errorMessage}</p>
          )}
          <div className="flex aspect-[3/4] w-full items-center justify-center overflow-hidden rounded-xl border border-neutral-300 bg-white">
            {generating ? (
              <div className="flex flex-col items-center gap-3 text-sm text-neutral-400">
                <span className="h-8 w-8 animate-spin rounded-full border-2 border-neutral-300 border-t-neutral-900" />
                正在生成氛围背景…
              </div>
            ) : imageSrc ? (
              <img
                src={imageSrc}
                alt="生成的氛围背景图"
                className="h-full w-full object-contain"
              />
            ) : (
              <div className="px-6 text-center text-sm text-neutral-400">
                选好五层组合后点击「生成背景图」
              </div>
            )}
          </div>

          {imageSrc && status === 'done' && (
            <button
              type="button"
              onClick={handleDownload}
              disabled={downloading}
              className="rounded-lg border border-neutral-900 px-5 py-3 text-sm font-semibold text-neutral-900 transition hover:bg-neutral-900 hover:text-white disabled:cursor-not-allowed disabled:border-neutral-300 disabled:text-neutral-300"
            >
              {downloading ? '下载中…' : '下载图片'}
            </button>
          )}

          {lastPrompt && status === 'done' && (
            <p className="text-xs leading-relaxed text-neutral-400">
              本次 Prompt：{lastPrompt}
            </p>
          )}
          {/* [RIGHT2] */}
        </section>
      </main>
    </div>
  );
}
