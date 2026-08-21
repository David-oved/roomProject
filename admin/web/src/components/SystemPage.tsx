import { useApi, useAction } from '../hooks/useApi';
import { api } from '../lib/api';
import { useStore } from '../lib/store';
import { Badge, Card, Empty, Loading, PageHead, Stat } from './ui/primitives';
import { dateTime, duration, relativeTime } from '../lib/format';

interface SystemInfo {
  mode: string;
  databaseURL: string | null;
  serviceAccount: string;
  missing: string[];
  uptimeSec: number;
  memoryMb: number;
  stateVersion: number;
  builtAt: number;
  counts: { users: number; rooms: number; events: number; feedback: number; alerts: number };
}

interface AuditEntry {
  id: string;
  at: number;
  actor: string;
  action: string;
  roomCode?: string;
  entityId?: string;
  detail?: string | null;
  backupId?: string;
}

const ACTION_LABELS: Record<string, string> = {
  purchase_approved: 'אישור קנייה',
  purchase_rejected: 'דחיית קנייה',
  join_approved: 'אישור הצטרפות',
  join_rejected: 'דחיית הצטרפות',
  member_removed: 'הסרת חבר',
  admin_transferred: 'העברת ניהול חדר',
  user_suspended: 'השעיית משתמש',
  user_unsuspended: 'ביטול השעיה',
  room_archived: 'ארכוב חדר',
  room_unarchived: 'ביטול ארכוב',
  balances_reset: 'איפוס מאזנים',
  force_sync: 'סנכרון כפוי',
  room_announcement: 'שידור לחדר',
  message_sent: 'שליחת הודעה',
  message_scheduled: 'תזמון הודעה',
  message_draft: 'שמירת טיוטה',
  message_resent: 'שליחה מחדש',
  message_deleted: 'מחיקת הודעה',
  message_sent_scheduled: 'שליחה מתוזמנת',
  dm_sent: 'הודעה אישית',
};

/**
 * מצב המערכת ויומן הביקורת.
 *
 * ‼️ היומן הוא החלק החשוב במסך הזה. כלי שנותן לי לאפס מאזנים של
 *    אנשים אחרים חייב לתעד כל פעולה כזו — גם כדי שאוכל להסביר, וגם
 *    כדי שאוכל לשחזר.
 */
export function SystemPage() {
  const { boot } = useStore();
  const { run, busy } = useAction();
  const { data, loading } = useApi<SystemInfo>('/system');
  const { data: audit } = useApi<{ entries: AuditEntry[] }>('/audit', { limit: 60 });

  return (
    <>
      <PageHead title="מערכת" subtitle="מצב החיבור, ביצועים, ויומן כל פעולה שביצעתי" />

      {boot?.mode === 'demo' && (
        <Card className="mb" title="מצב הדגמה">
          <p className="small" style={{ marginTop: 0 }}>
            הקונסולה רצה על נתוני הדגמה מקומיים כי חסרים פרטי חיבור ל-Firebase:
          </p>
          <ul className="small">
            {data?.missing.map((m) => (
              <li key={m} className="mono">
                {m}
              </li>
            ))}
          </ul>
          <p className="small muted">
            להתחברות לנתונים האמיתיים: הניחו <span className="mono">service-account.json</span> בתיקיית{' '}
            <span className="mono">admin/</span> וודאו ש-<span className="mono">VITE_FB_DATABASE_URL</span> מוגדר
            ב-<span className="mono">.env.local</span>. ראו <span className="mono">admin/README.md</span>.
          </p>
          <button
            className="btn"
            disabled={busy}
            onClick={() => run(() => api.post('/system/demo-reset'), 'נתוני ההדגמה אופסו')}
          >
            איפוס נתוני ההדגמה
          </button>
        </Card>
      )}

      {loading && !data ? (
        <Loading rows={4} />
      ) : data ? (
        <div className="grid cols-6 mb">
          <Stat label="מצב" value={data.mode === 'live' ? 'חי' : 'הדגמה'} small tone={data.mode === 'live' ? 'success' : 'warn'} />
          <Stat label="זמן ריצה" value={duration(data.uptimeSec * 1000)} small hint="של השרת המקומי" />
          <Stat label="זיכרון" value={`${data.memoryMb}MB`} small />
          <Stat label="אירועים בזיכרון" value={data.counts.events} hint="נגזרים מהנתונים" />
          <Stat label="גרסת מצב" value={data.stateVersion} small hint={`חושב ${relativeTime(data.builtAt)}`} />
          <Stat label="נתונים" value={`${data.counts.rooms} / ${data.counts.users}`} small hint="חדרים / משתמשים" />
        </div>
      ) : null}

      <Card title="יומן ביקורת" subtitle="כל פעולה שהקונסולה ביצעה על הנתונים" tight>
        {!audit?.entries.length ? (
          <Empty icon="🗒️" title="עוד לא בוצעו פעולות" />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>מתי</th>
                  <th>פעולה</th>
                  <th>חדר</th>
                  <th>ישות</th>
                  <th>פרטים</th>
                  <th>גיבוי</th>
                </tr>
              </thead>
              <tbody>
                {audit.entries.map((entry) => (
                  <tr key={entry.id}>
                    <td className="tiny muted nowrap">{dateTime(entry.at)}</td>
                    <td>
                      <span className="bold small">{ACTION_LABELS[entry.action] ?? entry.action}</span>
                    </td>
                    <td className="mono tiny">{entry.roomCode ?? '—'}</td>
                    <td className="mono tiny truncate" style={{ maxWidth: 140 }}>
                      {entry.entityId ?? '—'}
                    </td>
                    <td className="small truncate" style={{ maxWidth: 320 }}>
                      {entry.detail ?? '—'}
                    </td>
                    <td>{entry.backupId ? <Badge tone="success">נשמר</Badge> : <span className="muted tiny">—</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
