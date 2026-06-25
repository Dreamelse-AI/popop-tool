/**
 * 配色命名 + 情绪词生成（apimart 文本模型）。
 *
 * 输入：canvas 提取出的主色 hex 数组。
 * 输出：英文连字符 id、中文名字（≤4 字）、情绪词。
 *
 * 安全：apimart key 不出现在前端，统一走同源 /apimart 代理注入（与 promptExpander 一致）。
 * 失败兜底：模型不可用时退回本地规则命名，保证离线/异常下流程不断。
 */

/** 同源代理基址。 */
const APIMART_BASE = '/apimart';
/** 命名用的文本模型（与扩写一致，速度快、便宜）。 */
const NAMER_MODEL = 'gemini-3-flash-preview';

/** AI 命名返回结构。 */
export interface NamingResult {
  id: string;
  name: string;
  mood: string;
}

/**
 * 给一组主色起名、定情绪词。
 * @param colors 主色 hex 数组（占比从高到低）
 * @param signal 可选取消信号
 */
export async function nameColors(
  colors: string[],
  signal?: AbortSignal,
): Promise<NamingResult> {
  try {
    return await nameViaApimart(colors, signal);
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') throw e;
    console.warn('[palette-namer] AI 命名失败，回退本地规则：', (e as Error).message);
    return nameMock(colors);
  }
}

async function nameViaApimart(
  colors: string[],
  signal?: AbortSignal,
): Promise<NamingResult> {
  const userContent = [
    '你是一名资深品牌视觉与色彩设计师。根据给定的主色板，输出一个配色方案的命名与情绪词。',
    '严格只返回一个 JSON 对象，不要任何解释、不要 markdown 代码块包裹。JSON 字段：',
    '- "id": 英文小写连字符 slug（2-4 个单词，如 "warm-dusk-glow"），只含 a-z 0-9 和连字符。',
    '- "name": 中文名字，最多 4 个字，富有画面感（如「暮色微醺」「青苔」）。绝不超过 4 字。',
    '- "mood": 情绪词，2-4 个中文词用「、」分隔（如「温暖、慵懒、治愈」）。',
    '',
    `主色板（hex，按占比从高到低）：${colors.join(', ')}`,
  ].join('\n');

  const res = await fetch(`${APIMART_BASE}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: NAMER_MODEL,
      messages: [
        {
          role: 'system',
          content:
            'You are a senior color and brand designer who names color palettes. You always reply with a single valid JSON object and nothing else.',
        },
        { role: 'user', content: userContent },
      ],
      temperature: 0.9,
      stream: false,
    }),
    signal,
  });

  if (!res.ok) {
    const detail = await safeErrorMessage(res);
    throw new Error(detail || `命名请求失败（${res.status}）`);
  }

  const raw = await res.text();
  const text = parseCompletionText(raw);
  if (!text) throw new Error('命名返回为空');
  return normalize(parseJsonLoose(text), colors);
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
    throw new Error('命名结果不是合法 JSON');
  }
  return JSON.parse(text.slice(start, end + 1)) as Record<string, unknown>;
}

/** id 规整：转小写、非法字符换连字符、去重连字符与首尾连字符。 */
function slugify(raw: string): string {
  const s = raw
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return s.slice(0, 48);
}

/** 把 AI 输出规整成 NamingResult，缺字段用兜底补齐；name 强制截到 4 字。 */
function normalize(obj: Record<string, unknown>, colors: string[]): NamingResult {
  const fallback = nameMock(colors);
  const id = typeof obj.id === 'string' && obj.id.trim() ? slugify(obj.id) : fallback.id;
  const rawName =
    typeof obj.name === 'string' && obj.name.trim() ? obj.name.trim() : fallback.name;
  return {
    id: id || fallback.id,
    name: clampName(rawName),
    mood: typeof obj.mood === 'string' && obj.mood.trim() ? obj.mood.trim() : fallback.mood,
  };
}

/** 名字最多 4 个字：用 Intl 分段按「字」截断，兼容中英混排，去掉尾随标点。 */
function clampName(name: string): string {
  const chars = Array.from(name.replace(/\s+/g, ''));
  const clamped = chars.slice(0, 4).join('');
  return clamped.replace(/[。、，,.!！]+$/, '') || name.slice(0, 4);
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

/** 本地规则兜底：给一个占位命名，保证流程不断（颜色信息留给用户自行补充）。 */
function nameMock(_colors: string[]): NamingResult {
  const suffix = Math.random().toString(36).slice(2, 6);
  return {
    id: `palette-${suffix}`,
    name: '未命名',
    mood: '中性',
  };
}
