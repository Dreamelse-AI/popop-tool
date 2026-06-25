/**
 * 文本扩写服务：把「基础元素 + 题材类型 + 风格提示词」整理扩写成一句可直接出图的
 * 英文 image prompt。
 *
 *   - 走 apimart 同源代理的 /v1/chat/completions（OpenAI 兼容），模型 gemini-3-flash-preview
 *   - 失败自动回退本地拼接（逗号连接），保证不阻断出图，并用 via 标记区分来源
 *
 * 安全约定：apimart key 不出现在前端，统一走同源 /apimart 代理注入。
 */

/** 同源代理基址（与 imageClient / promptExpander 一致）。 */
const APIMART_BASE = '/apimart';
/** 整理扩写用的文本模型。 */
const EXPANDER_MODEL = 'gemini-3-flash-preview';

/** 扩写来源：llm = 真实模型扩写成功；mock = 模型失败/未启用，本地拼接兜底。 */
export type ExpandVia = 'llm' | 'mock';

/** 扩写结果：prompt 文本 + 来源标记（便于 UI 区分真扩写/兜底）。 */
export interface ExpandResult {
  prompt: string;
  via: ExpandVia;
}

/** 一条待扩写的内容要素。 */
export interface PromptParts {
  /** 基础元素（单个内容，如某个人名 / 歌曲名）。 */
  element: string;
  /** 题材类型（如「人物形象」「音乐封面」）。 */
  subject: string;
  /** 风格提示词。 */
  style: string;
}

/** 本地拼接：把三部分去空后用逗号连接（离线/兜底）。 */
export function joinParts(parts: PromptParts): string {
  return [parts.subject, parts.element, parts.style]
    .map((s) => s.trim())
    .filter(Boolean)
    .join(', ');
}

/**
 * 整理并扩写成一句 image prompt。
 * @param parts 基础元素 / 题材 / 风格
 * @param useExpander 是否调用模型整理扩写（false 时直接本地拼接）
 * @param signal 可选取消信号
 */
export async function expandTextToPrompt(
  parts: PromptParts,
  useExpander: boolean,
  signal?: AbortSignal,
): Promise<ExpandResult> {
  if (!useExpander) {
    return { prompt: joinParts(parts), via: 'mock' };
  }
  try {
    const prompt = await expandViaApimart(parts, signal);
    return { prompt, via: 'llm' };
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') throw e;
    console.warn('[text-expander] 整理扩写失败，回退本地拼接：', (e as Error).message);
    return { prompt: joinParts(parts), via: 'mock' };
  }
}

/** 调 apimart 文本模型，把内容要素整理扩写成自然语言英文 image prompt。 */
async function expandViaApimart(parts: PromptParts, signal?: AbortSignal): Promise<string> {
  const lines = [`Subject type: ${parts.subject.trim() || '(unspecified)'}`, `Core element: ${parts.element.trim()}`];
  if (parts.style.trim()) lines.push(`Style hints: ${parts.style.trim()}`);

  const userContent = [
    'Organize the following elements into ONE concise, vivid English image-generation prompt.',
    'Rules:',
    '- Output ONLY the prompt text, no quotes, no explanations, no line breaks.',
    '- Keep it under 80 words; faithfully reflect the core element and subject type.',
    '- The core element is the main subject of the image; build the scene around it.',
    '- Describe ONLY subject, scene content, mood, lighting, color and texture.',
    '- Do NOT mention any composition, framing, shot type, camera angle, crop, orientation or aspect ratio',
    '  (e.g. avoid words like close-up, wide shot, portrait, landscape, vertical, horizontal, full body, headshot).',
    '  The output dimensions are controlled separately.',
    '',
    lines.join('\n'),
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
            'You are a prompt engineer for image generation. You turn a core element plus a subject type and style hints into a single polished English prompt. You never describe composition, framing, shot type, camera angle or aspect ratio — only the scene content and atmosphere.',
        },
        { role: 'user', content: userContent },
      ],
      temperature: 0.8,
      stream: false,
    }),
    signal,
  });

  if (!res.ok) {
    const detail = await safeErrorMessage(res);
    throw new Error(detail || `整理扩写请求失败（${res.status}）`);
  }

  const raw = await res.text();
  const text = parseCompletionText(raw);
  if (!text) throw new Error('整理扩写返回为空');
  return text.replace(/^["'\s]+|["'\s]+$/g, '').replace(/\s*\n\s*/g, ', ');
}

interface ChatCompletionChunk {
  choices?: Array<{
    message?: { content?: string };
    delta?: { content?: string };
  }>;
  error?: { message?: string };
}

/** 兼容标准 JSON 与 SSE 流两种响应，取出补全内容。 */
function parseCompletionText(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.startsWith('{')) {
    try {
      const json = JSON.parse(trimmed) as ChatCompletionChunk;
      const t = json.choices?.[0]?.message?.content?.trim();
      if (t) return t;
      if (json.error?.message) throw new Error(json.error.message);
    } catch {
      // 落到 SSE 解析
    }
  }
  let acc = '';
  for (const line of trimmed.split('\n')) {
    const s = line.trim();
    if (!s.startsWith('data:')) continue;
    const payload = s.slice(5).trim();
    if (!payload || payload === '[DONE]') continue;
    try {
      const chunk = JSON.parse(payload) as ChatCompletionChunk;
      const piece = chunk.choices?.[0]?.delta?.content ?? chunk.choices?.[0]?.message?.content ?? '';
      acc += piece;
    } catch {
      // 跳过无法解析的行
    }
  }
  return acc.trim();
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
