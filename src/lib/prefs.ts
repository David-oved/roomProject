/**
 * העדפות מקומיות קטנות — מה שחוסך למשתמש הקלדה חוזרת.
 *
 * ⚠️ נשמר כאן **רק מה שאינו רגיש**: אימייל אחרון וחדר אחרון.
 * לעולם לא סיסמאות, לא טוקנים, ולא נתוני חדר — אלה במטמון המוצפן
 * של Firebase או ב-IndexedDB שמנוקה ביציאה.
 */

const KEYS = {
  lastEmail: 'rm:last-email',
  lastRoom: 'rm:last-room',
} as const;

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null; // מצב פרטי
  }
}

function write(key: string, value: string | null): void {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    /* מתעלמים — זו נוחות, לא תלות */
  }
}

/** האימייל האחרון שהתחבר בהצלחה במכשיר הזה */
export const getLastEmail = () => read(KEYS.lastEmail) ?? '';
export const setLastEmail = (email: string) => write(KEYS.lastEmail, email.trim() || null);

/** החדר האחרון שנצפה — כדי לחזור אליו ישירות בכניסה הבאה */
export const getLastRoom = () => read(KEYS.lastRoom);
export const setLastRoom = (code: string | null) => write(KEYS.lastRoom, code);

/** ניקוי מלא — נקרא ביציאה מהחשבון */
export function clearPrefs(): void {
  write(KEYS.lastRoom, null);
  // האימייל נשאר בכוונה: הוא לא סוד, והוא חוסך הקלדה בכניסה הבאה
}
