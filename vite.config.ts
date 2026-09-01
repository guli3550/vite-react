import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Production-safe Vite config.
// Keep AdminPro source intact so the real order drawer (including receipt preview)
// is not replaced by a stale build-time string patch.
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 3000,
    allowedHosts: true,
  },
  preview: {
    host: '0.0.0.0',
    port: 3000,
  },
})
