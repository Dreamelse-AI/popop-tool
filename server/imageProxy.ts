/**
 * 图片只读代理中间件：`/api/img-proxy?url=<图片直链>`。
 *
 * 为什么需要：表情包要 fetch 九宫格大图的像素做 canvas 切图/抠图，但 apimart 出图直链
 * 所在 host（如 getapib.org）不带 CORS 头，浏览器直连会被 CORS 拦截（Failed to fetch）。
 * 由同源服务端代取图片再回传，前端就走同源、无 CORS 问题。
 *
 * 安全（SSRF 防护）：只允许 http/https；拒绝 localhost、内网/保留网段、非默认端口，
 * 避免被用来探测内网服务。仅 GET，只回传图片类响应。
 */

import https from 'node:https';
import http from 'node:http';
import { isIP } from 'node:net';
import type { Request, Response } from 'express';

const UPSTREAM_TIMEOUT_MS = 30_000;
/** 允许的上游端口（仅标准 web 端口，缩小 SSRF 面）。 */
const ALLOWED_PORTS = new Set(['', '80', '443']);

/** 判断主机是否指向本机/内网/保留地址（拒绝，防 SSRF）。 */
function isPrivateHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  if (h === 'localhost' || h.endsWith('.localhost') || h.endsWith('.internal')) return true;
  if (isIP(h) === 0) return false; // 非 IP（域名）：放行，仅按端口/协议限制
  // IPv4 私网 / 环回 / 链路本地 / 保留
  if (/^127\./.test(h) || /^10\./.test(h) || /^192\.168\./.test(h)) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(h)) return true;
  if (/^169\.254\./.test(h) || /^0\./.test(h)) return true;
  // IPv6 环回 / 唯一本地 / 链路本地
  if (h === '::1' || h.startsWith('fc') || h.startsWith('fd') || h.startsWith('fe80')) return true;
  return false;
}

/** 校验目标 URL 是否允许代理；不合法返回错误原因。 */
function validateTarget(raw: string): { url: URL } | { error: string } {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { error: 'url 不合法' };
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return { error: '仅支持 http/https' };
  }
  if (!ALLOWED_PORTS.has(url.port)) {
    return { error: '不允许的端口' };
  }
  if (isPrivateHost(url.hostname)) {
    return { error: '不允许的主机' };
  }
  return { url };
}

export function createImageProxy() {
  return (req: Request, res: Response): void => {
    const raw = typeof req.query.url === 'string' ? req.query.url : '';
    if (!raw) {
      res.status(400).json({ error: '缺少 url 参数' });
      return;
    }
    const checked = validateTarget(raw);
    if ('error' in checked) {
      res.status(400).json({ error: checked.error });
      return;
    }
    const { url } = checked;
    const lib = url.protocol === 'https:' ? https : http;

    const upstream = lib.request(
      {
        protocol: url.protocol,
        hostname: url.hostname,
        port: url.port || (url.protocol === 'https:' ? 443 : 80),
        path: url.pathname + url.search,
        method: 'GET',
        timeout: UPSTREAM_TIMEOUT_MS,
      },
      (upRes) => {
        const status = upRes.statusCode ?? 502;
        const contentType = String(upRes.headers['content-type'] ?? '');
        // 只回传图片，避免被当作通用代理
        if (status >= 400 || !contentType.startsWith('image/')) {
          res.status(status >= 400 ? status : 415).json({
            error: status >= 400 ? `上游 ${status}` : '上游返回的不是图片',
          });
          upRes.resume();
          return;
        }
        res.status(200);
        res.setHeader('Content-Type', contentType);
        // 同源访问，允许前端 canvas 读取像素
        res.setHeader('Cache-Control', 'public, max-age=300');
        upRes.pipe(res);
      },
    );

    upstream.on('error', (err) => {
      console.error('[img-proxy] 转发失败:', err.message);
      if (!res.headersSent) res.status(502).json({ error: `取图失败：${err.message}` });
      else res.end();
    });
    upstream.on('timeout', () => {
      upstream.destroy();
      if (!res.headersSent) res.status(504).json({ error: '取图超时' });
    });
    upstream.end();
  };
}
