import { Link } from 'react-router-dom';
import type { ComponentType, ReactNode } from 'react';
import { PlainShell } from '../components/layout/AppShell';
import { TopBar } from '../components/layout/TopBar';
import { Avatar } from '../components/ui/Avatar';
import {
  BellIcon,
  ChatIcon,
  ChevronIcon,
  ContrastIcon,
  HomeIcon,
  InfoIcon,
  MailIcon,
  MegaphoneIcon,
  UsersIcon,
  WrenchIcon,
  type IconProps,
} from '../components/ui/icons';
import { useRoom } from '../store/RoomContext';
import { useAuth } from '../store/AuthContext';
import { useAdminMessages } from '../hooks/useAdminMessages';
import { isDeveloper } from '../lib/developer';

interface Row {
  key: string;
  to: string;
  label: string;
  hint: string;
  icon: ComponentType<IconProps>;
  /** גוון אריח האייקון — כל הגוונים כבר מותאמים אוטומטית למצב כהה */
  tone: 'brand' | 'rose' | 'emerald' | 'amber' | 'sky' | 'violet' | 'ink';
  badge?: number;
}

const TONE_TILE: Record<Row['tone'], string> = {
  brand: 'bg-brand-100 text-brand-800',
  rose: 'bg-rose-100 text-rose-800',
  emerald: 'bg-emerald-100 text-emerald-800',
  amber: 'bg-amber-100 text-amber-800',
  sky: 'bg-sky-100 text-sky-800',
  violet: 'bg-violet-100 text-violet-800',
  ink: 'bg-ink-100 text-ink-700',
};

/**
 * תפריט ההגדרות — כרטיס פרופיל למעלה, ואז קבוצות שורות מקובצות
 * (בסגנון "רשימה מקובצת" מוכר) במקום ערימת כרטיסים נפרדים לכל שורה.
 *
 * לחיצה על קטגוריה מנווטת לנתיב נפרד (לא טאב), כדי שהחלקה מהצד לאחור
 * (iOS) וכפתור החזרה של המערכת (Android) יעבדו בדיוק כמו בכל שאר
 * האפליקציה — זו ניווט אמיתי בהיסטוריה, לא state מקומי.
 */
export default function SettingsPage() {
  const { roomCode, isAdmin } = useRoom();
  const { user, profile } = useAuth();
  const { unreadCount } = useAdminMessages();

  const displayName = profile?.displayName || user?.displayName || 'משתמש';
  const email = profile?.email || user?.email || '';

  const preferences: Row[] = [
    { key: 'display', to: `/r/${roomCode}/settings/display`, label: 'תצוגה', hint: 'בהיר, כהה או לפי המכשיר', icon: ContrastIcon, tone: 'violet' },
    { key: 'notifications', to: `/r/${roomCode}/settings/notifications`, label: 'התראות', hint: 'מה ומתי תרצו לקבל התראה', icon: BellIcon, tone: 'amber' },
  ];

  const room: Row[] = [
    { key: 'room', to: `/r/${roomCode}/settings/room`, label: 'החדר', hint: 'פרטי החדר, ניהול וגיבוי', icon: HomeIcon, tone: 'sky' },
    { key: 'members', to: `/r/${roomCode}/settings/members`, label: 'חברים', hint: 'רשימת חברים ובקשות הצטרפות', icon: UsersIcon, tone: 'emerald' },
  ];
  if (isAdmin) {
    room.push({
      key: 'announcements',
      to: `/r/${roomCode}/announcements`,
      label: 'הודעה לחברי החדר',
      hint: 'שליחת הודעת שידור לכל החברים',
      icon: MegaphoneIcon,
      tone: 'rose',
    });
  }

  const support: Row[] = [
    {
      key: 'messages',
      to: '/messages',
      label: 'הודעות ממנהל המערכת',
      hint: 'עדכוני מערכת ותשובות לפניות ששלחתם',
      icon: MailIcon,
      tone: 'brand',
      badge: unreadCount,
    },
    { key: 'feedback', to: `/feedback?room=${roomCode ?? ''}`, label: 'פנייה למנהל המערכת', hint: 'תקלה, רעיון, שאלה — או סתם מילה טובה', icon: ChatIcon, tone: 'violet' },
    { key: 'about', to: `/r/${roomCode}/settings/about`, label: 'אודות', hint: 'גרסה, עדכונים ומידע נוסף', icon: InfoIcon, tone: 'ink' },
  ];

  return (
    <>
      <TopBar title="הגדרות" back={`/r/${roomCode}`} />
      <PlainShell hasTopBar>
        <div className="space-y-6 py-4">
          <Link
            to={`/r/${roomCode}/settings/account`}
            className="card flex items-center gap-3.5 p-4 transition active:scale-[.99] hover:shadow-lifted"
          >
            <Avatar name={displayName} uid={user?.uid} src={profile?.avatar} size="lg" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-base font-bold text-ink-900">{displayName}</span>
              <span className="block truncate text-sm text-ink-500">{email}</span>
            </span>
            <ChevronIcon width={18} height={18} className="shrink-0 rotate-180 text-ink-300" />
          </Link>

          <SettingsSection title="העדפות" rows={preferences} />
          <SettingsSection title="החדר" rows={room} />
          <SettingsSection title="תמיכה ומידע" rows={support} />

          {/* ‼️ קיים בתפריט רק בסשן שבו user.email תואם — לא "תפקיד",
              לא קשור לניהול חדר. ראו src/lib/developer.ts. */}
          {isDeveloper(user?.email) && (
            <SettingsSection
              title="מפתח"
              rows={[
                {
                  key: 'developer',
                  to: '/developer',
                  label: 'פאנל מפתח',
                  hint: 'סקירת כל החדרים והמשתמשים במערכת',
                  icon: WrenchIcon,
                  tone: 'ink',
                },
              ]}
            />
          )}
        </div>
      </PlainShell>
    </>
  );
}

function SettingsSection({ title, rows }: { title: string; rows: Row[] }) {
  return (
    <section className="space-y-2">
      <h2 className="px-1 text-xs font-bold uppercase tracking-wide text-ink-500">{title}</h2>
      <ul className="card divide-y divide-ink-100 overflow-hidden p-0">
        {rows.map((row) => (
          <li key={row.key}>
            <Link
              to={row.to}
              className="flex items-center gap-3 p-3.5 transition active:bg-ink-50"
            >
              <span
                aria-hidden
                className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${TONE_TILE[row.tone]}`}
              >
                <row.icon width={19} height={19} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-bold text-ink-900">{row.label}</span>
                <span className="block truncate text-xs text-ink-500">{row.hint}</span>
              </span>
              {!!row.badge && row.badge > 0 && (
                <BadgeCount>{row.badge}</BadgeCount>
              )}
              <ChevronIcon width={16} height={16} className="shrink-0 rotate-180 text-ink-300" />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

function BadgeCount({ children }: { children: ReactNode }) {
  return (
    <span className="grid h-6 min-w-[1.5rem] shrink-0 place-items-center rounded-full
                     bg-brand-600 px-1.5 text-xs font-bold text-white">
      {children}
    </span>
  );
}
