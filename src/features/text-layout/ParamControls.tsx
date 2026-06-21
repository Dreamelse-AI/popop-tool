import type { EffectMode, EffectParams } from '@/types/layout';

interface ParamControlsProps {
  mode: EffectMode;
  params: EffectParams;
  onChange: <K extends keyof EffectParams>(key: K, value: EffectParams[K]) => void;
  onReseed: () => void;
}

interface SliderDef {
  key: keyof EffectParams;
  label: string;
  min: number;
  max: number;
  step?: number;
  unit?: string;
}

/** 各模式显示哪些滑杆。 */
const SLIDERS_BY_MODE: Record<EffectMode, SliderDef[]> = {
  rain: [
    { key: 'minSize', label: '最小字号', min: 12, max: 80, unit: 'px' },
    { key: 'maxSize', label: '最大字号', min: 20, max: 120, unit: 'px' },
    { key: 'blur', label: '随机模糊', min: 0, max: 20, unit: 'px' },
    { key: 'axisCenter', label: '横轴中心', min: 0, max: 100, unit: '%' },
    { key: 'padding', label: '边距', min: 0, max: 160, unit: 'px' },
  ],
  barrage: [
    { key: 'minSize', label: '最小字号', min: 12, max: 80, unit: 'px' },
    { key: 'maxSize', label: '最大字号', min: 20, max: 120, unit: 'px' },
    { key: 'blur', label: '随机模糊', min: 0, max: 20, unit: 'px' },
    { key: 'axisCenter', label: '竖轴中心', min: 0, max: 100, unit: '%' },
    { key: 'padding', label: '边距', min: 0, max: 160, unit: 'px' },
  ],
  tearBlur: [
    { key: 'minSize', label: '最小字号', min: 20, max: 100, unit: 'px' },
    { key: 'maxSize', label: '最大字号', min: 30, max: 140, unit: 'px' },
    { key: 'blur', label: '模糊强度', min: 1, max: 30, unit: 'px' },
    { key: 'tearBlurRadius', label: '模糊圆大小', min: 30, max: 240, unit: 'px' },
    { key: 'spread', label: '分散程度', min: 0, max: 100, unit: '%' },
    { key: 'tearLetterSpacing', label: '字间距', min: 0, max: 40, unit: 'px' },
    { key: 'tearLineSpacing', label: '行间距', min: 80, max: 280, unit: '%' },
  ],
  imageFill: [
    { key: 'minSize', label: '字号', min: 12, max: 48, unit: 'px' },
    { key: 'imageThreshold', label: '图片阈值', min: 0, max: 255 },
    { key: 'padding', label: '边距', min: 0, max: 160, unit: 'px' },
  ],
};

export function ParamControls({ mode, params, onChange, onReseed }: ParamControlsProps) {
  const sliders = SLIDERS_BY_MODE[mode];

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-x-5 gap-y-3">
        {sliders.map((s) => (
          <label key={s.key} className="block text-xs text-neutral-600">
            <span className="mb-1 flex justify-between">
              <span>{s.label}</span>
              <span className="tabular-nums text-neutral-400">
                {params[s.key] as number}
                {s.unit ?? ''}
              </span>
            </span>
            <input
              type="range"
              min={s.min}
              max={s.max}
              step={s.step ?? 1}
              value={params[s.key] as number}
              onChange={(e) => onChange(s.key, Number(e.target.value) as never)}
              className="w-full accent-neutral-900"
            />
          </label>
        ))}
      </div>

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

      <div className="grid grid-cols-2 gap-x-5 gap-y-3">
        <label className="block text-xs text-neutral-600">
          <span className="mb-1 block">字体颜色</span>
          <input
            type="color"
            value={params.fontColor}
            onChange={(e) => onChange('fontColor', e.target.value)}
            className="h-8 w-full rounded border border-neutral-300"
          />
        </label>
        <label className="block text-xs text-neutral-600">
          <span className="mb-1 block">背景颜色</span>
          <input
            type="color"
            value={params.bgColor}
            onChange={(e) => onChange('bgColor', e.target.value)}
            className="h-8 w-full rounded border border-neutral-300"
          />
        </label>
      </div>

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
