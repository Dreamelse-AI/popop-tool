/**
 * 封面图上传端点（生产 Express + dev vite 中间件共用的请求处理）。
 *
 * 协议：POST application/json { data_url: string } → { code, msg, data: { url, object_key } }
 * 与 arca 信封风格一致（code=0 成功），前端 styleCover.ts 解析。
 */

import type { IncomingMessage, ServerResponse } from 'node:http';
import { uploadCoverToOss, CoverUploadError } from './ossUpload';

/** 请求体上限（base64 会比原图大 ~33%，留足空间）。 */
const MAX_BODY_BYTES = 16 * 1024 * 1024;

/** 读取整个请求体为字符串（带大小保护）。 */
function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(new CoverUploadError('请求体过大', 413));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', () => reject(new CoverUploadError('读取请求失败', 400)));
  });
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
}

/**
 * 处理一次封面上传请求。框架无关：传入 Node 原生 req/res。
 * 成功返回 { code:0, data:{ url, object_key } }；失败返回非 0 code + msg。
 */
export async function handleCoverUpload(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  try {
    const raw = await readBody(req);
    let parsed: { data_url?: string };
    try {
      parsed = JSON.parse(raw) as { data_url?: string };
    } catch {
      throw new CoverUploadError('请求体不是合法 JSON');
    }
    if (!parsed.data_url) throw new CoverUploadError('缺少 data_url 字段');

    const result = await uploadCoverToOss({ dataUrl: parsed.data_url });
    sendJson(res, 200, {
      code: 0,
      msg: 'ok',
      data: { url: result.url, object_key: result.objectKey },
    });
  } catch (e) {
    const status = e instanceof CoverUploadError ? e.status : 500;
    const msg = e instanceof Error ? e.message : '上传失败';
    console.error('[style-cover] 上传失败:', msg);
    sendJson(res, status, { code: status, msg, data: null });
  }
}
