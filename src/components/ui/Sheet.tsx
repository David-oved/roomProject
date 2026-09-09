import { useId, useRef, useState, type ReactNode, type TouchEvent } from 'react';
import { CloseIcon } from './icons';
import { useModalBehavior } from '../../hooks/useModalBehavior';

/** מעבר לסגירה — מתחת לזה הגיליון חוזר למקומו */
const DISMISS_PX = 100;

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
  /** דיאלוג אישור — מכריז לקורא מסך כהתראה ולא כחלון רגיל */
  alert = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  alert?: boolean;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  /**
   * ‼️ הגרירה מוגבלת בכוונה לידית ולכותרת ולא לכל הגיליון: הגוף הוא
   * אזור גלילה, ומאזין גרירה עליו היה מתחרה בגלילה הפנימית בכל תנועה
   * אנכית. עד עכשיו הידית הייתה קישוט בלבד — היא נראית כמו ידית משיכה
   * של iOS, אבל שום מגע לא עשה כלום. או שהיא עושה מה שהיא מבטיחה, או
   * שאסור לה להיות שם.
   */
  const dragStartY = useRef<number | null>(null);
  const [dragY, setDragY] = useState(0);

  const onTouchStart = (e: TouchEvent) => {
    dragStartY.current = e.touches[0].clientY;
  };
  const onTouchMove = (e: TouchEvent) => {
    if (dragStartY.current === null) return;
    // רק כלפי מטה — משיכה כלפי מעלה לא אמורה "להרים" את הגיליון
    setDragY(Math.max(0, e.touches[0].clientY - dragStartY.current));
  };
  const onTouchEnd = () => {
    if (dragY > DISMISS_PX) onClose();
    dragStartY.current = null;
    setDragY(0);
  };

  // נעילת גלילת הרקע, Escape, מיקוד התחלתי, מלכודת Tab והחזרת מיקוד
  // בסגירה — הכל ב-useModalBehavior, כולל ההסבר למה onClose ב-ref.
  useModalBehavior(open, onClose, panelRef);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center">
      <div
        className="absolute inset-0 animate-fade-in bg-black/40 backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden
      />

      <div
        ref={panelRef}
        role={alert ? 'alertdialog' : 'dialog'}
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        style={dragY ? { transform: `translateY(${dragY}px)` } : undefined}
        className="relative flex max-h-[92dvh] w-full max-w-lg animate-sheet-in flex-col
                   rounded-t-3xl bg-surface shadow-lifted outline-none
                   sm:rounded-3xl sm:animate-slide-up"
      >
        {/* ידית גרירה — משיכה כלפי מטה סוגרת. כפתור הסגירה נשאר החלופה
            הלא-מחוותית, כנדרש כשפעולה זמינה במחווה. */}
        <div
          className="flex touch-none justify-center pt-2.5 sm:hidden"
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
          aria-hidden
        >
          <span className="h-1.5 w-10 rounded-full bg-ink-200" />
        </div>

        <header
          className="flex items-center justify-between px-5 pb-3 pt-3"
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        >
          <h2 id={titleId} className="text-lg font-bold text-ink-900">
            {title}
          </h2>
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
