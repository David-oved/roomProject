import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AppShell } from '../components/layout/AppShell';
import { TopBar } from '../components/layout/TopBar';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { ErrorState } from '../components/ui/EmptyState';
import { ListSkeleton } from '../components/ui/Skeleton';
import {
  BathroomIcon,
  BellIcon,
  BoxIcon,
  CartIcon,
  CleaningIcon,
  ExchangeIcon,
  KitchenIcon,
  MegaphoneIcon,
  PlusIcon,
  SettingsIcon,
} from '../components/ui/icons';
import { useRoom } from '../store/RoomContext';
import { useAuth } from '../store/AuthContext';
import {
  useAnnouncements,
  useBalances,
  useItems,
  useJoinRequests,
  useNotifications,
  usePurchases,
  useSettlements,
  useTasks,
  useTaskTransfers,
} from '../hooks/useRoomData';
import { formatAmount, formatILS, formatRelativeTime, formatSmartDate } from '../lib/format';
import { friendlyError } from '../lib/errors';
import { CATEGORY_EMOJI, type Category } from '../types/models';
import { RoomCodeCard } from '../components/rooms/RoomCodeCard';
import { NotificationPrompt } from '../components/system/NotificationPrompt';
import { InstallPrompt } from '../components/system/InstallPrompt';
import { AdminMessageBanner } from '../components/system/AdminMessageBanner';
import { RoomArchivedBanner } from '../components/system/RoomArchivedBanner';
import { ReportItemSheet } from '../components/items/ReportItemSheet';
import { AddTaskSheet } from '../components/tasks/AddTaskSheet';
import { completeTask } from '../services/taskService';
import { useToast } from '../store/ToastContext';
import { useConnection } from '../store/ConnectionContext';
import { useHintRef } from '../store/HintContext';

const CATEGORY_ICON: Record<Category, typeof KitchenIcon> = {
  kitchen: KitchenIcon,
  bathroom: BathroomIcon,
  cleaning: CleaningIcon,
  other: BoxIcon,
};

export default function DashboardPage() {
  const [params, setParams] = useSearchParams();
  const [reportOpen, setReportOpen] = useState(false);
  const [addTaskOpen, setAddTaskOpen] = useState(false);
  const [busyTaskId, setBusyTaskId] = useState<string | null>(null);
  const {
    metadata,
    roomCode,
    isAdmin,
    isArchived,
    memberName,
    loading,
    error: roomError,
    fromCache,
  } = useRoom();
  const { user, profile } = useAuth();
  const { isOnline } = useConnection();
  const toast = useToast();
  // חדר בארכיון הוא לקריאה בלבד — אותה השבתה בדיוק כמו מצב אופליין
  const canWrite = isOnline && !isArchived;
  const { items, error: itemsError } = useItems('open');
  const { purchases, pendingApproval } = usePurchases();
  const { myBalance, isConsistent, error: balancesError } = useBalances();
  const { requests } = useJoinRequests();
  const { unreadCount } = useNotifications();
  const { awaitingMyConfirmation } = useSettlements();
  const { myTasks } = useTasks();
  const { incoming: incomingTaskTransfers } = useTaskTransfers();
  const { announcements } = useAnnouncements();
  const latestAnnouncement = announcements[0];

  const justCreated = params.get('created') === '1';

  // ‼️ הערות-הקשר: מזהה קבוע לכל אלמנט, מוצג פעם אחת בביקור ראשון —
  // ראו HintContext. מקובצים כאן כדי לא לפזר useHintRef על פני כל
  // ה-JSX; הטקסטים עצמם קבועים ולכן אין סיכון מ-hooks מותנים.
  const notificationsHintRef = useHintRef<HTMLAnchorElement>(
    'dashboard.notifications',
    'כאן מופיעות התראות על תשלומים, מטלות ובקשות שממתינות לך'
  );
  const settingsHintRef = useHintRef<HTMLAnchorElement>(
    'dashboard.settings',
    'ניהול החדר, החברים והפרטים שלכם נמצא כאן'
  );
  const balanceDetailsHintRef = useHintRef<HTMLAnchorElement>(
    'dashboard.balanceDetails',
    'רואים כאן פירוט מלא של מי חייב למי כמה'
  );
  const reportShortcutHintRef = useHintRef<HTMLButtonElement>(
    'dashboard.reportShortcut',
    'לחיצה פותחת דיווח מהיר על מוצר שנגמר בבית'
  );
  const buyShortcutHintRef = useHintRef<HTMLAnchorElement>(
    'dashboard.buyShortcut',
    'עוברים לרשימת המוצרים כדי לסמן קנייה שביצעתם'
  );
  const settleShortcutHintRef = useHintRef<HTMLAnchorElement>(
    'dashboard.settleShortcut',
    'משם אפשר לסגור חובות ולעדכן תשלומים בין שותפים'
  );
  const confirmSettlementHintRef = useHintRef<HTMLAnchorElement>(
    'dashboard.confirmSettlement',
    'מישהו סימן שהחזיר לך כסף — אשרו כדי לעדכן מאזן'
  );
  const taskTransferHintRef = useHintRef<HTMLAnchorElement>(
    'dashboard.taskTransferIncoming',
    'שותף מבקש להעביר לך מטלה — כאן מאשרים או דוחים'
  );
  const joinRequestsHintRef = useHintRef<HTMLAnchorElement>(
    'dashboard.joinRequests',
    'מישהו מבקש להצטרף לחדר — מנהלים מאשרים כאן'
  );
  const pendingPurchasesHintRef = useHintRef<HTMLAnchorElement>(
    'dashboard.pendingPurchases',
    'קניות שממתינות לאישור מנהל לפני שהן משפיעות על המאזן'
  );
  const itemsSeeAllHintRef = useHintRef<HTMLAnchorElement>(
    'dashboard.itemsSeeAll',
    'רואים כאן את כל רשימת המוצרים החסרים'
  );
  const itemRowHintRef = useHintRef<HTMLAnchorElement>(
    'dashboard.itemRow',
    'לחיצה פותחת את רשימת המוצרים המלאה עם כל הפרטים'
  );
  const addTaskHintRef = useHintRef<HTMLButtonElement>(
    'dashboard.addTask',
    'מוסיפים כאן מטלה קבועה חדשה לחברי החדר'
  );
  const tasksSeeAllHintRef = useHintRef<HTMLAnchorElement>(
    'dashboard.tasksSeeAll',
    'רואים כאן את כל המטלות של כל השותפים'
  );
  const taskCompleteHintRef = useHintRef<HTMLButtonElement>(
    'dashboard.taskComplete',
    'מסמן שהמטלה בוצעה ומעביר אותה הלאה בתור'
  );
  const announcementCardHintRef = useHintRef<HTMLAnchorElement>(
    'dashboard.announcementCard',
    'רואים כאן את כל ההודעות שהמנהל שלח לחדר'
  );
  const roomCodeDetailsHintRef = useHintRef<HTMLElement>(
    'dashboard.roomCodeDetails',
    'פותח את קוד ההצטרפות לחדר כדי לשתף עם שותפים'
  );

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
    awaitingMyConfirmation.length > 0 ||
    incomingTaskTransfers.length > 0;

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

  // ‼️ הדשבורד מציג יתרה, מוצרים ומטלות — כל אחד מהם נראה תקין גם כשהוא
  // ריק. בלי הבדיקה הזו, כשל הרשאה (למשל הסרה מהחדר תוך כדי צפייה)
  // מוצג כ"₪0.00, אין מוצרים חסרים, אין לך מטלות" — מסך שקרי לחלוטין.
  const fatalError = roomError ?? itemsError ?? balancesError;
  if (fatalError && !fromCache) {
    return (
      <AppShell>
        <TopBar title={metadata?.name ?? 'החדר שלי'} />
        <ErrorState message={friendlyError(fatalError)} onRetry={() => location.reload()} />
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
              ref={notificationsHintRef}
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
              ref={settingsHintRef}
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
        {/* ‼️ שני הבאנרים לפני כל השאר: הודעה ממנהל המערכת וחדר בארכיון
            הם דברים שמשנים מה אפשר לעשות במסך הזה, ולכן הם חייבים
            להופיע לפני הפעולות ולא אחריהן. */}
        <AdminMessageBanner />
        <RoomArchivedBanner />

        {justCreated && roomCode && (
          <div className="animate-slide-up">
            <div className="mb-2 flex items-center gap-2">
              <span aria-hidden className="text-lg">
                🎉
              </span>
              <p className="text-sm font-semibold text-ink-800">החדר נוצר! שתפו את הקוד</p>
              <button
                onClick={() => setParams({}, { replace: true })}
                className="tap-area ms-auto text-xs text-ink-500 hover:underline"
              >
                הבנתי
              </button>
            </div>
            <RoomCodeCard code={roomCode} roomName={metadata?.name ?? ''} />
          </div>
        )}

        {/* ── כרטיס יתרה — בסגנון דוח, לא כרטיס גרדיאנט ── */}
        <section className="rounded-card border border-ink-200/70 bg-surface p-5 shadow-card">
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
            <span className="me-0.5 text-2xl font-semibold text-ink-500">₪</span>
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
            ref={balanceDetailsHintRef}
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
            ref={reportShortcutHintRef}
            onClick={() => setReportOpen(true)}
            disabled={!canWrite}
            title={isArchived ? 'החדר בארכיון — לצפייה בלבד' : undefined}
            className="flex flex-col items-center gap-2 rounded-2xl bg-brand-700 py-3.5 text-white
                       transition active:scale-[.97] disabled:bg-ink-300 disabled:active:scale-100"
          >
            <PlusIcon width={19} height={19} />
            <span className="text-xs font-semibold">דיווח מוצר</span>
          </button>
          <Link
            ref={buyShortcutHintRef}
            to={`/r/${roomCode}/items`}
            className="flex flex-col items-center gap-2 rounded-2xl border border-ink-200 bg-surface
                       py-3.5 text-ink-700 transition active:scale-[.97]"
          >
            <CartIcon width={19} height={19} />
            <span className="text-xs font-semibold">רשמתי קנייה</span>
          </Link>
          <Link
            ref={settleShortcutHintRef}
            to={`/r/${roomCode}/balances`}
            className="flex flex-col items-center gap-2 rounded-2xl border border-ink-200 bg-surface
                       py-3.5 text-ink-700 transition active:scale-[.97]"
          >
            <ExchangeIcon width={19} height={19} />
            <span className="text-xs font-semibold">סגירת חוב</span>
          </Link>
        </section>

        {/* ── פעולות שדורשות תשומת לב ── */}
        {hasAttentionItems && (
          <section className="overflow-hidden rounded-card border border-ink-200/70 bg-surface shadow-card">
            <p className="border-b border-ink-100 px-4 py-2.5 text-sm font-bold text-ink-700">
              דורש את אישורך
            </p>

            {awaitingMyConfirmation.length > 0 && (
              <Link
                ref={confirmSettlementHintRef}
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

            {incomingTaskTransfers.length > 0 && (
              <Link
                ref={taskTransferHintRef}
                to={`/r/${roomCode}/tasks`}
                className="flex items-center gap-3 border-b border-ink-100 p-4 transition last:border-b-0 hover:bg-ink-50"
              >
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-amber-50 text-amber-700">
                  <ExchangeIcon width={16} height={16} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-ink-900">
                    {incomingTaskTransfers.length === 1
                      ? `${memberName(incomingTaskTransfers[0].fromUid)} מבקש/ת להעביר לך מטלה`
                      : `${incomingTaskTransfers.length} בקשות העברת מטלה`}
                  </span>
                  <span className="text-xs text-ink-500">אישור או דחייה</span>
                </span>
                <Badge tone="warning">{incomingTaskTransfers.length}</Badge>
              </Link>
            )}

            {isAdmin && requests.length > 0 && (
              <Link
                ref={joinRequestsHintRef}
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
                ref={pendingPurchasesHintRef}
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

        {/* ── הזמנה להתקין למסך הבית ── */}
        <InstallPrompt />

        {/* ── הזמנה להפעיל התראות ── */}
        <NotificationPrompt />

        {/* ── מוצרים חסרים ── */}
        <section>
          <div className="mb-2 flex items-center justify-between px-1">
            <h2 className="text-sm font-bold text-ink-700">מוצרים חסרים</h2>
            <Link
              ref={itemsSeeAllHintRef}
              to={`/r/${roomCode}/items`}
              className="tap-area text-xs font-semibold text-brand-700"
            >
              הצג הכל
            </Link>
          </div>

          {items.length === 0 ? (
            <div className="rounded-card border border-ink-200/70 bg-surface px-4 py-8 text-center">
              <p className="text-sm font-semibold text-ink-800">אין מוצרים חסרים</p>
              <p className="mt-0.5 text-xs text-ink-500">הכל מלא. אפשר לנוח.</p>
            </div>
          ) : (
            <ul className="overflow-hidden rounded-card border border-ink-200/70 bg-surface shadow-card">
              {items.slice(0, 4).map((item, idx) => {
                const Icon = CATEGORY_ICON[item.category];
                return (
                  <li key={item.id} className="border-b border-ink-100 last:border-b-0">
                    <Link
                      ref={idx === 0 ? itemRowHintRef : undefined}
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

        {/* ── המטלות שלי ── */}
        <section>
          <div className="mb-2 flex items-center justify-between px-1">
            <h2 className="text-sm font-bold text-ink-700">המטלות שלי</h2>
            <div className="flex items-center gap-3">
              {isAdmin && (
                <button
                  ref={addTaskHintRef}
                  onClick={() => setAddTaskOpen(true)}
                  disabled={!canWrite}
                  className="tap-area text-xs font-semibold text-brand-700 disabled:text-ink-300"
                >
                  + מטלה
                </button>
              )}
              <Link
                ref={tasksSeeAllHintRef}
                to={`/r/${roomCode}/tasks`}
                className="tap-area text-xs font-semibold text-brand-700"
              >
                הצג הכל
              </Link>
            </div>
          </div>

          {myTasks.length === 0 ? (
            <div className="rounded-card border border-ink-200/70 bg-surface px-4 py-8 text-center">
              <p className="text-sm font-semibold text-ink-800">אין לך מטלות ממתינות</p>
              <p className="mt-0.5 text-xs text-ink-500">
                {isAdmin ? 'אפשר להוסיף מטלה קבועה חדשה.' : 'תורך יופיע כאן כשיגיע.'}
              </p>
            </div>
          ) : (
            <ul className="overflow-hidden rounded-card border border-ink-200/70 bg-surface shadow-card">
              {myTasks.slice(0, 4).map((t, idx) => {
                const overdue = (t.dueAt ?? 0) < Date.now();
                return (
                  <li key={t.id} className="flex items-center gap-3 border-b border-ink-100 p-3.5 last:border-b-0">
                    <span aria-hidden className="text-xl">
                      {CATEGORY_EMOJI[t.category]}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-ink-900">{t.name}</span>
                      <span className={`text-xs ${overdue ? 'font-semibold text-rose-600' : 'text-ink-500'}`}>
                        {overdue ? 'באיחור · ' : ''}
                        {t.dueAt ? formatSmartDate(t.dueAt) : ''}
                      </span>
                    </span>
                    <Button
                      ref={idx === 0 ? taskCompleteHintRef : undefined}
                      size="sm"
                      variant="secondary"
                      disabled={!canWrite || busyTaskId === t.id}
                      loading={busyTaskId === t.id}
                      onClick={async () => {
                        setBusyTaskId(t.id);
                        await toast.run(() => completeTask(roomCode!, t, user!.uid, profile?.displayName ?? ''));
                        setBusyTaskId(null);
                      }}
                    >
                      בוצע
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* ── הודעות מהמנהל ── */}
        {latestAnnouncement && (
          <Link
            ref={announcementCardHintRef}
            to={`/r/${roomCode}/announcements`}
            className="card flex items-center gap-3 p-3.5 transition hover:shadow-lifted"
          >
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand-50 text-brand-700">
              <MegaphoneIcon width={16} height={16} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-xs font-semibold text-ink-500">הודעה מהמנהל</span>
              <span className="block truncate text-sm text-ink-900">{latestAnnouncement.text}</span>
            </span>
            <span className="shrink-0 text-xs text-ink-500">
              {latestAnnouncement.sentAt ? formatSmartDate(latestAnnouncement.sentAt) : ''}
            </span>
          </Link>
        )}

        {roomCode && !justCreated && (
          <details className="overflow-hidden rounded-card border border-ink-200/70 bg-surface">
            <summary
              ref={roomCodeDetailsHintRef}
              className="cursor-pointer list-none px-4 py-3.5 text-sm font-semibold text-ink-700"
            >
              קוד החדר לשיתוף
            </summary>
            <div className="border-t border-ink-100 p-4">
              <RoomCodeCard code={roomCode} roomName={metadata?.name ?? ''} compact />
            </div>
          </details>
        )}

        <div className="pt-2 text-center">
          {/* ‼️ אלמנט אחד ולא <Link> שעוטף <Button>: קינון כזה אינו HTML
              חוקי, יוצר שתי תחנות Tab על אותו יעד, וקורא מסך מכריז עליו
              "קישור, כפתור". הסגנון זהה ל-Button variant="ghost" size="sm". */}
          <Link
            to={`/r/${roomCode}/settings`}
            className="inline-flex min-h-[44px] h-11 select-none items-center justify-center
                       gap-1.5 rounded-xl px-3.5 text-sm font-semibold text-ink-600
                       transition-[background-color,transform] duration-150
                       hover:bg-ink-100 active:bg-ink-200 active:scale-[.98]"
          >
            הגדרות
          </Link>
        </div>
      </div>

      {/* ‼️ מרכיבים רק כשפתוח. GlassModal מחזיר null כשסגור, אבל רק *אחרי*
          שההוקים של הגיליון כבר רצו (useCatalog, useItems) — האזנות RTDB
          פתוחות לגיליון שאינו מוצג. אין אנימציית יציאה שנפגעת. */}
      {reportOpen && <ReportItemSheet open onClose={() => setReportOpen(false)} />}
      {addTaskOpen && <AddTaskSheet open onClose={() => setAddTaskOpen(false)} />}
    </AppShell>
  );
}
