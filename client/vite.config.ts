
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'

const appRoot = path.resolve(__dirname, 'GYM PRO Web Prototype')

export default defineConfig({
  root: appRoot,
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(appRoot, 'src'),
    },
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
    },
  },
})
