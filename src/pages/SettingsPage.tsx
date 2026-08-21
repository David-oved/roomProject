import { Link } from 'react-router-dom';
import { PlainShell } from '../components/layout/AppShell';
import { TopBar } from '../components/layout/TopBar';
import { ChevronIcon } from '../components/ui/icons';
import { useRoom } from '../store/RoomContext';
import { useAuth } from '../store/AuthContext';
import { useAdminMessages } from '../hooks/useAdminMessages';
import { isDeveloper } from '../lib/developer';

interface SettingsCategory {
  key: string;
  label: string;
  description: string;
  icon: string;
}

const CATEGORIES: SettingsCategory[] = [
  { key: 'account', label: 'חשבון', description: 'שם, תמונה, סיסמה ומחיקת חשבון', icon: '👤' },
  { key: 'room', label: 'החדר', description: 'פרטי החדר, ניהול וגיבוי', icon: '🏠' },
  { key: 'members', label: 'חברים', description: 'רשימת חברים ובקשות הצטרפות', icon: '👥' },
  { key: 'notifications', label: 'התראות', description: 'מה ומתי תרצו לקבל התראה', icon: '🔔' },
  { key: 'about', label: 'אודות', description: 'גרסה, עדכונים ומידע נוסף', icon: 'ℹ️' },
];

/**
 * תפריט ההגדרות — מסך רשימה בלבד. לחיצה על קטגוריה מנווטת לנתיב נפרד
 * (לא טאב), כדי שהחלקה מהצד לאחור (iOS) וכפתור החזרה של המערכת
 * (Android) יעבדו בדיוק כמו בכל שאר האפליקציה — זו ניווט אמיתי בהיסטוריה,
 * לא state מקומי.
 */
export default function SettingsPage() {
  const { roomCode, isAdmin } = useRoom();
  const { user } = useAuth();
  const { unreadCount } = useAdminMessages();

  return (
    <>
      <TopBar title="הגדרות" back={`/r/${roomCode}`} />
      <PlainShell hasTopBar>
        <ul className="space-y-2 py-4">
          {CATEGORIES.map((c) => (
            <li key={c.key}>
              <Link
                to={`/r/${roomCode}/settings/${c.key}`}
                className="card flex items-center gap-3.5 p-4 transition active:scale-[.99] hover:shadow-lifted"
              >
                <span
                  aria-hidden
                  className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-ink-50 text-xl"
                >
                  {c.icon}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-bold text-ink-900">{c.label}</span>
                  <span className="block truncate text-xs text-ink-500">{c.description}</span>
                </span>
                <ChevronIcon width={18} height={18} className="shrink-0 rotate-180 text-ink-300" />
              </Link>
            </li>
          ))}

          {/* ── הערוץ מול מנהל המערכת ── */}
          <li className="pt-2">
            <Link
              to="/messages"
              className="card flex items-center gap-3.5 p-4 transition active:scale-[.99] hover:shadow-lifted"
            >
              <span
                aria-hidden
                className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-ink-50 text-xl"
              >
                📬
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-bold text-ink-900">הודעות ממנהל המערכת</span>
                <span className="block truncate text-xs text-ink-500">
                  עדכוני מערכת ותשובות לפניות ששלחתם
                </span>
              </span>
              {unreadCount > 0 && (
                <span className="grid h-6 min-w-[1.5rem] shrink-0 place-items-center rounded-full
                                 bg-brand-600 px-1.5 text-xs font-bold text-white">
                  {unreadCount}
                </span>
              )}
              <ChevronIcon width={18} height={18} className="shrink-0 rotate-180 text-ink-300" />
            </Link>
          </li>

          <li>
            <Link
              to={`/feedback?room=${roomCode ?? ''}`}
              className="card flex items-center gap-3.5 p-4 transition active:scale-[.99] hover:shadow-lifted"
            >
              <span
                aria-hidden
                className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-ink-50 text-xl"
              >
                💬
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-bold text-ink-900">פנייה למנהל המערכת</span>
                <span className="block truncate text-xs text-ink-500">
                  תקלה, רעיון, שאלה — או סתם מילה טובה
                </span>
              </span>
              <ChevronIcon width={18} height={18} className="shrink-0 rotate-180 text-ink-300" />
            </Link>
          </li>

          {isAdmin && (
            <li>
              <Link
                to={`/r/${roomCode}/announcements`}
                className="card flex items-center gap-3.5 p-4 transition active:scale-[.99] hover:shadow-lifted"
              >
                <span
                  aria-hidden
                  className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-ink-50 text-xl"
                >
                  📢
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-bold text-ink-900">הודעה לחברי החדר</span>
                  <span className="block truncate text-xs text-ink-500">שליחת הודעת שידור לכל החברים</span>
                </span>
                <ChevronIcon width={18} height={18} className="shrink-0 rotate-180 text-ink-300" />
              </Link>
            </li>
          )}

          {/* ‼️ קיים בתפריט רק בסשן שבו user.email תואם — לא "תפקיד",
              לא קשור לניהול חדר. ראו src/lib/developer.ts. */}
          {isDeveloper(user?.email) && (
            <li className="pt-2">
              <Link
                to="/developer"
                className="card flex items-center gap-3.5 p-4 transition active:scale-[.99] hover:shadow-lifted"
              >
                <span
                  aria-hidden
                  className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-ink-50 text-xl"
                >
                  🛠️
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-bold text-ink-900">פאנל מפתח</span>
                  <span className="block truncate text-xs text-ink-500">
                    סקירת כל החדרים והמשתמשים במערכת
                  </span>
                </span>
                <ChevronIcon width={18} height={18} className="shrink-0 rotate-180 text-ink-300" />
              </Link>
            </li>
          )}
        </ul>
      </PlainShell>
    </>
  );
}
