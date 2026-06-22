import type { Background } from '@/types/catalog';
import { PALETTE_LIBRARY } from '@/data/paletteLibrary';
import { IMAGE_LIBRARY } from '@/data/imageLibrary';

interface BackgroundPickerProps {
  background: Background;
  onSelect: (bg: Background) => void;
}

/** 背景选择：配色库与图片库二选一。 */
export function BackgroundPicker({ background, onSelect }: BackgroundPickerProps) {
  return (
    <div className="flex flex-col gap-3">
      <div>
        <div className="mb-1.5 text-xs font-medium text-neutral-500">配色</div>
        <div className="flex flex-wrap gap-2">
          {PALETTE_LIBRARY.map((p) => {
            const active = background.type === 'palette' && background.paletteId === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => onSelect({ type: 'palette', paletteId: p.id })}
                title={p.mood}
                className={`flex items-center gap-2 rounded border px-2.5 py-1.5 text-xs transition ${
                  active ? 'border-neutral-900' : 'border-neutral-200 hover:border-neutral-400'
                }`}
              >
                <span
                  className="inline-block h-4 w-4 rounded-full border border-neutral-300"
                  style={{ background: p.bgColor }}
                  aria-hidden
                />
                {p.name}
              </button>
            );
          })}
        </div>
      </div>

      {IMAGE_LIBRARY.length > 0 && (
        <div>
          <div className="mb-1.5 text-xs font-medium text-neutral-500">背景图</div>
          <div className="flex flex-wrap gap-2">
            {IMAGE_LIBRARY.map((img) => {
              const active = background.type === 'image' && background.imageId === img.id;
              return (
                <button
                  key={img.id}
                  type="button"
                  onClick={() => onSelect({ type: 'image', imageId: img.id })}
                  title={img.mood}
                  className={`rounded border px-2.5 py-1.5 text-xs transition ${
                    active ? 'border-neutral-900' : 'border-neutral-200 hover:border-neutral-400'
                  }`}
                >
                  {img.name}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
