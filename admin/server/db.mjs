import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { DATA_DIR, config } from './config.mjs';
import { buildSeed } from './seed.mjs';

/**
 * ═══════════════════════════════════════════════════════════════
 *  שכבת הנתונים
 * ═══════════════════════════════════════════════════════════════
 *  ממשק אחד, שני מימושים:
 *
 *   live — Firebase Admin SDK. עוקף Security Rules (זו בדיוק הסיבה
 *          שהאפליקציה הזו רצה מקומית ולא בדפדפן: לקוח לעולם לא יכול
 *          לקרוא את כל החדרים, ולא צריך).
 *   demo — עותק בזיכרון של אותו מבנה בדיוק, נשמר לקובץ JSON מקומי.
 *
 *  ‼️ שני המימושים מחזיקים *מראה* מלאה של העץ (snapshot). כל הניתוחים
 *     — פיד, תובנות, בריאות חדרים — רצים על המראה הזו ולא על שאילתות
 *     נקודתיות. זה מה שמאפשר להצליב בין חדרים ומשתמשים בלי עשרות
 *     קריאות רשת לכל רענון מסך.
 * ═══════════════════════════════════════════════════════════════
 */

const DEMO_FILE = join(DATA_DIR, 'demo-db.json');

function deepClone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function pathParts(path) {
  return String(path).split('/').filter(Boolean);
}

function readPath(root, path) {
  let node = root;
  for (const part of pathParts(path)) {
    if (node === null || typeof node !== 'object') return null;
    node = node[part];
    if (node === undefined) return null;
  }
  return node ?? null;
}

function writePath(root, path, value) {
  const parts = pathParts(path);
  if (parts.length === 0) throw new Error('לא כותבים על שורש העץ');
  let node = root;
  for (const part of parts.slice(0, -1)) {
    if (node[part] === undefined || node[part] === null || typeof node[part] !== 'object') {
      node[part] = {};
    }
    node = node[part];
  }
  const last = parts[parts.length - 1];
  if (value === null) delete node[last];
  else node[last] = value;
}

/** מזהה בסגנון push() של Firebase — מונוטוני עולה לפי זמן. */
const PUSH_CHARS = '-0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz';
let lastPushTime = 0;
let lastRandChars = [];

export function pushId(now = Date.now()) {
  const duplicateTime = now === lastPushTime;
  lastPushTime = now;

  let timeStamp = '';
  let remaining = now;
  for (let i = 7; i >= 0; i--) {
    timeStamp = PUSH_CHARS[remaining % 64] + timeStamp;
    remaining = Math.floor(remaining / 64);
  }

  if (!duplicateTime) {
    lastRandChars = Array.from({ length: 12 }, () => Math.floor(Math.random() * 64));
  } else {
    let i = 11;
    for (; i >= 0 && lastRandChars[i] === 63; i--) lastRandChars[i] = 0;
    if (i >= 0) lastRandChars[i]++;
  }

  return timeStamp + lastRandChars.map((c) => PUSH_CHARS[c]).join('');
}

/* ═══════════ מימוש דמו ═══════════ */

function createDemoDb(listeners) {
  let root = existsSync(DEMO_FILE)
    ? JSON.parse(readFileSync(DEMO_FILE, 'utf8'))
    : buildSeed();

  let saveTimer = null;
  const persist = () => {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      try {
        writeFileSync(DEMO_FILE, JSON.stringify(root, null, 2));
      } catch (err) {
        console.warn('⚠️  שמירת נתוני הדגמה נכשלה:', err.message);
      }
    }, 250);
  };

  const changed = () => {
    persist();
    for (const fn of listeners) fn();
  };

  return {
    mode: 'demo',
    snapshot: () => root,
    async get(path) {
      return deepClone(readPath(root, path));
    },
    async set(path, value) {
      writePath(root, path, deepClone(value));
      changed();
    },
    async update(path, patch) {
      for (const [key, value] of Object.entries(patch)) {
        writePath(root, `${path}/${key}`, deepClone(value));
      }
      changed();
    },
    async push(path, value) {
      const id = pushId();
      writePath(root, `${path}/${id}`, deepClone(value));
      changed();
      return id;
    },
    async remove(path) {
      writePath(root, path, null);
      changed();
    },
    async reset() {
      root = buildSeed();
      changed();
    },
    close() {
      clearTimeout(saveTimer);
      try {
        writeFileSync(DEMO_FILE, JSON.stringify(root, null, 2));
      } catch {
        /* אין מה לעשות בסגירה */
      }
    },
  };
}

/* ═══════════ מימוש חי ═══════════ */

async function createLiveDb(listeners) {
  const require = createRequire(import.meta.url);
  /**
   * ‼️ ה-API המודולרי (firebase-admin/app, firebase-admin/database) ולא
   *    ה-namespace הישן. ב-firebase-admin 14 השורש כבר לא מייצא
   *    admin.apps, admin.credential או app.database() — קוד בסגנון הישן
   *    נופל שם עם "Cannot read properties of undefined". התגלה בהרצה
   *    מול אמולטור, ולא היה מתגלה בלי חיבור אמיתי.
   */
  const { initializeApp, getApp, getApps, cert } = require('firebase-admin/app');
  const { getDatabase } = require('firebase-admin/database');

  /**
   * מול אמולטור אין אימות ואין מפתח — רק projectId וכתובת מקומית.
   * מול ייצור נדרש service account מלא.
   */
  const options = config.emulatorHost
    ? {
        projectId: config.projectId,
        databaseURL: `http://${config.emulatorHost}/?ns=${config.projectId}-default-rtdb`,
      }
    : {
        credential: cert(JSON.parse(readFileSync(config.serviceAccountPath, 'utf8'))),
        databaseURL: config.databaseURL,
      };

  const app = getApps().length ? getApp() : initializeApp(options);

  const rtdb = getDatabase(app);

  /**
   * מראה מלאה של העץ, מתעדכנת בזמן אמת.
   *
   * ‼️ מאזינים לשורש ולא לכל ענף בנפרד: אפליקציית חדר משותף היא עץ
   *    קטן (מאות חדרים, אלפי אירועים), ומאזין אחד מבטיח שהצלבות בין
   *    ענפים תמיד רואות את אותו רגע בזמן.
   */
  let mirror = {};
  let ready = false;

  await new Promise((resolvePromise, rejectPromise) => {
    const rootRef = rtdb.ref('/');
    rootRef.on(
      'value',
      (snap) => {
        mirror = snap.val() ?? {};
        if (!ready) {
          ready = true;
          resolvePromise();
        } else {
          for (const fn of listeners) fn();
        }
      },
      (err) => {
        if (!ready) rejectPromise(err);
        else console.error('❌ ניתוק מהמראה של RTDB:', err.message);
      }
    );
  });

  return {
    mode: 'live',
    snapshot: () => mirror,
    async get(path) {
      const snap = await rtdb.ref(path).get();
      return snap.exists() ? snap.val() : null;
    },
    async set(path, value) {
      await rtdb.ref(path).set(value);
    },
    async update(path, patch) {
      await rtdb.ref(path).update(patch);
    },
    async push(path, value) {
      const ref = await rtdb.ref(path).push(value);
      return ref.key;
    },
    async remove(path) {
      await rtdb.ref(path).remove();
    },
    async reset() {
      throw new Error('איפוס נתונים אינו זמין במצב חי');
    },
    close() {
      rtdb.ref('/').off();
    },
  };
}

/* ═══════════ נקודת הכניסה ═══════════ */

export async function openDb() {
  const listeners = new Set();

  let impl;
  if (config.mode === 'live') {
    try {
      impl = await createLiveDb(listeners);
      console.info(`🔗 מחובר: ${config.source}`);
    } catch (err) {
      console.error('❌ החיבור ל-Firebase נכשל, נופלים למצב הדגמה:', err.message);
      impl = createDemoDb(listeners);
    }
  } else {
    impl = createDemoDb(listeners);
    console.info('🧪 מצב הדגמה — חסרים:', config.missing.join(', '));
  }

  return {
    ...impl,
    /** מנוי לכל שינוי בעץ. מחזיר פונקציית ביטול. */
    onChange(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
}
