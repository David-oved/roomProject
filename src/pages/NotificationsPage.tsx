import { useEffect } from 'react';
import { ref, update } from 'firebase/database';
import { AppShell } from '../components/layout/AppShell';
import { TopBar } from '../components/layout/TopBar';
import { Avatar } from '../components/ui/Avatar';
import { EmptyState } from '../components/ui/EmptyState';
import { ListSkeleton } from '../components/ui/Skeleton';
import {
  CartIcon,
  CheckIcon,
  CloseIcon,
  ExchangeIcon,
  LogoutIcon,
  PlusIcon,
  UserIcon,
  UsersIcon,
  WalletIcon,
  type IconProps,
} from '../components/ui/icons';
import { useNotifications } from '../hooks/useRoomData';
import { useAuth } from '../store/AuthContext';
import { useRoom } from '../store/RoomContext';
import { useConnection } from '../store/ConnectionContext';
import { db } from '../config/firebase';
import { formatRelativeTime } from '../lib/format';
import type { NotificationType } from '../types/models';

const ICONS: Record<NotificationType, (p: IconProps) => JSX.Element> = {
  item_added: PlusIcon,
  item_claimed: UserIcon,
  item_bought: CartIcon,
  purchase_made: WalletIcon,
  purchase_approved: CheckIcon,
  purchase_rejected: CloseIcon,
  member_joined: UsersIcon,
  member_removed: LogoutIcon,
  settlement: ExchangeIcon,
};

/** גוון עדין רק לשני הסוגים עם משמעות חד-משמעית — חיובי/שלילי */
const ICON_TONE: Partial<Record<NotificationType, string>> = {
  purchase_approved: 'bg-emerald-50 text-emerald-700',
  purchase_rejected: 'bg-rose-50 text-rose-700',
};

export default function NotificationsPage() {
  const { notifications, loading } = useNotifications();
  const { user } = useAuth();
  const { roomCode } = useRoom();
  const { isOnline } = useConnection();

  // סימון כנקרא בכניסה למסך. כל אחד כותב רק ל-readBy של עצמו.
  useEffect(() => {
    if (!user || !roomCode || !isOnline || notifications.length === 0) return;

    const unread = notifications.filter((n) => !n.readBy?.[user.uid]);
    if (unread.length === 0) return;

    const updates: Record<string, unknown> = {};
    for (const n of unread) {
      updates[`rooms/${roomCode}/notifications/${n.id}/readBy/${user.uid}`] = true;
    }
    void update(ref(db), updates).catch(() => {
      /* לא קריטי */
    });
  }, [notifications, user, roomCode, isOnline]);

  return (
    <AppShell>
      <TopBar title="התראות" back />

      <div className="pt-4">
        {loading ? (
          <ListSkeleton rows={5} />
        ) : notifications.length === 0 ? (
          <EmptyState
            icon="🔔"
            title="אין התראות"
            body="כאן יופיע כל מה שקורה בחדר — דיווחים, קניות ואישורים."
          />
        ) : (
          <ul className="card divide-y divide-ink-100">
            {notifications.map((n) => {
              const unread = user ? !n.readBy?.[user.uid] : false;
              const Icon = ICONS[n.type];
              return (
                <li
                  key={n.id}
                  className={`flex items-start gap-3 px-4 py-3 ${unread ? 'bg-brand-50/40' : ''}`}
                >
                  <span
                    aria-hidden
                    className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${
                      ICON_TONE[n.type] ?? 'bg-ink-100 text-ink-600'
                    }`}
                  >
                    <Icon width={17} height={17} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm leading-snug text-ink-800">{n.text}</p>
                    <p className="mt-0.5 flex items-center gap-1.5 text-xs text-ink-400">
                      {n.createdAt ? formatRelativeTime(n.createdAt) : ''}
                      {unread && (
                        <span className="h-1.5 w-1.5 rounded-full bg-brand-600" aria-label="חדש" />
                      )}
                    </p>
                  </div>
                  <Avatar name={n.actorName} uid={n.actorId} size="xs" />
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </AppShell>
  );
}
