import type { EffectMode, EffectParams } from '@/types/layout';

/**
 * 各特效模式的元信息与默认参数预设。
 *
 * 等用户发来更多排版模板，可在此追加 EffectMode 与对应预设；
 * 渲染算法在 features/text-layout/effects 下，新增模式需配套实现一个 draw 函数。
 */

/** 通用基线参数（各预设在此基础上覆盖差异项）。 */
const BASE: EffectParams = {
  fontFamily: '"Noto Serif SC", "Songti SC", serif',
  fontColor: '#f4f1ea',
  bgColor: '#111111',
  minSize: 26,
  maxSize: 64,
  blur: 6,
  padding: 48,
  seed: 1234,
  axisCenter: 50,
  tearLetterSpacing: 2,
  tearLineSpacing: 150,
  tearBlurRadius: 90,
  spread: 50,
  fillDirection: 'horizontal',
  fillShape: 'heart',
  imageThreshold: 128,
};

export interface EffectPreset {
  mode: EffectMode;
  name: string;
  description: string;
  /** 是否需要上传图片 */
  needsImage: boolean;
  /** 缩略图强调色（仅用于选择列表） */
  swatch: string;
  params: EffectParams;
}

export const EFFECT_PRESETS: EffectPreset[] = [
  {
    mode: 'rain',
    name: '竖排雨落层次',
    description: '文字拆字成竖列由上而下飘落，前后景虚实层次。',
    needsImage: false,
    swatch: '#7fb0d6',
    params: { ...BASE, bgColor: '#0e1217', fontColor: '#e8eef5', blur: 7, axisCenter: 48 },
  },
  {
    mode: 'barrage',
    name: '横排弹幕模式',
    description: '文字横向成行围绕中轴散开，弹幕飞屏质感。',
    needsImage: false,
    swatch: '#d98a5a',
    params: { ...BASE, bgColor: '#16110d', fontColor: '#f4e6d6', blur: 6, axisCenter: 50 },
  },
  {
    mode: 'tearBlur',
    name: '泪水模糊',
    description: '居中文字叠加径向模糊圆，局部晕开如泪水。',
    needsImage: false,
    swatch: '#9aa0c0',
    params: {
      ...BASE,
      bgColor: '#14141c',
      fontColor: '#eceaf2',
      minSize: 48,
      maxSize: 72,
      blur: 6,
      tearBlurRadius: 140,
      tearLineSpacing: 160,
      spread: 45,
    },
  },
  {
    mode: 'imageFill',
    name: '图片填充字',
    description: '文字填满形状内部，内置爱心/星星/圆形/菱形，也可上传图片。',
    needsImage: false,
    swatch: '#7dbd8a',
    params: {
      ...BASE,
      bgColor: '#0f0f0f',
      fontColor: '#f0f0f0',
      minSize: 22,
      maxSize: 22,
      padding: 40,
      fillShape: 'heart',
      imageThreshold: 128,
      fillDirection: 'horizontal',
    },
  },
];

export const DEFAULT_MODE: EffectMode = 'rain';

export function getPreset(mode: EffectMode): EffectPreset {
  return EFFECT_PRESETS.find((p) => p.mode === mode) ?? EFFECT_PRESETS[0];
}
