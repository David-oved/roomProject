# 05 · אופליין, מטמון ו-PWA

---

## 1. המודל: אופליין = קריאה בלבד

```
🟢 מחובר   →  קריאה + כתיבה.  כל האפליקציה עובדת.
🔴 מנותק   →  קריאה בלבד מהמטמון המקומי.
               כל פעולה שדורשת ענן חסומה, עם הסבר ברור למשתמש.
```

### מה עובד ומה לא — הטבלה המחייבת

| פעולה | 🟢 מחובר | 🔴 מנותק |
|-------|:--------:|:--------:|
| כניסה לאפליקציה (סשן קיים) | ✅ | ✅ |
| צפייה ברשימת המוצרים החסרים | ✅ | ✅ מהמטמון |
| צפייה במאזן שלי | ✅ | ✅ מהמטמון |
| צפייה בהיסטוריית קניות | ✅ | ✅ מהמטמון |
| צפייה ברשימת חברי החדר | ✅ | ✅ מהמטמון |
| **התחברות/הרשמה ראשונית** | ✅ | ❌ |
| **דיווח על מוצר חסר** | ✅ | ❌ |
| **"אני קונה את זה"** | ✅ | ❌ |
| **"קניתי" + הזנת סכום** | ✅ | ❌ |
| **אישור/דחייה של מנהל** | ✅ | ❌ |
| **יצירת חדר / הצטרפות** | ✅ | ❌ |
| **הסרת חבר / שינוי הגדרות** | ✅ | ❌ |
| **העלאת חשבונית** | ✅ | ❌ |

### למה זו ההחלטה הנכונה

**הסיבה הטכנית:** ה-SDK של RTDB ל-Web לא שומר לדיסק (ראו [README](./README.md#️-ארבע-החלטות-ארכיטקטוניות-שחייבים-להבין-לפני-שכותבים-שורת-קוד)). כתיבה אופליין הייתה מחייבת אותנו לבנות תור כתיבות משלנו, על כל מה שנלווה לזה: שחזור לפי סדר, טיפול בכשלונות באמצע, ומחיקת פעולות שכבר לא רלוונטיות.

**הסיבה המהותית, והחשובה יותר:** באפליקציה **כספית משותפת**, כתיבה אופליין יוצרת מצבים שאין להם פתרון נכון.

> שני שותפים בסופר, שניהם בלי קליטה. שניהם מסמנים "אני קונה חלב". שניהם קונים. שניהם חוזרים הביתה.
>
> כשהרשת חוזרת יש שתי קניות חלב באותו יום, שתי חלוקות הוצאות, וכל אחד מהם חושב שהוא היחיד שקנה. **Last-Write-Wins של Firebase לא פותר את זה** — הוא רק קובע איזו משתי האמיתות נדרסת, בלי שאיש יידע.

הקריאה-בלבד מונעת את כל מחלקת הבעיות הזו. **המחיר קטן:** משתמש בלי קליטה ממילא לא רואה מה החברים שלו עשו בינתיים, ולכן הפעולה שלו הייתה מבוססת על מידע ישן.

**מה שהמשתמש כן מקבל:** האפליקציה **נפתחת** בלי רשת, מציגה תוכן אמיתי, ואומרת בבירור מה אפשר ומה לא. זה רחוק מאוד מ"האפליקציה לא עובדת".

---

## 2. זיהוי מצב החיבור

### 2.1 · שני מקורות מידע, לא אחד

```ts
navigator.onLine      // "יש ממשק רשת פעיל" — לא אומר שיש אינטרנט!
                      // Wi-Fi של בית קפה בלי אישור = true, אבל אין חיבור
ref(db, '.info/connected')   // "יש WebSocket פתוח מול Firebase" — האמת האמיתית
```

**הכלל שלנו:**

- `.info/connected` הוא **מקור האמת** — הוא מה שקובע אם מותר לכתוב.
- `navigator.onLine === false` הוא **קיצור דרך לזיהוי מיידי**: כשהמשתמש מפעיל מצב טיסה, האירוע מגיע מיד, בעוד ש-`.info/connected` לוקח כמה שניות לזהות ניתוק.

```ts
const isOnline = navigator.onLine && firebaseConnected;
```

> ⚠️ **מלכודת:** ב-`.info/connected` מגיע `false` גם בזמן חיבור מחדש לגיטימי (למשל אחרי החזרת הטאב מרקע). אל תציגו באנר "אין אינטרנט" לפני **השהיה של ~2 שניות** — אחרת הבאנר יהבהב כל כמה דקות ויעצבן.

### 2.2 · ConnectionContext

```tsx
// src/store/ConnectionContext.tsx
import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { onValue, ref } from 'firebase/database';
import { db } from '../config/firebase';

type ConnectionState = {
  isOnline: boolean;
  lastSyncAt: number | null;   // מתי בפעם האחרונה היינו מחוברים
};

const Ctx = createContext<ConnectionState>({ isOnline: true, lastSyncAt: null });
export const useConnection = () => useContext(Ctx);

export function ConnectionProvider({ children }: { children: React.ReactNode }) {
  const [fbConnected, setFbConnected] = useState(true);
  const [navOnline, setNavOnline] = useState(navigator.onLine);
  const [lastSyncAt, setLastSyncAt] = useState<number | null>(null);
  const debounce = useRef<ReturnType<typeof setTimeout>>();

  // מקור 1: WebSocket מול Firebase
  useEffect(() => {
    return onValue(ref(db, '.info/connected'), (snap) => {
      const connected = snap.val() === true;
      clearTimeout(debounce.current);

      if (connected) {
        setFbConnected(true);          // חיבור — מיד, בלי השהיה
        setLastSyncAt(Date.now());
      } else {
        // ניתוק — רק אחרי 2 שניות, כדי לא להבהב בחיבורים מחדש קצרים
        debounce.current = setTimeout(() => setFbConnected(false), 2000);
      }
    });
  }, []);

  // מקור 2: הדפדפן
  useEffect(() => {
    const on = () => setNavOnline(true);
    const off = () => setNavOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);

  return (
    <Ctx.Provider value={{ isOnline: navOnline && fbConnected, lastSyncAt }}>
      {children}
    </Ctx.Provider>
  );
}
```

---

## 3. שומר הכתיבה — נקודת האכיפה

### 3.1 · `services/guard.ts`

```ts
// src/services/guard.ts

/** שגיאה ייעודית לפעולה שנחסמה בגלל היעדר רשת. */
export class OfflineError extends Error {
  readonly code = 'app/offline';
  constructor(action?: string) {
    super(action
      ? `לא ניתן ${action} ללא חיבור לאינטרנט`
      : 'פעולה זו דורשת חיבור לאינטרנט');
    this.name = 'OfflineError';
  }
}

/** מצב החיבור העדכני. מתעדכן מ-ConnectionProvider. */
let online = true;
export const setOnlineState = (v: boolean) => { online = v; };

/** ‼️ נקראת בשורה הראשונה של כל פונקציית service שכותבת. */
export function assertOnline(action?: string): void {
  if (!online) throw new OfflineError(action);
}
```

מודול-מצב פשוט ולא Context — כי `services/` אינו מכיר את React (ראו [חוק הייבוא](./01-architecture.md#חוק-הייבוא-היחיד)). ה-Provider מזרים אליו את המצב:

```tsx
// בתוך ConnectionProvider
useEffect(() => { setOnlineState(navOnline && fbConnected); }, [navOnline, fbConnected]);
```

### 3.2 · שימוש ב-UI

```tsx
// src/hooks/useOfflineGuard.ts
export function useOfflineGuard() {
  const { isOnline } = useConnection();
  return {
    isOnline,
    /** לפרוס על כל כפתור שמבצע פעולת ענן */
    guardProps: {
      disabled: !isOnline,
      title: isOnline ? undefined : 'פעולה זו דורשת חיבור לאינטרנט',
      'aria-disabled': !isOnline,
    },
  };
}
```

```tsx
// שימוש בקומפוננטה
function ItemCard({ item }: { item: Item }) {
  const { guardProps } = useOfflineGuard();

  return (
    <article className="rounded-xl border p-4">
      <h3>{item.name}</h3>
      <Button {...guardProps} onClick={() => claimItem(...)}>
        אני קונה את זה
      </Button>
    </article>
  );
}
```

### 3.3 · רשת ביטחון בשכבת ה-UI

גם עם `assertOnline()` בכל service, כדאי לתפוס `OfflineError` במקום אחד מרכזי, למקרה שפונקציה חדשה תישכח:

```tsx
// src/store/ToastContext.tsx — עוטף כל קריאת service
export async function runAction<T>(fn: () => Promise<T>, toast: ToastApi): Promise<T | null> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof OfflineError) {
      toast.warn(err.message, { icon: '📡' });
    } else if ((err as { code?: string })?.code === 'PERMISSION_DENIED') {
      toast.error('אין לך הרשאה לבצע פעולה זו');
    } else {
      toast.error('משהו השתבש. נסו שוב.');
      console.error(err);
    }
    return null;
  }
}
```

---

## 4. מטמון הקריאה

זה החלק שגורם לאפליקציה **להיפתח** בלי רשת ולהראות תוכן אמיתי.

### 4.1 · הבעיה שהוא פותר

```
משתמש פותח את האפליקציה במעלית, בלי קליטה:
  בלי מטמון  →  onValue לא מחזיר כלום  →  מסך טעינה אינסופי  →  "האפליקציה שבורה"
  עם מטמון   →  התוכן מוצג תוך 200ms מ-IndexedDB  →  "האפליקציה עובדת"
```

### 4.2 · `lib/cache.ts`

```ts
// src/lib/cache.ts
import { get as idbGet, set as idbSet, del as idbDel, keys as idbKeys } from 'idb-keyval';

type Entry<T> = { value: T; cachedAt: number; uid: string };

const key = (path: string) => `cache:${path}`;
const MAX_AGE = 7 * 24 * 60 * 60 * 1000;   // שבוע

export async function writeCache(path: string, uid: string, value: unknown): Promise<void> {
  try {
    await idbSet(key(path), { value, cachedAt: Date.now(), uid } satisfies Entry<unknown>);
  } catch {
    // מכסת אחסון מלאה או מצב פרטי — המטמון הוא שיפור, לא תלות. מתעלמים בשקט.
  }
}

export async function readCache<T>(path: string, uid: string): Promise<Entry<T> | null> {
  try {
    const entry = await idbGet<Entry<T>>(key(path));
    if (!entry) return null;
    if (entry.uid !== uid) return null;                    // 🔒 מטמון של משתמש אחר
    if (Date.now() - entry.cachedAt > MAX_AGE) return null; // ישן מדי
    return entry;
  } catch {
    return null;
  }
}

/** ‼️ חובה בעת התנתקות — אחרת המשתמש הבא במכשיר יראה את נתוני החדר של הקודם. */
export async function clearAllCache(): Promise<void> {
  const all = await idbKeys();
  await Promise.all(
    all.filter((k) => typeof k === 'string' && k.startsWith('cache:'))
       .map((k) => idbDel(k))
  );
}
```

> 🔒 **שתי נקודות פרטיות שקל מאוד לפספס:**
> 1. **ניקוי בהתנתקות.** במעונות מכשיר עובר בין אנשים. בלי `clearAllCache()` ב-`logout()`, המשתמש הבא רואה את החדר, המאזנים והקניות של הקודם — בלי להתחבר בכלל.
> 2. **בדיקת `uid` בקריאה.** גם אם הניקוי נכשל (סגירת דפדפן באמצע), הבדיקה `entry.uid !== uid` מונעת דליפה.

### 4.3 · חיבור המטמון להאזנות

```ts
// src/hooks/useRtdbListCached.ts
import { useEffect, useState } from 'react';
import { onValue, ref } from 'firebase/database';
import { db } from '../config/firebase';
import { readCache, writeCache } from '../lib/cache';
import { useAuth } from './useAuth';

type State<T> = {
  data: T[];
  loading: boolean;
  error: Error | null;
  fromCache: boolean;      // האם מה שמוצג הוא נתון שמור ולא חי
  cachedAt: number | null;
};

export function useRtdbListCached<T>(path: string | null): State<T & { id: string }> {
  const { user } = useAuth();
  const [state, setState] = useState<State<T & { id: string }>>({
    data: [], loading: true, error: null, fromCache: false, cachedAt: null,
  });

  useEffect(() => {
    if (!path || !user) {
      setState({ data: [], loading: false, error: null, fromCache: false, cachedAt: null });
      return;
    }

    let live = false;   // האם כבר הגיע נתון אמיתי מהשרת
    const toList = (val: Record<string, T> | null) =>
      Object.entries(val ?? {}).map(([id, v]) => ({ ...v, id }));

    // 1) הידרציה מיידית מהמטמון — לא מחכים לרשת
    readCache<Record<string, T>>(path, user.uid).then((entry) => {
      if (entry && !live) {
        setState({
          data: toList(entry.value), loading: false, error: null,
          fromCache: true, cachedAt: entry.cachedAt,
        });
      }
    });

    // 2) האזנה חיה — דורסת את המטמון ברגע שמגיע נתון
    const unsubscribe = onValue(
      ref(db, path),
      (snap) => {
        live = true;
        const val = snap.val() as Record<string, T> | null;
        setState({
          data: toList(val), loading: false, error: null,
          fromCache: false, cachedAt: Date.now(),
        });
        void writeCache(path, user.uid, val);   // 3) שיקוף למטמון
      },
      (error) => {
        // נכשל (אין רשת / אין הרשאה) — אם יש מטמון, הוא כבר מוצג
        setState((s) => s.fromCache ? s : { ...s, loading: false, error });
      }
    );

    return unsubscribe;
  }, [path, user?.uid]);

  return state;
}
```

### 4.4 · מה שומרים במטמון ומה לא

| נתיב | במטמון? | סיבה |
|------|:-------:|------|
| `rooms/{code}/metadata` | ✅ | קטן, נדרש לכל מסך |
| `rooms/{code}/members` | ✅ | קטן, נדרש להצגת שמות |
| `rooms/{code}/items` | ✅ | הלב של האפליקציה |
| `rooms/{code}/purchases` | ✅ | מוגבל ל-100 האחרונות |
| `rooms/{code}/balances` | ✅ | קטן |
| `rooms/{code}/notifications` | ⚠️ 50 אחרונות | יכול לגדול ללא גבול |
| `rooms/{code}/pendingRequests` | ❌ | רלוונטי רק בזמן אמת |
| `users/{uid}` | ✅ | נדרש להצגת הפרופיל |

**תקציב אחסון:** ~200KB לחדר. IndexedDB נותן לרוב מאות MB. אין בעיה גם עם 10 חדרים.

### 4.5 · הצגת "נתונים לא טריים"

```tsx
// src/components/layout/StaleDataNotice.tsx
export function StaleDataNotice({ cachedAt }: { cachedAt: number | null }) {
  if (!cachedAt) return null;
  return (
    <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2">
      מציג נתונים מ־{formatTime(cachedAt)}. ייתכן שהשתנו מאז.
    </p>
  );
}
```

זו נקודה של אמון: משתמש שרואה מאזן ישן בלי אזהרה עלול לקבל החלטה כספית שגויה.

---

## 5. הבאנר

```tsx
// src/components/layout/OfflineBanner.tsx
export function OfflineBanner() {
  const { isOnline, lastSyncAt } = useConnection();
  if (isOnline) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="sticky top-0 z-50 flex items-center gap-2 bg-slate-800 px-4 py-2 text-sm text-white"
    >
      <span aria-hidden>📡</span>
      <span className="font-medium">אין חיבור לאינטרנט</span>
      <span className="text-slate-300">· צפייה בלבד</span>
      {lastSyncAt && (
        <span className="ms-auto text-xs text-slate-400">
          עודכן {formatRelative(lastSyncAt)}
        </span>
      )}
    </div>
  );
}
```

**כללי הבאנר:**
- `sticky top-0` — נשאר גלוי בגלילה. המשתמש חייב לדעת מתי הוא במצב הזה.
- **לא ניתן לסגירה.** מצב האפליקציה השתנה מהותית; זו לא הודעה חולפת.
- `aria-live="polite"` — מוקרא לקוראי מסך בלי לקטוע.
- נעלם **מיד** כשהחיבור חוזר.

---

## 6. Service Worker

### 6.1 · חלוקת התפקידים

```
Service Worker  →  מגיש את **קוד האפליקציה** (HTML/JS/CSS/פונטים/אייקונים)
IndexedDB       →  שומר את **הנתונים** (מוצרים, קניות, מאזנים)
```

שני מנגנונים נפרדים לגמרי. בלי SW, פתיחת האפליקציה בלי רשת מציגה את דינוזאור השגיאה של Chrome ואפילו לא מגיעה לקוד שיודע לקרוא מהמטמון.

### 6.2 · הגדרת `vite-plugin-pwa`

```ts
// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',   // ← לא autoUpdate. ראו סעיף 6.4
      includeAssets: ['favicon.svg', 'icons/apple-touch-icon-180.png'],

      manifest: {
        name: 'RoomMate — ניהול חדר משותף',
        short_name: 'RoomMate',
        description: 'ניהול קניות, מוצרים חסרים וחלוקת הוצאות בחדר משותף',
        lang: 'he',
        dir: 'rtl',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#ffffff',
        theme_color: '#0f766e',
        categories: ['productivity', 'finance', 'lifestyle'],
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/icon-maskable-512.png', sizes: '512x512',
            type: 'image/png', purpose: 'maskable' },
        ],
        shortcuts: [
          { name: 'דיווח על מוצר חסר', url: '/?action=report', icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }] },
          { name: 'המאזן שלי', url: '/?tab=balances' },
        ],
      },

      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        navigateFallback: '/index.html',
        cleanupOutdatedCaches: true,

        // ‼️ אין ליירט בקשות Firebase. ה-WebSocket של RTDB לא עובר דרך SW
        // בכל מקרה, אבל בקשות Auth ו-REST כן — ומטמון שלהן ישבור התחברות.
        navigateFallbackDenylist: [/^\/__/],
        runtimeCaching: [
          {
            // תמונות מ-Firebase Storage — נשמרות, אבל לא הבקשות עצמן לשירות
            urlPattern: /^https:\/\/firebasestorage\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'firebase-images',
              expiration: { maxEntries: 60, maxAgeSeconds: 30 * 24 * 60 * 60 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts',
              expiration: { maxEntries: 20, maxAgeSeconds: 365 * 24 * 60 * 60 },
            },
          },
        ],
      },

      devOptions: { enabled: false },   // SW בפיתוח = דיבוג מסויט
    }),
  ],

  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'firebase-core': ['firebase/app', 'firebase/auth'],
          'firebase-db': ['firebase/database'],
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
        },
      },
    },
  },
});
```

> 🚨 **אל תגדירו `runtimeCaching` על דומיינים של Firebase Auth או RTDB REST.** מטמון של תשובת אימות מחזיר טוקן פג-תוקף, והמשתמש נתקע במסך התחברות שלא מגיב. ה-WebSocket של RTDB לא עובר דרך Service Worker כלל — ולכן אין מה "לשפר" שם.

### 6.3 · רישום

```ts
// src/main.tsx
import { registerSW } from 'virtual:pwa-register';

const updateSW = registerSW({
  onNeedRefresh() {
    // גרסה חדשה מוכנה — שואלים את המשתמש
    showUpdateToast(() => updateSW(true));
  },
  onOfflineReady() {
    console.info('✅ האפליקציה מוכנה לעבודה ללא רשת');
  },
});
```

### 6.4 · למה `prompt` ולא `autoUpdate`

`autoUpdate` מרענן את האפליקציה **באמצע השימוש**. אם זה קורה בזמן שהמשתמש מקליד סכום של קנייה — הטופס נמחק, בלי הסבר.

עם `prompt` מציגים:

```
┌────────────────────────────────────────┐
│  🎉 גרסה חדשה זמינה                    │
│  [ עדכן עכשיו ]      [ אחר כך ]        │
└────────────────────────────────────────┘
```

---

## 7. iOS — ארבעה הבדלים שחייבים לדעת

Safari ב-iOS הוא המקום שבו PWA נשברות. ארבע נקודות:

| נושא | המצב ב-iOS | מה עושים |
|------|------------|----------|
| **התקנה** | אין `beforeinstallprompt`. אין באנר אוטומטי. | מסך הסבר ידני: *"שתף ⬆️ → הוסף למסך הבית"* |
| **פינוי אחסון** | Safari מוחק IndexedDB אחרי **7 ימים** בלי שימוש באתר | לא לסמוך על המטמון לנצח. אחרי פינוי — האפליקציה תציג מסך טעינה עד לחיבור |
| **Web Push** | נתמך רק מ-iOS 16.4, ו**רק** אם ה-PWA מותקנת למסך הבית | שלב 7 — התראות In-app תמיד, Push כבונוס |
| **Safe areas** | "הנאץ'" והפס התחתון חותכים תוכן | `viewport-fit=cover` + `env(safe-area-inset-*)` |

```html
<!-- index.html — חובה עבור iOS -->
<meta name="viewport"
      content="width=device-width, initial-scale=1, viewport-fit=cover" />
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-status-bar-style" content="default" />
<meta name="apple-mobile-web-app-title" content="RoomMate" />
<link rel="apple-touch-icon" href="/icons/apple-touch-icon-180.png" />
```

```css
/* אזורים בטוחים */
.app-shell { padding-top: env(safe-area-inset-top); }
.bottom-nav { padding-bottom: env(safe-area-inset-bottom); }
```

> **ההשלכה של פינוי האחסון:** במקרה הגרוע המשתמש פותח את האפליקציה בלי רשת אחרי שבועיים ורואה מסך ריק עם הודעה "אין נתונים שמורים — התחברו לאינטרנט כדי לטעון". זה מצב לגיטימי שצריך לעצב אליו מסך, לא באג.

---

## 8. בדיקת האופליין — 8 תרחישים

הבדיקות האלה **ידניות בלבד**; אוטומציה של מצבי רשת בדפדפן אמיתי לא אמינה מספיק.

| # | תרחיש | ציפייה |
|---|-------|--------|
| 1 | טוענים את האפליקציה → DevTools → Network → Offline → מרעננים | האפליקציה עולה, מציגה תוכן מהמטמון, באנר מופיע |
| 2 | במצב אופליין לוחצים "אני קונה את זה" | הכפתור מושבת, לא קורה כלום |
| 3 | במצב אופליין מנסים לפתוח טופס דיווח | כפתור ה-➕ מושבת |
| 4 | מחזירים רשת | הבאנר נעלם תוך שנייה, הכפתורים נדלקים, הנתונים מתעדכנים |
| 5 | מתנתקים (logout) → בודקים IndexedDB ב-DevTools | אין אף מפתח `cache:*` |
| 6 | משתמש A מתנתק, משתמש B מתחבר באותו מכשיר | B לא רואה שום נתון של A |
| 7 | מצב טיסה במכשיר אמיתי, פותחים מהמסך הבית | נפתח, מציג תוכן, לא קורס |
| 8 | Wi-Fi מחובר אך בלי אינטרנט (בית קפה) | תוך ~2 שניות מזוהה כמנותק |

**Lighthouse:** `npx lighthouse http://localhost:4173 --view` — קטגוריית PWA צריכה להיות 100.

---

## 9. מה שלא נבנה — ולמה זה מתועד

בפרויקט הזה **אין**:

- ❌ תור כתיבות (Outbox)
- ❌ Background Sync API
- ❌ פתרון התנגשויות (conflict resolution)
- ❌ עריכה אופטימית ללא רשת

זו **החלטת תכנון מודעת**, לא חוסר. אם בעתיד תרצו כתיבה אופליין, זה מה שיידרש — וכדאי לדעת את המחיר מראש:

1. תור מתמיד ב-IndexedDB עם סדר, ניסיונות חוזרים ותפוגה
2. מדיניות התנגשויות **לכל סוג ישות בנפרד** (מוצר ≠ קנייה ≠ מאזן)
3. UI שמבחין בין "נשמר" ל"ממתין לשליחה"
4. טיפול בכתיבה שנדחית ע"י Security Rules **אחרי** שהמשתמש כבר ראה אותה כמוצלחת
5. החלטה מה קורה לפעולה שממתינה כשהמשתמש מתנתק מהחשבון

**הערכה: 20–30 שעות נוספות**, ורוב הבאגים הקשים בפרויקט יגיעו משם. בחדר מעונות עם Wi-Fi יציב, התועלת אינה מצדיקה זאת.
