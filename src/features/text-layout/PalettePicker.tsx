import { getPalettesByCategory } from '@/data/paletteLibrary';
import { toCssBackground } from './colorUtils';
import { RANDOM, type Preferred } from './store';

interface PalettePickerProps {
  value: Preferred<string>;
  onChange: (value: Preferred<string>) => void;
}

/** 配色选择：随机档 + 按大类分组的色块（点选锁定）。 */
export function PalettePicker({ value, onChange }: PalettePickerProps) {
  const groups = getPalettesByCategory();

  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        onClick={() => onChange(RANDOM)}
        className={value === RANDOM ? 'pop-chip-on self-start' : 'pop-chip self-start'}
      >
        随机配色
      </button>

      {groups.map((group) => (
        <div key={group.category}>
          <div className="mb-1.5 font-mono text-xs font-semibold text-ink-3">{group.category}</div>
          <div className="flex flex-wrap gap-2">
            {group.palettes.map((p) => {
              const active = value === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  title={`${p.name} · ${p.mood}`}
                  onClick={() => onChange(p.id)}
                  className={`flex items-center gap-1.5 rounded-pop border-2 px-2 py-1 text-xs transition ${
                    active
                      ? 'border-ink bg-cream shadow-sticker-sm'
                      : 'border-ink bg-paper hover:bg-cream-soft'
                  }`}
                >
                  <span
                    className="h-4 w-4 rounded border border-ink"
                    style={{ background: toCssBackground(p.bgColor) }}
                  />
                  <span className="font-semibold text-ink">{p.name}</span>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
