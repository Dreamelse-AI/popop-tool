import type { BackgroundPreset, BackgroundSelection } from '@/types/background';

interface PresetPickerProps {
  presets: BackgroundPreset[];
  /** 当前选择，用于高亮匹配的预设 */
  current: BackgroundSelection;
  onApply: (selection: BackgroundSelection) => void;
}

/** 判断当前选择是否与某预设完全一致。 */
function isSameSelection(a: BackgroundSelection, b: BackgroundSelection): boolean {
  return (
    a.motion === b.motion &&
    a.medium === b.medium &&
    a.light === b.light &&
    a.color === b.color &&
    a.mood === b.mood
  );
}

/** 推荐组合：一键套用一套完整的五层选择。 */
export function PresetPicker({ presets, current, onApply }: PresetPickerProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {presets.map((preset) => {
        const active = isSameSelection(current, preset.selection);
        return (
          <button
            key={preset.id}
            type="button"
            onClick={() => onApply(preset.selection)}
            title={preset.description}
            className={
              active
                ? 'rounded-full border border-neutral-900 bg-neutral-900 px-4 py-1.5 text-xs font-medium text-white'
                : 'rounded-full border border-neutral-200 bg-white px-4 py-1.5 text-xs font-medium text-neutral-600 transition hover:border-neutral-400'
            }
          >
            {preset.name}
          </button>
        );
      })}
    </div>
  );
}
