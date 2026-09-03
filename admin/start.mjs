import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getToken } from './server/auth.mjs';
import { config } from './server/config.mjs';

/**
 * ═══════════════════════════════════════════════════════════════
 *  משגר הקונסולה — `npm run admin`
 * ═══════════════════════════════════════════════════════════════
 *  מריץ שני תהליכים (שרת ה-API ושרת הפיתוח של הממשק), מחכה שהממשק
 *  יעלה, ופותח את הדפדפן עם כרטיס כניסה חד-פעמי.
 *
 *  ‼️ זה מסלול ה*פיתוח*. הפתיחה היומיומית בשני קליקים היא
 *     `admin/launch.mjs` — תהליך אחד, ממשק בנוי, בלי Vite.
 *
 *  ‼️ מה שנוסע ב-URL הוא כרטיס בן 60 שניות לשימוש יחיד, לא טוקן:
 *     `/enter` פודה אותו לסשן ומוחק את הכתובת מההיסטוריה.
 *
 *  ‼️ שני התהליכים קשורים זה לזה: סגירת אחד סוגרת את השני. אחרת נשאר
 *     שרת API יתום שמחזיק את הפורט, והפעלה הבאה נכשלת בלי סיבה ברורה.
 * ═══════════════════════════════════════════════════════════════
 */

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..');
const token = getToken();
const buildOnly = process.argv.includes('--server-only');

const children = [];
let shuttingDown = false;

function spawnChild(label, command, args, options = {}) {
  const child = spawn(command, args, {
    cwd: repoRoot,
    stdio: 'inherit',
    shell: process.platform === 'win32',
    ...options,
  });
  child.on('exit', (code) => {
    if (shuttingDown) return;
    console.error(`\n❌ ${label} הסתיים (קוד ${code}). סוגר את הקונסולה.`);
    shutdown();
  });
  children.push(child);
  return child;
}

function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) {
    try {
      child.kill();
    } catch {
      /* התהליך כבר מת */
    }
  }
  setTimeout(() => process.exit(0), 300);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

/** מבקש כרטיס כניסה חד-פעמי משרת ה-API (ראו admin/launch.mjs). */
async function requestTicket(timeoutMs = 2000) {
  try {
    const res = await fetch(`http://127.0.0.1:${config.port}/api/session/ticket`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-admin-token': token },
      body: '{}',
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) return null;
    return (await res.json()).ticket ?? null;
  } catch {
    return null;
  }
}

async function waitForTicket(timeoutMs = 20_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const ticket = await requestTicket();
    if (ticket) return ticket;
    await new Promise((r) => setTimeout(r, 250));
  }
  return null;
}

/**
 * פותח את הדפדפן בכלים של מערכת ההפעלה — בלי תלות חיצונית.
 *
 * ‼️ חובה גם try וגם on('error'): כישלון של spawn מגיע כאירוע
 *    אסינכרוני ולא כחריגה, ו-'error' בלי מאזין מפיל את התהליך. במחשב
 *    בלי xdg-open (לינוקס מינימלי, סשן SSH) זה הפיל את כל המשגר —
 *    בגלל פתיחת דפדפן שהיא נוחות בלבד.
 */
function openBrowser(url) {
  const command =
    process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open';
  try {
    const child = spawn(command, [url], {
      detached: true,
      stdio: 'ignore',
      shell: process.platform === 'win32',
    });
    child.on('error', () => console.info(`   לא הצלחתי לפתוח דפדפן. פתחו ידנית: ${url}`));
    child.unref();
  } catch {
    console.info(`   לא הצלחתי לפתוח דפדפן. פתחו ידנית: ${url}`);
  }
}

async function waitForPort(port, timeoutMs = 20_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/`, { method: 'GET' });
      if (res.status < 500) return true;
    } catch {
      /* עוד לא עלה */
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  return false;
}

console.info('🛡️  מפעיל את קונסולת המנהל…');
console.info(`   מצב: ${config.mode === 'live' ? 'חי (Firebase)' : 'הדגמה (נתונים מקומיים)'}`);

spawnChild('שרת ה-API', process.execPath, [join(here, 'server', 'index.mjs')]);

if (buildOnly) {
  if (existsSync(join(here, 'dist'))) {
    await waitForPort(config.port);
    const ticket = await waitForTicket();
    if (ticket) openBrowser(`http://127.0.0.1:${config.port}/enter?ticket=${ticket}`);
  }
} else {
  spawnChild('שרת הממשק', 'npx', ['vite', '--config', join(here, 'vite.config.ts')]);
  const ready = await waitForPort(config.webPort);
  const ticket = ready ? await waitForTicket() : null;
  if (ticket) {
    // ‼️ נכנסים דרך פורט ה-Vite ולא דרך ה-API: העוגייה ו-localStorage
    //    חייבים להיווצר במקור שממנו הממשק ייטען בפועל.
    const url = `http://127.0.0.1:${config.webPort}/enter?ticket=${ticket}`;
    console.info(`\n✅ הקונסולה פתוחה: http://127.0.0.1:${config.webPort}/\n`);
    openBrowser(url);
  } else {
    console.info(
      `\n⚠️  לא הצלחתי לפתוח כניסה אוטומטית. פתחו http://127.0.0.1:${config.webPort}/ והדביקו את הטוקן:\n   ${token}\n`
    );
  }
}
