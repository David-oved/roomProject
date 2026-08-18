/**
 * תרגום שגיאות Firebase להודעות שמשתמש קצה יכול להבין.
 *
 * בלי זה המשתמש רואה "permission_denied" — מחרוזת שלא אומרת לו כלום,
 * לא מסבירה מה קרה, ולא רומזת מה לעשות עכשיו.
 */
const DB_MESSAGES: Record<string, string> = {
  permission_denied: 'אין הרשאה לבצע את הפעולה. נסו לרענן את הדף.',
  PERMISSION_DENIED: 'אין הרשאה לבצע את הפעולה. נסו לרענן את הדף.',
  unavailable: 'השירות אינו זמין כרגע. נסו שוב בעוד רגע.',
  'network-error': 'אין חיבור לאינטרנט',
  disconnected: 'החיבור לשרת נותק. נסו שוב.',
  'max-retries': 'הפעולה לא הושלמה. נסו שוב.',
  overridden: 'הפעולה בוטלה. נסו שוב.',
};

/** הודעה קריאה לכל שגיאה שמגיעה מהשירותים. */
export function friendlyError(err: unknown): string {
  const raw = (err as Error)?.message ?? '';
  const code = (err as { code?: string })?.code ?? '';

  for (const key of Object.keys(DB_MESSAGES)) {
    if (code === key || raw === key || raw.includes(key)) return DB_MESSAGES[key];
  }

  // שגיאות שאנחנו עצמנו זרקנו כבר מנוסחות בעברית
  if (raw && /[֐-׿]/.test(raw)) return raw;

  return 'משהו השתבש. נסו שוב.';
}
