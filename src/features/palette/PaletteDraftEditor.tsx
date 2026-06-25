import type { PaletteDraft } from '@/types/palette';

interface PaletteDraftEditorProps {
  draft: PaletteDraft;
  saving: boolean;
  errorMessage: string | null;
  /** 是否在多张并存时显示序号角标 */
  index?: number;
  onChange: (patch: Partial<PaletteDraft>) => void;
  onSave: () => void;
  onDiscard: () => void;
}

/** 是否是合法 #hex 颜色（3/6 位）。 */
function isHex(v: string): boolean {
  return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(v.trim());
}

/** 名字最多 4 个字（按「字」截，兼容中英）。 */
function clampName(v: string): string {
  return Array.from(v).slice(0, 4).join('');
}

/**
 * 待确认草稿编辑器：展示原图 + 提取的主色，字段可改，确认后保存为永久记录。
 * 字段：id / name（≤4 字）/ mood / bgColor / fontColor（外加 colors）。
 */
export function PaletteDraftEditor({
  draft,
  saving,
  errorMessage,
  index,
  onChange,
  onSave,
  onDiscard,
}: PaletteDraftEditorProps) {
  const idValid = /^[a-z0-9][a-z0-9-]*$/.test(draft.id);
  const canSave = !saving && idValid && draft.id.length > 0;

  return (
    <div className="pop-card">
      <div className="mb-3 flex items-center justify-between">
        <span className="pop-label">
          确认配色信息
          {typeof index === 'number' && (
            <span className="ml-2 font-mono text-[11px] font-normal text-ink-3">#{index + 1}</span>
          )}
        </span>
        <button type="button" onClick={onDiscard} className="pop-link" disabled={saving}>
          丢弃
        </button>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row">
        <div className="shrink-0">
          <div className="h-36 w-36 overflow-hidden rounded-pop border-2 border-ink bg-soft">
            <img src={draft.imageDataUrl} alt="原图" className="h-full w-full object-cover" />
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {draft.colors.map((c) => (
              <span
                key={c}
                title={c}
                className="h-6 w-6 rounded-md border-2 border-ink"
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </div>

        <div className="flex-1">
          <div
            className="mb-3 flex h-20 items-center justify-center rounded-pop border-2 border-ink text-center"
            style={{ background: draft.bgColor, color: draft.fontColor }}
          >
            <span className="font-display text-lg font-extrabold">
              {draft.name || '配色预览'}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="id（英文-连字符）" full>
              <input
                value={draft.id}
                onChange={(e) => onChange({ id: e.target.value })}
                className="pop-input font-mono text-xs"
                placeholder="warm-dusk-glow"
              />
              {!idValid && (
                <span className="mt-1 block text-[11px] text-err">仅小写英文、数字、连字符</span>
              )}
            </Field>

            <Field label="name（名字 ≤4 字）" full>
              <input
                value={draft.name}
                onChange={(e) => onChange({ name: clampName(e.target.value) })}
                maxLength={8}
                className="pop-input text-sm"
                placeholder="暮色微醺"
              />
            </Field>

            <Field label="mood（情绪词）" full>
              <input
                value={draft.mood}
                onChange={(e) => onChange({ mood: e.target.value })}
                className="pop-input text-sm"
                placeholder="温暖、慵懒、治愈"
              />
            </Field>

            <Field label="bgColor（#色值/渐变）">
              <div className="flex items-center gap-2">
                <ColorSwatch value={draft.bgColor} />
                <input
                  value={draft.bgColor}
                  onChange={(e) => onChange({ bgColor: e.target.value })}
                  className="pop-input font-mono text-xs"
                  placeholder="#EAD9A2"
                />
              </div>
            </Field>

            <Field label="fontColor（#色值）">
              <div className="flex items-center gap-2">
                <ColorSwatch value={draft.fontColor} />
                <input
                  value={draft.fontColor}
                  onChange={(e) => onChange({ fontColor: e.target.value })}
                  className="pop-input font-mono text-xs"
                  placeholder="#0B0B0B"
                />
              </div>
            </Field>
          </div>
        </div>
      </div>

      {errorMessage && <div className="pop-callout-err mt-3">{errorMessage}</div>}

      <div className="mt-4 flex justify-end">
        <button
          type="button"
          onClick={onSave}
          disabled={!canSave}
          className="pop-btn-primary px-5 py-2 text-sm"
        >
          {saving ? '保存中…' : '永久保存到配色库'}
        </button>
      </div>
    </div>
  );
}

/** 小色块：合法 hex 才显示底色，否则灰底。 */
function ColorSwatch({ value }: { value: string }) {
  const bg = isHex(value) ? value : undefined;
  return (
    <span
      className="h-8 w-8 shrink-0 rounded-md border-2 border-ink bg-soft"
      style={bg ? { backgroundColor: bg } : undefined}
    />
  );
}

function Field({
  label,
  full,
  children,
}: {
  label: string;
  full?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className={full ? 'col-span-2 block' : 'block'}>
      <span className="mb-1 block font-mono text-[11px] font-semibold text-ink-2">{label}</span>
      {children}
    </label>
  );
}
