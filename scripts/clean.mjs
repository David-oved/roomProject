#!/usr/bin/env node
/**
 * ניקוי dist לפני בנייה.
 *
 * emptyOutDir של Vite לא מנקה בסביבה הזו (התיקייה מסונכרנת ע"י OneDrive,
 * שמחזיק ידיות פתוחות לקבצים). בלי ניקוי, נכסים ישנים נערמים ונכנסים
 * ל-precache של ה-Service Worker — המשתמש מוריד מאות KB מיותרים.
 */
import { rmSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const dist = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist');

if (existsSync(dist)) {
  rmSync(dist, { recursive: true, force: true, maxRetries: 5, retryDelay: 120 });
  console.log('cleaned dist/');
} else {
  console.log('dist/ already clean');
}
