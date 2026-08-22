import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { config, ADMIN_ROOT, DATA_DIR } from './config.mjs';
import {
  authenticate,
  extractToken,
  getToken,
  isAllowedHost,
  isBrowserRequest,
  isLoopback,
  isSameOriginRequest,
  parseCookies,
  safeEqual,
  serializeCookie,
} from './auth.mjs';
import { createSessionStore, SESSION_COOKIE } from './session.mjs';
import { openDb } from './db.mjs';
import { createState } from './state.mjs';
import { flushScheduledMessages, matchRoute } from './api.mjs';

/**
 * ═══════════════════════════════════════════════════════════════
 *  שרת הקונסולה
 * ═══════════════════════════════════════════════════════════════
 *  אין כאן Express ואין תלות חיצונית — http מובנה מספיק, ומה שלא
 *  מותקן לא צריך לעדכן. השרת:
 *   • מאזין ל-127.0.0.1 בלבד
 *   • דורש טוקן מקומי בכל בקשה
 *   • משדר שינויים ב-SSE (/api/stream) כדי שהפיד יהיה חי באמת
 *   • מגיש את ה-build של הממשק כשהוא קיים (admin/dist)
 * ═══════════════════════════════════════════════════════════════
 */

const TOKEN = getToken();
const DIST = join(ADMIN_ROOT, 'dist');

/**
 * מאגר הסשנים. חי בזיכרון בלבד: הפעלה מחדש של השרת מנתקת כל דפדפן
 * פתוח, וזו התנהגות רצויה — אין "סשן ששרד ריסטארט" שאיש לא זוכר.
 */
const sessions = createSessionStore(config.session);

/** המפתח שבו הממשק שומר את חצי-האישור שלו. חייב להתאים ל-web/src/lib/api.ts. */
const SECRET_STORAGE_KEY = 'rmAdminSessionSecret';

/** רגע הפעילות האחרון — מזין את הכיבוי האוטומטי. */
let lastActivityAt = Date.now();

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

function sendJson(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  });
  res.end(payload);
}

async function readBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    // תקרה שפויה — הקונסולה לא מעלה קבצים גדולים
    if (size > 5 * 1024 * 1024) throw new Error('גוף הבקשה גדול מדי');
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new Error('גוף הבקשה אינו JSON תקין');
  }
}

function serveStatic(req, res, pathname) {
  if (!existsSync(DIST)) {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end(
      `<!doctype html><html lang="he" dir="rtl"><meta charset="utf-8">
       <body style="font-family:system-ui;padding:40px;line-height:1.7">
       <h1>שרת הקונסולה פעיל</h1>
       <p>ממשק המשתמש לא נבנה עדיין. בפיתוח הריצו <code>npm run admin</code>,
          שמריץ את השרת ואת Vite יחד.</p>
       <p>לבנייה חד-פעמית: <code>npm run admin:build</code>.</p>
       </body></html>`
    );
    return;
  }

  let filePath = join(DIST, normalize(pathname).replace(/^(\.\.[/\\])+/, ''));
  if (!filePath.startsWith(DIST)) {
    res.writeHead(403);
    res.end('forbidden');
    return;
  }
  if (!existsSync(filePath) || statSync(filePath).isDirectory()) {
    filePath = join(DIST, 'index.html'); // SPA fallback
  }
  res.writeHead(200, {
    'content-type': MIME[extname(filePath)] ?? 'application/octet-stream',
    'cache-control': pathname.startsWith('/assets/') ? 'max-age=31536000, immutable' : 'no-cache',
    ...SECURITY_HEADERS,
  });
  createReadStream(filePath).pipe(res);
}

/**
 * ‼️ frame-ancestors 'none' אינו קישוט: בלעדיו אתר זדוני יכול להטמיע
 *    את הקונסולה ב-iframe שקוף ולגרום למנהל ללחוץ על "אשר" בלי לדעת.
 *    שאר הכללים סוגרים את הדף מפני טעינת קוד או שליחת נתונים החוצה —
 *    בכלי שמדבר עם בסיס נתוני הייצור, אין שום סיבה לצאת מ-'self'.
 */
const SECURITY_HEADERS = {
  'content-security-policy': [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self' data:",
    "connect-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'none'",
    "form-action 'none'",
  ].join('; '),
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'DENY',
  'referrer-policy': 'no-referrer',
};

/** דף הכניסה: כתוב ידנית, בלי תלות ובלי משאב חיצוני. */
function enterPage(secret) {
  const json = JSON.stringify(secret);
  // ‼️ בלי style מוטבע: ה-CSP של הדף הזה הוא default-src 'none', ומאפיין
  //    style הוא בדיוק מה שהוא חוסם. הדף נראה חצי שנייה — לא שווה
  //    לרכך בשבילו את הכלל.
  return `<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8">
<title>קונסולת המנהל</title>
<body>
<p>פותח את הקונסולה…</p>
<script>
try { localStorage.setItem(${JSON.stringify(SECRET_STORAGE_KEY)}, ${json}); } catch (e) {}
location.replace('/');
</script>
</body></html>`;
}

const db = await openDb();
const state = createState(db);
state.startHeartbeat(60_000);

/* ── הודעות מתוזמנות ── */
const scheduler = setInterval(() => {
  flushScheduledMessages(db, state).catch((err) =>
    console.error('❌ שליחת הודעות מתוזמנות נכשלה:', err.message)
  );
}, 30_000);
scheduler.unref?.();

/* ── מנויי SSE ── */
const streams = new Set();
state.subscribe((s) => {
  const payload = JSON.stringify({
    version: s.version,
    builtAt: s.builtAt,
    counts: {
      alerts: s.alerts.filter((a) => !a.dismissed).length,
      critical: s.alerts.filter((a) => !a.dismissed && a.severity === 'critical').length,
      feedbackNew: s.feedbackCounts.new,
    },
    latest: s.events.filter((e) => e.category !== 'session').slice(0, 20),
  });
  for (const res of streams) {
    res.write(`event: state\ndata: ${payload}\n\n`);
  }
});

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host ?? '127.0.0.1'}`);

  if (!isLoopback(req) || !isAllowedHost(req)) {
    res.writeHead(403, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('הקונסולה זמינה מהמחשב המקומי בלבד');
    return;
  }

  /* ── /enter — פדיון כרטיס הכניסה מהמשגר ──
     כאן מסתיימים "שני הקליקים": הקיצור על שולחן העבודה פותח את הכתובת
     הזאת עם כרטיס חד-פעמי, והיא מחליפה אותו בסשן.

     ‼️ location.replace ולא ניווט רגיל: הכתובת עם הכרטיס נמחקת
        מהיסטוריית הדפדפן במקום להישאר בה. הכרטיס ממילא נשרף, אבל
        כתובת שנראית כמו אישור גישה בהיסטוריה היא הזמנה לצרות. */
  if (url.pathname === '/enter') {
    const session = sessions.consumeTicket(url.searchParams.get('ticket') ?? '');
    if (!session) {
      // ‼️ נספר כ„סשן” ולא כ„טוקן”: המקרה השכיח הוא כרטיס שכבר נוצל
      //    (רענון, כפתור אחורה), וספירה שלו במונה שחוסם את מסלול
      //    השחזור הייתה נועלת את בעל הבית. כרטיס הוא 256 ביט לדקה —
      //    ניחוש שלו אינו התרחיש.
      sessions.noteFailure('session');
      res.writeHead(403, { 'content-type': 'text/html; charset=utf-8', ...SECURITY_HEADERS });
      res.end(
        `<!doctype html><meta charset="utf-8"><body style="font-family:system-ui;padding:40px;line-height:1.7" dir="rtl">
         <h1>הכרטיס אינו תקף</h1>
         <p>כרטיס הכניסה תקף לדקה אחת ולשימוש יחיד. הפעילו שוב את הקיצור
            „קונסולת המנהל”.</p></body>`
      );
      return;
    }
    sessions.noteSuccess('session');
    lastActivityAt = Date.now();
    res.writeHead(200, {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store',
      'set-cookie': serializeCookie(SESSION_COOKIE, session.id, {
        maxAgeSec: config.session.ttlMs / 1000,
      }),
      // ‼️ ה-CSP הכללי חוסם script-src 'self' בלבד, והדף הזה *חייב*
      //    סקריפט מוטבע. unsafe-inline רק כאן, בדף בן שלוש שורות שאין
      //    בו שום קלט חיצוני.
      ...SECURITY_HEADERS,
      'content-security-policy': "default-src 'none'; script-src 'unsafe-inline'; frame-ancestors 'none'",
    });
    res.end(enterPage(session.secret));
    return;
  }

  // הממשק עצמו מוגש בלי אישור (אין בו מידע); כל /api דורש אישור
  if (!url.pathname.startsWith('/api/')) {
    serveStatic(req, res, url.pathname);
    return;
  }

  /* ── ניהול הסשן ──
     שלושת הנתיבים האלה נבדקים לפני שער האימות, כי הם *מייצרים* את
     האישור. כל אחד נושא את הבדיקה שמתאימה לו. */
  if (url.pathname.startsWith('/api/session')) {
    if (isBrowserRequest(req) && !isSameOriginRequest(req)) {
      sendJson(res, 403, { error: 'בקשה ממקור חיצוני נדחתה' });
      return;
    }
    if (sessions.isLockedOut('token')) {
      const sec = Math.ceil(sessions.lockoutRemainingMs('token') / 1000);
      sendJson(res, 429, { error: `יותר מדי ניסיונות כושלים. נסו שוב בעוד ${sec} שניות.` });
      return;
    }

    /* המשגר מבקש כרטיס. ‼️ רק מחוץ לדפדפן: כרטיס הוא מפתח לסשן, ואין
       שום תרחיש שבו דף אינטרנט אמור לבקש אחד. */
    if (req.method === 'POST' && url.pathname === '/api/session/ticket') {
      let body = {};
      try {
        body = await readBody(req);
      } catch {
        /* גוף ריק — הטוקן יכול להגיע גם בכותרת */
      }
      const token = extractToken(req, url) || body.token || '';
      if (isBrowserRequest(req) || !safeEqual(token, TOKEN)) {
        sessions.noteFailure('token');
        sendJson(res, 403, { error: 'בקשת כרטיס נדחתה' });
        return;
      }
      sessions.noteSuccess('token');
      const { ticket, expiresInMs } = sessions.mintTicket();
      // ‼️ מחזירים גם את המצב שבו השרת *הזה* עלה. המשגר מדבר עם שרת
      //    שאולי רץ מאתמול, ובלי זה הוא היה מדפיס את המצב לפי הסביבה
      //    שלו — כלומר „מצב חי” בזמן שהקונסולה מציגה נתוני הדגמה.
      sendJson(res, 200, {
        ticket,
        expiresInMs,
        webPort: config.webPort,
        port: config.port,
        mode: config.mode,
        source: config.source,
      });
      return;
    }

    /**
     * כיבוי יזום. משמש את `--restart`: שינוי הגדרות אינו משפיע על שרת
     * שכבר רץ, וצריך דרך לסגור אותו שעובדת גם ב-Windows בלי taskkill.
     *
     * ‼️ מחוץ לדפדפן בלבד, ועם הטוקן הראשי — כמו הנפקת כרטיס.
     */
    if (req.method === 'POST' && url.pathname === '/api/session/shutdown') {
      let body = {};
      try {
        body = await readBody(req);
      } catch {
        /* גוף ריק — הטוקן יכול להגיע בכותרת */
      }
      const token = extractToken(req, url) || body.token || '';
      if (isBrowserRequest(req) || !safeEqual(token, TOKEN)) {
        sessions.noteFailure('token');
        sendJson(res, 403, { error: 'בקשת כיבוי נדחתה' });
        return;
      }
      sendJson(res, 200, { ok: true });
      setTimeout(shutdown, 100);
      return;
    }

    /* מסלול השחזור: הדבקת הטוקן הראשי בממשק מחליפה אותו בסשן —
       כך הטוקן עצמו לעולם אינו נשמר בדפדפן. */
    if (req.method === 'POST' && url.pathname === '/api/session/exchange') {
      let body = {};
      try {
        body = await readBody(req);
      } catch {
        /* גוף פגום — ייפול על בדיקת הטוקן ממילא */
      }
      if (!safeEqual(String(body.token ?? ''), TOKEN)) {
        sessions.noteFailure('token');
        sendJson(res, 401, { error: 'טוקן שגוי' });
        return;
      }
      sessions.noteSuccess('token');
      lastActivityAt = Date.now();
      const session = sessions.create('manual');
      res.writeHead(200, {
        'content-type': 'application/json; charset=utf-8',
        'cache-control': 'no-store',
        'set-cookie': serializeCookie(SESSION_COOKIE, session.id, {
          maxAgeSec: config.session.ttlMs / 1000,
        }),
      });
      res.end(JSON.stringify({ secret: session.secret }));
      return;
    }

    /* נעילה מפורשת — הכפתור בממשק. */
    if (req.method === 'POST' && url.pathname === '/api/session/logout') {
      const sid = parseCookies(req)[SESSION_COOKIE];
      if (sid) sessions.revoke(sid);
      res.writeHead(200, {
        'content-type': 'application/json; charset=utf-8',
        'cache-control': 'no-store',
        'set-cookie': serializeCookie(SESSION_COOKIE, '', { expire: true }),
      });
      res.end(JSON.stringify({ ok: true }));
      return;
    }

    sendJson(res, 404, { error: `לא נמצא: ${req.method} ${url.pathname}` });
    return;
  }

  const auth = authenticate({ req, url, sessions, masterToken: TOKEN });
  if (!auth.ok) {
    sendJson(res, auth.status, { error: auth.error, reason: auth.reason });
    return;
  }

  /* ‼️ רק בקשה *מאושרת* נחשבת פעילות. אחרת טאב מת שמנסה להתחבר מחדש
     כל שלוש שניות היה מחזיק את השרת ואת מפתח הייצור בזיכרון לנצח. */
  lastActivityAt = Date.now();

  /**
   * דופק מהממשק. נשלח על פעולה אמיתית של המשתמש (לחיצה, מקש) ולא
   * בטיימר — כל התפקיד של שעון חוסר-הפעילות הוא להבחין בין "המסך פתוח"
   * לבין "מישהו באמת יושב כאן", וטיימר שרץ לבד מוחק בדיוק את ההבחנה.
   */
  if (url.pathname === '/api/keepalive') {
    if (auth.session) sessions.touch(auth.session.id);
    sendJson(res, 200, { ok: true });
    return;
  }

  /* ── זרם אירועים ── */
  if (url.pathname === '/api/stream') {
    res.writeHead(200, {
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-cache',
      connection: 'keep-alive',
    });
    res.write(`event: hello\ndata: ${JSON.stringify({ version: state.get().version })}\n\n`);
    streams.add(res);

    // ‼️ פינג תקופתי: בלעדיו מתווכים וגם הדפדפן סוגרים חיבור שקט,
    //    והפיד "החי" מת בשקט אחרי כמה דקות בלי שאף אחד ישים לב.
    //
    // ‼️ ואותו פינג גם אוכף את פקיעת הסשן: חיבור SSE נבדק פעם אחת
    //    בפתיחה ואז נשאר פתוח שעות. בלי הבדיקה כאן, מסך שנעל את עצמו
    //    היה ממשיך לקבל את זרם הנתונים החי ברקע.
    const sid = auth.session?.id ?? null;
    const ping = setInterval(() => {
      if (sid && !sessions.isAlive(sid)) {
        clearInterval(ping);
        streams.delete(res);
        res.end();
        return;
      }
      res.write(': ping\n\n');
    }, 25_000);
    req.on('close', () => {
      clearInterval(ping);
      streams.delete(res);
    });
    return;
  }

  const match = matchRoute(req.method, url.pathname);
  if (!match) {
    sendJson(res, 404, { error: `לא נמצא: ${req.method} ${url.pathname}` });
    return;
  }

  try {
    const body = req.method === 'GET' || req.method === 'DELETE' ? {} : await readBody(req);
    const result = await match.handler({
      req,
      res,
      db,
      state,
      params: match.params,
      query: Object.fromEntries(url.searchParams),
      body,
    });

    if (result?.raw) {
      // ייצוא קבצים — לא JSON
      res.writeHead(200, {
        'content-type': result.raw.contentType,
        'content-disposition': `${result.raw.inline ? 'inline' : 'attachment'}; filename*=UTF-8''${encodeURIComponent(
          result.raw.filename
        )}`,
      });
      res.end(result.raw.body);
      return;
    }
    if (result?.status) {
      sendJson(res, result.status, result.body ?? {});
      return;
    }
    sendJson(res, 200, result ?? {});
  } catch (err) {
    console.error(`❌ ${req.method} ${url.pathname}:`, err);
    sendJson(res, 500, { error: err.message ?? 'שגיאה לא צפויה' });
  }
});

/**
 * כיבוי אוטומטי אחרי חוסר פעילות.
 *
 * ‼️ נמדד לפי בקשות ולא לפי "יש סשן פתוח": טאב שנשאר פתוח ברקע ממשיך
 *    לדבר עם השרת (SSE), ולכן ספירה לפי סשנים לא הייתה מכבה לעולם.
 *    מה שנמדד כאן הוא הבקשה האחרונה שהגיעה בפועל.
 */
let autoStop;
if (config.autoStopMs > 0) {
  autoStop = setInterval(() => {
    if (streams.size > 0) return; // דפדפן פתוח ומחובר — לא מכבים מתחתיו
    if (Date.now() - lastActivityAt < config.autoStopMs) return;
    console.info(`\n💤 אין פעילות ${Math.round(config.autoStopMs / 60000)} דקות — סוגר את הקונסולה.`);
    shutdown();
  }, 60_000);
  autoStop.unref?.();
}

server.listen(config.port, config.host, () => {
  const url = `http://${config.host}:${config.port}`;
  console.info(`\n🛡️  קונסולת המנהל — ${config.mode === 'live' ? 'מצב חי' : 'מצב הדגמה'}`);
  console.info(`   API:   ${url}`);
  console.info(`   כניסה: הריצו npm run admin, או לחצו על הקיצור „קונסולת המנהל”`);
  // ‼️ הנתיב ולא הערך. כשהמשגר מפעיל את השרת הפלט נכתב לקובץ, ולוג
  //    שמכיל אישור גישה קבוע הוא בדיוק הדליפה שהמנגנון כאן נועד למנוע
  //    — במיוחד כשהפרויקט יושב בתיקייה מסונכרנת לענן.
  console.info(`   טוקן שחזור: ${join(DATA_DIR, 'token')}`);
  console.info(
    `   סשן: ${Math.round(config.session.ttlMs / 3600000)} שעות · ננעל אחרי ${Math.round(
      config.session.idleMs / 60000
    )} דק׳ ללא פעילות` + (config.autoStopMs > 0 ? ` · השרת נכבה אחרי ${Math.round(config.autoStopMs / 60000)} דק׳` : '')
  );
  console.info('');
});

function shutdown() {
  console.info('\n👋 סוגר את הקונסולה…');
  clearInterval(scheduler);
  if (autoStop) clearInterval(autoStop);
  sessions.revokeAll();
  for (const res of streams) res.end();
  db.close?.();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 1500).unref();
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
