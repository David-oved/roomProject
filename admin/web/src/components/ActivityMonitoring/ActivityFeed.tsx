import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useApi } from '../../hooks/useApi';
import { useStore, useDict } from '../../lib/store';
import { Card, Empty, Loading, PageHead, SearchInput, Segmented } from '../ui/primitives';
import { EventRow } from './EventRow';
import type { ActivityEvent } from '../../lib/types';

interface FeedResponse {
  version: number;
  total: number;
  events: ActivityEvent[];
  hasMore: boolean;
}

/**
 * ═══════════════════════════════════════════════════════════════
 *  פיד פעילות חי
 * ═══════════════════════════════════════════════════════════════
 *  זרם אחד של כל מה שקורה במערכת, עם סינון וחיפוש.
 *
 *  ‼️ "השהיה" היא לא נוחות אלא הכרח: בלעדיה, אירוע חדש קופץ בדיוק
 *     כשמנסים ללחוץ על "אישור" באירוע קודם — והלחיצה נוחתת על הפריט
 *     הלא נכון. בהשהיה, אירועים חדשים נספרים ומחכים.
 * ═══════════════════════════════════════════════════════════════
 */
export function ActivityFeed() {
  const dict = useDict();
  const { boot, version } = useStore();
  const [category, setCategory] = useState('all');
  const [room, setRoom] = useState('');
  const [search, setSearch] = useState('');
  const [limit, setLimit] = useState(60);
  const [paused, setPaused] = useState(false);

  const { data, loading } = useApi<FeedResponse>(
    '/activity',
    { category, room: room || undefined, search: search || undefined, limit },
    { live: !paused }
  );

  /* ספירת אירועים שהצטברו בזמן ההשהיה */
  const [heldSince, setHeldSince] = useState<number | null>(null);
  const versionAtPause = useRef(version);
  useEffect(() => {
    if (paused) {
      versionAtPause.current = version;
      setHeldSince(Date.now());
    } else {
      setHeldSince(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paused]);

  const categories = [
    { id: 'all', label: 'הכל' },
    ...Object.entries(dict?.eventCategories ?? {}).map(([id, c]) => ({
      id,
      label: `${c.icon ?? ''} ${c.label}`.trim(),
    })),
  ];

  return (
    <>
      <PageHead
        title="פיד פעילות"
        subtitle={
          data
            ? `${data.total.toLocaleString('he-IL')} אירועים תואמים · מוצגים ${data.events.length}`
            : 'טוען…'
        }
        actions={
          <>
            <button
              className={`btn ${paused ? 'primary' : ''}`}
              onClick={() => setPaused((p) => !p)}
              title="עצירת גלילה אוטומטית כדי לפעול על אירוע בלי שהוא יזוז"
            >
              {paused ? '▶︎ המשך' : '⏸ השהה'}
            </button>
          </>
        }
      />

      {paused && heldSince && version !== versionAtPause.current && (
        <div className="card mb" style={{ borderColor: 'var(--warning)' }}>
          <div className="card__body row between">
            <span>הפיד מושהה — יש אירועים חדשים שממתינים.</span>
            <button className="btn sm primary" onClick={() => setPaused(false)}>
              הצג עכשיו
            </button>
          </div>
        </div>
      )}

      <Card
        tight
        title="זרם אירועים"
        actions={
          <>
            <SearchInput value={search} onChange={setSearch} placeholder="חיפוש בטקסט האירוע…" />
            <select className="select" value={room} onChange={(e) => setRoom(e.target.value)} style={{ width: 190 }}>
              <option value="">כל החדרים</option>
              {boot?.rooms.map((r) => (
                <option key={r.code} value={r.code}>
                  {r.name} ({r.code})
                </option>
              ))}
            </select>
          </>
        }
      >
        <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', overflowX: 'auto' }}>
          <Segmented options={categories} value={category} onChange={setCategory} />
        </div>

        {loading && !data ? (
          <Loading rows={8} />
        ) : !data?.events.length ? (
          <Empty icon="🔍" title="אין אירועים תואמים">
            נסו לשנות את הסינון או את מונח החיפוש.
          </Empty>
        ) : (
          <>
            <div className="feed">
              {data.events.map((event) => (
                <EventRow key={event.id} event={event} actions={<QuickActions event={event} />} />
              ))}
            </div>
            {data.hasMore && (
              <div style={{ padding: 12, textAlign: 'center' }}>
                <button className="btn" onClick={() => setLimit((l) => l + 60)}>
                  טען עוד 60
                </button>
              </div>
            )}
          </>
        )}
      </Card>
    </>
  );
}

/** קיצורי דרך מתוך הפיד — מסננים לפי סוג האירוע. */
function QuickActions({ event }: { event: ActivityEvent }) {
  if (event.category === 'feedback') {
    return (
      <Link className="btn sm" to={`/feedback/${event.entityId}`}>
        פתיחת המשוב
      </Link>
    );
  }
  if (event.status === 'pending' && event.roomCode) {
    return (
      <Link className="btn sm primary" to={`/rooms/${event.roomCode}`}>
        טיפול בחדר
      </Link>
    );
  }
  return null;
}
