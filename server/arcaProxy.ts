/**
 * arca 反向代理中间件。
 *
 * 把 /arca/* 转发到 arca 海外后端（默认 https://i18n-api.imaginewithu.com）。
 * 生产前端只请求同源 /arca/*，由本代理转发，规避浏览器 CORS。
 *
 * 鉴权说明：图库相关接口后端将豁免 JWT；若后续需带 JWT，可在此注入
 * Authorization 头（从环境变量读取服务端持有的 token），key 不进前端 bundle。
 *
 * 用 Node 原生 http/https 透传，流式 pipe 请求体与响应体。
 */

import https from 'node:https';
import http from 'node:http';
import type { Request, Response } from 'express';

const ARCA_ORIGIN = process.env.ARCA_ORIGIN ?? 'https://i18n-api.imaginewithu.com';

/** 上游超时。 */
const UPSTREAM_TIMEOUT_MS = 30_000;

export function createArcaProxy() {
  const target = new URL(ARCA_ORIGIN);
  const lib = target.protocol === 'https:' ? https : http;

  return (req: Request, res: Response): void => {
    // req.url 已是去掉 /arca 前缀后的路径（express 子路由挂载）
    const upstreamPath = req.url;

    const headers: http.OutgoingHttpHeaders = {
      ...filterHeaders(req.headers),
      host: target.host,
    };

    const options: https.RequestOptions = {
      protocol: target.protocol,
      hostname: target.hostname,
      port: target.port || (target.protocol === 'https:' ? 443 : 80),
      path: upstreamPath,
      method: req.method,
      headers,
      timeout: UPSTREAM_TIMEOUT_MS,
    };

    const upstream = lib.request(options, (upRes) => {
      res.status(upRes.statusCode ?? 502);
      for (const [k, v] of Object.entries(upRes.headers)) {
        if (v !== undefined) res.setHeader(k, v);
      }
      upRes.pipe(res);
    });

    upstream.on('error', (err) => {
      console.error('[arca] 转发失败:', err.message);
      if (!res.headersSent) {
        res.status(502).json({ code: -1, msg: `上游连接失败：${err.message}`, data: null });
      } else {
        res.end();
      }
    });

    upstream.on('timeout', () => {
      upstream.destroy();
      if (!res.headersSent) {
        res.status(504).json({ code: -1, msg: '上游超时', data: null });
      }
    });

    req.pipe(upstream);
  };
}

/** 过滤逐跳头与会干扰转发的头。 */
function filterHeaders(headers: http.IncomingHttpHeaders): http.OutgoingHttpHeaders {
  const out: http.OutgoingHttpHeaders = {};
  const skip = new Set(['host', 'connection', 'content-length', 'transfer-encoding']);
  for (const [k, v] of Object.entries(headers)) {
    if (!skip.has(k.toLowerCase()) && v !== undefined) out[k] = v;
  }
  return out;
}
