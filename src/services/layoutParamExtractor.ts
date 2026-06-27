/**
 * 排版参数提取服务（apimart 多模态视觉模型）。
 *
 * 输入：一张图片（base64 data URI 或公网 URL）。
 * 输出：一套结构化排版参数模版 LayoutParamTemplate —— 只描述「文字如何排布」，
 *       不含文字内容、不含背景/背景色（背景单独成块，后续组合）。
 *
 * 安全：apimart key 不出现在前端，统一走同源 /apimart 代理注入
 *       （与 promptExtractor / imageClient 一致）。
 * 兜底：模型输出经 normalize 收敛为合法值，缺字段补默认，保证返回结构稳定可渲染。
 */

import type {
  Anchor,
  CanvasParam,
  FontKind,
  LayoutParamTemplate,
  RhythmParam,
  TextAlign,
  TextBlockParam,
  TextRole,
  TextTransform,
  WritingMode,
} from '@/types/layoutParam';

/** 同源代理基址（与其它 service 一致）。 */
const APIMART_BASE = '/apimart';

/** 图像理解模型（OpenAI 兼容 chat/completions，多模态 content 数组）。 */
const VISION_MODEL = 'gemini-3-flash-preview';

/** 合法枚举集合（用于收敛模型输出）。 */
const FONT_KINDS: FontKind[] = ['serif', 'sans', 'mono'];
const TEXT_ROLES: TextRole[] = [
  'kicker',
  'title',
  'subtitle',
  'body',
  'caption',
  'pageNumber',
  'signature',
];
const TEXT_ALIGNS: TextAlign[] = ['left', 'center', 'right', 'justify'];
const ANCHORS: Anchor[] = [
  'top-left',
  'top-center',
  'top-right',
  'center-left',
  'center',
  'center-right',
  'bottom-left',
  'bottom-center',
  'bottom-right',
];
const WRITING_MODES: WritingMode[] = ['horizontal', 'vertical'];
const TEXT_TRANSFORMS: TextTransform[] = ['none', 'uppercase', 'lowercase', 'capitalize'];

/** 给模型的 JSON 输出约定（与 LayoutParamTemplate 对应）。 */
const SCHEMA_HINT = `Return STRICTLY one JSON object (no markdown, no comments) with this exact shape:
{
  "name": "string, a short Chinese name capturing the layout's temperament (<= 12 chars)",
  "vibe": "string, one Chinese sentence describing where this layout fits / its mood",
  "canvas": {
    "ratio": "e.g. '4:3' '3:4' '1:1' '9:16'",
    "referenceWidth": number (px, e.g. 1080),
    "referenceHeight": number (px),
    "padding": number (px, safe inner margin),
    "gridColumns": number (1 if no grid),
    "blockGap": number (px, vertical gap between blocks)
  },
  "blocks": [
    {
      "role": "kicker|title|subtitle|body|caption|pageNumber|signature",
      "fontKind": "serif|sans|mono",
      "fontSize": number (px on the reference canvas),
      "fontWeight": number (100-900),
      "lineHeight": number (multiplier, e.g. 1.2),
      "letterSpacing": number (em, can be negative),
      "textAlign": "left|center|right|justify",
      "anchor": "top-left|top-center|top-right|center-left|center|center-right|bottom-left|bottom-center|bottom-right",
      "writingMode": "horizontal|vertical",
      "textTransform": "none|uppercase|lowercase|capitalize",
      "maxCharsPerLine": number,
      "maxLines": number,
      "rotation": number (deg, 0 if none),
      "offsetYPercent": number (0-100, optional)
    }
  ],
  "rhythm": {
    "scaleRatio": number (font-size ratio between levels, e.g. 1.5),
    "density": "airy|balanced|dense",
    "alignmentMood": "left|center|mixed"
  }
}`;

/** 提取请求的指令文本。 */
const INSTRUCTION = [
  'You are a senior typographer. Analyze the TYPESETTING / LAYOUT of the text in this image.',
  'Infer a reusable layout PARAMETER TEMPLATE that describes HOW the text is arranged.',
  'CRITICAL constraints:',
  '- Describe layout rules ONLY. Do NOT transcribe the actual words/content.',
  '- Do NOT include any color, background, or background-color. Backgrounds are handled separately.',
  '- Identify each distinct text block, classify its role, and measure relative font size, weight,',
  '  alignment, position (anchor), line-height, letter-spacing, writing mode and rotation.',
  '- Follow the "larger = lighter" principle when estimating weights (big titles thinner, small labels heavier).',
  '- Express sizes in px on the reference canvas you choose (match the image aspect ratio).',
  SCHEMA_HINT,
].join('\n');

/**
 * 分析一张图片，提取排版参数模版。
 * @param imageUrl base64 data URI 或公网图片 URL
 * @param id 记录 id，写入模版 id
 * @param signal 可选取消信号
 */
export async function extractLayoutParam(
  imageUrl: string,
  id: string,
  signal?: AbortSignal,
): Promise<LayoutParamTemplate> {
  const res = await fetch(`${APIMART_BASE}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: VISION_MODEL,
      messages: [
        {
          role: 'system',
          content:
            'You are a senior typographer. You always reply with a single valid JSON object and nothing else.',
        },
        {
          role: 'user',
          content: [
            { type: 'text', text: INSTRUCTION },
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
  return normalize(parseJsonLoose(text), id);
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

/** 安全读取错误响应里的 message。 */
async function safeErrorMessage(res: Response): Promise<string> {
  try {
    const json = (await res.json()) as { error?: { message?: string } };
    return (json.error?.message ?? '').slice(0, 200);
  } catch {
    return '';
  }
}

/** 数值收敛：非有限数回退默认，并夹在 [min, max]。 */
function num(value: unknown, fallback: number, min: number, max: number): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

/** 枚举收敛：不在白名单则回退默认。 */
function pick<T extends string>(value: unknown, allowed: T[], fallback: T): T {
  return typeof value === 'string' && (allowed as string[]).includes(value)
    ? (value as T)
    : fallback;
}

/** 字符串收敛：非字符串回退，裁剪长度。 */
function str(value: unknown, fallback: string, maxLen = 80): string {
  const s = typeof value === 'string' ? value.trim() : '';
  return (s || fallback).slice(0, maxLen);
}

/** 收敛画布参数。 */
function normalizeCanvas(raw: unknown): CanvasParam {
  const c = (raw ?? {}) as Record<string, unknown>;
  return {
    ratio: str(c.ratio, '4:3', 12),
    referenceWidth: Math.round(num(c.referenceWidth, 1080, 320, 8192)),
    referenceHeight: Math.round(num(c.referenceHeight, 810, 320, 8192)),
    padding: Math.round(num(c.padding, 80, 0, 2000)),
    gridColumns: Math.round(num(c.gridColumns, 1, 1, 24)),
    blockGap: Math.round(num(c.blockGap, 24, 0, 2000)),
  };
}

/** 收敛节奏参数。 */
function normalizeRhythm(raw: unknown): RhythmParam {
  const r = (raw ?? {}) as Record<string, unknown>;
  return {
    scaleRatio: num(r.scaleRatio, 1.5, 1, 4),
    density: pick(r.density, ['airy', 'balanced', 'dense'], 'balanced'),
    alignmentMood: pick(r.alignmentMood, ['left', 'center', 'mixed'], 'left'),
  };
}

/** 收敛单个文本块。 */
function normalizeBlock(raw: unknown): TextBlockParam {
  const b = (raw ?? {}) as Record<string, unknown>;
  const block: TextBlockParam = {
    role: pick(b.role, TEXT_ROLES, 'body'),
    fontKind: pick(b.fontKind, FONT_KINDS, 'sans'),
    fontSize: Math.round(num(b.fontSize, 48, 4, 2000)),
    fontWeight: Math.round(num(b.fontWeight, 400, 100, 900)),
    lineHeight: num(b.lineHeight, 1.3, 0.8, 4),
    letterSpacing: num(b.letterSpacing, 0, -0.5, 2),
    textAlign: pick(b.textAlign, TEXT_ALIGNS, 'left'),
    anchor: pick(b.anchor, ANCHORS, 'top-left'),
    writingMode: pick(b.writingMode, WRITING_MODES, 'horizontal'),
    textTransform: pick(b.textTransform, TEXT_TRANSFORMS, 'none'),
    maxCharsPerLine: Math.round(num(b.maxCharsPerLine, 20, 1, 200)),
    maxLines: Math.round(num(b.maxLines, 3, 1, 50)),
    rotation: num(b.rotation, 0, -180, 180),
  };
  if (b.offsetYPercent !== undefined) {
    block.offsetYPercent = num(b.offsetYPercent, 0, 0, 100);
  }
  return block;
}

/** 把模型输出整体收敛为合法 LayoutParamTemplate。 */
function normalize(obj: Record<string, unknown>, id: string): LayoutParamTemplate {
  const rawBlocks = Array.isArray(obj.blocks) ? obj.blocks : [];
  const blocks = rawBlocks.map(normalizeBlock);
  if (blocks.length === 0) {
    // 至少给一个标题块，避免空模版击穿渲染
    blocks.push(normalizeBlock({ role: 'title', fontSize: 96, fontWeight: 500 }));
  }
  return {
    id,
    name: str(obj.name, '未命名排版', 24),
    vibe: str(obj.vibe, '通用文字排版模版', 120),
    canvas: normalizeCanvas(obj.canvas),
    blocks,
    rhythm: normalizeRhythm(obj.rhythm),
  };
}
