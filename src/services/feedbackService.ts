import { push, ref, serverTimestamp, set } from 'firebase/database';
import { db } from '../config/firebase';
import { assertOnline } from './guard';
import { APP_VERSION } from '../lib/version';
import { rememberSentFeedback } from '../lib/prefs';
import type { FeedbackType } from '../types/models';

/**
 * ═══════════════════════════════════════════════════════════════
 *  משוב למנהל המערכת
 * ═══════════════════════════════════════════════════════════════
 *  ערוץ חד-כיווני: המשתמש כותב ל-feedback/{id}, וקונסולת הניהול
 *  קוראת דרך Admin SDK. התשובה חוזרת כהודעה אישית ב-adminMessages.
 *  החוזה המלא: docs/13-admin-console.md.
 *
 *  ‼️ הרשומה נעולה אחרי היצירה — הכללים מתירים יצירה בלבד. זו עדות
 *     של המשתמש, ומה שהמנהל עושה איתה נשמר בצומת אחר לגמרי.
 * ═══════════════════════════════════════════════════════════════
 */

export const SUBJECT_MIN = 3;
export const SUBJECT_MAX = 80;
export const BODY_MAX = 2000;

export interface FeedbackDraft {
  type: FeedbackType;
  subject: string;
  body: string;
}

export class FeedbackValidationError extends Error {
  readonly field: 'subject' | 'body';
  constructor(field: 'subject' | 'body', message: string) {
    super(message);
    this.field = field;
    this.name = 'FeedbackValidationError';
  }
}

/**
 * בדיקה מקומית לפני שליחה.
 *
 * ‼️ אותם ספים בדיוק כמו ב-database.rules.json. כשהם יוצאים מסנכרון,
 *    המשתמש מקבל "PERMISSION_DENIED" במקום הסבר — שגיאה שנראית כמו
 *    תקלה במערכת ולא כמו טופס שצריך לתקן.
 */
export function validateFeedback(draft: FeedbackDraft): void {
  const subject = draft.subject.trim();
  const body = draft.body.trim();

  if (subject.length < SUBJECT_MIN) {
    throw new FeedbackValidationError('subject', `הנושא קצר מדי — לפחות ${SUBJECT_MIN} תווים`);
  }
  if (subject.length > SUBJECT_MAX) {
    throw new FeedbackValidationError('subject', `הנושא ארוך מדי — עד ${SUBJECT_MAX} תווים`);
  }
  if (body.length === 0) {
    throw new FeedbackValidationError('body', 'צריך לכתוב מה קרה');
  }
  if (body.length > BODY_MAX) {
    throw new FeedbackValidationError('body', `התיאור ארוך מדי — עד ${BODY_MAX} תווים`);
  }
}

/**
 * מזהה את המכשיר מתוך user agent.
 *
 * לא ניתוח מדויק ולא ספרייה — רק מספיק כדי לענות על "באיזה מכשיר
 * ובאיזה דפדפן זה קרה", שזו השאלה הראשונה בכל דיווח תקלה. ערכים
 * קצרים בכוונה: הכללים מגבילים כל שדה ל-60 תווים.
 */
export function describeEnvironment(): Record<string, string> {
  const ua = typeof navigator === 'undefined' ? '' : navigator.userAgent;

  const browser =
    /Edg\//.test(ua) ? 'Edge'
    : /OPR\//.test(ua) ? 'Opera'
    : /Chrome\//.test(ua) && !/Chromium/.test(ua) ? 'Chrome'
    : /Firefox\//.test(ua) ? 'Firefox'
    : /Safari\//.test(ua) ? 'Safari'
    : 'אחר';

  const os =
    /iPhone|iPad|iPod/.test(ua) ? 'iOS'
    : /Android/.test(ua) ? 'Android'
    : /Windows/.test(ua) ? 'Windows'
    : /Mac OS X/.test(ua) ? 'macOS'
    : /Linux/.test(ua) ? 'Linux'
    : 'אחר';

  const standalone =
    typeof window !== 'undefined' &&
    (window.matchMedia?.('(display-mode: standalone)').matches ||
      (window.navigator as { standalone?: boolean }).standalone === true);

  const env: Record<string, string> = {
    browser,
    os,
    appVersion: APP_VERSION,
    // ‼️ "מותקן למסך הבית" הוא ההבדל בין דיווח שאפשר לשחזר לבין דיווח
    //    שלא: חלק מהתקלות (Service Worker, גרסה תקועה) קורות רק שם.
    installed: standalone ? 'כן' : 'לא',
  };

  if (typeof window !== 'undefined') {
    env.screen = `${window.innerWidth}×${window.innerHeight}`;
  }
  if (typeof navigator !== 'undefined' && navigator.language) {
    env.language = navigator.language.slice(0, 20);
  }

  return env;
}

/**
 * שולח משוב. מחזיר את מזהה הרשומה.
 *
 * ‼️ serverTimestamp ולא Date.now(): שעון המכשיר עשוי להיות מוטה
 *    בשעות, ואז המשוב נוחת בתיבה של המנהל במקום הלא נכון בזמן —
 *    או "לפני שבוע" ביום שנשלח.
 */
export async function sendFeedback(
  roomCode: string,
  userId: string,
  draft: FeedbackDraft
): Promise<string> {
  assertOnline('לשלוח משוב');
  validateFeedback(draft);

  const entry = push(ref(db, 'feedback'));
  if (!entry.key) throw new Error('לא הצלחנו ליצור את הפנייה. נסו שוב.');

  const subject = draft.subject.trim();

  await set(entry, {
    roomCode,
    userId,
    type: draft.type,
    subject,
    body: draft.body.trim(),
    createdAt: serverTimestamp(),
    environment: describeEnvironment(),
  });

  // רשומה מקומית בלבד: הכללים מתירים קריאה של פנייה בודדת אך לא של
  // כל האוסף, ולכן "מה שלחתי" נשען על המכשיר ולא על שאילתה.
  rememberSentFeedback({
    id: entry.key,
    roomCode,
    type: draft.type,
    subject,
    createdAt: Date.now(),
  });

  return entry.key;
}
