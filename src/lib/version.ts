/**
 * ═══════════════════════════════════════════════════════════════════
 *  מנגנון גרסאות ועדכון תוכנה
 * ═══════════════════════════════════════════════════════════════════
 *
 *  הבעיה: משתמש שהתקין את ה-PWA למסך הבית מקבל קבצים שנשמרו במטמון
 *  ובמנוע ה-Service Worker. גם אחרי שמעלים גרסה חדשה ל-GitHub Pages,
 *  הוא עלול להמשיך להריץ את הישנה ימים.
 *
 *  הפתרון: קובץ יחיד — public/version.json — שנקרא מהרשת בכל כניסה
 *  לאפליקציה, ולעולם לא נשמר במטמון. אם הגרסה שבו שונה מהגרסה
 *  שהוטבעה ב-build הנוכחי, יש עדכון.
 *
 *      version.json  ─(fetch no-store)→  השוואה  →  התראה / עדכון כפוי
 *           ▲                                ▲
 *           │ נקרא גם ב-build                │
 *           └────→ __APP_VERSION__ ──────────┘
 *
 *  כדי לשחרר גרסה: npm run release -- 1.0.1 "מה חדש"
 * ═══════════════════════════════════════════════════════════════════
 */

/** הגרסה שרצה כרגע אצל המשתמש. מוטבעת בזמן ה-build. */
export const APP_VERSION: string = __APP_VERSION__;

/** מתי נבנתה הגרסה שרצה כרגע. */
export const BUILD_TIME: string = __BUILD_TIME__;

export interface VersionManifest {
  /** מספר הגרסה, למשל "1.0.1" */
  version: string;
  /** תאריך השחרור (להצגה) */
  releasedAt?: string;
  /** ‼️ true = עדכון מיידי בלי לשאול את המשתמש */
  forceUpdate: boolean;
  /** כותרת קצרה לתצוגה, למשל "שיפורי ביצועים" */
  title?: string;
  /** רשימת שינויים להצגה למשתמש */
  notes?: string[];
}

/** מונע לולאת עדכון אינסופית אם version.json לא תואם ל-build שהועלה. */
const FORCE_ATTEMPTS_KEY = 'rm:force-update-attempts';
const MAX_FORCE_ATTEMPTS = 2;

/**
 * קורא את מניפסט הגרסה מהשרת.
 * שלוש שכבות של עקיפת מטמון, כי GitHub Pages מגיש עם max-age=600:
 *   1. פרמטר ייחודי ב-URL
 *   2. cache: 'no-store'
 *   3. כותרת Cache-Control
 */
export async function fetchRemoteVersion(signal?: AbortSignal): Promise<VersionManifest> {
  const url = `${import.meta.env.BASE_URL}version.json?t=${Date.now().toString(36)}`;

  const res = await fetch(url, {
    cache: 'no-store',
    headers: { 'Cache-Control': 'no-cache', Pragma: 'no-cache' },
    signal,
  });

  if (!res.ok) {
    throw new Error(`שליפת version.json נכשלה (${res.status})`);
  }

  const data = (await res.json()) as Partial<VersionManifest>;

  if (typeof data.version !== 'string' || data.version.length === 0) {
    throw new Error('version.json חסר שדה version תקין');
  }

  return {
    version: data.version,
    releasedAt: data.releasedAt,
    forceUpdate: data.forceUpdate === true,
    title: data.title,
    notes: Array.isArray(data.notes) ? data.notes : [],
  };
}

/**
 * משווה שתי גרסאות בפורמט semver ("1.2.3").
 * מחזיר: 1 אם a > b, ‏-1 אם a < b, ‏0 אם שוות.
 * חלקים לא מספריים מושווים כמחרוזות, כך ש-"1.0.0-beta" לא מפיל את ההשוואה.
 */
export function compareVersions(a: string, b: string): number {
  const pa = a.split(/[.\-+]/);
  const pb = b.split(/[.\-+]/);
  const len = Math.max(pa.length, pb.length);

  for (let i = 0; i < len; i++) {
    const sa = pa[i] ?? '0';
    const sb = pb[i] ?? '0';
    const na = Number(sa);
    const nb = Number(sb);

    if (Number.isFinite(na) && Number.isFinite(nb)) {
      if (na !== nb) return na > nb ? 1 : -1;
    } else if (sa !== sb) {
      return sa > sb ? 1 : -1;
    }
  }
  return 0;
}

/** האם הגרסה שעל השרת שונה מזו שרצה כרגע. */
export function isUpdateAvailable(remote: string): boolean {
  return compareVersions(remote, APP_VERSION) !== 0;
}

/**
 * מבצע עדכון תוכנה מלא: מוחק את כל המטמונים, מבטל את רישום ה-Service
 * Worker, וטוען מחדש עם עוקף-מטמון — כך שכל הקבצים יורדים מחדש מהשרת.
 *
 * ⚠️ מה שלא נמחק בכוונה: IndexedDB. שם יושבים נתוני המשתמש (מטמון
 *    הקריאה של החדר), והם לא חלק מקוד האפליקציה.
 */
export async function performUpdate(): Promise<void> {
  // 1) ביטול רישום כל ה-Service Workers
  try {
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister().catch(() => false)));
    }
  } catch {
    /* לא קריטי — ממשיכים לניקוי המטמון */
  }

  // 2) מחיקת כל מטמוני ה-Cache Storage (הקבצים שה-SW שמר)
  try {
    if ('caches' in globalThis) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k).catch(() => false)));
    }
  } catch {
    /* לא קריטי */
  }

  // 3) טעינה מחדש עם פרמטר ייחודי — עוקף גם את מטמון ה-HTML של GitHub Pages
  const url = new URL(window.location.href);
  url.searchParams.set('_v', Date.now().toString(36));
  window.location.replace(url.toString());
}

/**
 * שומר הלולאה לעדכון כפוי.
 *
 * תרחיש הכשל: מעלים version.json עם 1.0.1 אבל שוכחים לבנות מחדש את
 * הקוד. אז __APP_VERSION__ נשאר 1.0.0, ההשוואה תמיד תיכשל, והאפליקציה
 * תיכנס ללולאת רענון אינסופית שהמשתמש לא יכול לצאת ממנה.
 *
 * לכן: אחרי 2 ניסיונות כפויים באותו סשן, מפסיקים לכפות ומציגים
 * למשתמש באנר רגיל שאפשר לסגור.
 */
export function canForceUpdate(): boolean {
  try {
    const n = Number(sessionStorage.getItem(FORCE_ATTEMPTS_KEY) ?? '0');
    return n < MAX_FORCE_ATTEMPTS;
  } catch {
    return true;
  }
}

export function recordForceAttempt(): void {
  try {
    const n = Number(sessionStorage.getItem(FORCE_ATTEMPTS_KEY) ?? '0');
    sessionStorage.setItem(FORCE_ATTEMPTS_KEY, String(n + 1));
  } catch {
    /* מצב פרטי — מתעלמים */
  }
}

export function clearForceAttempts(): void {
  try {
    sessionStorage.removeItem(FORCE_ATTEMPTS_KEY);
  } catch {
    /* מתעלמים */
  }
}
