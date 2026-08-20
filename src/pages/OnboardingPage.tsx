import { Link, Navigate } from 'react-router-dom';
import { PlainShell } from '../components/layout/AppShell';
import { AppLogo } from '../components/layout/AppLogo';
import { useAuth } from '../store/AuthContext';
import { useRtdbValue } from '../hooks/useRtdb';
import { FullPageSpinner } from '../components/ui/Spinner';
import { Badge } from '../components/ui/Badge';
import { ChevronIcon } from '../components/ui/icons';
import { getLastRoom } from '../lib/prefs';

interface JoinRequestMirror {
  status: 'pending' | 'approved' | 'rejected';
  roomName?: string;
}

export default function OnboardingPage() {
  const { user, profile, loading } = useAuth();
  const requests = useRtdbValue<Record<string, JoinRequestMirror>>(
    user ? `joinRequests/${user.uid}` : null
  );

  if (loading) return <FullPageSpinner />;

  const rooms = Object.keys(profile?.rooms ?? {});

  // ── חדר אחד: נכנסים ישר, בלי מסך ביניים מיותר ──
  if (rooms.length === 1) return <Navigate to={`/r/${rooms[0]}`} replace />;

  // ── כמה חדרים: בוחרים. הקודם נזרק תמיד לראשון שרירותית. ──
  if (rooms.length > 1) return <RoomPicker rooms={rooms} />;

  // ── יש בקשה ממתינה ──
  const pending = Object.entries(requests.data ?? {}).find(([, r]) => r.status === 'pending');
  if (pending) return <Navigate to={`/rooms/${pending[0]}/pending`} replace />;

  // ── אין כלום: יוצרים או מצטרפים ──
  return (
    <PlainShell>
      <div className="flex flex-1 flex-col justify-center py-6">
        <AppLogo showVersion={false} />

        <h1 className="mt-7 text-center text-2xl font-bold text-ink-900">
          שלום {profile?.displayName?.split(' ')[0] ?? ''} 👋
        </h1>
        <p className="mt-1.5 text-center text-sm leading-relaxed text-ink-500">
          כדי להתחיל, צרו חדר חדש או הצטרפו לחדר קיים באמצעות קוד
        </p>

        <div className="mt-8 space-y-3">
          <ChoiceCard
            to="/rooms/create"
            emoji="✨"
            title="יצירת חדר חדש"
            body="אתם תהיו מנהלי החדר ותקבלו קוד לשיתוף עם השותפים"
            primary
          />
          <ChoiceCard
            to="/rooms/join"
            emoji="🔑"
            title="הצטרפות לחדר קיים"
            body="יש לכם קוד חדר מהשותפים? הזינו אותו כאן"
          />
        </div>

        <Link to="/profile" className="mt-8 block text-center text-sm text-ink-500 hover:underline">
          הגדרות חשבון
        </Link>
      </div>
    </PlainShell>
  );
}

/* ═══════════════ בוחר חדרים ═══════════════ */

function RoomPicker({ rooms }: { rooms: string[] }) {
  const last = getLastRoom();

  // החדר האחרון שנצפה עולה לראש — כמעט תמיד זה מה שרוצים
  const ordered = [...rooms].sort((a, b) => (a === last ? -1 : b === last ? 1 : 0));

  return (
    <PlainShell>
      <div className="flex flex-1 flex-col justify-center py-6">
        <AppLogo showVersion={false} />

        <h1 className="mt-7 text-center text-xl font-bold text-ink-900">לאיזה חדר להיכנס?</h1>
        <p className="mt-1 text-center text-sm text-ink-500">
          אתם חברים ב־<span className="num">{rooms.length}</span> חדרים
        </p>

        <ul className="mt-6 space-y-2.5">
          {ordered.map((code) => (
            <li key={code}>
              <RoomOption code={code} isLast={code === last} />
            </li>
          ))}
        </ul>

        <div className="mt-6 flex flex-col gap-2 text-center text-sm">
          <Link to="/rooms/join" className="text-brand-700 hover:underline">
            הצטרפות לחדר נוסף
          </Link>
          <Link to="/rooms/create" className="text-ink-500 hover:underline">
            יצירת חדר חדש
          </Link>
        </div>
      </div>
    </PlainShell>
  );
}

/**
 * שם החדר נקרא מ-roomCodes — האינדקס הציבורי. לא מ-/rooms/{code}/metadata,
 * כי טעינת המטא-דאטה של כל החדרים במקביל היא בזבוז, וכאן צריך רק שם.
 */
function RoomOption({ code, isLast }: { code: string; isLast: boolean }) {
  const { data } = useRtdbValue<{ name: string }>(`roomCodes/${code}`);

  return (
    <Link
      to={`/r/${code}`}
      className="flex items-center gap-3 rounded-card border border-ink-200 bg-white p-4
                 shadow-card transition active:scale-[.99] hover:border-brand-300"
    >
      <span
        aria-hidden
        className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand-50 text-xl"
      >
        🏠
      </span>

      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="truncate font-bold text-ink-900">{data?.name ?? '…'}</span>
          {isLast && <Badge tone="brand">אחרון</Badge>}
        </span>
        <span
          className="num mt-0.5 block font-mono text-xs tracking-wider text-ink-500"
          style={{ direction: 'ltr' }}
        >
          {code}
        </span>
      </span>

      <ChevronIcon width={20} height={20} className="shrink-0 text-ink-300" />
    </Link>
  );
}

/* ═══════════════ כרטיס בחירה ═══════════════ */

function ChoiceCard({
  to,
  emoji,
  title,
  body,
  primary,
}: {
  to: string;
  emoji: string;
  title: string;
  body: string;
  primary?: boolean;
}) {
  return (
    <Link
      to={to}
      className={[
        'flex items-center gap-4 rounded-card border p-4 transition active:scale-[.99]',
        primary
          ? 'border-brand-200 bg-white shadow-card hover:border-brand-300 hover:shadow-lifted'
          : 'border-ink-200 bg-white/70 hover:bg-white hover:shadow-card',
      ].join(' ')}
    >
      <span
        aria-hidden
        className={`grid h-12 w-12 shrink-0 place-items-center rounded-xl text-2xl
                    ${primary ? 'bg-brand-50' : 'bg-ink-100'}`}
      >
        {emoji}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-bold text-ink-900">{title}</span>
        <span className="mt-0.5 block text-xs leading-relaxed text-ink-500">{body}</span>
      </span>
      <ChevronIcon width={20} height={20} className="shrink-0 text-ink-300" />
    </Link>
  );
}
