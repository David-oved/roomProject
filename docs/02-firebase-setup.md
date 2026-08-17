# 02 · הקמת Firebase — צעד אחר צעד

זמן משוער: **45–60 דקות** בפעם הראשונה.

---

## שלב 1 · יצירת הפרויקט ב-Console

1. היכנסו ל-[console.firebase.google.com](https://console.firebase.google.com) עם חשבון Google.
2. **Add project** → שם: `roommate-app` (או שם אחר; Firebase יוסיף סיומת אקראית אם תפוס).
3. **Google Analytics** → **כבו**. לא צריך בפרויקט הזה, וזה מוסיף ~30KB ל-bundle ומסבך את ה-GDPR.
4. המתינו ~30 שניות → **Continue**.

### שלב 1.1 · רישום אפליקציית Web

1. במסך הראשי לחצו על אייקון **`</>`** (Web).
2. App nickname: `roommate-web`.
3. ✅ **סמנו "Also set up Firebase Hosting"** — חוסך הגדרה נפרדת בהמשך.
4. **Register app** → יופיע אובייקט קונפיגורציה. **העתיקו אותו**, נשתמש בו מיד.

```js
// כך זה נראה — הערכים שלכם יהיו שונים
const firebaseConfig = {
  apiKey: "AIzaSyD...",
  authDomain: "roommate-app-xxxxx.firebaseapp.com",
  databaseURL: "https://roommate-app-xxxxx-default-rtdb.firebaseio.com",
  projectId: "roommate-app-xxxxx",
  storageBucket: "roommate-app-xxxxx.appspot.com",
  messagingSenderId: "123456789012",
  appId: "1:123456789012:web:abc123def456"
};
```

> ### ❓ "רגע, ה-apiKey הזה בקוד — זו לא פרצת אבטחה?"
>
> **לא.** זו השאלה הכי נפוצה ואחת מאי-ההבנות הנפוצות בפיתוח Firebase. ה-`apiKey` של Firebase הוא **מזהה פרויקט ציבורי**, לא סוד. הוא נועד להיות גלוי ב-JS של הדפדפן — כל אפליקציית Firebase בעולם חושפת אותו.
>
> מה שמגן על הנתונים זה **Security Rules בלבד**. מי שישיג את ה-apiKey שלכם יוכל לפנות לשרת — ולקבל `PERMISSION_DENIED` על כל דבר שהכללים לא מתירים.
>
> **מה כן חייבים להגן עליו:** מפתחות Service Account (`serviceAccountKey.json`) ומפתחות Admin SDK. אלה **לעולם** לא נכנסים לקוד צד-לקוח ולא ל-git.
>
> עדיין נשים את הקונפיג ב-`.env.local` — לא מטעמי סוד, אלא כדי להחליף בקלות בין פרויקט dev לפרויקט production.

---

## שלב 2 · Authentication

1. תפריט צד → **Build → Authentication** → **Get started**.
2. לשונית **Sign-in method** → **Email/Password** → **Enable** (את השורה הראשונה בלבד; "Email link" נשאיר כבוי) → **Save**.

### 2.1 · תבניות אימייל בעברית

**Authentication → Templates → Password reset → ✏️ עריכה:**

- **Sender name:** `RoomMate`
- **Subject:** `איפוס הסיסמה שלך ב-RoomMate`
- **Message:**

```
שלום,

קיבלנו בקשה לאיפוס הסיסמה לחשבון %EMAIL% באפליקציית RoomMate.

לחצו על הקישור הבא כדי לבחור סיסמה חדשה:
%LINK%

הקישור תקף ל-60 דקות.
אם לא ביקשתם לאפס סיסמה — התעלמו מההודעה, החשבון שלכם בטוח.

צוות RoomMate
```

> **המפרט אמר "שחזור סיסמה — מנהל יצטרך לטפל בזה בהתחלה".** לא צריך! `sendPasswordResetEmail()` של Firebase Auth נותן את זה בשורת קוד אחת, כולל שליחת המייל. אין שום סיבה לפתח מנגנון ידני. ✅ פיצ'ר שלם בחינם.

### 2.2 · הגדרות אבטחה

**Authentication → Settings:**

- **User actions →** השאירו ✅ "Enable create (sign-up)"
- **Email enumeration protection →** ✅ **הפעילו**. מונע מתוקף לגלות אילו אימיילים רשומים במערכת (משנה את הודעת השגיאה ל"פרטים שגויים" גנרי).
- **Authorized domains →** ודאו שיש `localhost` (לפיתוח) ואת דומיין ה-Hosting שלכם.

---

## שלב 3 · Realtime Database

> ⚠️ **שימו לב:** יש שני מוצרי DB ב-Firebase. אנחנו רוצים **Realtime Database**, לא **Firestore**. הם שונים לגמרי ב-API ובכללי האבטחה. אל תלחצו על Firestore.

1. **Build → Realtime Database** → **Create Database**.
2. **מיקום:** `europe-west1` (בלגיה) — הכי קרוב לישראל, ~40ms latency לעומת ~150ms מארה"ב. **המיקום לא ניתן לשינוי אחר כך.**
3. **Security rules:** בחרו **"Start in locked mode"**.

> 🚨 **לעולם אל תבחרו "Test mode".** זה פותח את כל בסיס הנתונים לקריאה וכתיבה לכל העולם למשך 30 יום. סורקים אוטומטיים מוצאים בסיסי נתונים כאלה תוך שעות. אנחנו נעלה כללים אמיתיים בשלב 6.

4. העתיקו את ה-**Database URL** שמופיע למעלה — צריך אותו ל-`.env.local`.

---

## שלב 4 · Storage

1. **Build → Storage** → **Get started**.
2. **Start in production mode** → **Next**.
3. מיקום: **אותו מיקום כמו ה-DB** (`europe-west1`).

> **הערה על תוכנית התשלום:** מאז אוקטובר 2024 Firebase Storage דורש **תוכנית Blaze** (חיוב לפי שימוש) בפרויקטים חדשים. יש רובד חינמי נדיב (5GB אחסון, 1GB/יום הורדה), אבל צריך לצרף כרטיס אשראי.
>
> **המלצת PM:** התחילו בלי Storage. אווטארים וחשבוניות הם פיצ'רים של גרסה 1.1. בשלב 1 השתמשו ב**אווטאר מבוסס ראשי-תיבות** (עיגול צבעוני עם האות הראשונה של השם) — נראה טוב, עולה 0, ולא דורש כרטיס אשראי. אם בכל זאת מפעילים Blaze — **הגדירו התראת תקציב מיד**, ראו שלב 8.

### 4.1 · CORS ל-Storage (רק אם משתמשים)

בלי זה, העלאה מ-`localhost` תיכשל בשגיאת CORS מבלבלת:

```bash
# cors.json
[{ "origin": ["http://localhost:5173", "https://YOUR-PROJECT.web.app"],
   "method": ["GET", "HEAD", "PUT", "POST"],
   "maxAgeSeconds": 3600,
   "responseHeader": ["Content-Type", "Authorization", "Content-Length", "User-Agent", "x-goog-resumable"] }]
```

```bash
gsutil cors set cors.json gs://YOUR-PROJECT.appspot.com
```

---

## שלב 5 · התקנת כלי הפיתוח

```bash
# CLI גלובלי
npm install -g firebase-tools

# התחברות (יפתח דפדפן)
firebase login

# אימות
firebase projects:list
```

### 5.1 · חיבור התיקייה המקומית

מתוך תיקיית הפרויקט:

```bash
firebase init
```

בחרו במקש רווח (ולא Enter!) את:

```
◉ Realtime Database: Configure security rules
◉ Storage: Configure a security rules file
◉ Hosting: Configure files for Firebase Hosting
◉ Emulators: Set up local emulators
```

תשובות לשאלות:

| שאלה | תשובה |
|------|--------|
| Use an existing project? | **Use an existing project** → בחרו את שלכם |
| Database rules file? | `database.rules.json` |
| Storage rules file? | `storage.rules` |
| Public directory? | **`dist`** ⚠️ (לא `public`! Vite בונה ל-`dist`) |
| Single-page app rewrite? | **Yes** ⚠️ (קריטי — בלי זה רענון ב-`/r/ABC123` יחזיר 404) |
| GitHub Actions deploys? | `No` (נגדיר ידנית בשלב 10) |
| Overwrite `dist/index.html`? | **No** ⚠️ |
| Which emulators? | **Authentication, Database, Storage, Hosting** |
| Download emulators now? | `Yes` |

---

## שלב 6 · העלאת Security Rules

הקבצים `database.rules.json` ו-`storage.rules` נמצאים כבר בשורש הפרויקט (ראו [03-security-rules.md](./03-security-rules.md) להסבר מלא).

```bash
firebase deploy --only database,storage
```

**אימות שזה עבד:** Console → Realtime Database → לשונית **Rules** → צריך להופיע ה-JSON שלכם. אם רואים `".read": true` — משהו לא עלה, אל תמשיכו.

---

## שלב 7 · האמולטורים — הכלי החשוב ביותר לפיתוח

זהו החלק שחוסך את הכי הרבה זמן ותסכול בפרויקט, ורוב המפתחים מדלגים עליו ומתחרטים.

### למה חובה לעבוד עם אמולטורים

| בלי אמולטורים | עם אמולטורים |
|---------------|--------------|
| בדיקות מלכלכות את ה-DB האמיתי | הכל נמחק בסגירה |
| כל שינוי ב-Rules = deploy של 30 שניות | שמירת קובץ = טעינה מיידית |
| אי אפשר לבדוק Rules אוטומטית | בדיקות Rules ב-CI |
| צריך אינטרנט | עובד לגמרי אופליין |
| שוברים משהו = משתמשים אמיתיים נפגעים | בועה מבודדת |
| צריך מיילים אמיתיים לרישום | Auth מדומה, כל מייל עובד |

### 7.1 · `firebase.json` המלא

```jsonc
{
  "database": { "rules": "database.rules.json" },
  "storage":  { "rules": "storage.rules" },
  "hosting": {
    "public": "dist",
    "ignore": ["firebase.json", "**/.*", "**/node_modules/**"],
    "rewrites": [{ "source": "**", "destination": "/index.html" }],
    "headers": [
      {
        // נכסים עם hash בשם — cache לנצח
        "source": "**/assets/**",
        "headers": [{ "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }]
      },
      {
        // ‼️ ה-Service Worker לעולם לא ב-cache, אחרת משתמשים תקועים בגרסה ישנה
        "source": "/sw.js",
        "headers": [{ "key": "Cache-Control", "value": "no-cache, no-store, must-revalidate" }]
      },
      {
        "source": "/index.html",
        "headers": [{ "key": "Cache-Control", "value": "no-cache" }]
      }
    ]
  },
  "emulators": {
    "auth":     { "port": 9099 },
    "database": { "port": 9000 },
    "storage":  { "port": 9199 },
    "hosting":  { "port": 5000 },
    "ui":       { "enabled": true, "port": 4000 },
    "singleProjectMode": true
  }
}
```

### 7.2 · הפעלה

```bash
# הפעלה רגילה
firebase emulators:start

# עם שמירת נתונים בין הרצות (מומלץ מאוד — לא צריך ליצור משתמשים מחדש כל בוקר)
firebase emulators:start --import=./.emulator-data --export-on-exit
```

הוסיפו `.emulator-data/` ל-`.gitignore`.

**ממשק האמולטורים: [http://localhost:4000](http://localhost:4000)** — שם רואים את עץ הנתונים בזמן אמת, יוצרים משתמשי בדיקה, ובודקים בלשונית "Requests" **בדיוק איזה כלל אבטחה חסם בקשה**. הלשונית הזו היא הכלי הטוב ביותר לדיבוג Rules.

### 7.3 · חיבור הקוד לאמולטורים

```ts
// src/config/firebase.ts
import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { getDatabase, connectDatabaseEmulator } from 'firebase/database';
import { getStorage, connectStorageEmulator } from 'firebase/storage';

const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FB_API_KEY,
  authDomain:        import.meta.env.VITE_FB_AUTH_DOMAIN,
  databaseURL:       import.meta.env.VITE_FB_DATABASE_URL,
  projectId:         import.meta.env.VITE_FB_PROJECT_ID,
  storageBucket:     import.meta.env.VITE_FB_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FB_MSG_SENDER_ID,
  appId:             import.meta.env.VITE_FB_APP_ID,
};

const app = initializeApp(firebaseConfig);

export const auth    = getAuth(app);
export const db      = getDatabase(app);
export const storage = getStorage(app);

// חיבור אוטומטי לאמולטורים בפיתוח
if (import.meta.env.VITE_USE_EMULATORS === 'true') {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  connectDatabaseEmulator(db, '127.0.0.1', 9000);
  connectStorageEmulator(storage, '127.0.0.1', 9199);
  console.info('🔧 מחובר לאמולטורים המקומיים');
}
```

> ⚠️ השתמשו ב-`127.0.0.1` ולא ב-`localhost`. ב-Node 18+ ובחלק מהדפדפנים `localhost` נפתר ל-IPv6 (`::1`) בעוד האמולטור מאזין ל-IPv4 בלבד — התוצאה היא שגיאות התחברות מסתוריות שקשה מאוד לאבחן.

### 7.4 · קבצי סביבה

```bash
# .env.local   ← 🚫 ב-.gitignore, לא נכנס ל-git
VITE_FB_API_KEY=AIzaSyD...
VITE_FB_AUTH_DOMAIN=roommate-app-xxxxx.firebaseapp.com
VITE_FB_DATABASE_URL=https://roommate-app-xxxxx-default-rtdb.europe-west1.firebasedatabase.app
VITE_FB_PROJECT_ID=roommate-app-xxxxx
VITE_FB_STORAGE_BUCKET=roommate-app-xxxxx.appspot.com
VITE_FB_MSG_SENDER_ID=123456789012
VITE_FB_APP_ID=1:123456789012:web:abc123
VITE_USE_EMULATORS=true
```

```bash
# .env.example  ← ✅ כן נכנס ל-git, כדי שחבר לצוות ידע מה צריך
VITE_FB_API_KEY=
VITE_FB_AUTH_DOMAIN=
VITE_FB_DATABASE_URL=
VITE_FB_PROJECT_ID=
VITE_FB_STORAGE_BUCKET=
VITE_FB_MSG_SENDER_ID=
VITE_FB_APP_ID=
VITE_USE_EMULATORS=true
```

> **כלל:** כל משתנה שמתחיל ב-`VITE_` **נחשף בקוד הצד-לקוח**. לעולם אל תשימו שם סוד אמיתי.

---

## שלב 8 · הגנה מפני הפתעות בחשבון

אם הפעלתם תוכנית Blaze (בגלל Storage), **עשו את זה עכשיו ולא אחר כך**. באג בלולאת האזנה יכול לייצר מיליוני קריאות בלילה אחד.

1. [Google Cloud Console → Billing → Budgets & alerts](https://console.cloud.google.com/billing/budgets)
2. **Create Budget** → סכום: **$5** (או ₪20)
3. התראות ב-**50%, 90%, 100%** למייל שלכם.

> **חשוב לדעת:** התראת תקציב **מתריעה בלבד, לא עוצרת** את השירות. כדי לעצור באמת צריך Cloud Function שמנתקת חיוב — ראו [09-best-practices.md](./09-best-practices.md).

### כמה זה באמת יעלה?

לחדר מעונות עם 4 סטודנטים, שימוש יומיומי סביר:

| משאב | מכסה חינמית (Spark) | צריכה משוערת בחודש | סטטוס |
|------|---------------------|--------------------|-------|
| RTDB — אחסון | 1 GB | ~2 MB | ✅ 0.2% |
| RTDB — הורדה | 10 GB/חודש | ~200 MB | ✅ 2% |
| RTDB — חיבורים בו-זמנית | 100 | 4 | ✅ 4% |
| Auth | ללא הגבלה | — | ✅ |
| Hosting | 10 GB/חודש | ~500 MB | ✅ 5% |
| Storage | 5 GB (Blaze) | ~50 MB | ✅ |

**מסקנה: הפרויקט יעלה ₪0 בשימוש אמיתי.** אפילו 25 חדרים במקביל נשארים בתוך המכסה החינמית. עלות נוצרת רק מבאגים (לולאת האזנה אינסופית) — ולזה נועדה התראת התקציב.

---

## שלב 9 · אינדקסים

RTDB לא בונה אינדקסים אוטומטית. בלי `.indexOn`, כל query ממוין מוריד את **כל** הצומת ללקוח וממיין בזיכרון — עובד ב-10 פריטים, קורס ב-10,000, ומדפיס אזהרה בקונסול.

האינדקסים כבר מוגדרים ב-`database.rules.json` שלנו:

```jsonc
"items":         { ".indexOn": ["status", "category", "reportedAt", "priority"] }
"purchases":     { ".indexOn": ["status", "createdAt", "boughtBy"] }
"notifications": { ".indexOn": ["createdAt"] }
"members":       { ".indexOn": ["status"] }
```

---

## ✅ בדיקת קבלה — 8 סימונים לפני שממשיכים

- [ ] `firebase projects:list` מציג את הפרויקט
- [ ] Authentication → Email/Password במצב **Enabled**
- [ ] Realtime Database קיים ב-`europe-west1`, ולשונית Rules **אינה** `true`
- [ ] `firebase emulators:start` עולה בלי שגיאות
- [ ] `http://localhost:4000` נפתח ומציג את כל ארבעת האמולטורים
- [ ] `.env.local` מלא, ו-`.gitignore` מכיל `.env.local`
- [ ] `git status` **לא** מציג את `.env.local`
- [ ] בהרצת האפליקציה מופיע בקונסול `🔧 מחובר לאמולטורים המקומיים`

עברתם את השמונה? עברו ל-[04-development-guide.md](./04-development-guide.md).
