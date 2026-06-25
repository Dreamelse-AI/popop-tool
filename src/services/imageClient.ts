/**
 * 图像生成服务（apimart gpt-image-2，异步任务制）。
 *
 * 安全约定：API key 绝不出现在前端代码/打包产物里。
 * 前端只请求同源代理路径 /apimart，由 vite dev server（开发）或生产反向代理
 * 注入 Authorization 头并转发到 apimart。
 *
 * 流程（参考 apimart 官方文档 与 tool-station 实测用法）：
 *   1. POST /apimart/v1/images/generations → data[0].task_id
 *   2. 轮询 GET /apimart/v1/tasks/{task_id} 直到 status=completed
 *   3. 从 result.images[0].url[0] 取图片直链（url 是数组）
 * 文档：https://docs.apimart.ai/cn/api-reference/images/gpt-image-2/generation
 */

/** 图像生成请求体（发给同源代理 /apimart，代理再转发给 apimart）。 */
interface GenerateImageRequest {
  /** 固定 gpt-image-2 */
  model: string;
  prompt: string;
  /** 生成张数，固定 1 */
  n: number;
  /** 比例（如 9:16）或精确像素（如 1152x2048） */
  size: string;
  /** 分辨率档位 1k/2k/4k；传精确像素时省略 */
  resolution?: string;
}

/** 图像生成结果。apimart 任务完成后从 result.images[0].url[0] 取直链。 */
export interface GeneratedImage {
  /** 直链 URL */
  url: string;
}

/** 同源代理基址：dev 走 vite proxy 的 /apimart，生产同源 /apimart。 */
const APIMART_BASE = '/apimart';

/** apimart 生图模型。 */
const APIMART_MODEL = 'gpt-image-2';

/** 轮询配置：最长 10 分钟，间隔从 3s 递增到 10s。 */
const POLL_TIMEOUT_MS = 600_000;
const POLL_START_INTERVAL_MS = 3_000;
const POLL_MAX_INTERVAL_MS = 10_000;
/**
 * 查询接口连续网关错误（502/503/504）容忍上限。
 * 偶发抖动会自动重试；连续超过此次数视为上游持续不可用，快速失败而非干等到超时。
 */
const MAX_CONSECUTIVE_GATEWAY_ERRORS = 8;

export class ImageGenError extends Error {
  constructor(
    message: string,
    public status?: number,
  ) {
    super(message);
    this.name = 'ImageGenError';
  }
}

/** 提交接口返回结构。 */
interface CreateTaskResponse {
  code?: number;
  data?: Array<{ status?: string; task_id?: string }>;
  task_id?: string;
  error?: { message?: string };
}

/** 任务查询返回结构。 */
interface TaskStatusResponse {
  code?: number;
  data?: {
    status?: 'submitted' | 'processing' | 'completed' | 'failed';
    result?: { images?: Array<{ url?: string | string[] }> };
    error?: { message?: string };
  };
  error?: { message?: string };
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        reject(new DOMException('aborted', 'AbortError'));
      },
      { once: true },
    );
  });
}

/** 输出规格：比例 + 分辨率。 */
export interface ImageGenOptions {
  size: string;
  resolution: string;
}

/**
 * 比例 × 分辨率 → 精确像素尺寸映射（来自 apimart gpt-image-2 文档表格）。
 *
 * 背景：gpt-image-2 对纯比例字符串（如 "9:16"）的遵循不稳定，出图比例会漂。
 * 文档支持直接传像素尺寸（"传 size 则强制按指定尺寸出图"），传像素更可靠。
 * 因此前端把 ratio+resolution 映射成像素再传，锁死比例。
 */
const PIXEL_SIZE_MAP: Record<string, Record<string, string>> = {
  '1:1': { '1k': '1024x1024', '2k': '2048x2048', '4k': '2880x2880' },
  '3:2': { '1k': '1536x1024', '2k': '2048x1360', '4k': '3520x2336' },
  '2:3': { '1k': '1024x1536', '2k': '1360x2048', '4k': '2336x3520' },
  '4:3': { '1k': '1024x768', '2k': '2048x1536', '4k': '3312x2480' },
  '3:4': { '1k': '768x1024', '2k': '1536x2048', '4k': '2480x3312' },
  '16:9': { '1k': '1536x864', '2k': '2048x1152', '4k': '3840x2160' },
  '9:16': { '1k': '864x1536', '2k': '1152x2048', '4k': '2160x3840' },
};

/** 把 ratio+resolution 解析为传给 apimart 的 size 值（优先精确像素，回退原比例）。 */
function resolveSize(ratio: string, resolution: string): string {
  return PIXEL_SIZE_MAP[ratio]?.[resolution] ?? ratio;
}

/** 提交生成任务（直接给定 prompt），返回 task_id。 */
async function createTaskByPrompt(
  prompt: string,
  opts: ImageGenOptions,
  signal?: AbortSignal,
  /** 可选参考图（base64 data URI 或公网 URL），传入则走图生图模式 */
  imageUrls?: string[],
): Promise<string> {
  const size = resolveSize(opts.size, opts.resolution);
  const isPixelSize = /^\d+x\d+$/.test(size);
  const body: GenerateImageRequest & { image_urls?: string[] } = {
    model: APIMART_MODEL,
    prompt,
    n: 1,
    size: size as GenerateImageRequest['size'],
    // 传精确像素时 resolution 已隐含在像素里，再传会与像素冲突，故仅在回退比例时传
    ...(isPixelSize ? {} : { resolution: opts.resolution as GenerateImageRequest['resolution'] }),
  };
  if (imageUrls && imageUrls.length > 0) {
    body.image_urls = imageUrls;
  }

  let res: Response;
  try {
    res = await fetch(`${APIMART_BASE}/v1/images/generations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal,
    });
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') throw e;
    throw new ImageGenError('网络请求失败，请检查连接后重试');
  }

  if (!res.ok) {
    const detail = await safeErrorMessage(res);
    throw new ImageGenError(detail || `提交任务失败（${res.status}）`, res.status);
  }

  const json = (await res.json()) as CreateTaskResponse;
  const taskId = json.data?.[0]?.task_id ?? json.task_id;
  if (!taskId) {
    throw new ImageGenError(json.error?.message || '提交任务失败：未返回 task_id');
  }
  return taskId;
}

/** 轮询任务直到完成，返回图片直链。 */
async function pollTask(taskId: string, signal?: AbortSignal): Promise<string> {
  const start = Date.now();
  let interval = POLL_START_INTERVAL_MS;
  // 连续网关错误（含网络异常与 5xx）计数；任何一次成功响应都会清零
  let consecutiveGatewayErrors = 0;
  let lastGatewayStatus = 0;

  while (Date.now() - start < POLL_TIMEOUT_MS) {
    await sleep(interval, signal);

    let res: Response;
    try {
      res = await fetch(`${APIMART_BASE}/v1/tasks/${taskId}`, { signal });
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') throw e;
      // 网络层失败也计入连续错误，避免上游彻底不可达时干等到超时
      if (++consecutiveGatewayErrors >= MAX_CONSECUTIVE_GATEWAY_ERRORS) {
        throw new ImageGenError('查询生成结果持续失败，可能是上游服务繁忙，请稍后重试');
      }
      continue;
    }

    if (!res.ok) {
      // 502/503/504 是上游网关繁忙，可重试；连续过多则快速失败
      if (res.status >= 500) {
        lastGatewayStatus = res.status;
        if (++consecutiveGatewayErrors >= MAX_CONSECUTIVE_GATEWAY_ERRORS) {
          throw new ImageGenError(
            `上游服务暂时不可用（连续 ${res.status}），请稍后重试`,
            lastGatewayStatus,
          );
        }
      }
      // 4xx 等其它非 2xx 不计入网关错误，继续轮询（任务可能仍在排队）
      continue;
    }

    consecutiveGatewayErrors = 0;
    const json = (await res.json()) as TaskStatusResponse;
    const status = json.data?.status;

    if (status === 'completed') {
      const url = firstImageUrl(json);
      if (url) return url;
      throw new ImageGenError('生成成功但未返回图片地址');
    }
    if (status === 'failed') {
      const msg = json.data?.error?.message || json.error?.message;
      throw new ImageGenError(msg || '生成失败，请调整组合后重试');
    }

    interval = Math.min(interval * 1.3, POLL_MAX_INTERVAL_MS);
  }

  throw new ImageGenError('生成超时，请稍后重试');
}

/** 从任务结果里取第一张图片 URL（apimart 的 url 字段是数组）。 */
function firstImageUrl(json: TaskStatusResponse): string | null {
  const urlField = json.data?.result?.images?.[0]?.url;
  if (Array.isArray(urlField)) return urlField[0] ?? null;
  return urlField ?? null;
}

/** 安全读取错误响应里的 message（截断，避免过长）。 */
async function safeErrorMessage(res: Response): Promise<string> {
  // 先读纯文本：body 只能消费一次，文本能兼容 JSON / HTML 网关错误页 / 纯文本
  let text = '';
  try {
    text = await res.text();
  } catch {
    return '';
  }
  if (!text) return '';
  try {
    const json = JSON.parse(text) as { error?: { message?: string }; message?: string };
    const msg = json.error?.message ?? json.message ?? '';
    if (msg) return msg.slice(0, 200);
  } catch {
    // 非 JSON：回退展示原始响应前若干字符，便于定位网关/上游真实报错
  }
  return text.replace(/\s+/g, ' ').trim().slice(0, 200);
}

/**
 * 按给定 prompt 生成一张图（通用底层，供视觉资产引擎等复用）。
 * @param prompt 完整 image prompt（已展开）
 * @param opts 输出规格（size 比例 / resolution 档位）
 * @param signal 可选取消信号
 */
export async function generateImageByPrompt(
  prompt: string,
  opts: ImageGenOptions,
  signal?: AbortSignal,
): Promise<GeneratedImage> {
  const taskId = await createTaskByPrompt(prompt, opts, signal);
  const url = await pollTask(taskId, signal);
  return { url };
}

/**
 * 图生图：按 prompt + 参考图生成一张图（供表情包九宫格等复用）。
 * @param prompt 完整 image prompt
 * @param imageUrls 参考图（base64 data URI 或公网 URL），最多 16 张
 * @param opts 输出规格（size 比例 / resolution 档位）
 * @param signal 可选取消信号
 */
export async function generateImageByReference(
  prompt: string,
  imageUrls: string[],
  opts: ImageGenOptions,
  signal?: AbortSignal,
): Promise<GeneratedImage> {
  const taskId = await createTaskByPrompt(prompt, opts, signal, imageUrls);
  const url = await pollTask(taskId, signal);
  return { url };
}
