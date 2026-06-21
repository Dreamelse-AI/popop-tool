import { useRef } from 'react';
import { Link } from 'react-router-dom';
import { MAX_INPUT_LENGTH } from '@/types/layout';
import { getTemplateById } from '@/data/templates';
import { useTextLayoutStore } from '@/features/text-layout/store';
import { LayoutCanvas } from '@/features/text-layout/LayoutCanvas';
import { TemplatePicker } from '@/features/text-layout/TemplatePicker';
import { exportCanvasToPng } from '@/features/text-layout/exportImage';

/** 预览缩放：把 1080 宽缩到约 360 显示。 */
const PREVIEW_SCALE = 360 / 1080;

export function TextLayoutPage() {
  const canvasRef = useRef<HTMLDivElement>(null);
  const {
    inputText,
    templateId,
    schema,
    status,
    errorMessage,
    setInputText,
    setTemplateId,
    runExtract,
  } = useTextLayoutStore();

  const template = getTemplateById(templateId);
  const overLimit = inputText.length > MAX_INPUT_LENGTH;
  const canExtract = inputText.trim().length > 0 && !overLimit && status !== 'extracting';

  const handleExport = async () => {
    if (!canvasRef.current) return;
    try {
      await exportCanvasToPng(canvasRef.current, 'text-layout-1080x1440.png');
    } catch (e) {
      console.error('export.failed', e);
      alert('导出失败，请重试');
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
          输入文字（≤{MAX_INPUT_LENGTH} 字）→ 抽取排版结构 → 选模板 → 导出 3:4 文字图片
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
              placeholder="粘贴或输入产品文案，支持换行分段、- 列表、引号金句…"
              rows={10}
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
            {status === 'extracting' ? '抽取中…' : '抽取排版结构'}
          </button>

          {status === 'error' && (
            <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">{errorMessage}</p>
          )}

          <div>
            <label className="mb-2 block text-sm font-semibold text-neutral-700">排版模板</label>
            <TemplatePicker selectedId={templateId} onSelect={setTemplateId} />
          </div>
        </section>

        {/* 右侧：预览与导出 */}
        <section className="flex flex-col items-center gap-5">
          <div className="text-sm font-semibold text-neutral-700">预览（3:4 · 1080×1440）</div>
          <div
            className="overflow-hidden rounded-lg border border-neutral-300 bg-white shadow-sm"
            style={{ width: 1080 * PREVIEW_SCALE, height: 1440 * PREVIEW_SCALE }}
          >
            {schema ? (
              <LayoutCanvas ref={canvasRef} schema={schema} template={template} scale={PREVIEW_SCALE} />
            ) : (
              <div className="flex h-full items-center justify-center px-6 text-center text-sm text-neutral-400">
                抽取后在此预览排版效果
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={handleExport}
            disabled={!schema}
            className="rounded-lg border border-neutral-900 px-5 py-3 text-sm font-semibold text-neutral-900 transition hover:bg-neutral-900 hover:text-white disabled:cursor-not-allowed disabled:border-neutral-300 disabled:text-neutral-300"
          >
            导出 PNG
          </button>
        </section>
      </main>
    </div>
  );
}
