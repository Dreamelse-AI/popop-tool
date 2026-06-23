import type { AssetOption } from '@/types/visualAsset';

interface ChipGroupProps {
  /** 维度标题，如「Emotion 情绪」 */
  title: string;
  options: AssetOption[];
  /** 当前选中的 id 数组（三态：空=全随机，1=锁定，多=限定随机） */
  selected: string[];
  onToggle: (id: string) => void;
  onClear: () => void;
  /** 该维度是否可选（标注用） */
  optional?: boolean;
}

/**
 * 三态 chip 选择器。
 * 未选中=灰底（属于随机域）；选中=高亮。多选时视为"在选中里随机"。
 */
export function ChipGroup({
  title,
  options,
  selected,
  onToggle,
  onClear,
  optional,
}: ChipGroupProps) {
  const hint =
    selected.length === 0
      ? optional
        ? '不限（不加入）'
        : '随机'
      : selected.length === 1
        ? '锁定'
        : `${selected.length} 选随机`;

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <span className="pop-label">
          {title}
          <span className="ml-2 font-mono text-[11px] font-normal text-ink-3">{hint}</span>
        </span>
        {selected.length > 0 && (
          <button type="button" onClick={onClear} className="pop-link">
            清空
          </button>
        )}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => {
          const active = selected.includes(o.id);
          return (
            <button
              key={o.id}
              type="button"
              onClick={() => onToggle(o.id)}
              aria-pressed={active}
              title={o.label}
              className={active ? 'pop-chip-on' : 'pop-chip'}
            >
              {o.name}
              {o.label && <span className="ml-1 opacity-60">{o.label}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
