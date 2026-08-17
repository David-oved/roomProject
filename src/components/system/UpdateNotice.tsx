import { useUpdate } from '../../store/UpdateContext';

/**
 * שני מצבי תצוגה:
 *  1. עדכון כפוי (forceUpdate: true) — מסך מלא חוסם, בלי אפשרות ביטול.
 *  2. עדכון רגיל — כרטיס שצף מעל הניווט התחתון, ניתן לדחייה.
 */
export function UpdateNotice() {
  const { status, remote, current, dismissed, dismiss, applyUpdate, forceLoopDetected } =
    useUpdate();

  // ── 1. עדכון מתבצע — מסך חוסם ──
  if (status === 'updating') {
    return (
      <div
        role="alertdialog"
        aria-live="assertive"
        aria-label="מתבצע עדכון תוכנה"
        className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-4
                   bg-gradient-to-b from-brand-50 to-ink-50 px-8 text-center"
      >
        <div className="relative">
          <div className="text-5xl">🔄</div>
          <span className="absolute -inset-4 animate-ping rounded-full bg-brand-200/40" />
        </div>
        <h2 className="text-lg font-bold text-brand-900">מעדכן את האפליקציה…</h2>
        <p className="max-w-xs text-sm leading-relaxed text-ink-600">
          מוריד מחדש את כל הקבצים. זה ייקח כמה שניות ואז האפליקציה תיפתח מחדש.
        </p>
        <div className="mt-2 h-1 w-32 overflow-hidden rounded-full bg-brand-100">
          <div className="h-full w-1/3 animate-pulse rounded-full bg-brand-600" />
        </div>
      </div>
    );
  }

  // ── 2. אין עדכון או שנדחה ──
  if (status !== 'available' || !remote || dismissed) return null;

  // ── 3. כרטיס עדכון ──
  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex justify-center px-3"
      style={{ paddingBottom: 'calc(var(--nav-height) + var(--safe-bottom) + 0.75rem)' }}
    >
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-auto w-full max-w-md animate-slide-up rounded-card
                   border border-brand-200 bg-white p-4 shadow-lifted"
      >
        <div className="flex items-start gap-3">
          <div
            aria-hidden
            className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-50 text-xl"
          >
            ✨
          </div>

          <div className="min-w-0 flex-1">
            <h3 className="font-bold leading-tight text-ink-900">
              {remote.title || 'גרסה חדשה זמינה'}
            </h3>
            <p className="mt-0.5 text-xs text-ink-500">
              <span className="num">{current}</span>
              {' ← '}
              <span className="num font-semibold text-brand-700">{remote.version}</span>
            </p>

            {remote.notes && remote.notes.length > 0 && (
              <ul className="mt-2 space-y-1">
                {remote.notes.slice(0, 3).map((note, i) => (
                  <li key={i} className="flex gap-1.5 text-sm text-ink-600">
                    <span aria-hidden className="text-brand-500">
                      •
                    </span>
                    <span>{note}</span>
                  </li>
                ))}
              </ul>
            )}

            {forceLoopDetected && (
              <p className="mt-2 rounded-lg bg-amber-50 p-2 text-xs text-amber-800">
                ⚠️ ניסיון העדכון האוטומטי לא הצליח. אם ההודעה חוזרת, סגרו את האפליקציה
                ופתחו מחדש.
              </p>
            )}
          </div>
        </div>

        <div className="mt-3 flex gap-2">
          <button
            onClick={applyUpdate}
            className="tap flex-1 rounded-xl bg-brand-700 px-4 text-sm font-semibold text-white
                       transition active:scale-[.98] hover:bg-brand-800"
          >
            עדכן עכשיו
          </button>
          <button
            onClick={dismiss}
            className="tap rounded-xl px-4 text-sm font-medium text-ink-500
                       transition hover:bg-ink-100"
          >
            אחר כך
          </button>
        </div>
      </div>
    </div>
  );
}
