import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
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

/**
 * מזהה בנייה ייחודי.
 *
 * למה זה נחוץ בנוסף למספר הגרסה: אם מעלים קוד חדש ושוכחים להעלות את
 * version.json, המנגנון לא מזהה עדכון — ומשתמש שכבר התקין את ה-PWA
 * נשאר תקוע על הגרסה הישנה לנצח, כי ה-Service Worker מגיש לו את
 * הקבצים מהמטמון. קרה בפועל.
 *
 * ה-SHA משתנה בכל commit, ולכן כל פריסה מזוהה — גם בלי לזכור כלום.
 */
function resolveBuildId(): string {
  if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA.slice(0, 12);
  try {
    return execSync('git rev-parse --short=12 HEAD', { encoding: 'utf8' }).trim();
  } catch {
    return 'dev-' + Date.now().toString(36);
  }
}

const buildId = resolveBuildId();

/**
 * המפתח הציבורי של VAPID. אינו סוד — הוא נשלח לשירות הפוש של הדפדפן
 * ונועד להיות גלוי בקוד. הפרטי יושב ב-GitHub Secrets בלבד.
 */
const VAPID_PUBLIC_KEY =
  process.env.VITE_VAPID_PUBLIC_KEY ??
  'BH5y7BmvAbHTN78e9HG4KxxGNuK7B9FXpmIujAxDSg8ZnV84UmGop4Gfn5AoNh9RxnYll3-x0eTFisvGkRmUxHo';

export default defineConfig({
  // נתיבים יחסיים — עובד בכל תת-תיקייה של GitHub Pages
  // (https://david-oved.github.io/roomProject/) בלי לקודד את שם ה-repo.
  base: './',

  define: {
    __APP_VERSION__: JSON.stringify(versionInfo.version),
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
    __BUILD_ID__: JSON.stringify(buildId),
    __VAPID_PUBLIC_KEY__: JSON.stringify(VAPID_PUBLIC_KEY),
  },

  plugins: [
    react(),

    VitePWA({
      // injectManifest ולא generateSW: אנחנו כותבים את ה-SW בעצמנו
      // כדי שיטפל גם בהתראות פוש. ראו src/sw.ts
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
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
          // ‼️ הכלל הקודם כאן הצביע על firebasestorage.googleapis.com —
          // מארח שהאפליקציה הזאת לא פונה אליו בכלל. תמונות הפרופיל מוגשות
          // מ-res.cloudinary.com (ראו secure_url ב-avatarService), ולכן זה
          // המארח הנכון. ההעלאה עצמה (api.cloudinary.com) בכוונה לא במטמון.
          //
          // ‼️‼️ אזהרה — כרגע כל בלוק runtimeCaching הזה **מת**, כולל כלל
          // הפונטים שמעליו: strategies כאן הוא 'injectManifest', ואנחנו
          // כותבים את ה-SW בעצמנו ב-src/sw.ts. runtimeCaching היא אופציה
          // של generateSW בלבד — vite-plugin-pwa מתעלם ממנה כאן בשקט.
          // בדוק: אין אף אזכור של cloudinary/googleapis ב-dist/sw.js, ו-sw.ts
          // עושה רק precacheAndRoute, בלי registerRoute אחד.
          // כדי שהאווטארים באמת ייכנסו למטמון צריך registerRoute מפורש
          // ב-src/sw.ts — וזה דורש workbox-strategies + workbox-expiration,
          // שאינם מוצהרים ב-package.json (רק workbox-routing/core/precaching
          // מוצהרים). התיקון כאן הוא תיקון *נכונות של הקונפיג* בלבד.
          {
            urlPattern: /^https:\/\/res\.cloudinary\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'avatar-images',
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
