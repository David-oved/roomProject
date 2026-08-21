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
 *  יעלה, ופותח את הדפדפן עם הטוקן מוזרק בכתובת.
 *
 *  ‼️ הטוקן מוזרק ב-URL ולא נשמר בקוד: הממשק שומר אותו ב-localStorage
 *     ומיד מנקה אותו מהכתובת (ראו lib/api.ts), כדי שלא יישאר
 *     בהיסטוריית הדפדפן.
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
  const url = `http://127.0.0.1:${config.port}/?token=${token}`;
  if (existsSync(join(here, 'dist'))) {
    await waitForPort(config.port);
    openBrowser(url);
  }
} else {
  spawnChild('שרת הממשק', 'npx', ['vite', '--config', join(here, 'vite.config.ts')]);
  const ready = await waitForPort(config.webPort);
  const url = `http://127.0.0.1:${config.webPort}/?token=${token}`;
  if (ready) {
    console.info(`\n✅ הקונסולה פתוחה: ${url}\n`);
    openBrowser(url);
  } else {
    console.info(`\n⚠️  הממשק לא ענה בזמן. נסו לפתוח ידנית: ${url}\n`);
  }
}
