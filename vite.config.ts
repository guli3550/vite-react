import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

declare const process: { env: Record<string, string | undefined> };

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0', port: 3000, allowedHosts: true,
    proxy: { '/api': { target: process.env.VITE_API_URL || 'https://guli-lingerie-api.onrender.com', changeOrigin: true, secure: false } },
  },
  preview: { host: '0.0.0.0', port: 3000 },
})

