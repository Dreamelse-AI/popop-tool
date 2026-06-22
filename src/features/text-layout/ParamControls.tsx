import type { EffectMode, EffectParams, FillShape } from '@/types/layout';
import { getEffect } from '@/data/effectCatalog';

interface ParamControlsProps {
  mode: EffectMode;
  params: EffectParams;
  onChange: <K extends keyof EffectParams>(key: K, value: EffectParams[K]) => void;
  onReseed: () => void;
}

/** imageFill 形状选项。 */
const FILL_SHAPES: Array<{ value: FillShape; label: string }> = [
  { value: 'heart', label: '爱心' },
  { value: 'star', label: '星星' },
  { value: 'circle', label: '圆形' },
  { value: 'diamond', label: '菱形' },
  { value: 'image', label: '上传图片' },
];

/**
 * 参数微调（仅调试用）。滑杆从效果库的 params 规格自动生成，
 * 与生产链路区间共用同一份定义，不会出现两处不一致。
 */
export function ParamControls({ mode, params, onChange, onReseed }: ParamControlsProps) {
  const specs = getEffect(mode).params;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-x-5 gap-y-3">
        {specs.map((spec) => (
          <label key={spec.key} className="block text-xs text-neutral-600">
            <span className="mb-1 flex justify-between">
              <span>{spec.label}</span>
              <span className="tabular-nums text-neutral-400">
                {params[spec.key]}
                {spec.unit ?? ''}
              </span>
            </span>
            <input
              type="range"
              min={spec.range[0]}
              max={spec.range[1]}
              step={spec.step ?? 1}
              value={params[spec.key]}
              onChange={(e) => onChange(spec.key, Number(e.target.value) as never)}
              className="w-full accent-neutral-900"
            />
          </label>
        ))}
      </div>

      {mode === 'imageFill' && (
        <label className="block text-xs text-neutral-600">
          <span className="mb-1 block">填充形状</span>
          <div className="flex flex-wrap gap-2">
            {FILL_SHAPES.map((shape) => (
              <button
                key={shape.value}
                type="button"
                onClick={() => onChange('fillShape', shape.value)}
                className={`rounded border px-3 py-2 text-xs transition ${
                  params.fillShape === shape.value
                    ? 'border-neutral-900 bg-neutral-900 text-white'
                    : 'border-neutral-300 text-neutral-600 hover:border-neutral-500'
                }`}
              >
                {shape.label}
              </button>
            ))}
          </div>
        </label>
      )}

      {mode === 'imageFill' && params.fillShape === 'image' && (
        <label className="block text-xs text-neutral-600">
          <span className="mb-1 flex justify-between">
            <span>图片阈值</span>
            <span className="tabular-nums text-neutral-400">{params.imageThreshold}</span>
          </span>
          <input
            type="range"
            min={0}
            max={255}
            value={params.imageThreshold}
            onChange={(e) => onChange('imageThreshold', Number(e.target.value))}
            className="w-full accent-neutral-900"
          />
        </label>
      )}

      {mode === 'imageFill' && (
        <label className="block text-xs text-neutral-600">
          <span className="mb-1 block">填充方向</span>
          <div className="flex gap-2">
            {(['horizontal', 'vertical'] as const).map((dir) => (
              <button
                key={dir}
                type="button"
                onClick={() => onChange('fillDirection', dir)}
                className={`flex-1 rounded border px-3 py-2 text-xs transition ${
                  params.fillDirection === dir
                    ? 'border-neutral-900 bg-neutral-900 text-white'
                    : 'border-neutral-300 text-neutral-600 hover:border-neutral-500'
                }`}
              >
                {dir === 'horizontal' ? '横排' : '竖排'}
              </button>
            ))}
          </div>
        </label>
      )}

      <button
        type="button"
        onClick={onReseed}
        className="self-start rounded-lg border border-neutral-300 px-4 py-2 text-xs font-medium text-neutral-700 transition hover:border-neutral-900"
      >
        随机重排（换种子：{params.seed}）
      </button>
    </div>
  );
}
