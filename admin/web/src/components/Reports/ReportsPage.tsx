import { useState } from 'react';
import { useApi } from '../../hooks/useApi';
import { api } from '../../lib/api';
import { useDict } from '../../lib/store';
import { Card, Empty, Loading, PageHead, Segmented, Stat } from '../ui/primitives';
import { dateOnly } from '../../lib/format';
import type { Report } from '../../lib/types';

const CUSTOM_METRICS = [
  { id: 'users_active', label: 'משתמשים פעילים' },
  { id: 'rooms_active', label: 'חדרים פעילים' },
  { id: 'items', label: 'מוצרים שדווחו' },
  { id: 'purchases', label: 'קניות' },
  { id: 'spend', label: 'סך הוצאה' },
  { id: 'feedback', label: 'משוב' },
  { id: 'tasks', label: 'מטלות' },
  { id: 'messages', label: 'הודעות צ׳אט' },
];

/**
 * ═══════════════════════════════════════════════════════════════
 *  דוחות
 * ═══════════════════════════════════════════════════════════════
 *  כל הדוחות חולקים מבנה אחד (כרטיסים + טבלאות), ולכן מסך אחד מציג
 *  את כולם וייצוא אחד עובד על כולם.
 *
 *  ‼️ אין ייצוא PDF ישיר: הדוח נפתח כ-HTML מעוצב להדפסה, והדפדפן
 *     מייצר PDF. ספריית PDF הייתה מוסיפה מגה-בייטים כדי לעשות פחות
 *     טוב את מה שכל דפדפן כבר יודע.
 * ═══════════════════════════════════════════════════════════════
 */
export function ReportsPage() {
  const dict = useDict();
  const [type, setType] = useState('daily');
  const [days, setDays] = useState('30');
  const [groupBy, setGroupBy] = useState('room');
  const [metrics, setMetrics] = useState<string[]>(CUSTOM_METRICS.map((m) => m.id));

  const params: Record<string, string> = { days };
  if (type === 'custom') {
    params.groupBy = groupBy;
    params.metrics = metrics.join(',');
  }

  const { data, loading } = useApi<{ report: Report }>(`/reports/${type}`, params, { live: false });

  const exportUrl = (format: string) => api.fileUrl(`/reports/${type}/export`, { ...params, format });

  return (
    <>
      <PageHead
        title="דוחות"
        subtitle="סיכומים מוכנים ובונה דוחות מותאם — לייצוא ל-CSV, JSON או הדפסה"
        actions={
          <Segmented
            value={days}
            onChange={setDays}
            options={[
              { id: '1', label: 'יום' },
              { id: '7', label: 'שבוע' },
              { id: '30', label: 'חודש' },
              { id: '90', label: 'רבעון' },
            ]}
          />
        }
      />

      <div className="grid side">
        <div className="col" style={{ gap: 14 }}>
          {loading && !data ? (
            <Loading rows={8} />
          ) : !data ? (
            <Empty icon="📄" title="לא הצלחתי לייצר את הדוח" />
          ) : (
            <>
              <Card
                title={data.report.title}
                subtitle={`${dateOnly(data.report.period.from)} — ${dateOnly(data.report.period.to)}`}
                actions={
                  <>
                    <a className="btn sm" href={exportUrl('csv')} download>
                      CSV
                    </a>
                    <a className="btn sm" href={exportUrl('json')} download>
                      JSON
                    </a>
                    <a className="btn sm primary" href={exportUrl('html')} target="_blank" rel="noreferrer">
                      תצוגה להדפסה / PDF
                    </a>
                  </>
                }
              >
                <div className="grid cols-4">
                  {data.report.cards.map((card) => (
                    <Stat key={card.label} label={card.label} value={card.value} small />
                  ))}
                </div>
              </Card>

              {data.report.tables.map((table) => (
                <Card key={table.title} title={table.title} tight>
                  {!table.rows.length ? (
                    <Empty icon="—" title="אין נתונים בתקופה" />
                  ) : (
                    <div className="table-wrap" style={{ maxHeight: 420, overflowY: 'auto' }}>
                      <table className="table">
                        <thead>
                          <tr>
                            {table.columns.map((column) => (
                              <th key={column}>{column}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {table.rows.map((row, i) => (
                            <tr key={i}>
                              {row.map((cell, j) => (
                                <td key={j} className={typeof cell === 'number' ? 'num' : ''}>
                                  {cell}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </Card>
              ))}
            </>
          )}
        </div>

        <div className="col" style={{ gap: 14 }}>
          <Card title="סוג הדוח" tight>
            {Object.entries(dict?.reportTypes ?? {}).map(([id, meta]) => (
              <button
                key={id}
                className="feed__item"
                style={{
                  width: '100%',
                  border: 'none',
                  cursor: 'pointer',
                  textAlign: 'start',
                  background: type === id ? 'var(--navy-50)' : 'none',
                }}
                onClick={() => setType(id)}
              >
                <span className="feed__body">
                  <span className="bold small">{meta.label}</span>
                  <span className="tiny muted" style={{ display: 'block' }}>
                    {meta.description}
                  </span>
                </span>
              </button>
            ))}
          </Card>

          {type === 'custom' && (
            <Card title="בניית הדוח">
              <div className="bold small mb">מדדים</div>
              {CUSTOM_METRICS.map((metric) => (
                <label className="check" key={metric.id}>
                  <input
                    type="checkbox"
                    checked={metrics.includes(metric.id)}
                    onChange={(e) =>
                      setMetrics((prev) =>
                        e.target.checked ? [...prev, metric.id] : prev.filter((m) => m !== metric.id)
                      )
                    }
                  />
                  <span>{metric.label}</span>
                </label>
              ))}
              <div className="divider" />
              <div className="bold small mb">קיבוץ לפי</div>
              <Segmented
                value={groupBy}
                onChange={setGroupBy}
                options={[
                  { id: 'room', label: 'חדר' },
                  { id: 'user', label: 'משתמש' },
                  { id: 'day', label: 'יום' },
                  { id: 'category', label: 'סוג פעולה' },
                ]}
              />
            </Card>
          )}

          <Card title="דוחות מתוזמנים">
            <p className="small muted" style={{ marginTop: 0 }}>
              תזמון דוח קבוע מתבצע דרך מנגנון ההודעות: יוצרים הודעה חוזרת עם קישור לדוח. מנגנון תזמון נפרד היה
              מחייב את הקונסולה לרוץ 24/7 — והיא רצה על המחשב שלי, שנסגר בלילה.
            </p>
          </Card>
        </div>
      </div>
    </>
  );
}
