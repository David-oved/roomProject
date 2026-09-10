/**
 * ═══════════════════════════════════════════════════════════════
 *  חדר בדיקות למטלות — QA ידני לשני התיקונים
 * ═══════════════════════════════════════════════════════════════
 *  מריצים מול האמולטורים:
 *
 *      npm run emu          (חלון אחד)
 *      npm run demo:tasks   (חלון שני)
 *
 *  מוסיף חדר יחיד, "חדר בדיקות — מטלות" (קוד DEMO01), שנבנה כדי
 *  שאפשר יהיה לראות בעיניים את שני התיקונים בלי להכין נתונים ביד:
 *
 *    • מונה ההוגנות — כל הביצועים בתוך חלון 30 הימים, כך שהמספרים
 *      מוצגים בפועל. יש מטלה שכל תפקידה להימחק, והמספרים שאמורים
 *      לרדת בעקבותיה מודפסים מראש למסך.
 *    • עריכת מטלה — יש מטלה עם שגיאת כתיב בשם ותדירות לא הגיונית,
 *      שאמורות להיות ניתנות לתיקון בלי לאפס את הסבב.
 *
 *  ‼️ update ולא set: הסקריפט מוסיף לחדרים הקיימים ולא דורס אותם,
 *     כך שאפשר להריץ אותו גם אחרי npm run emu:seed וגם לבד.
 *
 *  ‼️ מסרב לרוץ בלי משתני האמולטור — בדיוק כמו seed-emulator.mjs.
 *     סקריפט זריעה שמתחבר בטעות לייצור הוא תאונה בלתי הפיכה.
 * ═══════════════════════════════════════════════════════════════
 */
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

const AUTH_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST ?? '127.0.0.1:9099';
const DB_HOST = process.env.FIREBASE_DATABASE_EMULATOR_HOST ?? '127.0.0.1:9000';
const PROJECT_ID = process.env.GCLOUD_PROJECT ?? 'gen-lang-client-0675991189';
const PASSWORD = 'roommate123';
const CODE = 'DEMO01';

process.env.FIREBASE_AUTH_EMULATOR_HOST = AUTH_HOST;
process.env.FIREBASE_DATABASE_EMULATOR_HOST = DB_HOST;
process.env.GCLOUD_PROJECT = PROJECT_ID;

const res = await fetch(`http://${DB_HOST}/.json?ns=${PROJECT_ID}-default-rtdb`).catch(() => null);
if (!res) {
  console.error(`❌ אין אמולטור מאזין ב-${DB_HOST}. הריצו קודם: npm run emu`);
  process.exit(1);
}

const { initializeApp, getApp, getApps, deleteApp } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getDatabase } = require('firebase-admin/database');

const app = getApps().length
  ? getApp()
  : initializeApp({
      projectId: PROJECT_ID,
      databaseURL: `http://${DB_HOST}/?ns=${PROJECT_ID}-default-rtdb`,
    });

const auth = getAuth(app);
const db = getDatabase(app);

const now = Date.now();
const DAY = 86_400_000;
const HOUR = 3_600_000;

/* ── חברי החדר ── */
// דוד הוא המנהל, ולכן המשתמש שאיתו נכנסים: כפתורי "עריכה" ו"מחק"
// מוצגים למנהל בלבד.
const PEOPLE = [
  ['u_demo_david', 'דוד לוי', 'demo.david@example.com'],
  ['u_demo_noa', 'נועה פרץ', 'demo.noa@example.com'],
  ['u_demo_shalom', 'שלום כהן', 'demo.shalom@example.com'],
];
const [ADMIN, NOA, SHALOM] = PEOPLE.map(([uid]) => uid);
const ALL = [ADMIN, NOA, SHALOM];

const createdAt = now - 60 * DAY;

/* ── המטלות ── */
// ‼️ dueAt מדורג בכוונה: אחת באיחור (תג "באיחור" אדום), אחת עתידית.
// שתי המצבים על אותו מסך חוסכים סבב בדיקה נוסף.
const tasks = {
  t_demo_kitchen: {
    name: 'ניקיון מטבח',
    category: 'cleaning',
    intervalDays: 7,
    participants: [ADMIN, NOA, SHALOM],
    // התור על המנהל — כדי שכפתורי "בוצע" ו"בקשת העברה" יהיו לחיצים
    currentAssignee: ADMIN,
    dueAt: now - 2 * DAY,
    createdBy: ADMIN,
    createdAt,
  },
  t_demo_typo: {
    // ← מטלת העריכה: שם עם שגיאת כתיב ותדירות אבסורדית (כל 200 יום)
    name: 'שטיפת כליפ',
    category: 'other',
    intervalDays: 200,
    participants: [NOA, SHALOM],
    currentAssignee: NOA,
    dueAt: now + 5 * DAY,
    createdBy: ADMIN,
    createdAt,
  },
  t_demo_delete_me: {
    // ← מטלת המחיקה: קיימת רק כדי להימחק ולראות את המונה יורד
    name: 'מטלה למחיקה — בדיקת מונה',
    category: 'bathroom',
    intervalDays: 3,
    participants: ALL,
    currentAssignee: SHALOM,
    dueAt: now + 1 * DAY,
    createdBy: ADMIN,
    createdAt,
  },
};

/* ── יומן הביצועים ── */
// ‼️ כולם בתוך חלון 30 הימים, אחרת מונה ההוגנות לא מציג כלום ובדיקת
// הבאג בכלל לא אפשרית. זו הסיבה שהחדר הזה קיים בנפרד מהזריעה
// הרגילה, שמפזרת ביצועים על פני חודשים אחורה.
const plan = [
  ['t_demo_kitchen', ADMIN, 3],
  ['t_demo_kitchen', ADMIN, 10],
  ['t_demo_kitchen', NOA, 17],
  ['t_demo_kitchen', SHALOM, 24],
  ['t_demo_typo', NOA, 6],
  ['t_demo_typo', SHALOM, 13],
  // ארבעת אלה ייעלמו מהספירה ברגע שהמטלה תימחק
  ['t_demo_delete_me', ADMIN, 2],
  ['t_demo_delete_me', ADMIN, 8],
  ['t_demo_delete_me', NOA, 15],
  ['t_demo_delete_me', SHALOM, 21],
];

const taskCompletions = {};
plan.forEach(([taskId, uid, daysAgo], i) => {
  taskCompletions[`tc_demo_${i + 1}`] = {
    taskId,
    taskName: tasks[taskId].name,
    completedBy: uid,
    completedAt: now - daysAgo * DAY,
  };
});

/* ── חישוב הציפייה, כדי שהבודק ידע מה אמור לקרות ── */
const nameOf = Object.fromEntries(PEOPLE.map(([uid, name]) => [uid, name]));
function tally(excludeTaskId) {
  const counts = {};
  for (const [taskId, uid] of plan) {
    if (taskId === excludeTaskId) continue;
    counts[uid] = (counts[uid] ?? 0) + 1;
  }
  return ALL.map((uid) => `${nameOf[uid]}: ${counts[uid] ?? 0}`).join(' · ');
}

/* ── כתיבה ── */
const members = {};
PEOPLE.forEach(([uid, name, email], i) => {
  members[uid] = {
    name,
    email,
    avatar: null,
    joinedAt: createdAt + i * DAY,
    status: 'active',
    role: uid === ADMIN ? 'admin' : 'member',
  };
});

console.info('👤 יוצר משתמשים…');
for (const [uid, displayName, email] of PEOPLE) {
  try {
    await auth.createUser({ uid, email, password: PASSWORD, displayName });
  } catch (err) {
    if (err.code !== 'auth/uid-already-exists' && err.code !== 'auth/email-already-exists') throw err;
  }
}

console.info('🌱 כותב את חדר הבדיקות…');
const updates = {
  [`rooms/${CODE}`]: {
    metadata: {
      name: 'חדר בדיקות — מטלות',
      description: 'נתוני QA לתיקוני המטלות',
      photo: null,
      categories: { kitchen: true, cleaning: true, bathroom: true },
      currency: 'ILS',
      createdAt,
      createdBy: ADMIN,
      adminId: ADMIN,
    },
    members,
    tasks,
    taskCompletions,
  },
  [`roomCodes/${CODE}`]: { name: 'חדר בדיקות — מטלות', adminId: ADMIN, createdAt },
};

PEOPLE.forEach(([uid, displayName, email]) => {
  updates[`users/${uid}`] = {
    email,
    displayName,
    avatar: null,
    createdAt,
    lastActiveAt: now - HOUR,
    rooms: { [CODE]: true },
  };
});

await db.ref('/').update(updates);

console.info(`
✅ חדר הבדיקות מוכן — קוד ${CODE}

   כניסה (מנהל):  demo.david@example.com / ${PASSWORD}
   שאר החברים:    demo.noa@ · demo.shalom@  (אותה סיסמה)

┌─ בדיקה 1 · מונה ההוגנות אחרי מחיקה ──────────────────────┐
   "הוגנות — 30 הימים האחרונים" אמור להראות עכשיו:
     ${tally(null)}

   מחקו את "מטלה למחיקה — בדיקת מונה", והמספרים אמורים לרדת ל:
     ${tally('t_demo_delete_me')}

   לפני התיקון הם היו נשארים בדיוק כמו שהם.
└───────────────────────────────────────────────────────────┘

┌─ בדיקה 2 · עריכת מטלה ────────────────────────────────────┐
   למטלה "שטיפת כליפ" יש שגיאת כתיב ותדירות של 200 יום.
   לחצו "עריכה", תקנו ל"שטיפת כלים" ולכל שבוע, ושמרו.

   לבדוק אחרי השמירה:
     • השם והתדירות התעדכנו ברשימה
     • התור נשאר על נועה — הסבב לא אופס
     • הסרת נועה מהמשתתפים מעבירה את התור לשלום אוטומטית

   לפני התיקון כפתור "עריכה" לא היה קיים בכלל.
└───────────────────────────────────────────────────────────┘
`);

await deleteApp(app);
