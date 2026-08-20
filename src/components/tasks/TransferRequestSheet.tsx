import { useState } from 'react';
import { GlassModal } from '../ui/GlassModal';
import { Avatar } from '../ui/Avatar';
import { requestTaskTransfer } from '../../services/taskService';
import { useAuth } from '../../store/AuthContext';
import { useRoom } from '../../store/RoomContext';
import { useToast } from '../../store/ToastContext';
import type { Task, WithId } from '../../types/models';

/** בחירת חבר להעביר אליו את התור הנוכחי במטלה — רק מבין משתתפי המטלה. */
export function TransferRequestSheet({
  task,
  onClose,
}: {
  task: WithId<Task> | null;
  onClose: () => void;
}) {
  const { user, profile } = useAuth();
  const { roomCode, members } = useRoom();
  const toast = useToast();
  const [sendingTo, setSendingTo] = useState<string | null>(null);

  const others = (task?.participants ?? [])
    .filter((uid) => uid !== user?.uid)
    .map((uid) => members.find((m) => m.id === uid))
    .filter((m): m is NonNullable<typeof m> => !!m);

  async function send(toUid: string) {
    if (!task || !user || !profile || !roomCode) return;
    setSendingTo(toUid);
    const res = await toast.run(() =>
      requestTaskTransfer(roomCode, task, user.uid, profile.displayName, toUid)
    );
    setSendingTo(null);
    if (res !== null) {
      toast.success('הבקשה נשלחה');
      onClose();
    }
  }

  return (
    <GlassModal open={!!task} onClose={onClose} labelledBy="transfer-task-title">
      <div className="p-5 pt-4">
        <h2 id="transfer-task-title" className="pe-12 text-lg font-bold text-ink-900">
          למי להעביר את "{task?.name}"?
        </h2>
        <p className="mt-1 text-xs text-ink-500">הבקשה תישלח לאישור — התור יעבור רק אם יאשר/תאשר.</p>

        {others.length === 0 ? (
          <p className="py-8 text-center text-sm text-ink-500">
            אין עוד משתתפים במטלה הזו להעביר אליהם.
          </p>
        ) : (
          <ul className="mt-4 space-y-1.5">
            {others.map((m) => (
              <li key={m.id}>
                <button
                  type="button"
                  disabled={sendingTo !== null}
                  onClick={() => send(m.id)}
                  className="tap flex w-full items-center gap-3 rounded-xl border border-ink-200
                             bg-white px-3 py-2.5 text-start transition hover:border-brand-300
                             hover:bg-brand-50/60 disabled:opacity-50"
                >
                  <Avatar name={m.name} uid={m.id} src={m.avatar} size="xs" />
                  <span className="truncate text-sm font-medium text-ink-800">{m.name}</span>
                  {sendingTo === m.id && (
                    <span className="num ms-auto text-xs text-ink-500">שולח…</span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </GlassModal>
  );
}
