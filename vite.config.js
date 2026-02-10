import { defineConfig } from 'vite'
import { resolve } from 'path'

export default defineConfig({
  root: resolve(import.meta.dirname, 'src/client'),
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: resolve(import.meta.dirname, 'dist'),
    emptyOutDir: true,
  },
})
