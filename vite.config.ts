import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { resolve } from 'node:path'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@shared': resolve(__dirname, 'src/shared'),
      '@renderer': resolve(__dirname, 'src/renderer'),
      '@': resolve(__dirname, 'src/renderer')
    }
  },
  server: {
    port: 5173,
    strictPort: true,
    // cargo 编译时锁定的文件会让 chokidar 报 EBUSY
    watch: { ignored: ['**/src-tauri/**', '**/node_modules/**'] }
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true
  }
})
