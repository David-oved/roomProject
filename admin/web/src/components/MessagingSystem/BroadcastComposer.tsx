import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { useAction } from '../../hooks/useApi';
import { useDict, useStore } from '../../lib/store';
import { Card, Field, Badge } from '../ui/primitives';
import type { Audience, Template } from '../../lib/types';

/**
 * ═══════════════════════════════════════════════════════════════
 *  מחבר שידורים
 * ═══════════════════════════════════════════════════════════════
 *  ‼️ מספר הנמענים מחושב בשרת ומוצג *לפני* השליחה, ומתעדכן בכל שינוי
 *     של הקהל. "שלח לכולם" בלי לדעת מי זה כולם הוא איך שולחים
 *     הודעת תחזוקה ל-248 אנשים ב-2 בלילה.
 * ═══════════════════════════════════════════════════════════════
 */
export function BroadcastComposer({
  templates,
  onSent,
}: {
  templates: Template[];
  onSent: () => void;
}) {
  const dict = useDict();
  const { boot } = useStore();
  const { run, busy } = useAction();

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [kind, setKind] = useState('info');
  const [audience, setAudience] = useState<Audience>({ type: 'all' });
  const [mode, setMode] = useState<'send' | 'schedule' | 'draft'>('send');
  const [sendAt, setSendAt] = useState('');
  const [recurrence, setRecurrence] = useState('');
  const [ctaText, setCtaText] = useState('');
  const [ctaUrl, setCtaUrl] = useState('');
  const [preview, setPreview] = useState<{ count: number; description: string; sample: Array<{ uid: string; name: string }> } | null>(null);

  /* תצוגה מקדימה של הקהל — בכל שינוי, מיד */
  useEffect(() => {
    let cancelled = false;
    api
      .post<{ count: number; description: string; sample: Array<{ uid: string; name: string }> }>(
        '/messages/preview',
        { audience }
      )
      .then((result) => !cancelled && setPreview(result))
      .catch(() => !cancelled && setPreview(null));
    return () => {
      cancelled = true;
    };
  }, [audience]);

  const applyTemplate = (template: Template) => {
    setTitle(template.title);
    setBody(template.body);
    setKind(template.kind);
  };

  const submit = async () => {
    const result = await run(
      () =>
        api.post('/messages', {
          title,
          body,
          kind,
          audience,
          status: mode,
          sendAt: mode === 'schedule' && sendAt ? new Date(sendAt).getTime() : undefined,
          recurrence: recurrence || null,
          cta: ctaText && ctaUrl ? { text: ctaText, url: ctaUrl } : null,
        }),
      mode === 'send' ? 'ההודעה נשלחה' : mode === 'schedule' ? 'ההודעה תוזמנה' : 'נשמר כטיוטה'
    );
    if (result) {
      setTitle('');
      setBody('');
      setCtaText('');
      setCtaUrl('');
      onSent();
    }
  };

  return (
    <div className="grid side">
      <Card title="הודעה חדשה">
        <Field label="נמענים">
          <div className="radio-row mb">
            {Object.entries(dict?.audienceTypes ?? {}).map(([id, label]) => (
              <button
                key={id}
                className={`radio-card${audience.type === id ? ' active' : ''}`}
                onClick={() => setAudience({ type: id as Audience['type'] })}
              >
                {label}
              </button>
            ))}
          </div>

          {audience.type === 'room' && (
            <select
              className="select"
              value={audience.roomCode ?? ''}
              onChange={(e) => setAudience({ type: 'room', roomCode: e.target.value })}
            >
              <option value="">בחרו חדר…</option>
              {boot?.rooms.map((r) => (
                <option key={r.code} value={r.code}>
                  {r.name} ({r.code})
                </option>
              ))}
            </select>
          )}

          {audience.type === 'users' && (
            <select
              className="select"
              multiple
              size={6}
              value={audience.uids ?? []}
              onChange={(e) =>
                setAudience({
                  type: 'users',
                  uids: Array.from(e.target.selectedOptions).map((o) => o.value),
                })
              }
            >
              {boot?.users.map((u) => (
                <option key={u.uid} value={u.uid}>
                  {u.name} — {u.email}
                </option>
              ))}
            </select>
          )}

          {audience.type === 'segment' && (
            <select
              className="select"
              value={audience.segment ?? ''}
              onChange={(e) => setAudience({ type: 'segment', segment: e.target.value })}
            >
              <option value="">בחרו פלח…</option>
              {Object.entries(dict?.segments ?? {}).map(([id, s]) => (
                <option key={id} value={id}>
                  {s.label} — {s.hint}
                </option>
              ))}
            </select>
          )}
        </Field>

        <Field label="כותרת">
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={60} />
        </Field>

        <Field label="סוג ההודעה">
          <div className="radio-row">
            {Object.entries(dict?.messageKinds ?? {}).map(([id, k]) => (
              <button key={id} className={`radio-card${kind === id ? ' active' : ''}`} onClick={() => setKind(id)}>
                {k.icon} {k.label}
              </button>
            ))}
          </div>
        </Field>

        <Field label="תוכן">
          <textarea className="textarea" value={body} onChange={(e) => setBody(e.target.value)} />
        </Field>

        <Field label="כפתור פעולה (רשות)" hint="מופיע בתחתית ההודעה באפליקציה">
          <div className="row" style={{ gap: 8 }}>
            <input className="input" placeholder="טקסט הכפתור" value={ctaText} onChange={(e) => setCtaText(e.target.value)} />
            <input className="input" placeholder="https://…" value={ctaUrl} onChange={(e) => setCtaUrl(e.target.value)} />
          </div>
        </Field>

        <Field label="מועד שליחה">
          <div className="radio-row mb">
            <button className={`radio-card${mode === 'send' ? ' active' : ''}`} onClick={() => setMode('send')}>
              שליחה מיידית
            </button>
            <button className={`radio-card${mode === 'schedule' ? ' active' : ''}`} onClick={() => setMode('schedule')}>
              תזמון
            </button>
            <button className={`radio-card${mode === 'draft' ? ' active' : ''}`} onClick={() => setMode('draft')}>
              שמירה כטיוטה
            </button>
          </div>
          {mode === 'schedule' && (
            <div className="row" style={{ gap: 8 }}>
              <input
                className="input"
                type="datetime-local"
                value={sendAt}
                onChange={(e) => setSendAt(e.target.value)}
              />
              <select className="select" value={recurrence} onChange={(e) => setRecurrence(e.target.value)}>
                <option value="">חד פעמי</option>
                <option value="daily">כל יום</option>
                <option value="weekly">כל שבוע</option>
                <option value="monthly">כל חודש</option>
              </select>
            </div>
          )}
        </Field>

        <button
          className="btn primary block"
          disabled={busy || !title.trim() || !body.trim() || (mode === 'schedule' && !sendAt)}
          onClick={submit}
        >
          {busy
            ? 'שולח…'
            : mode === 'send'
              ? `שליחה ל-${preview?.count ?? 0} משתמשים`
              : mode === 'schedule'
                ? 'תזמון ההודעה'
                : 'שמירת טיוטה'}
        </button>
      </Card>

      <div className="col" style={{ gap: 14 }}>
        <Card title="למי זה הולך">
          <div className="stat__value">{preview?.count ?? 0}</div>
          <div className="small muted">{preview?.description ?? '—'}</div>
          {preview?.sample.length ? (
            <div className="row wrap mt" style={{ gap: 4 }}>
              {preview.sample.map((u) => (
                <span key={u.uid} className="badge neutral">
                  {u.name}
                </span>
              ))}
              {preview.count > preview.sample.length && (
                <span className="badge outline">ועוד {preview.count - preview.sample.length}</span>
              )}
            </div>
          ) : null}
        </Card>

        <Card title="תצוגה מקדימה" subtitle="כך זה ייראה באפליקציה">
          <div className="card" style={{ background: 'var(--gray-50)' }}>
            <div className="card__body">
              <div className="row" style={{ gap: 6 }}>
                <span>{dict?.messageKinds?.[kind]?.icon}</span>
                <span className="bold">{title || 'כותרת ההודעה'}</span>
              </div>
              <div className="small mt" style={{ whiteSpace: 'pre-wrap' }}>
                {body || 'תוכן ההודעה יופיע כאן.'}
              </div>
              {ctaText && ctaUrl && (
                <button className="btn primary sm mt" disabled>
                  {ctaText} ←
                </button>
              )}
            </div>
          </div>
        </Card>

        <Card title="תבניות" subtitle="לחיצה ממלאת את הטופס">
          {!templates.length ? (
            <span className="muted small">אין תבניות שמורות</span>
          ) : (
            templates.map((t) => (
              <div className="row between" key={t.id} style={{ padding: '4px 0' }}>
                <span className="small">
                  <Badge tone={(dict?.messageKinds?.[t.kind]?.tone as never) ?? 'neutral'}>
                    {dict?.messageKinds?.[t.kind]?.icon}
                  </Badge>{' '}
                  {t.name}
                </span>
                <button className="btn sm" onClick={() => applyTemplate(t)}>
                  שימוש
                </button>
              </div>
            ))
          )}
        </Card>
      </div>
    </div>
  );
}
