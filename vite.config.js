import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// dev में ऐप 5173 पर चलता है और backend 4000 पर. /api को यहीं से backend पर भेज देते हैं,
// ताकि ऐप के कोड में हमेशा एक ही पता ('/api') रहे — असली इस्तेमाल में backend खुद
// बना हुआ ऐप परोसता है, तो वहाँ भी '/api' अपने आप सही निकलता है.
export default defineConfig({
  plugins: [
    react(),
    // PWA — मोबाइल/कंप्यूटर पर "Install" करके ऐप की तरह खुलता है.
    // सिर्फ ऐप का ढाँचा (JS/CSS/फोटो) cache होता है. /api का डेटा (बिल, रेट, स्टॉक) कभी cache नहीं होता,
    // ताकि पुराना रेट या पुराना हिसाब गलती से न दिखे — वो हमेशा सर्वर से ताज़ा आता है.
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeManifestIcons: false, // icons पहले से globPatterns में आ जाते हैं
      manifest: {
        id: '/',
        name: 'Shreeji Gold — बिलिंग सिस्टम',
        short_name: 'Shreeji Gold',
        description: 'Shreeji Gold ज्वेलरी दुकान का बिलिंग, स्टॉक और ग्राहक हिसाब',
        lang: 'hi',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'any',
        background_color: '#FBF6EC',
        theme_color: '#6B1E23',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,ico,woff2}'],
        // main bundle बड़ा है (jspdf वगैरह), default 2MB की सीमा में आगे न अटके
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//],
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.origin === 'https://fonts.googleapis.com',
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'google-fonts-css' },
          },
          {
            urlPattern: ({ url }) => url.origin === 'https://fonts.gstatic.com',
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-files',
              expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  // SHREEJI_URL (backend का पता) ऐप के कोड तक पहुँचे — Vite सिर्फ इन prefix वाले variables देता है.
  // ध्यान: SHREEJI_ से शुरू होने वाला हर variable browser में दिखता है, इसमें कोई secret न रखें
  envPrefix: ['VITE_', 'SHREEJI_'],
  server: {
    host: true, // मोबाइल से भी खुल सके (http://<कंप्यूटर का IP>:5173)
    proxy: {
      '/api': {
        target: process.env.VITE_BACKEND || 'http://localhost:4000',
        changeOrigin: true,
      },
    },
  },
});
