import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * ═══════════════════════════════════════════════════════════════════
 *  Content-Security-Policy — שמירה על המדיניות שב-index.html
 * ═══════════════════════════════════════════════════════════════════
 *
 *  למה בדיקה ולא סתם קריאה של הקובץ: מדיניות CSP שגויה היא סוג התקלה
 *  הגרוע ביותר שאפשר לשלוח לייצור. היא לא מפילה את הבנייה, לא מפילה
 *  שום בדיקה, ובדפדפן שלנו היא בכלל לא מורגשת — היא פוגעת רק בחלק
 *  מהמשתמשים, רק במסלול קוד שאנחנו לא עוברים בו, ובלי הודעת שגיאה
 *  אחת שתגיע אלינו. בדיוק כך נולד באג מסך הטעינה האינסופי (ראו
 *  rtdbTransport.test.ts): המדיניות שכחה מקור אחד, וכל משתמש שנפל
 *  למסלול ה-long-polling של RTDB נתקע לנצח על ספינר.
 *
 *  ולכן: כל מקור שהאפליקציה באמת פונה אליו — כאן, במפורש.
 */

const INDEX_HTML = readFileSync(
  fileURLToPath(new URL('../../index.html', import.meta.url)),
  'utf8'
);

/** שולף את תוכן ה-meta של ה-CSP מתוך ה-HTML. */
function extractCspContent(html: string): string {
  const meta = html.match(
    /<meta\s+http-equiv="Content-Security-Policy"\s+content="([\s\S]*?)"\s*\/>/
  );
  if (!meta) throw new Error('לא נמצא meta של Content-Security-Policy ב-index.html');
  return meta[1];
}

/** מפרק מדיניות CSP למפה: directive → רשימת מקורות. */
function parseCsp(content: string): Record<string, string[]> {
  const policy: Record<string, string[]> = {};
  for (const raw of content.split(';')) {
    const tokens = raw.trim().split(/\s+/).filter(Boolean);
    if (tokens.length === 0) continue;
    policy[tokens[0]] = tokens.slice(1);
  }
  return policy;
}

const CSP = parseCsp(extractCspContent(INDEX_HTML));

describe('Content-Security-Policy', () => {
  it('ה-meta הוא הראשון אחרי charset — אחרת הוא לא חל על מה שמעליו', () => {
    const charsetAt = INDEX_HTML.indexOf('<meta charset');
    const cspAt = INDEX_HTML.indexOf('http-equiv="Content-Security-Policy"');
    const fontLinkAt = INDEX_HTML.indexOf('rel="preconnect" href="https://fonts.googleapis.com"');

    expect(charsetAt).toBeGreaterThan(-1);
    expect(cspAt).toBeGreaterThan(charsetAt);
    // הפונטים חייבים להיות מוצהרים *אחרי* המדיניות, אחרת היא לא חלה עליהם
    expect(fontLinkAt).toBeGreaterThan(cspAt);
  });

  it('ברירת המחדל נעולה', () => {
    expect(CSP['default-src']).toEqual(["'self'"]);
    expect(CSP['object-src']).toEqual(["'none'"]);
    expect(CSP['base-uri']).toEqual(["'none'"]);
  });

  it("אין 'unsafe-eval' — שום תלות באפליקציה לא זקוקה לו", () => {
    for (const [directive, sources] of Object.entries(CSP)) {
      expect(sources, directive).not.toContain("'unsafe-eval'");
    }
  });

  /**
   * ‼️ ליבת הבדיקה הזו — ראו rtdbTransport.test.ts להסבר המלא.
   *
   * ה-long-polling של RTDB מזריק <script src="https://<db>.firebaseio.com/
   * .lp?..."> לתוך iframe מקומי. iframe כזה יורש את מדיניות הדף, ולכן
   * script-src (ולא connect-src) הוא שמחליט אם המסלול הזה חי או מת.
   *
   * ו-long-polling אינו מסלול תיאורטי: ה-SDK בוחר בו כמסלול *ראשון* בכל
   * דפדפן שחוסם localStorage.
   */
  it('script-src מתיר את מארחי ה-RTDB — בלעדיו ה-long-polling מת והמסך תקוע', () => {
    expect(CSP['script-src']).toContain('https://*.firebaseio.com');
    expect(CSP['script-src']).toContain('https://*.firebasedatabase.app');
  });

  it('connect-src מתיר את RTDB גם ב-https וגם ב-wss', () => {
    const connect = CSP['connect-src'];
    for (const origin of [
      'https://*.firebaseio.com',
      'wss://*.firebaseio.com',
      'https://*.firebasedatabase.app',
      'wss://*.firebasedatabase.app',
    ]) {
      expect(connect, origin).toContain(origin);
    }
  });

  it('connect-src מתיר את Firebase Auth', () => {
    // identitytoolkit.googleapis.com + securetoken.googleapis.com
    expect(CSP['connect-src']).toContain('https://*.googleapis.com');
  });

  it('connect-src מתיר את Cloudinary ואת ה-Worker של הפוש', () => {
    expect(CSP['connect-src']).toContain('https://api.cloudinary.com');
    expect(CSP['connect-src']).toContain('https://res.cloudinary.com');
    expect(CSP['connect-src']).toContain('https://*.workers.dev');
  });

  it('connect-src מתיר את האמולטורים המקומיים — אחרת `npm run emu` מת', () => {
    const connect = CSP['connect-src'];
    expect(connect).toContain('http://127.0.0.1:*');
    expect(connect).toContain('ws://127.0.0.1:*');
  });

  it('הפונטים מותרים ב-style-src וב-font-src', () => {
    expect(CSP['style-src']).toContain('https://fonts.googleapis.com');
    expect(CSP['font-src']).toContain('https://fonts.gstatic.com');
  });

  it('img-src מתיר את מארחי האווטארים — כולל ההיסטוריים', () => {
    expect(CSP['img-src']).toContain('https://res.cloudinary.com');
    expect(CSP['img-src']).toContain('https://firebasestorage.googleapis.com');
  });

  it('worker-src מתיר blob: — ה-Service Worker של Workbox נזקק לו', () => {
    expect(CSP['worker-src']).toContain('blob:');
  });
});
