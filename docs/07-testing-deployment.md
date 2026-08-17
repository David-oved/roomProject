# 07 · בדיקות ופריסה

---

## 1. פירמידת הבדיקות — מותאמת לפרויקט הזה

לא כל שכבה שווה בערכה. זו החלוקה שנותנת את מירב הביטחון על כל שעת עבודה:

```
        /\
       /E2E\          5 תרחישים        · Playwright       · איטי, שביר, יקר
      /------\
     /  Rules \      25 בדיקות        · Emulator         · 🔥 התשואה הגבוהה ביותר
    /----------\
   / Components \    20 בדיקות        · Testing Library  · בינוני
  /--------------\
 /   Unit (lib/)  \  60 בדיקות        · Vitest           · מהיר, זול, קריטי
/------------------\
```

**שתי השכבות שחייבות להיות חזקות בפרויקט הזה:**

1. **`lib/` — כל חישוב הכסף.** פונקציות טהורות, בדיקה מיידית, וכל באג שם פוגע ישירות בכיס של המשתמשים.
2. **Rules.** זו שכבת האבטחה **היחידה**. Rules לא נבדקים = אבטחה לא ידועה.

E2E נשארים מעטים ומכוונים — הם איטיים ושבירים, ומכסים רק את המסלולים הקריטיים.

---

## 2. Unit — `lib/`

```ts
// vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    globals: true,
    coverage: {
      include: ['src/lib/**'],
      thresholds: { lines: 95, functions: 95, branches: 90 },
    },
  },
});
```

### 2.1 · הבדיקות שאסור לוותר עליהן

```ts
// tests/unit/money.test.ts
import { describe, it, expect } from 'vitest';
import { splitEqual, splitPercentage, toAgorot, formatILS } from '../../src/lib/money';

describe('splitEqual', () => {
  it('משמר את הסכום המדויק גם כשהחלוקה לא עגולה', () => {
    const shares = splitEqual(2000, ['a', 'b', 'c']);      // ₪20 ל-3
    expect(Object.values(shares).reduce((x, y) => x + y)).toBe(2000);
    expect(Object.values(shares).sort()).toEqual([666, 667, 667]);
  });

  it('דטרמיניסטי — סדר הקלט לא משנה את התוצאה', () => {
    expect(splitEqual(2000, ['c', 'a', 'b']))
      .toEqual(splitEqual(2000, ['a', 'b', 'c']));
  });

  it('משתתף יחיד מקבל את הכל', () => {
    expect(splitEqual(1234, ['a'])).toEqual({ a: 1234 });
  });

  it('זורק על אפס משתתפים', () => {
    expect(() => splitEqual(1000, [])).toThrow();
  });

  // בדיקת נכס (property-based) — 1000 מקרים אקראיים
  it('סכום החלקים תמיד שווה לסכום המקורי', () => {
    for (let i = 0; i < 1000; i++) {
      const total = Math.floor(Math.random() * 100_000) + 1;
      const n = Math.floor(Math.random() * 8) + 1;
      const ids = Array.from({ length: n }, (_, k) => `u${k}`);
      const sum = Object.values(splitEqual(total, ids)).reduce((x, y) => x + y, 0);
      expect(sum).toBe(total);
    }
  });
});

describe('toAgorot', () => {
  it.each([
    [12.34, 1234],
    [0.01, 1],
    [100, 10_000],
    [0.1 + 0.2, 30],      // ← 0.30000000000000004 ב-float. חייב להיות 30.
  ])('₪%s → %s אגורות', (shekels, agorot) => {
    expect(toAgorot(shekels)).toBe(agorot);
  });
});
```

```ts
// tests/unit/balances.test.ts
describe('computeBalances', () => {
  it('🔴 סכום כל המאזנים בחדר הוא תמיד אפס', () => {
    const balances = computeBalances(randomPurchases(500), randomSettlements(50), MEMBERS);
    expect(Object.values(balances).reduce((a, b) => a + b, 0)).toBe(0);
  });

  it('קניות ממתינות אינן משפיעות על המאזן', () => {
    const pending = [{ ...basePurchase, status: 'pending' as const }];
    expect(computeBalances(pending, [], ['a', 'b'])).toEqual({ a: 0, b: 0 });
  });

  it('סגירת חשבון מאפסת את החוב', () => {
    const b1 = computeBalances([purchase20ByA], [], ['a', 'b']);
    expect(b1).toEqual({ a: 1000, b: -1000 });
    const b2 = computeBalances([purchase20ByA], [{ from: 'b', to: 'a', amount: 1000, date: 1 }], ['a', 'b']);
    expect(b2).toEqual({ a: 0, b: 0 });
  });
});
```

> **בדיקת "סכום המאזנים = 0" היא הבדיקה החשובה ביותר בפרויקט.** אם היא ירוקה, הכסף מסתדר. אם היא אדומה — יש באג כספי, ולא משנה מה שאר הבדיקות אומרות. הריצו אותה גם בייצור, כמדד בריאות בדשבורד המנהל.

---

## 3. Rules — מול האמולטור

הקוד המלא ורשימת 12 הבדיקות המחייבות: [03-security-rules.md, סעיף 4](./03-security-rules.md#4-בדיקת-הכללים--לא-אופציונלי).

```bash
npm run test:rules
```

---

## 4. Component — Testing Library

```ts
// tests/setup.ts
import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';

// מדמים את שכבת ה-services — קומפוננטות לא נוגעות ב-Firebase (ראו חוק הייבוא)
vi.mock('../src/services/itemService');
```

```tsx
// tests/components/ItemCard.test.tsx
describe('ItemCard', () => {
  it('כפתור התפיסה מושבת במצב אופליין', () => {
    render(<ItemCard item={mockItem} />, { wrapper: offlineWrapper });
    const btn = screen.getByRole('button', { name: /אני קונה/ });
    expect(btn).toBeDisabled();
    expect(btn).toHaveAttribute('title', expect.stringContaining('חיבור לאינטרנט'));
  });

  it('מציג מי דיווח על המוצר', () => {
    render(<ItemCard item={mockItem} />, { wrapper: onlineWrapper });
    expect(screen.getByText(/דיווח: יוסי/)).toBeInTheDocument();
  });

  it('לחיצה על תפיסה קוראת ל-claimItem', async () => {
    const user = userEvent.setup();
    render(<ItemCard item={mockItem} />, { wrapper: onlineWrapper });
    await user.click(screen.getByRole('button', { name: /אני קונה/ }));
    expect(claimItem).toHaveBeenCalledWith('ABC123', 'item1', 'user1');
  });
});
```

**מה בודקים:** התנהגות שהמשתמש רואה. **מה לא בודקים:** מבנה DOM פנימי, שמות מחלקות CSS, סדר קריאות פנימיות.

---

## 5. E2E — חמישה מסלולים בלבד

```bash
npm i -D @playwright/test && npx playwright install chromium
```

```ts
// tests/e2e/full-flow.spec.ts
import { test, expect } from '@playwright/test';

test('מחזור חיים מלא: הרשמה → חדר → מוצר → קנייה → אישור → מאזן', async ({ browser }) => {
  const adminCtx = await browser.newContext();
  const memberCtx = await browser.newContext();
  const admin = await adminCtx.newPage();
  const member = await memberCtx.newPage();

  // 1) המנהל נרשם ויוצר חדר
  await admin.goto('/register');
  await admin.getByLabel('אימייל').fill('admin@test.com');
  await admin.getByLabel('סיסמה').fill('Test1234');
  await admin.getByLabel('שם מלא').fill('דנה');
  await admin.getByRole('button', { name: 'הרשמה' }).click();

  await admin.getByRole('button', { name: 'יצירת חדר חדש' }).click();
  await admin.getByLabel('שם החדר').fill('דירה 12');
  await admin.getByRole('button', { name: 'צור חדר' }).click();

  const code = await admin.getByTestId('room-code').innerText();
  expect(code).toMatch(/^[A-Z0-9]{6}$/);

  // 2) חבר נרשם ומבקש להצטרף
  await member.goto('/register');
  /* ... */
  await member.getByLabel('קוד חדר').fill(code);
  await member.getByRole('button', { name: 'שלח בקשה' }).click();
  await expect(member.getByText('הבקשה ממתינה לאישור')).toBeVisible();

  // 3) המנהל מאשר — הבקשה מופיעה אצלו בזמן אמת
  await expect(admin.getByText('יוסי רוצה להצטרף')).toBeVisible({ timeout: 3000 });
  await admin.getByRole('button', { name: 'אשר' }).click();

  // 4) סנכרון בזמן אמת: המנהל מדווח, החבר רואה
  await admin.getByRole('button', { name: 'דיווח על מוצר חסר' }).click();
  await admin.getByLabel('שם המוצר').fill('חלב');
  await admin.getByRole('button', { name: 'דווח' }).click();

  await expect(member.getByText('חלב')).toBeVisible({ timeout: 2000 });   // ← יעד <1s

  // 5) החבר קונה
  await member.getByRole('button', { name: 'אני קונה את זה' }).click();
  await member.getByRole('button', { name: 'סמן כנקנה' }).click();
  await member.getByLabel('סכום').fill('20');
  await member.getByRole('button', { name: 'שמור' }).click();

  // 6) המנהל מאשר → המאזנים מתעדכנים
  await admin.getByRole('button', { name: 'אשר קנייה' }).click();
  await expect(admin.getByTestId('my-balance')).toHaveText('₪10.00-');
  await expect(member.getByTestId('my-balance')).toHaveText('₪10.00');
});
```

**חמשת המסלולים:**

1. ✅ מחזור חיים מלא (למעלה)
2. הרשמה → יצירת חדר → קוד תקין
3. הצטרפות → דחייה ע"י המנהל
4. הצטרפות עם קוד שגוי → הודעת שגיאה
5. מצב אופליין → כפתורים מושבתים → חזרת רשת

---

## 6. בדיקות ידניות — מה שאוטומציה לא תופסת

### 6.1 · מכשירים אמיתיים (חובה לפני עלייה לאוויר)

| מכשיר | מה בודקים |
|-------|-----------|
| אייפון (Safari) | התקנה למסך הבית, safe areas, אין זום בשדות קלט |
| אנדרואיד (Chrome) | באנר התקנה, אייקון maskable |
| טאבלט | פריסה במסך רחב — לא סתם מובייל מתוח |
| מסך קטן (SE) | הכל נגיש, אין גלישה אופקית |

### 6.2 · בדיקת ה-RTL

- [ ] כל הטקסט מיושר לימין
- [ ] חצי ניווט מצביעים לכיוון הנכון
- [ ] מספרים וסכומים ב-LTR בתוך משפט עברי (`₪12.34`, לא `43.21₪`)
- [ ] תאריכים בפורמט ישראלי
- [ ] אין `ml-*`/`mr-*` בקוד (רק `ms-*`/`me-*`)

### 6.3 · נגישות

```bash
npx lighthouse http://localhost:4173 --only-categories=accessibility --view
```

- [ ] ניווט מלא במקלדת
- [ ] יעדי מגע ≥ 44×44px
- [ ] ניגודיות ≥ 4.5:1
- [ ] כל שדה עם `<label>` מקושר
- [ ] הודעות שגיאה עם `role="alert"`
- [ ] קורא מסך (VoiceOver / TalkBack) — מסלול אחד לפחות

---

## 7. פריסה

### 7.1 · ההעלאה הראשונה

```bash
# 1) עוברים לפרויקט האמיתי (לא אמולטורים!)
#    ב-.env.production:  VITE_USE_EMULATORS=false

# 2) בנייה
npm run build

# 3) בדיקה מקומית של הבנייה — לא לדלג
npm run preview     # http://localhost:4173

# 4) פריסה
firebase deploy
```

**התוצאה:** `https://YOUR-PROJECT.web.app`

### 7.2 · ערוצי תצוגה מקדימה

```bash
# כתובת זמנית ל-7 ימים — מושלם לשלוח לשותפים לבדיקה
firebase hosting:channel:deploy preview --expires 7d
```

זה הכלי הכי שימושי בפרויקט הזה: אפשר לשלוח קישור לשותפים לחדר, שיבדקו על המכשירים שלהם, בלי לגעת בגרסה החיה.

### 7.3 · סדר פריסה נכון

```bash
# 1. כללים תחילה — תמיד
firebase deploy --only database,storage

# 2. ורק אז הקוד
firebase deploy --only hosting
```

> **למה הסדר חשוב:** אם תפרסו קוד שכותב שדה חדש לפני שהכלל שמתיר אותו עלה, כל המשתמשים יקבלו `PERMISSION_DENIED` עד שתפרסו את הכללים. בכיוון ההפוך אין נזק — כלל שמתיר שדה שאף אחד עוד לא כותב הוא לא מזיק.

### 7.4 · GitHub Actions

```yaml
# .github/workflows/deploy.yml
name: Test & Deploy

on:
  push: { branches: [main] }
  pull_request: { branches: [main] }

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: npm }
      - run: npm ci
      - run: npm run lint
      - run: npm run test
      - uses: actions/setup-java@v4          # האמולטורים דורשים Java
        with: { distribution: temurin, java-version: 17 }
      - run: npm i -g firebase-tools
      - run: npm run test:rules
      - run: npm run build

  deploy:
    needs: test
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: npm }
      - run: npm ci
      - run: npm run build
        env:
          VITE_FB_API_KEY:        ${{ secrets.VITE_FB_API_KEY }}
          VITE_FB_AUTH_DOMAIN:    ${{ secrets.VITE_FB_AUTH_DOMAIN }}
          VITE_FB_DATABASE_URL:   ${{ secrets.VITE_FB_DATABASE_URL }}
          VITE_FB_PROJECT_ID:     ${{ secrets.VITE_FB_PROJECT_ID }}
          VITE_FB_STORAGE_BUCKET: ${{ secrets.VITE_FB_STORAGE_BUCKET }}
          VITE_FB_MSG_SENDER_ID:  ${{ secrets.VITE_FB_MSG_SENDER_ID }}
          VITE_FB_APP_ID:         ${{ secrets.VITE_FB_APP_ID }}
          VITE_USE_EMULATORS:     'false'
      - uses: FirebaseExtended/action-hosting-deploy@v0
        with:
          repoToken: ${{ secrets.GITHUB_TOKEN }}
          firebaseServiceAccount: ${{ secrets.FIREBASE_SERVICE_ACCOUNT }}
          channelId: live
          projectId: YOUR-PROJECT-ID
```

**הפקת ה-Service Account:**

```bash
firebase init hosting:github
```

הפקודה יוצרת את הסוד ב-GitHub אוטומטית. אל תעתיקו קובץ JSON ידנית.

---

## 8. Checklist לפני עלייה לאוויר

### קוד
- [ ] `npm run lint` נקי
- [ ] `npm run test` ירוק
- [ ] `npm run test:rules` ירוק — **כל 12 הבדיקות המחייבות**
- [ ] `npm run build` בלי אזהרות
- [ ] אין `console.log` בקוד ייצור
- [ ] אין `TODO` קריטי פתוח

### Firebase
- [ ] הכללים בייצור **אינם** `true`
- [ ] Email/Password מופעל
- [ ] Email enumeration protection מופעל
- [ ] תבניות מייל בעברית
- [ ] `.indexOn` מוגדר לכל צומת שנשאל
- [ ] התראת תקציב פעילה (אם Blaze)

### ביצועים
- [ ] Lighthouse Performance ≥ 90
- [ ] Lighthouse PWA = 100
- [ ] Lighthouse Accessibility ≥ 90
- [ ] Bundle < 500KB gzipped (`npx vite-bundle-visualizer`)
- [ ] נבדק ב-Slow 4G מדומה

### פונקציונליות
- [ ] מחזור חיים מלא נבדק ידנית עם 2 משתמשים אמיתיים
- [ ] סנכרון < שנייה נמדד
- [ ] מצב אופליין נבדק במכשיר אמיתי במצב טיסה
- [ ] מחיקת חשבון בודקת מאזן פתוח
- [ ] מחיקת חדר דורשת הקלדת שם + חוסמת חובות פתוחים
- [ ] Logout מנקה את IndexedDB (בדוק ב-DevTools)

### תוכן
- [ ] כל הטקסטים בעברית תקינה, בלי שרידי אנגלית
- [ ] כל שגיאות Firebase מתורגמות
- [ ] מסכי Empty State מנוסחים ידידותית
- [ ] favicon ואייקוני PWA במקום

---

## 9. אחרי ההשקה

### מדדים לעקוב אחריהם

| מדד | היכן | סף אזהרה |
|-----|------|----------|
| חיבורים בו-זמנית | Firebase Console → Usage | > 80 (מתוך 100) |
| הורדת נתונים | Console → Usage | > 8GB/חודש |
| שגיאות JS | Console של הדפדפן / Sentry | כל שגיאה חוזרת |
| **סכום מאזנים ≠ 0** | בדיקה בדשבורד המנהל | **כל סטייה** |

### תוכנית גיבוי

RTDB בתוכנית החינמית לא כולל גיבוי אוטומטי. **מינימום:**

```bash
# ייצוא ידני שבועי
firebase database:get / --output backup-$(date +%Y%m%d).json
```

ואם עוברים ל-Blaze — Console → Realtime Database → **Backups** → יומי אוטומטי.
