import { useState } from 'react';
import { dayLabel } from '../../lib/format';
import { useDict } from '../../lib/store';
import { Empty, Segmented } from '../ui/primitives';
import { EventRow } from './EventRow';
import type { DayGroup } from '../../lib/types';

/** יומן החדר — כל מה שקרה בו, מקובץ לפי יום ומסונן לפי סוג. */
export function RoomActivityLog({ log }: { log: DayGroup[] }) {
  const dict = useDict();
  const [category, setCategory] = useState('all');

  const filtered = log
    .map((group) => ({
      ...group,
      events: group.events.filter((e) => category === 'all' || e.category === category),
    }))
    .filter((group) => group.events.length > 0);

  const categories = [
    { id: 'all', label: 'הכל' },
    ...Object.entries(dict?.eventCategories ?? {}).map(([id, c]) => ({ id, label: c.label })),
  ];

  return (
    <>
      <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', overflowX: 'auto' }}>
        <Segmented options={categories} value={category} onChange={setCategory} />
      </div>

      {!filtered.length ? (
        <Empty icon="🗒️" title="אין רשומות ביומן" />
      ) : (
        <div>
          {filtered.map((group) => (
            <div key={group.date}>
              <div
                style={{
                  padding: '7px 14px',
                  background: 'var(--gray-50)',
                  borderBottom: '1px solid var(--border)',
                  fontSize: 12,
                  fontWeight: 700,
                }}
              >
                📅 {dayLabel(group.date)}
                <span className="muted" style={{ fontWeight: 400 }}> · {group.events.length} אירועים</span>
              </div>
              <div className="feed">
                {group.events.map((event) => (
                  <EventRow key={event.id} event={event} showRoom={false} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
