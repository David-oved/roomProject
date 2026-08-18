# 11 · הפעלה — מה נשאר לעשות

**מצב נכון ל-18.8.2026, 01:05** · האפליקציה חיה ב-https://david-oved.github.io/roomProject/ אך עדיין לא פעילה.

---

## מה כבר נעשה ✅

| פריט | מצב |
|------|-----|
| הקוד באוויר ב-GitHub Pages | ✅ |
| פריסה אוטומטית בכל push ל-main | ✅ |
| 6 מתוך 7 מפתחות Firebase שמורים כ-GitHub Secrets | ✅ |
| `VITE_FB_DATABASE_URL` | ⛔ **מכוון: לא הוגדר** — ראו הסבר למטה |

---

## מה נבדק בפרויקט Firebase שסיפקת

פרויקט: `gen-lang-client-0675991189`

| בדיקה | תוצאה |
|-------|-------|
| ה-API key תקין ומגיב | ✅ HTTP 200 מ-Identity Toolkit |
| Realtime Database קיים | ❌ **404 בכל שלושת האזורים** — לא נוצר מעולם |
| ספק Email/Password מופעל | ❌ **`PASSWORD_LOGIN_DISABLED`** |
| `david-oved.github.io` ברשימת הדומיינים המורשים | ❌ לא מופיע |

**זו הסיבה שבקונפיג שהעברת חסר `databaseURL`** — Firebase לא מייצר את השדה הזה עד שיוצרים את בסיס הנתונים.

> **הערה:** `gen-lang-client-*` הוא פרויקט שנוצר אוטומטית ע"י Google AI Studio. הוא יעבוד מצוין, אבל אם תעדיף פרויקט ייעודי ונקי — צור חדש בשם `roommate` ופשוט החלף את 7 המפתחות.

---

## 3 הצעדים שרק אתה יכול לבצע

זמן משוער: **6 דקות**.

### ① יצירת Realtime Database  ← החסם העיקרי

1. [console.firebase.google.com](https://console.firebase.google.com) ← בחר `gen-lang-client-0675991189`
2. תפריט צד ← **Build → Realtime Database** ← **Create Database**

   > ⚠️ **Realtime Database**, לא Firestore. אלה שני מוצרים שונים לגמרי, והאפליקציה בנויה על הראשון.

3. **מיקום:** בחר `europe-west1 (Belgium)` — הכי קרוב לישראל, כ-40ms במקום כ-150ms מארה"ב
4. **Security rules:** בחר **Start in locked mode** ← 🚫 לעולם לא "Test mode"
5. **העתק את ה-URL** שמופיע בראש המסך. הוא ייראה כך:

   ```
   https://gen-lang-client-0675991189-default-rtdb.europe-west1.firebasedatabase.app
   ```

### ② הפעלת Email/Password

**Build → Authentication → Get started → Sign-in method → Email/Password → Enable → Save**

סמן רק את השורה הראשונה. את "Email link (passwordless)" השאר כבוי.

### ③ הוספת הדומיין של GitHub Pages

**Authentication → Settings → Authorized domains → Add domain:**

```
david-oved.github.io
```

בלי זה קישורי איפוס הסיסמה יישלחו לדומיין הלא נכון.

---

## ואז — הפעלת האפליקציה

הוסף את המפתח האחרון:

**[Settings → Secrets → Actions → New repository secret](https://github.com/David-oved/roomProject/settings/secrets/actions)**

| Name | Secret |
|------|--------|
| `VITE_FB_DATABASE_URL` | ה-URL שהעתקת בצעד ① |

ואז: **[Actions](https://github.com/David-oved/roomProject/actions) ← הריצה האחרונה ← Re-run all jobs**

תוך כ-2 דקות האפליקציה תעלה עם מסך ההתחברות ותהיה פעילה במלואה.

---

## למה `VITE_FB_DATABASE_URL` הושאר בחוץ בכוונה

`isFirebaseConfigured` דורש את כל חמשת המפתחות הקריטיים. כל עוד ה-URL חסר, האפליקציה מציגה מסך "לא זמין כרגע" ידידותי.

לו הייתי מגדיר URL לבסיס נתונים שלא קיים, המשתמשים היו מקבלים מסך התחברות **שנראה תקין אבל לא עובד**: הבאנר "אין חיבור לאינטרנט" היה מופיע קבוע, וכל הכפתורים היו מושבתים — כי כך מודל האופליין שלנו מגיב לניתוק מהשרת.

מסך "לא זמין" כן, ממשק שבור לא. המפתח החסר הוא מתג ההפעלה.

---

## ולבסוף — העלאת כללי האבטחה

**חובה.** בלעדיהם בסיס הנתונים נשאר ב-locked mode וכל גישה נחסמת:

```bash
cd "C:\Users\wbddw\OneDrive\שולחן העבודה\roomProject"
firebase login
firebase use gen-lang-client-0675991189
firebase deploy --only database
```

אימות: Console ← Realtime Database ← לשונית **Rules** ← צריך להופיע ה-JSON מ-`database.rules.json`.

---

## בדיקת קבלה — 6 סימונים

לאחר כל הצעדים, פתח את https://david-oved.github.io/roomProject/ ובדוק:

- [ ] מופיע מסך התחברות (ולא "לא זמין כרגע")
- [ ] **אין** באנר שחור "אין חיבור לאינטרנט"
- [ ] הרשמה עם אימייל אמיתי עובדת ומעבירה למסך בחירת חדר
- [ ] יצירת חדר מחזירה קוד בן 6 תווים
- [ ] בדפדפן שני (מצב פרטי) — הרשמה + הצטרפות עם הקוד → הבקשה מופיעה אצל המנהל
- [ ] אישור הבקשה → המשתמש השני נכנס לחדר תוך שנייה
