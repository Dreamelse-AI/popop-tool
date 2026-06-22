import type { EffectMode, ExtractLayoutInput, LayoutRecipe } from '@/types/layout';
import { MAX_INPUT_LENGTH } from '@/types/layout';
import type { Background } from '@/types/catalog';
import { DEFAULT_MODE } from '@/data/effectCatalog';
import { PALETTE_LIBRARY } from '@/data/paletteLibrary';
import { randomizeParams, resolveStyle } from './params';
// import { postLocal } from './apiClient'; // 后端接入后启用

/** 是否使用后端模型抽取。后端就绪后置 true（或读环境变量）。 */
const USE_BACKEND = false;

/**
 * 结构抽取：输入文字 → LayoutRecipe（效果 + 区间随机参数 + 解析后的风格）。
 *
 * 当前为本地 mock 规则，仅按文字特征推荐效果/配色，参数在区间内随机，不调用模型生产内容。
 * 后端接上后：模型在生成文案时一并吐出 GenerationOutput（effectId/background/shapeId），
 * 本函数把它解析成 LayoutRecipe（参数仍由本地区间随机补齐），调用方不变。
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
 * 约定：后端返回 GenerationOutput，本函数据此 resolveStyle + randomizeParams。
 */
async function extractRecipeFromBackend(_input: ExtractLayoutInput): Promise<LayoutRecipe> {
  // const out = await postLocal<ExtractLayoutInput, GenerationOutput>('/layout/extract', _input);
  // return {
  //   mode: out.effectId,
  //   params: randomizeParams(out.effectId, undefined, out.shapeId ? { fillShape: out.shapeId } : undefined),
  //   style: resolveStyle(out.background),
  //   source: 'model',
  // };
  throw new Error('后端抽取尚未接入');
}

/**
 * Mock 规则：按文字特征推荐效果与配色，参数在该效果区间内随机。
 * 仅用于跑通链路与预览，真正的判定后续交给后端模型。
 */
function extractRecipeMock(input: ExtractLayoutInput): LayoutRecipe {
  const text = input.text.trim();
  const mode: EffectMode = input.preferredMode ?? recommendMode(text);
  const background = recommendBackground(text);

  return {
    mode,
    params: randomizeParams(mode),
    style: resolveStyle(background),
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

/** 极简启发式：按情绪词粗选配色，命中不到则用第一套。 */
function recommendBackground(text: string): Background {
  const warm = /[爱暖心温柔家阳光希望]/.test(text);
  const id = warm
    ? (PALETTE_LIBRARY.find((p) => /暖|温/.test(p.mood))?.id ?? PALETTE_LIBRARY[0].id)
    : PALETTE_LIBRARY[0].id;
  return { type: 'palette', paletteId: id };
}
