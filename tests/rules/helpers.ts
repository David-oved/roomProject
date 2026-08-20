import { readFileSync } from 'node:fs';
import {
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { ref, set } from 'firebase/database';

/**
 * ═══════════════════════════════════════════════════════════════════
 *  תשתית לבדיקות כללי האבטחה
 * ═══════════════════════════════════════════════════════════════════
 *
 *  הרצה:  npm run test:rules
 *  (= firebase emulators:exec --only database "vitest run tests/rules")
 *
 *  ‼️ הבדיקות האלה מדברות עם אמולטור ה-Realtime Database, ולכן הן
 *  נחוצות דווקא כאן: את הקובץ database.rules.json אי אפשר "להריץ"
 *  בשום דרך אחרת. כל שאר הבדיקות בפרויקט בודקות פונקציות טהורות.
 *
 *  ‼️ למה יש דילוג אוטומטי (ראו skipIf בקובץ הבדיקות): vitest.config.ts
 *  מגדיר include: ['tests/**\/*.test.ts'] — כלומר `npm test` הרגיל אוסף
 *  גם את התיקייה הזו. בלי הדילוג, כל הרצת `npm test` בלי אמולטור פעיל
 *  הייתה נכשלת. המשתנה FIREBASE_DATABASE_EMULATOR_HOST מוזרק אוטומטית
 *  ע"י `firebase emulators:exec`, ולכן הוא סימן ההיכר המדויק ל"יש
 *  אמולטור".
 */

/** "127.0.0.1:9000" כשרץ תחת emulators:exec, אחרת undefined. */
export const EMULATOR_HOST = process.env.FIREBASE_DATABASE_EMULATOR_HOST;

/** האם יש אמולטור לדבר איתו. משמש ל-describe.skipIf. */
export const hasEmulator = Boolean(EMULATOR_HOST);

/**
 * ‼️ מזהה הפרויקט חייב להתאים ל-.firebaserc: firebase.json מגדיר
 * singleProjectMode: true, והאמולטור מתלונן על חיבור עם מזהה אחר.
 * emulators:exec מזריק את GCLOUD_PROJECT בעצמו.
 */
export const PROJECT_ID = process.env.GCLOUD_PROJECT ?? 'gen-lang-client-0675991189';

/* ─────────────────── מזהים קבועים לכל הבדיקות ─────────────────── */

export const ADMIN = 'uid-admin';
export const MEMBER = 'uid-member';
export const MEMBER2 = 'uid-member-2';
/** מנהל של חדר משלו — הדמות המרכזית בניצול ה-outbox */
export const OUTSIDER = 'uid-outsider';
/** משתמש שאין לו שום קשר ל-ROOM02 — הקורבן של ההתראה המזויפת */
export const VICTIM = 'uid-victim';
/** הגיש בקשת הצטרפות ל-ROOM01 והיא עדיין pending */
export const JOINER = 'uid-joiner';
/** הגיש בקשה ל-ROOM01 ונדחה — עדיין לא חבר, אבל צריך לקבל הודעה */
export const REJECTED = 'uid-rejected';
/** לא חבר ואין לו בקשה — יוצר בקשה חדשה בבדיקות האווטאר */
export const STRANGER = 'uid-stranger';

/** ROOM01 = החדר המשותף · ROOM02 = החדר הפרטי של OUTSIDER */
export const ROOM = 'ROOM01';
export const OTHER_ROOM = 'ROOM02';

/** זמן קבוע — הכללים דורשים isNumber(), לא ערך אמיתי. */
export const T = 1_700_000_000_000;

const CLOUDINARY_AVATAR = 'https://res.cloudinary.com/demo/image/upload/v1/a.jpg';
/** משואת מעקב: בדיוק מה שהכלל החדש חוסם. */
export const TRACKER_AVATAR = 'http://tracker.example/x.gif';
export { CLOUDINARY_AVATAR as HTTPS_AVATAR };

const member = (name: string, role: 'admin' | 'member') => ({
  name,
  email: `${name}@example.com`,
  joinedAt: T,
  status: 'active',
  role,
});

/**
 * טוען את קובץ הכללים האמיתי לאמולטור.
 *
 * ‼️ נקרא מהנתיב היחסי לקובץ הזה ולא מ-cwd — כך הבדיקות עובדות גם אם
 * מריצים אותן מתת-תיקייה.
 */
export async function makeTestEnv(): Promise<RulesTestEnvironment> {
  const rules = readFileSync(new URL('../../database.rules.json', import.meta.url), 'utf8');
  const [host, port] = (EMULATOR_HOST ?? '127.0.0.1:9000').split(':');

  return initializeTestEnvironment({
    projectId: PROJECT_ID,
    database: { rules, host, port: Number(port) },
  });
}

/**
 * מצב פתיחה זהה לכל בדיקה.
 *
 * ‼️ נכתב דרך withSecurityRulesDisabled בכוונה: נקודת הפתיחה היא נתון,
 * לא הדבר הנבדק. אילו זרענו דרך הכללים, כישלון בכלל אחד היה מפיל
 * בדיקות של כלל אחר לגמרי ומקשה לאתר מה באמת נשבר.
 */
export async function seed(testEnv: RulesTestEnvironment): Promise<void> {
  await testEnv.clearDatabase();
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.database();
    await set(ref(db), {
      users: {
        [ADMIN]: { email: 'admin@example.com', displayName: 'אדמין', createdAt: T },
        [MEMBER]: { email: 'member@example.com', displayName: 'חבר', createdAt: T },
        [MEMBER2]: { email: 'member2@example.com', displayName: 'חברה', createdAt: T },
        [OUTSIDER]: { email: 'out@example.com', displayName: 'זר', createdAt: T },
      },
      roomCodes: {
        [ROOM]: { name: 'דירת הסטודנטים', adminId: ADMIN, createdAt: T },
        [OTHER_ROOM]: { name: 'החדר של הזר', adminId: OUTSIDER, createdAt: T },
      },
      rooms: {
        [ROOM]: {
          metadata: {
            name: 'דירת הסטודנטים',
            createdAt: T,
            createdBy: ADMIN,
            adminId: ADMIN,
            currency: 'ILS',
          },
          members: {
            [ADMIN]: member('אדמין', 'admin'),
            [MEMBER]: member('חבר', 'member'),
            [MEMBER2]: member('חברה', 'member'),
          },
          pendingRequests: {
            [JOINER]: { userId: JOINER, displayName: 'מבקש', requestedAt: T, status: 'pending' },
            [REJECTED]: {
              userId: REJECTED,
              displayName: 'נדחה',
              requestedAt: T,
              respondedAt: T,
              status: 'rejected',
            },
          },
        },
        [OTHER_ROOM]: {
          metadata: {
            name: 'החדר של הזר',
            createdAt: T,
            createdBy: OUTSIDER,
            adminId: OUTSIDER,
            currency: 'ILS',
          },
          members: { [OUTSIDER]: member('זר', 'admin') },
        },
      },
    });
  });
}

/** רשומת outbox תקינה — הבדיקות משנות ממנה שדה אחד בכל פעם. */
export const outboxEntry = (over: Record<string, unknown> = {}) => ({
  roomCode: ROOM,
  title: 'כותרת',
  body: 'גוף ההודעה',
  audience: 'user',
  priority: 'now',
  createdAt: T,
  ...over,
});

/** קנייה תקינה — נזרעת ישירות, המחיקה היא מה שנבדק. */
export const purchase = (over: Record<string, unknown> = {}) => ({
  title: 'חלב וביצים',
  boughtBy: MEMBER,
  amount: 10_000,
  date: T,
  createdAt: T,
  splitMethod: 'equal',
  splitBetween: { [MEMBER]: true, [MEMBER2]: true },
  shares: { [MEMBER]: 5_000, [MEMBER2]: 5_000 },
  status: 'approved',
  approvedBy: MEMBER,
  ...over,
});

/** סגירת חשבון: MEMBER חייב ל-MEMBER2 ומצהיר שהעביר. */
export const settlement = (over: Record<string, unknown> = {}) => ({
  from: MEMBER,
  to: MEMBER2,
  amount: 5_000,
  date: T,
  ...over,
});
