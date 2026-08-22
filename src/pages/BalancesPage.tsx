import { useMemo, useState } from 'react';
import { AppShell } from '../components/layout/AppShell';
import { RoomArchivedBanner } from '../components/system/RoomArchivedBanner';
import { TopBar } from '../components/layout/TopBar';
import { Avatar } from '../components/ui/Avatar';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { EmptyState, ErrorState } from '../components/ui/EmptyState';
import { ListSkeleton } from '../components/ui/Skeleton';
import { useBalances, useContributions, usePurchases, useSettlements } from '../hooks/useRoomData';
import { ContributionChart } from '../components/balances/ContributionChart';
import { useRoom } from '../store/RoomContext';
import { useAuth } from '../store/AuthContext';
import { useConnection } from '../store/ConnectionContext';
import { useToast } from '../store/ToastContext';
import { useConfirm } from '../store/ConfirmContext';
import {
  approvePurchase,
  confirmSettlement,
  createSettlement,
  rejectPurchase,
} from '../services/purchaseService';
import { simplifyDebts } from '../lib/money';
import { formatAmount, formatILS, formatSmartDate } from '../lib/format';
import { friendlyError } from '../lib/errors';
import { PURCHASE_STATUS_LABELS } from '../types/models';
import { useHintRef } from '../store/HintContext';

type Tab = 'summary' | 'pending' | 'history';

export default function BalancesPage() {
  const [tab, setTab] = useState<Tab>('summary');
  const { balances, myBalance, isConsistent, loading, error, fromCache } = useBalances();
  const { purchases, pendingApproval } = usePurchases();
  const { members, activeMembers, memberName, memberAvatar, isAdmin } = useRoom();
  const { user } = useAuth();

  /**
   * חברים שהוסרו מהחדר לא אמורים לבלגן את הרשימה לנצח — אבל אם עדיין
   * יש להם חוב פתוח, הוא לא נעלם ולא אמור להיעלם. אז: פעילים תמיד,
   * מוסרים רק אם המאזן שלהם התאפס.
   */
  const visibleMemberIds = useMemo(() => {
    const activeIds = new Set(activeMembers.map((m) => m.id));
    return members
      .filter((m) => activeIds.has(m.id) || (balances[m.id] ?? 0) !== 0)
      .map((m) => m.id);
  }, [members, activeMembers, balances]);

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

  const myBalanceHintRef = useHintRef<HTMLElement>(
    'balances.myBalanceCard',
    'מחושב אוטומטית מכל הקניות והתשלומים בחדר — לא צריך לחשב ידנית'
  );
  const tabHintRefs: Record<Tab, ReturnType<typeof useHintRef<HTMLButtonElement>>> = {
    summary: useHintRef<HTMLButtonElement>('balances.tab.summary', 'מי חייב למי, ומי נשא בכמה מההוצאות'),
    pending: useHintRef<HTMLButtonElement>('balances.tab.pending', 'קניות שממתינות לאישור מנהל לפני שהן נכנסות למאזן'),
    history: useHintRef<HTMLButtonElement>('balances.tab.history', 'כל הקניות שכבר טופלו בחדר'),
  };

  return (
    <AppShell>
      <TopBar title="חשבון והוצאות" />
      <RoomArchivedBanner />

      <div className="pt-4">
        {/* כרטיס המאזן האישי */}
        <section
          ref={myBalanceHintRef}
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
              ref={tabHintRefs[t.key]}
              onClick={() => setTab(t.key)}
              aria-pressed={tab === t.key}
              className={[
                'tap flex flex-1 items-center justify-center gap-1.5 rounded-xl px-3',
                'text-sm font-semibold transition',
                tab === t.key
                  ? 'bg-surface text-brand-800 shadow-card ring-1 ring-brand-200'
                  : 'bg-surface/50 text-ink-500',
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
          ) : error && !fromCache ? (
            // בלי זה, כשל קריאה של הקניות/התשלומים מוצג כ"אין חובות
            // פתוחים בחדר" — כלומר בדיוק ההפך ממה שקרה.
            <ErrorState message={friendlyError(error)} onRetry={() => location.reload()} />
          ) : tab === 'summary' ? (
            <SummaryTab
              transfers={myTransfers}
              allTransfers={transfers}
              balances={balances}
              memberIds={visibleMemberIds}
              memberName={memberName}
              memberAvatar={memberAvatar}
            />
          ) : tab === 'pending' ? (
            <PendingTab isAdmin={isAdmin} />
          ) : (
            <HistoryTab purchases={purchases} memberName={memberName} memberAvatar={memberAvatar} />
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
  memberAvatar,
}: {
  transfers: { from: string; to: string; amount: number }[];
  allTransfers: { from: string; to: string; amount: number }[];
  balances: Record<string, number>;
  memberIds: string[];
  memberName: (uid: string) => string;
  memberAvatar: (uid: string) => string | null;
}) {
  const { user, profile } = useAuth();
  const { roomCode, isArchived, memberName: roomMemberName, memberAvatar: roomMemberAvatar } = useRoom();
  const { isOnline } = useConnection();
  const toast = useToast();
  const confirm = useConfirm();
  const [busy, setBusy] = useState<string | null>(null);
  const { awaitingMyConfirmation, awaitingOthers } = useSettlements();

  const nothingPending = allTransfers.length === 0 && awaitingMyConfirmation.length === 0;

  const confirmSettlementHintRef = useHintRef<HTMLButtonElement>(
    'balances.confirmSettlement',
    'מאשר שקיבלת את הכסף בפועל — סוגר את החוב'
  );
  const transfersSectionHintRef = useHintRef<HTMLHeadingElement>(
    'balances.transfersSection',
    'הדרך הכי פשוטה לסגור את כל החובות — לא בהכרח מי-קנה-מה-למי'
  );
  const paySettlementHintRef = useHintRef<HTMLButtonElement>(
    'balances.paySettlement',
    'שולח בקשת אישור לצד השני — החוב ייסגר רק אחרי אישורו'
  );

  return (
    <div className="space-y-4">
      {/* ── הכל מאוזן — לא מחליף את שאר המסך, רק מודיע ── */}
      {nothingPending && (
        <div className="card flex items-center gap-2.5 p-4 text-sm text-ink-600">
          <span aria-hidden>✅</span>
          אין חובות פתוחים בחדר כרגע
        </div>
      )}

      {/* ── תשלומים שממתינים לאישור שלי ── */}
      {awaitingMyConfirmation.length > 0 && (
        <section>
          <h2 className="mb-2 px-1 text-sm font-bold text-amber-800">
            ממתין לאישורך — קיבלת את הכסף?
          </h2>
          <ul className="space-y-2">
            {awaitingMyConfirmation.map((s) => (
              <li
                key={s.id}
                className="card flex items-center gap-3 border-amber-200 bg-amber-50/60 p-4"
              >
                <Avatar name={roomMemberName(s.from)} uid={s.from} src={roomMemberAvatar(s.from)} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-ink-900">
                    {roomMemberName(s.from)} מסמן/ת שהעביר/ה לך
                  </p>
                  <p className="num text-lg font-bold text-emerald-700">{formatILS(s.amount)}</p>
                </div>
                <Button
                  ref={confirmSettlementHintRef}
                  size="sm"
                  disabled={!isOnline || isArchived || busy === s.id}
                  loading={busy === s.id}
                  onClick={async () => {
                    setBusy(s.id);
                    await toast.run(() =>
                      confirmSettlement(
                        roomCode!,
                        s.id,
                        user!.uid,
                        profile!.displayName,
                        s.from,
                        s.amount
                      )
                    );
                    setBusy(null);
                  }}
                >
                  קיבלתי
                </Button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {transfers.length > 0 && (
        <section>
          <h2 ref={transfersSectionHintRef} className="mb-2 px-1 text-sm font-bold text-ink-700">
            מה שנוגע לך
          </h2>
          <ul className="space-y-2">
            {transfers.map((t, i) => {
              const iOwe = t.from === user?.uid;
              const other = iOwe ? t.to : t.from;
              const key = `${t.from}-${t.to}-${i}`;
              const alreadySent = awaitingOthers.some((s) => s.from === t.from && s.to === t.to);
              return (
                <li key={key} className="card flex items-center gap-3 p-4">
                  <Avatar name={memberName(other)} uid={other} src={memberAvatar(other)} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-ink-900">
                      {iOwe ? `אתה חייב ל${memberName(other)}` : `${memberName(other)} חייב לך`}
                    </p>
                    <p className={`num text-lg font-bold ${iOwe ? 'text-rose-600' : 'text-emerald-700'}`}>
                      {formatILS(t.amount)}
                    </p>
                  </div>
                  {iOwe && alreadySent && (
                    <span className="shrink-0 text-xs font-medium text-amber-700">
                      ממתין לאישור {memberName(other)}
                    </span>
                  )}
                  {iOwe && !alreadySent && (
                    <Button
                      ref={paySettlementHintRef}
                      size="sm"
                      variant="secondary"
                      disabled={!isOnline || isArchived || busy === key}
                      loading={busy === key}
                      onClick={async () => {
                        const ok = await confirm({
                          title: 'רישום תשלום',
                          body: `${memberName(other)} יקבל/תקבל בקשת אישור. החוב ייסגר רק אחרי שיאשר/תאשר שקיבל/ה את ${formatILS(t.amount)}.`,
                          confirmLabel: 'כן, שילמתי',
                        });
                        if (!ok) return;
                        setBusy(key);
                        await toast.run(() =>
                          createSettlement(
                            roomCode!,
                            t.from,
                            memberName(t.from),
                            t.to,
                            t.amount
                          )
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
                <Avatar name={memberName(id)} uid={id} src={memberAvatar(id)} size="xs" />
                <span className="flex-1 truncate text-sm text-ink-800">{memberName(id)}</span>
                <span
                  className={`num text-sm font-bold ${
                    v > 0 ? 'text-emerald-700' : v < 0 ? 'text-rose-600' : 'text-ink-500'
                  }`}
                >
                  {v > 0 ? '↑ ' : v < 0 ? '↓ ' : ''}
                  {formatILS(Math.abs(v))}
                </span>
              </li>
            );
          })}
        </ul>
        <p className="mt-2 px-1 text-xs text-ink-500">
          ↑ מגיע לו · ↓ הוא חייב
        </p>
      </section>

      <ContributionsSection />
    </div>
  );
}

/* ═══════════════ מי נשא בכמה ═══════════════ */

/**
 * הסעיף הזה קיים בגלל "לקחתי על עצמי": כשאף אחד לא מחויב, המאזן תמיד
 * אפס — ואז אי אפשר לראות שאחד קונה כל שבוע והשני אף פעם. כאן זה גלוי.
 */
function ContributionsSection() {
  const { borne, paidOut, total, gap, next } = useContributions();
  const { activeMembers, memberName, memberAvatar } = useRoom();
  const { user } = useAuth();

  const average = total / Math.max(activeMembers.length, 1);

  const slices = activeMembers.map((m) => ({
    uid: m.id,
    name: memberName(m.id) + (m.id === user?.uid ? ' (אתה)' : ''),
    value: borne[m.id] ?? 0,
  }));

  const paidOutHintRef = useHintRef<HTMLHeadingElement>(
    'balances.contributionsPaidOut',
    'כמה שילמתם בפועל מהכיס — לא אותו דבר כמו היתרה שלכם'
  );
  const chartHintRef = useHintRef<HTMLDivElement>(
    'balances.contributionsChart',
    'מי נשא בהוצאות יחסית לממוצע, כולל קניות "על עצמי"'
  );

  return (
    <div className="space-y-4">
      {/* ── כמה כל אחד הוציא בפועל מהכיס ── */}
      <section>
        <h2 ref={paidOutHintRef} className="mb-2 px-1 text-sm font-bold text-ink-700">
          כמה כל אחד הוציא
        </h2>
        <ul className="card divide-y divide-ink-100">
          {[...activeMembers]
            .sort((a, b) => (paidOut[b.id] ?? 0) - (paidOut[a.id] ?? 0))
            .map((m) => {
              const isMe = m.id === user?.uid;
              return (
                <li key={m.id} className="flex items-center gap-3 px-4 py-3">
                  <Avatar name={memberName(m.id)} uid={m.id} src={memberAvatar(m.id)} size="xs" />
                  <span className={`flex-1 truncate text-sm ${isMe ? 'font-bold text-ink-900' : 'text-ink-800'}`}>
                    {memberName(m.id)}
                    {isMe && <span className="text-xs font-normal text-ink-500"> (אתה)</span>}
                  </span>
                  <span className="num text-sm font-bold text-ink-900">
                    {formatILS(paidOut[m.id] ?? 0)}
                  </span>
                </li>
              );
            })}
        </ul>
      </section>

      {/* ── אחוז מסך העלות שכל אחד נשא — רק כשיש נתון להראות ── */}
      {total > 0 ? (
        <section>
          <h2 className="mb-2 px-1 text-sm font-bold text-ink-700">מי נשא בכמה מהעלות</h2>
          <div ref={chartHintRef} className="card p-4">
            <ContributionChart slices={slices} total={total} />

            <div className="mt-4 flex items-center justify-between border-t border-ink-100 pt-3 text-xs">
              <span className="text-ink-500">
                סה"כ הוצאות החדר{' '}
                <span className="num font-semibold text-ink-800">{formatILS(total)}</span>
              </span>
              <span
                className={`num font-semibold ${gap > average * 0.5 ? 'text-amber-700' : 'text-emerald-700'}`}
              >
                {gap === 0 ? 'מאוזן לגמרי' : `פער ${formatILS(gap)}`}
              </span>
            </div>
          </div>

          {next && (
            <div className="mt-2 flex items-start gap-2.5 rounded-card bg-amber-50 px-3.5 py-3">
              <span aria-hidden className="text-lg">
                👉
              </span>
              <p className="text-sm leading-relaxed text-amber-900">
                <b>{memberName(next.userId)}</b> נשא ב־
                <span className="num font-semibold">{formatILS(next.behindBy)}</span> פחות מהממוצע.
                <span className="mt-0.5 block text-xs opacity-80">
                  הקנייה הבאה עליו — ככה זה נשאר הוגן בלי להתחשבן.
                </span>
              </p>
            </div>
          )}

          <p className="mt-2 px-1 text-xs leading-relaxed text-ink-500">
            כולל קניות שנרשמו כ"לקחתי על עצמי" — הן לא יוצרות חוב, אבל כן נספרות כאן.
          </p>
        </section>
      ) : (
        <p className="px-1 text-xs text-ink-500">
          עדיין אין קניות בחדר — כשיהיו, כאן יופיע מי נשא בכמה מהעלות.
        </p>
      )}
    </div>
  );
}

/* ═══════════════ ממתינות לאישור ═══════════════ */

function PendingTab({ isAdmin }: { isAdmin: boolean }) {
  const { pendingApproval } = usePurchases();
  const { roomCode, isArchived, memberName, memberAvatar } = useRoom();
  const { profile } = useAuth();
  const { user } = useAuth();
  const { isOnline } = useConnection();
  const toast = useToast();
  const confirm = useConfirm();
  const [busy, setBusy] = useState<string | null>(null);
  const approveHintRef = useHintRef<HTMLButtonElement>(
    'balances.pending.approve',
    'מאשר את הקנייה ומעדכן את המאזנים של כל החברים'
  );
  const rejectHintRef = useHintRef<HTMLButtonElement>(
    'balances.pending.reject',
    'דוחה את הקנייה ומבקש סיבה — לא ייכנס למאזן'
  );
  const sharesHintRef = useHintRef<HTMLUListElement>(
    'balances.pending.shares',
    'כך הסכום יתחלק בין החברים ברגע שהקנייה תאושר'
  );

  if (pendingApproval.length === 0) {
    return <EmptyState icon="📭" title="אין קניות ממתינות" body="כל הקניות טופלו." />;
  }

  return (
    <ul className="space-y-2.5">
      {pendingApproval.map((p, idx) => (
        <li key={p.id} className="card p-4">
          <div className="flex items-start gap-3">
            <Avatar name={memberName(p.boughtBy)} uid={p.boughtBy} src={memberAvatar(p.boughtBy)} size="sm" />
            <div className="min-w-0 flex-1">
              <h3 className="flex items-center gap-1.5 truncate font-bold text-ink-900">
                {p.title}
                {p.splitMethod === 'covered' && <Badge tone="success">על חשבונו</Badge>}
              </h3>
              <p className="text-xs text-ink-500">
                {memberName(p.boughtBy)} · {p.createdAt ? formatSmartDate(p.createdAt) : ''}
              </p>
            </div>
            <span className="num shrink-0 text-lg font-bold text-ink-900">
              {formatILS(p.amount)}
            </span>
          </div>

          <ul
            ref={idx === 0 ? sharesHintRef : undefined}
            className="mt-3 space-y-1 rounded-xl bg-ink-50 p-3"
          >
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
                ref={approveHintRef}
                size="sm"
                fullWidth
                disabled={!isOnline || isArchived || busy === p.id}
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
                ref={rejectHintRef}
                size="sm"
                variant="secondary"
                disabled={!isOnline || isArchived || busy === p.id}
                onClick={async () => {
                  const reason = await confirm.prompt({
                    title: 'דחיית קנייה',
                    label: 'סיבת הדחייה',
                    placeholder: 'לדוגמה: הסכום לא תואם לחשבונית',
                    optional: true,
                    confirmLabel: 'דחה קנייה',
                  });
                  if (reason === null) return;
                  setBusy(p.id);
                  await toast.run(() =>
                    rejectPurchase(roomCode!, user!.uid, profile!.displayName, p.id, reason || undefined)
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
  memberAvatar,
}: {
  purchases: ReturnType<typeof usePurchases>['purchases'];
  memberName: (uid: string) => string;
  memberAvatar: (uid: string) => string | null;
}) {
  const done = purchases.filter((p) => p.status !== 'pending');

  if (done.length === 0) {
    return <EmptyState icon="🧾" title="אין היסטוריה עדיין" body="קניות שיאושרו יופיעו כאן." />;
  }

  const total = done
    .filter((p) => p.status === 'approved' || p.status === 'settled')
    .reduce((a, p) => a + p.amount, 0);

  const totalHintRef = useHintRef<HTMLDivElement>(
    'balances.historyTotal',
    'סכום כל הקניות שאושרו או נסגרו — לא כולל קניות שנדחו'
  );
  const entryHintRef = useHintRef<HTMLParagraphElement>(
    'balances.historyEntry',
    'סטטוס הקנייה: אושרה, נדחתה, או ממתינה לאישור'
  );

  return (
    <>
      <div ref={totalHintRef} className="card mb-3 flex items-center justify-between p-4">
        <span className="text-sm font-semibold text-ink-700">סה"כ הוצאות החדר</span>
        <span className="num text-lg font-bold text-brand-800">{formatILS(total)}</span>
      </div>

      <ul className="card divide-y divide-ink-100">
        {done.map((p, idx) => (
          <li key={p.id} className="flex items-center gap-3 px-4 py-3">
            <Avatar name={memberName(p.boughtBy)} uid={p.boughtBy} src={memberAvatar(p.boughtBy)} size="xs" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-ink-900">{p.title}</p>
              <p className="text-xs text-ink-500">
                {memberName(p.boughtBy)} · {p.createdAt ? formatSmartDate(p.createdAt) : ''}
              </p>
            </div>
            <div className="shrink-0 text-end">
              <p className="num text-sm font-bold text-ink-900">{formatILS(p.amount)}</p>
              <p ref={idx === 0 ? entryHintRef : undefined} className="text-[11px] text-ink-500">
                {p.splitMethod === 'covered' ? '🙋 על חשבונו' : PURCHASE_STATUS_LABELS[p.status]}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
