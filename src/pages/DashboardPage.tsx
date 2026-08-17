import { Link, useSearchParams } from 'react-router-dom';
import { AppShell } from '../components/layout/AppShell';
import { TopBar } from '../components/layout/TopBar';
import { Avatar } from '../components/ui/Avatar';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { ListSkeleton } from '../components/ui/Skeleton';
import { BellIcon, ChevronIcon, SettingsIcon } from '../components/ui/icons';
import { useRoom } from '../store/RoomContext';
import { useAuth } from '../store/AuthContext';
import { useBalances, useItems, useJoinRequests, useNotifications, usePurchases } from '../hooks/useRoomData';
import { formatAmount, formatILS, formatRelativeTime } from '../lib/format';
import { CATEGORY_EMOJI, PRIORITY_LABELS } from '../types/models';
import { RoomCodeCard } from '../components/rooms/RoomCodeCard';

export default function DashboardPage() {
  const [params, setParams] = useSearchParams();
  const { metadata, roomCode, activeMembers, isAdmin, memberName, loading } = useRoom();
  const { profile } = useAuth();
  const { items } = useItems('open');
  const { pendingApproval } = usePurchases();
  const { myBalance, isConsistent } = useBalances();
  const { requests } = useJoinRequests();
  const { unreadCount } = useNotifications();

  const justCreated = params.get('created') === '1';
  const firstName = profile?.displayName?.split(' ')[0] ?? '';

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
        subtitle={`${activeMembers.length} חברים`}
        actions={
          <>
            <Link
              to={`/r/${roomCode}/notifications`}
              aria-label={`התראות${unreadCount ? `, ${unreadCount} חדשות` : ''}`}
              className="tap relative grid place-items-center rounded-full text-ink-500
                         transition hover:bg-ink-100 hover:text-ink-800"
            >
              <BellIcon width={21} height={21} />
              {unreadCount > 0 && (
                <span
                  className="absolute end-1.5 top-1.5 grid h-4 min-w-4 place-items-center
                             rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white"
                >
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </Link>
            {isAdmin && (
              <Link
                to={`/r/${roomCode}/settings`}
                aria-label="הגדרות חדר"
                className="tap grid place-items-center rounded-full text-ink-500
                           transition hover:bg-ink-100 hover:text-ink-800"
              >
                <SettingsIcon width={20} height={20} />
              </Link>
            )}
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

        {/* ── כרטיס המאזן ── */}
        <section
          className={[
            'rounded-card p-5 text-white shadow-lifted',
            myBalance >= 0
              ? 'bg-gradient-to-br from-emerald-600 to-teal-700'
              : 'bg-gradient-to-br from-rose-500 to-rose-700',
          ].join(' ')}
        >
          <p className="text-sm opacity-90">
            {firstName ? `שלום ${firstName},` : 'המאזן שלך'}
          </p>
          <p className="mt-1 text-sm opacity-90">
            {myBalance === 0
              ? 'החשבון שלך מאוזן'
              : myBalance > 0
                ? 'מגיע לך'
                : 'אתה חייב'}
          </p>
          <p className="num mt-1.5 text-4xl font-bold tracking-tight">
            ₪{formatAmount(myBalance)}
          </p>

          <Link
            to={`/r/${roomCode}/balances`}
            className="mt-4 inline-flex items-center gap-1 rounded-lg bg-white/20 px-3 py-1.5
                       text-sm font-semibold backdrop-blur transition hover:bg-white/30"
          >
            פירוט מלא
            <ChevronIcon width={16} height={16} className="rotate-180" />
          </Link>

          {!isConsistent && (
            <p className="mt-3 rounded-lg bg-black/20 px-2.5 py-1.5 text-xs">
              ⚠️ זוהתה אי-התאמה בחישוב המאזנים. פנו למנהל החדר.
            </p>
          )}
        </section>

        {/* ── פעולות שדורשות תשומת לב (מנהל) ── */}
        {isAdmin && (requests.length > 0 || pendingApproval.length > 0) && (
          <section className="space-y-2">
            <h2 className="px-1 text-sm font-bold text-ink-700">דורש את אישורך</h2>

            {requests.length > 0 && (
              <Link
                to={`/r/${roomCode}/members`}
                className="card flex items-center gap-3 p-4 transition active:scale-[.99] hover:shadow-lifted"
              >
                <span aria-hidden className="grid h-10 w-10 place-items-center rounded-xl bg-sky-50 text-lg">
                  👋
                </span>
                <span className="flex-1">
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

            {pendingApproval.length > 0 && (
              <Link
                to={`/r/${roomCode}/balances`}
                className="card flex items-center gap-3 p-4 transition active:scale-[.99] hover:shadow-lifted"
              >
                <span aria-hidden className="grid h-10 w-10 place-items-center rounded-xl bg-amber-50 text-lg">
                  🧾
                </span>
                <span className="flex-1">
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

        {/* ── מוצרים חסרים ── */}
        <section>
          <div className="mb-2 flex items-center justify-between px-1">
            <h2 className="text-sm font-bold text-ink-700">מוצרים חסרים</h2>
            <Link to={`/r/${roomCode}/items`} className="text-xs font-semibold text-brand-700">
              הצג הכל
            </Link>
          </div>

          {items.length === 0 ? (
            <div className="card px-4 py-8 text-center">
              <p aria-hidden className="text-3xl">
                🎉
              </p>
              <p className="mt-2 text-sm font-semibold text-ink-800">אין מוצרים חסרים</p>
              <p className="mt-0.5 text-xs text-ink-500">הכל מלא. אפשר לנוח.</p>
            </div>
          ) : (
            <ul className="space-y-2">
              {items.slice(0, 4).map((item) => (
                <li key={item.id}>
                  <Link
                    to={`/r/${roomCode}/items`}
                    className="card flex items-center gap-3 p-3.5 transition active:scale-[.99]"
                  >
                    <span aria-hidden className="text-xl">
                      {CATEGORY_EMOJI[item.category]}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-ink-900">
                        {item.name}
                      </span>
                      <span className="text-xs text-ink-500">
                        {memberName(item.reportedBy)} · {formatRelativeTime(item.reportedAt)}
                      </span>
                    </span>
                    {item.priority === 'high' && <Badge tone="danger">{PRIORITY_LABELS.high}</Badge>}
                    {item.status === 'buying' && (
                      <Badge tone="info">{memberName(item.assignedTo ?? '')} קונה</Badge>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* ── חברי החדר ── */}
        <section>
          <div className="mb-2 flex items-center justify-between px-1">
            <h2 className="text-sm font-bold text-ink-700">חברי החדר</h2>
            <Link to={`/r/${roomCode}/members`} className="text-xs font-semibold text-brand-700">
              נהל
            </Link>
          </div>
          <div className="card flex flex-wrap items-center gap-3 p-4">
            {activeMembers.map((m) => (
              <div key={m.id} className="flex w-14 flex-col items-center gap-1">
                <Avatar name={m.name} uid={m.id} src={m.avatar} size="sm" />
                <span className="w-full truncate text-center text-[11px] text-ink-600">
                  {m.name.split(' ')[0]}
                </span>
              </div>
            ))}
          </div>
        </section>

        {roomCode && !justCreated && (
          <details className="card overflow-hidden">
            <summary className="cursor-pointer list-none px-4 py-3.5 text-sm font-semibold text-ink-700">
              🔑 קוד החדר לשיתוף
            </summary>
            <div className="border-t border-ink-100 p-4">
              <RoomCodeCard code={roomCode} roomName={metadata?.name ?? ''} compact />
            </div>
          </details>
        )}

        <div className="pt-2 text-center">
          <Link to="/profile">
            <Button variant="ghost" size="sm">
              הגדרות חשבון
            </Button>
          </Link>
        </div>
      </div>
    </AppShell>
  );
}
