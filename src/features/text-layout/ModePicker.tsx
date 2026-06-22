import type { EffectMode } from '@/types/layout';
import { EFFECT_CATALOG } from '@/data/effectCatalog';

interface ModePickerProps {
  selected: EffectMode;
  onSelect: (mode: EffectMode) => void;
}

export function ModePicker({ selected, onSelect }: ModePickerProps) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {EFFECT_CATALOG.map((entry) => {
        const active = entry.id === selected;
        return (
          <button
            key={entry.id}
            type="button"
            onClick={() => onSelect(entry.id)}
            className={`rounded-lg border-2 p-3 text-left transition ${
              active
                ? 'border-neutral-900 bg-neutral-50'
                : 'border-neutral-200 hover:border-neutral-400'
            }`}
          >
            <div className="mb-2 h-10 w-full rounded" style={{ background: entry.swatch }} aria-hidden />
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-semibold text-neutral-900">{entry.name}</span>
              {entry.needsShape && (
                <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] text-amber-700">
                  形状
                </span>
              )}
            </div>
            <div className="mt-1 text-xs leading-snug text-neutral-500">{entry.whenToUse}</div>
          </button>
        );
      })}
    </div>
  );
}
