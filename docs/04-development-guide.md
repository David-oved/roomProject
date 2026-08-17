# 04 · מדריך פיתוח — צעד אחר צעד

מהפקודה הראשונה עד פיצ'ר עובד. הקוד כאן הוא קוד אמיתי להעתקה, לא פסאודו-קוד.

---

## שלב 0 · הקמת השלד (60–90 דקות)

### 0.1 · יצירת הפרויקט

```bash
cd "C:\Users\wbddw\OneDrive\שולחן העבודה\roomProject"

npm create vite@latest . -- --template react-ts
npm install
```

> אם התיקייה לא ריקה, Vite ישאל אם להמשיך — בחרו **"Ignore files and continue"**. הקבצים הקיימים (`docs/`, `database.rules.json`, `.git`) יישמרו.

### 0.2 · התלויות

```bash
# ליבה
npm i firebase react-router-dom zod date-fns idb-keyval

# פיתוח
npm i -D tailwindcss postcss autoprefixer vite-plugin-pwa
npm i -D vitest @vitest/ui jsdom @testing-library/react @testing-library/user-event @testing-library/jest-dom
npm i -D @firebase/rules-unit-testing
npm i -D eslint prettier prettier-plugin-tailwindcss

npx tailwindcss init -p
```

### 0.3 · `tailwind.config.js`

```js
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f0fdfa', 100: '#ccfbf1', 500: '#14b8a6',
          600: '#0d9488', 700: '#0f766e', 900: '#134e4a',
        },
      },
      fontFamily: {
        sans: ['Assistant', 'system-ui', 'sans-serif'],
      },
      spacing: {
        'safe-b': 'env(safe-area-inset-bottom)',
        'safe-t': 'env(safe-area-inset-top)',
      },
    },
  },
  plugins: [],
};
```

### 0.4 · `index.html`

```html
<!doctype html>
<html lang="he" dir="rtl">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <meta name="theme-color" content="#0f766e" />
    <meta name="description" content="ניהול קניות והוצאות בחדר משותף" />

    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="default" />
    <meta name="apple-mobile-web-app-title" content="RoomMate" />
    <link rel="apple-touch-icon" href="/icons/apple-touch-icon-180.png" />

    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Assistant:wght@400;600;700&display=swap" rel="stylesheet" />

    <title>RoomMate — ניהול חדר משותף</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

### 0.5 · `.gitignore` — הוסיפו

```gitignore
.env.local
.env.*.local
.emulator-data/
dist/
dev-dist/
firebase-debug.log
database-debug.log
ui-debug.log
.firebase/
```

### 0.6 · סקריפטים ב-`package.json`

```jsonc
"scripts": {
  "dev": "vite",
  "build": "tsc -b && vite build",
  "preview": "vite preview",
  "emu": "firebase emulators:start --import=./.emulator-data --export-on-exit",
  "test": "vitest run",
  "test:watch": "vitest",
  "test:rules": "firebase emulators:exec --only database \"vitest run tests/rules\"",
  "lint": "eslint src --max-warnings 0",
  "deploy": "npm run build && firebase deploy"
}
```

### ✅ בדיקת קבלה לשלב 0

```bash
npm run dev     # → האפליקציה נפתחת ב-localhost:5173
npm run emu     # → בטרמינל שני: אמולטורים ב-localhost:4000
```

בקונסול של הדפדפן חייב להופיע `🔧 מחובר לאמולטורים המקומיים`.

---

## שלב 1 · טיפוסים ומודל הנתונים (45 דקות)

**עשו את זה לפני שאתם כותבים קומפוננטה אחת.** הטיפוסים הם החוזה בין כל חלקי המערכת, ושינוי שלהם אחר כך גורר שינוי בעשרות קבצים.

```ts
// src/types/models.ts

export type Category = 'kitchen' | 'bathroom' | 'cleaning' | 'other';
export type Priority = 'high' | 'normal' | 'low';
export type ItemStatus = 'needed' | 'buying' | 'bought' | 'done';
export type PurchaseStatus = 'pending' | 'approved' | 'rejected' | 'settled';
export type SplitMethod = 'equal' | 'percentage' | 'custom';
export type MemberRole = 'admin' | 'member';
export type MemberStatus = 'active' | 'removed';

/** ‼️ סכומים תמיד באגורות (מספר שלם). ₪12.34 → 1234 */
export type Agorot = number;

export interface UserProfile {
  email: string;
  displayName: string;
  avatar: string | null;
  createdAt: number;
  lastActiveAt?: number;
  rooms?: Record<string, true>;
}

export interface RoomMetadata {
  name: string;
  description: string;
  photo: string | null;
  categories: Record<Category, true>;
  currency: 'ILS';
  createdAt: number;
  createdBy: string;
  adminId: string;
}

export interface Member {
  name: string;
  email: string;
  avatar: string | null;
  joinedAt: number;
  status: MemberStatus;
  role: MemberRole;
}

export interface Item {
  name: string;
  nameLower: string;
  category: Category;
  reportedBy: string;
  reportedAt: number;
  priority: Priority;
  status: ItemStatus;
  assignedTo: string | null;
  notes: string | null;
  purchaseId: string | null;
}

export interface Purchase {
  itemId: string | null;
  title: string;
  boughtBy: string;
  amount: Agorot;
  date: number;
  createdAt: number;
  splitMethod: SplitMethod;
  splitBetween: Record<string, true>;
  shares: Record<string, Agorot>;
  receipt: string | null;
  status: PurchaseStatus;
  approvedBy: string | null;
  note?: string;
}

export interface JoinRequest {
  userId: string;
  displayName: string;
  email: string;
  avatar: string | null;
  requestedAt: number;
  status: 'pending' | 'approved' | 'rejected';
  respondedAt: number | null;
}

/** לכל ישות שנקראת מ-RTDB מתווסף id מהמפתח */
export type WithId<T> = T & { id: string };
```

### סכימות zod לוולידציה בטפסים

```ts
// src/types/schemas.ts
import { z } from 'zod';

export const itemDraftSchema = z.object({
  name: z.string().trim().min(1, 'חובה להזין שם מוצר').max(60, 'שם ארוך מדי'),
  category: z.enum(['kitchen', 'bathroom', 'cleaning', 'other']),
  priority: z.enum(['high', 'normal', 'low']),
  notes: z.string().trim().max(500, 'ההערה ארוכה מדי').optional(),
});
export type ItemDraft = z.infer<typeof itemDraftSchema>;

export const roomDraftSchema = z.object({
  name: z.string().trim().min(2, 'שם החדר חייב להכיל לפחות 2 תווים').max(50),
  description: z.string().trim().max(300).optional(),
  categories: z.array(z.enum(['kitchen', 'bathroom', 'cleaning', 'other']))
               .min(1, 'בחרו לפחות קטגוריה אחת'),
});

export const purchaseDraftSchema = z.object({
  amountShekels: z.number({ invalid_type_error: 'חובה להזין סכום' })
                  .positive('הסכום חייב להיות חיובי')
                  .max(100000, 'סכום גבוה מדי'),
  splitMethod: z.enum(['equal', 'percentage', 'custom']),
  splitBetween: z.array(z.string()).min(1, 'בחרו לפחות משתתף אחד'),
});
```

> **הודעות שגיאה בעברית מיד, לא אחר כך.** אם משאירים את ברירות המחדל של zod באנגלית, בסוף הפרויקט צריך לעבור על 40 שדות. שתי דקות עכשיו, שעתיים חיסכון.

---

## שלב 2 · Authentication (10–14 שעות)

### 2.1 · `authService.ts`

```ts
// src/services/authService.ts
import {
  createUserWithEmailAndPassword, signInWithEmailAndPassword,
  signOut, sendPasswordResetEmail, updateProfile, onAuthStateChanged,
  type User,
} from 'firebase/auth';
import { ref, set, serverTimestamp, get } from 'firebase/database';
import { auth, db } from '../config/firebase';
import { clearAllCache } from '../lib/cache';
import { assertOnline } from './guard';

export async function register(email: string, password: string, displayName: string) {
  assertOnline('להירשם');

  const cred = await createUserWithEmailAndPassword(auth, email, password);
  await updateProfile(cred.user, { displayName });

  // ‼️ יצירת הפרופיל ב-RTDB — בלעדיה המשתמש מאומת אך "לא קיים" באפליקציה
  await set(ref(db, `users/${cred.user.uid}`), {
    email,
    displayName,
    avatar: null,
    createdAt: serverTimestamp(),
    lastActiveAt: serverTimestamp(),
  });

  return cred.user;
}

export async function login(email: string, password: string) {
  assertOnline('להתחבר');
  const cred = await signInWithEmailAndPassword(auth, email, password);
  await set(ref(db, `users/${cred.user.uid}/lastActiveAt`), serverTimestamp());
  return cred.user;
}

export async function logout() {
  await clearAllCache();   // 🔒 לפני ההתנתקות — ראו docs/05
  await signOut(auth);
}

export async function resetPassword(email: string) {
  assertOnline('לשלוח מייל איפוס');
  await sendPasswordResetEmail(auth, email);
}

export const subscribeToAuth = (cb: (u: User | null) => void) =>
  onAuthStateChanged(auth, cb);
```

> ### ⚠️ המלכודת הכי גדולה בשלב הזה
>
> `createUserWithEmailAndPassword` יוצר משתמש ב-**Authentication**, שהוא מערכת נפרדת לגמרי מ-**Realtime Database**. אם הכתיבה ל-`users/{uid}` נכשלת (אין רשת, Rules חוסמים), נוצר משתמש "יתום": הוא יכול להתחבר, אבל אין לו פרופיל, וכל האפליקציה תקרוס על `profile.displayName` של `undefined`.
>
> **ההגנה:** ב-`AuthContext`, אחרי `onAuthStateChanged`, בדקו שהפרופיל קיים. אם לא — צרו אותו, או נתקו את המשתמש עם הודעה ברורה.

### 2.2 · `AuthContext`

```tsx
// src/store/AuthContext.tsx
import { createContext, useContext, useEffect, useState } from 'react';
import { onValue, ref, set, serverTimestamp } from 'firebase/database';
import type { User } from 'firebase/auth';
import { db } from '../config/firebase';
import { subscribeToAuth } from '../services/authService';
import type { UserProfile } from '../types/models';

type AuthState = { user: User | null; profile: UserProfile | null; loading: boolean };

const Ctx = createContext<AuthState>({ user: null, profile: null, loading: true });
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({ user: null, profile: null, loading: true });

  useEffect(() => subscribeToAuth((user) => {
    if (!user) { setState({ user: null, profile: null, loading: false }); return; }

    // האזנה לפרופיל — כדי ששינוי שם ישתקף מיד בכל המכשירים
    const unsub = onValue(ref(db, `users/${user.uid}`), async (snap) => {
      if (!snap.exists()) {
        // ריפוי עצמי של משתמש יתום
        await set(ref(db, `users/${user.uid}`), {
          email: user.email, displayName: user.displayName ?? 'משתמש',
          avatar: null, createdAt: serverTimestamp(), lastActiveAt: serverTimestamp(),
        });
        return;
      }
      setState({ user, profile: snap.val() as UserProfile, loading: false });
    });
    return unsub;
  }), []);

  return <Ctx.Provider value={state}>{children}</Ctx.Provider>;
}
```

### 2.3 · תרגום שגיאות Firebase לעברית

```ts
// src/lib/authErrors.ts
const MESSAGES: Record<string, string> = {
  'auth/email-already-in-use':  'כתובת האימייל כבר רשומה במערכת',
  'auth/invalid-email':         'כתובת אימייל לא תקינה',
  'auth/weak-password':         'הסיסמה חייבת להכיל לפחות 6 תווים',
  'auth/user-not-found':        'האימייל או הסיסמה שגויים',
  'auth/wrong-password':        'האימייל או הסיסמה שגויים',
  'auth/invalid-credential':    'האימייל או הסיסמה שגויים',
  'auth/too-many-requests':     'יותר מדי ניסיונות. נסו שוב בעוד כמה דקות',
  'auth/network-request-failed':'אין חיבור לאינטרנט',
};

export const authErrorMessage = (code: string) =>
  MESSAGES[code] ?? 'אירעה שגיאה. נסו שוב.';
```

> **`user-not-found` ו-`wrong-password` מקבלים בכוונה את אותה הודעה** — כדי לא לחשוף למי שמנחש אילו אימיילים רשומים במערכת.

---

## שלב 3 · חדרים — החלק הכי מורכב (16–20 שעות)

### 3.1 · יצירת קוד חדר

```ts
// src/lib/roomCode.ts

// ללא O, 0, I, 1 — כדי שלא יטעו בהקראה בעל פה. זה קוד שאנשים מכתיבים זה לזה.
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generateRoomCode(): string {
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);   // ולא Math.random — התנגשויות בפועל
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join('');
}

/** נרמול שם חדר למפתח ייחודיות: "דירה  12 !" → "דירה-12" */
export function slugifyRoomName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/["'`׳״]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}
```

**מרחב הקודים:** 32⁶ ≈ 1.07 מיליארד. עם 10,000 חדרים, הסיכוי להתנגשות בקוד חדש הוא כ-1 ל-100,000 — ובכל זאת אנחנו בודקים, כי "נדיר" זה לא "אף פעם".

### 3.2 · יצירת חדר — הזרימה המלאה

זו הפונקציה המורכבת ביותר בפרויקט. היא צריכה להיות אטומית מול Race Conditions בשני מימדים: שם ייחודי, וקוד ייחודי.

```ts
// src/services/roomService.ts
import { ref, get, update, runTransaction, serverTimestamp } from 'firebase/database';
import { db } from '../config/firebase';
import { generateRoomCode, slugifyRoomName } from '../lib/roomCode';
import { assertOnline } from './guard';
import type { Category, UserProfile } from '../types/models';

export class RoomNameTakenError extends Error {
  constructor(name: string) { super(`כבר קיים חדר בשם "${name}". בחרו שם אחר.`); }
}

export async function createRoom(
  userId: string,
  profile: UserProfile,
  draft: { name: string; description?: string; categories: Category[] }
): Promise<string> {
  assertOnline('ליצור חדר');

  const slug = slugifyRoomName(draft.name);
  if (slug.length < 2) throw new Error('שם החדר קצר מדי');

  // ── 1) קוד ייחודי: מגרילים ובודקים, עד 5 ניסיונות
  let code = '';
  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = generateRoomCode();
    const snap = await get(ref(db, `roomCodes/${candidate}`));
    if (!snap.exists()) { code = candidate; break; }
  }
  if (!code) throw new Error('לא הצלחנו ליצור קוד חדר. נסו שוב.');

  // ── 2) שם ייחודי: transaction אטומי. זה מה שמנצח Race Condition.
  const nameRef = ref(db, `roomNames/${slug}`);
  const result = await runTransaction(nameRef, (current) =>
    current === null ? code : undefined   // undefined = ביטול, השם תפוס
  );
  if (!result.committed) throw new RoomNameTakenError(draft.name);

  // ── 3) יצירת החדר בכתיבה אטומית אחת
  const categories = Object.fromEntries(draft.categories.map((c) => [c, true]));
  try {
    await update(ref(db), {
      [`roomCodes/${code}`]: {
        name: draft.name.trim(), adminId: userId, createdAt: serverTimestamp(),
      },
      [`rooms/${code}/metadata`]: {
        name: draft.name.trim(),
        description: draft.description?.trim() ?? '',
        photo: null,
        categories,
        currency: 'ILS',
        createdAt: serverTimestamp(),
        createdBy: userId,
        adminId: userId,
      },
      [`rooms/${code}/members/${userId}`]: {
        name: profile.displayName,
        email: profile.email,
        avatar: profile.avatar,
        joinedAt: serverTimestamp(),
        status: 'active',
        role: 'admin',
      },
      [`users/${userId}/rooms/${code}`]: true,
    });
  } catch (err) {
    // ── 4) פיצוי: הכתיבה נכשלה, משחררים את השם כדי שלא יישאר "תפוס לנצח"
    await runTransaction(nameRef, (cur) => (cur === code ? null : cur));
    throw err;
  }

  return code;
}
```

**שימו לב לסעיף 4** — שחרור השם בכישלון. בלעדיו, כל שגיאת רשת באמצע יוצרת שם חסום שלא שייך לאף חדר, ומשתמשים יקבלו "השם תפוס" בלי סיבה. זה סוג הבאג שמתגלה חודשיים אחרי ההשקה ולוקח יום שלם לאתר.

### 3.3 · הצטרפות לחדר

```ts
export async function requestToJoin(
  code: string,
  userId: string,
  profile: UserProfile
): Promise<void> {
  assertOnline('לשלוח בקשת הצטרפות');
  const upper = code.trim().toUpperCase();

  // 1) האם הקוד בכלל קיים? — קריאה מהאינדקס הציבורי
  const codeSnap = await get(ref(db, `roomCodes/${upper}`));
  if (!codeSnap.exists()) {
    throw new Error('קוד החדר אינו קיים. בדקו את הקוד ונסו שוב.');
  }

  // 2) כבר חבר? — הבדיקה תיכשל בהרשאות אם לא, וזה בסדר
  if (profile.rooms?.[upper]) {
    throw new Error('אתם כבר חברים בחדר הזה.');
  }

  // 3) הבקשה + המראה האישית, בכתיבה אטומית אחת
  await update(ref(db), {
    [`rooms/${upper}/pendingRequests/${userId}`]: {
      userId,
      displayName: profile.displayName,
      email: profile.email,
      avatar: profile.avatar,
      requestedAt: serverTimestamp(),
      status: 'pending',
      respondedAt: null,
    },
    [`joinRequests/${userId}/${upper}`]: {
      status: 'pending',
      requestedAt: serverTimestamp(),
      respondedAt: null,
      roomName: codeSnap.val().name,
    },
  });
}
```

### 3.4 · אישור מנהל

```ts
export async function approveJoinRequest(
  code: string, adminId: string, adminName: string, request: JoinRequest
): Promise<void> {
  assertOnline('לאשר בקשה');

  const notifId = push(ref(db, `rooms/${code}/notifications`)).key!;

  await update(ref(db), {
    // הופך לחבר פעיל
    [`rooms/${code}/members/${request.userId}`]: {
      name: request.displayName,
      email: request.email,
      avatar: request.avatar ?? null,
      joinedAt: serverTimestamp(),
      status: 'active',
      role: 'member',
    },
    // סוגר את הבקשה בשני המקומות
    [`rooms/${code}/pendingRequests/${request.userId}/status`]: 'approved',
    [`rooms/${code}/pendingRequests/${request.userId}/respondedAt`]: serverTimestamp(),
    [`joinRequests/${request.userId}/${code}/status`]: 'approved',
    [`joinRequests/${request.userId}/${code}/respondedAt`]: serverTimestamp(),
    // רושם את החדר אצל המשתמש (מותר למנהל — ראו database.rules.json)
    [`users/${request.userId}/rooms/${code}`]: true,
    // מודיע לכל החדר
    [`rooms/${code}/notifications/${notifId}`]: {
      type: 'member_joined',
      actorId: adminId,
      actorName: adminName,
      text: `${request.displayName} הצטרף לחדר`,
      entityId: request.userId,
      createdAt: serverTimestamp(),
      readBy: { [adminId]: true },
    },
  });
}
```

**שש כתיבות, פעולה אטומית אחת.** אם אחת נכשלת — כולן נכשלות. אין מצב ביניים שבו המשתמש חבר בחדר אבל הבקשה שלו עדיין "ממתינה".

### 3.5 · שינוי שם משתמש — Fan-out

השם משוכפל בכל חדר שהמשתמש חבר בו (ראו [החלטת המודל](./01-architecture.md#43-שלושה-כללי-מודל-שאסור-להפר)). שינוי שם חייב לעדכן את כולם:

```ts
export async function updateDisplayName(
  userId: string, newName: string, rooms: Record<string, true> | undefined
): Promise<void> {
  assertOnline('לעדכן שם');

  const updates: Record<string, unknown> = {
    [`users/${userId}/displayName`]: newName,
  };
  for (const code of Object.keys(rooms ?? {})) {
    updates[`rooms/${code}/members/${userId}/name`] = newName;
  }

  await update(ref(db), updates);   // הכל או כלום
  await updateProfile(auth.currentUser!, { displayName: newName });
}
```

---

## שלב 4 · הפיצ'ר הראשון מקצה לקצה

הנה הסדר לבניית **כל** פיצ'ר בפרויקט. עקבו אחריו והכל יתחבר.

```
1. טיפוס        types/models.ts        →  איך הנתון נראה
2. סכימה        types/schemas.ts       →  מה קלט תקין
3. כלל          database.rules.json    →  מי רשאי, ומה חוקי בשרת
4. בדיקת כלל    tests/rules/           →  מוכיחים שהכלל עובד
5. שירות        services/xService.ts   →  assertOnline + update אטומי
6. hook         hooks/useX.ts          →  האזנה + מטמון
7. קומפוננטה    components/x/          →  חמשת המצבים
8. דף           pages/XPage.tsx        →  הרכבה
9. ניתוב        router.tsx             →  שומר סף מתאים
10. בדיקה ידנית                        →  שני דפדפנים, שני משתמשים
```

> **הסדר לא שרירותי.** מי שמתחיל מקומפוננטה מגלה בשלב 5 שהמודל לא מתאים ומוחק חצי יום עבודה. שלבים 3–4 לפני 5 מונעים את הבאג הנפוץ ביותר: קוד שעובד מקומית ונחסם ב-Rules בייצור.

### דוגמה מלאה: "דיווח על מוצר חסר"

**5) השירות** — [ראו הקוד המלא ב-01-architecture.md](./01-architecture.md#9-שכבת-ה-services--התבנית)

**6) ה-hook:**

```ts
// src/hooks/useItems.ts
export function useItems(status?: ItemStatus) {
  const { roomCode } = useRoom();
  const { data, loading, error, fromCache, cachedAt } =
    useRtdbListCached<Item>(roomCode ? `rooms/${roomCode}/items` : null);

  const items = useMemo(() => {
    const rank = { high: 0, normal: 1, low: 2 };
    return data
      .filter((i) => (status ? i.status === status : i.status !== 'done'))
      .sort((a, b) => rank[a.priority] - rank[b.priority] || b.reportedAt - a.reportedAt);
  }, [data, status]);

  return { items, loading, error, fromCache, cachedAt };
}
```

**7) הקומפוננטה — עם חמשת המצבים:**

```tsx
// src/components/items/ItemList.tsx
export function ItemList() {
  const { items, loading, error, fromCache, cachedAt } = useItems();
  const { isOnline } = useConnection();

  if (loading) return <ItemListSkeleton />;                        // 1
  if (error && !fromCache) return <ErrorState error={error} />;    // 3

  return (
    <div className="space-y-3">
      {fromCache && !isOnline && <StaleDataNotice cachedAt={cachedAt} />}  {/* 4 */}

      {items.length === 0                                          // 2
        ? <EmptyState
            icon="🎉"
            title="אין מוצרים חסרים"
            hint={isOnline ? 'הכל מלא. אפשר לנוח.' : undefined}
          />
        : items.map((item) => <ItemCard key={item.id} item={item} />)  /* 5 */}
    </div>
  );
}
```

**10) הבדיקה הידנית — התרחיש המחייב:**

1. פותחים שני דפדפנים (רגיל + מצב פרטי), נכנסים עם שני משתמשים לאותו חדר
2. משתמש A מדווח על "חלב"
3. ⏱️ **מודדים:** תוך כמה זמן זה מופיע אצל B? חייב להיות **< שנייה**
4. B לוחץ "אני קונה את זה" → A רואה את השינוי מיד
5. מנתקים את הרשת אצל A → הבאנר מופיע, הכפתורים מושבתים
6. מחזירים רשת → הכל חוזר לפעול תוך שנייה

---

## שלב 5 · זרימת עבודה יומיומית

```bash
# טרמינל 1 — אמולטורים (משאירים פתוח כל היום)
npm run emu

# טרמינל 2 — שרת פיתוח
npm run dev

# טרמינל 3 — בדיקות ברקע
npm run test:watch
```

### מוסכמות Git

```bash
git checkout -b feat/items-reporting

# commit לפי conventional commits
git commit -m "feat(items): דיווח על מוצר חסר עם קטגוריה ועדיפות"
git commit -m "fix(money): חלוקת שארית דטרמיניסטית לפי מיון uid"
git commit -m "test(rules): חבר רגיל לא יכול למחוק מוצרים"
```

**חוק:** לא ממזגים ל-`main` בלי ש-`npm run test` ו-`npm run test:rules` ירוקים.

---

## שלב 6 · שגיאות נפוצות ופתרונן

| השגיאה | הסיבה האמיתית | הפתרון |
|--------|----------------|--------|
| `PERMISSION_DENIED` בכתיבה | ב-99% מהמקרים: `$other: false` חוסם שדה שלא בסכימה | לשונית **Requests** באמולטור מראה את הנתיב המדויק |
| `Reference.update failed` | `undefined` באחד הערכים — RTDB לא מקבל `undefined` | השתמשו ב-`null` תמיד. `value ?? null` |
| הנתונים לא מתעדכנים בזמן אמת | האזנה לא פעילה, או `useEffect` עם deps שגוי | בדקו ב-`.info/connected`; ודאו `return unsubscribe` |
| האפליקציה נתקעת אחרי כמה מסכים | דליפת האזנות — חסר `return unsubscribe` | חפשו כל `onValue` בפרויקט וּודאו שיש ניקוי |
| הכתיבה "מצליחה" אבל לא מגיעה לשרת | כתיבה במצב אופליין ללא `assertOnline()` | הוסיפו `assertOnline()` לפונקציה |
| מספרים לא מסתדרים באגורה | חישוב ב-float במקום באגורות | `lib/money.ts` בלבד. בדיקת "סכום = 0" |
| כל הפריסמות מתהפכות ב-RTL | `ml-*`/`mr-*` במקום `ms-*`/`me-*` | חיפוש-והחלפה גורף |
| שדות מזוימים ב-iOS | גודל גופן < 16px בשדה קלט | `input { font-size: 16px }` |
| SW מגיש קוד ישן | דפדפן שומר SW ישן | `Application → Service Workers → Unregister`; ב-Hosting: `Cache-Control: no-cache` ל-`sw.js` |
