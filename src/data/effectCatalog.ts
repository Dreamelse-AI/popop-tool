import type { EffectMode } from '@/types/layout';
import type { EffectEntry } from '@/types/catalog';

/**
 * 排版效果库（catalog）。可持续增加：新增效果 = 加一条目录项 + 写一个 draw 函数 + 在 renderer 注册。
 *
 * 每条含：
 *  - whenToUse：拼进 prompt，供模型判断何时选用
 *  - paramRanges：数值参数的随机区间（生产链路在区间内随机；UI 滑杆也以此为边界）
 *
 * 数值参数语义见 src/types/layout.ts 的 EffectParams。
 * 区间值为占位（基于当前手感），等正式区间表填入后替换。
 */
export const EFFECT_CATALOG: EffectEntry[] = [
  {
    id: 'rain',
    name: '竖排雨落层次',
    whenToUse: '抒情、有画面感的中长文案；想要竖排、自上而下的飘落氛围。',
    swatch: '#7fb0d6',
    paramRanges: {
      minSize: [28, 34],
      maxSize: [54, 66],
      blur: [3, 7],
      spread: [40, 65],
      padding: [40, 64],
    },
  },
  {
    id: 'barrage',
    name: '横排弹幕模式',
    whenToUse: '短句密集、节奏感强、偏网络/流行语气的文案；横排逐行展开。',
    swatch: '#d98a5a',
    paramRanges: {
      minSize: [28, 34],
      maxSize: [54, 66],
      blur: [3, 7],
      spread: [40, 65],
      padding: [40, 64],
    },
  },
  {
    id: 'tearBlur',
    name: '泪水模糊',
    whenToUse: '情绪化、内省的短文案；居中排版叠加局部模糊，含蓄克制。',
    swatch: '#9aa0c0',
    paramRanges: {
      minSize: [44, 60],
      blur: [4, 8],
      tearBlurRadius: [80, 200],
      spread: [35, 60],
      tearLetterSpacing: [0, 6],
      tearLineSpacing: [130, 180],
    },
  },
  {
    id: 'imageFill',
    name: '图片填充字',
    whenToUse: '主题鲜明、可对应具象形状（爱心/星星等）的文案；文字填满形状内部。',
    swatch: '#7dbd8a',
    needsShape: true,
    paramRanges: {
      padding: [32, 56],
    },
  },
];

export const DEFAULT_MODE: EffectMode = 'rain';

export function getEffect(mode: EffectMode): EffectEntry {
  return EFFECT_CATALOG.find((e) => e.id === mode) ?? EFFECT_CATALOG[0];
}
