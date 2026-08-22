import { describe, expect, it } from 'vitest';
// @ts-expect-error — מודולי השרת של הקונסולה הם JS רגיל, בלי טיפוסים
import { createSessionStore, SESSION_COOKIE } from '../../admin/server/session.mjs';
// @ts-expect-error
import {
  authenticate,
  isSameOriginRequest,
  parseCookies,
  serializeCookie,
} from '../../admin/server/auth.mjs';

/**
 * ═══════════════════════════════════════════════════════════════
 *  בדיקות שכבת הגישה
 * ═══════════════════════════════════════════════════════════════
 *  הקונסולה מדברת מול בסיס הנתונים דרך Admin SDK — כלומר עוקפת את כל
 *  ה-Security Rules. מי שנכנס אליה יכול הכול. לכן הכללים כאן נבדקים
 *  אחד-אחד ולא נשענים על "ככה זה עובד בדפדפן".
 * ═══════════════════════════════════════════════════════════════
 */

const MASTER = 'm'.repeat(48);

/** שעון מזויף — מאפשר לבדוק פקיעה בלי לחכות. */
function clock(start = 1_700_000_000_000) {
  let t = start;
  return { now: () => t, advance: (ms: number) => (t += ms) };
}

function fakeReq(headers: Record<string, string> = {}) {
  return { headers: { host: '127.0.0.1:5190', ...headers }, socket: { remoteAddress: '127.0.0.1' } };
}

function fakeUrl(query = '') {
  return new URL(`http://127.0.0.1:5190/api/bootstrap${query}`);
}

describe('כרטיס כניסה חד-פעמי', () => {
  it('נפדה פעם אחת בלבד', () => {
    const store = createSessionStore();
    const { ticket } = store.mintTicket();

    expect(store.consumeTicket(ticket)).toBeTruthy();
    // ‼️ הלב של המנגנון: הכרטיס נוסע ב-URL של הדפדפן, ולכן ניסיון
    //    שני עליו חייב להיכשל גם אם הוא נקרא מההיסטוריה.
    expect(store.consumeTicket(ticket)).toBeNull();
  });

  it('פג אחרי חלון הזמן', () => {
    const c = clock();
    const store = createSessionStore({ now: c.now, ticketTtlMs: 60_000 });
    const { ticket } = store.mintTicket();

    c.advance(60_001);
    expect(store.consumeTicket(ticket)).toBeNull();
  });

  it('כרטיס מומצא אינו מתקבל', () => {
    const store = createSessionStore();
    expect(store.consumeTicket('לא-קיים')).toBeNull();
    expect(store.consumeTicket('')).toBeNull();
  });
});

describe('סשן', () => {
  it('דורש גם מזהה וגם סוד', () => {
    const store = createSessionStore();
    const s = store.create();

    expect(store.verify(s.id, s.secret).ok).toBe(true);
    // כל חצי לבדו — חסר ערך. זה מה שמגן מפני עוגייה שדלפה לפורט מקומי אחר.
    expect(store.verify(s.id, 'סוד-אחר').ok).toBe(false);
    expect(store.verify('מזהה-אחר', s.secret).ok).toBe(false);
  });

  it('מת אחרי חוסר פעילות של המשתמש', () => {
    const c = clock();
    const store = createSessionStore({ now: c.now, idleMs: 30 * 60_000 });
    const s = store.create();

    c.advance(29 * 60_000);
    store.touch(s.id); // המשתמש נגע במסך
    c.advance(29 * 60_000);
    expect(store.verify(s.id, s.secret).ok).toBe(true);

    c.advance(31 * 60_000);
    expect(store.verify(s.id, s.secret)).toMatchObject({ ok: false, reason: 'expired' });
  });

  it('בקשות רקע אינן נחשבות פעילות', () => {
    // ‼️ הלב של נעילת חוסר-הפעילות: הממשק מרענן את עצמו בכל שינוי
    //    בנתונים, ובמצב חי הם משתנים כל הזמן. אילו verify היה מרענן
    //    את השעון, מסך פתוח על מחשב ריק לא היה ננעל לעולם.
    const c = clock();
    const store = createSessionStore({ now: c.now, idleMs: 10 * 60_000 });
    const s = store.create();

    for (let i = 0; i < 10; i++) {
      c.advance(2 * 60_000);
      store.verify(s.id, s.secret);
    }
    expect(store.verify(s.id, s.secret).ok).toBe(false);
  });

  it('מת בתום הזמן המוחלט גם כשהמשתמש פעיל ברצף', () => {
    const c = clock();
    const store = createSessionStore({ now: c.now, ttlMs: 2 * 3600_000, idleMs: 30 * 60_000 });
    const s = store.create();

    for (let i = 0; i < 8; i++) {
      c.advance(15 * 60_000);
      store.touch(s.id);
    }
    c.advance(15 * 60_000);
    expect(store.verify(s.id, s.secret).ok).toBe(false);
  });

  it('isAlive אינו מרענן את שעון חוסר-הפעילות', () => {
    const c = clock();
    const store = createSessionStore({ now: c.now, idleMs: 10 * 60_000 });
    const s = store.create();

    // ‼️ זה מה שמונע מחיבור SSE פתוח להחיות סשן נעול: הפינג בודק
    //    חיים, הוא לא מסמן פעילות.
    c.advance(9 * 60_000);
    expect(store.isAlive(s.id)).toBe(true);
    c.advance(2 * 60_000);
    expect(store.isAlive(s.id)).toBe(false);
  });

  it('נעילה מפורשת מנתקת מיד', () => {
    const store = createSessionStore();
    const s = store.create();
    store.revoke(s.id);
    expect(store.verify(s.id, s.secret).ok).toBe(false);
  });
});

describe('נעילה אחרי ניסיונות כושלים', () => {
  it('נכנסת לתוקף ומשתחררת בזמן', () => {
    const c = clock();
    const store = createSessionStore({ now: c.now, maxFailures: 3, lockoutMs: 5 * 60_000 });

    store.noteFailure();
    store.noteFailure();
    expect(store.isLockedOut()).toBe(false);
    store.noteFailure();
    expect(store.isLockedOut()).toBe(true);

    c.advance(5 * 60_000 + 1);
    expect(store.isLockedOut()).toBe(false);
  });

  it('סשן שפג אינו נועל את מסלול השחזור', () => {
    // ‼️ רגרסיה: מונה אחד לשני סוגי הכישלונות היה נועל את בעל הבית.
    //    טאב פתוח שהסשן שלו פג מנסה להתחבר מחדש כל שלוש שניות, וזה
    //    היה חוסם תוך חצי דקה גם את הדבקת טוקן השחזור.
    const store = createSessionStore({ maxFailures: 3 });
    for (let i = 0; i < 10; i++) store.noteFailure('session');

    expect(store.isLockedOut('session')).toBe(true);
    expect(store.isLockedOut('token')).toBe(false);
  });

  it('ניחוש הטוקן הראשי כן נועל את מסלול השחזור', () => {
    const store = createSessionStore({ maxFailures: 3 });
    for (let i = 0; i < 3; i++) store.noteFailure('token');
    expect(store.isLockedOut('token')).toBe(true);
  });
});

describe('מקור הבקשה', () => {
  it('מקבל ניווט ישיר ובקשה מאותו מקור', () => {
    expect(isSameOriginRequest(fakeReq({ 'sec-fetch-site': 'same-origin' }))).toBe(true);
    expect(isSameOriginRequest(fakeReq({ 'sec-fetch-site': 'none' }))).toBe(true);
  });

  it('דוחה אתר חיצוני — ובמפורש גם פורט מקומי אחר', () => {
    expect(isSameOriginRequest(fakeReq({ 'sec-fetch-site': 'cross-site' }))).toBe(false);
    // ‼️ same-site כולל את 127.0.0.1:3000 של פרויקט אחר. עוגיות אינן
    //    מופרדות לפי פורט, ולכן דווקא המקרה הזה חייב להיחסם.
    expect(isSameOriginRequest(fakeReq({ 'sec-fetch-site': 'same-site' }))).toBe(false);
  });

  it('נופל ל-Origin כשאין Sec-Fetch-Site', () => {
    expect(isSameOriginRequest(fakeReq({ origin: 'http://127.0.0.1:5190' }))).toBe(true);
    expect(isSameOriginRequest(fakeReq({ origin: 'https://evil.example' }))).toBe(false);
  });
});

describe('עוגיית הסשן', () => {
  it('HttpOnly ו-SameSite=Strict', () => {
    const cookie = serializeCookie(SESSION_COOKIE, 'abc', { maxAgeSec: 3600 });
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Strict');
    expect(cookie).toContain('Max-Age=3600');
  });

  it('נמחקת בנעילה', () => {
    expect(serializeCookie(SESSION_COOKIE, '', { expire: true })).toContain('Max-Age=0');
  });

  it('נקראת מכותרת מרובת ערכים', () => {
    const cookies = parseCookies(fakeReq({ cookie: `a=1; ${SESSION_COOKIE}=xyz; b=2` }));
    expect(cookies[SESSION_COOKIE]).toBe('xyz');
  });
});

describe('שער האימות', () => {
  const auth = (req: ReturnType<typeof fakeReq>, url = fakeUrl(), sessions = createSessionStore()) =>
    authenticate({ req, url, sessions, masterToken: MASTER });

  it('מאשר סשן תקף מהדפדפן', () => {
    const sessions = createSessionStore();
    const s = sessions.create();
    const req = fakeReq({
      'sec-fetch-site': 'same-origin',
      cookie: `${SESSION_COOKIE}=${s.id}`,
      'x-admin-session': s.secret,
    });
    expect(auth(req, fakeUrl(), sessions)).toMatchObject({ ok: true, via: 'session' });
  });

  it('מאשר סוד ב-query — SSE והורדות אינם יכולים לקבוע כותרת', () => {
    const sessions = createSessionStore();
    const s = sessions.create();
    const req = fakeReq({ 'sec-fetch-site': 'same-origin', cookie: `${SESSION_COOKIE}=${s.id}` });
    const url = fakeUrl(`?k=${encodeURIComponent(s.secret)}`);
    expect(auth(req, url, sessions)).toMatchObject({ ok: true });
  });

  it('דוחה עוגייה בלי הסוד המקומי', () => {
    const sessions = createSessionStore();
    const s = sessions.create();
    const req = fakeReq({ 'sec-fetch-site': 'same-origin', cookie: `${SESSION_COOKIE}=${s.id}` });
    expect(auth(req, fakeUrl(), sessions).ok).toBe(false);
  });

  it('דוחה בקשה שיזם אתר אחר, גם כשהעוגייה תקפה', () => {
    const sessions = createSessionStore();
    const s = sessions.create();
    const req = fakeReq({
      'sec-fetch-site': 'cross-site',
      cookie: `${SESSION_COOKIE}=${s.id}`,
      'x-admin-session': s.secret,
    });
    expect(auth(req, fakeUrl(), sessions)).toMatchObject({ ok: false, status: 403 });
  });

  it('מקבל את הטוקן הראשי מכלי שאינו דפדפן', () => {
    const req = fakeReq({ 'x-admin-token': MASTER });
    expect(auth(req)).toMatchObject({ ok: true, via: 'token' });
  });

  it('דוחה את הטוקן הראשי כשהוא מגיע מדפדפן', () => {
    // ‼️ הכלל שמוציא אישור-לצמיתות מהדפדפן: טוקן שדלף פעם אחת (לוג,
    //    היסטוריה, צילום מסך של הטרמינל) לא יפתח קונסולה. מהדפדפן
    //    נכנסים רק דרך /api/session/exchange, שמחליף אותו בסשן קצוב.
    const req = fakeReq({ 'sec-fetch-site': 'same-origin', 'x-admin-token': MASTER });
    expect(auth(req)).toMatchObject({ ok: false, status: 403 });
  });

  it('דוחה בקשה בלי שום אישור', () => {
    expect(auth(fakeReq())).toMatchObject({ ok: false, status: 401 });
  });

  it('נועל אחרי ניסיונות כושלים חוזרים', () => {
    const sessions = createSessionStore({ maxFailures: 3 });
    const bad = fakeReq({ 'sec-fetch-site': 'same-origin', cookie: `${SESSION_COOKIE}=zzz` });
    for (let i = 0; i < 3; i++) auth(bad, fakeUrl(), sessions);
    expect(auth(bad, fakeUrl(), sessions)).toMatchObject({ ok: false, status: 429 });
  });
});
