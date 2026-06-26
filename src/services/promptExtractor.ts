/**
 * 提示词提取服务（apimart 多模态模型）。
 *
 * 输入：一张图片（base64 data URI 或公网 URL）。
 * 输出：完整提示词（用于复刻整张图）+ 关键画风提示词（剥离主体内容、只保留风格/媒介/光影/色彩/质感，
 *       供后续画风工具复用）。
 *
 * 安全：apimart key 不出现在前端，统一走同源 /apimart 代理注入（与 imageClient / promptExpander 一致）。
 * 失败兜底：无法解析时抛错，由 store 落到该组 error 态，用户可单独重试。
 */

/** 同源代理基址（与其它 service 一致）。 */
const APIMART_BASE = '/apimart';

/**
 * 图像理解模型。apimart 走 OpenAI 兼容 /v1/chat/completions，content 用多模态数组。
 * gemini 系多模态支持图片输入；如该型号不收图，改成 gpt-4o 等多模态型号即可。
 */
const VISION_MODEL = 'gemini-3-flash-preview';

/** 提取结果。 */
export interface ExtractResult {
  /** 完整提示词：尽可能完整复刻整张图（主体 + 场景 + 风格 + 光影 + 色彩 + 构图之外的内容）。 */
  fullPrompt: string;
  /** 关键画风提示词：只含风格/媒介/光影/色彩/质感等可迁移要素，不含具体主体内容。 */
  stylePrompt: string;
}

/**
 * 分析一张图片，提取完整提示词与关键画风提示词。
 * @param imageUrl base64 data URI 或公网图片 URL
 * @param signal 可选取消信号
 */
export async function extractPromptsFromImage(
  imageUrl: string,
  signal?: AbortSignal,
): Promise<ExtractResult> {
  const userText = [
    'You are an expert prompt engineer for text-to-image models.',
    'Analyze the attached image and return STRICTLY a single JSON object, no markdown, no explanation.',
    'JSON fields:',
    '- "fullPrompt": one detailed English image-generation prompt that would faithfully recreate this image.',
    '  Cover subject, scene, mood, lighting, color and texture. Do NOT mention aspect ratio, framing or camera crop.',
    '- "stylePrompt": ONLY the transferable visual style — art medium, rendering technique, line/shading,',
    '  color palette, texture and overall aesthetic. Exclude the specific subject/content so it can be reused',
    '  on other subjects. Keep it concise (under 60 words), English.',
  ].join('\n');

  const res = await fetch(`${APIMART_BASE}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: VISION_MODEL,
      messages: [
        {
          role: 'system',
          content:
            'You are a senior prompt engineer for image generation. You always reply with a single valid JSON object and nothing else.',
        },
        {
          role: 'user',
          content: [
            { type: 'text', text: userText },
            { type: 'image_url', image_url: { url: imageUrl } },
          ],
        },
      ],
      temperature: 0.5,
      stream: false,
    }),
    signal,
  });

  if (!res.ok) {
    const detail = await safeErrorMessage(res);
    throw new Error(detail || `分析请求失败（${res.status}）`);
  }

  const raw = await res.text();
  const text = parseCompletionText(raw);
  if (!text) throw new Error('分析返回为空');
  return normalize(parseJsonLoose(text));
}

/** chat/completions 响应体（OpenAI 兼容）。 */
interface ChatCompletionChunk {
  choices?: Array<{
    message?: { content?: string };
    delta?: { content?: string };
  }>;
  error?: { message?: string };
}

/** 兼容标准 JSON 与 SSE 流，取出补全文本。 */
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
      acc += chunk.choices?.[0]?.delta?.content ?? chunk.choices?.[0]?.message?.content ?? '';
    } catch {
      // 跳过无法解析的行
    }
  }
  return acc.trim();
}

/** 从可能含多余文本的输出里抠出第一个 JSON 对象并解析。 */
function parseJsonLoose(text: string): Record<string, unknown> {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) {
    throw new Error('分析结果不是合法 JSON');
  }
  return JSON.parse(text.slice(start, end + 1)) as Record<string, unknown>;
}

/** 把模型输出规整成 ExtractResult，缺字段时互相兜底，保证两字段都非空。 */
function normalize(obj: Record<string, unknown>): ExtractResult {
  const full = typeof obj.fullPrompt === 'string' ? obj.fullPrompt.trim() : '';
  const style = typeof obj.stylePrompt === 'string' ? obj.stylePrompt.trim() : '';
  if (!full && !style) throw new Error('分析结果为空，请重试');
  return {
    fullPrompt: full || style,
    stylePrompt: style || full,
  };
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
