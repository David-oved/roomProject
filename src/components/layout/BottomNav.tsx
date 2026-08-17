import { NavLink, useNavigate, useParams } from 'react-router-dom';
import { CartIcon, HomeIcon, PlusIcon, UsersIcon, WalletIcon } from '../ui/icons';
import { useConnection } from '../../store/ConnectionContext';

/**
 * סרגל ניווט תחתון — 5 מקומות, כשהאמצעי הוא כפתור הפעולה הראשי.
 *
 *   🏠 בית    🛒 חסרים    ➕    💰 חשבון    👥 חדר
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
    { to: `${base}/members`, label: 'חדר', Icon: UsersIcon },
  ];

  return (
    <nav
      aria-label="ניווט ראשי"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-ink-200/80
                 bg-white/85 backdrop-blur-xl backdrop-saturate-150"
      style={{ paddingBottom: 'var(--safe-bottom)' }}
    >
      <ul className="mx-auto flex h-[var(--nav-height)] max-w-lg items-stretch px-1">
        {left.map((t) => (
          <TabButton key={t.to} {...t} />
        ))}

        {/* ── כפתור הפעולה המרכזי ── */}
        <li className="relative flex w-[20%] shrink-0 items-start justify-center">
          <button
            type="button"
            onClick={() => navigate(`${base}/items?new=1`)}
            disabled={!isOnline}
            title={isOnline ? 'דיווח על מוצר חסר' : 'פעולה זו דורשת חיבור לאינטרנט'}
            aria-label="דיווח על מוצר חסר"
            className="-mt-5 grid h-14 w-14 place-items-center rounded-2xl text-white
                       shadow-fab transition-[transform,background-color] duration-150
                       active:scale-95
                       bg-gradient-to-br from-brand-500 to-brand-700
                       disabled:from-ink-300 disabled:to-ink-400 disabled:shadow-none
                       disabled:active:scale-100"
          >
            <PlusIcon width={26} height={26} />
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
    <li className="flex-1">
      <NavLink
        to={to}
        end={end}
        className={({ isActive }) =>
          [
            'tap flex h-full flex-col items-center justify-center gap-0.5 rounded-xl',
            'text-[11px] font-semibold transition-colors duration-150',
            isActive ? 'text-brand-700' : 'text-ink-400 hover:text-ink-600',
          ].join(' ')
        }
      >
        {({ isActive }) => (
          <>
            <span className="relative">
              <Icon width={23} height={23} filled={isActive} />
              {isActive && (
                <span
                  aria-hidden
                  className="absolute -bottom-1.5 left-1/2 h-1 w-1 -translate-x-1/2
                             rounded-full bg-brand-600"
                />
              )}
            </span>
            <span className="mt-1">{label}</span>
          </>
        )}
      </NavLink>
    </li>
  );
}
