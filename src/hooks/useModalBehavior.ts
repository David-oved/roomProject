import { useEffect, useRef, type RefObject } from 'react';

/**
 * ═══════════════════════════════════════════════════════════════
 *  ההתנהגות המשותפת לכל דיאלוג באפליקציה (Sheet ו-GlassModal)
 * ═══════════════════════════════════════════════════════════════
 *
 *  ‼️ למה onClose יושב ב-ref ולא ב-deps של האפקט:
 *
 *  בכל 16 אתרי הקריאה onClose הוא בסופו של דבר פונקציית חץ טרייה בכל
 *  רינדור (`onClose={() => setOpen(false)}`) — עשרה מעבירים אותה ישירות
 *  ושישה מעבירים אותה הלאה כ-prop. כשה-onClose הזה היה ב-deps,
 *  האפקט נהרס ונבנה מחדש בכל רינדור של ההורה — ולא בגלל שמשהו
 *  באמת השתנה. התוצאות היו שתיים, ושתיהן נראו כמו באגים אחרים:
 *
 *   1. setTimeout(() => panel.focus(), 50) רץ שוב ושוב וגנב את
 *      המיקוד מהשדה שהמשתמש הקליד בו. ב-ConfirmContext עם
 *      requireTyping ההורה מרונדר בכל תו — כלומר המיקוד נגנב אחרי
 *      כל אות שהוקלדה.
 *   2. ב-GlassModal, setViewport(readVisualViewportBounds()) רץ שוב
 *      בכל רינדור. זה שבר בדיוק את ההבטחה שהמודאל מודד את ה-viewport
 *      *פעם אחת* בפתיחה — וזה השורש של באג "המודאל קופץ כשהמקלדת
 *      נפתחת", שארבעה קומיטים ניסו לתקן מכיוונים אחרים.
 *
 *  לכן: onClose נשמר ב-ref שמתעדכן באפקט נפרד וזול, והאפקט הראשי
 *  תלוי ב-[open] בלבד — הוא רץ בדיוק פעם אחת לכל פתיחה.
 *
 *  האפקט אחראי גם על: נעילת גלילת הרקע, Escape, מיקוד התחלתי,
 *  מלכודת Tab (aria-modal לבדו *אינו* עוצר את Tab), והחזרת המיקוד
 *  לאלמנט שממנו נפתח הדיאלוג בסגירה.
 */

/** אלמנטים שאפשר להגיע אליהם ב-Tab. tabindex="-1" מכוון יוצא מהרשימה. */
const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'summary',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

function visibleFocusables(panel: HTMLElement): HTMLElement[] {
  return Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (el) =>
      el.tabIndex !== -1 &&
      !el.hasAttribute('disabled') &&
      el.getClientRects().length > 0
  );
}

export function useModalBehavior(open: boolean, onClose: () => void, panelRef: RefObject<HTMLElement>) {
  const onCloseRef = useRef(onClose);

  // אפקט נפרד, בלי deps: מסתנכרן אחרי כל רינדור אבל לא מפעיל כלום.
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!open) return;

    // ‼️ נשמר *לפני* שהדיאלוג לוקח את המיקוד, ומוחזר רק בסגירה בפועל.
    // בזכות ה-deps המצומצמות ([open]) הניקוי לא רץ באמצע החיים של
    // הדיאלוג, ולכן אין כאן מלחמה מול המיקוד ההתחלתי שלמטה.
    const returnFocusTo = document.activeElement as HTMLElement | null;

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCloseRef.current();
        return;
      }
      if (e.key !== 'Tab') return;

      // מלכודת מיקוד: aria-modal מספר לקורא מסך שהרקע לא רלוונטי,
      // אבל לא מונע מ-Tab לצאת אליו בפועל.
      const panel = panelRef.current;
      if (!panel) return;

      const items = visibleFocusables(panel);
      const active = document.activeElement as HTMLElement | null;

      if (items.length === 0) {
        e.preventDefault();
        panel.focus();
        return;
      }

      const first = items[0];
      const last = items[items.length - 1];

      if (!active || !panel.contains(active) || active === panel) {
        e.preventDefault();
        (e.shiftKey ? last : first).focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      } else if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      }
    };

    document.addEventListener('keydown', onKey);

    // מיקוד התחלתי לתוך הדיאלוג, לנגישות — אבל לא דורסים שדה שכבר
    // תפס מיקוד בעצמו (autoFocus). זו הייתה תוצאת לוואי של הקוד הישן:
    // ב-ConfirmContext השדה עם autoFocus איבד את המיקוד אחרי 50ms.
    const t = window.setTimeout(() => {
      const panel = panelRef.current;
      if (!panel) return;
      const active = document.activeElement;
      if (active && active !== panel && panel.contains(active)) return;
      panel.focus();
    }, 50);

    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener('keydown', onKey);
      window.clearTimeout(t);

      // החזרת המיקוד לכפתור שפתח את הדיאלוג. preventScroll כדי
      // שהחזרת המיקוד לא תגרור קפיצת גלילה ברגע שנעילת הגלילה משוחררת.
      // body מוחרג: הוא ה-activeElement כשלא היה מיקוד כלל, ומיקוד יזום
      // בו רק היה מסיר מיקוד ממה שאולי תפס אותו בינתיים.
      if (
        returnFocusTo &&
        returnFocusTo !== document.body &&
        document.contains(returnFocusTo)
      ) {
        returnFocusTo.focus?.({ preventScroll: true });
      }
    };
  }, [open, panelRef]);
}
