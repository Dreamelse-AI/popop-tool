import { useRef, useState } from 'react';
import type { PaletteDraft, PaletteScheme } from '@/types/palette';
import {
  supportsEyeDropper,
  pickColorWithEyeDropper,
  pickColorFromImage,
} from '@/services/eyedropper';

interface PaletteDraftEditorProps {
  draft: PaletteDraft;
  saving: boolean;
  errorMessage: string | null;
  index?: number;
  onChangeMeta: (patch: Partial<Pick<PaletteDraft, 'id'>>) => void;
  onChangeScheme: (schemeIndex: number, patch: Partial<PaletteScheme>) => void;
  onSwapScheme: (schemeIndex: number) => void;
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
/** 当前激活的取色目标：第几套方案的底色/字色。 */
interface ActiveTarget {
  schemeIndex: number;
  field: 'bgColor' | 'fontColor';
}

/**
 * 待确认草稿编辑器：展示原图 + 主色板 + 两套配色方案。
 * - 两套方案平等（互换底/字，情绪词可不同），各自预览/编辑/互换。
 * - 点主色板色块 → 填入当前激活的颜色输入框。
 * - 每个颜色输入旁有吸管：原生 EyeDropper 全屏吸色，降级为点原图取色。
 */
export function PaletteDraftEditor({
  draft,
  saving,
  errorMessage,
  index,
  onChangeMeta,
  onChangeScheme,
  onSwapScheme,
  onSave,
  onDiscard,
}: PaletteDraftEditorProps) {
  const idValid = /^[a-z0-9][a-z0-9-]*$/.test(draft.id);
  const canSave = !saving && idValid && draft.id.length > 0;

  // 激活的取色目标（点主色板/点原图时填入这里），默认方案A底色
  const [active, setActive] = useState<ActiveTarget>({ schemeIndex: 0, field: 'bgColor' });
  // 是否进入「点原图取色」模式（仅在原生吸管不支持时用）
  const [pickFromImage, setPickFromImage] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  const applyToActive = (hex: string) => {
    onChangeScheme(active.schemeIndex, { [active.field]: hex } as Partial<PaletteScheme>);
  };

  const handleEyeDropper = async (target: ActiveTarget) => {
    setActive(target);
    if (supportsEyeDropper()) {
      const hex = await pickColorWithEyeDropper();
      if (hex) onChangeScheme(target.schemeIndex, { [target.field]: hex } as Partial<PaletteScheme>);
    } else {
      // 降级：进入点原图取色模式
      setPickFromImage(true);
    }
  };

  const handleImageClick = (e: React.MouseEvent<HTMLImageElement>) => {
    if (!pickFromImage || !imgRef.current) return;
    const hex = pickColorFromImage(imgRef.current, e.clientX, e.clientY);
    if (hex) applyToActive(hex);
    setPickFromImage(false);
  };

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

      <div className="flex flex-col gap-4 lg:flex-row">
        {/* 左：原图 + 主色板 */}
        <div className="shrink-0">
          <div
            className={
              pickFromImage
                ? 'h-40 w-40 overflow-hidden rounded-pop border-2 border-info bg-soft ring-2 ring-info'
                : 'h-40 w-40 overflow-hidden rounded-pop border-2 border-ink bg-soft'
            }
          >
            <img
              ref={imgRef}
              src={draft.imageDataUrl}
              alt="原图"
              onClick={handleImageClick}
              className={pickFromImage ? 'h-full w-full cursor-crosshair object-cover' : 'h-full w-full object-cover'}
            />
          </div>
          {pickFromImage && (
            <p className="mt-1 font-mono text-[11px] text-info">点原图任意位置取色…</p>
          )}
          <div className="mt-2">
            <span className="mb-1 block font-mono text-[11px] font-semibold text-ink-2">
              主色板（点击填入选中输入框）
            </span>
            <div className="flex flex-wrap gap-1.5">
              {draft.colors.map((c) => (
                <button
                  key={c}
                  type="button"
                  title={`${c}（点击填入）`}
                  onClick={() => applyToActive(c)}
                  className="h-7 w-7 rounded-md border-2 border-ink transition hover:scale-110"
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          <div className="mt-3 grid grid-cols-1 gap-2">
            <label className="block">
              <span className="mb-1 block font-mono text-[11px] font-semibold text-ink-2">
                id（英文-连字符）
              </span>
              <input
                value={draft.id}
                onChange={(e) => onChangeMeta({ id: e.target.value })}
                className="pop-input w-full font-mono text-xs"
                placeholder="warm-dusk-glow"
              />
              {!idValid && (
                <span className="mt-1 block text-[11px] text-err">仅小写英文、数字、连字符</span>
              )}
            </label>
          </div>
        </div>

        {/* 右：两套方案 */}
        <div className="grid flex-1 grid-cols-1 gap-3 sm:grid-cols-2">
          {draft.schemes.map((scheme, i) => (
            <SchemeCard
              key={i}
              schemeIndex={i}
              scheme={scheme}
              active={active}
              onSelectField={(field) => setActive({ schemeIndex: i, field })}
              onChange={(patch) => onChangeScheme(i, patch)}
              onSwap={() => onSwapScheme(i)}
              onEyeDropper={(field) => void handleEyeDropper({ schemeIndex: i, field })}
            />
          ))}
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

interface SchemeCardProps {
  schemeIndex: number;
  scheme: PaletteScheme;
  active: ActiveTarget;
  onSelectField: (field: 'bgColor' | 'fontColor') => void;
  onChange: (patch: Partial<PaletteScheme>) => void;
  onSwap: () => void;
  onEyeDropper: (field: 'bgColor' | 'fontColor') => void;
}

/** 单套方案卡片：名字 + 预览 + 底色/字色（可选中、吸管）+ 情绪词 + 互换。 */
function SchemeCard({
  schemeIndex,
  scheme,
  active,
  onSelectField,
  onChange,
  onSwap,
  onEyeDropper,
}: SchemeCardProps) {
  const label = schemeIndex === 0 ? '方案 A' : '方案 B';
  return (
    <div className="rounded-pop border-2 border-ink p-2.5">
      <div className="mb-2 flex items-center justify-between">
        <span className="font-display text-xs font-extrabold text-ink">{label}</span>
        <button type="button" onClick={onSwap} className="pop-link text-[11px]" title="互换底色/字色">
          ⇄ 互换
        </button>
      </div>

      <div
        className="mb-2 flex h-16 items-center justify-center rounded-pop border-2 border-ink text-center"
        style={{ background: scheme.bgColor, color: scheme.fontColor }}
      >
        <span className="font-display text-base font-extrabold">{scheme.name || '配色预览'}</span>
      </div>

      <label className="mb-1.5 block">
        <span className="mb-1 block font-mono text-[11px] font-semibold text-ink-2">name（名字 ≤4 字）</span>
        <input
          value={scheme.name}
          onChange={(e) => onChange({ name: clampName(e.target.value) })}
          maxLength={8}
          className="pop-input w-full text-sm"
          placeholder="暮色微醺"
        />
      </label>

      <ColorRow
        label="bgColor"
        value={scheme.bgColor}
        activeNow={active.schemeIndex === schemeIndex && active.field === 'bgColor'}
        onSelect={() => onSelectField('bgColor')}
        onChange={(v) => onChange({ bgColor: v })}
        onEyeDropper={() => onEyeDropper('bgColor')}
      />
      <ColorRow
        label="fontColor"
        value={scheme.fontColor}
        activeNow={active.schemeIndex === schemeIndex && active.field === 'fontColor'}
        onSelect={() => onSelectField('fontColor')}
        onChange={(v) => onChange({ fontColor: v })}
        onEyeDropper={() => onEyeDropper('fontColor')}
      />

      <label className="mt-1.5 block">
        <span className="mb-1 block font-mono text-[11px] font-semibold text-ink-2">mood（情绪词）</span>
        <input
          value={scheme.mood}
          onChange={(e) => onChange({ mood: e.target.value })}
          className="pop-input w-full text-sm"
          placeholder="温暖、慵懒"
        />
      </label>
    </div>
  );
}

interface ColorRowProps {
  label: string;
  value: string;
  activeNow: boolean;
  onSelect: () => void;
  onChange: (v: string) => void;
  onEyeDropper: () => void;
}

/** 颜色行：色块 + hex 输入（点输入激活为取色目标）+ 吸管按钮。 */
function ColorRow({ label, value, activeNow, onSelect, onChange, onEyeDropper }: ColorRowProps) {
  const bg = isHex(value) ? value : undefined;
  return (
    <label className="mt-1.5 block">
      <span className="mb-1 block font-mono text-[11px] font-semibold text-ink-2">{label}</span>
      <div className="flex items-center gap-1.5">
        <span
          className="h-8 w-8 shrink-0 rounded-md border-2 border-ink bg-soft"
          style={bg ? { backgroundColor: bg } : undefined}
        />
        <input
          value={value}
          onFocus={onSelect}
          onChange={(e) => onChange(e.target.value)}
          className={
            activeNow
              ? 'pop-input w-full font-mono text-xs ring-2 ring-cream-2'
              : 'pop-input w-full font-mono text-xs'
          }
          placeholder="#EAD9A2"
        />
        <button
          type="button"
          onClick={onEyeDropper}
          title="吸管取色"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border-2 border-ink bg-paper text-ink transition hover:bg-cream-soft active:translate-y-[1px]"
          aria-label="吸管取色"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M2 22l1-4 9-9" />
            <path d="m12.5 6.5 5 5" />
            <path d="M15 4l5 5-2.5 2.5-5-5L15 4z" />
          </svg>
        </button>
      </div>
    </label>
  );
}
