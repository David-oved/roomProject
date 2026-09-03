import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { DATA_DIR } from './config.mjs';
import { constantTimeEqual, SESSION_COOKIE } from './session.mjs';

/**
 * ═══════════════════════════════════════════════════════════════
 *  שכבת הגישה — "רק אני, רק מהמחשב הזה"
 * ═══════════════════════════════════════════════════════════════
 *  חמש שכבות. כל אחת מספיקה כמעט תמיד בפני עצמה; ביחד הן הופכות את
 *  הקונסולה ללא-נגישה לכל מי שאינו יושב מול המחשב הזה:
 *
 *   1. השרת מאזין ל-127.0.0.1 בלבד — אין דרך להגיע אליו מהרשת.
 *   2. כל בקשה נבדקת שהגיעה באמת מלולאה מקומית ושה-Host הוא localhost
 *      (מונע DNS rebinding: דומיין זדוני שמצביע ל-127.0.0.1).
 *   3. בקשות מדפדפן חייבות להיות מאותו מקור — Sec-Fetch-Site / Origin.
 *      אתר זדוני שפתוח בטאב אחר לא יכול לדבר עם הקונסולה.
 *   4. הכניסה היא בכרטיס חד-פעמי מהמשגר, שנפדה לסשן קצוב (session.mjs).
 *   5. הטוקן הראשי (admin/.data/token, הרשאות 600) אינו אישור גלישה:
 *      אפשר להחליף אותו בסשן, אבל לא להשתמש בו ישירות מדפדפן.
 * ═══════════════════════════════════════════════════════════════
 */

const TOKEN_FILE = join(DATA_DIR, 'token');

export function getToken() {
  if (existsSync(TOKEN_FILE)) {
    const existing = readFileSync(TOKEN_FILE, 'utf8').trim();
    if (existing.length >= 32) return existing;
  }
  const token = randomBytes(24).toString('hex');
  writeFileSync(TOKEN_FILE, token, { mode: 0o600 });
  return token;
}

const LOOPBACK = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);

export function isLoopback(req) {
  return LOOPBACK.has(req.socket.remoteAddress ?? '');
}

/**
 * ‼️ Host נבדק ולא רק ה-IP. בלי זה, אתר זדוני שהמשתמש גולש אליו יכול
 *    לכוון דומיין משלו ל-127.0.0.1 ולדבר עם הקונסולה מתוך הדפדפן.
 */
export function isAllowedHost(req) {
  const host = (req.headers.host ?? '').split(':')[0];
  return host === '127.0.0.1' || host === 'localhost' || host === '[::1]' || host === '::1';
}

/** בקשה שהגיעה מדפדפן מסמנת את עצמה ב-Sec-Fetch-Site או ב-Origin. */
export function isBrowserRequest(req) {
  return req.headers['sec-fetch-site'] !== undefined || req.headers.origin !== undefined;
}

/**
 * האם הבקשה נולדה בקונסולה עצמה.
 *
 * `none` = ניווט ישיר (המשגר פתח את הכתובת, או סימנייה) — מותר.
 * `same-origin` = הממשק שלנו קורא ל-API — מותר.
 * `cross-site` / `same-site` = דף אחר יזם את הבקשה — נדחה. „same-site”
 * כולל כאן שרת מקומי אחר על פורט אחר, וזה בדיוק המקרה שרוצים לחסום.
 */
export function isSameOriginRequest(req) {
  const site = req.headers['sec-fetch-site'];
  if (typeof site === 'string') return site === 'same-origin' || site === 'none';

  const origin = req.headers.origin;
  if (typeof origin === 'string' && origin) {
    try {
      return new URL(origin).host === req.headers.host;
    } catch {
      return false;
    }
  }
  // בלי אף אחת מהכותרות זה אינו דפדפן (curl, סקריפט) — הטוקן הראשי יכריע.
  return true;
}

export function parseCookies(req) {
  const raw = req.headers.cookie;
  const out = {};
  if (typeof raw !== 'string') return out;
  for (const part of raw.split(';')) {
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    const key = part.slice(0, eq).trim();
    if (!key) continue;
    out[key] = decodeURIComponent(part.slice(eq + 1).trim());
  }
  return out;
}

/**
 * ‼️ בלי Secure — הקונסולה רצה על http מקומי, ודפדפן מתעלם מעוגיית
 *    Secure שהגיעה מ-http. SameSite=Strict הוא מה שנושא כאן את המשקל:
 *    הוא מונע שליחת העוגייה בכל בקשה שיזם אתר אחר.
 */
export function serializeCookie(name, value, { maxAgeSec, expire = false } = {}) {
  const parts = [
    `${name}=${encodeURIComponent(value)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Strict',
  ];
  if (expire) parts.push('Max-Age=0', 'Expires=Thu, 01 Jan 1970 00:00:00 GMT');
  else if (maxAgeSec) parts.push(`Max-Age=${Math.floor(maxAgeSec)}`);
  return parts.join('; ');
}

/**
 * הסוד שנשמר ב-localStorage מגיע בכותרת; ב-EventSource ובהורדות קבצים
 * אי אפשר לקבוע כותרת, ולכן שם הוא מגיע ב-query.
 */
export const SECRET_HEADER = 'x-admin-session';
export const SECRET_QUERY = 'k';

export function extractSessionSecret(req, url) {
  const header = req.headers[SECRET_HEADER];
  if (typeof header === 'string' && header) return header;
  return url.searchParams.get(SECRET_QUERY) ?? '';
}

/** נשאר לתאימות: כלים מבחוץ (curl, סקריפטים) מזדהים בטוקן הראשי. */
export function extractToken(req, url) {
  const header = req.headers['x-admin-token'];
  if (typeof header === 'string' && header) return header;
  return url.searchParams.get('token') ?? '';
}

export function safeEqual(a, b) {
  return constantTimeEqual(a ?? '', b ?? '');
}

/**
 * ההכרעה לכל בקשת /api. מחזירה { ok, via, session } או { ok:false, status, error }.
 *
 * ‼️ הטוקן הראשי נדחה כשהבקשה הגיעה מדפדפן. זה נראה מחמיר, והוא
 *    הלב של השינוי: כל עוד טוקן קבוע מספיק כדי לגלוש, מספיק שהוא ידלוף
 *    פעם אחת (היסטוריה, לוג, צילום מסך של הטרמינל) כדי לתת גישה
 *    לצמיתות. מהדפדפן נכנסים דרך /api/session/exchange, שמחליף אותו
 *    בסשן קצוב.
 */
export function authenticate({ req, url, sessions, masterToken }) {
  if (sessions.isLockedOut()) {
    const sec = Math.ceil(sessions.lockoutRemainingMs() / 1000);
    return { ok: false, status: 429, error: `יותר מדי ניסיונות כושלים. נסו שוב בעוד ${sec} שניות.` };
  }

  const fromBrowser = isBrowserRequest(req);
  if (fromBrowser && !isSameOriginRequest(req)) {
    return { ok: false, status: 403, error: 'בקשה ממקור חיצוני נדחתה' };
  }

  const sid = parseCookies(req)[SESSION_COOKIE] ?? '';
  const secret = extractSessionSecret(req, url);
  if (sid || secret) {
    const result = sessions.verify(sid, secret);
    if (result.ok) {
      sessions.noteSuccess();
      return { ok: true, via: 'session', session: result.session };
    }
    sessions.noteFailure();
    return {
      ok: false,
      status: 401,
      error: result.reason === 'expired' ? 'הסשן פג. פתחו מחדש את הקונסולה.' : 'אישור הגישה אינו תקף',
      reason: result.reason,
    };
  }

  const token = extractToken(req, url);
  if (token) {
    if (fromBrowser) {
      return { ok: false, status: 403, error: 'טוקן ראשי אינו משמש לגלישה — היכנסו דרך המשגר' };
    }
    if (safeEqual(token, masterToken)) {
      sessions.noteSuccess('token');
      return { ok: true, via: 'token' };
    }
    sessions.noteFailure('token');
    return { ok: false, status: 401, error: 'טוקן שגוי' };
  }

  return { ok: false, status: 401, error: 'נדרש אישור גישה' };
}
