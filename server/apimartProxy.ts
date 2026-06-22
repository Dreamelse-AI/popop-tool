/**
 * apimart 反向代理中间件。
 *
 * 把 /apimart/* 转发到 apimart，运行时注入 Authorization 头。
 * key 只存在于服务端进程环境变量里，绝不出现在前端 bundle。
 *
 * 用 Node 原生 https 透传，避免引入额外代理库；流式 pipe 请求体与响应体。
 */

import https from 'node:https';
import http from 'node:http';
import type { Request, Response } from 'express';

const APIMART_API_KEY = process.env.APIMART_API_KEY ?? '';
const APIMART_API_TARGET = process.env.APIMART_API_TARGET ?? 'https://api.apimart.ai';

/** 上游超时（生图为异步任务，单请求不会太久；轮询是多次短请求）。 */
const UPSTREAM_TIMEOUT_MS = 60_000;

export function createApimartProxy() {
  const target = new URL(APIMART_API_TARGET);
  const lib = target.protocol === 'https:' ? https : http;

  if (!APIMART_API_KEY) {
    console.warn('[apimart] 未配置 APIMART_API_KEY，转发将不带鉴权头，上游会返回 “API key is required”');
  }

  return (req: Request, res: Response): void => {
    // req.url 此处已是去掉 /apimart 前缀后的路径（express 子路由）
    const upstreamPath = req.url;

    const headers: http.OutgoingHttpHeaders = {
      ...filterHeaders(req.headers),
      host: target.host,
    };
    // key 为空时不塞空 authorization 头，避免“看起来带了头其实是空”的误导
    if (APIMART_API_KEY) {
      headers.authorization = `Bearer ${APIMART_API_KEY}`;
    }

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
      console.error('[apimart] 转发失败:', err.message);
      if (!res.headersSent) {
        res.status(502).json({ error: { message: `上游连接失败：${err.message}` } });
      } else {
        res.end();
      }
    });

    upstream.on('timeout', () => {
      upstream.destroy();
      if (!res.headersSent) {
        res.status(504).json({ error: { message: '上游超时' } });
      }
    });

    req.pipe(upstream);
  };
}

/** 过滤掉逐跳头与会干扰转发的头。 */
function filterHeaders(headers: http.IncomingHttpHeaders): http.OutgoingHttpHeaders {
  const out: http.OutgoingHttpHeaders = {};
  const skip = new Set([
    'host',
    'authorization',
    'connection',
    'content-length',
    'transfer-encoding',
  ]);
  for (const [k, v] of Object.entries(headers)) {
    if (!skip.has(k.toLowerCase()) && v !== undefined) out[k] = v;
  }
  return out;
}
