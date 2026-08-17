import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { APP_VERSION } from './lib/version';
import './styles/index.css';

// מסך הפתיחה הסטטי סיים את תפקידו
document.getElementById('boot-splash')?.remove();

const root = document.getElementById('root');
if (!root) throw new Error('חסר אלמנט #root ב-index.html');

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>
);

/**
 * רישום ה-Service Worker.
 *
 * שימו לב: אנחנו **לא** משתמשים בהתראת העדכון של vite-plugin-pwa.
 * מנגנון העדכון של האפליקציה מבוסס על version.json ומנוהל ב-
 * UpdateContext — ראו src/lib/version.ts. שני מנגנונים מתחרים היו
 * מבלבלים את המשתמש.
 */
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  void import('virtual:pwa-register').then(({ registerSW }) => {
    registerSW({
      immediate: true,
      onOfflineReady() {
        console.info('✅ האפליקציה מוכנה לעבודה ללא רשת');
      },
    });
  });
}

console.info(`🏠 RoomMate v${APP_VERSION}`);
