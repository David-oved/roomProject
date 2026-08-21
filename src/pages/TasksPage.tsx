import { useState } from 'react';
import { AppShell } from '../components/layout/AppShell';
import { RoomArchivedBanner } from '../components/system/RoomArchivedBanner';
import { TopBar } from '../components/layout/TopBar';
import { Avatar } from '../components/ui/Avatar';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { EmptyState, ErrorState } from '../components/ui/EmptyState';
import { ListSkeleton } from '../components/ui/Skeleton';
import { ExchangeIcon } from '../components/ui/icons';
import { AddTaskSheet } from '../components/tasks/AddTaskSheet';
import { TransferRequestSheet } from '../components/tasks/TransferRequestSheet';
import { useTasks, useTaskTransfers, useTaskFairness } from '../hooks/useRoomData';
import { useRoom } from '../store/RoomContext';
import { useAuth } from '../store/AuthContext';
import { useConnection } from '../store/ConnectionContext';
import { useToast } from '../store/ToastContext';
import { useConfirm } from '../store/ConfirmContext';
import { completeTask, deleteTask, respondTaskTransfer } from '../services/taskService';
import { formatSmartDate } from '../lib/format';
import { friendlyError } from '../lib/errors';
import { CATEGORY_EMOJI, CATEGORY_LABELS, type Task, type TaskTransfer, type WithId } from '../types/models';
import { useHintRef } from '../store/HintContext';

export default function TasksPage() {
  const { roomCode, isAdmin, isArchived, memberName, activeMembers } = useRoom();
  const { user, profile } = useAuth();
  const { isOnline } = useConnection();
  const { tasks, loading, error, fromCache } = useTasks();
  const { incoming } = useTaskTransfers();
  const { counts: fairness } = useTaskFairness();
  const toast = useToast();
  const confirm = useConfirm();

  const [addOpen, setAddOpen] = useState(false);
  const [transferring, setTransferring] = useState<WithId<Task> | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const guard = { disabled: !isOnline || isArchived };

  const addTaskHintRef = useHintRef<HTMLButtonElement>(
    'tasks.add',
    'מוסיפים כאן מטלה קבועה חדשה לחברי החדר'
  );
  // ‼️ מזהה נפרד, לא משותף עם addTaskHintRef — שני הכפתורים מורכבים
  // בו-זמנית כשאין עדיין מטלות (כותרת + EmptyState). ראו ההסבר הזהה
  // ב-ItemsPage.tsx.
  const addTaskEmptyHintRef = useHintRef<HTMLButtonElement>(
    'tasks.addEmpty',
    'מוסיפים כאן מטלה קבועה חדשה לחברי החדר'
  );
  const transferAcceptHintRef = useHintRef<HTMLButtonElement>(
    'tasks.transferAccept',
    'מאשר שאתה לוקח את התור — המטלה עוברת אליך'
  );
  const transferRejectHintRef = useHintRef<HTMLButtonElement>(
    'tasks.transferReject',
    'דוחה את הבקשה — התור נשאר אצל המבקש'
  );
  const rowHintRef = useHintRef<HTMLParagraphElement>(
    'tasks.row',
    'כשמסמנים "בוצע", המטלה עוברת אוטומטית לחבר הבא בתור'
  );
  const completeHintRef = useHintRef<HTMLButtonElement>(
    'tasks.complete',
    'מסמן שביצעת את המטלה — התור עובר הלאה בסבב'
  );
  const requestTransferHintRef = useHintRef<HTMLButtonElement>(
    'tasks.requestTransfer',
    'פותח בחירת חבר להעברת התור — צריך את אישורו'
  );
  const deleteHintRef = useHintRef<HTMLButtonElement>(
    'tasks.delete',
    'מוחק את המטלה לצמיתות אחרי אישור בחלון קופץ'
  );
  const fairnessHintRef = useHintRef<HTMLHeadingElement>(
    'tasks.fairness',
    'כמה מטלות כל אחד השלים ב-30 הימים האחרונים'
  );
  // אינדקס המטלה הראשונה שהתור בה שלי — לא בהכרח השורה הראשונה ברשימה,
  // ולכן הערות "בוצע"/"בקשת העברה" חייבות לעגן שם ולא ב-idx===0 הסתמי.
  const firstMineIdx = tasks.findIndex((t) => t.currentAssignee === user?.uid);

  async function run(key: string, fn: () => Promise<unknown>) {
    setBusy(key);
    await toast.run(fn);
    setBusy(null);
  }

  return (
    <AppShell>
      <TopBar
        title="מטלות"
        back={`/r/${roomCode}`}
        actions={
          isAdmin && (
            <Button ref={addTaskHintRef} size="sm" onClick={() => setAddOpen(true)} disabled={!isOnline || isArchived}>
              + מטלה
            </Button>
          )
        }
      />
      <RoomArchivedBanner />

      <div className="space-y-5 pt-4">
        {incoming.length > 0 && (
          <section>
            <h2 className="mb-2 px-1 text-sm font-bold text-amber-800">ממתין לתשובתך</h2>
            <ul className="space-y-2">
              {incoming.map((t, idx) => (
                <li key={t.id} className="card flex items-center gap-3 border-amber-200 bg-amber-50/60 p-4">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-amber-100 text-amber-700">
                    <ExchangeIcon width={16} height={16} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-ink-900">
                      {memberName(t.fromUid)} מבקש/ת שתיקח/י את "{t.taskName}"
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-1.5">
                    <Button
                      ref={idx === 0 ? transferAcceptHintRef : undefined}
                      size="sm"
                      disabled={!isOnline || isArchived || busy === t.id}
                      loading={busy === t.id}
                      onClick={() => run(t.id, () => respondToTransfer(t, true))}
                    >
                      אישור
                    </Button>
                    <Button
                      ref={idx === 0 ? transferRejectHintRef : undefined}
                      size="sm"
                      variant="ghost"
                      disabled={!isOnline || isArchived || busy === t.id}
                      onClick={() => run(t.id, () => respondToTransfer(t, false))}
                    >
                      דחייה
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section>
          <h2 className="mb-2 px-1 text-sm font-bold text-ink-700">כל המטלות</h2>

          {loading ? (
            <ListSkeleton rows={3} />
          ) : error && !fromCache ? (
            // ‼️ לפני הבדיקה הזו, משתמש שהוסר מהחדר ראה "עדיין אין מטלות
            // קבועות": useRtdbList מנקה את data ל-[] ב-permission_denied,
            // וזה נראה בדיוק כמו חדר בלי מטלות.
            <ErrorState message={friendlyError(error)} onRetry={() => location.reload()} />
          ) : tasks.length === 0 ? (
            <EmptyState
              icon="🧹"
              title="עדיין אין מטלות קבועות"
              body={isAdmin ? 'הוסיפו מטלה ראשונה — למשל שטיפת כלים או פינוי אשפה.' : 'המנהל עדיין לא הוסיף מטלות קבועות.'}
              action={
                isAdmin && (
                  <Button ref={addTaskEmptyHintRef} onClick={() => setAddOpen(true)} disabled={!isOnline || isArchived}>
                    הוספת מטלה
                  </Button>
                )
              }
            />
          ) : (
            <ul className="space-y-2.5">
              {tasks.map((t, idx) => {
                const mine = t.currentAssignee === user?.uid;
                const overdue = (t.dueAt ?? 0) < Date.now();
                return (
                  <li key={t.id} className="card p-4">
                    <div className="flex items-start gap-3">
                      <span aria-hidden className="mt-0.5 text-2xl">
                        {CATEGORY_EMOJI[t.category]}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <h3 className="min-w-0 flex-1 truncate font-bold text-ink-900">{t.name}</h3>
                          {overdue && <Badge tone="danger">באיחור</Badge>}
                        </div>
                        <p
                          ref={idx === 0 ? rowHintRef : undefined}
                          className="mt-0.5 flex items-center gap-1.5 text-xs text-ink-500"
                        >
                          <Avatar name={memberName(t.currentAssignee)} uid={t.currentAssignee} size="xs" />
                          {mine ? 'התור שלך' : `תור ${memberName(t.currentAssignee)}`} · {CATEGORY_LABELS[t.category]} ·{' '}
                          {t.dueAt ? formatSmartDate(t.dueAt) : ''}
                        </p>
                      </div>
                    </div>

                    <div className="mt-3 flex gap-2">
                      {mine && (
                        <>
                          <Button
                            ref={idx === firstMineIdx ? completeHintRef : undefined}
                            size="sm"
                            {...guard}
                            disabled={!isOnline || isArchived || busy === t.id}
                            loading={busy === t.id}
                            onClick={() =>
                              run(t.id, () =>
                                completeTask(roomCode!, t, user!.uid, profile?.displayName ?? '')
                              )
                            }
                          >
                            בוצע ✓
                          </Button>
                          <Button
                            ref={idx === firstMineIdx ? requestTransferHintRef : undefined}
                            size="sm"
                            variant="secondary"
                            {...guard}
                            onClick={() => setTransferring(t)}
                          >
                            בקשת העברה
                          </Button>
                        </>
                      )}
                      {isAdmin && (
                        <Button
                          ref={idx === 0 ? deleteHintRef : undefined}
                          size="sm"
                          variant="ghost"
                          className="ms-auto text-rose-600"
                          {...guard}
                          onClick={async () => {
                            const ok = await confirm({
                              title: 'מחיקת מטלה',
                              body: `למחוק את "${t.name}" לצמיתות?`,
                              confirmLabel: 'מחק',
                              danger: true,
                            });
                            if (ok) await run(t.id, () => deleteTask(roomCode!, t.id));
                          }}
                        >
                          מחק
                        </Button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {activeMembers.length > 1 && Object.keys(fairness).length > 0 && (
          <section>
            <h2 ref={fairnessHintRef} className="mb-2 px-1 text-sm font-bold text-ink-700">
              הוגנות — 30 הימים האחרונים
            </h2>
            <ul className="card divide-y divide-ink-100">
              {[...activeMembers]
                .sort((a, b) => (fairness[b.id] ?? 0) - (fairness[a.id] ?? 0))
                .map((m) => (
                  <li key={m.id} className="flex items-center gap-3 px-4 py-3">
                    <Avatar name={m.name} uid={m.id} src={m.avatar} size="xs" />
                    <span className="flex-1 truncate text-sm text-ink-800">{m.name}</span>
                    <span className="num text-sm font-bold text-ink-900">
                      {fairness[m.id] ?? 0} <span className="font-normal text-ink-500">מטלות</span>
                    </span>
                  </li>
                ))}
            </ul>
          </section>
        )}
      </div>

      {addOpen && <AddTaskSheet open onClose={() => setAddOpen(false)} />}
      <TransferRequestSheet task={transferring} onClose={() => setTransferring(null)} />
    </AppShell>
  );

  async function respondToTransfer(t: WithId<TaskTransfer>, accepted: boolean) {
    if (!roomCode || !user) return;
    await respondTaskTransfer(roomCode, t, user.uid, memberName(user.uid), accepted);
  }
}
