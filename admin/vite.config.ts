import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

/**
 * ‼️ קונפיגורציה נפרדת לגמרי מזו של האפליקציה הראשית:
 *    אין PWA, אין Service Worker, אין קאשינג. הקונסולה חייבת להראות
 *    את המצב *עכשיו* — Service Worker שמגיש מסך מלפני שעה הוא בדיוק
 *    ההפך ממה שכלי ניטור אמור לעשות.
 */
const port = Number(process.env.ADMIN_WEB_PORT ?? 5199);
const apiPort = Number(process.env.ADMIN_PORT ?? 5190);

export default defineConfig({
  root: fileURLToPath(new URL('./web', import.meta.url)),
  plugins: [react()],
  server: {
    port,
    strictPort: true,
    host: '127.0.0.1',
    proxy: {
      '/api': {
        target: `http://127.0.0.1:${apiPort}`,
        changeOrigin: false,
        // SSE חייב לעבור בלי חציצה
        ws: false,
      },
    },
  },
  build: {
    outDir: fileURLToPath(new URL('./dist', import.meta.url)),
    emptyOutDir: true,
    sourcemap: true,
  },
});
