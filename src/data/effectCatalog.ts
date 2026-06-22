import type { EffectMode } from '@/types/layout';
import type { EffectEntry } from '@/types/catalog';

/**
 * 排版效果库（catalog）。可持续增加：新增效果 = 加一条目录项 + 写 draw 函数 + 在 renderer 注册。
 *
 * 每条的 `params` 是该效果参数的「单一事实源」：
 *   - 只列本效果实际用到的参数（无空字段）
 *   - 每个参数自带 label / unit / range（区间即随机范围，也是 UI 滑杆上下界）
 *
 * 生产链路在 range 内随机（见 services/params.ts）；UI 滑杆也由此渲染。
 * 区间值为占位（基于当前手感），等正式区间表填入后替换 range 即可。
 */
export const EFFECT_CATALOG: EffectEntry[] = [
  {
    id: 'rain',
    name: '竖排雨落层次',
    whenToUse: '抒情、有画面感的中长文案；想要竖排、自上而下的飘落氛围。',
    swatch: '#7fb0d6',
    params: [
      { key: 'minSize', label: '最小字号', unit: 'px', range: [28, 34] },
      { key: 'maxSize', label: '最大字号', unit: 'px', range: [54, 66] },
      { key: 'blur', label: '层次模糊', unit: 'px', range: [3, 7] },
      { key: 'spread', label: '错落程度', unit: '%', range: [40, 65] },
      { key: 'padding', label: '边距', unit: 'px', range: [40, 64] },
    ],
  },
  {
    id: 'barrage',
    name: '横排弹幕模式',
    whenToUse: '短句密集、节奏感强、偏网络/流行语气的文案；横排逐行展开。',
    swatch: '#d98a5a',
    params: [
      { key: 'minSize', label: '最小字号', unit: 'px', range: [28, 34] },
      { key: 'maxSize', label: '最大字号', unit: 'px', range: [54, 66] },
      { key: 'blur', label: '层次模糊', unit: 'px', range: [3, 7] },
      { key: 'spread', label: '错落程度', unit: '%', range: [40, 65] },
      { key: 'padding', label: '边距', unit: 'px', range: [40, 64] },
    ],
  },
  {
    id: 'tearBlur',
    name: '泪水模糊',
    whenToUse: '情绪化、内省的短文案；居中排版叠加局部模糊，含蓄克制。',
    swatch: '#9aa0c0',
    params: [
      { key: 'minSize', label: '字号', unit: 'px', range: [44, 60] },
      { key: 'blur', label: '模糊强度', unit: 'px', range: [4, 8] },
      { key: 'tearBlurRadius', label: '模糊圆大小', unit: 'px', range: [80, 200] },
      { key: 'spread', label: '分散程度', unit: '%', range: [35, 60] },
      { key: 'tearLetterSpacing', label: '字间距', unit: 'px', range: [0, 6] },
      { key: 'tearLineSpacing', label: '行间距', unit: '%', range: [130, 180] },
    ],
  },
  {
    id: 'imageFill',
    name: '图片填充字',
    whenToUse: '主题鲜明、可对应具象形状（爱心/星星等）的文案；文字填满形状内部。',
    swatch: '#7dbd8a',
    needsShape: true,
    params: [{ key: 'padding', label: '边距', unit: 'px', range: [32, 56] }],
  },
];

export const DEFAULT_MODE: EffectMode = 'rain';

export function getEffect(mode: EffectMode): EffectEntry {
  return EFFECT_CATALOG.find((e) => e.id === mode) ?? EFFECT_CATALOG[0];
}
