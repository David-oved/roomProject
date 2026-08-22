import { useEffect, useRef, useState, type ReactNode } from 'react';
import { CloseIcon } from './icons';
import { readVisualViewportBounds } from '../../hooks/useVisualViewportBounds';
import { useModalBehavior } from '../../hooks/useModalBehavior';

/**
 * מודאל זכוכית מרכזי — לא Bottom Sheet.
 *
 * שמור לזרימות "אירוע" קצרות ומרוכזות (כמו דיווח מוצר) שרוצים להרגיש
 * כמו רגע נפרד ומיוחד, לא כמו טופס בתוך הדף. Sheet נשאר ברירת המחדל
 * לכל שאר הטפסים באפליקציה.
 */
export function GlassModal({
  open,
  onClose,
  children,
  labelledBy,
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  labelledBy?: string;
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  /**
   * ‼️ בכוונה *לא* עוקבים חי אחרי visualViewport כמו ב-ChatConversationPage.
   * שם זה נכון כי שדה קלט צריך "לעלות" ולהישאר מעל המקלדת. במודאל מרכזי
   * זה הפוך: מעקב חי הוא בדיוק מה שגרם ל"קפיצה" — כל מעבר בין שדות עם
   * מקלדות בגבהים שונים (למשל טקסט מול מספרי, ב-AddTaskSheet) שינה את
   * visualViewport.height וגרר עוד ועוד שינוי גודל של המודאל עצמו.
   * מודאל לא צריך לעקוב אחרי המקלדת — רק לא לזוז. לכן: תופסים את הגודל
   * *פעם אחת* ברגע שהמודאל נפתח (לפני שהמקלדת בכלל עלתה), ולא נוגעים
   * בו יותר כל עוד הוא פתוח. אם המקלדת מכסה חלק ממנו — זה תפקיד הגלילה
   * הפנימית (scroll-area), לא של שינוי גודל חיצוני.
   */
  const [viewport, setViewport] = useState(readVisualViewportBounds);

  /**
   * ‼️ [open] בלבד ב-deps — זו כל המשמעות של "פעם אחת בפתיחה".
   * כשהיה כאן [open, onClose], כל רינדור של ההורה (onClose הוא פונקציית
   * חץ טרייה בכל אתרי הקריאה) הריץ את השורה הזו מחדש ומדד את ה-viewport
   * שוב — כלומר בדיוק בזמן שהמקלדת נפתחה. זה היה השורש של "המודאל קופץ".
   */
  useEffect(() => {
    if (!open) return;
    setViewport(readVisualViewportBounds());
  }, [open]);

  // גלילה, Escape, מיקוד ומלכודת Tab — ראו useModalBehavior
  useModalBehavior(open, onClose, panelRef);

  if (!open) return null;

  return (
    <div
      className="fixed inset-x-0 z-[80] grid place-items-center p-4"
      style={{ top: viewport.top, height: viewport.height }}
    >
      <div
        className="absolute inset-0 animate-fade-in bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        tabIndex={-1}
        style={{ maxHeight: viewport.height * 0.88 }}
        className="relative flex w-full max-w-sm animate-glass-in flex-col
                   overflow-hidden rounded-[2rem] border border-surface/60 bg-surface/90
                   shadow-lifted outline-none backdrop-blur-2xl"
      >
        <button
          onClick={onClose}
          aria-label="סגור"
          className="tap-area absolute end-3 top-3 z-10 grid h-8 w-8 place-items-center
                     rounded-full bg-surface/70 text-ink-500 backdrop-blur transition
                     hover:bg-surface hover:text-ink-800"
        >
          <CloseIcon width={17} height={17} />
        </button>

        <div className="scroll-area flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}
