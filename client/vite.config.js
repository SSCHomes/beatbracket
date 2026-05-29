import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'BeatBracket',
        short_name: 'BeatBracket',
        description: 'March Madness-style music voting tournaments',
        theme_color: '#0A0A0B',
        background_color: '#0A0A0B',
        display: 'standalone',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' }
        ]
      }
    })
  ],
  server: {
    proxy: {
      '/api': 'http://localhost:3001',
      '/auth': 'http://localhost:3001'
    }
  }
});
