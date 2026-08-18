#!/usr/bin/env node
/**
 * ═══════════════════════════════════════════════════════════════════
 *  סימולציית מערכת ההתראות
 * ═══════════════════════════════════════════════════════════════════
 *
 *  מריץ את שולח ההתראות האמיתי מול שרת פוש מזויף, ובודק את כל מסלולי
 *  הכשל שאי אפשר לבדוק במכשיר אמיתי: מנוי מת, חדר שנמחק, משתמש
 *  שכיבה התראות, ורשומה פגומה שחוזרת לנצח.
 *
 *  השרת המזויף מחזיר קודים לפי הנתיב:
 *    /ok    → 201  הצלחה
 *    /gone  → 410  המנוי מת, אמור להימחק
 *    /boom  → 500  כשל זמני, אסור למחוק
 *
 *  הרצה:  node scripts/simulate-push.mjs
 *  דורש:  .vapid.json + service account מקומי (.sim-sa.json)
 * ═══════════════════════════════════════════════════════════════════
 */
import { createServer } from 'node:https';
import { spawn } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { createECDH, randomBytes } from 'node:crypto';
import { initializeApp, cert } from 'firebase-admin/app';
import { getDatabase } from 'firebase-admin/database';

const PORT = 8787;
const ROOM = 'SIMTST';
const UID_ACTOR = 'sim-actor';
const UID_A = 'sim-user-a';
const UID_B = 'sim-user-b';
const UID_OFF = 'sim-user-off';

const NL = String.fromCharCode(10);

/* ───────────── בדיקות מוקדמות ───────────── */

const keyPath = process.env.SIM_SERVICE_ACCOUNT || '.sim-sa.json';
if (!existsSync('.vapid.json')) {
  console.error('❌ חסר .vapid.json');
  process.exit(1);
}
if (!existsSync(keyPath)) {
  console.error(`❌ חסר service account ב-${keyPath}`);
  process.exit(1);
}

const vapid = JSON.parse(readFileSync('.vapid.json', 'utf8'));
const serviceAccount = JSON.parse(readFileSync(keyPath, 'utf8'));
const DB_URL = `https://${serviceAccount.project_id}-default-rtdb.europe-west1.firebasedatabase.app`;

initializeApp({ credential: cert(serviceAccount), databaseURL: DB_URL });
const db = getDatabase();

/* ───────────── מנוי מזויף אך תקין ───────────── */

/**
 * מייצר מפתחות אמיתיים. web-push מצפין בפועל לפני השליחה, ולכן
 * מפתחות מזויפים היו מפילים אותו לפני שהבקשה בכלל יוצאת — והסימולציה
 * הייתה בודקת את הדבר הלא נכון.
 */
function fakeSubscription(path) {
  const ecdh = createECDH('prime256v1');
  ecdh.generateKeys();
  return {
    endpoint: `https://127.0.0.1:${PORT}${path}`,
    p256dh: ecdh.getPublicKey().toString('base64url'),
    auth: randomBytes(16).toString('base64url'),
    platform: 'other',
    createdAt: Date.now(),
  };
}

/* ───────────── שרת פוש מזויף ───────────── */

const received = [];

/**
 * ‼️ HTTPS ולא HTTP.
 *
 * web-push כופה TLS על כל endpoint — שרת HTTP רגיל מחזיר EPROTO של
 * OpenSSL עוד לפני שהבקשה יוצאת. הסימולציה נכשלה בדיוק ככה, ובלי
 * לוג שגיאה מפורט זה נראה כמו כשל שליחה סתמי.
 */
const server = createServer(
  {
    key: readFileSync('.sim-certs/key.pem'),
    cert: readFileSync('.sim-certs/cert.pem'),
  },
  (req, res) => {
  received.push(req.url || '');
  if ((req.url || '').startsWith('/gone')) res.writeHead(410);
  else if ((req.url || '').startsWith('/boom')) res.writeHead(500);
  else res.writeHead(201);
    res.end();
  }
);

/* ───────────── זריעה וניקוי ───────────── */

const member = (name) => ({
  name,
  email: `${name}@sim`,
  joinedAt: 1,
  status: 'active',
  role: 'member',
});

async function seed() {
  await db.ref().update({
    [`rooms/${ROOM}/metadata`]: {
      name: 'חדר סימולציה',
      description: '',
      currency: 'ILS',
      createdAt: Date.now(),
      createdBy: UID_ACTOR,
      adminId: UID_ACTOR,
    },
    [`rooms/${ROOM}/members`]: {
      [UID_ACTOR]: { ...member('שולח'), role: 'admin' },
      [UID_A]: member('מקבל-א'),
      [UID_B]: member('מקבל-ב'),
      [UID_OFF]: member('כיבה'),
      'sim-removed': { ...member('הוסר'), status: 'removed' },
    },

    // מנוי תקין
    [`users/${UID_A}`]: {
      email: 'a@sim',
      displayName: 'מקבל א',
      createdAt: 1,
      pushSubscriptions: { live: fakeSubscription('/ok') },
    },
    // מנוי מת — אמור להימחק אחרי 410
    [`users/${UID_B}`]: {
      email: 'b@sim',
      displayName: 'מקבל ב',
      createdAt: 1,
      pushSubscriptions: { dead: fakeSubscription('/gone') },
    },
    // כיבה התראות — אסור שיקבל
    [`users/${UID_OFF}`]: {
      email: 'c@sim',
      displayName: 'כיבה',
      createdAt: 1,
      pushEnabled: false,
      pushSubscriptions: { live: fakeSubscription('/ok') },
    },

    outbox: {
      'sim-1': {
        roomCode: ROOM,
        title: 'מיידי לכל החדר',
        body: 'בדיקה',
        priority: 'now',
        audience: 'room',
        excludeUid: UID_ACTOR,
        createdAt: Date.now(),
      },
      'sim-2': {
        roomCode: ROOM,
        title: 'מיידי לנמען בודד',
        body: 'בדיקה',
        priority: 'now',
        audience: 'user',
        targetUid: UID_A,
        excludeUid: UID_ACTOR,
        createdAt: Date.now(),
      },
      'sim-3': {
        roomCode: ROOM,
        title: 'תקציר',
        body: 'לא אמור לצאת עכשיו',
        priority: 'digest',
        audience: 'room',
        excludeUid: UID_ACTOR,
        createdAt: Date.now(),
      },
      'sim-4': {
        roomCode: 'NOEXST',
        title: 'חדר שלא קיים',
        body: 'בדיקת רשומה פגומה',
        priority: 'now',
        audience: 'room',
        excludeUid: UID_ACTOR,
        createdAt: Date.now(),
      },
    },
  });
}

async function cleanup() {
  await db.ref().update({
    [`rooms/${ROOM}`]: null,
    [`users/${UID_A}`]: null,
    [`users/${UID_B}`]: null,
    [`users/${UID_OFF}`]: null,
    outbox: null,
  });
}

/* ───────────── בדיקות ───────────── */

let failures = 0;
function check(name, ok, detail = '') {
  console.log(ok ? `  ✅ ${name}` : `  ❌ ${name}${detail ? ' — ' + detail : ''}`);
  if (!ok) failures++;
}

/**
 * ‼️ spawn אסינכרוני ולא spawnSync.
 *
 * spawnSync חוסם את לולאת האירועים של Node — ואז השרת המזויף שרץ
 * באותו תהליך לא יכול לענות לבקשות של השולח. התוצאה היא דדלוק:
 * השולח ממתין לתשובת HTTP שלעולם לא תגיע. קרה בפועל בריצה הראשונה.
 */
function runSender() {
  return new Promise((resolve) => {
    const child = spawn('node', ['scripts/send-push.mjs'], {
      env: {
        ...process.env,
        FIREBASE_SERVICE_ACCOUNT: JSON.stringify(serviceAccount),
        FIREBASE_DATABASE_URL: DB_URL,
        VAPID_PUBLIC_KEY: vapid.publicKey,
        VAPID_PRIVATE_KEY: vapid.privateKey,
        VAPID_SUBJECT: 'mailto:sim@test',
        // אישור חתום-עצמית לסימולציה מקומית בלבד
        NODE_TLS_REJECT_UNAUTHORIZED: '0',
      },
    });

    let out = '';
    child.stdout.on('data', (d) => (out += d));
    child.stderr.on('data', (d) => (out += d));

    const kill = setTimeout(() => child.kill('SIGKILL'), 90000);
    child.on('close', () => {
      clearTimeout(kill);
      resolve(out);
    });
  });
}

async function run() {
  await new Promise((r) => server.listen(PORT, '127.0.0.1', r));
  console.log(`🔌 שרת פוש מזויף על ${PORT}${NL}`);

  console.log('🌱 זורע נתוני בדיקה…');
  await seed();

  console.log(`🚀 מריץ את השולח האמיתי…${NL}`);
  const out = await runSender();
  console.log(
    out
      .split(NL)
      .map((l) => '  │ ' + l)
      .join(NL)
  );

  console.log(`${NL}🔍 בדיקות:${NL}`);

  const okHits = received.filter((p) => p.startsWith('/ok')).length;
  const goneHits = received.filter((p) => p.startsWith('/gone')).length;

  check('מקבל א קיבל 2 התראות (חדר + אישית)', okHits === 2, `התקבלו ${okHits}`);
  check('מנוי מת קיבל ניסיון אחד בלבד', goneHits === 1, `התקבלו ${goneHits}`);
  check('משתמש שכיבה התראות לא קיבל כלום', okHits === 2, 'אחרת המונה היה 3');

  const dead = await db.ref(`users/${UID_B}/pushSubscriptions/dead`).get();
  check('מנוי שהחזיר 410 נמחק אוטומטית', !dead.exists());

  const s1 = await db.ref('outbox/sim-1/sentAt').get();
  const s2 = await db.ref('outbox/sim-2/sentAt').get();
  check('התראות מיידיות סומנו כנשלחו', s1.exists() && s2.exists());

  const hour = Number(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Jerusalem',
      hour: '2-digit',
      hour12: false,
    }).format(new Date())
  );
  const s3 = await db.ref('outbox/sim-3/sentAt').get();
  if (hour === 18) {
    check('תקציר נשלח בשעת התקציר', s3.exists());
  } else {
    check('תקציר ממתין ולא נשלח מחוץ לשעה', !s3.exists(), `השעה ${hour}`);
  }

  const s4 = (await db.ref('outbox/sim-4').get()).val() || {};
  check(
    'רשומה לחדר לא קיים לא נתקעת בלולאה',
    s4.sentAt !== undefined || s4.attempts !== undefined,
    JSON.stringify(s4).slice(0, 90)
  );

  console.log(`${NL}🧹 מנקה…`);
  await cleanup();
  server.close();

  console.log(failures === 0 ? `${NL}✅ כל הבדיקות עברו` : `${NL}❌ ${failures} בדיקות נכשלו`);
  process.exit(failures === 0 ? 0 : 1);
}

run().catch(async (err) => {
  console.error('❌ הסימולציה קרסה:', err);
  await cleanup().catch(() => undefined);
  server.close();
  process.exit(1);
});
