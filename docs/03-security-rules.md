# 03 · Security Rules — הסבר מלא

הקובץ המוכן לפריסה: [`database.rules.json`](../database.rules.json) · [`storage.rules`](../storage.rules)

---

## 1. איך Security Rules עובדים — 6 עובדות שחייבים להכיר

רוב הבאגים ב-Rules נובעים מאי-הבנה של אחת מהשש האלה.

### 1.1 · הכללים הם **שכבת האבטחה היחידה**

אין שרת ביניים. הדפדפן מדבר ישירות עם Firebase. כל בדיקה ב-React היא רק חוויית משתמש — מי שפותח DevTools ומריץ `firebase.database().ref('/rooms').once('value')` יקבל בדיוק מה שהכללים מרשים לו, ולא יותר.

> **המבחן:** אם מחקתם את כל קוד ה-React ונשארתם רק עם ה-Rules — האם הנתונים עדיין מוגנים? אם לא, ה-Rules לא מספיקים.

### 1.2 · `.read` ו-`.write` **מדורגים כלפי מטה** (Cascade)

```
אם ".read": true בצומת מסוים — כל תת-העץ שמתחתיו קריא.
אין דרך "לבטל" הרשאה בצומת עמוק יותר. ".read": false מתחת ל-true לא עושה כלום.
```

זו הסיבה שהמבנה שלנו מדויק: `.read` ברמת `rooms/$code` דורש חברות פעילה, ולכן **כל** תוכן החדר מוגן במכה אחת. הרשאות עודפות ניתנות רק **מתחת** לכך, לצמתים ספציפיים (`pendingRequests/$uid`), כי מתן הרשאה למטה כן אפשרי.

### 1.3 · `.validate` **לא** מדורג — הוא נבדק בכל צומת בנפרד

זה בדיוק הפוך מ-`.read`/`.write`, וזו מלכודת קלאסית. `.validate` חייב לעבור **בכל** צומת שנכתב. אם `.validate` נכשל באיזשהו צומת בן — **כל הכתיבה נכשלת**, כולל שאר הנתיבים ב-`update()`.

### 1.4 · `.validate` **לא רץ על מחיקה**

```js
// כלל: ".validate": "newData.isString()"
remove(ref(db, 'path'))   // ✅ עובר. newData לא קיים → validate מדולג.
```

**המשמעות המעשית:** אי אפשר להשתמש ב-`.validate` כדי למנוע מחיקה. מניעת מחיקה נעשית **רק** ב-`.write`, עם התנאי `newData.exists()`. בכללים שלנו זה למשל מה שמונע מחיקת קנייה מאושרת.

### 1.5 · `root` הוא המצב **לפני** הכתיבה, `newData` הוא **אחרי**

| ביטוי | מה זה |
|-------|-------|
| `data` | הנתון בצומת הנוכחי, **לפני** הכתיבה |
| `newData` | הנתון בצומת הנוכחי, **אחרי** הכתיבה (ממוזג) |
| `root` | שורש בסיס הנתונים, **לפני** הכתיבה |
| `auth.uid` | מזהה המשתמש המחובר, או `null` |
| `now` | חותמת זמן השרת ב-ms (זה מה ש-`serverTimestamp()` הופך להיות) |

זה מסביר תנאי שנראה מוזר בכללים שלנו:

```jsonc
// members/$uid — סעיף 2
"(!root.child('rooms/' + $code + '/metadata').exists() && $uid === auth.uid && newData.child('role').val() === 'admin')"
```

בזמן יצירת חדר, הכתיבה של המטא-דאטה והחברים קורית ב-`update()` אחד. כשמעריכים את הכלל של `members`, ה-`root` עדיין **לא** מכיל את המטא-דאטה — היא נכתבת באותה פעולה. בלי הסעיף הזה, אף אחד לעולם לא יוכל ליצור חדר: המנהל לא יוכל להוסיף את עצמו כי אין עדיין `adminId` להשוות אליו. זו תקלת "ביצה ותרנגולת" קלאסית שמפילה פרויקטים.

### 1.6 · `update()` מרובה-נתיבים הוא **הכל או כלום**

```js
update(ref(db), {
  'rooms/ABC/items/i1': item,          // ✅ עובר
  'rooms/ABC/notifications/n1': notif, // ❌ נכשל בוולידציה
});
// → שום דבר לא נכתב. גם הפריט לא.
```

זו תכונה, לא באג — היא מבטיחה שלא ייווצר פריט בלי ההתראה שלו. אבל בזמן דיבוג היא מבלבלת: נראה ש"הכתיבה נכשלה" כשלמעשה נתיב אחד מתוך חמישה נכשל. **הפתרון:** לשונית Requests באמולטור מראה בדיוק איזה נתיב נחסם.

---

## 2. טבלת ההרשאות המלאה

| נתיב | קריאה | יצירה | עדכון | מחיקה |
|------|-------|-------|-------|-------|
| `/users/{uid}` | בעלים | בעלים | בעלים | בעלים |
| `/users/{uid}/rooms/{code}` | בעלים | בעלים + מנהל החדר | כנ"ל | כנ"ל |
| `/roomCodes/{code}` | כל מחובר | היוצר | מנהל | מנהל |
| `/roomNames/{slug}` | כל מחובר | אם פנוי | מנהל בעליו | מנהל |
| `/joinRequests/{uid}/{code}` | בעלים | בעלים (`pending`) | בעלים או מנהל | בעלים |
| `/rooms/{code}/**` | **חבר פעיל** | — | — | מנהל (החדר כולו) |
| `/rooms/{code}/metadata` | חבר פעיל | היוצר | **מנהל** | מנהל |
| `/rooms/{code}/members/{uid}` | חבר פעיל | מנהל (או היוצר-עצמו) | **מנהל** | מנהל, או עזיבה עצמית |
| `/rooms/{code}/pendingRequests` | **מנהל** | לא-חבר מחובר | מנהל | מנהל |
| `/rooms/{code}/pendingRequests/{uid}` | + הבעלים | הבעלים | הבעלים או מנהל | שניהם |
| `/rooms/{code}/items/{id}` | חבר פעיל | חבר פעיל | מדווח / מנהל / תפיסה בלבד | **מנהל בלבד** |
| `/rooms/{code}/purchases/{id}` | חבר פעיל | הקונה (`pending`) | מנהל (סטטוס) / קונה (רק pending) | רק כשעדיין `pending` |
| `/rooms/{code}/balances` | חבר פעיל | **מנהל** | מנהל | מנהל |
| `/rooms/{code}/settlements/{id}` | חבר פעיל | משלם או מקבל | רק המקבל (אישור) | ✗ |
| `/rooms/{code}/notifications/{id}` | חבר פעיל | חבר פעיל | מנהל | מנהל |
| `/rooms/{code}/notifications/{id}/readBy/{uid}` | חבר פעיל | הבעלים בלבד | הבעלים | הבעלים |

---

## 3. איך כל דרישה מהמפרט נאכפת

סעיף 10 במפרט מגדיר שש דרישות אבטחה. הנה איפה כל אחת יושבת בקובץ:

| # | דרישה מהמפרט | הכלל שאוכף | מיקום בקובץ |
|---|---------------|-------------|--------------|
| 1 | "משתמש רק יכול לראות חדרים שהוא חבר בהם" | `.read` ב-`rooms/$code` דורש `members/$uid/status === 'active'` | `rooms/$code/.read` |
| 2 | "משתמש לא יכול לשנות חדר של מישהו אחר" | כל `.write` פותח ב-`members/auth.uid/status === 'active'` | כל תת-צומת |
| 3 | "רק admin יכול להוסיף/להסיר משתמשים" | `members/$uid/.write` דורש `adminId === auth.uid` | `members/$uid` |
| 4 | "רק admin יכול למחוק מוצרים" | הסעיף `data.exists() && !newData.exists()` דורש `adminId` | `items/$itemId/.write` |
| 5 | "משתמש רק יכול לערוך מוצרים שהוא דיווח" | `data.child('reportedBy').val() === auth.uid`, עם חריג מוגדר ל"תפיסה" | `items/$itemId/.write` |
| 6 | "Firebase Security Rules חייב לאכוף את כל זה" | ✅ הכל בצד השרת, בלי תלות בקוד הלקוח | הקובץ כולו |

### 3.1 · הכלל המורכב ביותר בקובץ — פירוק

זה כלל העדכון של פריט. הוא נראה מפחיד, אבל הוא בסך הכל שלושה תרחישים:

```jsonc
"items": { "$itemId": {
  ".write": "auth != null && <חבר פעיל> && ( <יצירה> || <עדכון> || <מחיקה> )"
}}
```

**התרחיש המעניין הוא העדכון**, כי הוא צריך לאזן בין שתי דרישות שנראות סותרות:

- דרישה 5: "משתמש רק יכול לערוך מוצרים שהוא דיווח"
- FLOW 4: "משתמש לוחץ *אני קונה את זה*" — כלומר עורך מוצר של **מישהו אחר**

הפתרון: מותר לכל חבר פעיל לעדכן פריט של אחר, **בתנאי שהוא לא שינה אף שדה תוכן**:

```jsonc
"(newData.child('name').val()       === data.child('name').val() &&
  newData.child('category').val()   === data.child('category').val() &&
  newData.child('priority').val()   === data.child('priority').val() &&
  newData.child('reportedBy').val() === data.child('reportedBy').val() &&
  newData.child('reportedAt').val() === data.child('reportedAt').val())"
```

מה שנשאר פתוח לשינוי הוא בדיוק `status`, `assignedTo`, `notes` ו-`purchaseId` — כלומר "תפיסת" הפריט וקידומו בזרימה, ותו לא. מישהו שינסה לשנות את השם של מוצר שדיווח חבר אחר יקבל `PERMISSION_DENIED`.

> **התבנית לזכור:** ב-RTDB אין דרך לומר "מותר לשנות רק את השדות X ו-Y". התבנית היא ההפך — **דורשים ששאר השדות יישארו זהים**. זה הכלי היחיד, והוא עובד היטב.

### 3.2 · הקפאת היומן הכספי

הכלל של `purchases` אוכף שני דברים שהמפרט לא ביקש במפורש, אבל בלעדיהם אין שלמות כספית:

```jsonc
// המנהל יכול לשנות סטטוס — אבל לא סכום ולא זהות הקונה. לעולם.
"(<מנהל> && newData.child('amount').val()   === data.child('amount').val()
          && newData.child('boughtBy').val() === data.child('boughtBy').val())"

// הקונה עורך רק כל עוד הקנייה לא אושרה, וכל עריכה מחזירה אותה ל-pending.
"(data.child('boughtBy').val() === auth.uid
  && (data.child('status').val() === 'pending' || data.child('status').val() === 'rejected')
  && newData.child('status').val() === 'pending')"
```

התוצאה: **אין נתיב שבו סכום של קנייה מאושרת משתנה.** לא למנהל, לא לקונה, לא לאף אחד. תיקון של קנייה מאושרת נעשה כמו בהנהלת חשבונות — ביצירת רשומת תיקון חדשה, לא בשינוי הישנה.

השורה השנייה חשובה לא פחות: אם הקונה מתקן סכום אחרי דחייה, הקנייה **חוזרת אוטומטית ל-`pending`**. אחרת אפשר היה לתקן סכום ולהשאיר אותו במצב "מאושר" מקודם.

### 3.3 · איפה נאכפת ולידציית הנתונים (סעיף 11 במפרט)

| דרישה מהמפרט | היכן זה נאכף | סוג האכיפה |
|---------------|--------------|-------------|
| שם חדר שכבר קיים → שגיאה | `roomNames/$slug` + `runTransaction` | **שרת** (אטומי) |
| מוצר באותו שם → אזהרה | `nameLower` + השוואה בלקוח | לקוח (זו אזהרה, לא חסימה) |
| קוד חדר שלא קיים → שגיאה | קריאה מ-`roomCodes/$code` | **שרת** |
| סכום שלילי → שגיאה | `amount > 0 && amount % 1 === 0` | **שרת** |
| קטגוריה לא חוקית | `.matches(/^(kitchen\|bathroom\|cleaning\|other)$/)` | **שרת** |
| סטטוס לא חוקי | `.matches(...)` על כל שדה סטטוס | **שרת** |
| שדות לא מוכרים | `"$other": { ".validate": false }` | **שרת** |
| אורכי מחרוזות | `.length` בכל שדה טקסט | **שרת** |

> **`"$other": { ".validate": false }` — הכלל הכי משתלם בקובץ.** הוא חוסם כתיבת שדות שלא הגדרנו. בלעדיו, כל חבר בחדר יכול לכתוב `{ "junk": <10MB של טקסט> }` לתוך פריט ולנפח את החשבון. זה חוסם גם באגים שלכם: שדה שנכתב בטעות בשם שגוי ייכשל מיד במקום להצטבר בשקט.

---

## 4. בדיקת הכללים — לא אופציונלי

Rules הם קוד. קוד לא נבדק הוא קוד שבור. הבדיקות רצות מול האמולטור, מהר, בלי אינטרנט.

```bash
npm i -D @firebase/rules-unit-testing
```

```ts
// tests/rules/rooms.rules.test.ts
import {
  initializeTestEnvironment, assertFails, assertSucceeds,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { readFileSync } from 'node:fs';
import { ref, set, get, update, remove } from 'firebase/database';
import { beforeAll, afterAll, beforeEach, describe, it } from 'vitest';

let env: RulesTestEnvironment;

const ADMIN = 'admin_uid';
const MEMBER = 'member_uid';
const OUTSIDER = 'outsider_uid';
const CODE = 'ABC123';

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'roommate-test',
    database: {
      rules: readFileSync('database.rules.json', 'utf8'),
      host: '127.0.0.1',
      port: 9000,
    },
  });
});

afterAll(() => env.cleanup());

beforeEach(async () => {
  await env.clearDatabase();
  // זריעת נתונים תוך עקיפת הכללים
  await env.withSecurityRulesDisabled(async (ctx) => {
    await set(ref(ctx.database(), `rooms/${CODE}`), {
      metadata: { name: 'דירה 12', createdAt: 1, createdBy: ADMIN, adminId: ADMIN },
      members: {
        [ADMIN]:  { name: 'דנה', email: 'd@x.com', joinedAt: 1, status: 'active', role: 'admin' },
        [MEMBER]: { name: 'יוסי', email: 'y@x.com', joinedAt: 2, status: 'active', role: 'member' },
      },
      items: {
        item1: { name: 'חלב', nameLower: 'חלב', category: 'kitchen',
                 reportedBy: MEMBER, reportedAt: 5, priority: 'normal', status: 'needed' },
      },
    });
  });
});

const asAdmin    = () => env.authenticatedContext(ADMIN).database();
const asMember   = () => env.authenticatedContext(MEMBER).database();
const asOutsider = () => env.authenticatedContext(OUTSIDER).database();
const asGuest    = () => env.unauthenticatedContext().database();

describe('בידוד חדרים', () => {
  it('חבר פעיל קורא את החדר', () =>
    assertSucceeds(get(ref(asMember(), `rooms/${CODE}/items`))));

  it('משתמש שאינו חבר נחסם', () =>
    assertFails(get(ref(asOutsider(), `rooms/${CODE}/items`))));

  it('אורח לא מזוהה נחסם', () =>
    assertFails(get(ref(asGuest(), `rooms/${CODE}/metadata`))));
});

describe('הרשאות מוצרים', () => {
  it('מנהל מוחק מוצר', () =>
    assertSucceeds(remove(ref(asAdmin(), `rooms/${CODE}/items/item1`))));

  it('חבר רגיל לא מוחק מוצר — גם לא כזה שהוא דיווח', () =>
    assertFails(remove(ref(asMember(), `rooms/${CODE}/items/item1`))));

  it('כל חבר יכול לתפוס מוצר של אחר', () =>
    assertSucceeds(update(ref(asAdmin(), `rooms/${CODE}/items/item1`),
      { status: 'buying', assignedTo: ADMIN })));

  it('חבר לא יכול לשנות את שם המוצר של אחר', () =>
    assertFails(set(ref(asAdmin(), `rooms/${CODE}/items/item1/name`), 'משהו אחר')));
    // ← אפילו המנהל? לא: המנהל דווקא כן. שנו ל-asOutsider או לחבר שלישי כדי לבדוק נכון.
});

describe('שלמות היומן הכספי', () => {
  const purchase = {
    boughtBy: MEMBER, amount: 2000, date: 10, createdAt: 10,
    splitMethod: 'equal', status: 'pending',
    splitBetween: { [ADMIN]: true, [MEMBER]: true },
    shares: { [ADMIN]: 1000, [MEMBER]: 1000 },
  };

  it('סכום שלילי נדחה', () =>
    assertFails(set(ref(asMember(), `rooms/${CODE}/purchases/p1`),
      { ...purchase, amount: -500 })));

  it('סכום שברי נדחה', () =>
    assertFails(set(ref(asMember(), `rooms/${CODE}/purchases/p1`),
      { ...purchase, amount: 20.5 })));

  it('אי אפשר ליצור קנייה בשם מישהו אחר', () =>
    assertFails(set(ref(asMember(), `rooms/${CODE}/purchases/p1`),
      { ...purchase, boughtBy: ADMIN })));

  it('אי אפשר ליצור קנייה שכבר מאושרת', () =>
    assertFails(set(ref(asMember(), `rooms/${CODE}/purchases/p1`),
      { ...purchase, status: 'approved' })));

  it('סכום של קנייה מאושרת קפוא — גם למנהל', async () => {
    await env.withSecurityRulesDisabled((ctx) =>
      set(ref(ctx.database(), `rooms/${CODE}/purchases/p1`),
          { ...purchase, status: 'approved' }));
    await assertFails(set(ref(asAdmin(), `rooms/${CODE}/purchases/p1/amount`), 999999));
  });

  it('שדה לא מוכר נדחה', () =>
    assertFails(set(ref(asMember(), `rooms/${CODE}/purchases/p1`),
      { ...purchase, hackedField: 'x'.repeat(1000) })));
});

describe('ניהול חברים', () => {
  it('מנהל מסיר חבר', () =>
    assertSucceeds(remove(ref(asAdmin(), `rooms/${CODE}/members/${MEMBER}`))));

  it('חבר לא מסיר חבר אחר', () =>
    assertFails(remove(ref(asMember(), `rooms/${CODE}/members/${ADMIN}`))));

  it('חבר לא מקדם את עצמו למנהל', () =>
    assertFails(set(ref(asMember(), `rooms/${CODE}/members/${MEMBER}/role`), 'admin')));

  it('חבר לא מחליף את המנהל של החדר', () =>
    assertFails(set(ref(asMember(), `rooms/${CODE}/metadata/adminId`), MEMBER)));
});
```

**הרצה:**

```bash
firebase emulators:exec --only database "npx vitest run tests/rules"
```

הפקודה מפעילה אמולטור, מריצה את הבדיקות, סוגרת. מושלם ל-CI.

### 4.1 · 12 הבדיקות שחייבות להיות ירוקות לפני עלייה לאוויר

- [ ] משתמש לא מחובר לא קורא כלום
- [ ] משתמש שאינו חבר לא קורא חדר
- [ ] משתמש שהוסר (`status: 'removed'`) לא קורא חדר
- [ ] חבר רגיל לא מוחק מוצרים
- [ ] חבר רגיל לא משנה שמות של מוצרים שדיווח חבר אחר
- [ ] חבר רגיל **כן** יכול לתפוס מוצר של אחר
- [ ] חבר רגיל לא מקדם את עצמו למנהל
- [ ] חבר רגיל לא משנה את `metadata/adminId`
- [ ] סכום קנייה שלילי או שברי נדחה
- [ ] סכום של קנייה מאושרת לא ניתן לשינוי, גם לא ע"י המנהל
- [ ] שדה שאינו בסכימה נדחה (`$other`)
- [ ] מבקש הצטרפות יכול לכתוב את בקשתו אך לא לקרוא את החדר

---

## 5. שלוש מגבלות ידועות — ומה עושים איתן

תכנון כן חייב לומר גם מה **לא** מוגן. אלה שלוש נקודות שכללי RTDB לא יכולים לכסות, עם הפתרון לכל אחת.

### 5.1 · אי אפשר לוודא שסכום ה-`shares` שווה ל-`amount`

כללי RTDB לא יכולים לסכום מפה בגודל לא ידוע. משתמש עוין יכול לשלוח קנייה של ₪100 עם `shares` שמסתכמים ל-₪20.

| רובד הגנה | מה הוא נותן |
|-----------|--------------|
| חישוב בלקוח (`lib/money.ts`) | מונע את המקרה בתום לב — 99.9% מהמקרים |
| אישור המנהל | אדם אמיתי רואה את הסכום לפני שהוא נכנס למאזן |
| בדיקת שפיות בדשבורד | אם `sum(shares) !== amount` — הקנייה מוצגת עם דגל אדום |
| בדיקת "סכום מאזנים = 0" | תופסת כל סטייה מיידית |
| **Cloud Function** | הפתרון המלא — ראו למטה |

### 5.2 · אי אפשר למנוע **מחיקה** של `shares/$uid` בקנייה מאושרת

`.validate` לא רץ על מחיקה, ו-`.write` ברמת הקנייה בודק ש-`amount` לא השתנה — מה שנכון גם כשמחקו רק חלק. חבר יכול תיאורטית למחוק את החלק שלו מקנייה מאושרת.

**מה מגן בינתיים:** הפעולה גלויה לכולם ב-`notifications`, ובדיקת סכום המאזנים תיכשל מיד. **הפתרון המלא:** Cloud Function.

### 5.3 · כללי Storage לא יכולים לקרוא מ-RTDB

לכן אי אפשר לוודא ש"המשתמש חבר בחדר" בעת קריאת חשבונית. ראו הסבר ומיטיגציה בראש [`storage.rules`](../storage.rules).

### 5.4 · הפתרון המלא לשלושתן: Cloud Function אחת

אם עוברים לתוכנית Blaze בכל מקרה (בגלל Storage), פונקציה אחת סוגרת את שלוש הפרצות:

```js
// functions/index.js — הקשחה לשלב מאוחר, לא נדרש ל-MVP
exports.validatePurchase = functions.database
  .ref('/rooms/{code}/purchases/{pid}')
  .onWrite(async (change, context) => {
    const p = change.after.val();
    if (!p) return null;

    const sum = Object.values(p.shares || {}).reduce((a, b) => a + b, 0);
    if (sum !== p.amount) {
      // חלוקה לא תקינה — מסמנים ולא מוחקים, כדי לשמור עקבות
      return change.after.ref.update({
        status: 'rejected',
        note: `חלוקה לא תקינה: סכום החלקים ${sum} אינו שווה לסכום ${p.amount}`,
      });
    }
    return null;
  });
```

**החלטת PM:** לא נדרש ל-MVP. ארבעת רובדי ההגנה הראשונים מספיקים לחדר מעונות עם 4 אנשים שמכירים זה את זה. תעדפו את זה אם וכאשר האפליקציה יוצאת מעבר לחוג המכרים.

---

## 6. פריסה ותחזוקה

```bash
# פריסת כללים בלבד (לא נוגע בקוד האפליקציה)
firebase deploy --only database,storage

# בדיקה לפני פריסה — תמיד
firebase emulators:exec --only database "npx vitest run tests/rules"
```

### שלושה כללי תחזוקה

1. **כללים משתנים לפני הקוד, לא אחריו.** מוסיפים שדה חדש? קודם מוסיפים לו `.validate`, ואז כותבים את הקוד. אחרת `$other: false` יחסום אתכם ותבזבזו חצי שעה על דיבוג.
2. **`firebase deploy --only database` הוא **החלפה**, לא מיזוג.** הקובץ המקומי דורס לחלוטין את מה שבענן. אל תערכו כללים ב-Console — השינוי יימחק בפריסה הבאה.
3. **אחרי כל פריסה, בדקו בלשונית Rules ב-Console** שהתוכן אכן התעדכן.
