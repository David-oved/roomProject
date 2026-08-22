import { useMemo, useState } from 'react';
import { PlainShell } from '../components/layout/AppShell';
import { TopBar } from '../components/layout/TopBar';
import { Avatar } from '../components/ui/Avatar';
import { Badge } from '../components/ui/Badge';
import { EmptyState, ErrorState } from '../components/ui/EmptyState';
import { ListSkeleton } from '../components/ui/Skeleton';
import { ChevronIcon, HomeIcon, RefreshIcon, UserIcon } from '../components/ui/icons';
import { useDeveloperOverview, type DeveloperRoom } from '../hooks/useDeveloperOverview';
import { formatFullDate, formatRelativeTime } from '../lib/format';
import { friendlyError } from '../lib/errors';
import type { UserProfile, WithId } from '../types/models';

type Tab = 'rooms' | 'users';

/**
 * ═══════════════════════════════════════════════════════════════
 *  פאנל המפתח
 * ═══════════════════════════════════════════════════════════════
 *  תצוגה קריאה-בלבד, נראית רק לחשבון אחד (src/lib/developer.ts).
 *  שני הטאבים כאן הם בדיוק היקף הנתונים שהכללים מתירים לחשבון הזה
 *  לקרוא (database.rules.json): מטא-דאטה וחברי חדר, ורשימת משתמשים.
 *  לא קניות, לא מאזנים, לא צ'אט — ראו docs/14-developer-panel.md.
 *
 *  כלי עיון מזדמן ולא מסך חי: "רענון" הוא כפתור, לא מנוי אוטומטי.
 *  לפעולות ניהול (השעיה, ארכוב, מענה למשוב) יש כלי נפרד — קונסולת
 *  הניהול המקומית ב-admin/, שרצה רק על המחשב עם Admin SDK.
 * ═══════════════════════════════════════════════════════════════
 */
export default function DeveloperPage() {
  const { loading, error, rooms, users, loadedAt, reload } = useDeveloperOverview();
  const [tab, setTab] = useState<Tab>('rooms');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const toggle = (code: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });

  const totalActiveMembers = useMemo(
    () => rooms.reduce((sum, r) => sum + r.members.filter((m) => m.status === 'active').length, 0),
    [rooms]
  );

  const orphanUsers = useMemo(() => {
    const inAnyRoom = new Set(rooms.flatMap((r) => r.members.map((m) => m.id)));
    return users.filter((u) => !inAnyRoom.has(u.id));
  }, [rooms, users]);

  /** לכל משתמש: באילו חדרים הוא חבר, עם תפקיד וסטטוס. */
  const membershipsByUser = useMemo(() => {
    const map = new Map<string, Array<{ code: string; roomName: string; role: string; status: string }>>();
    for (const room of rooms) {
      for (const m of room.members) {
        const list = map.get(m.id) ?? [];
        list.push({ code: room.code, roomName: room.metadata.name, role: m.role, status: m.status });
        map.set(m.id, list);
      }
    }
    return map;
  }, [rooms]);

  return (
    <>
      <TopBar
        title="פאנל מפתח"
        subtitle={loadedAt ? `עודכן ${formatRelativeTime(loadedAt)}` : undefined}
        actions={
          <button
            onClick={() => void reload()}
            disabled={loading}
            aria-label="רענון"
            className="tap grid h-10 w-10 shrink-0 place-items-center rounded-full text-ink-500
                       transition hover:bg-ink-100 hover:text-ink-800 disabled:opacity-50"
          >
            <RefreshIcon width={18} height={18} className={loading ? 'animate-spin' : ''} />
          </button>
        }
      />
      <PlainShell hasTopBar>
        <div className="space-y-4 py-4">
          <div className="grid grid-cols-3 gap-2">
            <StatCard label="חדרים" value={rooms.length} />
            <StatCard label="חברים פעילים" value={totalActiveMembers} />
            <StatCard label="משתמשים" value={users.length} />
          </div>

          <div className="flex gap-2">
            {(
              [
                ['rooms', 'חדרים'],
                ['users', 'משתמשים'],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                aria-pressed={tab === key}
                className={[
                  'tap flex-1 rounded-xl py-2.5 text-sm font-semibold transition',
                  tab === key ? 'bg-brand-700 text-white shadow-sm' : 'bg-surface text-ink-600 ring-1 ring-ink-200',
                ].join(' ')}
              >
                {label}
              </button>
            ))}
          </div>

          {loading && rooms.length === 0 && users.length === 0 ? (
            <ListSkeleton rows={5} />
          ) : error ? (
            <ErrorState message={friendlyError(error)} onRetry={() => void reload()} />
          ) : tab === 'rooms' ? (
            rooms.length === 0 ? (
              <EmptyState icon={<HomeIcon width={30} height={30} />} title="אין חדרים במערכת" />
            ) : (
              <ul className="space-y-2.5">
                {rooms.map((room) => (
                  <RoomRow
                    key={room.code}
                    room={room}
                    expanded={expanded.has(room.code)}
                    onToggle={() => toggle(room.code)}
                  />
                ))}
              </ul>
            )
          ) : users.length === 0 ? (
            <EmptyState icon={<UserIcon width={30} height={30} />} title="אין משתמשים רשומים" />
          ) : (
            <ul className="space-y-2.5">
              {users.map((user) => (
                <UserRow key={user.id} user={user} memberships={membershipsByUser.get(user.id) ?? []} />
              ))}
            </ul>
          )}

          {tab === 'users' && orphanUsers.length > 0 && (
            <p className="px-1 text-xs text-ink-500">
              {orphanUsers.length} מתוכם לא חברים באף חדר.
            </p>
          )}
        </div>
      </PlainShell>
    </>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="card p-3 text-center">
      <p className="text-xl font-bold text-ink-900">{value}</p>
      <p className="text-xs text-ink-500">{label}</p>
    </div>
  );
}

function RoomRow({
  room,
  expanded,
  onToggle,
}: {
  room: DeveloperRoom;
  expanded: boolean;
  onToggle: () => void;
}) {
  const active = room.members.filter((m) => m.status === 'active');
  const admin = active.find((m) => m.id === room.metadata.adminId);

  return (
    <li className="card overflow-hidden p-0">
      <button
        onClick={onToggle}
        aria-expanded={expanded}
        className="flex w-full items-center gap-3 p-4 text-start transition active:bg-ink-50"
      >
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="truncate text-sm font-bold text-ink-900">{room.metadata.name}</span>
            {room.metadata.archivedAt && <Badge tone="neutral">בארכיון</Badge>}
          </span>
          <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-ink-500">
            <span className="font-mono">{room.code}</span>
            <span>· {active.length} חברים</span>
            <span>· מנהל: {admin?.name ?? '—'}</span>
            <span>· נוצר {formatFullDate(room.metadata.createdAt)}</span>
          </span>
        </span>
        <ChevronIcon
          width={16}
          height={16}
          className={`shrink-0 text-ink-400 transition-transform ${expanded ? '-rotate-90' : 'rotate-90'}`}
        />
      </button>

      {expanded && (
        <ul className="border-t border-ink-100 px-4 pb-3 pt-2">
          {room.members.length === 0 ? (
            <li className="py-2 text-xs text-ink-500">אין חברים</li>
          ) : (
            room.members.map((m) => (
              <li key={m.id} className="flex items-center gap-2.5 py-1.5">
                <Avatar name={m.name} uid={m.id} src={m.avatar} size="xs" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-ink-800">{m.name}</span>
                  <span className="block truncate text-[11px] text-ink-500">{m.email}</span>
                </span>
                {m.id === room.metadata.adminId && <Badge tone="brand">מנהל</Badge>}
                {m.status === 'removed' && <Badge tone="neutral">הוסר</Badge>}
              </li>
            ))
          )}
        </ul>
      )}
    </li>
  );
}

function UserRow({
  user,
  memberships,
}: {
  user: WithId<UserProfile>;
  memberships: Array<{ code: string; roomName: string; role: string; status: string }>;
}) {
  return (
    <li className="card flex items-start gap-3 p-3.5">
      <Avatar name={user.displayName} uid={user.id} src={user.avatar} size="sm" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold text-ink-900">{user.displayName}</p>
        <p className="truncate text-xs text-ink-500">{user.email}</p>
        <p className="mt-0.5 text-[11px] text-ink-400">
          נרשם {formatFullDate(user.createdAt)}
          {user.lastActiveAt ? ` · פעיל ${formatRelativeTime(user.lastActiveAt)}` : ''}
        </p>

        {memberships.length === 0 ? (
          <p className="mt-1.5 text-[11px] text-ink-400">לא חבר באף חדר</p>
        ) : (
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {memberships.map((m) => (
              <Badge
                key={m.code}
                tone={m.status !== 'active' ? 'neutral' : m.role === 'admin' ? 'brand' : 'info'}
              >
                {m.roomName}
                {m.role === 'admin' ? ' · מנהל' : ''}
                {m.status !== 'active' ? ' · הוסר' : ''}
              </Badge>
            ))}
          </div>
        )}
      </div>
    </li>
  );
}
