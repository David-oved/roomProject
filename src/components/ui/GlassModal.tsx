import { useEffect, useRef, type ReactNode } from 'react';
import { CloseIcon } from './icons';

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

  useEffect(() => {
    if (!open) return;

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);

    const t = window.setTimeout(() => panelRef.current?.focus(), 50);

    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener('keydown', onKey);
      window.clearTimeout(t);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] grid place-items-center p-4">
      <div
        className="absolute inset-0 animate-fade-in bg-ink-900/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        tabIndex={-1}
        className="relative flex max-h-[88dvh] w-full max-w-sm animate-glass-in flex-col
                   overflow-hidden rounded-[2rem] border border-white/60 bg-white/90
                   shadow-lifted outline-none backdrop-blur-2xl"
      >
        <button
          onClick={onClose}
          aria-label="סגור"
          className="tap absolute end-3 top-3 z-10 grid h-8 w-8 place-items-center
                     rounded-full bg-white/70 text-ink-500 backdrop-blur transition
                     hover:bg-white hover:text-ink-800"
        >
          <CloseIcon width={17} height={17} />
        </button>

        <div className="scroll-area flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}
