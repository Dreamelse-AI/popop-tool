/**
 * arca 海外后端调用封装。
 *
 * 对应 arca-integration 规范：
 *   - 统一走同源代理：dev 与生产都请求 /arca/*，由 vite proxy / Express 反代转发，规避 CORS
 *   - 响应信封 { code, msg, data }，code===0 才算成功，否则抛业务错误（用 msg）
 *   - 鉴权：图库接口后端将豁免 JWT；若后续需要，由服务端反代注入，前端不持有后端 secret
 *
 * 字段命名遵循海外后端 snake_case，调用方负责按 arca.api 对齐。
 */

const ARCA_BASE = '/arca';

export class ArcaError extends Error {
  constructor(
    message: string,
    public code?: number,
    public status?: number,
  ) {
    super(message);
    this.name = 'ArcaError';
  }
}

interface ArcaResp<T> {
  code: number;
  msg: string;
  data: T;
}

/** 向 arca 发 POST JSON，解信封，code!==0 抛 ArcaError。 */
export async function arcaPost<TReq extends object, TRes>(
  path: string,
  body: TReq,
  signal?: AbortSignal,
): Promise<TRes> {
  let res: Response;
  try {
    res = await fetch(`${ARCA_BASE}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal,
    });
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') throw e;
    throw new ArcaError('网络请求失败，请检查连接后重试');
  }

  if (!res.ok) {
    throw new ArcaError(`请求失败（${res.status}）`, undefined, res.status);
  }

  let json: ArcaResp<TRes>;
  try {
    json = (await res.json()) as ArcaResp<TRes>;
  } catch {
    throw new ArcaError('响应解析失败');
  }

  if (json.code !== 0) {
    throw new ArcaError(json.msg || `业务错误（code=${json.code}）`, json.code);
  }
  return json.data;
}
