/**
 * שומר הכתיבה.
 *
 * מודל האופליין של האפליקציה: **קריאה בלבד**. כשאין רשת המשתמש רואה
 * את הנתונים מהמטמון, אבל אף פעולה שדורשת את הענן אינה מתבצעת.
 *
 * זהו מודול-מצב פשוט ולא React Context, כי שכבת ה-services לא מכירה
 * React (ראו docs/01-architecture.md — חוק הייבוא).
 */

export class OfflineError extends Error {
  readonly code = 'app/offline';
  constructor(action?: string) {
    super(action ? `לא ניתן ${action} ללא חיבור לאינטרנט` : 'פעולה זו דורשת חיבור לאינטרנט');
    this.name = 'OfflineError';
  }
}

let online = true;

/** נקרא מ-ConnectionProvider בכל שינוי במצב החיבור. */
export function setOnlineState(value: boolean): void {
  online = value;
}

export function getOnlineState(): boolean {
  return online;
}

/**
 * ‼️ חובה בשורה הראשונה של כל פונקציית service שכותבת.
 * @param action תיאור הפעולה בלשון מקור, למשל 'לדווח על מוצר'
 */
export function assertOnline(action?: string): void {
  if (!online) throw new OfflineError(action);
}

/* ═══════════ חדר מאורכב ═══════════ */

/**
 * חדר שמנהל המערכת העביר לארכיון (metadata/archivedAt).
 *
 * ‼️ אותו דפוס בדיוק כמו מצב החיבור למעלה, ומאותה סיבה: שכבת ה-services
 *    אינה מכירה React, ולכן ה-Provider דוחף לכאן את המצב במקום שכל
 *    פונקציה תקבל אותו כפרמטר. RoomProvider קורא ל-setRoomArchived.
 *
 * ‼️ נשמר קוד החדר ולא דגל בוליאני בלבד: המשתמש יכול להיות בכמה
 *    חדרים, ובלי ההצמדה לקוד חדר מאורכב אחד היה חוסם כתיבה גם בחדר
 *    פעיל שנפתח באותה לשונית.
 */
let archivedRoomCode: string | null = null;

export function setRoomArchived(code: string | null, archived: boolean): void {
  archivedRoomCode = archived ? code : null;
}

export function isRoomArchived(code: string | null | undefined): boolean {
  return !!code && archivedRoomCode === code;
}

export class ArchivedRoomError extends Error {
  readonly code = 'app/room-archived';
  constructor(action?: string) {
    super(
      action
        ? `לא ניתן ${action} — החדר הועבר לארכיון על ידי מנהל המערכת`
        : 'החדר הועבר לארכיון וניתן לצפייה בלבד'
    );
    this.name = 'ArchivedRoomError';
  }
}

/**
 * ‼️ בשורה שאחרי assertOnline בכל כתיבה לתוך חדר.
 *
 * זו חוויית משתמש, לא אבטחה: האכיפה האמיתית היא שקונסולת הניהול
 * מסירה את הגישה. מה שהבדיקה הזו נותנת היא הודעה שמסבירה *למה*
 * הפעולה נכשלה, במקום שגיאת הרשאות גולמית.
 */
export function assertRoomWritable(code: string, action?: string): void {
  if (isRoomArchived(code)) throw new ArchivedRoomError(action);
}
