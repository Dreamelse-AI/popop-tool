import { useEffect } from 'react';
import { useStyleLibraryStore } from '@/features/style-prompt/libraryStore';
import { useStyleTestStore } from '@/features/style-prompt/testStore';
import { useStyleEditorStore } from '@/features/style-prompt/editorStore';
import { CoverUploader } from '@/features/style-prompt/CoverUploader';
import { ToolHeader } from '@/components/ToolHeader';
import { Lightbox } from '@/components/Lightbox';
import { IconDownload } from '@/components/icons';
import { downloadImage } from '@/features/background/downloadImage';
import { useState } from 'react';

const RATIOS = ['9:16', '3:4', '2:3', '1:1', '3:2', '4:3', '16:9'];
const RESOLUTIONS = ['1k', '2k', '4k'];

export function StylePromptPage() {
  const lib = useStyleLibraryStore();
  const test = useStyleTestStore();
  const editor = useStyleEditorStore();
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [hint, setHint] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  // 首次加载画风列表，并确保有一个默认选中（无则建草稿）
  useEffect(() => {
    void lib.load().then(() => editor.ensureSelection());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isDraft = editor.isDraft();
  const isDirty = editor.isDirty();
  const generating = test.status === 'generating';
  const doneItems = test.items.filter((i) => i.status === 'done' && i.url);

  const onAddDraft = () => {
    setHint(null);
    editor.addDraft();
  };

  // 草稿态：新增到画风库
  const onCreate = async () => {
    setHint(null);
    if (!editor.fields.styleName.trim()) {
      setHint({ kind: 'err', text: '请先填画风名称' });
      return;
    }
    const ok = await lib.create({
      styleName: editor.fields.styleName.trim(),
      styleIcon: editor.fields.styleIcon,
      stylePrompt: editor.fields.stylePrompt,
      priority: editor.fields.priority,
    });
    if (ok) {
      const draftKey = editor.selected as string;
      // 新建项已入库：从列表里找到它并选中（变为已存态），移除草稿
      const created = useStyleLibraryStore
        .getState()
        .items.find((it) => it.styleName === editor.fields.styleName.trim());
      editor.removeDraft(draftKey);
      if (created) editor.selectStyle(created);
      setHint({ kind: 'ok', text: '已新增到画风库' });
    } else {
      setHint({ kind: 'err', text: lib.errorMessage ?? '新增失败' });
    }
  };

  // 已存态：保存改动
  const onSave = async () => {
    setHint(null);
    if (typeof editor.selected !== 'number') return;
    if (!editor.fields.styleName.trim()) {
      setHint({ kind: 'err', text: '画风名称不能为空' });
      return;
    }
    const ok = await lib.update({
      id: editor.selected,
      styleName: editor.fields.styleName.trim(),
      styleIcon: editor.fields.styleIcon,
      stylePrompt: editor.fields.stylePrompt,
      priority: editor.fields.priority,
    });
    if (ok) {
      editor.commitBaseline();
      setHint({ kind: 'ok', text: '已保存' });
    } else {
      setHint({ kind: 'err', text: lib.errorMessage ?? '保存失败' });
    }
  };

  // 已存态：删除
  const onDelete = async () => {
    if (typeof editor.selected !== 'number') return;
    if (!window.confirm(`确定删除画风「${editor.fields.styleName}」？此操作不可撤销。`)) return;
    const ok = await lib.remove(editor.selected);
    if (ok) {
      setHint(null);
      // 删除后回到第一条已存画风，否则建草稿
      const rest = useStyleLibraryStore.getState().items;
      if (rest.length > 0) editor.selectStyle(rest[0]);
      else editor.addDraft();
    } else {
      setHint({ kind: 'err', text: lib.errorMessage ?? '删除失败' });
    }
  };

  return (
    <div className="min-h-full">
      <ToolHeader
        title="画风生图工具"
        subtitle="左侧选画风 / 新建，中间编辑参数并测试出图，右侧看结果"
      />
      <main className="mx-auto grid max-w-[1400px] grid-cols-1 gap-6 p-6 sm:p-8 lg:grid-cols-[200px_minmax(0,1fr)_minmax(0,1fr)]">
        {/* 左列：画风库竖排 */}
        <StyleRail onAddDraft={onAddDraft} onLightbox={setLightboxUrl} />

        {/* 中列：参数面板 */}
        <section className="flex min-w-0 flex-col">
          <div className="pop-card flex flex-col gap-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-display text-sm font-extrabold text-ink">
                {isDraft ? '新建画风' : '画风参数'}
              </h2>
              <div className="flex items-center gap-3">
                {isDraft ? (
                  <button
                    type="button"
                    onClick={() => void onCreate()}
                    disabled={lib.submitting}
                    className="pop-btn-primary px-3 py-1.5 text-xs"
                  >
                    {lib.submitting ? '新增中…' : '+ 新增到画风库'}
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => void onDelete()}
                      disabled={lib.submitting}
                      className="text-xs font-semibold text-ink-3 transition hover:text-err"
                    >
                      删除
                    </button>
                    <button
                      type="button"
                      onClick={() => void onSave()}
                      disabled={!isDirty || lib.submitting}
                      className={
                        isDirty
                          ? 'pop-btn-primary px-3 py-1.5 text-xs'
                          : 'pop-btn-secondary px-3 py-1.5 text-xs opacity-50'
                      }
                    >
                      {lib.submitting ? '保存中…' : '保存'}
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* 封面（顶部大图） */}
            <CoverUploader
              value={editor.fields.styleIcon}
              onChange={(url) => editor.setField('styleIcon', url)}
            />

            <div>
              <div className="pop-label mb-1.5">画风名称 *</div>
              <input
                value={editor.fields.styleName}
                onChange={(e) => editor.setField('styleName', e.target.value)}
                className="pop-input w-full py-1.5"
                placeholder="如：吉卜力水彩"
              />
            </div>

            <div>
              <div className="pop-label mb-1.5">优先级</div>
              <input
                type="number"
                value={editor.fields.priority}
                onChange={(e) => editor.setField('priority', Math.floor(Number(e.target.value)) || 0)}
                className="pop-input w-28 py-1.5"
              />
              <span className="ml-2 text-xs text-ink-3">越大越靠前</span>
            </div>

            <div>
              <div className="pop-label mb-1.5">画风 Prompt</div>
              <textarea
                value={editor.fields.stylePrompt}
                onChange={(e) => editor.setField('stylePrompt', e.target.value)}
                rows={4}
                className="pop-input w-full resize-y py-2 font-mono text-xs leading-relaxed"
                placeholder="描述该画风的英文 prompt 片段"
              />
            </div>

            <div className="border-t border-cream-line pt-4">
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
                onClick={() => void test.generate(editor.fields.stylePrompt)}
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
            {hint && (
              <p className={hint.kind === 'ok' ? 'text-xs font-semibold text-ok' : 'pop-callout-err'}>
                {hint.text}
              </p>
            )}
          </div>
        </section>

        {/* 右列：生成结果 */}
        <section className="flex min-w-0 flex-col lg:sticky lg:top-6 lg:self-start">
          <div className="flex h-[calc(100vh-3rem)] flex-col overflow-auto rounded-pop-lg border-2 border-dashed border-cream-2 bg-paper/40 p-4">
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
                <div className="grid grid-cols-2 gap-3">
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
          </div>
        </section>
      </main>

      <Lightbox url={lightboxUrl} onClose={() => setLightboxUrl(null)} />
    </div>
  );
}

interface StyleRailProps {
  onAddDraft: () => void;
  onLightbox: (url: string) => void;
}

/** 左列：画风库竖排，每项显示封面 + 名字；顶部「+」新建。 */
function StyleRail({ onAddDraft }: StyleRailProps) {
  const lib = useStyleLibraryStore();
  const editor = useStyleEditorStore();
  const selected = editor.selected;

  return (
    <aside className="flex min-w-0 flex-col gap-3">
      <button
        type="button"
        onClick={onAddDraft}
        className="flex h-12 items-center justify-center gap-1.5 rounded-pop-lg border-2 border-dashed border-ink text-sm font-bold text-ink transition hover:bg-cream-soft"
      >
        <span className="text-lg leading-none">＋</span> 新建画风
      </button>

      {lib.status === 'loading' && (
        <div className="flex items-center justify-center py-8 text-xs text-ink-3">
          <span className="pop-spinner mr-2 h-4 w-4" />
          加载中…
        </div>
      )}
      {lib.status === 'error' && (
        <div className="rounded-pop border-2 border-err/40 p-2 text-xs text-err">
          {lib.errorMessage}
          <button type="button" onClick={() => void lib.load()} className="ml-1 underline">
            重试
          </button>
        </div>
      )}

      <div className="flex flex-col gap-2">
        {/* 草稿们（未入库） */}
        {editor.drafts.map((d) => {
          const active = selected === d.key;
          return (
            <button
              key={d.key}
              type="button"
              onClick={() => editor.selectDraft(d.key)}
              className={`flex items-center gap-2.5 rounded-pop-lg border-2 p-2 text-left transition ${
                active ? 'border-ink bg-cream-soft shadow-sticker-sm' : 'border-cream-2 hover:bg-cream-soft'
              }`}
            >
              <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-pop border-2 border-dashed border-cream-2 bg-soft">
                {d.fields.styleIcon ? (
                  <img src={d.fields.styleIcon} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span className="text-base text-ink-3">＋</span>
                )}
              </div>
              <span className="truncate text-sm font-semibold text-ink-2">
                {d.fields.styleName.trim() || '未命名草稿'}
              </span>
            </button>
          );
        })}

        {/* 已存画风 */}
        {lib.items.map((item) => {
          const active = selected === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => editor.selectStyle(item)}
              className={`flex items-center gap-2.5 rounded-pop-lg border-2 p-2 text-left transition ${
                active ? 'border-ink bg-cream-soft shadow-sticker-sm' : 'border-ink/15 hover:bg-cream-soft'
              }`}
            >
              <div className="h-12 w-12 shrink-0 overflow-hidden rounded-pop border-2 border-ink bg-soft">
                {item.styleIcon ? (
                  <img src={item.styleIcon} alt={item.styleName} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-[10px] text-ink-3">
                    无封面
                  </div>
                )}
              </div>
              <div className="flex min-w-0 flex-col">
                <span className="truncate text-sm font-bold text-ink">{item.styleName}</span>
                {item.status === 2 && <span className="pop-tag mt-0.5 w-fit">失效</span>}
              </div>
            </button>
          );
        })}
      </div>
    </aside>
  );
}
