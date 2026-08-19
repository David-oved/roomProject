import { useState } from 'react';
import { PlainShell } from '../components/layout/AppShell';
import { TopBar } from '../components/layout/TopBar';
import { Avatar } from '../components/ui/Avatar';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { ListSkeleton } from '../components/ui/Skeleton';
import { RoomCodeCard } from '../components/rooms/RoomCodeCard';
import { useJoinRequests } from '../hooks/useRoomData';
import { useRoom } from '../store/RoomContext';
import { useAuth } from '../store/AuthContext';
import { useConnection } from '../store/ConnectionContext';
import { useToast } from '../store/ToastContext';
import { useConfirm } from '../store/ConfirmContext';
import { approveJoinRequest, rejectJoinRequest, removeMember } from '../services/roomService';
import { formatFullDate, formatRelativeTime } from '../lib/format';

export default function SettingsMembersPage() {
  const { roomCode, metadata, activeMembers, isAdmin, loading } = useRoom();
  const { requests, loading: reqLoading } = useJoinRequests();
  const { user, profile } = useAuth();
  const { isOnline } = useConnection();
  const toast = useToast();
  const confirm = useConfirm();
  const [busy, setBusy] = useState<string | null>(null);

  const guard = { disabled: !isOnline, title: isOnline ? undefined : 'פעולה זו דורשת חיבור לאינטרנט' };

  return (
    <>
      <TopBar title="חברי החדר" back={`/r/${roomCode}/settings`} subtitle={metadata?.name} />
      <PlainShell>
        <div className="space-y-5 py-4">
          {/* בקשות הצטרפות — מנהל בלבד */}
          {isAdmin && !reqLoading && requests.length > 0 && (
            <section>
              <h2 className="mb-2 px-1 text-sm font-bold text-ink-700">
                בקשות הצטרפות (<span className="num">{requests.length}</span>)
              </h2>
              <ul className="space-y-2">
                {requests.map((r) => (
                  <li key={r.id} className="card p-4">
                    <div className="flex items-center gap-3">
                      <Avatar name={r.displayName} uid={r.userId} src={r.avatar} size="md" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-bold text-ink-900">{r.displayName}</p>
                        <p className="num truncate text-xs text-ink-500" dir="ltr">
                          {r.email}
                        </p>
                        {r.requestedAt && (
                          <p className="text-[11px] text-ink-400">
                            ביקש {formatRelativeTime(r.requestedAt)}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="mt-3 flex gap-2">
                      <Button
                        size="sm"
                        fullWidth
                        {...guard}
                        loading={busy === r.id}
                        onClick={async () => {
                          setBusy(r.id);
                          const res = await toast.run(() =>
                            approveJoinRequest(roomCode!, user!.uid, profile!.displayName, r)
                          );
                          if (res !== null) toast.success(`${r.displayName} הצטרף לחדר`);
                          setBusy(null);
                        }}
                      >
                        אישור
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        {...guard}
                        onClick={async () => {
                          const ok = await confirm({
                            title: 'דחיית בקשה',
                            body: `לדחות את בקשת ההצטרפות של ${r.displayName}?`,
                            confirmLabel: 'דחה',
                            danger: true,
                          });
                          if (!ok) return;
                          setBusy(r.id);
                          await toast.run(() => rejectJoinRequest(roomCode!, user!.uid, r.userId));
                          setBusy(null);
                        }}
                      >
                        דחייה
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* רשימת החברים */}
          <section>
            <h2 className="mb-2 px-1 text-sm font-bold text-ink-700">
              חברים (<span className="num">{activeMembers.length}</span>)
            </h2>

            {loading ? (
              <ListSkeleton rows={3} />
            ) : (
              <ul className="card divide-y divide-ink-100">
                {activeMembers.map((m) => (
                  <li key={m.id} className="flex items-center gap-3 px-4 py-3">
                    <Avatar name={m.name} uid={m.id} src={m.avatar} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-1.5 font-semibold text-ink-900">
                        <span className="min-w-0 truncate">{m.name}</span>
                        {m.id === user?.uid && (
                          <span className="shrink-0 text-xs font-normal text-ink-400">(אתה)</span>
                        )}
                        {m.role === 'admin' && (
                          <span className="shrink-0">
                            <Badge tone="brand">מנהל</Badge>
                          </span>
                        )}
                      </p>
                      {m.joinedAt && (
                        <p className="text-xs text-ink-500">הצטרף {formatFullDate(m.joinedAt)}</p>
                      )}
                    </div>

                    {isAdmin && m.id !== user?.uid && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-rose-600"
                        {...guard}
                        loading={busy === m.id}
                        onClick={async () => {
                          const ok = await confirm({
                            title: 'הסרת חבר',
                            body: `להסיר את ${m.name} מהחדר? הקניות והמאזן יישמרו בהיסטוריה.`,
                            confirmLabel: 'הסר מהחדר',
                            danger: true,
                          });
                          if (!ok) return;
                          setBusy(m.id);
                          await toast.run(() =>
                            removeMember(roomCode!, user!.uid, profile!.displayName, m.id, m.name)
                          );
                          setBusy(null);
                        }}
                      >
                        הסר
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* הזמנה */}
          {roomCode && (
            <section>
              <h2 className="mb-2 px-1 text-sm font-bold text-ink-700">הזמנת שותפים</h2>
              <RoomCodeCard code={roomCode} roomName={metadata?.name ?? ''} />
              <p className="mt-2 px-1 text-xs leading-relaxed text-ink-500">
                מי שיזין את הקוד ישלח בקשה, ומנהל החדר יאשר אותה.
              </p>
            </section>
          )}
        </div>
      </PlainShell>
    </>
  );
}
