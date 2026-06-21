/**
 * 本地后端 API 封装（薄壳）。
 *
 * 现阶段后端尚未接入，调用方应使用 layoutExtractor 里的 mock 实现。
 * 后端接上后，把 layoutExtractor 的实现切到这里的 postLocal 即可，调用方无感。
 */

/** 本地后端基址：dev 走 vite proxy 的 /local-api，生产同源 /api。 */
const LOCAL_API_BASE = import.meta.env.DEV ? '/local-api' : '/api';

export class ApiError extends Error {
  constructor(
    message: string,
    public status?: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/** 向本地后端发 POST JSON 请求。 */
export async function postLocal<TReq, TRes>(
  path: string,
  body: TReq,
  signal?: AbortSignal,
): Promise<TRes> {
  const res = await fetch(`${LOCAL_API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  });

  if (!res.ok) {
    throw new ApiError(`请求失败（${res.status}）`, res.status);
  }

  return (await res.json()) as TRes;
}
