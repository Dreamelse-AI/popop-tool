/**
 * 画风封面图上传（前端侧）。
 *
 * 把本地图片（base64 data URI）发到同源 /api/style-cover/upload，
 * 服务端用 OSS SDK 直传并返回可访问 URL，写入画风的 style_icon。
 * OSS 密钥只在服务端，前端不接触。
 */

export class CoverUploadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CoverUploadError';
  }
}

/**
 * 接入开关（过渡期）。
 *   true  → 不传 OSS，直接用本地 base64 data URI 作封面预览（纯前端验证交互）
 *   false → 走服务端 OSS 上传，返回可访问 URL
 * 注意：mock 下封面是 base64，存进 localStorage 画风库仅本机可见、体积偏大，仅供过渡演示。
 */
const USE_MOCK = true;

interface UploadResp {
  code: number;
  msg: string;
  data: { url: string; object_key: string } | null;
}

/**
 * 上传一张封面图，返回可公开访问的 URL。
 * @param dataUrl base64 data URI（data:image/png;base64,...）
 */
export async function uploadStyleCover(dataUrl: string, signal?: AbortSignal): Promise<string> {
  if (USE_MOCK) return dataUrl;

  let res: Response;
  try {
    res = await fetch('/api/style-cover/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data_url: dataUrl }),
      signal,
    });
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') throw e;
    throw new CoverUploadError('上传请求失败，请检查网络后重试');
  }

  let json: UploadResp;
  try {
    json = (await res.json()) as UploadResp;
  } catch {
    throw new CoverUploadError(`上传失败（${res.status}）`);
  }

  if (json.code !== 0 || !json.data?.url) {
    throw new CoverUploadError(json.msg || `上传失败（${res.status}）`);
  }
  return json.data.url;
}
