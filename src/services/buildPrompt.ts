import { EFFECT_CATALOG } from '@/data/effectCatalog';
import { PALETTE_LIBRARY } from '@/data/paletteLibrary';
import { IMAGE_LIBRARY } from '@/data/imageLibrary';
import { MAX_INPUT_LENGTH } from '@/types/layout';

/**
 * 从目录自动生成「拼接生成」用的 prompt 片段。
 *
 * 用法：模型生成文案时，把本片段拼进系统/任务提示词，
 * 让模型在生成内容的同时，从给定 id 里选好排版效果与背景，按 schema 输出。
 *
 * 库一更新，这里产出的提示词自动同步（目录是单一事实源）。
 */

/** 排版效果可选项清单（含 whenToUse）。 */
function effectsBlock(): string {
  const lines = EFFECT_CATALOG.map(
    (e) => `  - "${e.id}"（${e.name}）：${e.whenToUse}`,
  );
  return `可选排版效果（effectId 从中选其一）：\n${lines.join('\n')}`;
}

/** 配色库清单。 */
function palettesBlock(): string {
  if (!PALETTE_LIBRARY.length) return '';
  const lines = PALETTE_LIBRARY.map((p) => `  - "${p.id}"（${p.name}）：${p.mood}`);
  return `可选配色（background.type="palette" 时，paletteId 从中选其一）：\n${lines.join('\n')}`;
}

/** 图片库清单。 */
function imagesBlock(): string {
  if (!IMAGE_LIBRARY.length) {
    return '可选背景图：（暂无，请统一使用配色 background.type="palette"）';
  }
  const lines = IMAGE_LIBRARY.map((i) => `  - "${i.id}"（${i.name}）：${i.mood}`);
  return `可选背景图（background.type="image" 时，imageId 从中选其一）：\n${lines.join('\n')}`;
}

/** 输出 schema 说明。模型只选离散项，不输出任何数值参数。 */
const OUTPUT_SCHEMA = `严格按以下 JSON 结构输出（不要包含数值排版参数，字号/模糊等由系统在安全区间内随机）：
{
  "text": "生成的文案，≤${MAX_INPUT_LENGTH} 字，可含换行分段",
  "effectId": "上面列表中的效果 id",
  "background": { "type": "palette", "paletteId": "配色 id" }
  // 或使用背景图：{ "type": "image", "imageId": "图片 id" }
}`;

/**
 * 生成完整的「风格选择」提示词片段。
 * 注入到你的内容生成 prompt 中（通常放在任务说明之后、输出要求之前）。
 */
export function buildStylePromptSection(): string {
  return [
    '【排版风格选择】请在生成文案的同时，依据文案的情绪与主题，从下列目录中选择最合适的排版与背景：',
    effectsBlock(),
    palettesBlock(),
    imagesBlock(),
    '【背景规则】配色与背景图二选一，只能提供其中一种。',
    OUTPUT_SCHEMA,
  ]
    .filter(Boolean)
    .join('\n\n');
}
