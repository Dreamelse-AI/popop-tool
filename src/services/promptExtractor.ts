/**
 * 提示词提取服务（apimart 多模态模型）。
 *
 * 输入：一张图片（base64 data URI 或公网 URL）。
 * 输出：内容提示词（主体/场景/动作/氛围，不含风格）+ 关键画风提示词（媒介/技法/线条/光影/
 *       色彩/质感等可迁移要素，供后续画风工具复用）。
 *
 * 设计：把图片拆成「内容」与「风格」两块互不重叠的要素，由调用方拼接成完整提示词
 *       （完整提示词 = 内容 + 风格），保证完整提示词必然包含风格词，不再出现两者措辞不一致。
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

/** 提取结果：内容与风格两块互不重叠的要素。 */
export interface ExtractResult {
  /** 内容提示词：主体 / 场景 / 动作 / 表情 / 氛围，不含任何画风描述。 */
  contentPrompt: string;
  /** 关键画风提示词：媒介 / 技法 / 线条 / 光影 / 色彩 / 质感等可迁移要素，不含具体主体内容。 */
  stylePrompt: string;
}

/**
 * 拼接内容词与风格词为完整提示词（完整 = 内容 + 风格）。
 * 单一拼接口径，service / store / 页面预览共用，保证三处一致。
 */
export function buildFullPrompt(contentPrompt: string, stylePrompt: string): string {
  return [contentPrompt.trim(), stylePrompt.trim()].filter(Boolean).join('\n\n');
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
    'Analyze the attached image carefully and split it into two NON-OVERLAPPING parts.',
    'Return STRICTLY a single JSON object, no markdown, no explanation.',
    'JSON fields:',
    '- "contentPrompt": the SUBJECT and SCENE only — who/what is in the image, their appearance,',
    '  pose, expression, action, objects, background and overall mood. Be specific and faithful',
    '  (concrete nouns and details you can actually see). Do NOT describe any art style, medium,',
    '  rendering technique, brush stroke, line work, color grading or aesthetic here.',
    '  Do NOT mention aspect ratio, framing or camera crop.',
    '- "stylePrompt": the transferable VISUAL STYLE only — art medium (e.g. watercolor, 3D render,',
    '  flat vector), rendering technique, line and shading, color palette/grading, texture, lighting',
    '  treatment and overall aesthetic. Describe it so it can be reused on a completely different subject.',
    '  Exclude the specific subject/content. Keep it concise (under 60 words).',
    'Both fields must be in English. The two parts must NOT repeat each other.',
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
      temperature: 0.3,
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
  const content = typeof obj.contentPrompt === 'string' ? obj.contentPrompt.trim() : '';
  const style = typeof obj.stylePrompt === 'string' ? obj.stylePrompt.trim() : '';
  if (!content && !style) throw new Error('分析结果为空，请重试');
  return {
    contentPrompt: content || style,
    stylePrompt: style,
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
