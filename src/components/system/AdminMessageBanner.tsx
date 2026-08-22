import { Link } from 'react-router-dom';
import { useAdminMessages } from '../../hooks/useAdminMessages';
import { formatRelativeTime } from '../../lib/format';
import { ADMIN_MESSAGE_KIND_ICON } from '../../lib/adminMessageIcons';

const TONE = {
  info: 'border-brand-200 bg-brand-50 text-brand-900',
  success: 'border-emerald-200 bg-emerald-50 text-emerald-900',
  warning: 'border-amber-200 bg-amber-50 text-amber-900',
  error: 'border-rose-200 bg-rose-50 text-rose-900',
  maintenance: 'border-amber-200 bg-amber-50 text-amber-900',
} as const;

/**
 * הודעה חדשה ממנהל המערכת — כרטיס במסך הבית.
 *
 * ‼️ אינו מסמן "נקרא" בעצמו. סימון קריאה קורה רק כשההודעה נפתחת
 *    בפועל בתיבה, אחרת מדד "זמן עד קריאה" בקונסולת הניהול היה מודד
 *    את המהירות שבה המשתמש פתח את האפליקציה, ולא את מה שקרא.
 *
 * ‼️ אינו ניתן לסגירה: הודעה מהמנהל היא לרוב תחזוקה או חסימה קרובה,
 *    והדרך לגרום לה להיעלם היא לפתוח אותה — לא להבריש אותה הצידה.
 */
export function AdminMessageBanner() {
  const { latestUnread, unreadCount } = useAdminMessages();
  if (!latestUnread) return null;

  const tone = TONE[latestUnread.kind] ?? TONE.info;
  const Icon = ADMIN_MESSAGE_KIND_ICON[latestUnread.kind] ?? ADMIN_MESSAGE_KIND_ICON.info;

  return (
    <Link
      to="/messages"
      className={`mt-3 flex items-start gap-2.5 rounded-2xl border p-3.5 transition
                  active:scale-[.99] ${tone}`}
    >
      <span aria-hidden className="mt-0.5 shrink-0">
        <Icon width={19} height={19} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="truncate text-sm font-bold">{latestUnread.title}</span>
          {unreadCount > 1 && (
            <span className="shrink-0 rounded-full bg-surface/70 px-2 py-0.5 text-[11px] font-bold">
              +{unreadCount - 1}
            </span>
          )}
        </span>
        <span className="mt-0.5 block truncate text-xs opacity-90">{latestUnread.body}</span>
        <span className="mt-1 block text-[11px] opacity-75">
          ממנהל המערכת · {latestUnread.sentAt ? formatRelativeTime(latestUnread.sentAt) : ''} · לקריאה
        </span>
      </span>
    </Link>
  );
}
