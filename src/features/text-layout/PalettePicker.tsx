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
        className={`self-start rounded-full border px-3 py-1.5 text-sm transition ${
          value === RANDOM
            ? 'border-neutral-900 bg-neutral-900 text-white'
            : 'border-neutral-300 bg-white text-neutral-700 hover:border-neutral-500'
        }`}
      >
        随机配色
      </button>

      {groups.map((group) => (
        <div key={group.category}>
          <div className="mb-1.5 text-xs font-medium text-neutral-400">{group.category}</div>
          <div className="flex flex-wrap gap-2">
            {group.palettes.map((p) => {
              const active = value === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  title={`${p.name} · ${p.mood}`}
                  onClick={() => onChange(p.id)}
                  className={`flex items-center gap-1.5 rounded-lg border px-2 py-1 text-xs transition ${
                    active
                      ? 'border-neutral-900 ring-1 ring-neutral-900'
                      : 'border-neutral-200 hover:border-neutral-400'
                  }`}
                >
                  <span
                    className="h-4 w-4 rounded"
                    style={{ background: toCssBackground(p.bgColor) }}
                  />
                  <span className="text-neutral-700">{p.name}</span>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
