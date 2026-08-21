import { useState } from 'react';
import { useApi } from '../../hooks/useApi';
import { Card, Loading, PageHead, Segmented, Stat, Tabs } from '../ui/primitives';
import { Bars, HBar, HourHistogram, WeekdayBars } from '../ui/charts';
import { UserSegmentation } from './UserSegmentation';
import { WEEKDAYS, duration } from '../../lib/format';
import type { Analytics } from '../../lib/types';

type TabId = 'engagement' | 'segments' | 'features';

/**
 * ═══════════════════════════════════════════════════════════════
 *  תובנות משתמשים
 * ═══════════════════════════════════════════════════════════════
 *  ‼️ כל מספר כאן נגזר מהנתונים שכבר קיימים — אין SDK אנליטיקה ואין
 *     מעקב בדפדפן של המשתמשים. המחיר: "אורך סשן" הוא הערכה מאשכולות
 *     פעולות, והוא מסומן ככזה בכל מקום שבו הוא מוצג.
 * ═══════════════════════════════════════════════════════════════
 */
export function UserAnalyticsDash() {
  const [days, setDays] = useState('30');
  const [tab, setTab] = useState<TabId>('engagement');
  const { data, loading } = useApi<{ analytics: Analytics }>('/insights', { days });

  if (loading && !data) return <Loading rows={8} />;
  if (!data) return null;

  const a = data.analytics;
  const t = a.totals;
  const maxFeature = Math.max(1, ...a.featureUsage.map((f) => f.users));

  return (
    <>
      <PageHead
        title="תובנות משתמשים"
        subtitle="מי משתמש, כמה, מתי — ומי כבר לא"
        actions={
          <Segmented
            value={days}
            onChange={setDays}
            options={[
              { id: '7', label: '7 ימים' },
              { id: '30', label: '30 יום' },
              { id: '90', label: '90 יום' },
            ]}
          />
        }
      />

      <div className="grid cols-6 mb">
        <Stat label="משתמשים" value={t.users} hint={`${t.rooms} חדרים`} />
        <Stat
          label="פעילים"
          value={`${t.activeNow}`}
          tone="success"
          hint={`${t.activePercent}% נכנסו השבוע`}
        />
        <Stat label="נרשמו בתקופה" value={t.newUsers} delta={t.newUsersDelta} hint="לעומת התקופה הקודמת" />
        <Stat
          label="נטישה"
          value={`${t.churned}`}
          tone={t.churnPercent > 20 ? 'danger' : 'warn'}
          hint={`${t.churnPercent}% לא נכנסו חודש`}
        />
        <Stat label="סשן ממוצע" value={duration(t.avgSessionMs)} small hint="הערכה מאשכולות פעולות" />
        <Stat label="חדרים למשתמש" value={t.avgRoomsPerUser} hint={`${t.sessionsPerUserPerWeek} סשנים בשבוע`} />
      </div>

      <Tabs
        active={tab}
        onChange={setTab}
        tabs={[
          { id: 'engagement', label: 'מעורבות' },
          { id: 'segments', label: 'פלחים' },
          { id: 'features', label: 'פיצ׳רים' },
        ]}
      />

      {tab === 'engagement' && (
        <div className="col" style={{ gap: 14 }}>
          <Card title="פעילות יומית" subtitle={`פעולות בכל יום ב-${a.windowDays} הימים האחרונים`}>
            <Bars
              data={a.daily.map((d) => d.actions)}
              labels={a.daily.map((d) => new Date(d.date).toLocaleDateString('he-IL', { day: 'numeric', month: 'numeric' }))}
              height={140}
            />
          </Card>

          <div className="grid cols-2">
            <Card title="שעות פעילות" subtitle="מתי כדאי לשלוח הודעות ומתי לא">
              <HourHistogram hours={a.hours} peak={a.peakHour} />
              <div className="small muted mt">
                שיא: {a.peakHour}:00 · היום החזק: {WEEKDAYS[a.peakWeekday]}
              </div>
            </Card>
            <Card title="ימי פעילות">
              <WeekdayBars weekdays={a.weekdays} />
            </Card>
          </div>

          <Card title="המשתמשים הפעילים ביותר" tight>
            <table className="table">
              <thead>
                <tr>
                  <th>משתמש</th>
                  <th>פעולות</th>
                  <th>בשבוע</th>
                  <th>ימים פעילים</th>
                  <th>חדרים</th>
                  <th>דיווח / קנייה</th>
                </tr>
              </thead>
              <tbody>
                {a.profileSummaries
                  .slice()
                  .sort((x, y) => y.actions - x.actions)
                  .slice(0, 10)
                  .map((p) => (
                    <tr key={p.uid}>
                      <td>{p.displayName}</td>
                      <td className="num">{p.actions}</td>
                      <td className="num">{p.actionsPerWeek}</td>
                      <td className="num">{p.activeDays}</td>
                      <td className="num">{p.roomsCount}</td>
                      <td className="num">
                        {p.reported} / {p.bought}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </Card>
        </div>
      )}

      {tab === 'segments' && <UserSegmentation analytics={a} />}

      {tab === 'features' && (
        <Card title="שימוש בפיצ׳רים" subtitle="אחוז המשתמשים שביצעו את הפעולה לפחות פעם אחת בתקופה">
          {a.featureUsage.map((f) => (
            <HBar
              key={f.feature}
              label={f.feature}
              value={f.users}
              max={maxFeature}
              display={`${f.users} (${f.percent}%)`}
            />
          ))}
          <div className="tiny muted mt">
            פיצ׳ר שאף אחד לא משתמש בו לא בהכרח מיותר — לפעמים הוא פשוט מוסתר טוב מדי בממשק.
          </div>
        </Card>
      )}
    </>
  );
}
