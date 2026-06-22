import type { LayerOption } from '@/types/background';

interface LayerPickerProps<TId extends string> {
  /** 层标题，如「Motion 运动」 */
  title: string;
  options: LayerOption<TId>[];
  selected: TId;
  onSelect: (id: TId) => void;
}

/** 单层选项选择器：横向卡片，展示英文名 + 中文情绪标签。 */
export function LayerPicker<TId extends string>({
  title,
  options,
  selected,
  onSelect,
}: LayerPickerProps<TId>) {
  return (
    <div>
      <div className="mb-2 text-sm font-semibold text-neutral-700">{title}</div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {options.map((opt) => {
          const active = opt.id === selected;
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => onSelect(opt.id)}
              aria-pressed={active}
              className={
                active
                  ? 'flex flex-col rounded-lg border border-neutral-900 bg-neutral-900 px-3 py-2 text-left text-white transition'
                  : 'flex flex-col rounded-lg border border-neutral-200 bg-white px-3 py-2 text-left transition hover:border-neutral-400'
              }
            >
              <span className="text-sm font-medium">{opt.name}</span>
              <span
                className={
                  active ? 'text-xs text-neutral-300' : 'text-xs text-neutral-400'
                }
              >
                {opt.mood}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
