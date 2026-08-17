# 09 · Best Practices וטיפים מתקדמים

---

## 1. עשרת הכללים של הפרויקט

אם תזכרו רק דבר אחד מכל תיק התכנון — שיהיה זה.

| # | הכלל | הסיבה |
|---|------|-------|
| 1 | **כסף באגורות, תמיד** | float שובר מאזנים בשקט |
| 2 | **`assertOnline()` בכל כתיבה** | אחרת כתיבה נעלמת בלי הודעה |
| 3 | **כל `onValue` מחזיר `unsubscribe`** | דליפת האזנות מקפיאה את האפליקציה |
| 4 | **`update()` אטומי, לא `set()` מרובה** | מצבי ביניים = נתונים שבורים |
| 5 | **`serverTimestamp()`, לא `Date.now()`** | שעון הלקוח לא אמין |
| 6 | **מאזנים נגזרים, לא מצטברים** | ניתן לחשב מחדש בכל רגע |
| 7 | **`$other: false` על כל צומת** | חוסם זבל ותופס באגים מוקדם |
| 8 | **קומפוננטות לא מייבאות `firebase/*`** | ניתנות לבדיקה, ניתנות להחלפה |
| 9 | **`ms-*`/`me-*`, לעולם לא `ml-*`/`mr-*`** | RTL |
| 10 | **Rules נכתבים לפני הקוד** | אחרת מגלים חסימה בייצור |

---

## 2. ביצועים

### 2.1 · האזנות — הטעות היקרה ביותר

```ts
// ❌ מאזין לכל החדר. כל שינוי בכל מקום מוריד את הכל מחדש.
onValue(ref(db, `rooms/${code}`), ...)

// ✅ מאזין לענף אחד
onValue(ref(db, `rooms/${code}/items`), ...)
```

**המספרים:** האזנה לחדר שלם מורידה ~150KB בכל שינוי. האזנה ל-`items` בלבד — ~8KB. פי 18 פחות תעבורה, ופי 18 פחות סיכוי לחרוג מהמכסה.

### 2.2 · שלוש רמות של האזנה

| רמה | מה מאזין | היכן חי |
|-----|----------|---------|
| גלובלי | `users/{uid}`, `.info/connected` | `AuthProvider` — כל החיים |
| חדר | `metadata`, `members` | `RoomProvider` — כל עוד יש חדר פעיל |
| דף | `items`, `purchases`, `notifications` | hook בדף — **מתנתק בעזיבה** |

הרמה השלישית היא זו שחוסכת הכי הרבה: אין סיבה להאזין לקניות כשהמשתמש נמצא במסך המוצרים.

### 2.3 · הגבלת גודל שאילתות

```ts
// ❌ כל הקניות מתחילת הזמן
onValue(ref(db, `rooms/${code}/purchases`), ...)

// ✅ 50 האחרונות בלבד
onValue(query(ref(db, `rooms/${code}/purchases`), orderByChild('createdAt'), limitToLast(50)), ...)
```

בחדר ותיק אחרי שנה יש מאות קניות. `limitToLast` הופך את זה מ-400KB ל-25KB. **דרוש `.indexOn: ["createdAt"]`** — כבר מוגדר ב-`database.rules.json`.

### 2.4 · `React.memo` — רק היכן שצריך

```tsx
// רשימות ארוכות שמתרנדרות מחדש בכל עדכון realtime
export const ItemCard = memo(function ItemCard({ item }: { item: WithId<Item> }) {
  /* ... */
}, (prev, next) =>
  prev.item.status === next.item.status &&
  prev.item.assignedTo === next.item.assignedTo &&
  prev.item.name === next.item.name
);
```

> אל תפזרו `memo` על הכל. השוואה שטחית עולה גם היא, ועל קומפוננטה קטנה זה מפסיד. השתמשו בו רק ברשימות של 20+ פריטים שמתעדכנות בתדירות גבוהה.

### 2.5 · חיסכון בגודל ה-Bundle

```ts
// ❌ מייבא את כל firebase
import firebase from 'firebase';

// ✅ ייבוא מודולרי — tree-shaking עובד
import { ref, onValue } from 'firebase/database';
```

**Storage בטעינה עצלה** — רוב המשתמשים לא מעלים חשבוניות:

```ts
async function uploadReceipt(file: File, path: string) {
  const { getStorage, ref: sRef, uploadBytes, getDownloadURL } =
    await import('firebase/storage');
  /* ... */
}
```

חוסך 19KB gzipped מהמסלול הקריטי.

```bash
# ניתוח מה תופס מקום
npx vite-bundle-visualizer
```

---

## 3. חוויית משתמש

### 3.1 · קוד החדר — הפיצ'ר שהכי קל לעשות בו טעות

זה המספר שאנשים מכתיבים זה לזה בעל פה בסלון. כמה החלטות קטנות משנות הכל:

```ts
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
//               ↑ בלי O, 0, I, 1 — "אפס או או?" זו שיחה שלא רוצים
```

```tsx
// כרטיס הקוד — שלוש דרכי שיתוף
<div className="text-center">
  <p className="text-sm text-slate-500">קוד החדר</p>
  <p className="font-mono text-4xl tracking-[0.3em]">{code}</p>

  <Button onClick={() => navigator.clipboard.writeText(code)}>📋 העתק</Button>

  <Button onClick={() => navigator.share?.({
    title: 'הצטרפו לחדר שלנו',
    text: `קוד החדר: ${code}`,
    url: `${location.origin}/rooms/join?code=${code}`,
  })}>📤 שתף</Button>

  <QRCode value={`${location.origin}/rooms/join?code=${code}`} />
</div>
```

**`navigator.share`** פותח את תפריט השיתוף המקורי של המכשיר — WhatsApp, SMS, הכל. שורה אחת, והשיתוף הופך מחיכוך לזרימה.

### 3.2 · שדה קוד חכם

```tsx
<input
  value={code}
  onChange={(e) => setCode(
    e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6)
  )}
  inputMode="text"
  autoCapitalize="characters"
  autoComplete="off"
  spellCheck={false}
  maxLength={6}
  className="font-mono text-center text-2xl tracking-[0.3em]"
  aria-label="קוד חדר בן 6 תווים"
/>
```

המשתמש יכול להדביק `abc-123` והשדה יתקן ל-`ABC123` לבד.

### 3.3 · פורמט כסף עברי

```ts
export const formatILS = (agorot: number) =>
  new Intl.NumberFormat('he-IL', { style: 'currency', currency: 'ILS' })
    .format(agorot / 100);

// 1234  → "‏₪12.34"
// -1234 → "‏₪12.34-"
```

**חיווי צבע שאינו מסתמך על צבע בלבד** (נגישות):

```tsx
<span className={amount >= 0 ? 'text-emerald-700' : 'text-rose-700'}>
  {amount >= 0 ? '↑ מגיע לך ' : '↓ אתה חייב '}
  {formatILS(Math.abs(amount))}
</span>
```

### 3.4 · תאריכים בעברית

```ts
import { formatRelative, format } from 'date-fns';
import { he } from 'date-fns/locale';

formatRelative(new Date(ts), new Date(), { locale: he });  // "אתמול ב-14:30"
format(new Date(ts), 'd בMMMM yyyy', { locale: he });      // "15 באוגוסט 2026"
```

### 3.5 · משוב הפטי

```ts
// רטט קצר באישור פעולה — נותן תחושת אפליקציה מקורית
const haptic = (ms = 10) => navigator.vibrate?.(ms);
```

זול, קטן, ומשנה משמעותית את התחושה במובייל. (לא נתמך ב-iOS Safari — פשוט לא קורה כלום.)

---

## 4. אבטחה — מעבר ל-Rules

### 4.1 · מה שלעולם לא נכנס ל-git

```gitignore
.env.local
.env.production.local
serviceAccountKey.json
*-firebase-adminsdk-*.json
```

> **אם דלף Service Account:** בטלו אותו **מיד** ב-[Google Cloud Console → IAM → Service Accounts](https://console.cloud.google.com/iam-admin/serviceaccounts). מחיקה מההיסטוריה של git לא מספיקה — המפתח כבר נסרק ע"י בוטים.

### 4.2 · סניטציה של קלט

React בורח מ-XSS אוטומטית ב-JSX. הסכנה היחידה:

```tsx
// ❌ לעולם לא, על שום נתון שמגיע ממשתמש
<div dangerouslySetInnerHTML={{ __html: item.notes }} />

// ✅
<div className="whitespace-pre-wrap">{item.notes}</div>
```

### 4.3 · הגבלת קצב (Rate limiting)

RTDB לא מציע rate limiting מובנה, אבל אפשר לקרב אותו בכללים:

```jsonc
// כתיבה חדשה מותרת רק אם עברו 2 שניות מהקודמת
"lastWriteAt": { ".validate": "newData.val() > data.val() + 2000" }
```

**החלטת PM:** לא נדרש ל-MVP. בחדר עם 4 אנשים שמכירים זה את זה אין תמריץ להצפה. אם האפליקציה נפתחת לקהל רחב — זה הדבר הראשון להוסיף.

### 4.4 · Content Security Policy

```jsonc
// firebase.json → hosting → headers
{
  "source": "**",
  "headers": [
    { "key": "X-Content-Type-Options", "value": "nosniff" },
    { "key": "X-Frame-Options", "value": "DENY" },
    { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" },
    { "key": "Permissions-Policy", "value": "geolocation=(), microphone=(), camera=()" }
  ]
}
```

---

## 5. תחזוקה ואיכות קוד

### 5.1 · ניקוי אוטומטי של נתונים ישנים

בלי ניקוי, `notifications` גדל ללא גבול. בכל טעינת חדר:

```ts
export async function pruneOldNotifications(code: string, isAdmin: boolean) {
  if (!isAdmin) return;   // מנהל בלבד — כך יש רק כותב אחד

  const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const snap = await get(query(
    ref(db, `rooms/${code}/notifications`),
    orderByChild('createdAt'),
    endAt(cutoff)
  ));

  if (!snap.exists()) return;
  const updates = Object.fromEntries(
    Object.keys(snap.val()).map((id) => [`rooms/${code}/notifications/${id}`, null])
  );
  await update(ref(db), updates);
}
```

**`null` הוא איך מוחקים ב-`update()`** — לא `undefined`, שיגרום לשגיאה.

### 5.2 · Feature flags פשוטים

```ts
// src/config/features.ts
export const FEATURES = {
  receipts:     false,   // דורש Storage + Blaze
  pushNotifs:   false,   // שלב 7
  csvExport:    false,   // backlog
  darkMode:     false,
} as const;
```

מאפשר למזג קוד חצי-גמור ל-`main` בלי לחשוף אותו למשתמשים.

### 5.3 · לוגים מובנים

```ts
// src/lib/log.ts
const isDev = import.meta.env.DEV;

export const log = {
  info:  (...a: unknown[]) => isDev && console.info('ℹ️', ...a),
  warn:  (...a: unknown[]) => console.warn('⚠️', ...a),
  error: (err: unknown, ctx?: Record<string, unknown>) => {
    console.error('🔴', err, ctx);
    // כאן מחברים Sentry בעתיד
  },
};
```

`log.info` נעלם אוטומטית בייצור. אין `console.log` מפוזרים.

### 5.4 · שלושת ה-ESLint שמחזירים את ההשקעה

```js
// eslint.config.js
rules: {
  // 1. חוק הייבוא — קומפוננטות לא נוגעות ב-Firebase
  'no-restricted-imports': ['error', {
    patterns: [{ group: ['firebase/*'], message: 'רק דרך src/services/' }],
  }],

  // 2. תופס useEffect עם deps חסרים — מקור נפוץ לבאגי realtime
  'react-hooks/exhaustive-deps': 'warn',

  // 3. תופס Promise שנשכח בלי await — כתיבה שנעלמת
  '@typescript-eslint/no-floating-promises': 'error',
}
```

---

## 6. הצעדים הבאים אחרי ה-MVP

לפי סדר יחס תועלת-למאמץ:

| פיצ'ר | מאמץ | ערך | הערה |
|-------|:----:|:---:|------|
| **סגירת חשבון (Settle up)** | 6h | 🔥🔥🔥 | `simplifyDebts` כבר כתוב. הפיצ'ר שהכי יבקשו |
| **מוצרים חוזרים** | 8h | 🔥🔥🔥 | "חלב כל שבוע" — חוסך הקלדה חוזרת |
| **התראות Push (FCM)** | 12h | 🔥🔥 | דורש הגדרת VAPID + SW נוסף |
| **העלאת חשבוניות** | 8h | 🔥🔥 | דורש Blaze |
| **דוח חודשי** | 6h | 🔥🔥 | "הוצאנו ₪480 באוגוסט" |
| **ייצוא CSV** | 3h | 🔥 | קל, מרשים בהצגה |
| **דארק מוד** | 4h | 🔥 | `dark:` של Tailwind |
| **תמיכה במטבעות** | 10h | ❄️ | מיותר לחדר מעונות בישראל |
| **צ'אט בחדר** | 20h | ❄️ | לזה יש וואטסאפ |

### הפיצ'ר שהכי כדאי להוסיף: מוצרים חוזרים

```ts
export interface RecurringItem {
  name: string;
  category: Category;
  intervalDays: number;      // 7 = שבועי
  lastReportedAt: number;
  active: boolean;
}
```

בחדר מעונות רוב הקניות זהות שבוע אחרי שבוע. הפיצ'ר הזה הופך את האפליקציה מ"רשימה שצריך למלא" ל"מערכת שיודעת מה חסר".

---

## 7. עשר מלכודות שכדאי להכיר מראש

| # | המלכודת | הסימן | הפתרון |
|---|----------|-------|--------|
| 1 | `undefined` ב-RTDB | `Reference.update failed` | `value ?? null` תמיד |
| 2 | מערכים ב-RTDB | אינדקסים מתערבבים בעדכון בו-זמני | maps של `true` |
| 3 | האזנה בלי ניקוי | האפליקציה נתקעת אחרי כמה מסכים | `return unsubscribe` |
| 4 | חישוב כסף ב-float | מאזנים לא מסתדרים באגורה | אגורות בלבד |
| 5 | `Date.now()` בשרת | סדר מיון שגוי אצל משתמש עם שעון לא מדויק | `serverTimestamp()` |
| 6 | שכחת `.indexOn` | אזהרה בקונסול, ביצועים מתדרדרים בהדרגה | להוסיף לכללים |
| 7 | `ml-*` ב-RTL | הפריסה מתהפכת | `ms-*`/`me-*` |
| 8 | פונט < 16px בשדה קלט | iOS מזייף זום | `input { font-size: 16px }` |
| 9 | SW ב-`autoUpdate` | טופס נמחק באמצע הקלדה | `registerType: 'prompt'` |
| 10 | מטמון לא מנוקה ב-logout | המשתמש הבא רואה נתונים של הקודם | `clearAllCache()` |

---

## 8. שלוש עצות של PM

### 8.1 · בנו את המקרה הקשה ראשון

אל תתחילו מ"מסך התחברות יפה". התחילו מ**שני משתמשים בשני דפדפנים באותו חדר**. זה המקרה שחושף בעיות ארכיטקטורה, וזה גם המקרה שמוכיח שהמוצר עובד. אם זה עובד — כל השאר הוא עיצוב.

### 8.2 · השתמשו במוצר בעצמכם, מוקדם

בשבוע השלישי, לפני שהכל גמור, התחילו להשתמש בו באמת בחדר שלכם. תגלו תוך יומיים דברים שאף מפרט לא היה חושף — למשל שאף אחד לא זוכר להיכנס לאפליקציה כדי לדווח, ושהפיצ'ר החשוב באמת הוא תזכורת ולא עוד שדה בטופס.

### 8.3 · תעדו החלטות, לא רק קוד

כשתחזרו לפרויקט בעוד שלושה חודשים, לא תזכרו **למה** בחרתם במאזנים נגזרים או למה אופליין הוא קריאה-בלבד. תיק התכנון הזה קיים בדיוק בשביל זה. כשאתם מקבלים החלטה משמעותית — הוסיפו לה שורה במסמך הרלוונטי.

> **הכלל:** קוד עונה על "מה". תיעוד עונה על "למה". רק אחד מהם אפשר לשחזר מקריאת השני.
