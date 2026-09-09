import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent,
} from 'react';
import { NavLink, useLocation, useNavigate, useParams } from 'react-router-dom';
import { CartIcon, ChatIcon, HomeIcon, PlusIcon, WalletIcon } from '../ui/icons';
import { useConnection } from '../../store/ConnectionContext';
import { useRoom } from '../../store/RoomContext';
import { useHintRef } from '../../store/HintContext';
import { useToast } from '../../store/ToastContext';

/**
 * סרגל ניווט תחתון — בהשראת סרגל הכלים של Apple Music: לא פס קבוע
 * שנצמד לתחתית המסך, אלא שני אלמנטים צפים ונפרדים —
 *
 *   [כפתור פעולה עגול]    [פיל זכוכית עם 4 טאבים: בית · חסרים · חשבון · צ'אט]
 *        (ימין)                              (משמאלו)
 *
 * כפתור הפעולה בצד ימין במפורש (לא "קצה מוביל ב-RTL") — כך התבקש: אותו
 * מיקום מסך פיזי שבו יושב כפתור החיפוש בתמונות ההשראה. כדי לקבל את זה
 * תחת RTL, הכפתור *ראשון* ב-DOM (ראו את סדר הרינדור למטה) — בשורת flex
 * עם dir=rtl הילד הראשון ב-DOM מוצג בקצה הימני של המסך.
 *
 * ‼️ האינדיקטור הפעיל הוא "בועה" אחת משותפת (לא רקע פר-טאב) שגולשת בין
 * הטאבים, ניתנת לגרירה, ותוך כדי גרירה מקבלת מראה זכוכית בולט יותר.
 * המיקום נמדד בפועל מה-DOM (getBoundingClientRect) ולא מחושב לפי אחוזים —
 * זה נכון אוטומטית תחת RTL בלי מיפוי אינדקסים ידני, ולא רגיש לריפוד/
 * לרוחב הפיל (שכעת מתאים את עצמו לתוכן ולא נמתח לכל רוחב המסך).
 */

interface Tab {
  to: string;
  label: string;
  Icon: typeof HomeIcon;
  end?: boolean;
  unreadCount?: number;
  hintId: string;
  hintText: string;
}

interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export function BottomNav({ unreadChat = 0 }: { unreadChat?: number }) {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { isOnline } = useConnection();
  const { isArchived } = useRoom();
  const toast = useToast();
  const fabHintRef = useHintRef<HTMLButtonElement>(
    'nav.fab',
    'פותח ישר טופס להוספת מוצר חסר חדש'
  );

  // מחושבים תמיד (גם אם code עדיין לא ידוע) כדי לא לשבור את סדר ה-hooks
  // למטה — ה-early return היחיד מגיע רק אחרי כל קריאות ה-hook.
  const base = code ? `/r/${code}` : '';
  const blockedReason = isArchived
    ? 'החדר בארכיון, לצפייה בלבד'
    : !isOnline
      ? 'הפעולה דורשת חיבור לאינטרנט'
      : null;
  const left: Tab[] = [
    {
      to: base,
      label: 'בית',
      Icon: HomeIcon,
      end: true,
      hintId: 'nav.home',
      hintText: 'תמונת מצב מהירה של החדר — יתרה, חסרים ומטלות',
    },
    {
      to: `${base}/items`,
      label: 'חסרים',
      Icon: CartIcon,
      hintId: 'nav.items',
      hintText: 'רשימת כל המוצרים שדווחו כחסרים בחדר',
    },
  ];
  const right: Tab[] = [
    {
      to: `${base}/balances`,
      label: 'חשבון',
      Icon: WalletIcon,
      hintId: 'nav.balances',
      hintText: 'כאן עוקבים מי שילם וכמה כל אחד חייב',
    },
    {
      to: `${base}/chat`,
      label: "צ'אט",
      Icon: ChatIcon,
      unreadCount: unreadChat,
      hintId: 'nav.chat',
      hintText: 'צ׳אט קבוצתי ושיחות פרטיות עם חברי החדר',
    },
  ];
  const allTabs = [...left, ...right];

  const wrapRef = useRef<HTMLDivElement>(null);
  const bubbleRef = useRef<HTMLDivElement>(null);
  const pillRefs = useRef<Map<string, HTMLSpanElement>>(new Map());
  const isFirstMeasure = useRef(true);
  const dragRef = useRef<{
    pointerId: number;
    startClientX: number;
    startLeft: number;
    startTo: string;
    centers: { to: string; center: number }[];
  } | null>(null);

  const [dragging, setDragging] = useState(false);
  const [focusedTo, setFocusedTo] = useState<string | null>(null);

  /** מיקום/גודל של הפיל שממוקם מתחת לטאב to, יחסית ל-wrapRef. */
  const measure = (to: string): Rect | null => {
    const wrap = wrapRef.current;
    const pill = pillRefs.current.get(to);
    if (!wrap || !pill) return null;
    const w = wrap.getBoundingClientRect();
    const p = pill.getBoundingClientRect();
    return { left: p.left - w.left, top: p.top - w.top, width: p.width, height: p.height };
  };

  /**
   * instant=true משתמש בטריק הרגיל להשבתת טרנזישן לרגע אחד: כותבים
   * transition:none ישירות (inline מנצח קלאס), כופים reflow (offsetHeight)
   * כדי שהדפדפן יישם את ה-none *לפני* שממשיכים, ורק אז משחזרים — כך
   * הקפיצה הראשונה במיקום (בטעינה, ב-resize) לא "גולשת" מהפינה.
   */
  const placeBubble = (rect: Rect | null, instant: boolean) => {
    const bubble = bubbleRef.current;
    if (!rect || !bubble) return;
    if (instant) {
      const prev = bubble.style.transition;
      bubble.style.transition = 'none';
      bubble.style.left = `${rect.left}px`;
      bubble.style.top = `${rect.top}px`;
      bubble.style.width = `${rect.width}px`;
      bubble.style.height = `${rect.height}px`;
      void bubble.offsetHeight;
      bubble.style.transition = prev;
    } else {
      bubble.style.left = `${rect.left}px`;
      bubble.style.top = `${rect.top}px`;
      bubble.style.width = `${rect.width}px`;
      bubble.style.height = `${rect.height}px`;
    }
  };

  // ‼️ allTabs במתכוון לא ברשימת התלויות: התוכן שלו נגזר כולו מ-code,
  // וזה כבר שם. הוספתו הייתה מפעילה את ה-effect בכל רינדור (מערך חדש
  // בכל קריאה לפונקציה), בלי שום שינוי אמיתי במיקום שצריך למדוד.
  useLayoutEffect(() => {
    if (!code) return;
    const active =
      allTabs.find((t) => (t.end ? location.pathname === t.to : location.pathname.startsWith(t.to))) ??
      allTabs[0];
    setFocusedTo(active.to);
    placeBubble(measure(active.to), isFirstMeasure.current);
    isFirstMeasure.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, code]);

  // שינוי גודל חלון (סיבוב מכשיר, שינוי DevTools) — מיקום מחדש בלי אנימציה,
  // זו לא תזוזה בין טאבים.
  useEffect(() => {
    function onResize() {
      if (!focusedTo) return;
      placeBubble(measure(focusedTo), true);
    }
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusedTo]);

  if (!code) return null;

  // ── גרירת הבועה ──
  // הבועה עצמה aria-hidden ו-pointer-events-none: זו תוספת מגע אופציונלית,
  // לא ערוץ הניווט היחיד. הקשה על טאב, מקלדת וקורא-מסך ממשיכים לעבוד דרך
  // ה-NavLink הרגיל בלי שום שינוי.
  //
  // ‼️ המאזינים על ה-<ul> ולא על הבועה עצמה. הבועה יושבת מאחורי ה-<ul>
  // (z-0 מול z-10) כדי שהאייקונים יצוירו מעליה — אבל בדיוק בגלל זה שום
  // pointerdown לא היה מגיע אליה: ה-NavLink הגדול (יעד מגע 44px) שמעליה
  // תמיד "מנצח" בבדיקת ה-hit-test, לפני שהאירוע בכלל מגיע לאלמנט שמתחתיו.
  // הפתרון: ה-<ul> (שכבר מקבל כל אירוע באזור, בלי קונפליקט) בודק בעצמו
  // אם הנקודה שבה החלה הנגיעה נופלת בתוך המלבן הנוכחי של הבועה — ורק אז
  // מתחיל גרירה. נגיעה במקום אחר לא נעצרת (אין preventDefault/stopPropagation)
  // וממשיכה כרגיל אל ה-NavLink שמתחתיה.
  function handleListPointerDown(e: PointerEvent<HTMLUListElement>) {
    const bubble = bubbleRef.current;
    const wrap = wrapRef.current;
    if (!bubble || !wrap || !focusedTo) return;
    const r = bubble.getBoundingClientRect();
    const withinBubble = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
    if (!withinBubble) return;

    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    const wrapRect = wrap.getBoundingClientRect();
    const centers = allTabs
      .map((t) => {
        const rect = measure(t.to);
        return rect ? { to: t.to, center: rect.left + rect.width / 2 } : null;
      })
      .filter((c): c is { to: string; center: number } => c !== null);
    dragRef.current = {
      pointerId: e.pointerId,
      startClientX: e.clientX,
      startLeft: r.left - wrapRect.left,
      startTo: focusedTo,
      centers,
    };
    setDragging(true);
  }

  function handleListPointerMove(e: PointerEvent<HTMLUListElement>) {
    const drag = dragRef.current;
    const bubble = bubbleRef.current;
    const wrap = wrapRef.current;
    if (!drag || !bubble || !wrap || drag.pointerId !== e.pointerId) return;
    const dx = e.clientX - drag.startClientX;
    const wrapWidth = wrap.getBoundingClientRect().width;
    const bubbleWidth = bubble.getBoundingClientRect().width;
    const left = Math.min(Math.max(drag.startLeft + dx, 0), Math.max(0, wrapWidth - bubbleWidth));
    bubble.style.left = `${left}px`;

    const center = left + bubbleWidth / 2;
    let nearest = drag.centers[0];
    let nearestDist = Infinity;
    for (const c of drag.centers) {
      const d = Math.abs(c.center - center);
      if (d < nearestDist) {
        nearestDist = d;
        nearest = c;
      }
    }
    if (nearest && nearest.to !== focusedTo) setFocusedTo(nearest.to);
  }

  function handleListPointerUp(e: PointerEvent<HTMLUListElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    dragRef.current = null;
    setDragging(false);
    const target = focusedTo ?? drag.startTo;
    if (target !== location.pathname) {
      navigate(target);
    } else {
      // כבר באותו טאב שהתחלנו בו — ה-route לא משתנה, אז ה-effect שמזיז
      // את הבועה לא ירוץ. מציבים אותה בעצמנו בחזרה, עם טרנזישן (לא
      // instant) כדי שהיא "תיפול למקום" בצורה חלקה.
      placeBubble(measure(target), false);
    }
  }

  // ‼️ pointercancel (למשל שיחה נכנסת שמפריעה למחווה) חוזר לטאב שבו
  // התחילה הגרירה, בלי לנווט — עדיף לבטל בבטחה מאשר "לנחש" יעד.
  function handleListPointerCancel(e: PointerEvent<HTMLUListElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    dragRef.current = null;
    setDragging(false);
    setFocusedTo(drag.startTo);
    placeBubble(measure(drag.startTo), false);
  }

  return (
    <nav
      aria-label="ניווט ראשי"
      className="fixed inset-x-0 bottom-0 z-50 flex items-end gap-2 px-[21px]"
      style={{ paddingBottom: 'calc(var(--safe-bottom) + var(--nav-gap))' }}
    >
      {/* ── כפתור הפעולה — עגול, נפרד, אותו חומר זכוכית כמו הפיל.
          ‼️ ראשון ב-DOM כדי לשבת בקצה הימני תחת RTL (ראו ההערה למעלה). */}
      <button
        ref={fabHintRef}
        type="button"
        onClick={() => (blockedReason ? toast.warn(blockedReason) : navigate(`${base}/items?new=1`))}
        aria-disabled={blockedReason ? true : undefined}
        aria-label={blockedReason ? `דיווח על מוצר חסר — ${blockedReason}` : 'דיווח על מוצר חסר'}
        className={[
          'glass-panel grid h-[62px] w-[62px] shrink-0 place-items-center rounded-full shadow-lifted',
          'transition-transform duration-150 ease-out active:scale-95',
          blockedReason ? 'text-ink-400' : 'text-ink-800',
        ].join(' ')}
      >
        <PlusIcon width={22} height={22} />
      </button>

      {/* ── הפיל — 4 טאבים, נמתח לכל הרוחב שנשאר עד לכפתור (לא מתאים
          עצמו לתוכן). זה בדיוק ההבדל מהניסיון הקודם: ב-FabBar המקורי
          של אפל (ראו למעלה) הפיל תפוס כל הרוחב הפנוי — וזה מה שגרם
          לתחושת ה"מצומק", לא הרווח הפנימי בין הטאבים. */}
      <div ref={wrapRef} className="glass-panel relative flex h-[62px] flex-1 items-center rounded-full px-0.5 shadow-lifted">
        {/* ‼️ z-index: ה-<ul> מצויר *מעל* הבועה (z-10 מול z-0) כדי
            שהאייקונים לא ייעלמו מתחתיה. הבועה עצמה pointer-events-none —
            היא לא מקבלת אף אירוע ישירות; הגרירה מטופלת ב-<ul> עצמו (ראו
            handleListPointerDown). */}
        <div
          ref={bubbleRef}
          aria-hidden
          style={{ left: 0, top: 4, width: 44, height: 32 }}
          className={[
            'pointer-events-none absolute z-0 rounded-full',
            dragging
              ? 'border border-white/50 bg-surface/50 shadow-glass backdrop-blur-xl backdrop-saturate-150'
              : 'border border-transparent bg-brand-50 transition-[left,top,width,height,background-color,box-shadow,border-color] duration-300 ease-[cubic-bezier(.34,1.56,.64,1)]',
          ].join(' ')}
        />

        <ul
          className="relative z-10 flex h-full w-full touch-none items-center"
          onPointerDown={handleListPointerDown}
          onPointerMove={handleListPointerMove}
          onPointerUp={handleListPointerUp}
          onPointerCancel={handleListPointerCancel}
        >
          {allTabs.map((t) => (
            <TabButton
              key={t.to}
              {...t}
              focused={focusedTo === t.to}
              pillRef={(el) => {
                if (el) pillRefs.current.set(t.to, el);
                else pillRefs.current.delete(t.to);
              }}
            />
          ))}
        </ul>
      </div>
    </nav>
  );
}

function TabButton({
  to,
  label,
  Icon,
  end,
  unreadCount,
  hintId,
  hintText,
  focused,
  pillRef,
}: Tab & { focused: boolean; pillRef: (el: HTMLSpanElement | null) => void }) {
  const hintRef = useHintRef<HTMLAnchorElement>(hintId, hintText);
  const hasUnread = !!unreadCount && unreadCount > 0;
  return (
    <li className="flex-1 self-stretch">
      <NavLink
        ref={hintRef}
        to={to}
        end={end}
        // ‼️ הנקודה האדומה היא רמז ויזואלי גרידא (aria-hidden) — בלי
        // aria-label דינמי כאן, קורא-מסך לא היה יודע שיש הודעות שלא
        // נקראו. אותו דפוס בדיוק כמו aria-label של פעמון ההתראות.
        // aria-current="page" מגיע אוטומטית מ-NavLink לפי המסלול בפועל —
        // עצמאי מ-focused (שגם מגיב לתצוגת-מקדימה של גרירה).
        aria-label={hasUnread ? `${label}, ${unreadCount} הודעות שלא נקראו` : undefined}
        className="tap flex h-full flex-col items-center justify-center gap-0.5
                   text-xs font-semibold outline-none transition-transform
                   duration-150 active:scale-90"
      >
        {/* span זה הוא רק עוגן-מדידה וריכוז לאייקון — הרקע/הבועה עצמם
            כבר לא כאן, הם האלמנט המשותף שגולש מלמעלה. */}
        <span ref={pillRef} className="relative grid h-8 w-11 place-items-center rounded-full">
          <Icon
            width={21}
            height={21}
            filled={focused}
            className={[
              'transition-colors duration-200',
              focused ? 'text-brand-700' : 'text-ink-500',
            ].join(' ')}
          />
          {hasUnread && (
            <span
              aria-hidden
              className="absolute end-1.5 top-0.5 h-2 w-2 rounded-full bg-rose-500 ring-2 ring-surface"
            />
          )}
        </span>
        {/* ‼️ ink-400 = 2.56:1 מול לבן — כשל ניגודיות בטקסט הניווט
            הראשי של האפליקציה. ink-500 = 4.76:1. */}
        <span
          className={['transition-colors duration-200', focused ? 'text-brand-700' : 'text-ink-500'].join(
            ' '
          )}
        >
          {label}
        </span>
      </NavLink>
    </li>
  );
}
