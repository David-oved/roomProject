import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/**
 * מקור האמת היחיד לגרסה הוא public/version.json.
 * ה-build מזריק ממנו את המספר לתוך הקוד (__APP_VERSION__), כך שאי אפשר
 * שהגרסה שרצה אצל המשתמש והגרסה שעל השרת ייצאו מסנכרון.
 * ראו docs/10-versioning.md
 */
const versionFile = fileURLToPath(new URL('./public/version.json', import.meta.url));
const versionInfo = JSON.parse(readFileSync(versionFile, 'utf8')) as {
  version: string;
  forceUpdate: boolean;
};

export default defineConfig({
  // נתיבים יחסיים — עובד בכל תת-תיקייה של GitHub Pages
  // (https://david-oved.github.io/roomProject/) בלי לקודד את שם ה-repo.
  base: './',

  define: {
    __APP_VERSION__: JSON.stringify(versionInfo.version),
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
  },

  plugins: [
    react(),

    VitePWA({
      registerType: 'prompt',
      injectRegister: 'auto',
      includeAssets: ['favicon.svg', 'icons/apple-touch-icon-180.png'],

      manifest: {
        name: 'RoomMate — ניהול חדר משותף',
        short_name: 'RoomMate',
        description: 'ניהול קניות, מוצרים חסרים וחלוקת הוצאות בחדר משותף',
        lang: 'he',
        dir: 'rtl',
        start_url: './',
        scope: './',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#f8fafc',
        theme_color: '#0f766e',
        categories: ['productivity', 'finance', 'lifestyle'],
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'icons/icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },

      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        // ‼️ version.json לעולם לא נכנס למטמון — הוא מנגנון זיהוי העדכון עצמו.
        globIgnores: ['**/version.json'],
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts',
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: /^https:\/\/firebasestorage\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'firebase-images',
              expiration: { maxEntries: 60, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },

      devOptions: { enabled: false },
    }),
  ],

  build: {
    target: 'es2020',
    // בלי זה נכסים ישנים נערמים ב-dist ותופחים ל-Service Worker
    // עוד מאות KB שהמשתמש מוריד לחינם.
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'firebase-core': ['firebase/app', 'firebase/auth'],
          'firebase-db': ['firebase/database'],
        },
      },
    },
  },
});
