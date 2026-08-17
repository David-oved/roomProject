# 08 · Checklist — מה להתקין ומה ליצור

הרשימה המלאה לסימון. אם הכל מסומן — אתם מוכנים לפתח.

---

## חלק א · תוכנות במחשב

| כלי | גרסה מינימלית | בדיקה | הורדה |
|-----|:-------------:|-------|-------|
| Node.js | 20 LTS | `node -v` | [nodejs.org](https://nodejs.org) |
| npm | 10 | `npm -v` | מגיע עם Node |
| Git | 2.40 | `git --version` | [git-scm.com](https://git-scm.com) |
| Java JDK | 17 | `java -version` | ⚠️ **נדרש לאמולטורים!** [adoptium.net](https://adoptium.net) |
| VS Code | — | — | [code.visualstudio.com](https://code.visualstudio.com) |
| Chrome | אחרון | — | לדיבוג ו-Lighthouse |

> ⚠️ **Java היא ההפתעה.** רוב המפתחים לא מבינים למה פרויקט React צריך Java — האמולטורים של Firebase כתובים ב-Java. בלעדיה `firebase emulators:start` נכשל בשגיאה מבלבלת על `java: command not found`. התקינו את זה **לפני** שאתם מתחילים.

### תוספי VS Code

```
ESLint                          dbaeumer.vscode-eslint
Prettier                        esbenp.prettier-vscode
Tailwind CSS IntelliSense       bradlc.vscode-tailwindcss
Firebase                        toba.vsfire
Error Lens                      usernamehw.errorlens
Vitest                          vitest.explorer
```

### הגדרות VS Code מומלצות

```jsonc
// .vscode/settings.json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": { "source.fixAll.eslint": "explicit" },
  "typescript.tsdk": "node_modules/typescript/lib",
  "files.eol": "\n"
}
```

---

## חלק ב · חבילות npm

```bash
# ── ייצור ──
npm i firebase                # SDK — Auth, RTDB, Storage
npm i react-router-dom        # ניתוב
npm i zod                     # ולידציה + טיפוסים
npm i date-fns                # תאריכים (עם locale עברי)
npm i idb-keyval              # מטמון IndexedDB (1KB)

# ── פיתוח ──
npm i -D tailwindcss postcss autoprefixer
npm i -D vite-plugin-pwa
npm i -D vitest @vitest/ui jsdom
npm i -D @testing-library/react @testing-library/user-event @testing-library/jest-dom
npm i -D @firebase/rules-unit-testing
npm i -D @playwright/test
npm i -D eslint prettier prettier-plugin-tailwindcss
npm i -D typescript @types/react @types/react-dom

# ── גלובלי ──
npm i -g firebase-tools
```

### ✅ אימות ההתקנה

```bash
node -v            # v20.x.x ומעלה
java -version      # 17 ומעלה
firebase --version # 13.x ומעלה
firebase login     # פותח דפדפן
firebase projects:list
```

---

## חלק ג · Firebase Console — 22 סימונים

מדריך מפורט לכל שלב: [02-firebase-setup.md](./02-firebase-setup.md)

### פרויקט
- [ ] פרויקט נוצר ב-[console.firebase.google.com](https://console.firebase.google.com)
- [ ] Google Analytics **כבוי**
- [ ] אפליקציית Web רשומה (אייקון `</>`)
- [ ] אובייקט `firebaseConfig` הועתק

### Authentication
- [ ] **Email/Password** מופעל
- [ ] "Email link (passwordless)" **כבוי**
- [ ] תבנית "Password reset" תורגמה לעברית
- [ ] Sender name = `RoomMate`
- [ ] **Email enumeration protection** מופעל
- [ ] `localhost` ברשימת ה-Authorized domains

### Realtime Database
- [ ] נוצר — **Realtime Database**, לא Firestore ⚠️
- [ ] מיקום: `europe-west1`
- [ ] נוצר ב-**Locked mode**, לא Test mode ⚠️
- [ ] Database URL הועתק
- [ ] `database.rules.json` נפרס (`firebase deploy --only database`)
- [ ] לשונית Rules ב-Console מציגה את הכללים שלכם

### Storage (רק אם משתמשים בתמונות)
- [ ] Bucket נוצר, באותו מיקום כמו ה-DB
- [ ] `storage.rules` נפרס
- [ ] CORS מוגדר עבור `localhost:5173`
- [ ] **התראת תקציב $5 הוגדרה** ⚠️

### Hosting
- [ ] Hosting מופעל
- [ ] `firebase init` הורץ, ה-public directory הוא **`dist`**
- [ ] SPA rewrite = **Yes**

---

## חלק ד · קבצים בפרויקט

### קיימים כבר ✅

- [x] `docs/` — 10 מסמכי התכנון
- [x] `database.rules.json` — כללי RTDB מלאים
- [x] `storage.rules` — כללי Storage

### ליצור

- [ ] `.env.local` — הקונפיג האמיתי (🚫 **לא** ב-git)
- [ ] `.env.example` — תבנית ריקה (✅ כן ב-git)
- [ ] `.gitignore` — עם `.env.local`, `.emulator-data/`, `dist/`
- [ ] `firebase.json` — [תבנית מלאה ב-02](./02-firebase-setup.md#71--firebasejson-המלא)
- [ ] `.firebaserc` — נוצר ע"י `firebase init`
- [ ] `vite.config.ts` — [תבנית מלאה ב-05](./05-offline-pwa.md#62--הגדרת-vite-plugin-pwa)
- [ ] `tailwind.config.js`
- [ ] `src/config/firebase.ts`
- [ ] `src/types/models.ts`
- [ ] `index.html` עם `lang="he" dir="rtl"`

### נכסים (Assets)

- [ ] `public/icons/icon-192.png`
- [ ] `public/icons/icon-512.png`
- [ ] `public/icons/icon-maskable-512.png` — עם 20% שוליים בטוחים
- [ ] `public/icons/apple-touch-icon-180.png`
- [ ] `public/favicon.svg`

> **ליצירת האייקונים:** [maskable.app/editor](https://maskable.app/editor) — מעלים תמונה אחת ומקבלים את כל הגדלים, כולל תצוגה מקדימה של האייקון על אנדרואיד.

---

## חלק ה · אימות שהכל עובד

הריצו לפי הסדר. כל שלב שנכשל — עצרו ותקנו לפני שממשיכים.

```bash
# 1. התלויות מותקנות
npm install                          # ← ללא שגיאות

# 2. שרת הפיתוח עולה
npm run dev                          # ← http://localhost:5173

# 3. האמולטורים עולים (טרמינל נפרד)
npm run emu                          # ← http://localhost:4000

# 4. הקוד מחובר לאמולטורים
#    בקונסול הדפדפן: 🔧 מחובר לאמולטורים המקומיים

# 5. הכללים נטענים באמולטור
#    ב-localhost:4000 → Database → Rules

# 6. הבנייה עוברת
npm run build                        # ← dist/ נוצר

# 7. הבנייה רצה
npm run preview                      # ← http://localhost:4173

# 8. סודות לא דלפו
git status                           # ← .env.local לא מופיע
```

---

## חלק ו · Checklist לכל שלב פיתוח

גזרו והדביקו לכל שלב במפת הדרכים:

```markdown
### שלב N: ______________

**לפני:**
- [ ] קראתי את סעיף המסמך הרלוונטי
- [ ] הטיפוסים ב-types/models.ts מעודכנים
- [ ] הכללים ב-database.rules.json מכסים את השדות החדשים

**במהלך:**
- [ ] assertOnline() בכל פונקציית service שכותבת
- [ ] כל onValue מחזיר unsubscribe
- [ ] סכומים באגורות בלבד
- [ ] ms-*/me-* ולא ml-*/mr-*
- [ ] חמשת מצבי המסך מטופלים

**אחרי:**
- [ ] npm run test ירוק
- [ ] npm run test:rules ירוק
- [ ] נבדק ידנית בשני דפדפנים עם שני משתמשים
- [ ] נבדק במצב אופליין
- [ ] נבדק במסך צר (375px)
- [ ] commit עם הודעה תיאורית
```

---

## חלק ז · שלוש טעויות שעוצרות פרויקטים

לפי סדר התדירות בפרויקטים מסוג זה:

### 1. דילוג על האמולטורים
> *"למה להתקין Java? אני אפתח מול ה-DB האמיתי."*

**מה קורה:** אחרי שבוע בסיס הנתונים מלא בזבל בדיקות, אי אפשר לבדוק Rules אוטומטית, וכל שינוי בכללים דורש deploy של 30 שניות. בסוף מנקים הכל ומתקינים אמולטורים בכל זאת — אחרי שבוזבזו 10 שעות.

### 2. השארת `.read: true` "רק לפיתוח"
> *"אני אתקן את זה לפני ההשקה."*

**מה קורה:** בסיס נתונים פתוח נסרק אוטומטית תוך שעות. גם אם אין נזק — זו לא הרגלת עבודה שכדאי לפתח. **הכללים נכתבים ראשונים, לא אחרונים.**

### 3. חישוב כסף ב-float
> *"20 חלקי 3 זה 6.67, מה כבר יכול לקרות?"*

**מה קורה:** אחרי 40 קניות המאזנים לא מסתדרים, אף אחד לא מבין למה, והתיקון דורש שכתוב של כל שכבת הכספים. **אגורות. תמיד.**
