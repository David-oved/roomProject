import type { ReactNode } from 'react';
import { MailIcon, WarningIcon } from './icons';

export function EmptyState({
  icon = <MailIcon width={30} height={30} />,
  title,
  body,
  action,
}: {
  icon?: ReactNode;
  title: string;
  body?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-14 text-center">
      <div aria-hidden className="text-ink-300">
        {icon}
      </div>
      <h3 className="text-base font-bold text-ink-800">{title}</h3>
      {body && <p className="max-w-xs text-sm leading-relaxed text-ink-500">{body}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

/**
 * מצב שגיאה בטעינת מסך. ‼️ הכותרת אומרת *מה* קרה, ה-body מקבל את
 * ה*למה* הספציפי מ-`friendlyError` (אין הרשאה / אין חיבור / השירות
 * עמוס…) ונופל להסבר קונקרטי, והכפתור הוא ה*מה לעשות עכשיו* — שלוש
 * השאלות שמסך שגיאה חייב לענות עליהן (docs: חלק ג' של מסמך ה-UX).
 * לא "משהו השתבש".
 */
export function ErrorState({ message, onRetry }: { message?: string; onRetry?: () => void }) {
  return (
    <EmptyState
      icon={<WarningIcon width={30} height={30} />}
      title="לא הצלחנו לטעון את המסך"
      body={message || 'ייתכן שהחיבור לאינטרנט נפל לרגע. אפשר לרענן ולנסות שוב.'}
      action={
        onRetry && (
          <button
            onClick={onRetry}
            className="tap rounded-xl border border-ink-200 bg-surface px-4 text-sm font-semibold
                       text-ink-700 transition hover:bg-ink-50"
          >
            רענון
          </button>
        )
      }
    />
  );
}
