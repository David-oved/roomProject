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
