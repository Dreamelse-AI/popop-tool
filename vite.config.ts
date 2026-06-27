import { defineConfig, loadEnv } from 'vite';
import type { PluginOption } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';
import { HttpsProxyAgent } from 'https-proxy-agent';

/**
 * dev 环境挂图片只读代理中间件（生产由 Express 承担），复用 server/imageProxy。
 * 表情包 canvas 切图/抠图要读跨域图片像素，经同源代理规避 CORS。
 */
function imageProxyPlugin(): PluginOption {
  return {
    name: 'image-proxy-dev',
    configureServer(server) {
      server.middlewares.use('/api/img-proxy', async (req, res) => {
        try {
          const { createImageProxy } = await server.ssrLoadModule('/server/imageProxy.ts');
          const handler = createImageProxy();
          // 解析 query.url（中间件里 req.url 含 querystring）
          const u = new URL(req.url ?? '', 'http://localhost');
          const expressLike = Object.assign(req, {
            query: { url: u.searchParams.get('url') ?? '' },
          });
          const resLike = Object.assign(res, {
            status(code: number) {
              res.statusCode = code;
              return resLike;
            },
            json(body: unknown) {
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify(body));
              return resLike;
            },
            setHeader: res.setHeader.bind(res),
          });
          handler(expressLike as never, resLike as never);
        } catch (err) {
          const message = err instanceof Error ? err.message : '取图失败';
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: message }));
        }
      });
    },
  };
}

/**
 * dev 专用：注入 OSS 环境变量并挂封面上传中间件，复用生产同一套 handleCoverUpload，
 * 避免 dev/prod 两套上传逻辑分叉。
 */
function styleCoverUploadPlugin(env: Record<string, string>): PluginOption {
  return {
    name: 'style-cover-upload-dev',
    configureServer(server) {
      for (const k of [
        'OSS_REGION',
        'OSS_BUCKET',
        'OSS_ACCESS_KEY_ID',
        'OSS_ACCESS_KEY_SECRET',
        'OSS_PREFIX',
      ]) {
        if (env[k] && !process.env[k]) process.env[k] = env[k];
      }
      server.middlewares.use('/api/style-cover/upload', (req, res, next) => {
        if (req.method !== 'POST') return next();
        void server
          .ssrLoadModule('/server/coverUploadHandler.ts')
          .then(({ handleCoverUpload }) => handleCoverUpload(req, res))
          .catch((err: unknown) => {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(
              JSON.stringify({
                code: 500,
                msg: err instanceof Error ? err.message : '上传失败',
                data: null,
              }),
            );
          });
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  // 读取 .env 里的密钥，仅在 dev server 进程内使用，绝不暴露给前端 bundle
  const env = loadEnv(mode, process.cwd(), '');
  const apimartKey = env.APIMART_API_KEY ?? '';
  const apimartTarget = env.APIMART_API_TARGET ?? 'https://api.apimart.ai';
  // 可选上游代理：本机科学上网端口。配了就让转发请求经它出网
  const upstreamProxy = env.UPSTREAM_PROXY ?? '';
  const proxyAgent = upstreamProxy ? new HttpsProxyAgent(upstreamProxy) : undefined;
  // arca 海外后端域名（图库等接口），dev 走 vite proxy 规避 CORS
  const arcaOrigin = env.ARCA_ORIGIN ?? 'https://i18n-api.imaginewithu.com';
  // 后台管理口令：dev 反代层注入 X-Admin-Token，不进前端 bundle
  const adminApiToken = env.ADMIN_API_TOKEN ?? '';

  return {
    plugins: [react(), tailwindcss(), imageProxyPlugin(), styleCoverUploadPlugin(env)],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'src'),
      },
    },
    server: {
      port: 5181,
      strictPort: true,
      proxy: {
        // 本地临时后端（结构抽取 AI 代理、mock）
        '/local-api': {
          target: 'http://127.0.0.1:9527',
          changeOrigin: true,
          rewrite: (p) => p.replace(/^\/local-api/, '/api'),
        },
        // 图像生成代理：转发到 apimart 并注入 Authorization 头
        '/apimart': {
          target: apimartTarget,
          changeOrigin: true,
          agent: proxyAgent,
          rewrite: (p) => p.replace(/^\/apimart/, ''),
          configure: (proxy) => {
            proxy.on('proxyReq', (proxyReq) => {
              if (apimartKey) {
                proxyReq.setHeader('Authorization', `Bearer ${apimartKey}`);
              }
            });
            // 转发失败（连不上 / 超时 / 代理错误）：打印真实原因到 dev server 终端
            proxy.on('error', (err) => {
              console.error('[apimart] 转发失败:', err.message);
            });
            // 上游返回非 2xx：把状态码和 body 打到终端，便于定位真实错误
            proxy.on('proxyRes', (proxyRes, req) => {
              const status = proxyRes.statusCode ?? 0;
              if (status >= 400) {
                let body = '';
                proxyRes.on('data', (chunk) => {
                  body += chunk.toString();
                });
                proxyRes.on('end', () => {
                  console.error(
                    `[apimart] 上游 ${status} ${req.url}\n上游响应: ${body.slice(0, 800) || '(空 body)'}`,
                  );
                });
              }
            });
          },
        },
        // arca 海外后端代理：转发 /arca/* 到 arca，规避 CORS
        '/arca': {
          target: arcaOrigin,
          changeOrigin: true,
          rewrite: (p) => p.replace(/^\/arca/, ''),
          configure: (proxy) => {
            // 注入后台管理口令（X-Admin-Token），前端不持有
            proxy.on('proxyReq', (proxyReq) => {
              if (adminApiToken) proxyReq.setHeader('X-Admin-Token', adminApiToken);
            });
            proxy.on('error', (err) => {
              console.error('[arca] 转发失败:', err.message);
            });
            proxy.on('proxyRes', (proxyRes, req) => {
              const status = proxyRes.statusCode ?? 0;
              if (status >= 400) {
                let body = '';
                proxyRes.on('data', (chunk) => {
                  body += chunk.toString();
                });
                proxyRes.on('end', () => {
                  console.error(
                    `[arca] 上游 ${status} ${req.url}\n上游响应: ${body.slice(0, 800) || '(空 body)'}`,
                  );
                });
              }
            });
          },
        },
      },
    },
  };
});
