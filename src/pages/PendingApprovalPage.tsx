import { useEffect } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { PlainShell } from '../components/layout/AppShell';
import { Button } from '../components/ui/Button';
import { FullPageSpinner } from '../components/ui/Spinner';
import { ClockIcon, DoorIcon } from '../components/ui/icons';
import { useAuth } from '../store/AuthContext';
import { useRtdbValue } from '../hooks/useRtdb';
import { useToast } from '../store/ToastContext';
import { cancelJoinRequest } from '../services/roomService';
import { formatRelativeTime } from '../lib/format';

interface Mirror {
  status: 'pending' | 'approved' | 'rejected';
  requestedAt: number;
  respondedAt: number | null;
  roomName?: string;
}

/**
 * מסך ההמתנה לאישור.
 *
 * המשתמש עדיין לא חבר בחדר, ולכן אינו רשאי לקרוא ממנו כלום. הוא מאזין
 * ל"מראה" האישית שלו ב-joinRequests — ראו docs/01-architecture.md §4.2
 */
export default function PendingApprovalPage() {
  const { code } = useParams<{ code: string }>();
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  const { data, loading } = useRtdbValue<Mirror>(
    user && code ? `joinRequests/${user.uid}/${code}` : null
  );

  // ברגע שהמנהל מאשר — נכנסים לחדר אוטומטית.
  //
  // ‼️ התנאי הכפול חיוני: המראה האישית היא נתון משני שעלול להתיישן,
  // בעוד profile.rooms הוא הסימן הסמכותי לחברות. בלי הבדיקה הכפולה,
  // משתמש שהוסר מהחדר היה מנווט לכאן, נשלח חזרה לחדר, נדחה שוב —
  // ונלכד בלולאה אינסופית.
  const isMember = !!(code && profile?.rooms?.[code]);

  useEffect(() => {
    if (data?.status === 'approved' && isMember && code) {
      toast.success('הבקשה אושרה! ברוכים הבאים');
      navigate(`/r/${code}`, { replace: true });
    }
  }, [data?.status, isMember, code, navigate, toast]);

  if (loading) return <FullPageSpinner label="בודק את סטטוס הבקשה…" />;
  if (!code) return <Navigate to="/onboarding" replace />;

  // המשתמש כבר חבר (למשל אושר במכשיר אחר)
  if (profile?.rooms?.[code]) return <Navigate to={`/r/${code}`} replace />;

  // אין בקשה כלל
  if (!data) return <Navigate to="/rooms/join" replace />;

  if (data.status === 'rejected') {
    return (
      <PlainShell>
        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
          <div aria-hidden className="text-ink-300">
            <DoorIcon width={44} height={44} />
          </div>
          <h1 className="text-xl font-bold text-ink-900">הבקשה נדחתה</h1>
          <p className="max-w-xs text-sm leading-relaxed text-ink-500">
            מנהל החדר {data.roomName ? `"${data.roomName}"` : ''} דחה את בקשת ההצטרפות.
            אפשר לפנות אליו ישירות ולנסות שוב.
          </p>
          <div className="mt-4 w-full max-w-xs space-y-2">
            <Button
              size="lg"
              fullWidth
              onClick={() => toast.run(() => cancelJoinRequest(code, user!.uid))}
            >
              נסה קוד אחר
            </Button>
            <Button variant="ghost" fullWidth onClick={() => navigate('/onboarding')}>
              חזרה
            </Button>
          </div>
        </div>
      </PlainShell>
    );
  }

  return (
    <PlainShell>
      <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
        <div className="relative" aria-hidden>
          <div className="text-brand-600">
            <ClockIcon width={44} height={44} />
          </div>
          <span className="absolute -inset-3 animate-ping rounded-full bg-brand-200/30" />
        </div>

        <h1 className="text-xl font-bold text-ink-900">ממתינים לאישור</h1>
        <p className="max-w-xs text-sm leading-relaxed text-ink-500">
          שלחנו בקשת הצטרפות לחדר{' '}
          {data.roomName ? (
            <b className="text-ink-700">"{data.roomName}"</b>
          ) : (
            <span className="num font-mono text-ink-700">{code}</span>
          )}
          . ברגע שמנהל החדר יאשר, תיכנסו אוטומטית.
        </p>

        {data.requestedAt && (
          <p className="text-xs text-ink-500">נשלח {formatRelativeTime(data.requestedAt)}</p>
        )}

        <div className="mt-6 w-full max-w-xs">
          <Button
            variant="secondary"
            fullWidth
            onClick={async () => {
              const ok = await toast.run(() => cancelJoinRequest(code, user!.uid));
              if (ok !== null) navigate('/onboarding', { replace: true });
            }}
          >
            ביטול הבקשה
          </Button>
        </div>

        <p className="mt-4 max-w-xs text-xs leading-relaxed text-ink-500">
          אפשר לסגור את האפליקציה — הבקשה תישמר.
        </p>
      </div>
    </PlainShell>
  );
}
