import { NavLink, useNavigate, useParams } from 'react-router-dom';
import { CartIcon, ChatIcon, HomeIcon, PlusIcon, WalletIcon } from '../ui/icons';
import { useConnection } from '../../store/ConnectionContext';

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
}

export function BottomNav() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const { isOnline } = useConnection();

  if (!code) return null;

  const base = `/r/${code}`;
  const left: Tab[] = [
    { to: base, label: 'בית', Icon: HomeIcon, end: true },
    { to: `${base}/items`, label: 'חסרים', Icon: CartIcon },
  ];
  const right: Tab[] = [
    { to: `${base}/balances`, label: 'חשבון', Icon: WalletIcon },
    { to: `${base}/chat`, label: "צ'אט", Icon: ChatIcon },
  ];

  return (
    <nav
      aria-label="ניווט ראשי"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-ink-200/70
                 bg-white/80 shadow-[0_-8px_24px_-16px_rgba(15,23,42,.15)]
                 backdrop-blur-xl backdrop-saturate-150"
      style={{ paddingBottom: 'var(--safe-bottom)' }}
    >
      <ul className="mx-auto flex h-[var(--nav-height)] max-w-lg items-center px-1">
        {left.map((t) => (
          <TabButton key={t.to} {...t} />
        ))}

        {/* ── כפתור הפעולה המרכזי ── */}
        <li className="relative flex w-[20%] shrink-0 items-center justify-center self-stretch">
          <div aria-hidden className="pointer-events-none absolute -top-2 h-14 w-14 rounded-full bg-brand-500/25 blur-lg" />
          <button
            type="button"
            onClick={() => navigate(`${base}/items?new=1`)}
            disabled={!isOnline}
            title={isOnline ? 'דיווח על מוצר חסר' : 'פעולה זו דורשת חיבור לאינטרנט'}
            aria-label="דיווח על מוצר חסר"
            className="relative -mt-3.5 grid h-14 w-14 place-items-center rounded-2xl text-white
                       shadow-fab ring-4 ring-white transition-transform duration-150 ease-out
                       active:scale-90
                       bg-gradient-to-br from-brand-500 to-brand-700
                       disabled:from-ink-300 disabled:to-ink-400 disabled:shadow-none
                       disabled:active:scale-100"
          >
            <PlusIcon width={24} height={24} />
          </button>
        </li>

        {right.map((t) => (
          <TabButton key={t.to} {...t} />
        ))}
      </ul>
    </nav>
  );
}

function TabButton({ to, label, Icon, end }: Tab) {
  return (
    <li className="flex-1 self-stretch">
      <NavLink
        to={to}
        end={end}
        className="tap flex h-full flex-col items-center justify-center gap-1
                   text-[11px] font-semibold outline-none"
      >
        {({ isActive }) => (
          <>
            <span
              className={[
                'grid h-8 w-11 place-items-center rounded-full transition-all duration-300 ease-out',
                isActive ? 'scale-100 bg-brand-50' : 'scale-90 bg-transparent',
              ].join(' ')}
            >
              <Icon
                width={21}
                height={21}
                filled={isActive}
                className={[
                  'transition-colors duration-200',
                  isActive ? 'text-brand-700' : 'text-ink-400',
                ].join(' ')}
              />
            </span>
            <span
              className={[
                'transition-colors duration-200',
                isActive ? 'text-brand-700' : 'text-ink-400',
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
