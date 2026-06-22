/**
 * 简单口令鉴权中间件（ACCESS_TOKEN + cookie）。
 *
 * 思路（参考 tool-station 已验证的做法）：
 *   - 用 ?token=xxx 首次访问 → 校验通过后 Set-Cookie，后续免带 token
 *   - 已有有效 cookie → 放行
 *   - 否则 → 403
 *
 * 与 tool-station 不同：这里【/apimart 也要鉴权】，避免他人知道域名后
 * 直接调用花钱的生图接口。仅放行 /health（K8s 探针用，且不暴露任何数据）。
 *
 * 若未配置 ACCESS_TOKEN（环境变量为空），视为不启用鉴权，全部放行
 *（方便本地开发；生产务必配置）。
 */

import type { Request, Response, NextFunction } from 'express';

const ACCESS_TOKEN = process.env.ACCESS_TOKEN ?? '';
const COOKIE_NAME = 'popop_access';
/** cookie 有效期 30 天 */
const COOKIE_MAX_AGE_S = 30 * 24 * 3600;

/** 从 Cookie 头解析出指定 cookie 值。 */
function readCookie(cookieHeader: string | undefined, name: string): string | null {
  if (!cookieHeader) return null;
  for (const pair of cookieHeader.split(';')) {
    const idx = pair.indexOf('=');
    if (idx === -1) continue;
    const k = pair.slice(0, idx).trim();
    if (k === name) return decodeURIComponent(pair.slice(idx + 1).trim());
  }
  return null;
}

export function createAuthMiddleware() {
  return (req: Request, res: Response, next: NextFunction): void => {
    // 未配置 token：不启用鉴权（本地开发）
    if (!ACCESS_TOKEN) {
      next();
      return;
    }

    // 健康检查放行（探针无 cookie，且不涉及敏感数据）
    if (req.path === '/health') {
      next();
      return;
    }

    const urlToken = typeof req.query.token === 'string' ? req.query.token : null;
    const cookieToken = readCookie(req.headers.cookie, COOKIE_NAME);

    if (urlToken === ACCESS_TOKEN) {
      // URL 带正确 token：种 cookie 后放行（HttpOnly + SameSite，生产可加 Secure）
      res.setHeader(
        'Set-Cookie',
        `${COOKIE_NAME}=${encodeURIComponent(ACCESS_TOKEN)}; Path=/; Max-Age=${COOKIE_MAX_AGE_S}; HttpOnly; SameSite=Lax`,
      );
      next();
      return;
    }

    if (cookieToken === ACCESS_TOKEN) {
      next();
      return;
    }

    // 无有效凭据 → 403
    res.status(403).type('html').send(
      `<!doctype html><meta charset="utf-8"><title>需要访问口令</title>` +
        `<div style="font-family:system-ui;max-width:480px;margin:80px auto;text-align:center;color:#333">` +
        `<h2>需要访问口令</h2>` +
        `<p style="color:#888">请通过带口令的链接访问：<code>?token=你的口令</code></p></div>`,
    );
  };
}
