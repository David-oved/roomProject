import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AppShell } from '../components/layout/AppShell';
import { TopBar } from '../components/layout/TopBar';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { ListSkeleton } from '../components/ui/Skeleton';
import {
  BathroomIcon,
  BellIcon,
  BoxIcon,
  CartIcon,
  CleaningIcon,
  ExchangeIcon,
  KitchenIcon,
  PlusIcon,
  SettingsIcon,
} from '../components/ui/icons';
import { useRoom } from '../store/RoomContext';
import { useAuth } from '../store/AuthContext';
import {
  useBalances,
  useItems,
  useJoinRequests,
  useNotifications,
  usePurchases,
  useSettlements,
} from '../hooks/useRoomData';
import { formatAmount, formatILS, formatRelativeTime } from '../lib/format';
import { type Category } from '../types/models';
import { RoomCodeCard } from '../components/rooms/RoomCodeCard';
import { NotificationPrompt } from '../components/system/NotificationPrompt';
import { ReportItemSheet } from '../components/items/ReportItemSheet';

const CATEGORY_ICON: Record<Category, typeof KitchenIcon> = {
  kitchen: KitchenIcon,
  bathroom: BathroomIcon,
  cleaning: CleaningIcon,
  other: BoxIcon,
};

export default function DashboardPage() {
  const [params, setParams] = useSearchParams();
  const [reportOpen, setReportOpen] = useState(false);
  const { metadata, roomCode, isAdmin, memberName, loading } = useRoom();
  const { user } = useAuth();
  const { items } = useItems('open');
  const { purchases, pendingApproval } = usePurchases();
  const { myBalance, isConsistent } = useBalances();
  const { requests } = useJoinRequests();
  const { unreadCount } = useNotifications();
  const { awaitingMyConfirmation } = useSettlements();

  const justCreated = params.get('created') === '1';

  /** כמה הוצאתי בפועל החודש — רק קניות שלי שאושרו/נסגרו */
  const spentThisMonth = useMemo(() => {
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    return purchases
      .filter(
        (p) =>
          p.boughtBy === user?.uid &&
          (p.status === 'approved' || p.status === 'settled') &&
          (p.date ?? 0) >= monthStart.getTime()
      )
      .reduce((sum, p) => sum + p.amount, 0);
  }, [purchases, user]);

  const hasAttentionItems =
    (isAdmin && (requests.length > 0 || pendingApproval.length > 0)) ||
    awaitingMyConfirmation.length > 0;

  if (loading) {
    return (
      <AppShell>
        <TopBar title="טוען…" />
        <div className="pt-4">
          <ListSkeleton rows={3} />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <TopBar
        title={metadata?.name ?? 'החדר שלי'}
        subtitle="חשבון החדר"
        actions={
          <>
            <Link
              to={`/r/${roomCode}/notifications`}
              aria-label={`התראות${unreadCount ? `, ${unreadCount} חדשות` : ''}`}
              className={[
                'tap relative grid place-items-center rounded-full transition-all duration-200 active:scale-90',
                unreadCount > 0
                  ? 'bg-brand-50 text-brand-700 hover:bg-brand-100'
                  : 'bg-ink-50 text-ink-500 hover:bg-ink-100 hover:text-ink-800',
              ].join(' ')}
            >
              <BellIcon width={19} height={19} filled={unreadCount > 0} />
              {unreadCount > 0 && (
                <span
                  className="animate-check-pop absolute -end-1 -top-1 grid h-5 min-w-5 place-items-center
                             rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white
                             ring-2 ring-white"
                >
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </Link>
            <Link
              to={`/r/${roomCode}/settings`}
              aria-label="הגדרות"
              className="tap grid place-items-center rounded-full bg-ink-50 text-ink-500
                         transition-all duration-200 hover:bg-ink-100 hover:text-ink-800 active:scale-90"
            >
              <SettingsIcon width={19} height={19} />
            </Link>
          </>
        }
      />

      <div className="space-y-4 pt-4">
        {justCreated && roomCode && (
          <div className="animate-slide-up">
            <div className="mb-2 flex items-center gap-2">
              <span aria-hidden className="text-lg">
                🎉
              </span>
              <p className="text-sm font-semibold text-ink-800">החדר נוצר! שתפו את הקוד</p>
              <button
                onClick={() => setParams({}, { replace: true })}
                className="ms-auto text-xs text-ink-400 hover:underline"
              >
                הבנתי
              </button>
            </div>
            <RoomCodeCard code={roomCode} roomName={metadata?.name ?? ''} />
          </div>
        )}

        {/* ── כרטיס יתרה — בסגנון דוח, לא כרטיס גרדיאנט ── */}
        <section className="rounded-card border border-ink-200/70 bg-white p-5 shadow-card">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-ink-600">היתרה שלי</p>
            <Badge tone={myBalance === 0 ? 'neutral' : myBalance > 0 ? 'success' : 'danger'}>
              {myBalance === 0 ? 'מאוזן' : myBalance > 0 ? 'מגיע לך' : 'אתה חייב'}
            </Badge>
          </div>

          <p
            className={[
              'num mt-2 font-mono text-4xl font-bold tracking-tight',
              myBalance === 0 ? 'text-ink-900' : myBalance > 0 ? 'text-emerald-700' : 'text-rose-700',
            ].join(' ')}
          >
            <span className="me-0.5 text-2xl font-semibold text-ink-400">₪</span>
            {formatAmount(myBalance)}
          </p>

          <div className="mt-4 grid grid-cols-2 divide-x divide-x-reverse divide-ink-100 border-t border-ink-100 pt-3.5">
            <div>
              <p className="num font-mono text-lg font-bold text-ink-900">
                {formatILS(spentThisMonth)}
              </p>
              <p className="mt-0.5 text-xs text-ink-500">הוצאת החודש</p>
            </div>
            <div className="ps-4 text-end">
              <p className="num font-mono text-lg font-bold text-ink-900">{items.length}</p>
              <p className="mt-0.5 text-xs text-ink-500">מוצרים חסרים</p>
            </div>
          </div>

          <Link
            to={`/r/${roomCode}/balances`}
            className="mt-4 flex items-center justify-center rounded-xl border border-ink-200
                       py-2.5 text-sm font-semibold text-ink-700 transition hover:bg-ink-50"
          >
            פירוט מלא ומאזן חברים
          </Link>

          {!isConsistent && (
            <p className="mt-3 rounded-lg bg-rose-50 px-2.5 py-1.5 text-xs text-rose-700">
              ⚠️ זוהתה אי-התאמה בחישוב המאזנים. פנו למנהל החדר.
            </p>
          )}
        </section>

        {/* ── קיצורי דרך ── */}
        <section className="grid grid-cols-3 gap-2">
          <button
            onClick={() => setReportOpen(true)}
            className="flex flex-col items-center gap-2 rounded-2xl bg-brand-700 py-3.5 text-white
                       transition active:scale-[.97]"
          >
            <PlusIcon width={19} height={19} />
            <span className="text-xs font-semibold">דיווח מוצר</span>
          </button>
          <Link
            to={`/r/${roomCode}/items`}
            className="flex flex-col items-center gap-2 rounded-2xl border border-ink-200 bg-white
                       py-3.5 text-ink-700 transition active:scale-[.97]"
          >
            <CartIcon width={19} height={19} />
            <span className="text-xs font-semibold">רשמתי קנייה</span>
          </Link>
          <Link
            to={`/r/${roomCode}/balances`}
            className="flex flex-col items-center gap-2 rounded-2xl border border-ink-200 bg-white
                       py-3.5 text-ink-700 transition active:scale-[.97]"
          >
            <ExchangeIcon width={19} height={19} />
            <span className="text-xs font-semibold">סגירת חוב</span>
          </Link>
        </section>

        {/* ── פעולות שדורשות תשומת לב ── */}
        {hasAttentionItems && (
          <section className="overflow-hidden rounded-card border border-ink-200/70 bg-white shadow-card">
            <p className="border-b border-ink-100 px-4 py-2.5 text-sm font-bold text-ink-700">
              דורש את אישורך
            </p>

            {awaitingMyConfirmation.length > 0 && (
              <Link
                to={`/r/${roomCode}/balances`}
                className="flex items-center gap-3 border-b border-ink-100 p-4 transition last:border-b-0 hover:bg-ink-50"
              >
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-emerald-50 text-emerald-700">
                  <ExchangeIcon width={16} height={16} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-ink-900">
                    {awaitingMyConfirmation.length === 1
                      ? 'תשלום ממתין לאישורך'
                      : `${awaitingMyConfirmation.length} תשלומים ממתינים לאישורך`}
                  </span>
                  <span className="num text-xs text-ink-500">
                    סה"כ {formatILS(awaitingMyConfirmation.reduce((a, s) => a + s.amount, 0))}
                  </span>
                </span>
                <Badge tone="success">{awaitingMyConfirmation.length}</Badge>
              </Link>
            )}

            {isAdmin && requests.length > 0 && (
              <Link
                to={`/r/${roomCode}/settings/members`}
                className="flex items-center gap-3 border-b border-ink-100 p-4 transition last:border-b-0 hover:bg-ink-50"
              >
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-sky-50 text-sky-700">
                  👋
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-ink-900">
                    {requests.length === 1
                      ? `${requests[0].displayName} מבקש להצטרף`
                      : `${requests.length} בקשות הצטרפות`}
                  </span>
                  <span className="text-xs text-ink-500">אישור או דחייה</span>
                </span>
                <Badge tone="info">{requests.length}</Badge>
              </Link>
            )}

            {isAdmin && pendingApproval.length > 0 && (
              <Link
                to={`/r/${roomCode}/balances`}
                className="flex items-center gap-3 p-4 transition hover:bg-ink-50"
              >
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-amber-50 text-amber-700">
                  <CartIcon width={16} height={16} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-ink-900">
                    {pendingApproval.length} קניות ממתינות לאישור
                  </span>
                  <span className="num text-xs text-ink-500">
                    סה"כ {formatILS(pendingApproval.reduce((a, p) => a + p.amount, 0))}
                  </span>
                </span>
                <Badge tone="warning">{pendingApproval.length}</Badge>
              </Link>
            )}
          </section>
        )}

        {/* ── הזמנה להפעיל התראות ── */}
        <NotificationPrompt />

        {/* ── מוצרים חסרים ── */}
        <section>
          <div className="mb-2 flex items-center justify-between px-1">
            <h2 className="text-sm font-bold text-ink-700">מוצרים חסרים</h2>
            <Link to={`/r/${roomCode}/items`} className="text-xs font-semibold text-brand-700">
              הצג הכל
            </Link>
          </div>

          {items.length === 0 ? (
            <div className="rounded-card border border-ink-200/70 bg-white px-4 py-8 text-center">
              <p className="text-sm font-semibold text-ink-800">אין מוצרים חסרים</p>
              <p className="mt-0.5 text-xs text-ink-500">הכל מלא. אפשר לנוח.</p>
            </div>
          ) : (
            <ul className="overflow-hidden rounded-card border border-ink-200/70 bg-white shadow-card">
              {items.slice(0, 4).map((item) => {
                const Icon = CATEGORY_ICON[item.category];
                return (
                  <li key={item.id} className="border-b border-ink-100 last:border-b-0">
                    <Link
                      to={`/r/${roomCode}/items`}
                      className="flex items-center gap-3 p-3.5 transition hover:bg-ink-50"
                    >
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-ink-100 text-ink-700">
                        <Icon width={16} height={16} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-1.5">
                          {item.priority === 'high' && (
                            <span
                              aria-label="דחוף"
                              className="h-1.5 w-1.5 shrink-0 rounded-full bg-rose-500"
                            />
                          )}
                          <span className="truncate text-sm font-semibold text-ink-900">
                            {item.name}
                          </span>
                        </span>
                        <span className="text-xs text-ink-500">
                          {memberName(item.reportedBy)} · {formatRelativeTime(item.reportedAt)}
                        </span>
                      </span>
                      {item.status === 'buying' && (
                        <Badge tone="brand">{memberName(item.assignedTo ?? '')} קונה</Badge>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {roomCode && !justCreated && (
          <details className="overflow-hidden rounded-card border border-ink-200/70 bg-white">
            <summary className="cursor-pointer list-none px-4 py-3.5 text-sm font-semibold text-ink-700">
              קוד החדר לשיתוף
            </summary>
            <div className="border-t border-ink-100 p-4">
              <RoomCodeCard code={roomCode} roomName={metadata?.name ?? ''} compact />
            </div>
          </details>
        )}

        <div className="pt-2 text-center">
          <Link to={`/r/${roomCode}/settings`}>
            <Button variant="ghost" size="sm">
              הגדרות
            </Button>
          </Link>
        </div>
      </div>

      <ReportItemSheet open={reportOpen} onClose={() => setReportOpen(false)} />
    </AppShell>
  );
}
