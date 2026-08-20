import { useRef, type ReactNode } from 'react';
import { CloseIcon } from './icons';
import { useModalBehavior } from '../../hooks/useModalBehavior';

/**
 * גיליון תחתון (Bottom Sheet) — דפוס המובייל המקובל לטפסים.
 * נוח יותר ממודאל מרכזי: נפתח מהאזור שהאגודל מגיע אליו.
 */
export function Sheet({
  open,
  onClose,
  title,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  // נעילת גלילת הרקע, Escape, מיקוד התחלתי, מלכודת Tab והחזרת מיקוד
  // בסגירה — הכל ב-useModalBehavior, כולל ההסבר למה onClose ב-ref.
  useModalBehavior(open, onClose, panelRef);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center">
      <div
        className="absolute inset-0 animate-fade-in bg-ink-900/40 backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className="relative flex max-h-[92dvh] w-full max-w-lg animate-sheet-in flex-col
                   rounded-t-3xl bg-white shadow-lifted outline-none
                   sm:rounded-3xl sm:animate-slide-up"
      >
        {/* ידית גרירה — רמז ויזואלי שאפשר לסגור */}
        <div className="flex justify-center pt-2.5 sm:hidden" aria-hidden>
          <span className="h-1.5 w-10 rounded-full bg-ink-200" />
        </div>

        <header className="flex items-center justify-between px-5 pb-3 pt-3">
          <h2 className="text-lg font-bold text-ink-900">{title}</h2>
          <button
            onClick={onClose}
            aria-label="סגור"
            className="tap grid place-items-center rounded-full text-ink-500
                       transition hover:bg-ink-100 hover:text-ink-800"
          >
            <CloseIcon width={20} height={20} />
          </button>
        </header>

        <div className="scroll-area flex-1 overflow-y-auto px-5 pb-4">{children}</div>

        {footer && (
          <footer
            className="border-t border-ink-100 px-5 pt-3"
            style={{ paddingBottom: 'calc(0.75rem + var(--safe-bottom))' }}
          >
            {footer}
          </footer>
        )}
      </div>
    </div>
  );
}
