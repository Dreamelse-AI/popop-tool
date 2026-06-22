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

import type {
  BackgroundRecipe,
  GenerateImageRequest,
  GeneratedImage,
} from '@/types/background';
import { buildPrompt } from './promptBuilder';

/** 同源代理基址：dev 走 vite proxy 的 /apimart，生产同源 /apimart。 */
const APIMART_BASE = '/apimart';

/** apimart 生图模型。 */
const APIMART_MODEL = 'gpt-image-2';

/** 轮询配置：最长 10 分钟，间隔从 3s 递增到 10s。 */
const POLL_TIMEOUT_MS = 600_000;
const POLL_START_INTERVAL_MS = 3_000;
const POLL_MAX_INTERVAL_MS = 10_000;

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

/** 提交生成任务，返回 task_id。 */
async function createTask(
  recipe: BackgroundRecipe,
  signal?: AbortSignal,
): Promise<string> {
  const prompt = buildPrompt(recipe.selection, recipe.extraKeywords);
  const body: GenerateImageRequest = {
    model: APIMART_MODEL,
    prompt,
    n: 1,
    size: recipe.ratio,
    resolution: recipe.resolution,
  };

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
    throw new ImageGenError(
      json.error?.message || '提交任务失败：未返回 task_id',
    );
  }
  return taskId;
}

/** 轮询任务直到完成，返回图片直链。 */
async function pollTask(taskId: string, signal?: AbortSignal): Promise<string> {
  const start = Date.now();
  let interval = POLL_START_INTERVAL_MS;

  while (Date.now() - start < POLL_TIMEOUT_MS) {
    await sleep(interval, signal);

    let res: Response;
    try {
      res = await fetch(`${APIMART_BASE}/v1/tasks/${taskId}`, { signal });
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') throw e;
      continue;
    }
    if (!res.ok) continue;

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
  try {
    const json = (await res.json()) as { error?: { message?: string } };
    return (json.error?.message ?? '').slice(0, 200);
  } catch {
    return '';
  }
}

/**
 * 根据配方生成一张氛围背景图（提交 + 轮询，可能耗时数十秒到数分钟）。
 * @param recipe 五层选择 + 输出规格
 * @param signal 可选取消信号
 */
export async function generateBackground(
  recipe: BackgroundRecipe,
  signal?: AbortSignal,
): Promise<GeneratedImage> {
  const taskId = await createTask(recipe, signal);
  const url = await pollTask(taskId, signal);
  return { url };
}

/** 把生成结果转成可用于 <img src> 和下载的 URL。 */
export function resolveImageSrc(image: GeneratedImage): string {
  return image.url;
}
