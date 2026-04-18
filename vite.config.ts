import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'
import { firebaseMessagingSwPlugin } from './vite-plugins/firebase-messaging-sw'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    // Substitutes REPLACE_ME_FIREBASE_* placeholders in
    // public/firebase-messaging-sw.js with the actual VITE_FIREBASE_*
    // env values at build time + serves the substituted file in dev.
    // SW files can't read import.meta.env, so this plugin keeps the
    // single source of truth in .env without forcing manual edits to
    // the SW source file. See vite-plugins/firebase-messaging-sw.ts.
    firebaseMessagingSwPlugin(),
  ],
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
