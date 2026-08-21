import { useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useApi, useAction } from '../../hooks/useApi';
import { api } from '../../lib/api';
import {
  Avatar,
  Badge,
  Card,
  Empty,
  Loading,
  PageHead,
  Score,
  Stat,
  Tabs,
} from '../ui/primitives';
import { HBar } from '../ui/charts';
import { RoomActivityLog } from '../ActivityMonitoring/RoomActivityLog';
import { RoomIntervention } from './RoomIntervention';
import { FeedbackList } from '../FeedbackManagement/FeedbackList';
import { dateOnly, pluralDays, relativeTime, shekels, signedShekels } from '../../lib/format';
import type { RoomDetail as RoomDetailData } from '../../lib/types';

type TabId = 'overview' | 'members' | 'items' | 'log' | 'feedback';

/** מסך חדר יחיד — כל מה שידוע על החדר, וכל מה שאפשר לעשות בו. */
export function RoomDetail() {
  const { code = '' } = useParams();
  const [params, setParams] = useSearchParams();
  const [tab, setTab] = useState<TabId>('overview');
  const { data, loading, reload } = useApi<RoomDetailData>(`/rooms/${code}`);
  const { run, busy } = useAction();
  const intervening = params.get('intervene') === '1';

  if (loading && !data) return <Loading rows={8} />;
  if (!data) return <Empty icon="🏚️" title="החדר לא נמצא" />;

  const { room, health, members, contributors, openItems, pendingPurchases, pendingRequests, tasks, feedback, log } =
    data;

  const act = (body: Record<string, unknown>, message: string) =>
    run(() => api.post(`/rooms/${code}/action`, body), message).then(reload);

  const openIntervention = () => {
    params.set('intervene', '1');
    setParams(params);
  };
  const closeIntervention = () => {
    params.delete('intervene');
    setParams(params);
  };

  const maxBorne = Math.max(1, ...contributors.map((c) => c.borne));

  return (
    <>
      <PageHead
        title={room.name}
        subtitle={
          <>
            <span className="mono">{room.code}</span> · נוצר {dateOnly(room.createdAt)} · מנהל:{' '}
            <Link to={`/users/${room.adminId}`}>{room.adminName}</Link>
            {room.archivedAt && <Badge tone="neutral"> מאורכב</Badge>}
          </>
        }
        actions={
          <>
            <Link className="btn" to="/rooms">
              → כל החדרים
            </Link>
            <button className="btn primary" onClick={openIntervention}>
              🛠️ כלי התערבות
            </button>
          </>
        }
      />

      <div className="grid cols-6 mb">
        <div className="stat">
          <span className="stat__label">ציון בריאות</span>
          <div className="row" style={{ gap: 10, marginTop: 4 }}>
            <Score score={health.score} level={health.level} />
            <span className="tiny muted">
              {health.level === 'healthy' ? 'תקין' : health.level === 'risk' ? 'בסיכון' : 'קריטי'}
              <br />
              {health.issues.length} בעיות
            </span>
          </div>
        </div>
        <Stat label="חברים" value={`${health.membersActive}/${health.membersTotal}`} hint={`${health.membersInactive} לא נכנסו חודש`} />
        <Stat label="פער מאזנים" value={shekels(health.spread)} tone={health.spread > 100000 ? 'danger' : undefined} hint="בין הזכאי הגדול לחייב הגדול" />
        <Stat label="סך הוצאות" value={shekels(room.totalSpent)} hint="מאז הקמת החדר" />
        <Stat label="מוצרים פתוחים" value={openItems.length} hint={health.oldestOpenItemDays ? `הוותיק: ${pluralDays(health.oldestOpenItemDays)}` : 'אין תקועים'} tone={health.oldestOpenItemDays && health.oldestOpenItemDays > 7 ? 'warn' : undefined} />
        <Stat label="פעילות אחרונה" value={relativeTime(room.lastActivityAt)} small hint={pluralDays(health.idleDays)} />
      </div>

      {(pendingPurchases.length > 0 || pendingRequests.length > 0) && (
        <Card title="ממתין לטיפול" className="mb" subtitle="פעולות שמישהו מחכה להן ברגע זה">
          {pendingPurchases.map((p) => (
            <div className="row between" key={p.id} style={{ padding: '6px 0', borderBottom: '1px solid var(--gray-100)' }}>
              <span>
                🧾 <span className="bold">{p.title}</span> · {shekels(p.amount)} · דווח על ידי{' '}
                {members.find((m) => m.uid === p.boughtBy)?.name ?? p.boughtBy} · {relativeTime(p.createdAt ?? p.date)}
              </span>
              <span className="row" style={{ gap: 6 }}>
                <button
                  className="btn sm primary"
                  disabled={busy}
                  onClick={() => act({ action: 'approve_purchase', purchaseId: p.id }, 'הקנייה אושרה והמאזנים עודכנו')}
                >
                  אישור
                </button>
                <button
                  className="btn sm"
                  disabled={busy}
                  onClick={() => act({ action: 'reject_purchase', purchaseId: p.id }, 'הקנייה נדחתה')}
                >
                  דחייה
                </button>
              </span>
            </div>
          ))}
          {pendingRequests.map((r) => (
            <div className="row between" key={r.userId} style={{ padding: '6px 0', borderBottom: '1px solid var(--gray-100)' }}>
              <span>
                👥 <span className="bold">{r.displayName}</span> ביקש להצטרף · {relativeTime(r.requestedAt)}
              </span>
              <span className="row" style={{ gap: 6 }}>
                <button className="btn sm primary" disabled={busy} onClick={() => act({ action: 'approve_join', uid: r.userId }, 'הבקשה אושרה')}>
                  אישור
                </button>
                <button className="btn sm" disabled={busy} onClick={() => act({ action: 'reject_join', uid: r.userId }, 'הבקשה נדחתה')}>
                  דחייה
                </button>
              </span>
            </div>
          ))}
        </Card>
      )}

      <Tabs
        active={tab}
        onChange={setTab}
        tabs={[
          { id: 'overview', label: 'סקירה' },
          { id: 'members', label: 'חברים', count: members.length },
          { id: 'items', label: 'מוצרים ומטלות', count: openItems.length },
          { id: 'log', label: 'יומן' },
          { id: 'feedback', label: 'משוב', count: feedback.length },
        ]}
      />

      {tab === 'overview' && (
        <div className="grid side">
          <Card title="מי נושא בעלות" subtitle="הפער כאן הוא מה שהופך לוויכוח">
            {contributors.map((c) => (
              <HBar
                key={c.uid}
                label={c.name}
                value={c.borne}
                max={maxBorne}
                display={shekels(c.borne)}
              />
            ))}
            <div className="divider" />
            <table className="table">
              <thead>
                <tr>
                  <th>חבר</th>
                  <th>מאזן</th>
                  <th>דיווח</th>
                  <th>קנה</th>
                  <th>יחס</th>
                </tr>
              </thead>
              <tbody>
                {contributors.map((c) => (
                  <tr key={c.uid}>
                    <td>
                      <Link to={`/users/${c.uid}`}>{c.name}</Link>
                      {c.role === 'admin' && <Badge tone="info"> מנהל</Badge>}
                    </td>
                    <td className={`num ${c.balance >= 0 ? 'pos' : 'neg'}`}>{signedShekels(c.balance)}</td>
                    <td className="num">{c.reported}</td>
                    <td className="num">{c.bought}</td>
                    <td className="num">
                      {c.ratio === null ? (
                        <Badge tone="warn">מדווח ולא קונה</Badge>
                      ) : (
                        `${c.ratio}:1`
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          <div className="col" style={{ gap: 14 }}>
            <Card title="בעיות פתוחות">
              {health.issues.length === 0 ? (
                <Empty icon="✅" title="אין בעיות">
                  החדר מתנהל בסדר גמור.
                </Empty>
              ) : (
                health.issues.map((issue) => (
                  <div key={issue.code} style={{ marginBottom: 10 }}>
                    <Badge tone={issue.severity === 'critical' ? 'danger' : 'warn'}>
                      {issue.severity === 'critical' ? 'קריטי' : 'אזהרה'}
                    </Badge>
                    <div className="bold small" style={{ marginTop: 3 }}>{issue.title}</div>
                    {issue.detail && <div className="tiny muted">{issue.detail}</div>}
                  </div>
                ))
              )}
            </Card>

            <Card title="מטלות קבועות">
              {!tasks.length ? (
                <span className="muted small">אין מטלות מוגדרות</span>
              ) : (
                tasks.map((t) => (
                  <div className="row between small" key={t.id} style={{ padding: '4px 0' }}>
                    <span>🧹 {t.name}</span>
                    <span className="muted tiny">
                      {members.find((m) => m.uid === t.currentAssignee)?.name ?? '—'} · כל {t.intervalDays} ימים
                    </span>
                  </div>
                ))
              )}
            </Card>
          </div>
        </div>
      )}

      {tab === 'members' && (
        <Card tight>
          <table className="table">
            <thead>
              <tr>
                <th>חבר</th>
                <th>תפקיד</th>
                <th>סטטוס</th>
                <th>הצטרף</th>
                <th>מאזן</th>
                <th>פעיל לאחרונה</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.uid}>
                  <td>
                    <span className="row" style={{ gap: 8 }}>
                      <Avatar name={m.name} size="sm" />
                      <Link to={`/users/${m.uid}`}>{m.name}</Link>
                    </span>
                  </td>
                  <td>{m.uid === room.adminId ? <Badge tone="info">מנהל</Badge> : <span className="muted">חבר</span>}</td>
                  <td>{m.status === 'active' ? <Badge tone="success">פעיל</Badge> : <Badge tone="neutral">הוסר</Badge>}</td>
                  <td className="tiny muted">{dateOnly(m.joinedAt)}</td>
                  <td className={`num ${m.balance >= 0 ? 'pos' : 'neg'}`}>{signedShekels(m.balance)}</td>
                  <td className="tiny muted">{relativeTime(m.lastActiveAt)}</td>
                  <td>
                    {m.status === 'active' && m.uid !== room.adminId && (
                      <span className="row" style={{ gap: 4 }}>
                        <button
                          className="btn sm"
                          disabled={busy}
                          onClick={() => act({ action: 'transfer_admin', uid: m.uid }, `${m.name} מונה למנהל החדר`)}
                        >
                          מינוי כמנהל
                        </button>
                        <button
                          className="btn sm"
                          disabled={busy}
                          onClick={() => act({ action: 'remove_member', uid: m.uid }, `${m.name} הוסר מהחדר`)}
                        >
                          הסרה
                        </button>
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {tab === 'items' && (
        <div className="grid side">
          <Card title="מוצרים פתוחים" subtitle="ממוין מהוותיק לחדש" tight>
            {!openItems.length ? (
              <Empty icon="📦" title="אין מוצרים פתוחים" />
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>מוצר</th>
                    <th>דווח על ידי</th>
                    <th>מתי</th>
                    <th>עדיפות</th>
                  </tr>
                </thead>
                <tbody>
                  {openItems.map((item) => {
                    const age = Math.floor((Date.now() - item.reportedAt) / 86_400_000);
                    return (
                      <tr key={item.id}>
                        <td className="bold">{item.name}</td>
                        <td>{members.find((m) => m.uid === item.reportedBy)?.name ?? item.reportedBy}</td>
                        <td>
                          <span className={age > 7 ? 'neg' : 'muted'}>{pluralDays(age)}</span>
                        </td>
                        <td>{item.priority === 'high' ? <Badge tone="danger">דחוף</Badge> : <span className="muted">רגיל</span>}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </Card>
          <Card title="מטלות">
            {tasks.map((t) => (
              <div key={t.id} className="row between small" style={{ padding: '5px 0' }}>
                <span>{t.name}</span>
                <span className="tiny muted">{relativeTime(t.dueAt)}</span>
              </div>
            ))}
          </Card>
        </div>
      )}

      {tab === 'log' && (
        <Card tight title="יומן החדר">
          <RoomActivityLog log={log} />
        </Card>
      )}

      {tab === 'feedback' && (
        <Card tight title="משוב מהחדר">
          {feedback.length ? <FeedbackList items={feedback} /> : <Empty icon="💬" title="אין משוב מהחדר הזה" />}
        </Card>
      )}

      {intervening && <RoomIntervention detail={data} onClose={closeIntervention} onDone={reload} />}
    </>
  );
}
