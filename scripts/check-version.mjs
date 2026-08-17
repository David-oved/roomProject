#!/usr/bin/env node
/**
 * בדיקת שפיות לפני פריסה.
 *
 * אם public/version.json ו-package.json לא מסכימים על מספר הגרסה,
 * המשתמשים ייכנסו ללולאת "יש עדכון" אינסופית: השרת מכריז על גרסה
 * שה-build כלל לא מכיל. עדיף להיכשל כאן מאשר בייצור.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const manifest = JSON.parse(readFileSync(join(root, 'public', 'version.json'), 'utf8'));
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));

const problems = [];

if (typeof manifest.version !== 'string' || !/^\d+\.\d+\.\d+/.test(manifest.version)) {
  problems.push(`version.json: מספר גרסה לא תקין ("${manifest.version}")`);
}

if (manifest.version !== pkg.version) {
  problems.push(
    `אי-התאמה: version.json = "${manifest.version}" אבל package.json = "${pkg.version}"\n` +
      `   תיקון: npm run release -- ${manifest.version}`
  );
}

if (typeof manifest.forceUpdate !== 'boolean') {
  problems.push('version.json: forceUpdate חייב להיות true או false');
}

if (problems.length) {
  console.error('\n❌ בדיקת הגרסה נכשלה:\n');
  problems.forEach((p) => console.error('   • ' + p));
  console.error('');
  process.exit(1);
}

console.log(
  `✅ הגרסה תקינה: ${manifest.version}` +
    (manifest.forceUpdate ? '  🔴 עדכון כפוי מופעל' : '')
);
