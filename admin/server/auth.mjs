import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { DATA_DIR } from './config.mjs';

/**
 * ═══════════════════════════════════════════════════════════════
 *  שכבת הגישה — "רק אני"
 * ═══════════════════════════════════════════════════════════════
 *  שלוש שכבות, כל אחת מספיקה בפני עצמה כמעט תמיד; ביחד הן הופכות
 *  את הקונסולה ללא-נגישה לאף אחד מלבד המשתמש של המחשב הזה:
 *
 *   1. השרת מאזין ל-127.0.0.1 בלבד — אין דרך להגיע אליו מהרשת.
 *   2. כל בקשה נבדקת שהגיעה באמת מלולאה מקומית (מונע DNS-rebinding
 *      דרך דפדפן שפונה ל-"localhost" של הקורבן).
 *   3. טוקן מקומי שנוצר פעם אחת ונשמר ב-admin/.data/token — נשלח
 *      בכותרת x-admin-token. הדפדפן מקבל אותו בהזרקה מה-launcher.
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

export function extractToken(req, url) {
  const header = req.headers['x-admin-token'];
  if (typeof header === 'string' && header) return header;
  return url.searchParams.get('token') ?? '';
}

/** משווה בזמן קבוע — הבדל זניח כאן, אבל אין סיבה לכתוב את זה לא נכון. */
export function safeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
