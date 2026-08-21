import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * ═══════════════════════════════════════════════════════════════
 *  קונפיגורציה של אפליקציית המנהל
 * ═══════════════════════════════════════════════════════════════
 *  האפליקציה רצה על המחשב של מנהל התוכנה בלבד:
 *  השרת מאזין ל-127.0.0.1 ולא לכתובת חיצונית, ודורש טוקן מקומי.
 *
 *  שני מצבי הרצה:
 *   • live — חיבור אמיתי ל-Firebase דרך Admin SDK (service account).
 *   • demo — נתוני הדגמה בזיכרון. נכנס לפעולה כשאין service account,
 *            כדי שאפשר יהיה לפתח ולבדוק את הקונסולה בלי גישה לייצור.
 * ═══════════════════════════════════════════════════════════════
 */

const here = dirname(fileURLToPath(import.meta.url));
export const ADMIN_ROOT = resolve(here, '..');
export const REPO_ROOT = resolve(ADMIN_ROOT, '..');

/** טוענים .env.local / .env מהשורש בלי תלות חיצונית (dotenv). */
function loadEnvFile(file) {
  if (!existsSync(file)) return;
  for (const rawLine of readFileSync(file, 'utf8').split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    if (process.env[key] !== undefined) continue; // סביבה אמיתית גוברת
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

loadEnvFile(join(REPO_ROOT, '.env.local'));
loadEnvFile(join(REPO_ROOT, '.env'));
loadEnvFile(join(ADMIN_ROOT, '.env.local'));

/** תיקיית העבודה המקומית של הקונסולה — טוקן, מטמון דמו, ייצוא דוחות. */
export const DATA_DIR = join(ADMIN_ROOT, '.data');
if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });

function resolveMaybe(p) {
  if (!p) return null;
  return isAbsolute(p) ? p : resolve(REPO_ROOT, p);
}

/**
 * נתיב ה-service account.
 * ‼️ הקובץ הזה הוא סוד אמיתי (בניגוד ל-apiKey של הלקוח) — הוא עוקף
 *    את כל ה-Security Rules. לעולם אינו נכנס ל-git; ראו admin/README.md.
 */
const saPath =
  resolveMaybe(process.env.ADMIN_SERVICE_ACCOUNT) ??
  resolveMaybe(process.env.GOOGLE_APPLICATION_CREDENTIALS) ??
  join(ADMIN_ROOT, 'service-account.json');

/**
 * חיבור לאמולטור המקומי.
 *
 * ‼️ כשמשתנה הסביבה קיים, אין צורך ב-service account כלל: לאמולטור
 *    אין אימות. זה מה שמאפשר לפתח את הקונסולה מול נתונים אמיתיים
 *    של האפליקציה (npm run emu + npm run emu:seed) בלי להחזיק מפתח
 *    ייצור על המחשב — וזו הדרך הנכונה לבדוק שינוי לפני שנוגעים בייצור.
 */
const emulatorHost = process.env.FIREBASE_DATABASE_EMULATOR_HOST ?? null;
const projectId =
  process.env.ADMIN_PROJECT_ID ?? process.env.GCLOUD_PROJECT ?? process.env.VITE_FB_PROJECT_ID ?? null;

export const config = {
  port: Number(process.env.ADMIN_PORT ?? 5190),
  webPort: Number(process.env.ADMIN_WEB_PORT ?? 5199),
  host: '127.0.0.1',
  serviceAccountPath: existsSync(saPath) ? saPath : null,
  databaseURL: process.env.ADMIN_DATABASE_URL ?? process.env.VITE_FB_DATABASE_URL ?? null,
  emulatorHost,
  projectId,
  /** שורש הנתונים הפרטיים של הקונסולה בתוך RTDB. */
  consoleRoot: 'adminConsole',
  /** אמולטור, או service account + databaseURL. אחרת — מצב הדגמה. */
  get mode() {
    if (this.emulatorHost && this.projectId) return 'live';
    return this.serviceAccountPath && this.databaseURL ? 'live' : 'demo';
  },
  get missing() {
    const out = [];
    if (this.emulatorHost && !this.projectId) out.push('GCLOUD_PROJECT / VITE_FB_PROJECT_ID');
    if (this.emulatorHost) return out;
    if (!this.serviceAccountPath) out.push('service-account.json (ADMIN_SERVICE_ACCOUNT)');
    if (!this.databaseURL) out.push('VITE_FB_DATABASE_URL / ADMIN_DATABASE_URL');
    return out;
  },
  /** תיאור קצר של מקור הנתונים — מוצג במסך "מערכת". */
  get source() {
    if (this.mode === 'demo') return 'נתוני הדגמה מקומיים';
    if (this.emulatorHost) return `אמולטור מקומי (${this.emulatorHost})`;
    return this.databaseURL ?? 'Firebase';
  },
};
