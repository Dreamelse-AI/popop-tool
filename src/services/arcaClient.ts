/**
 * arca 海外后端调用封装。
 *
 * 统一走同源代理：dev 与生产都请求 /arca/*，由 vite proxy / Express 反代转发，规避 CORS。
 * 鉴权：/admin/api/* 接口需 X-Admin-Token，由反代层注入（环境变量 ADMIN_API_TOKEN），
 *       前端不持有口令。鉴权失败时后端返回纯文本 + 401/403。
 *
 * ⚠️ 两组接口响应风格不同（见 docs/admin-api 文档）：
 *   - MoodPic 图库  /admin/api/moodpic/*   → 统一信封 {code,msg,data}，HTTP 恒 200（鉴权失败除外），用 arcaPost。
 *   - 画风管理      /admin/api/style_prompts* → 裸 JSON + HTTP 状态码（错误为纯文本），用 arcaAdmin*。
 *
 * 字段命名遵循海外后端 snake_case，调用方负责按文档对齐。
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

/** 鉴权失败的统一文案（两组接口一致：403 未启用 / 401 口令错）。 */
function authErrorMessage(status: number): string {
  if (status === 403) return '后台未启用：服务端未配置管理口令（ADMIN_API_TOKEN）';
  return '鉴权失败：管理口令不正确（X-Admin-Token）';
}

// ==================== MoodPic：信封风格（HTTP 恒 200，看 code） ====================

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

  if (res.status === 401 || res.status === 403) {
    throw new ArcaError(authErrorMessage(res.status), undefined, res.status);
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

// ==================== 画风管理：裸 JSON + HTTP 状态码风格 ====================

/**
 * 调画风管理接口（裸 JSON）。成功返回解析后的 JSON；失败（4xx/5xx）抛 ArcaError，
 * 错误消息取响应纯文本。空响应体返回 null。
 */
export async function arcaAdmin<TRes>(
  path: string,
  opts: { method?: string; body?: unknown; signal?: AbortSignal } = {},
): Promise<TRes> {
  let res: Response;
  try {
    res = await fetch(`${ARCA_BASE}${path}`, {
      method: opts.method ?? 'GET',
      headers: { 'Content-Type': 'application/json' },
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      signal: opts.signal,
    });
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') throw e;
    throw new ArcaError('网络请求失败，请检查连接后重试');
  }

  if (res.status === 401 || res.status === 403) {
    throw new ArcaError(authErrorMessage(res.status), undefined, res.status);
  }
  if (!res.ok) {
    const text = (await res.text().catch(() => '')).trim();
    throw new ArcaError(text || `请求失败（${res.status}）`, undefined, res.status);
  }

  const text = await res.text();
  return (text ? JSON.parse(text) : null) as TRes;
}

/**
 * 上传画风图标（multipart，字段名 file）。成功返回后端的 StorageObject（裸 JSON）。
 * 不要手动设 Content-Type，交给浏览器带 boundary。
 */
export async function arcaAdminUpload<TRes>(
  path: string,
  file: File,
  signal?: AbortSignal,
): Promise<TRes> {
  const fd = new FormData();
  fd.append('file', file);

  let res: Response;
  try {
    res = await fetch(`${ARCA_BASE}${path}`, { method: 'POST', body: fd, signal });
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') throw e;
    throw new ArcaError('上传请求失败，请检查网络后重试');
  }

  if (res.status === 401 || res.status === 403) {
    throw new ArcaError(authErrorMessage(res.status), undefined, res.status);
  }
  if (!res.ok) {
    const text = (await res.text().catch(() => '')).trim();
    throw new ArcaError(text || `上传失败（${res.status}）`, undefined, res.status);
  }

  return (await res.json()) as TRes;
}
