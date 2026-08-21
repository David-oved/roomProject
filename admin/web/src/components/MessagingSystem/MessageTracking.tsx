import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useApi, useAction } from '../../hooks/useApi';
import { api } from '../../lib/api';
import { useDict } from '../../lib/store';
import { Badge, Card, Empty, Loading, Meter, Stat } from '../ui/primitives';
import { Modal } from '../ui/Modal';
import { dateTime, duration, relativeTime } from '../../lib/format';
import type { AdminMessage, MessageTracking as Tracking } from '../../lib/types';

/** רשימת ההודעות שיצאו + מעקב מסירה וקריאה לכל אחת. */
export function MessageHistory({ messages, onChanged }: { messages: AdminMessage[]; onChanged: () => void }) {
  const dict = useDict();
  const [openId, setOpenId] = useState<string | null>(null);

  if (!messages.length) {
    return <Empty icon="📭" title="עוד לא נשלחו הודעות">כל שידור שיישלח יופיע כאן עם נתוני קריאה.</Empty>;
  }

  return (
    <>
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>הודעה</th>
              <th>סוג</th>
              <th>קהל</th>
              <th>נמענים</th>
              <th>נקראו</th>
              <th>מתי</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {messages.map((m) => (
              <tr key={m.id} className="clickable" onClick={() => setOpenId(m.id)}>
                <td>
                  <span className="bold">{m.title}</span>
                  <div className="tiny muted truncate" style={{ maxWidth: 380 }}>
                    {m.body}
                  </div>
                </td>
                <td>
                  <Badge tone={(dict?.messageKinds?.[m.kind]?.tone as never) ?? 'neutral'}>
                    {dict?.messageKinds?.[m.kind]?.label ?? m.kind}
                  </Badge>
                </td>
                <td className="small muted">{dict?.audienceTypes?.[m.audience?.type] ?? m.audience?.type}</td>
                <td className="num">{m.recipientCount}</td>
                <td style={{ minWidth: 120 }}>
                  <div className="row" style={{ gap: 6 }}>
                    <span className="num">{m.readCount}</span>
                    <Meter value={m.readCount} total={m.recipientCount || 1} tone="success" />
                  </div>
                </td>
                <td className="tiny muted">
                  {m.status === 'scheduled' ? (
                    <Badge tone="warn">מתוזמן ל{dateTime(m.sendAt)}</Badge>
                  ) : m.status === 'draft' ? (
                    <Badge tone="neutral">טיוטה</Badge>
                  ) : (
                    relativeTime(m.sendAt)
                  )}
                </td>
                <td>
                  <button className="btn sm" onClick={(e) => { e.stopPropagation(); setOpenId(m.id); }}>
                    מעקב
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {openId && <TrackingModal id={openId} onClose={() => setOpenId(null)} onChanged={onChanged} />}
    </>
  );
}

function TrackingModal({ id, onClose, onChanged }: { id: string; onClose: () => void; onChanged: () => void }) {
  const { data, loading } = useApi<{ message: AdminMessage; tracking: Tracking }>(`/messages/${id}`);
  const { run, busy } = useAction();

  if (loading && !data) {
    return (
      <Modal title="טוען…" onClose={onClose}>
        <Loading rows={5} />
      </Modal>
    );
  }
  if (!data) return null;

  const { message, tracking } = data;
  const stats = tracking.stats;

  return (
    <Modal
      size="wide"
      title={`מעקב — ${message.title}`}
      onClose={onClose}
      footer={
        <>
          <button
            className="btn"
            disabled={busy}
            onClick={() =>
              run(() => api.post(`/messages/${id}/resend`), 'ההודעה נשלחה מחדש').then(() => {
                onChanged();
                onClose();
              })
            }
          >
            שליחה מחדש
          </button>
          <button
            className="btn danger"
            disabled={busy}
            onClick={() =>
              run(() => api.del(`/messages/${id}`), 'ההודעה נמחקה מההיסטוריה').then(() => {
                onChanged();
                onClose();
              })
            }
          >
            מחיקה
          </button>
          <button className="btn ghost" onClick={onClose}>
            סגירה
          </button>
        </>
      }
    >
      <div className="grid cols-4 mb">
        <Stat label="נשלחו" value={stats.sent} />
        <Stat label="נמסרו" value={`${stats.delivered} (${stats.deliveredPercent}%)`} small />
        <Stat label="נקראו" value={`${stats.read} (${stats.readPercent}%)`} small tone={stats.readPercent < 50 ? 'warn' : 'success'} />
        <Stat label="לחצו על הכפתור" value={`${stats.clicked} (${stats.clickPercent}%)`} small />
      </div>

      <Card title="זמן עד קריאה" className="mb">
        <div className="row wrap" style={{ gap: 24 }}>
          <span>
            ממוצע: <span className="bold">{duration(stats.avgTimeToReadMs)}</span>
          </span>
          <span>
            המהיר ביותר: <span className="bold">{duration(stats.fastestMs)}</span>
          </span>
          <span>
            האיטי ביותר: <span className="bold">{duration(stats.slowestMs)}</span>
          </span>
          <span>
            מעורבות כוללת: <span className="bold">{stats.engagementPercent}%</span>
          </span>
        </div>
      </Card>

      {tracking.byRoom.length > 0 && (
        <Card title="קריאה לפי חדר" className="mb" tight>
          <table className="table">
            <thead>
              <tr>
                <th>חדר</th>
                <th>נמענים</th>
                <th>קראו</th>
                <th style={{ width: 160 }} />
              </tr>
            </thead>
            <tbody>
              {tracking.byRoom.map((r) => (
                <tr key={r.code}>
                  <td>
                    <Link to={`/rooms/${r.code}`}>{r.name}</Link>
                  </td>
                  <td className="num">{r.total}</td>
                  <td className="num">{r.read}</td>
                  <td>
                    <Meter value={r.read} total={r.total} tone={r.read === r.total ? 'success' : 'warn'} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      <Card title="נמענים" tight>
        <div style={{ maxHeight: 260, overflowY: 'auto' }}>
          <table className="table">
            <thead>
              <tr>
                <th>משתמש</th>
                <th>נמסר</th>
                <th>נקרא</th>
                <th>זמן עד קריאה</th>
              </tr>
            </thead>
            <tbody>
              {tracking.recipients.map((r) => (
                <tr key={r.uid}>
                  <td>
                    <Link to={`/users/${r.uid}`}>{r.name}</Link>
                  </td>
                  <td className="tiny muted">{r.deliveredAt ? dateTime(r.deliveredAt) : <Badge tone="warn">ממתין</Badge>}</td>
                  <td className="tiny muted">{r.readAt ? dateTime(r.readAt) : <span className="muted">טרם</span>}</td>
                  <td className="tiny">{duration(r.timeToReadMs)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </Modal>
  );
}
