import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useApi, useAction } from '../../hooks/useApi';
import { api } from '../../lib/api';
import { Badge, Card, Empty, Loading, PageHead, Segmented, Stat } from '../ui/primitives';
import { AlertConfigPanel } from './AlertConfig';
import { useDesktopNotifications } from './useDesktopNotifications';
import { relativeTime } from '../../lib/format';
import type { Alert, AlertConfig } from '../../lib/types';

/**
 * ═══════════════════════════════════════════════════════════════
 *  מרכז ההתראות
 * ═══════════════════════════════════════════════════════════════
 *  התראה נעלמת מעצמה כשהבעיה נפתרת. "ביטול" נועד למקרה ההפוך:
 *  בעיה אמיתית שהחלטתי לחיות איתה — והיא חוזרת אם המצב יחמיר.
 * ═══════════════════════════════════════════════════════════════
 */
export function AlertCenter() {
  const [severity, setSeverity] = useState('all');
  const [showDismissed, setShowDismissed] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const { run, busy } = useAction();

  const { data, loading, reload } = useApi<{
    alerts: Alert[];
    counts: { critical: number; warn: number; info: number; dismissed: number };
    config: AlertConfig;
    quietHours: boolean;
  }>('/alerts', { severity, includeDismissed: showDismissed ? 'true' : undefined });

  useDesktopNotifications(data?.alerts ?? [], data?.config, data?.quietHours ?? false);

  /* סימון "נראו" — כדי ש"חדש מאז שיצאתי" יישאר מידע אמין */
  useEffect(() => {
    api.post('/alerts/seen').catch(() => {});
  }, []);

  const counts = data?.counts;

  return (
    <>
      <PageHead
        title="מרכז התראות"
        subtitle="כל התראה כאן נגזרת מהמצב הנוכחי בנתונים — ונעלמת כשהבעיה נפתרת"
        actions={
          <>
            <Segmented
              value={severity}
              onChange={setSeverity}
              options={[
                { id: 'all', label: 'הכל' },
                { id: 'critical', label: 'קריטי' },
                { id: 'warn', label: 'אזהרה' },
                { id: 'info', label: 'מידע' },
              ]}
            />
            <button className={`btn ${showDismissed ? 'primary' : ''}`} onClick={() => setShowDismissed((v) => !v)}>
              {showDismissed ? 'הסתר מבוטלות' : `מבוטלות (${counts?.dismissed ?? 0})`}
            </button>
            <button className="btn" onClick={() => setShowConfig((v) => !v)}>
              ⚙️ הגדרות
            </button>
          </>
        }
      />

      {data?.quietHours && (
        <div className="card mb" style={{ borderColor: 'var(--info)' }}>
          <div className="card__body small">
            🌙 שעות שקט פעילות — התראות שולחניות מושתקות
            {data.config.quietHours.criticalOnly ? ', למעט קריטיות' : ''}.
          </div>
        </div>
      )}

      <div className="grid cols-4 mb">
        <Stat label="קריטיות" value={counts?.critical ?? 0} tone="danger" hint="דורש טיפול עכשיו" />
        <Stat label="אזהרות" value={counts?.warn ?? 0} tone="warn" hint="לטפל בקרוב" />
        <Stat label="מידע" value={counts?.info ?? 0} hint="לידיעה" />
        <Stat label="בוטלו" value={counts?.dismissed ?? 0} hint="מוסתרות מהרשימה" />
      </div>

      {showConfig && data && <AlertConfigPanel config={data.config} onSaved={reload} />}

      {loading && !data ? (
        <Loading rows={6} />
      ) : !data?.alerts.length ? (
        <Empty icon="✅" title="אין התראות פתוחות">
          כשמשהו יחרוג מהספים שהגדרתי, זה יופיע כאן.
        </Empty>
      ) : (
        <Card tight>
          <div className="feed">
            {data.alerts.map((alert) => (
              <div className={`feed__item severity-${alert.severity}`} key={alert.id}>
                <span className="feed__icon">
                  {alert.severity === 'critical' ? '🔴' : alert.severity === 'warn' ? '🟠' : 'ℹ️'}
                </span>
                <div className="feed__body">
                  <div className="feed__line">
                    <span className="bold">{alert.title}</span>
                    {alert.isNew && !alert.dismissed && <Badge tone="info">חדש</Badge>}
                    {alert.dismissed && <Badge tone="neutral">בוטלה</Badge>}
                  </div>
                  {alert.detail && <div className="small muted">{alert.detail}</div>}
                  <div className="feed__meta">
                    <span>{categoryLabel(alert.category)}</span>
                    <span>נראתה לראשונה {relativeTime(alert.firstSeenAt)}</span>
                  </div>
                  <div className="feed__actions">
                    {alert.roomCode && (
                      <Link className="btn sm" to={`/rooms/${alert.roomCode}`}>
                        פתיחת החדר
                      </Link>
                    )}
                    {alert.roomCode && alert.severity !== 'info' && (
                      <Link className="btn sm primary" to={`/rooms/${alert.roomCode}?intervene=1`}>
                        התערבות
                      </Link>
                    )}
                    {alert.category === 'feedback' && alert.entityId && (
                      <Link className="btn sm" to={`/feedback/${alert.entityId}`}>
                        פתיחת המשוב
                      </Link>
                    )}
                    {alert.userId && (
                      <Link className="btn sm" to={`/users/${alert.userId}`}>
                        פרופיל המשתמש
                      </Link>
                    )}
                    <button
                      className="btn sm ghost"
                      disabled={busy}
                      onClick={() =>
                        run(
                          () => api.post(`/alerts/${encodeURIComponent(alert.id)}/${alert.dismissed ? 'restore' : 'dismiss'}`),
                          alert.dismissed ? 'ההתראה הוחזרה' : 'ההתראה בוטלה'
                        ).then(reload)
                      }
                    >
                      {alert.dismissed ? 'החזרה' : 'ביטול'}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </>
  );
}

function categoryLabel(category: string) {
  return { room: '🏠 חדר', user: '👤 משתמש', feedback: '💬 משוב', system: '⚙️ מערכת' }[category] ?? category;
}
