import { Link } from 'react-router-dom';
import { useDict } from '../../lib/store';
import { Badge, Card, Empty } from '../ui/primitives';
import type { Analytics } from '../../lib/types';

/**
 * פלחי משתמשים.
 *
 * ‼️ הפלחים אינם בלעדיים זה לזה: משתמש יכול להיות גם "כבד" וגם
 *    "מנהל חדר" וגם "קונה מוביל". חלוקה בלעדית הייתה מחייבת אותי
 *    לבחור איזו תכונה "חשובה יותר" — ואין תשובה נכונה לזה.
 */
export function UserSegmentation({ analytics }: { analytics: Analytics }) {
  const dict = useDict();

  const segments = Object.entries(dict?.segments ?? {})
    .map(([id, meta]) => ({
      id,
      meta,
      uids: analytics.bySegment[id] ?? [],
    }))
    .filter((s) => s.uids.length > 0)
    .sort((a, b) => b.uids.length - a.uids.length);

  const byUid = new Map(analytics.profileSummaries.map((p) => [p.uid, p]));

  if (!segments.length) return <Empty icon="👥" title="אין מספיק נתונים לפילוח" />;

  return (
    <div className="grid cols-2">
      {segments.map((segment) => {
        const members = segment.uids.map((uid) => byUid.get(uid)).filter(Boolean);
        const avgActions = members.length
          ? Math.round((members.reduce((a, p) => a + (p?.actionsPerWeek ?? 0), 0) / members.length) * 10) / 10
          : 0;

        return (
          <Card
            key={segment.id}
            title={
              <span className="row" style={{ gap: 8 }}>
                <Badge tone={(segment.meta.tone as never) ?? 'neutral'}>{segment.meta.label}</Badge>
                <span className="muted small">
                  {segment.uids.length} משתמשים ({Math.round((segment.uids.length / analytics.totals.users) * 100)}%)
                </span>
              </span>
            }
            subtitle={segment.meta.hint}
            actions={
              <Link className="btn sm" to={`/messages?tab=compose`}>
                שליחת הודעה לפלח
              </Link>
            }
          >
            <div className="small muted mb">ממוצע {avgActions} פעולות בשבוע</div>
            <div className="row wrap" style={{ gap: 4 }}>
              {members.slice(0, 12).map((p) => (
                <Link key={p!.uid} to={`/users/${p!.uid}`} className="badge neutral">
                  {p!.displayName}
                </Link>
              ))}
              {members.length > 12 && <span className="badge outline">ועוד {members.length - 12}</span>}
            </div>

            {segment.id === 'freeloader' && (
              <div className="tiny muted mt">
                תווית רגישה: היא נקבעת לפי יחס דיווח:קנייה בלבד, ולא יודעת מי שילם במזומן בסופר. שווה לבדוק לפני
                שפונים.
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}
