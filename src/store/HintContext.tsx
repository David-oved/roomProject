import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { getHintsSeen, markHintSeen } from '../lib/prefs';
import { CloseIcon, LightbulbIcon } from '../components/ui/icons';

interface HintEntry {
  text: string;
  el: HTMLElement;
}

interface HintRegistryApi {
  register: (id: string, text: string, el: HTMLElement) => void;
  unregister: (id: string) => void;
}

const HintRegistryContext = createContext<HintRegistryApi>({
  register: () => {},
  unregister: () => {},
});

/**
 * מצרפים ל-ref של כל אלמנט אינטראקטיבי שרוצים ללוות בהערת-הקשר.
 *
 * id חייב להיות ייחודי וקבוע (למשל 'dashboard.reportButton') — הוא
 * המפתח שנשמר ב-localStorage כ"נצפה". text קבוע לרוב המקרים, ולכן אין
 * צורך ב-useMemo בצד הקורא.
 *
 * ‼️ בכוונה hook נפרד מ-useHintTarget/HintPopover: אלמנט קיים לא צריך
 * לשנות מבנה JSX (עטיפה ב-wrapper), רק להוסיף ref — כדי שנוכל להצמיד
 * הערות לעשרות אלמנטים בלי לגעת בפריסה של אף אחד מהם.
 *
 * id יכול להיות undefined — למשל כשמצמידים הערה רק לפריט הראשון
 * בלולאה (ref={idx===0 ? id : undefined}) ורוצים עדיין לקרוא ל-hook
 * ללא-תנאי (חוקי ה-hooks). כש-id הוא undefined, ה-ref שמוחזר לא עושה
 * כלום — לא נרשם ולא נמחק שום דבר.
 */
export function useHintRef<T extends HTMLElement = HTMLElement>(
  id: string | undefined,
  text: string
) {
  const { register, unregister } = useContext(HintRegistryContext);
  return useCallback(
    (el: T | null) => {
      if (!id) return;
      if (el) register(id, text, el);
      else unregister(id);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [id, text]
  );
}

/**
 * מנוע הערות-ההקשר: תור של אלמנטים "נראים ועדיין לא נצפו", מוצג אחד
 * בכל רגע ליד האלמנט עצמו — לא מודאל, לא חוסם.
 *
 * ‼️ למה תור ולא הכול בבת אחת: מסך כמו הבית מכיל עשרות אלמנטים
 * מתויגים. הצגת כולם יחד בביקור ראשון הייתה גרועה יותר מהמודאל המלא
 * שהיא אמורה להחליף. סדר התור נגזר מסדר ה-mount בפועל (register
 * נקרא בסדר שבו React מרכיב את העץ) — כלומר עליון-למטה, בדיוק סדר
 * הקריאה הטבעי של המסך.
 */
export function HintProvider({ children }: { children: ReactNode }) {
  const seenRef = useRef(getHintsSeen());
  const entriesRef = useRef(new Map<string, HintEntry>());
  const [activeId, setActiveId] = useState<string | null>(null);
  const [, forceTick] = useState(0);

  const register = useCallback((id: string, text: string, el: HTMLElement) => {
    if (seenRef.current.has(id)) return;
    entriesRef.current.set(id, { text, el });
    forceTick((t) => t + 1); // מעיר את ה-effect שבוחר activeId
  }, []);

  const unregister = useCallback((id: string) => {
    entriesRef.current.delete(id);
    setActiveId((cur) => (cur === id ? null : cur));
  }, []);

  // בוחר את הראשון בתור כשאין הערה פעילה כרגע
  useEffect(() => {
    if (activeId) return;
    const next = entriesRef.current.keys().next();
    if (!next.done) setActiveId(next.value);
  });

  const dismiss = useCallback((id: string) => {
    seenRef.current.add(id);
    markHintSeen(id);
    entriesRef.current.delete(id);
    setActiveId(null);
  }, []);

  const api = useMemo(() => ({ register, unregister }), [register, unregister]);
  const active = activeId ? entriesRef.current.get(activeId) : undefined;

  return (
    <HintRegistryContext.Provider value={api}>
      {children}
      {active && activeId && <HintPopover id={activeId} text={active.text} el={active.el} onDismiss={dismiss} />}
    </HintRegistryContext.Provider>
  );
}

const MARGIN = 10;
const POPOVER_WIDTH = 248;

function HintPopover({
  id,
  text,
  el,
  onDismiss,
}: {
  id: string;
  text: string;
  el: HTMLElement;
  onDismiss: (id: string) => void;
}) {
  const [rect, setRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    setRect(el.getBoundingClientRect());
  }, [el]);

  // כל גלילה או לחיצה (בכל מקום, כולל על האלמנט עצמו) סוגרות את
  // ההערה — ובכוונה בלי preventDefault/stopPropagation, כדי שלחיצה
  // על האלמנט האמיתי תמשיך לבצע את הפעולה שלו כרגיל.
  useEffect(() => {
    const close = () => onDismiss(id);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('scroll', close, true);
    document.addEventListener('click', close, true);
    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', close);
    return () => {
      document.removeEventListener('scroll', close, true);
      document.removeEventListener('click', close, true);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', close);
    };
  }, [id, onDismiss]);

  if (!rect) return null;

  const spaceBelow = window.innerHeight - rect.bottom;
  const showBelow = spaceBelow > 120 || spaceBelow > rect.top;
  const top = showBelow ? rect.bottom + MARGIN : undefined;
  const bottom = !showBelow ? window.innerHeight - rect.top + MARGIN : undefined;

  const idealLeft = rect.left + rect.width / 2 - POPOVER_WIDTH / 2;
  const left = Math.min(Math.max(idealLeft, 8), window.innerWidth - POPOVER_WIDTH - 8);

  return (
    <>
      {/* הילה סביב האלמנט עצמו — כדי שברור בדיוק "למה" מתייחסת ההערה */}
      <div
        aria-hidden
        className="pointer-events-none fixed z-[85] animate-fade-in rounded-xl ring-2 ring-brand-500 ring-offset-2 ring-offset-surface/40"
        style={{
          top: rect.top - 4,
          left: rect.left - 4,
          width: rect.width + 8,
          height: rect.height + 8,
        }}
      />

      <div
        role="status"
        style={{ top, bottom, left, width: POPOVER_WIDTH }}
        className="animate-slide-up fixed z-[85] rounded-2xl border border-brand-200 bg-surface
                   p-3 shadow-lifted"
      >
        <div className="flex items-start gap-2">
          <span className="mt-0.5 shrink-0 text-brand-600">
            <LightbulbIcon width={16} height={16} />
          </span>
          <p className="flex-1 text-[13px] leading-relaxed text-ink-800">{text}</p>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDismiss(id);
            }}
            aria-label="סגירה"
            className="tap-area -m-1 shrink-0 text-ink-400 hover:text-ink-700"
          >
            <CloseIcon width={14} height={14} />
          </button>
        </div>
      </div>
    </>
  );
}
