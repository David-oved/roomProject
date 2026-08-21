import { Link } from 'react-router-dom';
import { useApi } from '../hooks/useApi';
import { Badge, Card, Empty, Loading, PageHead, Score, Stat } from './ui/primitives';
import { Bars } from './ui/charts';
import { EventRow } from './ActivityMonitoring/EventRow';
import { FeedbackList } from './FeedbackManagement/FeedbackList';
import { relativeTime, shekels } from '../lib/format';
import type { Overview } from '../lib/types';

/**
 * מסך הבית: מה דורש טיפול עכשיו, ואיך המערכת נראית ברמה הגבוהה.
 * כל כרטיס כאן הוא קישור למקום שבו מטפלים בבעיה — לא רק מספר.
 */
export function Dashboard() {
  const { data, loading } = useApi<Overview>('/overview');

  if (loading && !data) return <Loading rows={10} />;
  if (!data) return <Empty icon="📊" title="אין נתונים להצגה" />;

  const c = data.cards;
  const needsAttention = c.pendingPurchases + c.pendingJoins + c.newFeedback;

  return (
    <>
      <PageHead
        title="סקירה כללית"
        subtitle={`${c.users} משתמשים · ${c.rooms} חדרים · ${c.actionsToday} פעולות ב-24 השעות האחרונות`}
        actions={
          <Link className="btn primary" to="/activity">
            🔴 לפיד החי
          </Link>
        }
      />

      {needsAttention > 0 && (
        <Card
          className="mb"
          title="דורש טיפול"
          subtitle="פעולות שמישהו מחכה להן ברגע זה"
        >
          <div className="row wrap" style={{ gap: 10 }}>
            {c.pendingPurchases > 0 && (
              <Link className="btn" to="/rooms">
                🧾 {c.pendingPurchases} קניות ממתינות לאישור
              </Link>
            )}
            {c.pendingJoins > 0 && (
              <Link className="btn" to="/rooms">
                👥 {c.pendingJoins} בקשות הצטרפות
              </Link>
            )}
            {c.newFeedback > 0 && (
              <Link className="btn" to="/feedback">
                💬 {c.newFeedback} משובים חדשים
              </Link>
            )}
            {c.roomsCritical > 0 && (
              <Link className="btn danger" to="/rooms?level=critical">
                🔴 {c.roomsCritical} חדרים במצב קריטי
              </Link>
            )}
          </div>
        </Card>
      )}

      <div className="grid cols-6 mb">
        <Stat label="משתמשים פעילים" value={`${c.activeUsers}/${c.users}`} hint={`${c.activePercent}% בשבוע האחרון`} />
        <Stat label="חדרים" value={c.rooms} hint={`${c.roomsAtRisk} בסיכון · ${c.roomsCritical} קריטיים`} tone={c.roomsCritical ? 'danger' : undefined} />
        <Stat label="פעולות היום" value={c.actionsToday} hint="כל סוגי הפעולות" />
        <Stat label="הוצאה היום" value={shekels(c.spendToday)} small hint="סך הקניות שנרשמו" />
        <Stat label="מוצרים פתוחים" value={c.openItems} hint="בכל החדרים" />
        <Stat label="התראות" value={c.openAlerts} tone={c.openAlerts ? 'warn' : undefined} hint="פתוחות כרגע" />
      </div>

      <div className="grid side mb">
        <Card title="פעילות אחרונה" tight actions={<Link className="btn sm" to="/activity">הכל</Link>}>
          <div className="feed">
            {data.recentEvents.map((event) => (
              <EventRow key={event.id} event={event} />
            ))}
          </div>
        </Card>

        <div className="col" style={{ gap: 14 }}>
          <Card title="פעילות יומית" subtitle="14 ימים אחרונים">
            <Bars
              data={data.daily.map((d) => d.actions)}
              labels={data.daily.map((d) => new Date(d.date).toLocaleDateString('he-IL', { day: 'numeric', month: 'numeric' }))}
              height={90}
            />
          </Card>

          <Card title="התראות פתוחות" tight actions={<Link className="btn sm" to="/alerts">הכל</Link>}>
            {!data.topAlerts.length ? (
              <Empty icon="✅" title="אין התראות" />
            ) : (
              <div className="feed">
                {data.topAlerts.map((alert) => (
                  <div className={`feed__item severity-${alert.severity}`} key={alert.id}>
                    <span className="feed__icon">
                      {alert.severity === 'critical' ? '🔴' : alert.severity === 'warn' ? '🟠' : 'ℹ️'}
                    </span>
                    <div className="feed__body">
                      <div className="bold small">{alert.title}</div>
                      {alert.detail && <div className="tiny muted">{alert.detail}</div>}
                      <div className="feed__meta">
                        <span>{relativeTime(alert.firstSeenAt)}</span>
                        {alert.roomCode && <Link to={`/rooms/${alert.roomCode}`}>לחדר</Link>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>

      <div className="grid side">
        <Card title="החדרים שדורשים תשומת לב" tight actions={<Link className="btn sm" to="/rooms">כל החדרים</Link>}>
          <table className="table">
            <thead>
              <tr>
                <th>חדר</th>
                <th>ציון</th>
                <th>בעיות</th>
                <th>פעילות אחרונה</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {data.worstRooms.map((room) => (
                <tr key={room.code}>
                  <td>
                    <Link to={`/rooms/${room.code}`} className="bold">
                      {room.name}
                    </Link>
                    <div className="tiny muted mono">{room.code}</div>
                  </td>
                  <td>
                    <Score score={room.score} level={room.level} />
                  </td>
                  <td>
                    {room.issues.length === 0 ? (
                      <Badge tone="success">תקין</Badge>
                    ) : (
                      <span className="col" style={{ gap: 2 }}>
                        {room.issues.slice(0, 2).map((issue) => (
                          <span className="tiny" key={issue.code}>
                            {issue.severity === 'critical' ? '🔴' : '🟠'} {issue.title}
                          </span>
                        ))}
                        {room.issues.length > 2 && (
                          <span className="tiny muted">ועוד {room.issues.length - 2}</span>
                        )}
                      </span>
                    )}
                  </td>
                  <td className="tiny muted">{relativeTime(room.lastActivityAt)}</td>
                  <td>
                    {room.level !== 'healthy' && (
                      <Link className="btn sm" to={`/rooms/${room.code}?intervene=1`}>
                        התערבות
                      </Link>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        <Card title="משוב אחרון" tight actions={<Link className="btn sm" to="/feedback">התיבה</Link>}>
          {data.latestFeedback.length ? (
            <FeedbackList items={data.latestFeedback} />
          ) : (
            <Empty icon="💬" title="אין משוב חדש" />
          )}
        </Card>
      </div>
    </>
  );
}
