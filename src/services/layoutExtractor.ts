import type { EffectMode, ExtractLayoutInput, FillShape, LayoutRecipe } from '@/types/layout';
import { MAX_INPUT_LENGTH } from '@/types/layout';
import type { Background, GenerationOutput } from '@/types/catalog';
import { DEFAULT_MODE, EFFECT_CATALOG } from '@/data/effectCatalog';
import { PALETTE_LIBRARY } from '@/data/paletteLibrary';
import { getImage } from '@/data/imageLibrary';
import { randomizeParams, resolveStyle } from './params';
import { postLocal } from './apiClient';

const VALID_SHAPES: FillShape[] = ['heart', 'star', 'circle', 'diamond', 'image'];

/**
 * 是否使用后端模型抽取。
 * 由 VITE_USE_BACKEND_LAYOUT 控制（'true' 开启）；缺省走本地 mock，便于无后端时跑通链路。
 */
const USE_BACKEND = import.meta.env.VITE_USE_BACKEND_LAYOUT === 'true';

/**
 * 结构抽取：输入文字 → LayoutRecipe（效果 + 背景 + 形状 + 区间随机参数 + 解析后的风格）。
 *
 * 两条实现，调用方无感：
 *   - mock（默认）：本地启发式按文字特征自动决策，仅用于跑通链路。
 *   - backend（VITE_USE_BACKEND_LAYOUT=true）：模型在生成文案时一并吐出 GenerationOutput
 *     （effectId/background/shapeId），本函数校验离散项后由本地区间随机补齐数值参数。
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
 * 后端模型抽取：调本地后端拿 GenerationOutput，校验离散项后解析为 LayoutRecipe。
 * 数值参数仍由本地区间随机补齐（模型不输出数值）。
 */
async function extractRecipeFromBackend(input: ExtractLayoutInput): Promise<LayoutRecipe> {
  const raw = await postLocal<ExtractLayoutInput, GenerationOutput>('/layout/extract', input);
  const out = normalizeOutput(raw);

  return {
    mode: out.effectId,
    params: randomizeParams(out.effectId, input.seed, out.shapeId ? { fillShape: out.shapeId } : undefined),
    style: resolveStyle(out.background),
    background: out.background,
    shape: out.shapeId,
    source: 'model',
  };
}

/**
 * 校验并收敛后端输出，保证 effectId/background/shapeId 都是库里合法值。
 * 任何字段非法都回退到安全默认，避免脏数据击穿渲染层。
 */
function normalizeOutput(raw: GenerationOutput): GenerationOutput {
  const effectId: EffectMode = EFFECT_CATALOG.some((e) => e.id === raw?.effectId)
    ? raw.effectId
    : DEFAULT_MODE;

  const background = normalizeBackground(raw?.background);

  let shapeId: FillShape | undefined;
  if (effectId === 'imageFill') {
    shapeId = VALID_SHAPES.includes(raw?.shapeId as FillShape) ? raw.shapeId : 'heart';
  }

  return { text: raw?.text ?? '', effectId, background, shapeId };
}

/** 背景校验：palette/image 二选一，id 不在库里则回退第一套配色。 */
function normalizeBackground(bg: Background | undefined): Background {
  if (bg?.type === 'image' && getImage(bg.imageId)) {
    return bg;
  }
  if (bg?.type === 'palette' && PALETTE_LIBRARY.some((p) => p.id === bg.paletteId)) {
    return bg;
  }
  return { type: 'palette', paletteId: PALETTE_LIBRARY[0].id };
}

/**
 * Mock 规则：按文字特征自动决策效果 / 配色 / 形状，参数在该效果区间内随机。
 * 仅用于跑通链路与预览，真正的判定后续交给后端模型。
 */
function extractRecipeMock(input: ExtractLayoutInput): LayoutRecipe {
  const text = input.text.trim();
  const seed = input.seed ?? Math.floor(Math.random() * 9_999_999) + 1;

  const mode: EffectMode = input.preferredMode ?? recommendMode(text, seed);
  const background = recommendBackground(text);
  const shape = mode === 'imageFill' ? recommendShape(text, seed) : undefined;

  return {
    mode,
    params: randomizeParams(mode, seed, shape ? { fillShape: shape } : undefined),
    style: resolveStyle(background),
    background,
    shape,
    source: 'mock',
  };
}

/** 极简启发式：短句偏泪水，多行偏弹幕，长段偏雨落，主题鲜明偏填充。 */
function recommendMode(text: string, seed: number): EffectMode {
  const lineCount = text.split(/\n+/).filter((l) => l.trim()).length;
  const length = text.length;

  // 含强情绪/具象意象的短文案 → 图片填充
  if (length <= 30 && /[爱心梦星愿]/.test(text)) return 'imageFill';
  if (length <= 20 && lineCount <= 2) return 'tearBlur';
  if (lineCount >= 3) return 'barrage';
  if (length >= 80) return 'rain';
  // 其余按 seed 在雨落/弹幕间分流，避免总是同一种
  return seed % 2 === 0 ? 'rain' : DEFAULT_MODE;
}

/** 极简启发式：按情绪词粗选配色，命中不到则用第一套。 */
function recommendBackground(text: string): Background {
  const warm = /[爱暖心温柔家阳光希望]/.test(text);
  const id = warm
    ? (PALETTE_LIBRARY.find((p) => /暖|温/.test(p.mood))?.id ?? PALETTE_LIBRARY[0].id)
    : PALETTE_LIBRARY[0].id;
  return { type: 'palette', paletteId: id };
}

/** 极简启发式：按关键词选形状，命中不到按 seed 兜底。 */
function recommendShape(text: string, seed: number): FillShape {
  if (/[爱心恋]/.test(text)) return 'heart';
  if (/[星愿梦]/.test(text)) return 'star';
  const fallback: FillShape[] = ['circle', 'diamond', 'heart', 'star'];
  return fallback[seed % fallback.length];
}
