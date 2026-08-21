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
  tutorialSeen: 'rm:tutorial-seen',
  hintsSeen: 'rm:hints-seen',
  installPromptDismissed: 'rm:install-prompt-dismissed',
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

/** האם ההדרכה הראשונית כבר הוצגה במכשיר הזה */
export const getTutorialSeen = () => read(KEYS.tutorialSeen) === '1';
export const setTutorialSeen = (seen: boolean) => write(KEYS.tutorialSeen, seen ? '1' : null);

/**
 * מזהי הערות-הקשר (Hint) שכבר נצפו במכשיר הזה — פוטנציאלית מאות
 * מזהים, ולכן מחרוזת JSON יחידה במקום מפתח נפרד לכל הערה.
 */
export function getHintsSeen(): Set<string> {
  try {
    const raw = read(KEYS.hintsSeen);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

export function markHintSeen(id: string): void {
  const seen = getHintsSeen();
  if (seen.has(id)) return;
  seen.add(id);
  write(KEYS.hintsSeen, JSON.stringify([...seen]));
}

/** האם באנר "התקינו את האפליקציה" בדשבורד כבר נסגר במכשיר הזה */
export const getInstallPromptDismissed = () => read(KEYS.installPromptDismissed) === '1';
export const setInstallPromptDismissed = () => write(KEYS.installPromptDismissed, '1');

/** ניקוי מלא — נקרא ביציאה מהחשבון */
export function clearPrefs(): void {
  write(KEYS.lastRoom, null);
  // האימייל נשאר בכוונה: הוא לא סוד, והוא חוסך הקלדה בכניסה הבאה
  // tutorialSeen, hintsSeen ו-installPromptDismissed נשארים גם הם — אין
  // סיבה להטריד משתמש חוזר בדברים שכבר ראה/סגר, רק כי הוא התנתק והתחבר
  // שוב באותו מכשיר
}
