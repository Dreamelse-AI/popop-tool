import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';

export default defineConfig(({ mode }) => {
  // 读取 .env 里的密钥，仅在 dev server 进程内使用，绝不暴露给前端 bundle
  const env = loadEnv(mode, process.cwd(), '');
  const imageApiKey = env.IMAGE_API_KEY ?? '';
  const imageApiTarget = env.IMAGE_API_TARGET ?? 'https://api.apimart.ai';

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
        // 图像生成代理：注入 Authorization 头并转发到 apimart
        '/img-api': {
          target: imageApiTarget,
          changeOrigin: true,
          rewrite: (p) => p.replace(/^\/img-api/, ''),
          configure: (proxy) => {
            proxy.on('proxyReq', (proxyReq) => {
              if (imageApiKey) {
                proxyReq.setHeader('Authorization', `Bearer ${imageApiKey}`);
              }
            });
          },
        },
      },
    },
  };
});
