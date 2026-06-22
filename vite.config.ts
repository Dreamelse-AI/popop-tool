import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';
import { HttpsProxyAgent } from 'https-proxy-agent';

export default defineConfig(({ mode }) => {
  // 读取 .env 里的密钥，仅在 dev server 进程内使用，绝不暴露给前端 bundle
  const env = loadEnv(mode, process.cwd(), '');
  const apimartKey = env.APIMART_API_KEY ?? '';
  const apimartTarget = env.APIMART_API_TARGET ?? 'https://api.apimart.ai';
  // 可选上游代理：本机科学上网端口。配了就让转发请求经它出网
  const upstreamProxy = env.UPSTREAM_PROXY ?? '';
  const proxyAgent = upstreamProxy ? new HttpsProxyAgent(upstreamProxy) : undefined;

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'src'),
      },
    },
    server: {
      port: 5180,
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
      },
    },
  };
});
