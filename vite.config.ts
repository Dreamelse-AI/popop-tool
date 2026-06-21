import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';

export default defineConfig({
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
    },
  },
});
