import { useState } from 'react';
import { Link } from 'react-router-dom';
import { clock, relativeTime, shekels } from '../../lib/format';
import { useDict } from '../../lib/store';
import type { ActivityEvent } from '../../lib/types';

/**
 * שורת אירוע — הרכיב שמופיע בכל מקום שבו מוצגת פעילות.
 *
 * ‼️ תוכן רגיש (הודעת צ׳אט) מטושטש עד לחיצה. הפעולה הזו מכוונת:
 *    "לראות שמשהו נכתב" ו"לקרוא מה נכתב" הן שתי החלטות שונות, וכלי
 *    ניהול שמערבב ביניהן הופך קריאת שיחות פרטיות לדבר שקורה בהיסח דעת.
 */
export function EventRow({
  event,
  showRoom = true,
  compact,
  actions,
}: {
  event: ActivityEvent;
  showRoom?: boolean;
  compact?: boolean;
  actions?: React.ReactNode;
}) {
  const dict = useDict();
  const [revealed, setRevealed] = useState(false);
  const icon = dict?.eventCategories?.[event.category]?.icon ?? '•';

  return (
    <div className={`feed__item severity-${event.severity}`}>
      {!compact && <span className="feed__icon">{icon}</span>}
      <div className="feed__body">
        <div className="feed__line">
          {event.actorId && (
            <Link to={`/users/${event.actorId}`} className="feed__actor">
              {event.actorName}
            </Link>
          )}
          <span>{event.text}</span>
          {event.amount ? <span className="badge info">{shekels(event.amount)}</span> : null}
          {event.status === 'pending' && <span className="badge warn">ממתין</span>}
        </div>

        {event.sensitive && (
          <div
            className={`small mt${revealed ? '' : ''}`}
            style={{ marginTop: 4 }}
            onClick={() => setRevealed((v) => !v)}
            title={revealed ? 'הסתרה' : 'לחיצה כדי לחשוף תוכן פרטי'}
          >
            <span className={`sensitive${revealed ? ' revealed' : ''}`}>„{event.sensitive}”</span>
          </div>
        )}

        <div className="feed__meta">
          {showRoom && event.roomCode && (
            <Link to={`/rooms/${event.roomCode}`}>
              🏠 {event.roomName} ({event.roomCode})
            </Link>
          )}
          {event.detail && <span>{event.detail}</span>}
          <span title={new Date(event.ts).toLocaleString('he-IL')}>{relativeTime(event.ts)}</span>
        </div>

        {actions && <div className="feed__actions">{actions}</div>}
      </div>
      <span className="feed__time">{clock(event.ts)}</span>
    </div>
  );
}
