import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { config, ADMIN_ROOT } from './config.mjs';
import { extractToken, getToken, isAllowedHost, isLoopback, safeEqual } from './auth.mjs';
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
  });
  createReadStream(filePath).pipe(res);
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

  // הממשק עצמו מוגש בלי טוקן (אין בו מידע); כל /api דורש טוקן
  if (!url.pathname.startsWith('/api/')) {
    serveStatic(req, res, url.pathname);
    return;
  }

  if (!safeEqual(extractToken(req, url), TOKEN)) {
    sendJson(res, 401, { error: 'טוקן שגוי או חסר' });
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
    const ping = setInterval(() => res.write(': ping\n\n'), 25_000);
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

server.listen(config.port, config.host, () => {
  const url = `http://${config.host}:${config.port}`;
  console.info(`\n🛡️  קונסולת המנהל — ${config.mode === 'live' ? 'מצב חי' : 'מצב הדגמה'}`);
  console.info(`   API:   ${url}`);
  console.info(`   טוקן:  ${TOKEN}`);
  if (existsSync(DIST)) console.info(`   ממשק: ${url}/?token=${TOKEN}`);
  console.info('');
});

function shutdown() {
  console.info('\n👋 סוגר את הקונסולה…');
  clearInterval(scheduler);
  for (const res of streams) res.end();
  db.close?.();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 1500).unref();
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
