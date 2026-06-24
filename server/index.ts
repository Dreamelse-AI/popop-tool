/**
 * 生产环境 Express 服务端（单进程）。
 *
 * 职责：
 *   1. 托管前端构建产物 dist/（Vite 输出的静态 SPA）
 *   2. 代理 /apimart/* → apimart，运行时从环境变量注入 Authorization（key 不进前端 bundle）
 *   3. /health 健康检查（K8s 探针用）
 *
 * 开发环境仍走 vite dev server（见 vite.config.ts），本文件只在生产/容器内运行。
 * 端口：PORT（默认 3000），绑定 0.0.0.0。
 */

import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { createApimartProxy } from './apimartProxy';
import { createArcaProxy } from './arcaProxy';
import { createAuthMiddleware } from './auth';
import { handleUpload, type UploadRequestBody } from './moodpicRoute';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const APIMART_API_KEY = process.env.APIMART_API_KEY ?? '';
const APIMART_API_TARGET = process.env.APIMART_API_TARGET ?? 'https://api.apimart.ai';
const ARCA_ORIGIN = process.env.ARCA_ORIGIN ?? 'https://i18n-api.imaginewithu.com';
const ACCESS_TOKEN = process.env.ACCESS_TOKEN ?? '';

const app = express();

// 鉴权：放最前（中间件内部放行 /health）。未配 ACCESS_TOKEN 则不启用。
app.use(createAuthMiddleware());

// 健康检查：无任何依赖
app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok', time: new Date().toISOString() });
});

// apimart 代理：转发 /apimart/* 并注入 Authorization 头
app.use('/apimart', createApimartProxy());

// arca 代理：转发 /arca/* 到 arca 海外后端（图库等接口）
app.use('/arca', createArcaProxy());

// MoodPic 写链路：拉 apimart 图 → 传 OSS → 登记 arca。需 JSON body 解析。
app.post('/api/moodpic/upload', express.json({ limit: '1mb' }), async (req, res) => {
  try {
    const result = await handleUpload(req.body as UploadRequestBody);
    res.status(200).json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : '上传失败';
    console.error('[moodpic] 上传失败:', message);
    res.status(500).json({ error: message });
  }
});

// 托管前端静态产物
const distPath = path.join(__dirname, '..');
const indexHtml = path.join(distPath, 'index.html');
const hasFrontend = fs.existsSync(indexHtml);

if (hasFrontend) {
  app.use(express.static(distPath, { index: false }));
  // SPA 回退：非 /apimart、/arca、/api、/health 的路由都回 index.html
  app.get(/^\/(?!apimart\/|arca\/|api\/|health).*/, (_req, res) => {
    res.sendFile(indexHtml);
  });
} else {
  console.warn('[server] 未找到前端产物 index.html，仅提供 /apimart、/arca 与 /health');
}

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`[server] 已启动 http://0.0.0.0:${PORT}`);
  console.log(`[server] apimart 目标：${APIMART_API_TARGET}`);
  console.log(`[server] arca 目标：${ARCA_ORIGIN}`);
  console.log(`[server] apimart key：${APIMART_API_KEY ? '已配置' : '未配置（生成会 401）'}`);
  console.log(`[server] 访问鉴权：${ACCESS_TOKEN ? '已开启（需 ?token= 或 cookie）' : '未开启（建议生产配置 ACCESS_TOKEN）'}`);
});

server.on('error', (err) => {
  console.error('[server] 启动失败:', err);
  process.exit(1);
});

process.on('SIGTERM', () => server.close(() => process.exit(0)));
process.on('SIGINT', () => server.close(() => process.exit(0)));

export default app;
