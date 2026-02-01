import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    hmr: {
      // Allow HMR from any host (Tailscale, LAN, etc.)
      clientPort: 5173,
      host: '0.0.0.0',
    },
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8432',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
  },
});
