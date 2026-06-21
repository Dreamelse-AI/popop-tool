import type { EffectMode, ExtractLayoutInput, LayoutRecipe } from '@/types/layout';
import { MAX_INPUT_LENGTH } from '@/types/layout';
import { DEFAULT_MODE, getPreset } from '@/data/effectPresets';
// import { postLocal } from './apiClient'; // 后端接入后启用

/** 是否使用后端模型抽取。后端就绪后置 true（或读环境变量）。 */
const USE_BACKEND = false;

/**
 * 结构抽取：输入文字 → LayoutRecipe（特效模式 + 参数）。
 *
 * 当前为本地 mock 规则，仅按文字特征推荐模式并给默认参数，不调用模型生产内容。
 * 后端接上后切到 extractRecipeFromBackend，调用方不变。
 */
export async function extractLayout(input: ExtractLayoutInput): Promise<LayoutRecipe> {
  const text = input.text.trim();
  if (!text) {
    throw new Error('输入文字为空');
  }
  if (text.length > MAX_INPUT_LENGTH) {
    throw new Error(`输入超过 ${MAX_INPUT_LENGTH} 字上限`);
  }

  if (USE_BACKEND) {
    return extractRecipeFromBackend(input);
  }
  return extractRecipeMock(input);
}

/**
 * 后端模型抽取（占位）。后端就绪后实现并把 USE_BACKEND 置 true。
 * 约定后端返回的 JSON 直接符合 LayoutRecipe（source: 'model'）。
 */
async function extractRecipeFromBackend(_input: ExtractLayoutInput): Promise<LayoutRecipe> {
  // return postLocal<ExtractLayoutInput, LayoutRecipe>('/layout/extract', _input);
  throw new Error('后端抽取尚未接入');
}

/**
 * Mock 规则：按文字长度/换行等粗略特征推荐一个特效模式，给出预设参数。
 * 仅用于跑通链路与预览，真正的判定后续交给后端模型。
 */
function extractRecipeMock(input: ExtractLayoutInput): LayoutRecipe {
  const text = input.text.trim();
  const mode: EffectMode = input.preferredMode ?? recommendMode(text);
  const preset = getPreset(mode);

  return {
    mode,
    params: { ...preset.params },
    source: 'mock',
  };
}

/** 极简启发式：短句偏泪水，多行偏弹幕，长段偏雨落。 */
function recommendMode(text: string): EffectMode {
  const lineCount = text.split(/\n+/).filter((l) => l.trim()).length;
  const length = text.length;

  if (length <= 20 && lineCount <= 2) return 'tearBlur';
  if (lineCount >= 3) return 'barrage';
  if (length >= 80) return 'rain';
  return DEFAULT_MODE;
}
