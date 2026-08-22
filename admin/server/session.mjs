import { randomBytes, timingSafeEqual } from 'node:crypto';

/**
 * ═══════════════════════════════════════════════════════════════
 *  סשנים, כרטיסי כניסה חד-פעמיים ונעילה אחרי כישלונות
 * ═══════════════════════════════════════════════════════════════
 *  הקונסולה נפתחת בשני קליקים (קיצור על שולחן העבודה → דפדפן), ולכן
 *  אסור שהמחיר יהיה אישור קבוע ששוכב בדפדפן. המודל כאן:
 *
 *   1. המשגר מבקש מהשרת **כרטיס חד-פעמי** (ticket) — תקף 60 שניות,
 *      נשרף בשימוש הראשון. הוא זה שנוסע ב-URL של הדפדפן.
 *   2. השרת פודה את הכרטיס ופותח **סשן**: זוג ערכים שחייבים להגיע
 *      יחד — מזהה בעוגייה HttpOnly, וסוד שנשמר ב-localStorage ונשלח
 *      בכותרת.
 *   3. הסשן פג: מגבלת זמן מוחלטת + מגבלת חוסר-פעילות.
 *
 *  ‼️ למה **שני** ערכים ולא עוגייה אחת: עוגיות ב-localhost אינן מופרדות
 *     לפי פורט. כל שרת מקומי אחר שהמנהל גולש אליו באותו דפדפן
 *     (127.0.0.1:3000 של פרויקט אחר, למשל) יקבל את העוגייה שלנו בבקשה
 *     ויוכל לשחזר אותה. localStorage לעומת זאת *כן* מופרד לפי פורט.
 *     לכן העוגייה לבדה חסרת ערך, והסוד לבדו חסר ערך.
 *
 *  ‼️ ולמה בכל זאת עוגייה HttpOnly ולא רק localStorage: מה שיושב
 *     ב-localStorage נגיש ל-JavaScript, ומספיק באג אחד בממשק כדי
 *     להוציא אותו. חצי מהאישור שאינו נגיש ל-JS הופך גניבה כזו לחסרת
 *     תועלת.
 *
 *  הכול בזיכרון בלבד ובכוונה: הפעלה מחדש של השרת מנתקת כל סשן קיים.
 * ═══════════════════════════════════════════════════════════════
 */

export const SESSION_COOKIE = 'rmAdminSid';

/** ברירות מחדל — ניתנות לדריסה מהסביבה דרך config.mjs. */
export const DEFAULTS = {
  /** תוחלת חיים מוחלטת של סשן. */
  ttlMs: 12 * 60 * 60 * 1000,
  /** חוסר פעילות שאחריו הסשן מת — המחשב שנשאר פתוח בלי השגחה. */
  idleMs: 30 * 60 * 1000,
  /** חלון הפדיון של כרטיס הכניסה. קצר בכוונה: הוא נוסע ב-URL. */
  ticketTtlMs: 60 * 1000,
  /** כמה ניסיונות כושלים לפני נעילה. */
  maxFailures: 8,
  lockoutMs: 5 * 60 * 1000,
};

function newSecret() {
  return randomBytes(32).toString('base64url');
}

/** השוואה בזמן קבוע שגם לא קורסת על אורכים שונים או על קלט שאינו מחרוזת. */
export function constantTimeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

export function createSessionStore(options = {}) {
  const opts = { ...DEFAULTS, ...options };
  const now = opts.now ?? Date.now;

  /** id → { id, secret, createdAt, lastSeenAt, label } */
  const sessions = new Map();
  /** ticket → { ticket, createdAt, label } */
  const tickets = new Map();

  /**
   * שני מוני כישלונות נפרדים, ובכוונה.
   *
   * ‼️ מונה אחד היה יוצר תקלה אמיתית: טאב שהסשן שלו פג מנסה להתחבר
   *    מחדש כל שלוש שניות, ותוך חצי דקה היה מגיע לסף — ואז גם *מסלול
   *    השחזור* (הדבקת הטוקן) היה חסום, כלומר הנעילה הייתה נועלת את
   *    בעל הבית במקום את הפורץ. „סשן שפג” ו„ניחוש טוקן” הם שני
   *    אירועים שונים ונספרים בנפרד.
   */
  const failures = { session: 0, token: 0 };
  const lockedUntil = { session: 0, token: 0 };

  function sweep() {
    const t = now();
    for (const [id, s] of sessions) {
      if (t - s.createdAt > opts.ttlMs || t - s.lastSeenAt > opts.idleMs) sessions.delete(id);
    }
    for (const [ticket, entry] of tickets) {
      if (t - entry.createdAt > opts.ticketTtlMs) tickets.delete(ticket);
    }
  }

  return {
    options: opts,

    /* ── נעילה אחרי כישלונות ──
       ‼️ הנעילה גורפת ולא לפי מקור: כל הבקשות מגיעות מלולאה מקומית,
          ולכן "לפי IP" היה תמיד אותו IP — כלומר בכלל לא הגבלה. */
    isLockedOut(kind = 'session') {
      return now() < lockedUntil[kind];
    },
    lockoutRemainingMs(kind = 'session') {
      return Math.max(0, lockedUntil[kind] - now());
    },
    noteFailure(kind = 'session') {
      failures[kind] += 1;
      if (failures[kind] >= opts.maxFailures) {
        lockedUntil[kind] = now() + opts.lockoutMs;
        failures[kind] = 0;
      }
      return this.isLockedOut(kind);
    },
    noteSuccess(kind = 'session') {
      failures[kind] = 0;
      lockedUntil[kind] = 0;
    },

    /* ── כרטיס כניסה חד-פעמי ── */
    mintTicket(label = 'launcher') {
      sweep();
      const ticket = randomBytes(32).toString('base64url');
      tickets.set(ticket, { ticket, createdAt: now(), label });
      return { ticket, expiresInMs: opts.ticketTtlMs };
    },

    /**
     * פודה כרטיס ופותח סשן. מחזיר null אם הכרטיס לא קיים, פג או כבר נוצל.
     * ‼️ המחיקה קודמת לכל בדיקה אחרת: כרטיס שנגעו בו נשרף, גם אם
     *    הסתבר שפג. אחרת ניסיון חוזר על אותו כרטיס הוא חלון פתוח.
     */
    consumeTicket(ticket) {
      if (typeof ticket !== 'string' || !ticket) return null;
      const entry = tickets.get(ticket);
      if (!entry) return null;
      tickets.delete(ticket);
      if (now() - entry.createdAt > opts.ticketTtlMs) return null;
      return this.create(entry.label);
    },

    /* ── סשנים ── */
    create(label = 'browser') {
      sweep();
      const session = {
        id: randomBytes(24).toString('base64url'),
        secret: newSecret(),
        createdAt: now(),
        lastSeenAt: now(),
        label,
      };
      sessions.set(session.id, session);
      return session;
    },

    /**
     * מאמת זוג (מזהה מהעוגייה, סוד מהכותרת).
     *
     * ‼️ **אינו** מרענן את שעון חוסר-הפעילות, ודווקא זה העיקר: הממשק
     *    מרענן את עצמו בכל שינוי בבסיס הנתונים, ובמצב חי הנתונים
     *    משתנים כל הזמן. אילו כל בקשה מאושרת הייתה נחשבת „פעילות”,
     *    מסך שנשאר פתוח על מחשב ריק לא היה ננעל לעולם — כלומר המנגנון
     *    היה קיים רק על הנייר. את השעון מרענן touch(), שנקרא רק
     *    כשהמשתמש עצמו נגע במסך.
     */
    verify(id, secret) {
      sweep();
      if (typeof id !== 'string' || !id) return { ok: false, reason: 'no-session' };
      const session = sessions.get(id);
      if (!session) return { ok: false, reason: 'expired' };
      if (!constantTimeEqual(session.secret, secret ?? '')) return { ok: false, reason: 'bad-secret' };
      return { ok: true, session };
    },

    /** „מישהו יושב כאן” — מרענן את שעון חוסר-הפעילות. */
    touch(id) {
      const session = sessions.get(id);
      if (!session) return false;
      session.lastSeenAt = now();
      return true;
    },

    /** האם הסשן עדיין חי — בלי לרענן את שעון חוסר-הפעילות. */
    isAlive(id) {
      sweep();
      return sessions.has(id);
    },

    revoke(id) {
      return sessions.delete(id);
    },
    revokeAll() {
      const count = sessions.size;
      sessions.clear();
      tickets.clear();
      return count;
    },
    activeCount() {
      sweep();
      return sessions.size;
    },
    /** מתי לאחרונה נראתה פעילות כלשהי — משמש לכיבוי אוטומטי. */
    lastActivityAt() {
      let latest = 0;
      for (const s of sessions.values()) latest = Math.max(latest, s.lastSeenAt);
      return latest;
    },
  };
}
