import type { EffectMode } from '@/types/layout';
import type { EffectEntry, NumericParamKey, ParamRange, ParamSpec } from '@/types/catalog';

/**
 * 排版效果库（catalog）。
 *
 * 参数分两类，分开维护：
 *   1) 公共参数：多数效果共有，用「横向表」COMMON_RANGES 填（行=效果，列=公共参数，不用的填 null）
 *   2) 异化参数：某效果特有，在 EXTRA_PARAMS 里按效果单独列成独立项
 *
 * 二者最终合并成每个效果的 params: ParamSpec[]（单一事实源），
 * 同时供 randomizeParams 区间随机与 UI 滑杆渲染。
 *
 * 区间值为占位，等正式区间表填入后替换。
 */

/** 公共参数的列定义（标签/单位，只定义一次）。 */
const COMMON_PARAM_META: Record<
  'minSize' | 'maxSize' | 'blur' | 'spread' | 'padding',
  { label: string; unit?: string }
> = {
  minSize: { label: '最小字号', unit: 'px' },
  maxSize: { label: '最大字号', unit: 'px' },
  blur: { label: '模糊', unit: 'px' },
  spread: { label: '错落/分散', unit: '%' },
  padding: { label: '边距', unit: 'px' },
};

type CommonKey = keyof typeof COMMON_PARAM_META;
const COMMON_ORDER: CommonKey[] = ['minSize', 'maxSize', 'blur', 'spread', 'padding'];

/**
 * 【公共参数横向表】行=效果，列=公共参数。
 * 该效果不用某公共参数时填 null（不会出现在它的参数里）。
 */
const COMMON_RANGES: Record<EffectMode, Record<CommonKey, ParamRange | null>> = {
  //            minSize     maxSize     blur      spread     padding
  rain: { minSize: [28, 34], maxSize: [54, 66], blur: [3, 7], spread: [40, 65], padding: [40, 64] },
  barrage: { minSize: [28, 34], maxSize: [54, 66], blur: [3, 7], spread: [40, 65], padding: [40, 64] },
  tearBlur: { minSize: [44, 60], maxSize: null, blur: [4, 8], spread: [35, 60], padding: null },
  imageFill: { minSize: null, maxSize: null, blur: null, spread: null, padding: [32, 56] },
};

/**
 * 【异化参数】每个效果特有的参数，独立填写（无则省略该效果）。
 * 这里的 label/unit 就地定义，不进公共表。
 */
const EXTRA_PARAMS: Partial<Record<EffectMode, ParamSpec[]>> = {
  tearBlur: [
    { key: 'tearBlurRadius', label: '模糊圆大小', unit: 'px', range: [80, 200] },
    { key: 'tearLetterSpacing', label: '字间距', unit: 'px', range: [0, 6] },
    { key: 'tearLineSpacing', label: '行间距', unit: '%', range: [130, 180] },
  ],
};

/** 效果元信息（与参数无关的展示/选型字段）。 */
const EFFECT_META: Record<
  EffectMode,
  { name: string; whenToUse: string; swatch: string; needsShape?: boolean }
> = {
  rain: {
    name: '竖排雨落层次',
    whenToUse: '抒情、有画面感的中长文案；想要竖排、自上而下的飘落氛围。',
    swatch: '#7fb0d6',
  },
  barrage: {
    name: '横排弹幕模式',
    whenToUse: '短句密集、节奏感强、偏网络/流行语气的文案；横排逐行展开。',
    swatch: '#d98a5a',
  },
  tearBlur: {
    name: '泪水模糊',
    whenToUse: '情绪化、内省的短文案；居中排版叠加局部模糊，含蓄克制。',
    swatch: '#9aa0c0',
  },
  imageFill: {
    name: '图片填充字',
    whenToUse: '主题鲜明、可对应具象形状（爱心/星星等）的文案；文字填满形状内部。',
    swatch: '#7dbd8a',
    needsShape: true,
  },
};

const EFFECT_ORDER: EffectMode[] = ['rain', 'barrage', 'tearBlur', 'imageFill'];

/** 合并公共参数（按列序，跳过 null）+ 异化参数，生成该效果的 ParamSpec 清单。 */
function buildParams(mode: EffectMode): ParamSpec[] {
  const common = COMMON_RANGES[mode];
  const specs: ParamSpec[] = [];
  for (const key of COMMON_ORDER) {
    const range = common[key];
    if (range) {
      specs.push({ key: key as NumericParamKey, label: COMMON_PARAM_META[key].label, unit: COMMON_PARAM_META[key].unit, range });
    }
  }
  return [...specs, ...(EXTRA_PARAMS[mode] ?? [])];
}

export const EFFECT_CATALOG: EffectEntry[] = EFFECT_ORDER.map((mode) => ({
  id: mode,
  name: EFFECT_META[mode].name,
  whenToUse: EFFECT_META[mode].whenToUse,
  swatch: EFFECT_META[mode].swatch,
  needsShape: EFFECT_META[mode].needsShape,
  params: buildParams(mode),
}));

export const DEFAULT_MODE: EffectMode = 'rain';

export function getEffect(mode: EffectMode): EffectEntry {
  return EFFECT_CATALOG.find((e) => e.id === mode) ?? EFFECT_CATALOG[0];
}
