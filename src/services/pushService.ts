import { ref, remove, serverTimestamp, update } from 'firebase/database';
import { db } from '../config/firebase';
import { assertOnline } from './guard';

/**
 * ═══════════════════════════════════════════════════════════════════
 *  התראות פוש — Web Push תקני עם VAPID
 * ═══════════════════════════════════════════════════════════════════
 *
 *  מה עובד ואיפה:
 *   · אנדרואיד — בדפדפן ובאפליקציה מותקנת. עובד גם אחרי שבוע סגור.
 *   · אייפון   — **רק כשהאפליקציה מותקנת למסך הבית**, מ-iOS 16.4.
 *                בטאב רגיל בספארי אין Push API בכלל, ואין שום עקיפה.
 *
 *  לכן isStandalone נבדק לפני הכל: בלי התקנה אין טעם אפילו לבקש
 *  הרשאה באייפון — הבקשה פשוט תיכשל והמשתמש יחשוב שמשהו שבור.
 * ═══════════════════════════════════════════════════════════════════
 */

export type PushSupport =
  | 'ready' // אפשר לבקש הרשאה
  | 'needs-install' // אייפון בטאב רגיל — חייב התקנה קודם
  | 'unsupported'; // הדפדפן לא תומך בכלל

export interface PushState {
  support: PushSupport;
  permission: NotificationPermission;
  subscribed: boolean;
}

/** האם האפליקציה רצה כאפליקציה מותקנת ולא כטאב */
export function isStandalone(): boolean {
  if (window.matchMedia('(display-mode: standalone)').matches) return true;
  // ספארי באייפון לא תומך ב-display-mode ומשתמש בדגל קנייני
  return (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

export function isIOS(): boolean {
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    // אייפד מודרני מדווח על עצמו כ-Mac; מזהים לפי מסך מגע
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
}

export function getSupport(): PushSupport {
  const hasApi =
    'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

  if (!hasApi) {
    // באייפון ה-API פשוט לא קיים עד שמתקינים — זה לא "לא נתמך"
    return isIOS() ? 'needs-install' : 'unsupported';
  }

  if (isIOS() && !isStandalone()) return 'needs-install';
  return 'ready';
}

export function getPermission(): NotificationPermission {
  return 'Notification' in window ? Notification.permission : 'denied';
}

/**
 * ממיר מפתח VAPID מ-base64url ל-ArrayBuffer, כפי ש-pushManager דורש.
 * מוחזר ArrayBuffer ולא Uint8Array כי זה מה ש-BufferSource מצפה לו.
 */
function urlBase64ToBuffer(base64: string): ArrayBuffer {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const normalized = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(normalized);

  const buffer = new ArrayBuffer(raw.length);
  const view = new Uint8Array(buffer);
  for (let i = 0; i < raw.length; i++) view[i] = raw.charCodeAt(i);
  return buffer;
}

/**
 * מזהה יציב למנוי, נגזר מכתובת ה-endpoint.
 *
 * ה-endpoint עצמו ארוך ומכיל תווים שאסורים כמפתח ב-Firebase, ולכן
 * לא ניתן להשתמש בו ישירות. מזהה דטרמיניסטי מונע כפילויות: מנוי
 * שנרשם שוב מאותו מכשיר דורס את עצמו במקום ליצור רשומה נוספת.
 */
function subscriptionId(endpoint: string): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < endpoint.length; i++) {
    const c = endpoint.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0;
    h2 = Math.imul(h2 + c, 0x85ebca6b) >>> 0;
  }
  return `s${h1.toString(36)}${h2.toString(36)}`;
}

async function getRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null;
  try {
    return await navigator.serviceWorker.ready;
  } catch {
    return null;
  }
}

/** האם המכשיר הזה כבר רשום לקבלת התראות */
export async function isSubscribed(): Promise<boolean> {
  const reg = await getRegistration();
  if (!reg) return false;
  return (await reg.pushManager.getSubscription()) !== null;
}

export async function getState(): Promise<PushState> {
  return {
    support: getSupport(),
    permission: getPermission(),
    subscribed: await isSubscribed(),
  };
}

export class PushError extends Error {}

/**
 * מבקש הרשאה, נרשם לפוש, ושומר את המנוי ב-RTDB.
 *
 * ‼️ חייב להיקרא מתוך אירוע מגע של המשתמש. דפדפנים — ובמיוחד ספארי —
 * דוחים בקשת הרשאה שלא הגיעה מלחיצה ישירה.
 */
export async function subscribeToPush(userId: string): Promise<void> {
  assertOnline('להפעיל התראות');

  const support = getSupport();
  if (support === 'needs-install') {
    throw new PushError('כדי לקבל התראות באייפון צריך להוסיף את האפליקציה למסך הבית');
  }
  if (support === 'unsupported') {
    throw new PushError('הדפדפן הזה לא תומך בהתראות');
  }

  const permission = await Notification.requestPermission();
  if (permission === 'denied') {
    throw new PushError(
      'ההתראות חסומות. אפשר להפעיל אותן מחדש בהגדרות הדפדפן עבור האתר הזה.'
    );
  }
  if (permission !== 'granted') {
    throw new PushError('לא אישרת קבלת התראות');
  }

  const reg = await getRegistration();
  if (!reg) throw new PushError('לא הצלחנו לרשום את המכשיר. נסו לרענן את הדף.');

  // מנוי קיים נשמר כמו שהוא — אין טעם לייצר endpoint חדש בכל הפעלה
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToBuffer(__VAPID_PUBLIC_KEY__),
    }));

  const json = sub.toJSON() as {
    endpoint?: string;
    keys?: { p256dh?: string; auth?: string };
  };

  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
    throw new PushError('המנוי שהתקבל חסר. נסו שוב.');
  }

  await update(ref(db, `users/${userId}/pushSubscriptions/${subscriptionId(json.endpoint)}`), {
    endpoint: json.endpoint,
    p256dh: json.keys.p256dh,
    auth: json.keys.auth,
    platform: isIOS() ? 'ios' : 'other',
    createdAt: serverTimestamp(),
  });
}

/** מבטל את ההרשמה במכשיר הזה ומוחק אותה מהשרת */
export async function unsubscribeFromPush(userId: string): Promise<void> {
  const reg = await getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  if (!sub) return;

  const endpoint = sub.endpoint;
  await sub.unsubscribe().catch(() => false);

  try {
    await remove(ref(db, `users/${userId}/pushSubscriptions/${subscriptionId(endpoint)}`));
  } catch {
    // אם המחיקה נכשלה, השולח ימחק את המנוי בעצמו כשיקבל 410 Gone
  }
}
