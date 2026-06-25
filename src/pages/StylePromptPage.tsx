import { useEffect, useState } from 'react';
import type { StylePrompt } from '@/types/stylePrompt';
import { useStyleLibraryStore } from '@/features/style-prompt/libraryStore';
import { useStyleTestStore } from '@/features/style-prompt/testStore';
import { StyleEditor } from '@/features/style-prompt/StyleEditor';
import { CoverUploader } from '@/features/style-prompt/CoverUploader';
import { ToolHeader } from '@/components/ToolHeader';
import { Lightbox } from '@/components/Lightbox';
import { ResultPanel } from '@/components/ResultPanel';
import { IconDownload } from '@/components/icons';
import { downloadImage } from '@/features/background/downloadImage';

const RATIOS = ['9:16', '3:4', '2:3', '1:1', '3:2', '4:3', '16:9'];
const RESOLUTIONS = ['1k', '2k', '4k'];

export function StylePromptPage() {
  const lib = useStyleLibraryStore();
  const test = useStyleTestStore();

  const [editorTarget, setEditorTarget] = useState<StylePrompt | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<StylePrompt | null>(null);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  /** 测试区「新增到画风库」的提示（成功/失败）。 */
  const [addHint, setAddHint] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  useEffect(() => {
    void lib.load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openEdit = (item: StylePrompt) => {
    setEditorTarget(item);
    setEditorOpen(true);
  };

  const useForTest = (item: StylePrompt) => {
    test.loadFromStyle({
      styleName: item.styleName,
      styleIcon: item.styleIcon,
      stylePrompt: item.stylePrompt,
      priority: item.priority,
    });
  };

  /** 测试区直接把当前画风字段新增到画风库（无需弹窗重填）。 */
  const addCurrentToLibrary = async () => {
    setAddHint(null);
    if (!test.styleName.trim()) {
      setAddHint({ kind: 'err', text: '请先填画风名称' });
      return;
    }
    const ok = await lib.create({
      styleName: test.styleName.trim(),
      styleIcon: test.styleIcon,
      stylePrompt: test.stylePromptText,
      priority: test.priority,
    });
    setAddHint(
      ok
        ? { kind: 'ok', text: `已新增「${test.styleName.trim()}」到画风库` }
        : { kind: 'err', text: lib.errorMessage ?? '新增失败' },
    );
  };

  const generating = test.status === 'generating';
  const doneItems = test.items.filter((i) => i.status === 'done' && i.url);

  return (
    <div className="min-h-full">
      <ToolHeader
        title="画风生图工具"
        subtitle="管理画风库（增改删），用画风 + 人物等提示词测试出图，满意的直接新增到画风库"
      />
      <main className="mx-auto grid max-w-6xl grid-cols-1 gap-8 p-6 sm:p-8 lg:grid-cols-2">
        {/* 左：画风库 */}
        <section className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-sm font-extrabold text-ink">
              画风库{lib.items.length > 0 && `（${lib.items.length}）`}
            </h2>
            <button type="button" onClick={() => void lib.load()} className="pop-link">
              刷新
            </button>
          </div>

          {lib.status === 'loading' && (
            <div className="flex items-center justify-center py-12 text-sm text-ink-3">
              <span className="pop-spinner mr-2 h-5 w-5" />
              加载中…
            </div>
          )}
          {lib.status === 'error' && (
            <div className="pop-callout-err">
              {lib.errorMessage}
              <button type="button" onClick={() => void lib.load()} className="ml-2 underline">
                重试
              </button>
            </div>
          )}
          {lib.status === 'done' && lib.items.length === 0 && (
            <div className="rounded-pop-lg border-2 border-dashed border-cream-2 py-12 text-center text-sm text-ink-3">
              还没有画风，点右上角「新增画风」
            </div>
          )}

          <div className="flex flex-col gap-3">
            {lib.items.map((item) => (
              <div
                key={item.id}
                className="flex gap-3 rounded-pop-lg border-2 border-ink bg-paper p-3 shadow-sticker-sm"
              >
                <div className="h-16 w-16 shrink-0 overflow-hidden rounded-pop border-2 border-ink bg-soft">
                  {item.styleIcon ? (
                    <img
                      src={item.styleIcon}
                      alt={item.styleName}
                      className="h-full w-full cursor-zoom-in object-cover"
                      onClick={() => setLightboxUrl(item.styleIcon)}
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-[10px] text-ink-3">
                      无封面
                    </div>
                  )}
                </div>
                <div className="flex min-w-0 flex-1 flex-col">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-display text-sm font-extrabold text-ink">
                      {item.styleName}
                    </span>
                    {item.status === 2 && <span className="pop-tag">失效</span>}
                    <span className="ml-auto shrink-0 text-[11px] text-ink-3">P{item.priority}</span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-ink-2">
                    {item.stylePrompt || '（无 prompt）'}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-3">
                    <button type="button" onClick={() => useForTest(item)} className="pop-link">
                      用于测试
                    </button>
                    <button type="button" onClick={() => openEdit(item)} className="pop-link">
                      编辑
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(item)}
                      className="text-xs font-semibold text-err hover:underline"
                    >
                      删除
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* 右：生图测试 + 画风草稿 [TEST_AREA] */}
        <section className="flex flex-col gap-5">
          <div className="pop-card flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-sm font-extrabold text-ink">生图测试</h2>
              <button
                type="button"
                onClick={() => void addCurrentToLibrary()}
                disabled={lib.submitting}
                className="pop-btn-primary px-3 py-1.5 text-xs"
                title="把当前画风字段直接新增到画风库"
              >
                {lib.submitting ? '新增中…' : '+ 新增到画风库'}
              </button>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-[auto_1fr] sm:items-start">
              <CoverUploader value={test.styleIcon} onChange={test.setStyleIcon} />
              <div className="flex flex-col gap-3">
                <div>
                  <div className="pop-label mb-1.5">画风名称 *</div>
                  <input
                    value={test.styleName}
                    onChange={(e) => test.setStyleName(e.target.value)}
                    className="pop-input w-full py-1.5"
                    placeholder="如：吉卜力水彩"
                  />
                </div>
                <div>
                  <div className="pop-label mb-1.5">优先级</div>
                  <input
                    type="number"
                    value={test.priority}
                    onChange={(e) => test.setPriority(Number(e.target.value))}
                    className="pop-input w-28 py-1.5"
                  />
                  <span className="ml-2 text-xs text-ink-3">越大越靠前</span>
                </div>
              </div>
            </div>

            <div>
              <div className="pop-label mb-1.5">画风 Prompt</div>
              <textarea
                value={test.stylePromptText}
                onChange={(e) => test.setStylePromptText(e.target.value)}
                rows={3}
                className="pop-input w-full resize-y py-2 font-mono text-xs leading-relaxed"
                placeholder="描述该画风的英文 prompt 片段；从左侧画风「用于测试」可带入"
              />
            </div>
            <div>
              <div className="pop-label mb-1.5">
                人物 / 其他提示词
                <span className="ml-2 font-mono text-[11px] font-normal text-ink-3">
                  仅用于测试出图，不会存入画风
                </span>
              </div>
              <textarea
                value={test.extraPrompt}
                onChange={(e) => test.setExtraPrompt(e.target.value)}
                rows={2}
                className="pop-input w-full resize-y py-2 text-xs leading-relaxed"
                placeholder="如：a cute girl with long hair, holding a cat"
              />
            </div>
            <div className="flex flex-wrap items-end gap-5">
              <div>
                <div className="pop-label mb-1.5">数量</div>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={test.count}
                  onChange={(e) => test.setCount(Number(e.target.value))}
                  className="pop-input w-20 py-1.5"
                />
              </div>
              <div>
                <div className="pop-label mb-1.5">比例</div>
                <div className="flex flex-wrap gap-1.5">
                  {RATIOS.map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => test.setRatio(r)}
                      className={r === test.ratio ? 'pop-toggle-on' : 'pop-toggle'}
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
                      onClick={() => test.setResolution(res)}
                      className={res === test.resolution ? 'pop-toggle-on' : 'pop-toggle'}
                    >
                      {res.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => void test.generate()}
                disabled={generating}
                className="pop-btn-primary flex-1"
              >
                {generating ? '生成中…' : `生成 ${test.count} 张`}
              </button>
              {generating && (
                <button type="button" onClick={test.cancel} className="pop-btn-secondary">
                  取消
                </button>
              )}
            </div>
            {test.status === 'error' && <p className="pop-callout-err">{test.errorMessage}</p>}
            {addHint && (
              <p className={addHint.kind === 'ok' ? 'text-xs font-semibold text-ok' : 'pop-callout-err'}>
                {addHint.text}
              </p>
            )}
          </div>

          <ResultPanel>
            {test.items.length === 0 ? (
              <div className="flex h-full items-center justify-center text-center text-sm text-ink-3">
                填好画风 + 提示词后点「生成」，结果会在这里逐张出现
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {doneItems.length > 0 && (
                  <div className="flex items-center justify-end">
                    <button
                      type="button"
                      onClick={() =>
                        doneItems.forEach((it, i) =>
                          setTimeout(() => downloadImage(it.url!, `style-test-${it.id}.png`), i * 300),
                        )
                      }
                      className="pop-link"
                    >
                      批量下载（{doneItems.length}）
                    </button>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {test.items.map((item) => (
                    <div
                      key={item.id}
                      className="flex flex-col overflow-hidden rounded-pop border-2 border-ink bg-paper shadow-sticker-sm"
                    >
                      <div className="flex aspect-square items-center justify-center bg-soft">
                        {item.status === 'done' && item.url ? (
                          <img
                            src={item.url}
                            alt=""
                            className="h-full w-full cursor-zoom-in object-cover"
                            onClick={() => setLightboxUrl(item.url!)}
                          />
                        ) : item.status === 'error' ? (
                          <div className="flex flex-col items-center gap-2 px-2 text-center">
                            <span className="text-xs text-err">{item.error}</span>
                            <button
                              type="button"
                              onClick={() => void test.retryItem(item.id)}
                              className="pop-toggle"
                            >
                              重试
                            </button>
                          </div>
                        ) : (
                          <span className="pop-spinner h-6 w-6" />
                        )}
                      </div>
                      {item.status === 'done' && item.url && (
                        <div className="flex items-center justify-end gap-1 border-t-2 border-ink px-2 py-1.5">
                          <button
                            type="button"
                            onClick={() => downloadImage(item.url!, `style-test-${item.id}.png`)}
                            className="shrink-0 text-ink-3 transition hover:text-ink"
                            title="下载"
                            aria-label="下载"
                          >
                            <IconDownload />
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </ResultPanel>
        </section>
      </main>

      {editorOpen && (
        <StyleEditor target={editorTarget} onClose={() => setEditorOpen(false)} />
      )}

      {confirmDelete && (
        <ConfirmDeleteDialog
          item={confirmDelete}
          onCancel={() => setConfirmDelete(null)}
          onConfirm={async () => {
            const ok = await lib.remove(confirmDelete.id);
            if (ok) setConfirmDelete(null);
          }}
        />
      )}

      <Lightbox url={lightboxUrl} onClose={() => setLightboxUrl(null)} />
    </div>
  );
}

interface ConfirmDeleteDialogProps {
  item: StylePrompt;
  onCancel: () => void;
  onConfirm: () => Promise<void>;
}

function ConfirmDeleteDialog({ item, onCancel, onConfirm }: ConfirmDeleteDialogProps) {
  const submitting = useStyleLibraryStore((s) => s.submitting);
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/45 p-4"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-sm rounded-pop-xl border-2 border-ink bg-paper p-5 shadow-sticker-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="font-display text-base font-extrabold text-ink">删除画风</h2>
        <p className="mt-2 text-sm leading-relaxed text-ink-2">
          确定删除画风「{item.styleName}」？此操作不可撤销。
        </p>
        <div className="mt-4 flex justify-end gap-3">
          <button type="button" onClick={onCancel} className="pop-btn-secondary">
            取消
          </button>
          <button
            type="button"
            onClick={() => void onConfirm()}
            disabled={submitting}
            className="pop-btn-primary bg-err"
          >
            {submitting ? '删除中…' : '确认删除'}
          </button>
        </div>
      </div>
    </div>
  );
}
