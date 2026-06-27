/**
 * 配色命名 + 双方案情绪词生成（apimart 文本模型）。
 *
 * 输入：canvas 提取出的主色 hex 数组 + 两套方案的底色（用于分别定情绪）。
 * 输出：英文连字符 id、中文名字（≤4 字）、两套方案各自的情绪词。
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
  /** 两套方案各自的名字（[方案A, 方案B]，均 ≤4 字） */
  names: [string, string];
  /** 两套方案各自的情绪词（[方案A, 方案B]） */
  moods: [string, string];
}

/**
 * 给一组主色起名，并为两套方案分别定名字与情绪词。
 * @param colors 主色 hex 数组（占比从高到低）
 * @param schemeBgColors 两套方案的底色 [A, B]，让命名/情绪贴合各自基调
 * @param signal 可选取消信号
 */
export async function nameColors(
  colors: string[],
  schemeBgColors: [string, string],
  signal?: AbortSignal,
): Promise<NamingResult> {
  try {
    return await nameViaApimart(colors, schemeBgColors, signal);
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') throw e;
    console.warn('[palette-namer] AI 命名失败，回退本地规则：', (e as Error).message);
    return nameMock(colors);
  }
}

async function nameViaApimart(
  colors: string[],
  schemeBgColors: [string, string],
  signal?: AbortSignal,
): Promise<NamingResult> {
  const userContent = [
    '你是一名擅长起名的色彩创意总监，专门给配色起「让人眼前一亮、有记忆点」的中文名。',
    '同一组颜色有两套配色方案：方案A 以颜色1为底，方案B 以颜色2为底，基调不同，各自独立命名与定情绪。',
    '命名风格：',
    '- 要有想象力和画面感，用具体意象、通感或巧妙的小联想，让人一看就有感觉、能记住。',
    '- 好懂但不平庸：避免「颜色+情绪」这种公式化拼接（如「暖橘活力」「蓝色安静」太普通，不要这样起）。',
    '- 不堆砌古风辞藻、不用生僻字、不故作高深；像给一款产品色或一杯特调起名那样，鲜活、有生活气。',
    '- 可以借助场景、食物、天气、时间、地点、情境来联想，但最终要凝练成最多 4 个字。',
    '参考方向（仅示意「有想象力」的感觉，不要直接照抄）：落日汽水、深海打烊、清晨第一口、薄荷暴击、热带午睡、电量告急、奶油暴风雪。',
    '严格只返回一个 JSON 对象，不要任何解释、不要 markdown 代码块包裹。JSON 字段：',
    '- "id": 英文小写连字符 slug（2-4 个单词，如 "sunset-soda-pop"），只含 a-z 0-9 和连字符。',
    '- "nameA": 方案A（底色 ' + schemeBgColors[0] + '）的中文名字，最多 4 字，有想象力、有记忆点。绝不超过 4 字。',
    '- "nameB": 方案B（底色 ' + schemeBgColors[1] + '）的中文名字，最多 4 字，有想象力、有记忆点。绝不超过 4 字。',
    '- "moodA": 方案A 的情绪词，2-4 个中文词用「、」分隔。',
    '- "moodB": 方案B 的情绪词，2-4 个中文词用「、」分隔。',
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
            'You are a creative color director who gives palettes short, vivid, memorable Chinese names (max 4 characters) full of imagination, imagery, and clever associations. Keep them easy to understand and lively (like naming a product color or a signature drink); avoid generic "color + emotion" templates, archaic poetic clichés, and obscure characters. You always reply with a single valid JSON object and nothing else.',
        },
        { role: 'user', content: userContent },
      ],
      temperature: 1.05,
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
  const nameA =
    typeof obj.nameA === 'string' && obj.nameA.trim() ? clampName(obj.nameA.trim()) : fallback.names[0];
  const nameB =
    typeof obj.nameB === 'string' && obj.nameB.trim() ? clampName(obj.nameB.trim()) : nameA;
  const moodA =
    typeof obj.moodA === 'string' && obj.moodA.trim() ? obj.moodA.trim() : fallback.moods[0];
  const moodB =
    typeof obj.moodB === 'string' && obj.moodB.trim() ? obj.moodB.trim() : moodA;
  return {
    id: id || fallback.id,
    names: [nameA, nameB],
    moods: [moodA, moodB],
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
    names: ['未命名', '未命名'],
    moods: ['中性', '中性'],
  };
}
