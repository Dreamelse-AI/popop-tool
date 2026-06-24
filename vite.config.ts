import { defineConfig, loadEnv, type PluginOption } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';
import { HttpsProxyAgent } from 'https-proxy-agent';

/**
 * dev 环境挂 MoodPic 写链路中间件（生产由 Express 承担）。
 * 复用 server/moodpicRoute 的 handleUpload，避免 dev/prod 两套逻辑。
 */
function moodpicUploadPlugin(): PluginOption {
  return {
    name: 'moodpic-upload-dev',
    configureServer(server) {
      server.middlewares.use('/api/moodpic/upload', (req, res, next) => {
        if (req.method !== 'POST') return next();
        let raw = '';
        req.on('data', (c) => {
          raw += c;
        });
        req.on('end', async () => {
          try {
            const { handleUpload } = await server.ssrLoadModule('/server/moodpicRoute.ts');
            const body = raw ? JSON.parse(raw) : {};
            const result = await handleUpload(body);
            res.setHeader('Content-Type', 'application/json');
            res.statusCode = 200;
            res.end(JSON.stringify(result));
          } catch (err) {
            const message = err instanceof Error ? err.message : '上传失败';
            console.error('[moodpic] 上传失败:', message);
            res.setHeader('Content-Type', 'application/json');
            res.statusCode = 500;
            res.end(JSON.stringify({ error: message }));
          }
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

  // dev 下把服务端用到的环境变量注入 process.env，供 moodpic 上传中间件（ssr 模块）读取。
  // 这些值只在 dev server 进程内，不进前端 bundle。
  for (const k of [
    'OSS_REGION',
    'OSS_BUCKET',
    'OSS_ACCESS_KEY_ID',
    'OSS_ACCESS_KEY_SECRET',
    'OSS_PREFIX',
    'ARCA_ORIGIN',
  ]) {
    if (env[k] != null && process.env[k] == null) process.env[k] = env[k];
  }

  return {
    plugins: [react(), tailwindcss(), moodpicUploadPlugin()],
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
