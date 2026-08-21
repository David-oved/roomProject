import { useState } from 'react';
import { api } from '../../lib/api';
import { useAction } from '../../hooks/useApi';
import { Card, Field } from '../ui/primitives';
import type { AlertConfig } from '../../lib/types';

/** הגדרות ההתראות — מה מפעיל התראה, איך היא מגיעה, ומתי לא. */
export function AlertConfigPanel({ config, onSaved }: { config: AlertConfig; onSaved: () => void }) {
  const [draft, setDraft] = useState<AlertConfig>(structuredClone(config));
  const { run, busy } = useAction();

  const save = () =>
    run(() => api.put('/alerts/config', draft), 'ההגדרות נשמרו').then(onSaved);

  const reset = () =>
    run(() => api.post<{ config: AlertConfig }>('/alerts/config/reset'), 'ההגדרות אופסו').then((result) => {
      if (result) setDraft(result.config);
      onSaved();
    });

  const toggleTrigger = (key: string) =>
    setDraft({
      ...draft,
      triggers: {
        ...draft.triggers,
        [key]: { ...draft.triggers[key], enabled: !draft.triggers[key].enabled },
      },
    });

  const bySeverity = (severity: string) =>
    Object.entries(draft.triggers).filter(([, t]) => t.severity === severity);

  return (
    <Card
      title="הגדרות התראות"
      className="mb"
      actions={
        <>
          <button className="btn sm" onClick={reset} disabled={busy}>
            איפוס לברירת מחדל
          </button>
          <button className="btn sm primary" onClick={save} disabled={busy}>
            שמירה
          </button>
        </>
      }
    >
      <div className="grid cols-3">
        <div>
          <div className="bold small mb">טריגרים קריטיים</div>
          {bySeverity('critical').map(([key, trigger]) => (
            <label className="check" key={key}>
              <input type="checkbox" checked={trigger.enabled} onChange={() => toggleTrigger(key)} />
              <span>{trigger.label}</span>
            </label>
          ))}

          <div className="bold small mb mt">טריגרים לאזהרה</div>
          {bySeverity('warn').map(([key, trigger]) => (
            <label className="check" key={key}>
              <input type="checkbox" checked={trigger.enabled} onChange={() => toggleTrigger(key)} />
              <span>{trigger.label}</span>
            </label>
          ))}
        </div>

        <div>
          <div className="bold small mb">טריגרים לידיעה</div>
          {bySeverity('info').map(([key, trigger]) => (
            <label className="check" key={key}>
              <input type="checkbox" checked={trigger.enabled} onChange={() => toggleTrigger(key)} />
              <span>{trigger.label}</span>
            </label>
          ))}

          <div className="bold small mb mt">ספים</div>
          <Field label="פעולות בשעה שנחשבות חריגות">
            <input
              className="input"
              type="number"
              value={draft.thresholds.unusualActionsPerHour}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  thresholds: { ...draft.thresholds, unusualActionsPerHour: Number(e.target.value) },
                })
              }
            />
          </Field>
          <Field label="ימים עד שמשתמש נחשב רדום">
            <input
              className="input"
              type="number"
              value={draft.thresholds.dormantDays}
              onChange={(e) =>
                setDraft({ ...draft, thresholds: { ...draft.thresholds, dormantDays: Number(e.target.value) } })
              }
            />
          </Field>
        </div>

        <div>
          <div className="bold small mb">אופן ההגעה</div>
          <label className="check">
            <input
              type="checkbox"
              checked={draft.delivery.desktop}
              onChange={(e) => setDraft({ ...draft, delivery: { ...draft.delivery, desktop: e.target.checked } })}
            />
            <span>
              התראות שולחן
              <span className="check__hint">קופצות מהדפדפן. דורש אישור חד-פעמי.</span>
            </span>
          </label>
          <label className="check">
            <input
              type="checkbox"
              checked={draft.delivery.badge}
              onChange={(e) => setDraft({ ...draft, delivery: { ...draft.delivery, badge: e.target.checked } })}
            />
            <span>מונה בסרגל הצד</span>
          </label>
          <label className="check">
            <input
              type="checkbox"
              checked={draft.delivery.email}
              onChange={(e) => setDraft({ ...draft, delivery: { ...draft.delivery, email: e.target.checked } })}
            />
            <span>
              מייל להתראות קריטיות
              <span className="check__hint">
                דורש הגדרת SMTP בשרת המקומי — ראו admin/README.md. עד אז הסימון נשמר ואינו פעיל.
              </span>
            </span>
          </label>
          {draft.delivery.email && (
            <Field label="כתובת מייל">
              <input
                className="input"
                type="email"
                value={draft.delivery.emailAddress}
                onChange={(e) =>
                  setDraft({ ...draft, delivery: { ...draft.delivery, emailAddress: e.target.value } })
                }
              />
            </Field>
          )}

          <div className="bold small mb mt">שעות שקט</div>
          <label className="check">
            <input
              type="checkbox"
              checked={draft.quietHours.enabled}
              onChange={(e) =>
                setDraft({ ...draft, quietHours: { ...draft.quietHours, enabled: e.target.checked } })
              }
            />
            <span>הפעלת שעות שקט</span>
          </label>
          {draft.quietHours.enabled && (
            <>
              <div className="row" style={{ gap: 8 }}>
                <Field label="מ">
                  <input
                    className="input"
                    type="time"
                    value={draft.quietHours.from}
                    onChange={(e) =>
                      setDraft({ ...draft, quietHours: { ...draft.quietHours, from: e.target.value } })
                    }
                  />
                </Field>
                <Field label="עד">
                  <input
                    className="input"
                    type="time"
                    value={draft.quietHours.to}
                    onChange={(e) =>
                      setDraft({ ...draft, quietHours: { ...draft.quietHours, to: e.target.value } })
                    }
                  />
                </Field>
              </div>
              <label className="check">
                <input
                  type="checkbox"
                  checked={draft.quietHours.criticalOnly}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      quietHours: { ...draft.quietHours, criticalOnly: e.target.checked },
                    })
                  }
                />
                <span>לאפשר התראות קריטיות גם בשעות השקט</span>
              </label>
            </>
          )}
        </div>
      </div>
    </Card>
  );
}
