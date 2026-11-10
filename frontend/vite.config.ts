import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

const API = process.env.SS_API ?? 'http://127.0.0.1:8000';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': { target: API, changeOrigin: false },
      '/media': { target: API, changeOrigin: false },
      '/sitemap.xml': { target: API, changeOrigin: false },
      '/robots.txt': { target: API, changeOrigin: false },
    },
  },
  build: {
    outDir: fileURLToPath(new URL('../backend/app/static', import.meta.url)),
    emptyOutDir: true,
    target: 'es2022',
    cssCodeSplit: true,
    sourcemap: false,
    chunkSizeWarningLimit: 700,
  },
});
