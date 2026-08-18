#!/usr/bin/env node
/**
 * חותם את מזהה הבנייה לתוך dist/version.json — רץ אחרי vite build.
 *
 * למה: מספר הגרסה מתעדכן ידנית, ולכן אפשר לשכוח אותו. אם שוכחים,
 * מנגנון העדכון לא מזהה כלום — ומי שכבר התקין את ה-PWA נשאר תקוע עם
 * קבצים ישנים שה-Service Worker מגיש לו מהמטמון.
 *
 * מזהה הבנייה נגזר מה-commit ולכן משתנה בכל פריסה, בלי לזכור כלום.
 * הוא נכתב רק ל-dist, לא ל-public — כדי שהמאגר לא יתלכלך בכל בנייה.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const target = join(root, 'dist', 'version.json');

if (!existsSync(target)) {
  console.error('❌ dist/version.json לא קיים. הריצו build קודם.');
  process.exit(1);
}

function buildId() {
  if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA.slice(0, 12);
  try {
    return execSync('git rev-parse --short=12 HEAD', { encoding: 'utf8' }).trim();
  } catch {
    return 'dev-' + Date.now().toString(36);
  }
}

const manifest = JSON.parse(readFileSync(target, 'utf8'));
manifest.buildId = buildId();
manifest.builtAt = new Date().toISOString();

writeFileSync(target, JSON.stringify(manifest, null, 2) + '\n', 'utf8');

console.log(
  `stamped dist/version.json  version=${manifest.version}  buildId=${manifest.buildId}` +
    (manifest.forceUpdate ? '  [FORCE UPDATE]' : '')
);
