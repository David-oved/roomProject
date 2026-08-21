import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useApi, useAction } from '../../hooks/useApi';
import { api } from '../../lib/api';
import { useDict } from '../../lib/store';
import { Modal } from '../ui/Modal';
import { Badge, Field, Loading } from '../ui/primitives';
import { dateTime, relativeTime } from '../../lib/format';
import type { FeedbackItem, Template } from '../../lib/types';

/**
 * ═══════════════════════════════════════════════════════════════
 *  כרטיס משוב
 * ═══════════════════════════════════════════════════════════════
 *  שלושה אזורים: מה נכתב (לא ניתן לעריכה), מה אני עושה עם זה
 *  (סטטוס/עדיפות/הערות פנימיות), ומה נשלח בחזרה.
 *
 *  ‼️ הערה פנימית ותשובה לשולח מופרדות ויזואלית לחלוטין. תשובה
 *     שנשלחת בטעות במקום הערה פנימית היא טעות שאי אפשר לבטל.
 * ═══════════════════════════════════════════════════════════════
 */
export function FeedbackDetail() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const dict = useDict();
  const { run, busy } = useAction();
  const { data, loading, reload } = useApi<{ item: FeedbackItem }>(`/feedback/${id}`);
  const { data: messagesData } = useApi<{ templates: Template[] }>('/messages');

  const [note, setNote] = useState('');
  const [response, setResponse] = useState('');

  // חזרה לתיבה ולא navigate(-1): כניסה ישירה לקישור עמוק (מהתראה, למשל)
  // הייתה מוציאה מהאפליקציה החוצה בלחיצה על סגירה.
  const close = () => navigate('/feedback');

  if (loading && !data) {
    return (
      <Modal title="טוען משוב…" onClose={close}>
        <Loading rows={6} />
      </Modal>
    );
  }
  if (!data) return null;

  const item = data.item;
  const type = dict?.feedbackTypes?.[item.type];

  const patch = (body: Record<string, unknown>, message: string) =>
    run(() => api.post(`/feedback/${id}/state`, body), message).then(reload);

  const addNote = () =>
    run(() => api.post(`/feedback/${id}/note`, { text: note }), 'ההערה נשמרה').then(() => {
      setNote('');
      reload();
    });

  const sendResponse = () =>
    run(
      () => api.post(`/feedback/${id}/respond`, { text: response, status: 'in_progress' }),
      'התשובה נשלחה לשולח'
    ).then(() => {
      setResponse('');
      reload();
    });

  return (
    <Modal
      size="wide"
      title={
        <span className="row" style={{ gap: 8 }}>
          {type?.icon} {item.subject}
          <span className="mono tiny muted">#{item.id}</span>
        </span>
      }
      onClose={close}
      footer={
        <>
          <button
            className="btn primary"
            disabled={busy}
            onClick={() => patch({ status: 'resolved' }, 'סומן כטופל')}
          >
            סימון כטופל
          </button>
          <button className="btn" disabled={busy} onClick={() => patch({ status: 'archived' }, 'הועבר לארכיון')}>
            ארכיון
          </button>
          <button className="btn ghost" onClick={close}>
            סגירה
          </button>
        </>
      }
    >
      <div className="grid side" style={{ gap: 18 }}>
        {/* ─── מה נכתב ─── */}
        <div>
          <div className="row wrap mb" style={{ gap: 8 }}>
            <Badge tone={(type?.tone as never) ?? 'neutral'}>{type?.label}</Badge>
            <Badge tone={(dict?.priorities?.[item.priority]?.tone as never) ?? 'neutral'}>
              עדיפות {dict?.priorities?.[item.priority]?.label}
            </Badge>
            <Badge tone={(dict?.feedbackStatuses?.[item.status]?.tone as never) ?? 'neutral'}>
              {dict?.feedbackStatuses?.[item.status]?.label}
            </Badge>
          </div>

          <div className="small muted mb">
            נשלח על ידי <Link to={`/users/${item.userId}`}>{item.userName}</Link>
            {item.roomCode && (
              <>
                {' · '}
                <Link to={`/rooms/${item.roomCode}`}>
                  {item.roomName} ({item.roomCode})
                </Link>
              </>
            )}
            {' · '}
            {dateTime(item.createdAt)} ({relativeTime(item.createdAt)})
          </div>

          <div className="card" style={{ background: 'var(--gray-50)' }}>
            <div className="card__body" style={{ whiteSpace: 'pre-wrap', lineHeight: 1.65 }}>
              {item.body}
            </div>
          </div>

          {item.environment && (
            <div className="mt small">
              <span className="bold">סביבה: </span>
              <span className="muted mono tiny">
                {Object.entries(item.environment)
                  .map(([k, v]) => `${k}: ${v}`)
                  .join(' · ')}
              </span>
            </div>
          )}

          {item.attachments.length > 0 && (
            <div className="mt small">
              <span className="bold">קבצים מצורפים: </span>
              {item.attachments.map((a) => (
                <span key={a.name} className="badge neutral" style={{ marginInlineEnd: 6 }}>
                  📎 {a.name} ({Math.round(a.size / 1024)}KB)
                </span>
              ))}
            </div>
          )}

          {item.duplicates.length > 0 && (
            <div className="card mt" style={{ borderColor: 'var(--warning)' }}>
              <div className="card__body small">
                <span className="bold">ייתכן שזו כפילות:</span>
                <ul style={{ margin: '6px 0 0', paddingInlineStart: 18 }}>
                  {item.duplicates.map((d) => (
                    <li key={d.id}>
                      <Link to={`/feedback/${d.id}`}>{d.subject}</Link>{' '}
                      <span className="muted tiny">{d.roomName}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* ─── תשובה לשולח ─── */}
          <div className="divider" />
          <div className="bold mb">תשובה לשולח</div>
          {item.responses.length > 0 && (
            <div className="chat mb">
              {item.responses.map((r) => (
                <div className="bubble admin" key={r.id}>
                  {r.text}
                  <div className="bubble__meta">{dateTime(r.sentAt)}</div>
                </div>
              ))}
            </div>
          )}
          <textarea
            className="textarea"
            placeholder="מה לענות למשתמש? התשובה תגיע אליו כהודעה אישית באפליקציה."
            value={response}
            onChange={(e) => setResponse(e.target.value)}
          />
          <div className="row wrap mt" style={{ gap: 6 }}>
            <button className="btn primary" disabled={busy || !response.trim()} onClick={sendResponse}>
              שליחת תשובה
            </button>
            {messagesData?.templates.slice(0, 3).map((t) => (
              <button key={t.id} className="btn sm" onClick={() => setResponse(t.body)}>
                {t.name}
              </button>
            ))}
          </div>
        </div>

        {/* ─── ניהול ─── */}
        <div className="col" style={{ gap: 12 }}>
          <Field label="סטטוס">
            <select
              className="select"
              value={item.status}
              onChange={(e) => patch({ status: e.target.value }, 'הסטטוס עודכן')}
              disabled={busy}
            >
              {Object.entries(dict?.feedbackStatuses ?? {}).map(([id, s]) => (
                <option key={id} value={id}>
                  {s.label}
                </option>
              ))}
            </select>
          </Field>

          <Field label="עדיפות">
            <select
              className="select"
              value={item.priority}
              onChange={(e) => patch({ priority: e.target.value }, 'העדיפות עודכנה')}
              disabled={busy}
            >
              {Object.entries(dict?.priorities ?? {}).map(([id, p]) => (
                <option key={id} value={id}>
                  {p.label}
                </option>
              ))}
            </select>
          </Field>

          <Field label="קטגוריה" hint="לצורך דוחות — לא נראית למשתמש">
            <input
              className="input"
              defaultValue={item.category}
              onBlur={(e) => e.target.value !== item.category && patch({ category: e.target.value }, 'הקטגוריה עודכנה')}
            />
          </Field>

          <div className="divider" />

          <div>
            <div className="bold small mb">הערות פנימיות</div>
            <div className="tiny muted mb">פרטי לחלוטין. המשתמש לעולם לא רואה את זה.</div>
            {item.notes.map((n) => (
              <div key={n.id} className="card" style={{ marginBottom: 6, background: 'var(--warning-bg)' }}>
                <div className="card__body small" style={{ padding: '8px 10px' }}>
                  {n.text}
                  <div className="tiny muted">{dateTime(n.createdAt)}</div>
                </div>
              </div>
            ))}
            <textarea
              className="textarea"
              style={{ minHeight: 64 }}
              placeholder="הערה לעצמי…"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
            <button className="btn sm mt" disabled={busy || !note.trim()} onClick={addNote}>
              הוספת הערה
            </button>
          </div>

          <div className="divider" />

          <div>
            <div className="bold small mb">ציר זמן</div>
            <div className="timeline__list">
              <div className="timeline__row">
                <span className="t">{dateTime(item.createdAt).slice(-5)}</span>
                <span className="small">המשוב נשלח על ידי {item.userName}</span>
              </div>
              {item.timeline.map((t) => (
                <div className="timeline__row" key={t.id}>
                  <span className="t">{dateTime(t.at).slice(-5)}</span>
                  <span className="small">{t.text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}
