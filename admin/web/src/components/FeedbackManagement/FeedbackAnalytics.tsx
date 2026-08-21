import { Card } from '../ui/primitives';
import { Bars, HBar } from '../ui/charts';
import { duration } from '../../lib/format';
import { useDict } from '../../lib/store';
import type { FeedbackCounts } from '../../lib/types';

/** מגמות המשוב — מה מגיע, מאיפה, ובאיזה כיוון זה זז. */
export function FeedbackAnalytics({
  analytics,
  counts,
}: {
  analytics: {
    byType: Record<string, number>;
    byRoom: Array<{ code: string; name: string; count: number }>;
    weekly: Array<{ weekStart: number; count: number }>;
    avgResolutionMs: number;
    sentiment: number;
    responseRate: number;
  };
  counts: FeedbackCounts;
}) {
  const dict = useDict();
  const maxType = Math.max(1, ...Object.values(analytics.byType));
  const maxRoom = Math.max(1, ...analytics.byRoom.map((r) => r.count));

  const sentimentTone =
    analytics.sentiment > 20 ? 'pos' : analytics.sentiment < -20 ? 'neg' : 'muted';

  return (
    <div className="col" style={{ gap: 14 }}>
      <Card title="סנטימנט" subtitle="מחמאות מול תקלות ובעיות">
        {/* ‼️ bdi + dir=ltr — בלעדיהם הסימן של מספר שלילי קופץ לצד השני
            בטקסט עברי, ו-"‎−50" נקרא כ-"50-". */}
        <bdi className={`bold ${sentimentTone}`} dir="ltr" style={{ fontSize: 30, display: 'block' }}>
          {analytics.sentiment > 0 ? '+' : ''}
          {analytics.sentiment}
        </bdi>
        <div className="tiny muted">
          מדד פשוט: (מחמאות − תקלות) חלקי סך שניהם. ‎+100 = רק שבחים, ‎−100 = רק תקלות.
        </div>
        <div className="divider" />
        <div className="row between small">
          <span>זמן טיפול ממוצע</span>
          <span className="bold">{duration(analytics.avgResolutionMs)}</span>
        </div>
        <div className="row between small">
          <span>אחוז מענה</span>
          <span className="bold">{analytics.responseRate}%</span>
        </div>
        <div className="row between small">
          <span>סך המשוב</span>
          <span className="bold">{counts.total}</span>
        </div>
      </Card>

      <Card title="לפי סוג">
        {Object.entries(analytics.byType)
          .sort((a, b) => b[1] - a[1])
          .map(([type, count]) => (
            <HBar
              key={type}
              label={`${dict?.feedbackTypes?.[type]?.icon ?? ''} ${dict?.feedbackTypes?.[type]?.label ?? type}`}
              value={count}
              max={maxType}
            />
          ))}
      </Card>

      <Card title="לפי חדר" subtitle="חדר שמדבר הרבה הוא לא בהכרח חדר בבעיה">
        {analytics.byRoom.slice(0, 8).map((room) => (
          <HBar key={room.code} label={room.name ?? room.code} value={room.count} max={maxRoom} />
        ))}
      </Card>

      <Card title="קצב הגעה" subtitle="8 שבועות אחרונים">
        <Bars
          data={analytics.weekly.map((w) => w.count)}
          labels={analytics.weekly.map((w) => new Date(w.weekStart).toLocaleDateString('he-IL', { day: 'numeric', month: 'numeric' }))}
          height={80}
        />
      </Card>
    </div>
  );
}
