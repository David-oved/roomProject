import { format, formatDistanceToNowStrict, isToday, isYesterday } from 'date-fns';
import { he } from 'date-fns/locale';

/* ═════════════════════════ כסף ═════════════════════════ */

/** ₪12.34 → 1234 אגורות */
export const toAgorot = (shekels: number): number => Math.round(shekels * 100);

/** 1234 אגורות → 12.34 */
export const toShekels = (agorot: number): number => agorot / 100;

/** 1234 → "₪12.34" */
export function formatILS(agorot: number): string {
  return new Intl.NumberFormat('he-IL', {
    style: 'currency',
    currency: 'ILS',
    minimumFractionDigits: 2,
  }).format(agorot / 100);
}

/** ללא סימן, לשימוש כשהסימן מוצג בנפרד: 1234 → "12.34" */
export function formatAmount(agorot: number): string {
  return new Intl.NumberFormat('he-IL', { minimumFractionDigits: 2 }).format(
    Math.abs(agorot) / 100
  );
}

/* ═════════════════════════ תאריכים ═════════════════════════ */

/** "לפני 5 דקות" */
export function formatRelativeTime(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60_000) return 'הרגע';
  return formatDistanceToNowStrict(new Date(ts), { locale: he, addSuffix: true });
}

/** "היום 14:32" / "אתמול 09:15" / "12 באוגוסט" */
export function formatSmartDate(ts: number): string {
  const d = new Date(ts);
  if (isToday(d)) return `היום ${format(d, 'HH:mm')}`;
  if (isYesterday(d)) return `אתמול ${format(d, 'HH:mm')}`;
  return format(d, 'd בMMMM', { locale: he });
}

/** "12 באוגוסט 2026" */
export function formatFullDate(ts: number): string {
  return format(new Date(ts), 'd בMMMM yyyy', { locale: he });
}

/** "14:32" */
export function formatTime(ts: number): string {
  return format(new Date(ts), 'HH:mm');
}

/** מספר ימים שעברו מאז חותמת זמן */
export function daysSince(ts: number): number {
  return Math.floor((Date.now() - ts) / 86_400_000);
}
