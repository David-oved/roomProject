#!/usr/bin/env node
/**
 * שחרור גרסה חדשה.
 *
 * מעדכן במקום אחד את public/version.json ואת package.json, כדי שלא ייתכן
 * מצב שבו הם לא תואמים — וזה בדיוק המצב שגורם ללולאת עדכון אצל המשתמש.
 *
 *   npm run release -- 1.0.1
 *   npm run release -- 1.0.1 "תיקון באג בחלוקת הוצאות"
 *   npm run release -- 1.0.1 "תיקון קריטי" --force
 *   npm run release -- patch                 (מעלה אוטומטית: 1.0.0 → 1.0.1)
 *   npm run release -- minor --force
 *
 * הדגל --force מפעיל forceUpdate=true: כל משתמש שייכנס לאפליקציה יעודכן
 * מיידית, בלי שאלה. השתמשו בו רק לתיקונים קריטיים.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const versionPath = join(root, 'public', 'version.json');
const pkgPath = join(root, 'package.json');

const args = process.argv.slice(2);
const force = args.includes('--force');
const positional = args.filter((a) => !a.startsWith('--'));

const manifest = JSON.parse(readFileSync(versionPath, 'utf8'));
const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));

// ── קביעת הגרסה החדשה ──
const bumpKeywords = { major: 0, minor: 1, patch: 2 };
let next = positional[0];

if (!next) {
  console.error('❌ חסר מספר גרסה.\n   דוגמה: npm run release -- 1.0.1 "מה חדש"');
  process.exit(1);
}

if (next in bumpKeywords) {
  const parts = manifest.version.split('.').map(Number);
  const idx = bumpKeywords[next];
  if (parts.length !== 3 || parts.some(Number.isNaN)) {
    console.error(`❌ לא ניתן להעלות אוטומטית מגרסה "${manifest.version}"`);
    process.exit(1);
  }
  parts[idx] += 1;
  for (let i = idx + 1; i < 3; i++) parts[i] = 0;
  next = parts.join('.');
}

if (!/^\d+\.\d+\.\d+/.test(next)) {
  console.error(`❌ מספר גרסה לא תקין: "${next}". הפורמט הנדרש: 1.0.1`);
  process.exit(1);
}

const title = positional[1] || manifest.title || 'עדכון';
const notes = positional.slice(2);

// ── כתיבה ──
const updated = {
  version: next,
  releasedAt: new Date().toISOString().slice(0, 10),
  forceUpdate: force,
  title,
  notes: notes.length > 0 ? notes : manifest.notes || [],
};

writeFileSync(versionPath, JSON.stringify(updated, null, 2) + '\n', 'utf8');

pkg.version = next;
writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf8');

// ── סיכום ──
console.log(`\n✅ הגרסה עודכנה: ${manifest.version} → ${next}`);
console.log(`   כותרת : ${title}`);
console.log(`   כפוי  : ${force ? '🔴 כן — כל המשתמשים יעודכנו מיידית' : '⚪ לא — יוצג באנר'}`);
if (updated.notes.length) {
  console.log('   שינויים:');
  updated.notes.forEach((n) => console.log(`     • ${n}`));
}
console.log('\nהצעד הבא:');
console.log('   git add -A && git commit -m "release: ' + next + '" && git push');
console.log('   (ה-GitHub Action יבנה ויפרוס אוטומטית)\n');
