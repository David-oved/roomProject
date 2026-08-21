import { Link } from 'react-router-dom';
import { dateOnly, signedShekels } from '../../lib/format';
import { Badge, Empty } from '../ui/primitives';
import type { Membership } from '../../lib/types';

/**
 * "איפה המשתמש נמצא" — כל החדרים שלו, התפקיד והסטטוס בכל אחד.
 * זו השאלה הראשונה שנשאלת על משתמש, ולכן היא מקבלת רכיב משלה.
 */
export function UserLocationMap({ memberships }: { memberships: Membership[] }) {
  if (!memberships.length) {
    return (
      <Empty icon="🚪" title="לא נמצא באף חדר">
        משתמש שנרשם ולא הצטרף לחדר — נקודת נטישה קלאסית.
      </Empty>
    );
  }

  const statusBadge = (status: string) => {
    if (status === 'pending') return <Badge tone="warn">ממתין לאישור</Badge>;
    if (status === 'removed') return <Badge tone="neutral">הוסר</Badge>;
    return <Badge tone="success">פעיל</Badge>;
  };

  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            <th>חדר</th>
            <th>תפקיד</th>
            <th>סטטוס</th>
            <th>הצטרף</th>
            <th>מאזן</th>
            <th>נשא בעלות</th>
          </tr>
        </thead>
        <tbody>
          {memberships.map((m) => (
            <tr key={`${m.roomCode}-${m.status}`}>
              <td>
                <Link to={`/rooms/${m.roomCode}`}>{m.roomName}</Link>{' '}
                <span className="tiny muted mono">{m.roomCode}</span>
              </td>
              <td>{m.role === 'admin' ? <Badge tone="info">מנהל חדר</Badge> : <span className="muted">חבר</span>}</td>
              <td>{statusBadge(m.status)}</td>
              <td className="tiny muted">{dateOnly(m.joinedAt)}</td>
              <td className={`num ${m.balance >= 0 ? 'pos' : 'neg'}`}>{signedShekels(m.balance)}</td>
              <td className="num muted">{signedShekels(m.borne).replace('+', '')}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
