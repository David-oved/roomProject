/**
 * ═══════════════════════════════════════════════════════════════
 *  זריעת נתוני פיתוח לאמולטורים
 * ═══════════════════════════════════════════════════════════════
 *  מריצים אחרי `npm run emu`:
 *
 *      npm run emu:seed
 *
 *  מה נוצר: משתמשי Authentication אמיתיים (אפשר להתחבר איתם דרך
 *  מסך ההתחברות), חדרים עם קניות, מטלות ומשוב, וכן כל מה שנדרש כדי
 *  לבדוק את הערוץ מול מנהל המערכת — הודעות בתיבה, חדר בארכיון
 *  ומשתמש חסום.
 *
 *  ‼️ מסרב לרוץ בלי משתני האמולטור. סקריפט זריעה שמצליח להתחבר
 *     בטעות לייצור הוא בדיוק סוג התאונה שאי אפשר לתקן אחר כך.
 * ═══════════════════════════════════════════════════════════════
 */
import { createRequire } from 'node:module';
import { buildSeed } from '../admin/server/seed.mjs';

const require = createRequire(import.meta.url);

const AUTH_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST ?? '127.0.0.1:9099';
const DB_HOST = process.env.FIREBASE_DATABASE_EMULATOR_HOST ?? '127.0.0.1:9000';
const PROJECT_ID = process.env.GCLOUD_PROJECT ?? 'gen-lang-client-0675991189';
const PASSWORD = 'roommate123';

process.env.FIREBASE_AUTH_EMULATOR_HOST = AUTH_HOST;
process.env.FIREBASE_DATABASE_EMULATOR_HOST = DB_HOST;
process.env.GCLOUD_PROJECT = PROJECT_ID;

async function assertEmulator() {
  const res = await fetch(`http://${DB_HOST}/.json?ns=${PROJECT_ID}-default-rtdb`).catch(() => null);
  if (!res) {
    console.error(`❌ אין אמולטור מאזין ב-${DB_HOST}. הריצו קודם: npm run emu`);
    process.exit(1);
  }
}

await assertEmulator();

// ה-API המודולרי של firebase-admin 14 — ראו ההערה ב-admin/server/db.mjs
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

const seed = buildSeed(now);

/* ── משתמשי Authentication ── */
console.info('👤 יוצר משתמשים…');
for (const [uid, user] of Object.entries(seed.users)) {
  try {
    await auth.createUser({
      uid,
      email: user.email,
      password: PASSWORD,
      displayName: user.displayName,
    });
  } catch (err) {
    if (err.code !== 'auth/uid-already-exists' && err.code !== 'auth/email-already-exists') throw err;
  }
}

/* ── הערוץ מול מנהל המערכת ── */
// דוד הוא המשתמש שאיתו נכנסים לבדיקות: חבר בשני חדרים, יש לו הודעות
// בתיבה, ופנייה פתוחה שכבר נענתה.
const david = 'u_david';

seed.adminMessages = {
  [david]: {
    msg_maintenance: {
      title: 'תחזוקה מתוכננת הלילה',
      body: 'בין 02:00 ל-04:00 המערכת תהיה בתחזוקה קצרה. הנתונים שלכם לא יושפעו — רק ייתכן שהאפליקציה לא תיפתח בזמן הזה.',
      kind: 'maintenance',
      cta: { text: 'מה זה אומר?', url: 'https://status.example.com' },
      sentAt: now - 3 * HOUR,
      readAt: null,
    },
    msg_release: {
      title: 'גרסה 1.21 עלתה',
      body: 'הוספנו הדרכת התקנה חכמה למסך הבית ורמזי הקשר בכל האפליקציה. שווה להציץ בהגדרות ← אודות.',
      kind: 'info',
      cta: null,
      sentAt: now - 4 * DAY,
      readAt: now - 4 * DAY + 26 * 60_000,
    },
    msg_feedback_reply: {
      title: 'תשובה למשוב: לוח המחוונים לא נטען בנייד',
      body: 'תודה שדיווחת! שחזרנו את התקלה — היא נגרמת מגלישה אופקית באזור המאזנים ב-Safari. התיקון ייצא בגרסה 1.21.1 בימים הקרובים. נעדכן אותך כאן.',
      kind: 'info',
      cta: null,
      sentAt: now - 2 * HOUR,
      readAt: null,
      relatedFeedback: 'fb_1',
    },
  },
  u_roi: {
    msg_room_alert: {
      title: 'החדר שלכם צריך תשומת לב',
      body: 'בחדר "מעונות 201" יש 12 מוצרים פתוחים, הוותיק שבהם כבר 45 ימים, ופער מאזנים של יותר מ-₪2,400. שווה לעבור עליהם ולסגור.',
      kind: 'warning',
      cta: null,
      sentAt: now - 26 * HOUR,
      readAt: null,
    },
  },
};

// משתמש חסום — כדי שאפשר יהיה לראות את מסך החסימה בפועל
seed.suspensions = {
  u_adi: {
    at: now - 2 * DAY,
    reason: 'דיווחי מוצרים חוזרים שלא היו — אחרי שתי אזהרות',
  },
};

// חדר בארכיון + שידור ממנהל המערכת בתוכו
seed.rooms.EF5TP3.metadata.archivedAt = now - 12 * HOUR;
seed.rooms.EF5TP3.announcements = {
  ...seed.rooms.EF5TP3.announcements,
  an_system: {
    senderId: 'u_roi',
    text: 'החדר הועבר לארכיון על ידי מנהל המערכת בגלל חוסר פעילות ממושך. הנתונים נשמרו במלואם — אם תרצו להפעיל אותו מחדש, כתבו לנו דרך "פנייה למנהל המערכת".',
    sentAt: now - 12 * HOUR,
    fromSystemAdmin: true,
  },
};

// שידור מערכת גם בחדר הפעיל של דוד, כדי שהתג ייראה במסך רגיל
seed.rooms.AB2K7Q.announcements = {
  ...seed.rooms.AB2K7Q.announcements,
  an_system_ab: {
    senderId: 'u_david',
    text: 'שלום לכולם — עדכון קצר מצוות RoomMate: הוספנו מסך "הודעות ממנהל המערכת" בהגדרות. שם יופיעו עדכוני מערכת ותשובות לפניות ששלחתם.',
    sentAt: now - 5 * HOUR,
    fromSystemAdmin: true,
  },
};

console.info('🌱 כותב נתונים…');
await db.ref('/').set(seed);

console.info('\n✅ הזריעה הושלמה');
console.info(`   ${Object.keys(seed.users).length} משתמשים · ${Object.keys(seed.rooms).length} חדרים`);
console.info(`   כניסה לדוגמה:  david@example.com / ${PASSWORD}`);
console.info(`   משתמש חסום:    adi@example.com / ${PASSWORD}`);
console.info(`   חדר בארכיון:   EF5TP3 (מעונות 201)\n`);

await deleteApp(app);
