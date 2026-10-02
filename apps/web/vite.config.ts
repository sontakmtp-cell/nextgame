import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  server: { port: 5173, strictPort: true, proxy: { '/api': 'http://127.0.0.1:3001' } },
  resolve: {
    alias: {
      '@prompt-chien/renderer': path.resolve(__dirname, '../../packages/renderer/src/index.ts'),
      '@engine': path.resolve(__dirname, '../../packages/engine/src/index.ts'),
      '@brain': path.resolve(__dirname, '../../packages/brain/src/index.ts'),
      '@content': path.resolve(__dirname, '../../packages/content/src/index.ts'),
      '@replay': path.resolve(__dirname, '../../packages/replay/src/index.ts')
    }
  }
});
