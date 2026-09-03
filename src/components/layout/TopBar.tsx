import { useNavigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import { ChevronIcon } from '../ui/icons';

/**
 * כותרת עליונה דביקה.
 * ה-safe-top מרפד מתחת ל-Dynamic Island / הנאץ' — בלעדיו הכותרת נחתכת.
 */
export function TopBar({
  title,
  subtitle,
  back,
  actions,
}: {
  title: string;
  subtitle?: ReactNode;
  /** להציג חץ חזרה */
  back?: boolean | string;
  actions?: ReactNode;
}) {
  const navigate = useNavigate();

  return (
    <header
      className="sticky top-0 z-40 border-b border-ink-200/70 bg-surface/85
                 backdrop-blur-xl backdrop-saturate-150"
      style={{ paddingTop: 'var(--safe-top)' }}
    >
      <div className="mx-auto flex h-[var(--header-height)] max-w-lg items-center gap-1 px-2">
        {back && (
          <button
            onClick={() => (typeof back === 'string' ? navigate(back) : navigate(-1))}
            aria-label="חזרה"
            className="tap grid shrink-0 place-items-center rounded-full text-ink-500
                       transition hover:bg-ink-100 hover:text-ink-800"
          >
            {/* ‼️ ה-SVG *אינו* מתהפך לבד עם dir — אין לדפדפן שום מנגנון
                כזה. ההיפוך כאן הוא rotate-180 מפורש, וזה מה שגורם לחץ
                להצביע ימינה ב-RTL. ההערה הקודמת טענה את ההפך, ולפיה
                הסרת ה-rotate-180 הייתה נראית כמו ניקוי בטוח. */}
            <ChevronIcon width={22} height={22} className="rotate-180" />
          </button>
        )}

        <div className={`min-w-0 flex-1 animate-header-in ${back ? '' : 'ps-2'}`}>
          <h1 className="truncate text-lg font-extrabold leading-tight tracking-tight text-ink-900">
            {title}
          </h1>
          {subtitle && (
            <div className="truncate text-[13px] font-medium leading-snug text-ink-500">
              {subtitle}
            </div>
          )}
        </div>

        {actions && <div className="flex shrink-0 items-center gap-0.5 pe-1">{actions}</div>}
      </div>
    </header>
  );
}
