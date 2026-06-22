import { defineConfig } from 'vite';
import path from 'node:path';

/**
 * 生产服务端构建配置：把 server/index.ts 打包成 dist/server/index.mjs。
 * express 与 Node 内置模块标记为 external，运行时从 node_modules 解析。
 */
export default defineConfig({
  build: {
    lib: {
      entry: path.resolve(__dirname, 'server/index.ts'),
      formats: ['es'],
      fileName: () => 'index.mjs',
    },
    outDir: 'dist/server',
    target: 'node22',
    ssr: true,
    rollupOptions: {
      external: [
        'node:http',
        'node:https',
        'node:path',
        'node:fs',
        'node:url',
        'express',
      ],
      output: { format: 'es', entryFileNames: 'index.mjs' },
    },
    minify: false,
    emptyOutDir: true,
  },
});
