import type { EffectMode, EffectParams, RenderStyle } from '@/types/layout';
import type { Background } from '@/types/catalog';
import { getEffect } from '@/data/effectCatalog';
import { getPalette } from '@/data/paletteLibrary';
import { getImage } from '@/data/imageLibrary';
import { mulberry32 } from '@/features/text-layout/effects/shared';

/** 默认字体族（配色库未指定字体时使用）。 */
export const DEFAULT_FONT_FAMILY = '"Noto Serif SC", "Songti SC", serif';

/**
 * 数值参数的兜底默认值。区间未覆盖到的字段用它补齐，
 * 保证 EffectParams 始终完整。
 */
export const DEFAULT_PARAMS: EffectParams = {
  minSize: 30,
  maxSize: 60,
  blur: 5,
  padding: 48,
  seed: 1,
  spread: 50,
  tearLetterSpacing: 2,
  tearLineSpacing: 150,
  tearBlurRadius: 120,
  fillDirection: 'horizontal',
  fillShape: 'heart',
  imageThreshold: 128,
};

/** 数值型参数的键（可被区间随机覆盖的）。 */

/**
 * 在效果库定义的区间内随机出一套数值参数（生产链路核心）。
 * 相同 seed 产出相同参数，保证可复现。
 *
 * @param mode  效果模式
 * @param seed  随机种子（不传则随机生成一个）
 * @param overrides 额外覆盖（如离散项 fillShape / fillDirection）
 */
export function randomizeParams(
  mode: EffectMode,
  seed?: number,
  overrides?: Partial<EffectParams>,
): EffectParams {
  const usedSeed = seed ?? Math.floor(Math.random() * 9_999_999) + 1;
  const rng = mulberry32(usedSeed);
  const specs = getEffect(mode).params;

  const params: EffectParams = { ...DEFAULT_PARAMS, seed: usedSeed };

  for (const spec of specs) {
    const [min, max] = spec.range;
    params[spec.key] = Math.round(min + rng() * (max - min));
  }

  // 保证 maxSize >= minSize
  if (params.maxSize < params.minSize) {
    params.maxSize = params.minSize;
  }

  return { ...params, ...overrides };
}

/**
 * 把背景选择（配色库 / 图片库，二选一）解析为渲染风格。
 * 图片不存在时回退到默认配色，保证总能渲染。
 */
export function resolveStyle(background: Background): RenderStyle {
  if (background.type === 'image') {
    const img = getImage(background.imageId);
    if (img) {
      return {
        fontFamily: DEFAULT_FONT_FAMILY,
        fontColor: img.fontColor,
        bgColor: '#000000',
        bgImageUrl: img.url,
        overlay: img.overlay,
      };
    }
    // 图片缺失，回退默认配色
  }

  const paletteId = background.type === 'palette' ? background.paletteId : '';
  const palette = getPalette(paletteId);
  return {
    fontFamily: DEFAULT_FONT_FAMILY,
    fontColor: palette.fontColor,
    bgColor: palette.bgColor,
  };
}
