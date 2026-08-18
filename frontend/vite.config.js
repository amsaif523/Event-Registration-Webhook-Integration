import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Dev proxy sends /api to the PHP backend, which keeps the browser talking to
// one origin. That matters more than convenience here: the auth cookies are
// SameSite=Strict, so anything genuinely cross-origin would not send them at
// all. Same-origin in production too, so the app never needs CORS.
//
// Point PROXY_TARGET at an Apache/XAMPP vhost instead if that is how you serve
// backend/public; the built-in server below is just the quickest way to run it.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: process.env.PROXY_TARGET ?? 'http://127.0.0.1:8080',
        changeOrigin: true,
      },
    },
  },
});
