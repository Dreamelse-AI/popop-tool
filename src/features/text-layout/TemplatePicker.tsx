import { TEMPLATES } from '@/data/templates';

interface TemplatePickerProps {
  selectedId: string;
  onSelect: (id: string) => void;
}

export function TemplatePicker({ selectedId, onSelect }: TemplatePickerProps) {
  return (
    <div className="grid grid-cols-3 gap-3">
      {TEMPLATES.map((tpl) => {
        const active = tpl.id === selectedId;
        return (
          <button
            key={tpl.id}
            type="button"
            onClick={() => onSelect(tpl.id)}
            className={`rounded-lg border-2 p-3 text-left transition ${
              active
                ? 'border-neutral-900 bg-neutral-50'
                : 'border-neutral-200 hover:border-neutral-400'
            }`}
          >
            <div
              className="mb-2 h-12 w-full rounded"
              style={{ background: tpl.swatch }}
              aria-hidden
            />
            <div className="text-sm font-semibold text-neutral-900">{tpl.name}</div>
            <div className="mt-1 text-xs leading-snug text-neutral-500">{tpl.description}</div>
          </button>
        );
      })}
    </div>
  );
}
