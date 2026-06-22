/**
 * 扩写模型接口：把结构化配置展开成最终 image prompt。
 *
 *   - USE_EXPANDER=true  → 调用 apimart 的 gemini-3-flash-preview，把结构化配置
 *                          扩写成自然语言 image prompt
 *   - USE_EXPANDER=false → 本地 mock：按各层 promptFragment 直接拼（离线/兜底）
 *
 * 调用方（生成引擎/store）始终调 expandToPrompt(config, styles)，不感知实现切换。
 *
 * 安全约定：apimart key 不出现在前端，统一走同源 /apimart 代理注入。
 */

import type { AssetConfig, AssetOption } from '@/types/visualAsset';
import {
  EMOTION_OPTIONS,
  SUBJECT_OPTIONS,
  TYPE_OPTIONS,
  DNA_SCHEMAS,
  findOption,
} from '@/data/visualAssetCatalog';

/** 是否调用 apimart 扩写模型。 */
const USE_EXPANDER = true;

/** 同源代理基址（与 imageClient 一致）。 */
const APIMART_BASE = '/apimart';
/** 扩写用的文本模型。 */
const EXPANDER_MODEL = 'gemini-3-flash-preview';

/**
 * 把一条结构化配置展开成 image prompt。
 * @param config 生成引擎产出的结构化配置
 * @param styles 当前可用的自定义 style 列表（用于解析 style 片段）
 * @param signal 可选取消信号
 */
export async function expandToPrompt(
  config: AssetConfig,
  styles: AssetOption[] = [],
  signal?: AbortSignal,
): Promise<string> {
  if (USE_EXPANDER) {
    try {
      return await expandViaApimart(config, styles, signal);
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') throw e;
      // 扩写失败兜底：退回本地拼接，保证仍能出图
      console.warn('[expander] 扩写模型调用失败，回退本地拼接：', (e as Error).message);
      return expandMock(config, styles);
    }
  }
  return expandMock(config, styles);
}

/** 收集一条配置里各层的英文要素（供扩写模型/兜底拼接共用）。 */
function collectFragments(config: AssetConfig, styles: AssetOption[]): string[] {
  const parts: string[] = [];

  const emotion = findOption(EMOTION_OPTIONS, config.emotion);
  if (emotion) parts.push(emotion.promptFragment ?? emotion.name.toLowerCase());

  const subject = findOption(SUBJECT_OPTIONS, config.subject);
  if (subject && subject.promptFragment) parts.push(subject.promptFragment);

  const type = findOption(TYPE_OPTIONS, config.type);
  if (type) parts.push(type.promptFragment ?? type.name.toLowerCase());

  const schema = DNA_SCHEMAS[config.type];
  for (const field of schema.fields) {
    const id = config.dna[field.key];
    if (!id) continue;
    const o = findOption(field.options, id);
    if (o) parts.push(o.promptFragment ?? o.name.toLowerCase());
  }

  // Style 在最后注入；none / 未找到则不加
  const style = findOption(styles, config.style);
  if (style && style.promptFragment) parts.push(style.promptFragment);

  return parts.filter(Boolean);
}

/**
 * 调 apimart gemini-3-flash-preview 把结构化要素扩写成自然语言 image prompt。
 * 走 /v1/chat/completions（OpenAI 兼容格式）。
 */
async function expandViaApimart(
  config: AssetConfig,
  styles: AssetOption[],
  signal?: AbortSignal,
): Promise<string> {
  const fragments = collectFragments(config, styles);
  const userContent = [
    'Expand the following visual elements into ONE concise, vivid English image-generation prompt.',
    'Rules: output ONLY the prompt text, no quotes, no explanations, no line breaks; keep it under 80 words; preserve all given elements faithfully.',
    '',
    `Elements: ${fragments.join(', ')}`,
  ].join('\n');

  const res = await fetch(`${APIMART_BASE}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: EXPANDER_MODEL,
      messages: [
        {
          role: 'system',
          content:
            'You are a prompt engineer for image generation. You turn structured visual elements into a single polished English prompt.',
        },
        { role: 'user', content: userContent },
      ],
      temperature: 0.8,
    }),
    signal,
  });

  if (!res.ok) {
    const detail = await safeErrorMessage(res);
    throw new Error(detail || `扩写请求失败（${res.status}）`);
  }

  const json = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
    error?: { message?: string };
  };
  const text = json.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error(json.error?.message || '扩写返回为空');
  // 去掉可能的首尾引号与多余换行
  return text.replace(/^["'\s]+|["'\s]+$/g, '').replace(/\s*\n\s*/g, ', ');
}

/** 安全读取错误响应里的 message。 */
async function safeErrorMessage(res: Response): Promise<string> {
  try {
    const json = (await res.json()) as { error?: { message?: string } };
    return (json.error?.message ?? '').slice(0, 200);
  } catch {
    return '';
  }
}

/** 本地 mock：把各层片段直接拼成 prompt（离线/兜底）。 */
function expandMock(config: AssetConfig, styles: AssetOption[]): string {
  return collectFragments(config, styles).join(', ');
}
