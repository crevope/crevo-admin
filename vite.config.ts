import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  server: {
    port: 3002,
    proxy: {
      // Mirror crevo-web's Next.js rewrite: the SPA hits its own origin at
      // /api/* and Vite forwards to the backend. This keeps auth cookies
      // same-origin and eliminates cross-site SameSite / CSRF headaches
      // regardless of whether you browse at localhost or a LAN IP.
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
})
