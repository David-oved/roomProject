import { NavLink, useNavigate, useParams } from 'react-router-dom';
import { CartIcon, ChatIcon, HomeIcon, PlusIcon, WalletIcon } from '../ui/icons';
import { useConnection } from '../../store/ConnectionContext';
import { useRoom } from '../../store/RoomContext';
import { useHintRef } from '../../store/HintContext';
import { useToast } from '../../store/ToastContext';

/**
 * סרגל ניווט תחתון — 5 מקומות, כשהאמצעי הוא כפתור הפעולה הראשי.
 *
 *   🏠 בית    🛒 חסרים    ➕    💰 חשבון    💬 צ'אט
 *
 * למה במרכז: "דיווח על מוצר חסר" היא הפעולה התכופה ביותר באפליקציה,
 * ומרכז התחתית הוא האזור הכי נוח לאגודל בכל גודל מסך.
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

export function BottomNav({ unreadChat = 0 }: { unreadChat?: number }) {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const { isOnline } = useConnection();
  const { isArchived } = useRoom();
  const toast = useToast();
  const fabHintRef = useHintRef<HTMLButtonElement>(
    'nav.fab',
    'פותח ישר טופס להוספת מוצר חסר חדש'
  );

  if (!code) return null;

  const base = `/r/${code}`;
  // למה אי אפשר לדווח כרגע — null כשאפשר. ארכיון קודם לאופליין: הוא
  // המצב הקבוע מביניהם, ולכן ההסבר המועיל יותר.
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

  return (
    <nav
      aria-label="ניווט ראשי"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-ink-200/70 bg-surface
                 shadow-[0_-4px_16px_-12px_rgba(0,0,0,.2)]"
      style={{ paddingBottom: 'var(--safe-bottom)' }}
    >
      <ul className="mx-auto flex h-[var(--nav-height)] max-w-lg items-center px-1">
        {left.map((t) => (
          <TabButton key={t.to} {...t} />
        ))}

        {/* ── כפתור הפעולה המרכזי ── */}
        <li className="relative flex w-[20%] shrink-0 items-center justify-center self-stretch">
          {/* ‼️ aria-disabled ולא disabled, והסיבה בטוסט ולא ב-title.
              קודם היה כאן כפתור disabled עם ההסבר ב-title בלבד — ושני
              הערוצים האלה לא קיימים בדפדפן נייד: title לא מוצג במגע,
              וכפתור disabled גם לא מקבל פוקוס ולא מגיב ללחיצה. כלומר
              המשתמש ראה ריבוע אפור בלי שום דרך לגלות למה. עכשיו הכפתור
              נשאר לחיץ וממוקד, השם הנגיש נושא את הסיבה, ולחיצה אומרת
              אותה בקול. */}
          <button
            ref={fabHintRef}
            type="button"
            onClick={() =>
              blockedReason ? toast.warn(blockedReason) : navigate(`${base}/items?new=1`)
            }
            aria-disabled={blockedReason ? true : undefined}
            aria-label={
              blockedReason ? `דיווח על מוצר חסר — ${blockedReason}` : 'דיווח על מוצר חסר'
            }
            className={[
              'relative -mt-2 grid h-12 w-12 place-items-center rounded-2xl text-white',
              'ring-[3px] ring-surface transition-transform duration-150 ease-out',
              blockedReason
                ? 'bg-muted-fill shadow-none'
                : 'bg-brand-fill shadow-fab active:scale-90',
            ].join(' ')}
          >
            <PlusIcon width={22} height={22} />
          </button>
        </li>

        {right.map((t) => (
          <TabButton key={t.to} {...t} />
        ))}
      </ul>
    </nav>
  );
}

function TabButton({ to, label, Icon, end, unreadCount, hintId, hintText }: Tab) {
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
        aria-label={hasUnread ? `${label}, ${unreadCount} הודעות שלא נקראו` : undefined}
        className="tap flex h-full flex-col items-center justify-center gap-1
                   text-xs font-semibold outline-none transition-transform
                   duration-150 active:scale-90"
      >
        {({ isActive }) => (
          <>
            <span
              className={[
                'relative grid h-8 w-11 place-items-center rounded-full transition-all duration-300',
                'ease-[cubic-bezier(.34,1.56,.64,1)]',
                isActive ? 'scale-100 bg-brand-50' : 'scale-90 bg-transparent',
              ].join(' ')}
            >
              <Icon
                width={21}
                height={21}
                filled={isActive}
                className={[
                  'transition-colors duration-200',
                  isActive ? 'text-brand-700' : 'text-ink-500',
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
              className={[
                'transition-colors duration-200',
                isActive ? 'text-brand-700' : 'text-ink-500',
              ].join(' ')}
            >
              {label}
            </span>
          </>
        )}
      </NavLink>
    </li>
  );
}
