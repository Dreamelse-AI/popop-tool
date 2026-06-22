import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { MAX_INPUT_LENGTH } from '@/types/layout';
import { useTextLayoutStore } from '@/features/text-layout/store';
import { LayoutCanvas, type LayoutCanvasHandle } from '@/features/text-layout/LayoutCanvas';
import { ModePicker } from '@/features/text-layout/ModePicker';
import { ParamControls } from '@/features/text-layout/ParamControls';
import { BackgroundPicker } from '@/features/text-layout/BackgroundPicker';
import { PromptPanel } from '@/features/text-layout/PromptPanel';
import { downloadDataUrl } from '@/features/text-layout/exportImage';

const PREVIEW_WIDTH = 420;

export function TextLayoutPage() {
  const canvasRef = useRef<LayoutCanvasHandle>(null);
  const [exporting, setExporting] = useState(false);
  const {
    inputText,
    mode,
    params,
    style,
    background,
    shapeImage,
    shapeImageName,
    bgImage,
    status,
    errorMessage,
    setInputText,
    setMode,
    setParam,
    setBackground,
    setShapeImage,
    reseed,
    runExtract,
  } = useTextLayoutStore();

  const overLimit = inputText.length > MAX_INPUT_LENGTH;
  const canExtract = inputText.trim().length > 0 && !overLimit && status !== 'extracting';
  const hasContent = inputText.trim().length > 0 && !overLimit;

  const handleImageUpload = (file: File | undefined) => {
    if (!file) return;
    const img = new Image();
    img.onload = () => setShapeImage(img, file.name);
    img.onerror = () => {
      console.error('image.load.failed', file.name);
      alert('图片加载失败，请换一张');
    };
    img.src = URL.createObjectURL(file);
  };

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
        <h1 className="mt-1 text-xl font-bold text-neutral-900">文字自动化排版</h1>
        <p className="mt-1 text-sm text-neutral-500">
          输入文字（≤{MAX_INPUT_LENGTH} 字）→ 选特效 → 微调 → 导出 4:3 文字图片（1080×810）
        </p>
      </header>

      <main className="mx-auto grid max-w-6xl grid-cols-1 gap-8 p-8 lg:grid-cols-2">
        {/* 左侧：输入与控制 */}
        <section className="flex flex-col gap-5">
          <div>
            <label className="mb-2 block text-sm font-semibold text-neutral-700">输入文字</label>
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

          <button
            type="button"
            onClick={runExtract}
            disabled={!canExtract}
            className="rounded-lg bg-neutral-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-neutral-700 disabled:cursor-not-allowed disabled:bg-neutral-300"
          >
            {status === 'extracting' ? '抽取中…' : '抽取并推荐特效'}
          </button>

          {status === 'error' && (
            <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">{errorMessage}</p>
          )}

          <div>
            <label className="mb-2 block text-sm font-semibold text-neutral-700">排版特效</label>
            <ModePicker selected={mode} onSelect={setMode} />
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-neutral-700">背景</label>
            <BackgroundPicker background={background} onSelect={setBackground} />
          </div>

          {mode === 'imageFill' && params.fillShape === 'image' && (
            <div>
              <label className="mb-2 block text-sm font-semibold text-neutral-700">
                上传形状图片
              </label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => handleImageUpload(e.target.files?.[0])}
                className="block w-full text-sm text-neutral-600 file:mr-3 file:rounded file:border-0 file:bg-neutral-900 file:px-4 file:py-2 file:text-white"
              />
              <p className="mt-1 text-xs text-neutral-400">
                {shapeImageName
                  ? `已上传：${shapeImageName}`
                  : '建议黑白剪影或对比强烈的形状，文字会填进暗部。'}
              </p>
            </div>
          )}

          <div>
            <label className="mb-2 block text-sm font-semibold text-neutral-700">参数微调</label>
            <ParamControls mode={mode} params={params} onChange={setParam} onReseed={reseed} />
          </div>
        </section>

        {/* 右侧：预览与导出 */}
        <section className="flex flex-col items-center gap-5">
          <div className="text-sm font-semibold text-neutral-700">预览（4:3 · 1080×810）</div>
          <div className="overflow-hidden rounded-lg border border-neutral-300 shadow-sm">
            {hasContent ? (
              <LayoutCanvas
                ref={canvasRef}
                mode={mode}
                text={inputText}
                params={params}
                style={style}
                shapeImage={shapeImage}
                bgImage={bgImage}
                displayWidth={PREVIEW_WIDTH}
              />
            ) : (
              <div
                className="flex items-center justify-center bg-white px-6 text-center text-sm text-neutral-400"
                style={{ width: PREVIEW_WIDTH, height: (PREVIEW_WIDTH * 810) / 1080 }}
              >
                输入文字后在此预览特效
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={handleExport}
            disabled={!hasContent || exporting}
            className="rounded-lg border border-neutral-900 px-5 py-3 text-sm font-semibold text-neutral-900 transition hover:bg-neutral-900 hover:text-white disabled:cursor-not-allowed disabled:border-neutral-300 disabled:text-neutral-300"
          >
            {exporting ? '导出中…' : '导出 PNG'}
          </button>
        </section>
      </main>

      {/* 生产链路面板：提示词片段 + 输出示例 */}
      <section className="mx-auto max-w-6xl px-8 pb-12">
        <div className="rounded-xl border border-neutral-200 bg-white p-6">
          <h2 className="mb-1 text-base font-bold text-neutral-900">生产链路对接</h2>
          <p className="mb-4 text-sm text-neutral-500">
            这套排版/配色目录会拼进模型的内容生成提示词；模型在生成文案时一并选好风格，按下方 JSON 结构输出。
          </p>
          <PromptPanel mode={mode} params={params} background={background} text={inputText} />
        </div>
      </section>
    </div>
  );
}
