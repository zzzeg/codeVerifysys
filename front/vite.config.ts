import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    AutoImport({
      dts: false,
      resolvers: [ElementPlusResolver()],
    }),
    Components({
      dts: false,
      resolvers: [ElementPlusResolver({ importStyle: 'css' })],
    }),
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return

          if (id.includes('@element-plus/icons-vue')) return 'element-plus-icons'
          if (id.includes('element-plus')) return 'element-plus'
          if (id.includes('vue')) return 'vue-vendor'
          if (id.includes('pinia') || id.includes('vue-router') || id.includes('axios')) return 'app-vendor'
        },
      },
    },
  },
  server: {
    host: '0.0.0.0',
    strictPort: true,
    hmr: {
      protocol: 'ws',
      clientPort: 5173,
    },
    watch: {
      usePolling: true,
      interval: 300,
    },
    proxy: {
      '/api': {
        target: process.env.VITE_DEV_API_TARGET || 'http://127.0.0.1:3000',
        changeOrigin: true,
      },
      '/uploads': {
        target: process.env.VITE_DEV_API_TARGET || 'http://127.0.0.1:3000',
        changeOrigin: true,
      },
    },
  },
})
