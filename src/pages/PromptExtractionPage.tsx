import { useState } from 'react';
import { useExtractionStore, type PromptGroup } from '@/features/prompt-extraction/store';
import { buildFullPrompt } from '@/services/promptExtractor';
import { filesToDataUrls } from '@/features/sticker/fileToDataUrl';
import { downloadImage } from '@/utils/downloadImage';
import { ToolHeader } from '@/components/ToolHeader';
import { Lightbox } from '@/components/Lightbox';
import { IconDownload } from '@/components/icons';
import { PromptDropzone } from '@/features/prompt-extraction/PromptDropzone';

const RATIOS = ['1:1', '9:16', '3:4', '2:3', '3:2', '4:3', '16:9'];
const RESOLUTIONS = ['1k', '2k', '4k'];

export function PromptExtractionPage() {
  const {
    ratio,
    resolution,
    groups,
    busy,
    setRatio,
    setResolution,
    addImages,
    setContentPrompt,
    setStylePrompt,
    regenerate,
    reanalyze,
    removeGroup,
    clearAll,
    cancel,
  } = useExtractionStore();

  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);

  const handleFiles = async (files: File[]) => {
    setImporting(true);
    try {
      const dataUrls = await filesToDataUrls(files);
      await addImages(dataUrls);
    } finally {
      setImporting(false);
    }
  };

  const doneCount = groups.filter((g) => g.status === 'done').length;

  return (
    <div className="min-h-full">
      <ToolHeader
        title="提示词提取工具"
        subtitle="上传 / 粘贴 / 拖入图片，自动分析完整提示词与关键画风提示词，并调用生图模型验证效果"
        actions={
          groups.length > 0 ? (
            <button type="button" onClick={clearAll} className="pop-btn-secondary" disabled={busy}>
              清空
            </button>
          ) : undefined
        }
      />
      <main className="mx-auto max-w-6xl p-6 sm:p-8">
        <section className="pop-card mb-6 flex flex-col gap-4 p-5">
          <PromptDropzone onFiles={(f) => void handleFiles(f)} busy={busy || importing} />
          <div className="flex flex-wrap items-end gap-6">
            <div>
              <div className="pop-label mb-1.5">验证图比例</div>
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
            <div className="ml-auto flex items-center gap-3 text-xs text-ink-3">
              <span>
                共 <span className="font-semibold text-ink-2">{groups.length}</span> 组 · 完成{' '}
                <span className="font-semibold text-ok">{doneCount}</span>
              </span>
              {busy && (
                <button type="button" onClick={cancel} className="pop-link">
                  取消全部
                </button>
              )}
            </div>
          </div>
        </section>

        {groups.length === 0 ? (
          <div className="flex min-h-48 items-center justify-center rounded-pop-lg border-2 border-dashed border-cream-2 bg-paper/40 text-center text-sm text-ink-3">
            上传图片后，每张图会在下方生成一组：左侧源图、中间内容词+画风词（可改，自动拼成完整提示词）、右侧验证效果
          </div>
        ) : (
          <div className="flex flex-col gap-5">
            {groups.map((group) => (
              <GroupRow
                key={group.id}
                group={group}
                onContentPromptChange={(v) => setContentPrompt(group.id, v)}
                onStylePromptChange={(v) => setStylePrompt(group.id, v)}
                onRegenerate={() => void regenerate(group.id)}
                onReanalyze={() => void reanalyze(group.id)}
                onRemove={() => removeGroup(group.id)}
                onZoom={setLightboxUrl}
              />
            ))}
          </div>
        )}
      </main>
      <Lightbox url={lightboxUrl} onClose={() => setLightboxUrl(null)} />
    </div>
  );
}

interface GroupRowProps {
  group: PromptGroup;
  onContentPromptChange: (v: string) => void;
  onStylePromptChange: (v: string) => void;
  onRegenerate: () => void;
  onReanalyze: () => void;
  onRemove: () => void;
  onZoom: (url: string) => void;
}

/** 单组：左源图 · 中提示词面板（可改） · 右验证效果，三列横向排布，往下堆叠。 */
function GroupRow({
  group,
  onContentPromptChange,
  onStylePromptChange,
  onRegenerate,
  onReanalyze,
  onRemove,
  onZoom,
}: GroupRowProps) {
  const analyzing = group.status === 'analyzing';
  const generating = group.status === 'generating';
  const isError = group.status === 'error';
  const busy = analyzing || generating;
  const fullPrompt = buildFullPrompt(group.contentPrompt, group.stylePrompt);

  return (
    <div className="pop-card grid grid-cols-1 gap-4 p-4 lg:grid-cols-[220px_1fr_260px]">
      {/* [SOURCE] 左：源图 */}
      <div className="flex flex-col gap-2">
        <div className="pop-label">源图</div>
        <div className="relative overflow-hidden rounded-pop border-2 border-ink bg-soft">
          <img
            src={group.sourceUrl}
            alt="源图"
            className="aspect-square w-full cursor-zoom-in object-cover"
            onClick={() => onZoom(group.sourceUrl)}
          />
          <button
            type="button"
            onClick={onRemove}
            className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full border-2 border-ink bg-paper text-xs font-bold text-ink-2 shadow-sticker-sm transition hover:bg-err hover:text-paper"
            title="移除这组"
            aria-label="移除"
          >
            ✕
          </button>
        </div>
      </div>
      {/* [PROMPTS] 中：提示词面板 */}
      <div className="flex flex-col gap-3">
        <div>
          <div className="pop-label mb-1.5">内容提示词</div>
          <textarea
            value={group.contentPrompt}
            onChange={(e) => onContentPromptChange(e.target.value)}
            placeholder={analyzing ? '分析中…' : '主体 / 场景 / 动作 / 氛围（不含画风），可手动修改'}
            disabled={busy}
            className="pop-textarea h-24 w-full text-sm leading-relaxed"
          />
        </div>
        <div>
          <div className="pop-label mb-1.5">关键画风提示词</div>
          <textarea
            value={group.stylePrompt}
            onChange={(e) => onStylePromptChange(e.target.value)}
            placeholder={analyzing ? '分析中…' : '媒介 / 技法 / 光影 / 色彩 / 质感，可迁移，供画风工具复用'}
            disabled={busy}
            className="pop-textarea h-20 w-full text-sm leading-relaxed"
          />
        </div>
        <div>
          <div className="pop-label mb-1.5 flex items-center gap-1.5">
            完整提示词
            <span className="font-normal text-[11px] text-ink-3">（内容 + 画风，自动拼接，出图用此）</span>
          </div>
          <div className="max-h-28 overflow-auto whitespace-pre-wrap rounded-pop border-2 border-cream-2 bg-soft p-2.5 text-xs leading-relaxed text-ink-2">
            {fullPrompt || (analyzing ? '分析中…' : '内容词与画风词拼接后显示')}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onRegenerate}
            disabled={busy || !fullPrompt}
            className="pop-btn-primary"
          >
            {generating ? '生成中…' : '重新生成'}
          </button>
          <button
            type="button"
            onClick={onReanalyze}
            disabled={busy}
            className="pop-btn-secondary"
          >
            {analyzing ? '分析中…' : '重新分析'}
          </button>
        </div>
        {isError && <p className="pop-callout-err">{group.error}</p>}
      </div>
      {/* [RESULT] 右：验证效果 */}
      <div className="flex flex-col gap-2">
        <div className="pop-label">验证效果</div>
        <div className="relative flex aspect-square items-center justify-center overflow-hidden rounded-pop border-2 border-ink bg-soft">
          {group.status === 'done' && group.resultUrl ? (
            <>
              <img
                src={group.resultUrl}
                alt="验证效果"
                className="h-full w-full cursor-zoom-in object-cover"
                onClick={() => onZoom(group.resultUrl!)}
              />
              <button
                type="button"
                onClick={() => void downloadImage(group.resultUrl!, `verify-${group.id}.png`)}
                className="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-full border-2 border-ink bg-paper text-ink-2 shadow-sticker-sm transition hover:bg-cream-soft"
                title="保存这张"
                aria-label="保存"
              >
                <IconDownload />
              </button>
            </>
          ) : busy ? (
            <div className="flex flex-col items-center gap-1.5">
              <span className="pop-spinner h-6 w-6" />
              <span className="text-[10px] text-ink-3">{analyzing ? '分析中…' : '出图中…'}</span>
            </div>
          ) : isError ? (
            <span className="px-3 text-center text-xs text-err">未生成</span>
          ) : (
            <span className="px-3 text-center text-xs text-ink-3">等待生成</span>
          )}
        </div>
      </div>
    </div>
  );
}
