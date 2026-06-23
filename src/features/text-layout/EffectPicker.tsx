import type { EffectMode } from '@/types/layout';
import { EFFECT_CATALOG } from '@/data/effectCatalog';
import { RANDOM, type Preferred } from './store';

interface EffectPickerProps {
  value: Preferred<EffectMode>;
  onChange: (value: Preferred<EffectMode>) => void;
}

/** 排版效果选择：随机档 + 各效果可锁定。 */
export function EffectPicker({ value, onChange }: EffectPickerProps) {
  return (
    <div className="flex flex-wrap gap-2">
      <Chip active={value === RANDOM} onClick={() => onChange(RANDOM)}>
        随机
      </Chip>
      {EFFECT_CATALOG.map((e) => (
        <Chip key={e.id} active={value === e.id} onClick={() => onChange(e.id)} swatch={e.swatch}>
          {e.name}
        </Chip>
      ))}
    </div>
  );
}

function Chip({
  active,
  onClick,
  swatch,
  children,
}: {
  active: boolean;
  onClick: () => void;
  swatch?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition ${
        active
          ? 'border-neutral-900 bg-neutral-900 text-white'
          : 'border-neutral-300 bg-white text-neutral-700 hover:border-neutral-500'
      }`}
    >
      {swatch && (
        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: swatch }} />
      )}
      {children}
    </button>
  );
}
