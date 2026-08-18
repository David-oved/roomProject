/// <reference lib="webworker" />
import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching';
import { clientsClaim } from 'workbox-core';

declare const self: ServiceWorkerGlobalScope & typeof globalThis;

/**
 * ═══════════════════════════════════════════════════════════════════
 *  Service Worker — הגשת נכסים + התראות פוש
 * ═══════════════════════════════════════════════════════════════════
 *
 *  למה SW אחד ולא שניים: לדפדפן יכול להיות רק Service Worker אחד
 *  שולט על scope מסוים. קובץ FCM נפרד (firebase-messaging-sw.js) היה
 *  מתנגש עם ה-SW של Workbox ואחד מהם היה מבטל את השני.
 *
 *  למה Web Push תקני ולא FCM: FCM מוסיף SDK כבד ודורש service account
 *  לשליחה. Push API עם VAPID עושה בדיוק אותו דבר — כולל באייפון מ-16.4
 *  כשהאפליקציה מותקנת למסך הבית — בלי שום תלות נוספת בצד הלקוח.
 * ═══════════════════════════════════════════════════════════════════
 */

precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();
clientsClaim();

interface PushPayload {
  title: string;
  body: string;
  /** נתיב יחסי בתוך האפליקציה, למשל "/r/ABC123/items" */
  url?: string;
  /** מקבץ התראות מאותו סוג — התראה חדשה מחליפה קודמת במקום להיערם */
  tag?: string;
}

self.addEventListener('push', (event: PushEvent) => {
  /**
   * ‼️ חובה להציג התראה בכל אירוע push.
   *
   * דפדפנים — ובמיוחד ספארי — שוללים את הרשאת הפוש מאפליקציה
   * שמקבלת push ולא מציגה כלום ("silent push"). לכן גם כשהמידע פגום
   * מוצגת התראה גנרית במקום לצאת בשקט.
   */
  let payload: PushPayload = { title: 'RoomMate', body: 'יש עדכון חדש בחדר' };

  try {
    if (event.data) payload = { ...payload, ...(event.data.json() as PushPayload) };
  } catch {
    /* מידע לא תקין — נשארים עם ברירת המחדל */
  }

  const url = payload.url ?? '/';

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: './icons/icon-192.png',
      badge: './icons/icon-192.png',
      tag: payload.tag ?? 'roommate',
      dir: 'rtl',
      lang: 'he',
      data: { url },
      // רטט קצר — נתמך באנדרואיד, מתעלמים ממנו ב-iOS
      vibrate: [60, 40, 60],
    } as NotificationOptions)
  );
});

self.addEventListener('notificationclick', (event: NotificationEvent) => {
  event.notification.close();

  const target = (event.notification.data as { url?: string })?.url ?? '/';

  /**
   * אם האפליקציה כבר פתוחה — מביאים אותה לחזית ומנווטים בתוכה, במקום
   * לפתוח חלון נוסף. משתמש שלוחץ על התראה מצפה לחזור לאפליקציה שלו,
   * לא לקבל עותק שני שלה.
   */
  event.waitUntil(
    (async () => {
      const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });

      for (const client of all) {
        if ('focus' in client) {
          await client.focus();
          client.postMessage({ type: 'NAVIGATE', url: target });
          return;
        }
      }

      const base = self.registration.scope;
      await self.clients.openWindow(`${base}#${target}`);
    })()
  );
});

// מאפשר לאפליקציה לבקש החלפה מיידית של SW ממתין
self.addEventListener('message', (event: ExtendableMessageEvent) => {
  if ((event.data as { type?: string })?.type === 'SKIP_WAITING') {
    void self.skipWaiting();
  }
});
