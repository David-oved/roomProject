#!/usr/bin/env node
/**
 * ═══════════════════════════════════════════════════════════════════
 *  שולח ההתראות
 * ═══════════════════════════════════════════════════════════════════
 *
 *  רץ כמשימה מתוזמנת ב-GitHub Actions. הוא "השרת" של האפליקציה —
 *  ובלעדיו אין התראות פוש בכלל, כי המפתח הפרטי של VAPID לא יכול
 *  לשבת בקוד צד-לקוח.
 *
 *  למה לא Cloud Functions: הן דורשות תוכנית Blaze וכרטיס אשראי.
 *  שליחת Web Push עצמה חינמית לגמרי, וכל מה שצריך זה מקום שיריץ
 *  את הקוד הזה כל כמה דקות. GitHub Actions עושה בדיוק את זה, בחינם.
 *
 *  המחיר: השהיה של 5–20 דקות. להתראה "נגמר החלב" זה לא משנה כלום,
 *  ולכן ההתראות המיידיות מוגבלות לאירועים שהמשתמש באמת ממתין להם.
 *
 *  משתני סביבה נדרשים:
 *    FIREBASE_SERVICE_ACCOUNT  — JSON של service account
 *    FIREBASE_DATABASE_URL     — כתובת ה-RTDB
 *    VAPID_PUBLIC_KEY
 *    VAPID_PRIVATE_KEY
 *    VAPID_SUBJECT             — mailto: של האחראי
 * ═══════════════════════════════════════════════════════════════════
 */
import { initializeApp, cert } from 'firebase-admin/app';
import { getDatabase } from 'firebase-admin/database';
import webpush from 'web-push';

/** השעה שבה נשלח התקציר היומי, בשעון ישראל */
const DIGEST_HOUR = 18;

/** התראות ישנות מזה נמחקות מהתור, שלא ייערם לנצח */
const RETENTION_DAYS = 7;

/**
 * אחרי כך וכך כישלונות רצופים הרשומה מסומנת כנשלחה ונזנחת.
 *
 * בלי זה, רשומה פגומה אחת — חדר שנמחק, נמען שלא קיים — נבדקת מחדש
 * בכל ריצה לנצח, וצוברת שגיאות בלוג עד שאי אפשר לראות בו כלום.
 */
const MAX_ATTEMPTS = 5;

/* ───────────────────── אתחול ───────────────────── */

const required = [
  'FIREBASE_SERVICE_ACCOUNT',
  'FIREBASE_DATABASE_URL',
  'VAPID_PUBLIC_KEY',
  'VAPID_PRIVATE_KEY',
];
const missing = required.filter((k) => !process.env[k]);
if (missing.length) {
  console.error('❌ חסרים משתני סביבה: ' + missing.join(', '));
  process.exit(1);
}

let serviceAccount;
try {
  serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
} catch {
  console.error('❌ FIREBASE_SERVICE_ACCOUNT אינו JSON תקין');
  process.exit(1);
}

initializeApp({
  credential: cert(serviceAccount),
  databaseURL: process.env.FIREBASE_DATABASE_URL,
});

webpush.setVapidDetails(
  process.env.VAPID_SUBJECT || 'mailto:noreply@roommate.app',
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

const db = getDatabase();

/* ───────────────────── עזרים ───────────────────── */

/** השעה הנוכחית בישראל — הבסיס להחלטה מתי לשלוח תקציר */
function israelHour() {
  return Number(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Jerusalem',
      hour: '2-digit',
      hour12: false,
    }).format(new Date())
  );
}

/** מחזיר את כל החברים הפעילים בחדר */
async function activeMembers(roomCode) {
  const snap = await db.ref(`rooms/${roomCode}/members`).get();
  const members = snap.val() || {};
  return Object.entries(members)
    .filter(([, m]) => m?.status === 'active')
    .map(([uid]) => uid);
}

/** כל המנויים של משתמש, אלא אם כיבה התראות */
async function subscriptionsFor(uid) {
  const snap = await db.ref(`users/${uid}`).get();
  const user = snap.val();
  if (!user) return [];
  if (user.pushEnabled === false) return [];

  return Object.entries(user.pushSubscriptions || {}).map(([id, s]) => ({ id, uid, ...s }));
}

/**
 * שולח לכל המנויים של משתמש.
 *
 * מנוי שמחזיר 404 או 410 נמחק: אלה הקודים שאומרים "המכשיר הזה כבר לא
 * קיים". בלי הניקוי הזה התור מנסה לשלוח לאותם מנויים מתים לנצח.
 */
async function sendTo(subs, payload) {
  const body = JSON.stringify(payload);
  let ok = 0;
  let gone = 0;

  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          body,
          { TTL: 60 * 60 * 24 }
        );
        ok++;
      } catch (err) {
        const code = err?.statusCode;
        if (code === 404 || code === 410) {
          await db.ref(`users/${s.uid}/pushSubscriptions/${s.id}`).remove();
          gone++;
        } else {
          // ‼️ בלי גוף השגיאה, כשל שאינו HTTP (URL פסול, בעיית הצפנה,
          // מפתח VAPID שגוי) מדווח כ-"(?)" ואי אפשר לאבחן אותו בכלל.
          const detail = err?.body || err?.message || String(err);
          console.warn(
            `  ⚠️ שליחה נכשלה (${code ?? 'ללא קוד'}) עבור ${s.uid}: ${String(detail).slice(0, 200)}`
          );
        }
      }
    })
  );

  return { ok, gone };
}

/** מי אמור לקבל את ההתראה הזו */
async function recipientsOf(entry) {
  if (entry.audience === 'user') {
    return entry.targetUid ? [entry.targetUid] : [];
  }
  const members = await activeMembers(entry.roomCode);
  return members.filter((uid) => uid !== entry.excludeUid);
}

/* ───────────────────── ריצה ───────────────────── */

async function run() {
  const snap = await db.ref('outbox').get();
  const all = snap.val() || {};
  const entries = Object.entries(all).map(([id, e]) => ({ id, ...e }));

  const pending = entries.filter((e) => !e.sentAt);
  const now = Date.now();
  const hour = israelHour();

  console.log(`📬 ${pending.length} התראות בתור · השעה בישראל ${hour}:00`);

  const immediate = pending.filter((e) => e.priority === 'now');
  const digest = pending.filter((e) => e.priority !== 'now');

  let sent = 0;
  const updates = {};

  /* ── התראות מיידיות ──
   *
   * ‼️ כל גוף הלולאה עטוף בניסיון-תפיסה יחיד. בלי זה, כשל לא-צפוי
   * ב-sendTo (למשל מחיקת מנוי-מת שנכשלת ברשת) היה יוצא מהלולאה,
   * מפיל את run() כולו, ומאבד את כל ה-updates שכבר נצברו לרשומות
   * שהצליחו — בריצה הבאה הן היו נשלחות שוב (כפילות), והרשומה
   * שנכשלה הייתה חוסמת את כל התור מאחוריה בכל ריצה מחדש.
   */
  for (const entry of immediate) {
    const attempts = (entry.attempts || 0) + 1;

    if (attempts > MAX_ATTEMPTS) {
      console.warn(`  ⛔ "${entry.title}" נזנחה אחרי ${MAX_ATTEMPTS} ניסיונות`);
      updates[`outbox/${entry.id}/sentAt`] = now;
      continue;
    }

    try {
      const uids = await recipientsOf(entry);
      const subs = (await Promise.all(uids.map(subscriptionsFor))).flat();

      if (subs.length > 0) {
        const res = await sendTo(subs, {
          title: entry.title,
          body: entry.body,
          url: entry.url || '/',
          tag: entry.tag || 'roommate',
        });
        sent += res.ok;
        console.log(`  → "${entry.title}" · ${res.ok} נשלחו${res.gone ? `, ${res.gone} מנויים מתים נוקו` : ''}`);
      }
      updates[`outbox/${entry.id}/sentAt`] = now;
    } catch (err) {
      console.warn(`  ⚠️ "${entry.title}" נכשלה (ניסיון ${attempts}): ${err?.message ?? err}`);
      updates[`outbox/${entry.id}/attempts`] = attempts;
    }
  }

  /* ── תקציר יומי ── */
  //
  // נשלח פעם ביום בשעה קבועה, כהתראה אחת מקובצת. התראה נפרדת על כל
  // דיווח היא הדרך הבטוחה לגרום לאנשים לכבות התראות תוך יומיים.
  const oldestDigest = digest.reduce((min, e) => Math.min(min, e.createdAt || now), now);
  const stale = now - oldestDigest > 20 * 60 * 60 * 1000;

  if (digest.length > 0 && (hour === DIGEST_HOUR || stale)) {
    /** uid → רשימת ההתראות שמחכות לו */
    const byUser = new Map();

    for (const entry of digest) {
      try {
        for (const uid of await recipientsOf(entry)) {
          if (!byUser.has(uid)) byUser.set(uid, []);
          byUser.get(uid).push(entry);
        }
        updates[`outbox/${entry.id}/sentAt`] = now;
      } catch (err) {
        // ‼️ אותה סיבה כמו בלולאה המיידית: רשומה פגומה בודדת לא אמורה
        // למנוע את התקציר משאר המשתמשים, ולא אמורה לאבד עדכונים שכבר נצברו.
        console.warn(`  ⚠️ תקציר: "${entry.title}" נכשלה: ${err?.message ?? err}`);
      }
    }

    for (const [uid, list] of byUser) {
      try {
        const subs = await subscriptionsFor(uid);
        if (subs.length === 0) continue;

        const first = list[0];
        const res = await sendTo(subs, {
          title: 'מה קרה היום בחדר',
          body:
            list.length === 1
              ? first.body
              : `${first.body} ועוד ${list.length - 1} עדכונים`,
          url: first.url || '/',
          tag: 'digest',
        });
        sent += res.ok;
      } catch (err) {
        console.warn(`  ⚠️ תקציר למשתמש ${uid} נכשל: ${err?.message ?? err}`);
      }
    }

    console.log(`  → תקציר יומי ל-${byUser.size} משתמשים`);
  } else if (digest.length > 0) {
    console.log(`  ⏳ ${digest.length} התראות ממתינות לתקציר של ${DIGEST_HOUR}:00`);
  }

  /* ── ניקוי התור ── */
  const cutoff = now - RETENTION_DAYS * 24 * 60 * 60 * 1000;
  let removed = 0;
  for (const entry of entries) {
    if (entry.sentAt && entry.sentAt < cutoff) {
      updates[`outbox/${entry.id}`] = null;
      removed++;
    }
  }

  if (Object.keys(updates).length > 0) await db.ref().update(updates);

  console.log(`✅ ${sent} התראות נשלחו${removed ? ` · ${removed} רשומות ישנות נוקו` : ''}`);
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ השליחה נכשלה:', err);
    process.exit(1);
  });
