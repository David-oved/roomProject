import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useApi } from '../../hooks/useApi';
import { Badge, Card, Empty, Loading, PageHead, Score, SearchInput, Segmented, Stat } from '../ui/primitives';
import { pluralDays, relativeTime, shekels } from '../../lib/format';
import type { RoomHealth } from '../../lib/types';

/**
 * ═══════════════════════════════════════════════════════════════
 *  לוח בריאות חדרים
 * ═══════════════════════════════════════════════════════════════
 *  ממוין מהגרוע לטוב — בכוונה. הרשימה נועדה לענות על שאלה אחת:
 *  "במה עליי לטפל עכשיו", ולא "מה שלום כל החדרים".
 * ═══════════════════════════════════════════════════════════════
 */
export function RoomHealthDash() {
  const [level, setLevel] = useState('all');
  const [search, setSearch] = useState('');
  const { data, loading } = useApi<{ rooms: RoomHealth[] }>('/rooms', {
    level,
    search: search || undefined,
  });

  const rooms = data?.rooms ?? [];
  const counts = {
    all: rooms.length,
    healthy: rooms.filter((r) => r.level === 'healthy').length,
    risk: rooms.filter((r) => r.level === 'risk').length,
    critical: rooms.filter((r) => r.level === 'critical').length,
  };

  return (
    <>
      <PageHead
        title="בריאות חדרים"
        subtitle="ציון נגזר מבעיות שאפשר לפעול עליהן — לא מדד מופשט"
        actions={
          <>
            <SearchInput value={search} onChange={setSearch} placeholder="שם או קוד חדר…" />
            <Segmented
              value={level}
              onChange={setLevel}
              options={[
                { id: 'all', label: 'הכל' },
                { id: 'critical', label: 'קריטי' },
                { id: 'risk', label: 'בסיכון' },
                { id: 'healthy', label: 'תקין' },
              ]}
            />
          </>
        }
      />

      <div className="grid cols-4 mb">
        <Stat label="חדרים" value={counts.all} hint="בסך הכול במערכת" />
        <Stat label="תקינים" value={counts.healthy} tone="success" hint="ציון 80 ומעלה" />
        <Stat label="בסיכון" value={counts.risk} tone="warn" hint="ציון 50–79" />
        <Stat label="קריטיים" value={counts.critical} tone="danger" hint="ציון מתחת ל-50" />
      </div>

      {loading && !data ? (
        <Loading rows={6} />
      ) : !rooms.length ? (
        <Empty icon="🏠" title="אין חדרים תואמים" />
      ) : (
        <div className="col" style={{ gap: 12 }}>
          {rooms.map((room) => (
            <RoomHealthCard key={room.code} room={room} />
          ))}
        </div>
      )}
    </>
  );
}

function RoomHealthCard({ room }: { room: RoomHealth }) {
  return (
    <Card>
      <div className="row" style={{ alignItems: 'flex-start', gap: 14 }}>
        <Score score={room.score} level={room.level} />

        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="row wrap" style={{ gap: 8 }}>
            <Link to={`/rooms/${room.code}`} className="bold" style={{ fontSize: 15 }}>
              {room.name}
            </Link>
            <span className="mono tiny muted">{room.code}</span>
            {room.level === 'critical' && <Badge tone="danger">קריטי</Badge>}
            {room.level === 'risk' && <Badge tone="warn">דורש תשומת לב</Badge>}
            {room.level === 'healthy' && <Badge tone="success">תקין</Badge>}
            <span className="tiny muted">
              מנהל: <Link to={`/users/${room.adminId}`}>{room.adminName}</Link>
            </span>
          </div>

          <div className="row wrap small muted mt" style={{ gap: 14 }}>
            <span>
              👥 {room.membersActive}/{room.membersTotal} פעילים
              {room.membersInactive > 0 && <span className="neg"> · {room.membersInactive} לא נכנסו חודש</span>}
            </span>
            <span>📦 {room.openItems} פתוחים{room.oldestOpenItemDays ? ` (ותיק: ${pluralDays(room.oldestOpenItemDays)})` : ''}</span>
            <span>🧾 {room.pendingPurchases} ממתינות לאישור</span>
            <span>💰 פער {shekels(room.spread)}</span>
            <span>🕐 {relativeTime(room.lastActivityAt)}</span>
          </div>

          {room.issues.length > 0 && (
            <ul className="col mt" style={{ gap: 4, margin: 0, paddingInlineStart: 0, listStyle: 'none' }}>
              {room.issues.map((issue) => (
                <li key={issue.code} className="small">
                  <Badge tone={issue.severity === 'critical' ? 'danger' : 'warn'}>
                    {issue.severity === 'critical' ? 'קריטי' : 'אזהרה'}
                  </Badge>{' '}
                  <span className="bold">{issue.title}</span>
                  {issue.detail && <span className="muted"> — {issue.detail}</span>}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="col" style={{ gap: 6 }}>
          <Link className="btn sm" to={`/rooms/${room.code}`}>
            פתיחת החדר
          </Link>
          {room.level !== 'healthy' && (
            <Link className="btn sm primary" to={`/rooms/${room.code}?intervene=1`}>
              התערבות
            </Link>
          )}
        </div>
      </div>
    </Card>
  );
}
