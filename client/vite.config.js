import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  resolve: {
    alias: {
      'monaco-editor/esm/vs/editor/editor.api.js': 'monaco-editor',
    },
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'robots.txt', 'icons/*.png', 'logo.png'],
      manifest: {
        id: 'https://filetools-app.vercel.app/',
        name: 'FileTools Pro',
        short_name: 'FileTools',
        description: 'Nền tảng xử lý file tốc độ cao & bảo mật — Miễn phí 100%',
        theme_color: '#08080C',
        background_color: '#08080C',
        display: 'standalone',
        display_override: ['window-controls-overlay', 'standalone', 'minimal-ui'],
        orientation: 'any',
        start_url: '/',
        scope: '/',
        lang: 'vi',
        dir: 'ltr',
        handle_links: 'preferred',
        categories: ['productivity', 'utilities', 'photo'],
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/icon-512-mask.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        shortcuts: [
          { name: 'Nén PDF', url: '/pdf/compress', icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }] },
          { name: 'Gộp PDF', url: '/pdf/merge', icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }] },
          { name: 'Chỉnh ảnh', url: '/image', icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }] },
          { name: 'Workflow Studio', url: '/workflows', icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }] },
        ],
        file_handlers: [
          {
            action: '/pdf',
            name: 'Tài liệu PDF',
            icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }],
            accept: { 'application/pdf': ['.pdf'] },
          },
          {
            action: '/convert/word-to-pdf',
            name: 'Tài liệu Word',
            icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }],
            accept: {
              'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
              'application/msword': ['.doc'],
            },
          },
          {
            action: '/image',
            name: 'Tệp Hình Ảnh',
            icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }],
            accept: { 'image/*': ['.png', '.jpg', '.jpeg', '.webp'] },
          },
        ],
        screenshots: [
          {
            src: '/logo.png',
            sizes: '1280x720',
            type: 'image/png',
            form_factor: 'wide',
            label: 'Màn hình làm việc chính của FileTools Pro',
          },
        ],
      },
      workbox: {
        maximumFileSizeToCacheInBytes: 15 * 1024 * 1024,
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//, /^\/outputs\//, /^\/collab/, /^\/socket\.io\//],
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          // Strict Allowlist: CHỈ lưu tạm các endpoint GET public phi định danh, tuyệt đối không cache private/user/auth/billing
          {
            urlPattern: /^\/api\/(payment\/(plans|status)|workflows\/templates|health)$/,
            handler: 'NetworkFirst',
            method: 'GET',
            options: {
              cacheName: 'public-api-cache-v2',
              expiration: { maxEntries: 20, maxAgeSeconds: 300 },
              networkTimeoutSeconds: 5,
              cacheableResponse: {
                statuses: [200],
              },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts',
              expiration: { maxEntries: 10, maxAgeSeconds: 365 * 24 * 60 * 60 },
            },
          },
          {
            urlPattern: /^https:\/\/cdnjs\.cloudflare\.com/,
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'cdn-cache' },
          },
        ],
      },
    }),
  ],
  server: {
    port: 3030,
    strictPort: true,
    host: true,
    proxy: {
      '/api': {
        target: process.env.VITE_API_URL || 'http://localhost:3002',
        changeOrigin: true,
      },
      '/outputs': {
        target: process.env.VITE_API_URL || 'http://localhost:3002',
        changeOrigin: true,
      },
    },
  },
  preview: {
    port: 3030,
    strictPort: true,
    host: true,
  },
  build: {
    chunkSizeWarningLimit: 3000,
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom', 'zustand'],
          'vendor-icons': ['lucide-react'],
          'vendor-pdf': ['pdfjs-dist'],
          'vendor-dnd': ['@dnd-kit/core', '@dnd-kit/sortable', '@dnd-kit/utilities'],
          'vendor-table': ['@tanstack/react-table'],
          'vendor-collab': ['yjs', 'y-websocket', 'y-monaco'],
        },
      },
    },
  },
});
