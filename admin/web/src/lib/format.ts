/** עיצוב מספרים, זמנים וכסף. כל מסך משתמש באלה — נקודה אחת לשינוי. */

export function shekels(agorot: number | null | undefined): string {
  const value = (agorot ?? 0) / 100;
  return `₪${value.toLocaleString('he-IL', { maximumFractionDigits: 2 })}`;
}

/**
 * ‼️ סימן נצמד למספר עם תו בידי (U+2068/U+2069): בעברית, "‎-₪12" בלי
 *    בידוד מוצג כ-"₪12-" ונקרא כאילו המינוס שייך למילה שאחריו.
 */
export function signedShekels(agorot: number): string {
  const sign = agorot > 0 ? '+' : agorot < 0 ? '-' : '';
  return `\u2068${sign}${shekels(Math.abs(agorot))}\u2069`;
}

const rtf = new Intl.RelativeTimeFormat('he', { numeric: 'auto' });
/**
 * ‼️ ליחידות גדולות numeric:'auto' מייצר "החודש שעבר" — ניסוח שמאבד את
 *    ההבדל בין 31 ל-59 יום, בדיוק ההבדל שקובע אם חדר נטוש.
 */
const rtfExact = new Intl.RelativeTimeFormat('he', { numeric: 'always' });

/** "לפני 3 דקות" — הפורמט שהופך פיד לחי. */
export function relativeTime(ts: number | null | undefined, now = Date.now()): string {
  if (!ts) return '—';
  const diff = ts - now;
  const abs = Math.abs(diff);
  const minute = 60_000;
  const hour = 3_600_000;
  const day = 86_400_000;

  if (abs < 45_000) return 'עכשיו';
  if (abs < hour) return rtf.format(Math.round(diff / minute), 'minute');
  if (abs < day) return rtf.format(Math.round(diff / hour), 'hour');
  if (abs < 30 * day) return rtf.format(Math.round(diff / day), 'day');
  if (abs < 365 * day) return rtfExact.format(Math.round(diff / (30 * day)), 'month');
  return rtfExact.format(Math.round(diff / (365 * day)), 'year');
}

export function clock(ts: number | null | undefined): string {
  if (!ts) return '—';
  return new Date(ts).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
}

export function dateTime(ts: number | null | undefined): string {
  if (!ts) return '—';
  return new Date(ts).toLocaleString('he-IL', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function dateOnly(ts: number | null | undefined): string {
  if (!ts) return '—';
  return new Date(ts).toLocaleDateString('he-IL', { day: '2-digit', month: 'short', year: 'numeric' });
}

/** כותרת יום בציר זמן: "היום" / "אתמול" / תאריך מלא. */
export function dayLabel(iso: string): string {
  const date = new Date(`${iso}T00:00:00`);
  const today = new Date();
  const diff = Math.round(
    (new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime() - date.getTime()) /
      86_400_000
  );
  if (diff === 0) return 'היום';
  if (diff === 1) return 'אתמול';
  if (diff < 7) return date.toLocaleDateString('he-IL', { weekday: 'long' });
  return date.toLocaleDateString('he-IL', { day: 'numeric', month: 'long' });
}

export function duration(ms: number | null | undefined): string {
  if (!ms || ms < 1000) return '—';
  const minutes = Math.round(ms / 60_000);
  if (minutes < 1) return 'פחות מדקה';
  if (minutes < 60) return `${minutes} דק׳`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours < 24) return rest ? `${hours} שע׳ ${rest} דק׳` : `${hours} שע׳`;
  const days = Math.round(hours / 24);
  return days === 1 ? 'יום אחד' : `${days} ימים`;
}

export function percent(value: number, total: number): number {
  if (!total) return 0;
  return Math.round((value / total) * 100);
}

export function initials(name: string): string {
  const parts = String(name ?? '').trim().split(/\s+/);
  if (!parts[0]) return '?';
  return (parts[0][0] + (parts[1]?.[0] ?? '')).toUpperCase();
}

export function pluralDays(days: number | null | undefined): string {
  if (days === null || days === undefined) return '—';
  if (days === 0) return 'היום';
  if (days === 1) return 'יום אחד';
  return `${days} ימים`;
}

export const WEEKDAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
