import { Link } from 'react-router-dom';
import { relativeTime } from '../../lib/format';
import { useDict } from '../../lib/store';
import { Badge } from '../ui/primitives';
import type { FeedbackItem } from '../../lib/types';

/** רשימת משוב קומפקטית — משמשת גם בתיבה, גם במסך חדר וגם במסך משתמש. */
export function FeedbackList({ items }: { items: FeedbackItem[] }) {
  const dict = useDict();

  return (
    <div className="feed">
      {items.map((item) => {
        const type = dict?.feedbackTypes?.[item.type];
        const priority = dict?.priorities?.[item.priority];
        const status = dict?.feedbackStatuses?.[item.status];

        return (
          <Link
            to={`/feedback/${item.id}`}
            key={item.id}
            className="feed__item"
            style={{ color: 'inherit', textDecoration: 'none' }}
          >
            <span className="feed__icon">{type?.icon ?? '📝'}</span>
            <span className="feed__body">
              <span className="feed__line">
                <span className="bold">{item.subject}</span>
                {item.status === 'new' && <Badge tone="info">חדש</Badge>}
                <Badge tone={(priority?.tone as never) ?? 'neutral'}>{priority?.label}</Badge>
                {status && item.status !== 'new' && <Badge tone={(status.tone as never) ?? 'neutral'}>{status.label}</Badge>}
                {item.duplicates.length > 0 && <Badge tone="warn">כפילות אפשרית</Badge>}
              </span>
              <span className="small muted truncate" style={{ display: 'block', maxWidth: 700 }}>
                {item.body}
              </span>
              <span className="feed__meta">
                <span>{type?.label}</span>
                <span>{item.userName}</span>
                {item.roomName && <span>🏠 {item.roomName}</span>}
                <span>{relativeTime(item.createdAt)}</span>
                {item.responses.length > 0 && <span>✉️ נענה</span>}
              </span>
            </span>
          </Link>
        );
      })}
    </div>
  );
}
