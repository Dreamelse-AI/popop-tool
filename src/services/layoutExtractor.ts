import type { EffectMode, ExtractLayoutInput, LayoutRecipe } from '@/types/layout';
import { MAX_INPUT_LENGTH } from '@/types/layout';
import type { Background, GenerationOutput } from '@/types/catalog';
import { DEFAULT_MODE, EFFECT_CATALOG } from '@/data/effectCatalog';
import { PALETTE_LIBRARY } from '@/data/paletteLibrary';
import { getImage } from '@/data/imageLibrary';
import { randomizeParams, resolveStyle } from './params';
import { postLocal } from './apiClient';

/**
 * 是否使用后端模型抽取。
 * 由 VITE_USE_BACKEND_LAYOUT 控制（'true' 开启）；缺省走本地 mock，便于无后端时跑通链路。
 */
const USE_BACKEND = import.meta.env.VITE_USE_BACKEND_LAYOUT === 'true';

/**
 * 结构抽取：输入文字 → LayoutRecipe（效果 + 背景 + 区间随机参数 + 解析后的风格）。
 *
 * 两条实现，调用方无感：
 *   - mock（默认）：本地启发式按文字特征自动决策，仅用于跑通链路。
 *   - backend（VITE_USE_BACKEND_LAYOUT=true）：模型在生成文案时一并吐出 GenerationOutput
 *     （effectId/background），本函数校验离散项后由本地区间随机补齐数值参数。
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
    params: randomizeParams(out.effectId, input.seed),
    style: resolveStyle(out.background),
    background: out.background,
    source: 'model',
  };
}

/**
 * 校验并收敛后端输出，保证 effectId/background 都是库里合法值。
 * 任何字段非法都回退到安全默认，避免脏数据击穿渲染层。
 */
function normalizeOutput(raw: GenerationOutput): GenerationOutput {
  const effectId: EffectMode = EFFECT_CATALOG.some((e) => e.id === raw?.effectId)
    ? raw.effectId
    : DEFAULT_MODE;

  const background = normalizeBackground(raw?.background);

  return { text: raw?.text ?? '', effectId, background };
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
 * Mock 规则：按文字特征自动决策效果 / 配色，参数在该效果区间内随机。
 * 仅用于跑通链路与预览，真正的判定后续交给后端模型。
 */
function extractRecipeMock(input: ExtractLayoutInput): LayoutRecipe {
  const text = input.text.trim();
  const seed = input.seed ?? Math.floor(Math.random() * 9_999_999) + 1;

  const mode: EffectMode = input.preferredMode ?? recommendMode(text, seed);
  const background = input.preferredPaletteId
    ? ({ type: 'palette', paletteId: input.preferredPaletteId } as Background)
    : recommendBackground(text, seed);

  return {
    mode,
    params: randomizeParams(mode, seed),
    style: resolveStyle(background),
    background,
    source: 'mock',
  };
}

/** 极简启发式：短句偏泪水，多行偏弹幕，长段偏雨落。 */
function recommendMode(text: string, seed: number): EffectMode {
  const lines = text.split(/\n+/).map((l) => l.trim()).filter(Boolean);
  const lineCount = lines.length;
  const length = text.length;

  // 多段且每段较短 → 清单型 → 竖向分条
  const listish = lineCount >= 3 && lines.slice(1).every((l) => l.length <= 24);
  if (listish) return 'verticalList';

  // 金句/结论型短句（含引号或很短的单段）→ 拉引文
  if (lineCount <= 2 && (/["“”『』]/.test(text) || length <= 16)) return 'pullQuote';

  // 标题型：单段、6-24 字、无明显句读 → 杂志封面
  if (lineCount <= 2 && length <= 24 && !/[。！？，；]/.test(text)) return 'magazineCover';

  if (length <= 20 && lineCount <= 2) return 'tearBlur';
  if (lineCount >= 3) return 'barrage';
  if (length >= 80) return 'rain';
  // 其余按 seed 在雨落/弹幕间分流，避免总是同一种
  return seed % 2 === 0 ? 'rain' : DEFAULT_MODE;
}

/** 启发式：按情绪词在配色库里粗选一类，命中多套时按 seed 选其一；无命中则全库随机。 */
function recommendBackground(text: string, seed: number): Background {
  const moodRules: { test: RegExp; mood: RegExp }[] = [
    { test: /[爱心恋暖温柔]/, mood: /温暖|爱意|浪漫|温柔/ },
    { test: /[夜孤独思念静]/, mood: /孤独|思念|安静|深夜/ },
    { test: /[梦星愿浪漫]/, mood: /浪漫|梦幻|宇宙/ },
    { test: /[快乐阳光元气自由]/, mood: /快乐|积极|元气|自由/ },
    { test: /[成长远方未来希望]/, mood: /成长|远方|未来|希望/ },
  ];

  const hit = moodRules.find((r) => r.test.test(text));
  const pool = hit
    ? PALETTE_LIBRARY.filter((p) => hit.mood.test(p.mood))
    : PALETTE_LIBRARY;
  const list = pool.length ? pool : PALETTE_LIBRARY;
  const id = list[seed % list.length].id;
  return { type: 'palette', paletteId: id };
}
