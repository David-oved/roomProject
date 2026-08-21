import { useState } from 'react';
import { api } from '../../lib/api';
import { useAction } from '../../hooks/useApi';
import { useDict } from '../../lib/store';
import { Badge, Card, Empty, Field } from '../ui/primitives';
import { dateOnly } from '../../lib/format';
import type { Template } from '../../lib/types';

/** תבניות הודעה — נכתבות פעם אחת, נשלחות עשרות פעמים. */
export function TemplateManager({ templates, onChanged }: { templates: Template[]; onChanged: () => void }) {
  const dict = useDict();
  const { run, busy } = useAction();
  const [editing, setEditing] = useState<Partial<Template> | null>(null);

  const save = async () => {
    if (!editing?.name?.trim()) return;
    const result = await run(() => api.post('/templates', editing), 'התבנית נשמרה');
    if (result) {
      setEditing(null);
      onChanged();
    }
  };

  return (
    <div className="grid side">
      <Card
        title="תבניות שמורות"
        tight
        actions={
          <button className="btn sm primary" onClick={() => setEditing({ kind: 'info' })}>
            + תבנית חדשה
          </button>
        }
      >
        {!templates.length ? (
          <Empty icon="📋" title="אין תבניות">
            תבנית חוסכת כתיבה מחדש של אותה הודעה בכל פעם.
          </Empty>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>שם</th>
                <th>כותרת</th>
                <th>סוג</th>
                <th>נוצרה</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {templates.map((t) => (
                <tr key={t.id}>
                  <td className="bold">{t.name}</td>
                  <td className="truncate" style={{ maxWidth: 240 }}>
                    {t.title}
                  </td>
                  <td>
                    <Badge tone={(dict?.messageKinds?.[t.kind]?.tone as never) ?? 'neutral'}>
                      {dict?.messageKinds?.[t.kind]?.label ?? t.kind}
                    </Badge>
                  </td>
                  <td className="tiny muted">{dateOnly(t.createdAt)}</td>
                  <td>
                    <span className="row" style={{ gap: 4 }}>
                      <button className="btn sm" onClick={() => setEditing(t)}>
                        עריכה
                      </button>
                      <button
                        className="btn sm"
                        disabled={busy}
                        onClick={() =>
                          run(() => api.del(`/templates/${t.id}`), 'התבנית נמחקה').then(onChanged)
                        }
                      >
                        מחיקה
                      </button>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {editing && (
        <Card title={editing.id ? 'עריכת תבנית' : 'תבנית חדשה'}>
          <Field label="שם התבנית" hint="לשימוש פנימי בלבד">
            <input
              className="input"
              value={editing.name ?? ''}
              onChange={(e) => setEditing({ ...editing, name: e.target.value })}
            />
          </Field>
          <Field label="כותרת ההודעה">
            <input
              className="input"
              value={editing.title ?? ''}
              onChange={(e) => setEditing({ ...editing, title: e.target.value })}
            />
          </Field>
          <Field label="סוג">
            <select
              className="select"
              value={editing.kind ?? 'info'}
              onChange={(e) => setEditing({ ...editing, kind: e.target.value })}
            >
              {Object.entries(dict?.messageKinds ?? {}).map(([id, k]) => (
                <option key={id} value={id}>
                  {k.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="תוכן">
            <textarea
              className="textarea"
              value={editing.body ?? ''}
              onChange={(e) => setEditing({ ...editing, body: e.target.value })}
            />
          </Field>
          <div className="row" style={{ gap: 8 }}>
            <button className="btn primary" onClick={save} disabled={busy || !editing.name?.trim()}>
              שמירה
            </button>
            <button className="btn" onClick={() => setEditing(null)}>
              ביטול
            </button>
          </div>
        </Card>
      )}
    </div>
  );
}
