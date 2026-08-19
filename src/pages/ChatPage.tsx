import { Link } from 'react-router-dom';
import { AppShell } from '../components/layout/AppShell';
import { TopBar } from '../components/layout/TopBar';
import { Avatar } from '../components/ui/Avatar';
import { ChatIcon } from '../components/ui/icons';
import { useRoom } from '../store/RoomContext';
import { useAuth } from '../store/AuthContext';
import { useRtdbList } from '../hooks/useRtdb';
import { countUnread, dmBasePath, generalChatPath } from '../services/chatService';
import { formatRelativeTime } from '../lib/format';
import type { ChatMessage } from '../types/models';

/**
 * רשימת השיחות — הצ'אט הכללי למעלה, ואחריו שורה אחת לכל חבר פעיל
 * לשיחה פרטית איתו. כל שורה מנהלת את ההאזנה שלה בעצמה (ConversationRow),
 * ולא בלולאת hooks — React אוסר מספר משתנה של קריאות hook, אבל
 * קומפוננטה נפרדת לכל שורה עם hook קבוע אחד היא בדיוק התבנית הנכונה.
 */
export default function ChatPage() {
  const { roomCode, metadata, activeMembers, onlineMemberIds } = useRoom();
  const { user } = useAuth();

  const others = activeMembers.filter((m) => m.id !== user?.uid);

  return (
    <AppShell>
      <TopBar title="צ'אט" subtitle={metadata?.name} />

      <div className="space-y-2 pt-4">
        <ConversationRow
          to={`/r/${roomCode}/chat/general`}
          path={generalChatPath(roomCode!)}
          myUid={user?.uid ?? ''}
          title="כללי"
          subtitle="כל חברי החדר"
          icon={<ChatIcon width={20} height={20} />}
        />

        {others.map((m) => (
          <ConversationRow
            key={m.id}
            to={`/r/${roomCode}/chat/dm/${m.id}`}
            path={`${dmBasePath(roomCode!, user!.uid, m.id)}/messages`}
            myUid={user?.uid ?? ''}
            title={m.name}
            avatar={<Avatar name={m.name} uid={m.id} src={m.avatar} size="md" />}
            online={onlineMemberIds.has(m.id)}
          />
        ))}
      </div>
    </AppShell>
  );
}

function ConversationRow({
  to,
  path,
  myUid,
  title,
  subtitle,
  icon,
  avatar,
  online,
}: {
  to: string;
  path: string;
  myUid: string;
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  avatar?: React.ReactNode;
  online?: boolean;
}) {
  const { data: messages, loading } = useRtdbList<ChatMessage>(path);

  const sorted = [...messages].sort((a, b) => (b.sentAt ?? 0) - (a.sentAt ?? 0));
  const last = sorted[0];
  const unread = countUnread(messages, myUid);

  return (
    <Link
      to={to}
      className="card flex items-center gap-3 p-3.5 transition active:scale-[.99] hover:shadow-lifted"
    >
      <div className="relative shrink-0">
        {avatar ?? (
          <span className="grid h-11 w-11 place-items-center rounded-full bg-brand-50 text-brand-700">
            {icon}
          </span>
        )}
        {online && (
          <span
            aria-hidden
            className="absolute -end-0.5 -bottom-0.5 h-3 w-3 rounded-full bg-emerald-500 ring-2 ring-white"
          />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className={`truncate text-sm ${unread > 0 ? 'font-bold text-ink-900' : 'font-semibold text-ink-800'}`}>
            {title}
          </span>
          {last?.sentAt && (
            <span className="shrink-0 text-[11px] text-ink-400">
              {formatRelativeTime(last.sentAt)}
            </span>
          )}
        </div>
        <div className="mt-0.5 flex items-center justify-between gap-2">
          <span className={`truncate text-xs ${unread > 0 ? 'font-medium text-ink-700' : 'text-ink-400'}`}>
            {loading ? '' : last ? (last.senderId === myUid ? `אתה: ${last.text}` : last.text) : subtitle ?? 'אין הודעות עדיין'}
          </span>
          {unread > 0 && (
            <span className="grid h-5 min-w-5 shrink-0 place-items-center rounded-full bg-brand-600 px-1.5 text-[10px] font-bold text-white">
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
