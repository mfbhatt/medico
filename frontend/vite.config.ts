import path from 'path';
import react from '@vitejs/plugin-react';
import basicSsl from '@vitejs/plugin-basic-ssl';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const facebookAppId = env.VITE_FACEBOOK_APP_ID ?? '';
  const apiUrl = env.VITE_API_URL ?? 'http://localhost:8000/api/v1';
  const proxyTarget = apiUrl.startsWith('/') ? 'http://localhost:8000' : apiUrl.replace(/\/api\/v\d+$/, '');

  return {
  plugins: [
    react(),
    basicSsl(),
    // Inject VITE_FACEBOOK_APP_ID into the FB.init placeholder in index.html
    {
      name: 'html-facebook-appid',
      transformIndexHtml(html: string) {
        return html.replace('__FACEBOOK_APP_ID__', facebookAppId);
      },
    },
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    https: true,
    proxy: {
      '/api': {
        target: proxyTarget,
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          redux: ['@reduxjs/toolkit', 'react-redux'],
          query: ['@tanstack/react-query'],
          charts: ['chart.js', 'react-chartjs-2'],
          ui: ['@radix-ui/react-dialog', '@radix-ui/react-dropdown-menu'],
        },
      },
    },
  },
  };
});
