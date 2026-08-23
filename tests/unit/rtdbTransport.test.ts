import { createRequire } from 'node:module';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * ═══════════════════════════════════════════════════════════════════
 *  התנהגות המובילים של RTDB — נורית אזהרה על ה-SDK
 * ═══════════════════════════════════════════════════════════════════
 *
 *  הבדיקה הזו לא בודקת קוד שלנו. היא שומרת על *ההנחה* שעליה נשענת
 *  שורת ה-script-src ב-index.html, ובלעדיה אין שום דבר בפרויקט שיסביר
 *  למה המקור הזה נמצא שם — ומישהו ימחק אותו כ"מיותר".
 *
 *  ── מה קרה בפועל ──────────────────────────────────────────────────
 *
 *  משתמשי גלקסי שלא בכרום (Samsung Internet) דיווחו על מסך טעינה
 *  אינסופי. השרשרת:
 *
 *   1. הדפדפן חוסם localStorage (מצב סודי, "חסימת קובצי Cookie ונתוני
 *      אתרים", הגנת מעקב מחמירה) → PersistentStorage של ה-SDK נופל
 *      ל-MemoryStorage, ו-isInMemoryStorage הופך ל-true.
 *
 *   2. WebSocketConnection.previouslyFailed() מחזיר true על סמך הדגל
 *      הזה לבדו — בלי שאף WebSocket נכשל אי פעם.
 *
 *   3. TransportManager.initTransports_ מסיק ש"אסור לדלג על long-poll"
 *      ובוחר את BrowserPollConnection כמוביל *הראשון*.
 *
 *   4. BrowserPollConnection אינו fetch — הוא מזריק תגי <script> אל
 *      https://<db>.firebaseio.com/.lp?... בתוך iframe מקומי, שיורש את
 *      ה-CSP של הדף. script-src חסם אותם.
 *
 *   5. onValue לא מקבל נתונים — וגם לא שגיאה. `loading` נשאר true
 *      לנצח, בכל מסך. ספינר אינסופי, בלי שום עקבות.
 *
 *  אותה מלכודת סוגרת גם על משתמש רגיל שה-WebSocket שלו נכשל פעם אחת:
 *  הדגל previous_websocket_failure נשמר ב-localStorage, ומאותו רגע כל
 *  טעינה מתחילה במוביל החסום.
 *
 *  אם שדרוג של firebase יפיל את אחת ההנחות האלה — הבדיקה תיפול, וזה
 *  הרגע לבדוק מחדש אם עדיין צריך את המקור ב-script-src.
 */

const require = createRequire(import.meta.url);

/**
 * ‼️ דרך package.json ולא בנתיב ישיר ל-dist: ה-"exports" של החבילה
 *    חוסם require.resolve על קבצים פנימיים, ושם הקובץ בתוך dist
 *    משתנה בין גרסאות. כך הבדיקה שורדת שדרוג תלויות.
 */
const SDK_DIR = dirname(require.resolve('@firebase/database/package.json'));
const SDK_SOURCE = readdirSync(join(SDK_DIR, 'dist'))
  .filter((f) => f.startsWith('index.esm') && f.endsWith('.js'))
  .map((f) => readFileSync(join(SDK_DIR, 'dist', f), 'utf8'))
  .join('\n');

describe('מובילי RTDB — ההנחות שמאחורי ה-script-src', () => {
  it('חסימת localStorage מסומנת כ-isInMemoryStorage', () => {
    // MemoryStorage — מה שנוצר כשגישה ל-localStorage נכשלת
    expect(SDK_SOURCE).toMatch(/class MemoryStorage[\s\S]{0,200}isInMemoryStorage = true/);
  });

  it('previouslyFailed() מסתמך על isInMemoryStorage — גם בלי כישלון אמיתי', () => {
    expect(SDK_SOURCE).toMatch(
      /previouslyFailed\(\)\s*\{[\s\S]{0,300}PersistentStorage\.isInMemoryStorage/
    );
  });

  it('previouslyFailed() מוציא את WebSocket ממסלול העקיפה של long-poll', () => {
    // isSkipPollConnection = isWebSocketsAvailable && !previouslyFailed()
    expect(SDK_SOURCE).toMatch(
      /isSkipPollConnection\s*=\s*isWebSocketsAvailable\s*&&\s*!WebSocketConnection\.previouslyFailed\(\)/
    );
  });

  it('כשלא מדלגים — BrowserPollConnection הוא המוביל הראשון ברשימה', () => {
    // ALL_TRANSPORTS מוחזרת לפי סדר, ו-initialTransport() לוקח את transports_[0]
    expect(SDK_SOURCE).toMatch(
      /get ALL_TRANSPORTS\(\)\s*\{\s*return \[BrowserPollConnection, WebSocketConnection\]/
    );
    expect(SDK_SOURCE).toMatch(/initialTransport\(\)\s*\{[\s\S]{0,120}this\.transports_\[0\]/);
  });

  it('BrowserPollConnection טוען סקריפטים — ולכן script-src הוא שחוסם אותו', () => {
    // התג נוצר בתוך ה-iframe, ולכן כפוף למדיניות הדף
    expect(SDK_SOURCE).toMatch(/this\.myIFrame\.doc\.createElement\('script'\)/);
    // ה-iframe הוא מקומי (בלי src חיצוני) — ולכן יורש את ה-CSP של הדף
    expect(SDK_SOURCE).toMatch(/createIFrame_\(\)\s*\{\s*const iframe = document\.createElement\('iframe'\)/);
  });

  it('נקודת הקצה של ה-long-poll יושבת על מארח ה-RTDB', () => {
    expect(SDK_SOURCE).toContain("'/.lp?'");
  });
});
