import { useNavigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import { ChevronIcon } from '../ui/icons';

/**
 * כותרת עליונה דביקה.
 * ה-safe-top מרפד מתחת ל-Dynamic Island / הנאץ' — בלעדיו הכותרת נחתכת.
 */
export function TopBar({
  title,
  back,
  actions,
}: {
  title: string;
  /** להציג חץ חזרה */
  back?: boolean | string;
  actions?: ReactNode;
}) {
  const navigate = useNavigate();

  return (
    <header
      className="sticky top-0 z-40 border-b border-ink-200/70 bg-surface"
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

        <div className={`min-w-0 flex-1 ${back ? '' : 'ps-2'}`}>
          {/* ‼️ font-sans מפורש — בלעדיו ה-h1 יורש font-serif (Frank Ruhl
              Libre) מהכלל הגורף על h1/h2 ב-index.css, שנועד לכותרות תוכן
              (h1/h2 בתוך מסכים) ולא לכותרת המסך המשותפת. התוצאה בלי
              העקיפה: גופן סריף דקורטיבי לא-קשור על כל כותרת מסך באפליקציה. */}
          <h1 className="truncate font-sans text-2xl font-extrabold leading-tight tracking-tight text-ink-900">
            {title}
          </h1>
        </div>

        {actions && <div className="flex shrink-0 items-center gap-0.5 pe-1">{actions}</div>}
      </div>
    </header>
  );
}
