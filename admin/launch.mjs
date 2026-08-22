import { spawn, spawnSync } from 'node:child_process';
import { existsSync, openSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config, DATA_DIR } from './server/config.mjs';
import { getToken } from './server/auth.mjs';

/**
 * ═══════════════════════════════════════════════════════════════
 *  משגר שני-הקליקים — מה שהקיצור על שולחן העבודה מריץ
 * ═══════════════════════════════════════════════════════════════
 *  קליק ראשון: הקיצור. קליק שני: הדפדפן שנפתח כבר מחובר.
 *
 *  בניגוד ל-`npm run admin` (פיתוח: שרת + Vite), כאן רץ **תהליך אחד**
 *  שמגיש את הממשק הבנוי. זה מה שהופך את הפתיחה למיידית, ומייתר חלון
 *  טרמינל שנשאר פתוח.
 *
 *  הרצף:
 *   1. יש כבר שרת חי? (ניסיון להנפיק כרטיס הוא גם בדיקת החיים)
 *   2. אין ממשק בנוי? בונים פעם אחת.
 *   3. מרימים את השרת כתהליך מנותק, עם לוג לקובץ.
 *   4. מנפיקים כרטיס כניסה חד-פעמי ופותחים איתו את הדפדפן.
 *
 *  ‼️ הכרטיס נוצר כאן ולא נשמר בשום מקום: הוא חי 60 שניות, נשרף
 *     בשימוש הראשון, ומוחלף מיד בסשן קצוב. גם מי שיצליח לקרוא את
 *     שורת הפקודה של התהליך בדיוק ברגע הנכון לא יקבל יותר מזה.
 * ═══════════════════════════════════════════════════════════════
 */

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..');
const API = `http://127.0.0.1:${config.port}`;

/**
 * מנפיק כרטיס. מחזיר null כשהשרת אינו עונה — וזו גם בדיקת החיים.
 * התשובה כוללת את המצב שבו השרת *שרץ עכשיו* עלה (חי/הדגמה).
 */
async function requestTicket(timeoutMs = 2500) {
  try {
    const res = await fetch(`${API}/api/session/ticket`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-admin-token': getToken() },
      body: '{}',
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) return null;
    const body = await res.json();
    return body.ticket ? body : null;
  } catch {
    return null;
  }
}

async function waitForTicket(timeoutMs = 25_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const issued = await requestTicket(1500);
    if (issued) return issued;
    await new Promise((r) => setTimeout(r, 250));
  }
  return null;
}

/** מבקש מהשרת לכבות את עצמו ומחכה שייסגר. */
async function stopServer(timeoutMs = 10_000) {
  try {
    await fetch(`${API}/api/session/shutdown`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-admin-token': getToken() },
      body: '{}',
      signal: AbortSignal.timeout(2500),
    });
  } catch {
    /* לא ענה — אולי כבר מת */
  }
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (!(await requestTicket(1000))) return true;
    await new Promise((r) => setTimeout(r, 250));
  }
  return false;
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
  const win = process.platform === 'win32';
  const command = process.platform === 'darwin' ? 'open' : win ? 'cmd' : 'xdg-open';
  // ‼️ ב-Windows הארגומנט הריק אחרי start הוא כותרת החלון. בלעדיו,
  //    כתובת במרכאות נבלעת ככותרת ושום דבר לא נפתח.
  const args = win ? ['/c', 'start', '', url] : [url];
  try {
    const child = spawn(command, args, { detached: true, stdio: 'ignore', windowsHide: true });
    child.on('error', () => console.info(`   לא הצלחתי לפתוח דפדפן. פתחו ידנית: ${url}`));
    child.unref();
  } catch {
    console.info(`   לא הצלחתי לפתוח דפדפן. פתחו ידנית: ${url}`);
  }
}

console.info('🛡️  קונסולת המנהל');

const wantsStop = process.argv.includes('--stop');
const wantsRestart = process.argv.includes('--restart');

if (wantsStop || wantsRestart) {
  console.info('   סוגר את השרת הקיים…');
  if (!(await stopServer())) {
    console.error('\n❌ השרת לא נסגר. סגרו את תהליך node ידנית ונסו שוב.');
    process.exit(1);
  }
  if (wantsStop) {
    console.info('✅ הקונסולה נסגרה.');
    process.exit(0);
  }
}

/* ── 1. שרת שכבר רץ ── */
let issued = await requestTicket();

if (!issued) {
  /* ── 2. ממשק בנוי ── */
  if (!existsSync(join(here, 'dist', 'index.html'))) {
    // ‼️ בדיקה מפורשת לפני הבנייה: בלי node_modules הבנייה נכשלת
    //    בערימת שגיאות של Vite, ומי שלחץ על קיצור אינו אמור לפענח
    //    אותן כדי לגלות שחסרה פקודה אחת.
    if (!existsSync(join(repoRoot, 'node_modules'))) {
      console.error('\n❌ התלויות לא מותקנות. הריצו בתיקיית הפרויקט:\n   npm install');
      process.exit(1);
    }
    console.info('   בונה את הממשק (פעם אחת)…');
    const build = spawnSync('npm', ['run', 'admin:build'], {
      cwd: repoRoot,
      stdio: 'inherit',
      shell: process.platform === 'win32',
    });
    if (build.status !== 0) {
      console.error('\n❌ הבנייה נכשלה. הריצו בתיקיית הפרויקט: npm install && npm run admin:build');
      process.exit(1);
    }
  }

  /* ── 3. שרת מנותק ──
     ‼️ detached + unref: המשגר מסיים מיד, והשרת ממשיך לחיות. אחרת
        סגירת חלון הטרמינל שנפתח בשביל הקיצור הייתה הורגת את הקונסולה
        באמצע העבודה. */
  const logPath = join(DATA_DIR, 'console.log');
  const log = openSync(logPath, 'a');
  console.info('   מפעיל את השרת…');
  const server = spawn(process.execPath, [join(here, 'server', 'index.mjs')], {
    cwd: repoRoot,
    detached: true,
    stdio: ['ignore', log, log],
    windowsHide: true,
  });
  server.unref();

  issued = await waitForTicket();
  if (!issued) {
    console.error(`\n❌ השרת לא עלה בזמן. הלוג: ${logPath}`);
    process.exit(1);
  }
}

/* ── 4. כניסה ── */
const url = `${API}/enter?ticket=${encodeURIComponent(issued.ticket)}`;
console.info(`   מצב: ${issued.mode === 'live' ? 'חי' : 'הדגמה (נתונים מקומיים)'} · ${issued.source}`);

/**
 * ‼️ האזהרה הזאת שווה את כל הפונקציה: שינוי `.env.local` אינו משפיע על
 *    שרת שכבר רץ, והמשגר פשוט מתחבר אליו. בלי ההודעה כאן המסך היה
 *    ממשיך להראות נתוני הדגמה אחרי הגדרה נכונה לחלוטין — בלי שום רמז
 *    למה, ובלי שום דבר לתקן.
 */
if (issued.mode !== config.mode) {
  console.info(
    `\n   ⚠️  השרת שרץ עלה במצב „${issued.mode === 'live' ? 'חי' : 'הדגמה'}”, אבל ההגדרות הנוכחיות\n` +
      `      אומרות „${config.mode === 'live' ? 'חי' : 'הדגמה'}”. הגדרות נטענות רק בעליית השרת.\n` +
      `      להחלה: npm run admin:restart`
  );
  if (config.mode === 'demo' && config.missing.length) {
    console.info(`      חסר להרצה חיה: ${config.missing.join(', ')}`);
  }
}

console.info('✅ פותח את הדפדפן…');
openBrowser(url);

// ‼️ שהות קצרה לפני היציאה: ב-Windows וב-macOS פקודת פתיחת הדפדפן היא
//    תהליך נפרד, ויציאה מיידית לפעמים הרגה אותו לפני שהספיק לפעול.
setTimeout(() => process.exit(0), 600);
