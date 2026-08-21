import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useApi, useAction } from '../../hooks/useApi';
import { api } from '../../lib/api';
import { Avatar, Badge, Card, Empty, Loading } from '../ui/primitives';
import { dateTime, relativeTime } from '../../lib/format';
import type { Membership, Template, Thread } from '../../lib/types';

/**
 * ═══════════════════════════════════════════════════════════════
 *  שיחה אישית עם משתמש
 * ═══════════════════════════════════════════════════════════════
 *  ההודעות שאני שולח מגיעות לתיבה האישית של המשתמש באפליקציה,
 *  ותשובות שלו חוזרות לאותו שרשור. אותו ערוץ בדיוק שבו נשלחות
 *  תשובות למשוב — כדי שלמשתמש תהיה שיחה אחת ולא שלוש.
 * ═══════════════════════════════════════════════════════════════
 */
export function DirectMessages({ initialUid, templates }: { initialUid?: string; templates: Template[] }) {
  const [selected, setSelected] = useState<string | null>(initialUid ?? null);
  const { data, loading } = useApi<{ threads: Thread[] }>('/threads');

  useEffect(() => {
    if (!selected && data?.threads.length) setSelected(data.threads[0].uid);
  }, [data, selected]);

  return (
    <div className="grid side-start">
      <Card title="שיחות" tight>
        {loading && !data ? (
          <Loading rows={4} />
        ) : !data?.threads.length ? (
          <Empty icon="💬" title="אין שיחות">
            אפשר לפתוח שיחה מכל מסך משתמש.
          </Empty>
        ) : (
          <div className="feed">
            {data.threads.map((thread) => (
              <button
                key={thread.uid}
                className="feed__item"
                style={{
                  width: '100%',
                  border: 'none',
                  background: selected === thread.uid ? 'var(--navy-50)' : 'none',
                  cursor: 'pointer',
                  textAlign: 'start',
                }}
                onClick={() => setSelected(thread.uid)}
              >
                <Avatar name={thread.name} />
                <span className="feed__body">
                  <span className="feed__line">
                    <span className="bold">{thread.name}</span>
                    {thread.unread > 0 && <Badge tone="danger">{thread.unread}</Badge>}
                    {thread.online && <Badge tone="success">מחובר</Badge>}
                  </span>
                  <span className="tiny muted truncate" style={{ display: 'block', maxWidth: 240 }}>
                    {thread.lastMessage?.text ?? '—'}
                  </span>
                  <span className="feed__meta">{relativeTime(thread.lastMessage?.sentAt ?? 0)}</span>
                </span>
              </button>
            ))}
          </div>
        )}
      </Card>

      {selected ? <Conversation uid={selected} templates={templates} /> : <Card title="שיחה"><Empty icon="👈" title="בחרו שיחה" /></Card>}
    </div>
  );
}

export function Conversation({ uid, templates }: { uid: string; templates: Template[] }) {
  const { data, loading, reload } = useApi<{
    thread: Thread;
    user: { uid: string; name: string; email: string; lastActiveAt: number; memberships: Membership[] } | null;
  }>(`/threads/${uid}`);
  const { run, busy } = useAction();
  const [text, setText] = useState('');
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [data]);

  /* סימון "נקרא על ידי" כשנכנסים לשיחה — אחרת המונה בסרגל לא מתאפס */
  useEffect(() => {
    if (data?.thread.unread) {
      api.post(`/threads/${uid}/read`).then(reload).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, data?.thread.unread]);

  const send = async () => {
    const result = await run(() => api.post(`/threads/${uid}`, { text }), 'ההודעה נשלחה');
    if (result) {
      setText('');
      reload();
    }
  };

  if (loading && !data) return <Card title="שיחה"><Loading rows={5} /></Card>;
  if (!data) return null;

  const { thread, user } = data;

  return (
    <Card
      title={
        <span className="row" style={{ gap: 8 }}>
          <Avatar name={thread.name} size="sm" />
          <Link to={`/users/${uid}`}>{thread.name}</Link>
        </span>
      }
      subtitle={
        <>
          {user?.email} · פעיל {relativeTime(user?.lastActiveAt ?? 0)}
          {user?.memberships.filter((m) => m.status === 'active').map((m) => (
            <span key={m.roomCode} className="badge neutral" style={{ marginInlineStart: 6 }}>
              {m.roomName}
              {m.role === 'admin' ? ' (מנהל)' : ''}
            </span>
          ))}
        </>
      }
    >
      <div className="chat scroll-y" style={{ maxHeight: 420, minHeight: 200 }}>
        {!thread.messages.length && <Empty icon="✍️" title="אין עדיין הודעות" />}
        {thread.messages.map((m) => (
          <div key={m.id} className={`bubble ${m.from === 'admin' ? 'admin' : 'user'}`}>
            {m.text}
            <div className="bubble__meta">
              {dateTime(m.sentAt)}
              {m.from === 'admin' && (m.readAt ? ' · נקרא' : ' · נשלח')}
              {m.relatedFeedback && ' · תשובה למשוב'}
            </div>
          </div>
        ))}
        <div ref={endRef} />
      </div>

      <div className="divider" />

      <textarea
        className="textarea"
        style={{ minHeight: 70 }}
        placeholder="כתבו הודעה…"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          // ‼️ Enter שולח, Shift+Enter יורד שורה — כמו בכל צ׳אט. בלי זה
          //    כל הודעה דורשת עכבר, ותשובה מהירה מפסיקה להיות מהירה.
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            if (text.trim()) send();
          }
        }}
      />
      <div className="row wrap mt" style={{ gap: 6 }}>
        <button className="btn primary" disabled={busy || !text.trim()} onClick={send}>
          שליחה
        </button>
        {templates.slice(0, 4).map((t) => (
          <button key={t.id} className="btn sm" onClick={() => setText(t.body)}>
            {t.name}
          </button>
        ))}
      </div>
    </Card>
  );
}
