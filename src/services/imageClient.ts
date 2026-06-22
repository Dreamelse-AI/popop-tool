/**
 * 图像生成服务（薄壳）。
 *
 * 安全约定：API key 绝不出现在前端代码/打包产物里。
 * 前端只请求同源代理路径 IMAGE_API_BASE，由 vite dev server（开发）或
 * 生产环境的反向代理负责注入 Authorization 头并转发到 apimart。
 *
 * 对应代理配置见 vite.config.ts 的 /img-api。
 */

import type {
  BackgroundRecipe,
  GenerateImageRequest,
  GeneratedImage,
} from '@/types/background';
import { buildPrompt } from './promptBuilder';

/** 同源代理基址：dev 走 vite proxy 的 /img-api，生产同源 /img-api。 */
const IMAGE_API_BASE = '/img-api';

/** apimart 生图模型。 */
const IMAGE_MODEL = 'gpt-image-2';

export class ImageGenError extends Error {
  constructor(
    message: string,
    public status?: number,
  ) {
    super(message);
    this.name = 'ImageGenError';
  }
}

/** apimart 原始响应结构（部分字段）。 */
interface ApiMartResponse {
  data?: Array<{ url?: string; b64_json?: string }>;
  error?: { message?: string };
}

/**
 * 根据配方生成一张氛围背景图。
 * @param recipe 五层选择 + 输出规格
 * @param signal 可选取消信号
 * @returns 生成的图片（url 或 base64）
 */
export async function generateBackground(
  recipe: BackgroundRecipe,
  signal?: AbortSignal,
): Promise<GeneratedImage> {
  const prompt = buildPrompt(recipe.selection, recipe.extraKeywords);

  const body: GenerateImageRequest & { model: string } = {
    model: IMAGE_MODEL,
    prompt,
    size: recipe.ratio,
    resolution: recipe.resolution,
    n: 1,
  };

  let res: Response;
  try {
    res = await fetch(`${IMAGE_API_BASE}/v1/images/generations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal,
    });
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') {
      throw e;
    }
    throw new ImageGenError('网络请求失败，请检查连接后重试');
  }

  if (!res.ok) {
    let detail = '';
    try {
      const errJson = (await res.json()) as ApiMartResponse;
      detail = errJson.error?.message ?? '';
    } catch {
      // 响应非 JSON，忽略细节
    }
    throw new ImageGenError(
      detail || `生成失败（${res.status}），请稍后重试`,
      res.status,
    );
  }

  const json = (await res.json()) as ApiMartResponse;
  const first = json.data?.[0];
  if (!first || (!first.url && !first.b64_json)) {
    throw new ImageGenError('生成结果为空，请重试或调整组合');
  }

  return { url: first.url, b64Json: first.b64_json };
}

/** 把生成结果转成可用于 <img src> 和下载的 URL。 */
export function resolveImageSrc(image: GeneratedImage): string {
  if (image.url) return image.url;
  if (image.b64Json) return `data:image/png;base64,${image.b64Json}`;
  return '';
}
