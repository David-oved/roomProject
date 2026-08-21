import { useState } from 'react';
import { Link } from 'react-router-dom';
import { clock, dayLabel, shekels } from '../../lib/format';
import { useDict } from '../../lib/store';
import { Empty, Segmented } from '../ui/primitives';
import type { DayGroup } from '../../lib/types';

/** ציר זמן של משתמש — כל פעולה שלו, מקובצת לפי יום. */
export function UserTimeline({ groups }: { groups: DayGroup[] }) {
  const dict = useDict();
  const [category, setCategory] = useState('all');

  const filtered = groups
    .map((group) => ({
      ...group,
      events: group.events.filter((e) => category === 'all' || e.category === category),
    }))
    .filter((group) => group.events.length > 0);

  const categories = [
    { id: 'all', label: 'הכל' },
    ...Object.entries(dict?.eventCategories ?? {}).map(([id, c]) => ({ id, label: c.label })),
  ];

  if (!groups.length) return <Empty icon="🕐" title="אין פעילות מתועדת" />;

  return (
    <>
      <div className="mb" style={{ overflowX: 'auto' }}>
        <Segmented options={categories} value={category} onChange={setCategory} />
      </div>

      {!filtered.length ? (
        <Empty icon="🔍" title="אין פעילות בקטגוריה הזו" />
      ) : (
        <div className="timeline">
          {filtered.map((group) => (
            <div className="timeline__day" key={group.date}>
              <div className="timeline__date">
                📅 {dayLabel(group.date)}
                <span className="count">{group.events.length} פעולות</span>
              </div>
              <div className="timeline__list">
                {group.events.map((event) => (
                  <div className="timeline__row" key={event.id}>
                    <span className="t">{clock(event.ts)}</span>
                    <span>
                      {event.text}
                      {event.amount ? <span className="badge info"> {shekels(event.amount)}</span> : null}
                      {event.roomCode && (
                        <>
                          {' · '}
                          <Link to={`/rooms/${event.roomCode}`}>{event.roomName}</Link>
                        </>
                      )}
                      {event.status === 'pending' && <span className="badge warn"> ממתין</span>}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
