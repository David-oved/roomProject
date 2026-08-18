import { push, ref, serverTimestamp, set } from 'firebase/database';
import { auth, db } from '../config/firebase';

/**
 * ═══════════════════════════════════════════════════════════════════
 *  תור התראות יוצאות
 * ═══════════════════════════════════════════════════════════════════
 *
 *  הלקוח לא שולח התראות בעצמו — לשליחת Web Push דרוש המפתח הפרטי של
 *  VAPID, ומפתח שיושב בקוד צד-לקוח הוא מפתח דלוף. במקום זאת הלקוח
 *  רושם "מה קרה", ותהליך מתוזמן עם המפתח הפרטי שולח בפועל.
 *
 *  שתי רמות דחיפות, וזו ההחלטה שקובעת אם אנשים ישאירו את ההתראות
 *  דלוקות:
 *
 *   'now'    — מיידי. רק מה שהמשתמש באמת ממתין לו: הבקשה שלו אושרה,
 *              הקנייה שלו אושרה או נדחתה, מוצר בעדיפות דחופה.
 *   'digest' — נצבר לתקציר יומי אחד. כל השאר.
 *
 *  התראה על כל דיווח חלב = אנשים מכבים תוך יומיים. תקציר אחד ביום
 *  הם משאירים.
 * ═══════════════════════════════════════════════════════════════════
 */

interface OutboxDraft {
  roomCode: string;
  title: string;
  body: string;
  /** נתיב יחסי בתוך האפליקציה, למשל "/r/ABC123/items" */
  url?: string;
  /** מקבץ התראות מאותו סוג — חדשה מחליפה קודמת במקום להיערם */
  tag?: string;
  priority: 'now' | 'digest';
  /** 'room' = כל החברים הפעילים · 'user' = נמען בודד */
  audience: 'room' | 'user';
  /** נדרש כש-audience הוא 'user' */
  targetUid?: string;
  /** מי ביצע את הפעולה — לא מקבל התראה על עצמו */
  actorUid: string;
}

/**
 * כתובת ה-Worker ששולח מיידית. ריק = אין Worker, והתור נשלח רק
 * ע"י המשימה המתוזמנת.
 */
const PUSH_ENDPOINT = import.meta.env.VITE_PUSH_ENDPOINT ?? '';

/**
 * מבקש מה-Worker לשלוח עכשיו, במקום להמתין למשימה המתוזמנת.
 *
 * ‼️ "מיטב המאמץ" בלבד, ובכוונה: הרשומה כבר בתור, ולכן גם אם הקריאה
 * הזו נכשלת לגמרי — ההתראה תישלח תוך 5 דקות ע"י המשימה המתוזמנת.
 * לכן אין כאן ניסיונות חוזרים, אין המתנה, ואין הודעת שגיאה למשתמש.
 * זו האצה, לא תלות.
 */
async function requestImmediateSend(entryId: string): Promise<void> {
  if (!PUSH_ENDPOINT) return;

  try {
    const idToken = await auth.currentUser?.getIdToken();
    if (!idToken) return;

    // מגבלת זמן קצרה — אין טעם להחזיק בקשה פתוחה על משהו אופציונלי
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);

    await fetch(`${PUSH_ENDPOINT}/notify`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ idToken, entryId }),
      signal: controller.signal,
      keepalive: true,
    });

    clearTimeout(timer);
  } catch {
    // המשימה המתוזמנת תטפל
  }
}

/**
 * מוסיף התראה לתור.
 *
 * ‼️ אף פעם לא זורק. התראה היא תוספת, לא חלק מהפעולה עצמה — כישלון
 * בשליחתה לא אמור להפיל דיווח מוצר או רישום קנייה שכבר הצליחו.
 */
export async function enqueueNotification(draft: OutboxDraft): Promise<void> {
  try {
    const entry = push(ref(db, 'outbox'));
    const entryId = entry.key;

    await set(entry, {
      roomCode: draft.roomCode,
      title: draft.title.slice(0, 60),
      body: draft.body.slice(0, 160),
      ...(draft.url ? { url: draft.url.slice(0, 120) } : {}),
      ...(draft.tag ? { tag: draft.tag.slice(0, 40) } : {}),
      priority: draft.priority,
      audience: draft.audience,
      ...(draft.targetUid ? { targetUid: draft.targetUid } : {}),
      excludeUid: draft.actorUid,
      createdAt: serverTimestamp(),
    });

    // הרשומה בתור ובטוחה. מכאן ואילך זו רק שאלה של מהירות.
    if (entryId) void requestImmediateSend(entryId);
  } catch {
    // ההתראה לא נשלחה, אבל הפעולה עצמה כבר הצליחה — וזה מה שחשוב
  }
}
