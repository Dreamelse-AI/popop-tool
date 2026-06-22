/**
 * 扩写模型接口：把结构化配置展开成最终 image prompt。
 *
 * 与 layoutExtractor 同款套路：留一个稳定边界，后端/扩写模型接入后只改实现。
 *   - USE_EXPANDER=false → 本地 mock：按各层 promptFragment 直接拼（保证现在就能出图）
 *   - USE_EXPANDER=true  → 调用后续提供的扩写模型，返回更自然的 prompt
 *
 * 调用方（生成引擎/store）始终调 expandToPrompt，不感知实现切换。
 */

import type { AssetConfig } from '@/types/visualAsset';
import {
  EMOTION_OPTIONS,
  TYPE_OPTIONS,
  DNA_SCHEMAS,
  GLOBAL_STYLE,
  findOption,
} from '@/data/visualAssetCatalog';

/** 是否使用后端扩写模型。后端就绪后置 true（或读环境变量）。 */
const USE_EXPANDER = false;

/**
 * 把一条结构化配置展开成 image prompt。
 * @param config 生成引擎产出的结构化配置
 */
export async function expandToPrompt(config: AssetConfig): Promise<string> {
  if (USE_EXPANDER) {
    return expandViaBackend(config);
  }
  return expandMock(config);
}

/**
 * 后端扩写（占位）。后续接入扩写模型时实现并把 USE_EXPANDER 置 true。
 * 约定：传入结构化配置，返回单条最终 prompt 字符串。
 */
async function expandViaBackend(_config: AssetConfig): Promise<string> {
  // 例：return postLocal<AssetConfig, { prompt: string }>('/visual-asset/expand', _config).then(r => r.prompt);
  throw new Error('扩写模型尚未接入');
}

/** 本地 mock：把 emotion + type + DNA 各片段 + 全局 style 拼成 prompt。 */
function expandMock(config: AssetConfig): string {
  const parts: string[] = [];

  const emotion = findOption(EMOTION_OPTIONS, config.emotion);
  if (emotion) parts.push(emotion.promptFragment ?? emotion.name.toLowerCase());

  const type = findOption(TYPE_OPTIONS, config.type);
  if (type) parts.push(type.promptFragment ?? type.name.toLowerCase());

  const schema = DNA_SCHEMAS[config.type];
  for (const field of schema.fields) {
    const id = config.dna[field.key];
    if (!id) continue;
    const o = findOption(field.options, id);
    if (o) parts.push(o.promptFragment ?? o.name.toLowerCase());
  }

  // Style 在最后注入（规格：Style 在 prompt 展开后注入）
  parts.push(GLOBAL_STYLE.promptFragment ?? GLOBAL_STYLE.name.toLowerCase());

  return parts.filter(Boolean).join(', ');
}
