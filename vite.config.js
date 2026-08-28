import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    vue(),
    vueDevTools(),
    VitePWA({
      registerType: 'autoUpdate',

      manifest: {
        name: 'UniVent',
        short_name: 'UniVent',
        description: 'Discover and manage events at the University of Ilorin',
        icons: [
          {
            src: 'icons/android-icon-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'icons/android-icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
        ],
      },

      workbox: {
        runtimeCaching: [
          {
            urlPattern: ({ url }) =>
              url.hostname.endsWith('.supabase.co') && url.pathname.startsWith('/rest/v1/'),

            handler: 'NetworkFirst',

            options: {
              cacheName: 'supabase-rest-cache',

              networkTimeoutSeconds: 3,

              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24, // 1 day
              },

              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
        ],
      },

      devOptions: {
        enabled: true,
        type: 'module',
      },
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
