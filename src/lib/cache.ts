import { get as idbGet, set as idbSet, del as idbDel, keys as idbKeys } from 'idb-keyval';

/**
 * מטמון קריאה ב-IndexedDB.
 *
 * ה-SDK של RTDB ל-Web **לא** שומר נתונים לדיסק (setPersistenceEnabled
 * קיים רק ב-Android/iOS). בלי המטמון הזה, פתיחת האפליקציה ללא רשת
 * מציגה מסך טעינה אינסופי. ראו docs/05-offline-pwa.md
 */

interface Entry<T> {
  value: T;
  cachedAt: number;
  uid: string;
}

const key = (path: string) => `cache:${path}`;
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export async function writeCache(path: string, uid: string, value: unknown): Promise<void> {
  try {
    const entry: Entry<unknown> = { value, cachedAt: Date.now(), uid };
    await idbSet(key(path), entry);
  } catch {
    // מכסת אחסון מלאה, מצב פרטי, או דפדפן שחוסם IndexedDB.
    // המטמון הוא שיפור ולא תלות — נכשלים בשקט.
  }
}

export async function readCache<T>(path: string, uid: string): Promise<Entry<T> | null> {
  try {
    const entry = await idbGet<Entry<T>>(key(path));
    if (!entry) return null;
    if (entry.uid !== uid) return null; // 🔒 מטמון של משתמש אחר
    if (Date.now() - entry.cachedAt > MAX_AGE_MS) return null;
    return entry;
  } catch {
    return null;
  }
}

/**
 * ‼️ חובה בעת התנתקות.
 * במעונות מכשיר עובר בין אנשים. בלי הניקוי הזה, המשתמש הבא רואה את
 * החדר, המאזנים והקניות של הקודם — בלי להתחבר בכלל.
 */
export async function clearAllCache(): Promise<void> {
  try {
    const all = await idbKeys();
    await Promise.all(
      all
        .filter((k): k is string => typeof k === 'string' && k.startsWith('cache:'))
        .map((k) => idbDel(k))
    );
  } catch {
    /* מתעלמים */
  }
}
