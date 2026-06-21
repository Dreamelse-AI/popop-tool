import type { EffectMode } from '@/types/layout';
import { EFFECT_PRESETS } from '@/data/effectPresets';

interface ModePickerProps {
  selected: EffectMode;
  onSelect: (mode: EffectMode) => void;
}

export function ModePicker({ selected, onSelect }: ModePickerProps) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {EFFECT_PRESETS.map((preset) => {
        const active = preset.mode === selected;
        return (
          <button
            key={preset.mode}
            type="button"
            onClick={() => onSelect(preset.mode)}
            className={`rounded-lg border-2 p-3 text-left transition ${
              active
                ? 'border-neutral-900 bg-neutral-50'
                : 'border-neutral-200 hover:border-neutral-400'
            }`}
          >
            <div className="mb-2 h-10 w-full rounded" style={{ background: preset.swatch }} aria-hidden />
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-semibold text-neutral-900">{preset.name}</span>
              {preset.needsImage && (
                <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] text-amber-700">
                  需图片
                </span>
              )}
            </div>
            <div className="mt-1 text-xs leading-snug text-neutral-500">{preset.description}</div>
          </button>
        );
      })}
    </div>
  );
}
