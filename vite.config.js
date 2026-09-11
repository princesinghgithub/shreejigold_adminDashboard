import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// dev में ऐप 5173 पर चलता है और backend 4000 पर. /api को यहीं से backend पर भेज देते हैं,
// ताकि ऐप के कोड में हमेशा एक ही पता ('/api') रहे — असली इस्तेमाल में backend खुद
// बना हुआ ऐप परोसता है, तो वहाँ भी '/api' अपने आप सही निकलता है.
export default defineConfig({
  plugins: [react()],
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
