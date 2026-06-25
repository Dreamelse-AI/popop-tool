/**
 * 情绪配色库——图片上传到 OSS（框架无关，dev vite 中间件与生产 Express 共用）。
 *
 * 复用画风封面同一套 OSS 直传能力（server/ossUpload.ts），只是落到 palette/ 子目录。
 * 协议：POST application/json { data_url: string } → { code, msg, data: { url, object_key } }
 *
 * 设计：本工具最终走「图片传公开 OSS 拿 url + 表单元数据存后端独立接口」。
 * 当前后端表单接口未就绪，故服务端只负责「存图拿 url」这一步（永久、公开可访问）；
 * 表单元数据暂由前端 localStorage 过渡保存（见 src/services/paletteClient.ts）。
 * 不再写容器本地磁盘，彻底规避此前 /app/.data 不可写导致的 500。
 */

import type { IncomingMessage, ServerResponse } from 'node:http';
import { uploadCoverToOss, CoverUploadError } from './ossUpload';

/** 请求体上限（base64 比原图大 ~33%，留足空间）。 */
const MAX_BODY_BYTES = 16 * 1024 * 1024;

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
 * 处理配色库图片上传：base64 → OSS（palette/ 子目录）→ 返回公开 url。
 * @param subPath 已剥离 /api/palette 前缀的子路径；仅接受 POST /upload。
 */
export async function handlePalette(
  req: IncomingMessage,
  res: ServerResponse,
  subPath: string,
): Promise<void> {
  const method = (req.method ?? 'GET').toUpperCase();
  const path = subPath.split('?')[0].replace(/\/+$/, '') || '/';

  if (method !== 'POST' || path !== '/upload') {
    sendJson(res, 404, { code: -1, msg: '未知接口', data: null });
    return;
  }

  try {
    const raw = await readBody(req);
    let parsed: { data_url?: string };
    try {
      parsed = JSON.parse(raw) as { data_url?: string };
    } catch {
      throw new CoverUploadError('请求体不是合法 JSON');
    }
    if (!parsed.data_url) throw new CoverUploadError('缺少 data_url 字段');

    const result = await uploadCoverToOss({ dataUrl: parsed.data_url, subdir: 'palette/' });
    sendJson(res, 200, {
      code: 0,
      msg: 'ok',
      data: { url: result.url, object_key: result.objectKey },
    });
  } catch (e) {
    const status = e instanceof CoverUploadError ? e.status : 500;
    const msg = e instanceof Error ? e.message : '上传失败';
    console.error('[palette] 图片上传失败:', msg);
    sendJson(res, status, { code: status === 200 ? -1 : status, msg, data: null });
  }
}
