import { useMemo, useState } from 'react';
import { AppShell } from '../components/layout/AppShell';
import { TopBar } from '../components/layout/TopBar';
import { Avatar } from '../components/ui/Avatar';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import { ListSkeleton } from '../components/ui/Skeleton';
import { useBalances, usePurchases } from '../hooks/useRoomData';
import { useRoom } from '../store/RoomContext';
import { useAuth } from '../store/AuthContext';
import { useConnection } from '../store/ConnectionContext';
import { useToast } from '../store/ToastContext';
import { approvePurchase, createSettlement, rejectPurchase } from '../services/purchaseService';
import { simplifyDebts } from '../lib/money';
import { formatAmount, formatILS, formatSmartDate } from '../lib/format';
import { PURCHASE_STATUS_LABELS } from '../types/models';

type Tab = 'summary' | 'pending' | 'history';

export default function BalancesPage() {
  const [tab, setTab] = useState<Tab>('summary');
  const { balances, myBalance, isConsistent, loading } = useBalances();
  const { purchases, pendingApproval } = usePurchases();
  const { members, memberName, isAdmin } = useRoom();
  const { user } = useAuth();

  const transfers = useMemo(() => simplifyDebts(balances), [balances]);
  const myTransfers = useMemo(
    () => transfers.filter((t) => t.from === user?.uid || t.to === user?.uid),
    [transfers, user]
  );

  const TABS: { key: Tab; label: string; badge?: number }[] = [
    { key: 'summary', label: 'סיכום' },
    { key: 'pending', label: 'ממתינות', badge: pendingApproval.length },
    { key: 'history', label: 'היסטוריה' },
  ];

  return (
    <AppShell>
      <TopBar title="חשבון והוצאות" />

      <div className="pt-4">
        {/* כרטיס המאזן האישי */}
        <section
          className={[
            'rounded-card p-5 text-white shadow-lifted',
            myBalance >= 0
              ? 'bg-gradient-to-br from-emerald-600 to-teal-700'
              : 'bg-gradient-to-br from-rose-500 to-rose-700',
          ].join(' ')}
        >
          <p className="text-sm opacity-90">
            {myBalance === 0 ? 'החשבון שלך מאוזן' : myBalance > 0 ? 'מגיע לך' : 'אתה חייב'}
          </p>
          <p className="num mt-1 text-4xl font-bold tracking-tight">
            ₪{formatAmount(myBalance)}
          </p>
          {!isConsistent && (
            <p className="mt-3 rounded-lg bg-black/20 px-2.5 py-1.5 text-xs">
              ⚠️ סכום המאזנים בחדר אינו מתאפס. ייתכן שנתון חסר.
            </p>
          )}
        </section>

        {/* טאבים */}
        <div className="mt-4 flex gap-2">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              aria-pressed={tab === t.key}
              className={[
                'flex flex-1 items-center justify-center gap-1.5 rounded-xl px-3 py-2',
                'text-sm font-semibold transition',
                tab === t.key
                  ? 'bg-white text-brand-800 shadow-card ring-1 ring-brand-200'
                  : 'bg-white/50 text-ink-500',
              ].join(' ')}
            >
              {t.label}
              {!!t.badge && t.badge > 0 && <Badge tone="warning">{t.badge}</Badge>}
            </button>
          ))}
        </div>

        <div className="pt-4">
          {loading ? (
            <ListSkeleton rows={3} />
          ) : tab === 'summary' ? (
            <SummaryTab
              transfers={myTransfers}
              allTransfers={transfers}
              balances={balances}
              memberIds={members.map((m) => m.id)}
              memberName={memberName}
            />
          ) : tab === 'pending' ? (
            <PendingTab isAdmin={isAdmin} />
          ) : (
            <HistoryTab purchases={purchases} memberName={memberName} />
          )}
        </div>
      </div>
    </AppShell>
  );
}

/* ═══════════════ סיכום ═══════════════ */

function SummaryTab({
  transfers,
  allTransfers,
  balances,
  memberIds,
  memberName,
}: {
  transfers: { from: string; to: string; amount: number }[];
  allTransfers: { from: string; to: string; amount: number }[];
  balances: Record<string, number>;
  memberIds: string[];
  memberName: (uid: string) => string;
}) {
  const { user } = useAuth();
  const { roomCode } = useRoom();
  const { isOnline } = useConnection();
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);

  if (allTransfers.length === 0) {
    return (
      <EmptyState
        icon="✅"
        title="הכל מאוזן"
        body="אין חובות פתוחים בחדר. יפה מאוד."
      />
    );
  }

  return (
    <div className="space-y-4">
      {transfers.length > 0 && (
        <section>
          <h2 className="mb-2 px-1 text-sm font-bold text-ink-700">מה שנוגע לך</h2>
          <ul className="space-y-2">
            {transfers.map((t, i) => {
              const iOwe = t.from === user?.uid;
              const other = iOwe ? t.to : t.from;
              const key = `${t.from}-${t.to}-${i}`;
              return (
                <li key={key} className="card flex items-center gap-3 p-4">
                  <Avatar name={memberName(other)} uid={other} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-ink-900">
                      {iOwe ? `אתה חייב ל${memberName(other)}` : `${memberName(other)} חייב לך`}
                    </p>
                    <p className={`num text-lg font-bold ${iOwe ? 'text-rose-600' : 'text-emerald-600'}`}>
                      {formatILS(t.amount)}
                    </p>
                  </div>
                  {iOwe && (
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={!isOnline || busy === key}
                      loading={busy === key}
                      onClick={async () => {
                        if (!confirm(`לרשום תשלום של ${formatILS(t.amount)} ל${memberName(other)}?`))
                          return;
                        setBusy(key);
                        await toast.run(() =>
                          createSettlement(roomCode!, t.from, t.to, t.amount)
                        );
                        setBusy(null);
                      }}
                    >
                      שילמתי
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section>
        <h2 className="mb-2 px-1 text-sm font-bold text-ink-700">מאזן כל החברים</h2>
        <ul className="card divide-y divide-ink-100">
          {memberIds.map((id) => {
            const v = balances[id] ?? 0;
            return (
              <li key={id} className="flex items-center gap-3 px-4 py-3">
                <Avatar name={memberName(id)} uid={id} size="xs" />
                <span className="flex-1 truncate text-sm text-ink-800">{memberName(id)}</span>
                <span
                  className={`num text-sm font-bold ${
                    v > 0 ? 'text-emerald-600' : v < 0 ? 'text-rose-600' : 'text-ink-400'
                  }`}
                >
                  {v > 0 ? '↑ ' : v < 0 ? '↓ ' : ''}
                  {formatILS(Math.abs(v))}
                </span>
              </li>
            );
          })}
        </ul>
        <p className="mt-2 px-1 text-xs text-ink-400">
          ↑ מגיע לו · ↓ הוא חייב
        </p>
      </section>
    </div>
  );
}

/* ═══════════════ ממתינות לאישור ═══════════════ */

function PendingTab({ isAdmin }: { isAdmin: boolean }) {
  const { pendingApproval } = usePurchases();
  const { roomCode, memberName } = useRoom();
  const { profile } = useAuth();
  const { user } = useAuth();
  const { isOnline } = useConnection();
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);

  if (pendingApproval.length === 0) {
    return <EmptyState icon="📭" title="אין קניות ממתינות" body="כל הקניות טופלו." />;
  }

  return (
    <ul className="space-y-2.5">
      {pendingApproval.map((p) => (
        <li key={p.id} className="card p-4">
          <div className="flex items-start gap-3">
            <Avatar name={memberName(p.boughtBy)} uid={p.boughtBy} size="sm" />
            <div className="min-w-0 flex-1">
              <h3 className="truncate font-bold text-ink-900">{p.title}</h3>
              <p className="text-xs text-ink-500">
                {memberName(p.boughtBy)} · {p.createdAt ? formatSmartDate(p.createdAt) : ''}
              </p>
            </div>
            <span className="num shrink-0 text-lg font-bold text-ink-900">
              {formatILS(p.amount)}
            </span>
          </div>

          <ul className="mt-3 space-y-1 rounded-xl bg-ink-50 p-3">
            {Object.entries(p.shares ?? {}).map(([uid, share]) => (
              <li key={uid} className="flex justify-between text-xs">
                <span className="text-ink-600">{memberName(uid)}</span>
                <span className="num font-semibold text-ink-800">{formatILS(share)}</span>
              </li>
            ))}
          </ul>

          {isAdmin ? (
            <div className="mt-3 flex gap-2">
              <Button
                size="sm"
                fullWidth
                disabled={!isOnline || busy === p.id}
                loading={busy === p.id}
                onClick={async () => {
                  setBusy(p.id);
                  await toast.run(() =>
                    approvePurchase(roomCode!, user!.uid, profile!.displayName, p.id)
                  );
                  setBusy(null);
                }}
              >
                אישור
              </Button>
              <Button
                size="sm"
                variant="secondary"
                disabled={!isOnline || busy === p.id}
                onClick={async () => {
                  const reason = prompt('סיבת הדחייה (אופציונלי):') ?? undefined;
                  setBusy(p.id);
                  await toast.run(() =>
                    rejectPurchase(roomCode!, user!.uid, profile!.displayName, p.id, reason)
                  );
                  setBusy(null);
                }}
              >
                דחייה
              </Button>
            </div>
          ) : (
            <p className="mt-3 text-xs text-ink-500">ממתין לאישור מנהל החדר</p>
          )}
        </li>
      ))}
    </ul>
  );
}

/* ═══════════════ היסטוריה ═══════════════ */

function HistoryTab({
  purchases,
  memberName,
}: {
  purchases: ReturnType<typeof usePurchases>['purchases'];
  memberName: (uid: string) => string;
}) {
  const done = purchases.filter((p) => p.status !== 'pending');

  if (done.length === 0) {
    return <EmptyState icon="🧾" title="אין היסטוריה עדיין" body="קניות שיאושרו יופיעו כאן." />;
  }

  const total = done
    .filter((p) => p.status === 'approved' || p.status === 'settled')
    .reduce((a, p) => a + p.amount, 0);

  return (
    <>
      <div className="card mb-3 flex items-center justify-between p-4">
        <span className="text-sm font-semibold text-ink-700">סה"כ הוצאות החדר</span>
        <span className="num text-lg font-bold text-brand-800">{formatILS(total)}</span>
      </div>

      <ul className="card divide-y divide-ink-100">
        {done.map((p) => (
          <li key={p.id} className="flex items-center gap-3 px-4 py-3">
            <Avatar name={memberName(p.boughtBy)} uid={p.boughtBy} size="xs" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-ink-900">{p.title}</p>
              <p className="text-xs text-ink-500">
                {memberName(p.boughtBy)} · {p.createdAt ? formatSmartDate(p.createdAt) : ''}
              </p>
            </div>
            <div className="shrink-0 text-end">
              <p className="num text-sm font-bold text-ink-900">{formatILS(p.amount)}</p>
              <p className="text-[11px] text-ink-400">{PURCHASE_STATUS_LABELS[p.status]}</p>
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
