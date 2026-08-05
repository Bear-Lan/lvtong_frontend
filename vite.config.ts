import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    host: true,
    proxy: {
      // mock_back（HTTP 8081）
      '/api/mock': {
        target: 'http://localhost:8081',
        changeOrigin: true,
      },
      // MediaMTX WebRTC / WHEP（lvtong-backend/tools/mediamtx，:8889）
      '/mtx': {
        target: 'http://127.0.0.1:8889',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/mtx/, ''),
      },
      // VisualSurveillance WebStreamDemo（MJPEG / 状态，:8765）
      '/vs': {
        target: 'http://127.0.0.1:8765',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/vs/, ''),
      },
      // flask_backend HTTP 8080（HTTPS 跑 8081 给移动 app，Vite 走 HTTP）
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
      '/ws': {
        target: 'ws://localhost:8080',
        ws: true,
        changeOrigin: true,
      },
      '/socket.io': {
        target: 'http://localhost:8080',
        ws: true,
        changeOrigin: true,
      },
    },
  },
})
