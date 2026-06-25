/**
 * 配色情绪库 HTTP 处理（框架无关，传入 Node 原生 req/res）。
 *
 * 路由（挂载前缀 /api/palette，由调用方剥离前缀或在此按完整路径匹配）：
 *   GET    /api/palette/list              列出全部记录（倒序）
 *   POST   /api/palette/save              新增一条（body: SaveInput，含 base64 原图）
 *   DELETE /api/palette/<id>              删除一条（含原图文件）
 *   GET    /api/palette/image/<file>      读取原图（落盘文件）
 *
 * 为什么不用 express.Router：dev 走 vite 的 SSR module runner 加载本文件，
 * express 是 CJS 在该环境会报 `module is not defined`。故与 coverUploadHandler 同款，
 * 用 node:http 原生类型，dev 与生产共用同一处理逻辑。
 *
 * 统一信封 { code, msg, data }，code=0 成功。
 */

import fs from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import {
  readAll,
  createRecord,
  deleteRecord,
  resolveImagePath,
  PaletteError,
  type SaveInput,
} from './paletteStore';

/** 原图 base64 体积上限（前端已 downscale，留足空间）。 */
const MAX_BODY_BYTES = 16 * 1024 * 1024;

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
}

function ok(res: ServerResponse, data: unknown): void {
  sendJson(res, 200, { code: 0, msg: 'ok', data });
}

function fail(res: ServerResponse, status: number, msg: string): void {
  sendJson(res, status, { code: -1, msg, data: null });
}

/** 读取整个请求体为字符串（带大小保护）。 */
function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        req.destroy();
        reject(new Error('请求体过大'));
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', () => reject(new Error('读取请求失败')));
  });
}

/** content-type → 简单扩展名映射，用于回传原图。 */
const CONTENT_TYPE_BY_EXT: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
};

/**
 * 处理一次 /api/palette 请求。
 * @param req Node 原生请求
 * @param res Node 原生响应
 * @param subPath 已剥离 /api/palette 前缀的子路径（如 "/list"、"/image/x.png"、"/<id>"）
 */
export async function handlePalette(
  req: IncomingMessage,
  res: ServerResponse,
  subPath: string,
): Promise<void> {
  const method = (req.method ?? 'GET').toUpperCase();
  // 去掉查询串，规整为以 / 开头无尾斜杠
  const path = subPath.split('?')[0].replace(/\/+$/, '') || '/';

  try {
    if (method === 'GET' && path === '/list') {
      const items = await readAll();
      ok(res, { items, total: items.length });
      return;
    }

    if (method === 'POST' && path === '/save') {
      await handleSave(req, res);
      return;
    }

    if (method === 'GET' && path.startsWith('/image/')) {
      handleImage(res, decodeURIComponent(path.slice('/image/'.length)));
      return;
    }

    if (method === 'DELETE' && path.length > 1) {
      const id = decodeURIComponent(path.slice(1));
      await deleteRecord(id);
      ok(res, null);
      return;
    }

    fail(res, 404, '未知接口');
  } catch (e) {
    if (e instanceof PaletteError) {
      fail(res, 400, e.message);
      return;
    }
    console.error('[palette] 处理失败:', e instanceof Error ? e.message : e);
    fail(res, 500, e instanceof Error ? e.message : '服务器错误');
  }
}

async function handleSave(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const raw = await readBody(req);
  let body: Partial<SaveInput>;
  try {
    body = JSON.parse(raw) as Partial<SaveInput>;
  } catch {
    fail(res, 400, '请求体不是合法 JSON');
    return;
  }
  if (typeof body.id !== 'string' || typeof body.imageDataUrl !== 'string') {
    fail(res, 400, '缺少必填字段 id / imageDataUrl');
    return;
  }
  const record = await createRecord({
    id: body.id,
    name: body.name ?? '',
    mood: body.mood ?? '',
    bgColor: body.bgColor ?? '',
    fontColor: body.fontColor ?? '',
    scene: body.scene ?? '',
    colors: Array.isArray(body.colors) ? body.colors : [],
    imageDataUrl: body.imageDataUrl,
  });
  ok(res, record);
}

function handleImage(res: ServerResponse, file: string): void {
  const abs = resolveImagePath(file);
  if (!abs || !fs.existsSync(abs)) {
    fail(res, 404, '图片不存在');
    return;
  }
  const ext = file.split('.').pop()?.toLowerCase() ?? '';
  const type = CONTENT_TYPE_BY_EXT[ext] ?? 'application/octet-stream';
  res.statusCode = 200;
  res.setHeader('Content-Type', type);
  res.setHeader('Cache-Control', 'public, max-age=86400');
  fs.createReadStream(abs).pipe(res);
}
