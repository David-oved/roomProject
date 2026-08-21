import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useApi } from '../../hooks/useApi';
import { useDict, useStore } from '../../lib/store';
import { Avatar, Badge, Card, Empty, Loading, PageHead, SearchInput } from '../ui/primitives';
import { duration, relativeTime, shekels, signedShekels } from '../../lib/format';
import type { UserProfile } from '../../lib/types';

/** רשימת כל המשתמשים, עם סינון לפי פלח וחיפוש חופשי. */
export function UsersList() {
  const dict = useDict();
  const { boot } = useStore();
  const [search, setSearch] = useState('');
  const [segment, setSegment] = useState('all');
  const [room, setRoom] = useState('');
  const [sort, setSort] = useState('activity');

  const { data, loading } = useApi<{ total: number; users: UserProfile[]; segments: Record<string, string[]> }>(
    '/users',
    { search: search || undefined, segment, room: room || undefined, sort }
  );

  return (
    <>
      <PageHead
        title="משתמשים"
        subtitle={data ? `${data.total} משתמשים תואמים` : 'טוען…'}
        actions={
          <>
            <SearchInput value={search} onChange={setSearch} placeholder="שם, אימייל או מזהה…" />
            <select className="select" value={room} onChange={(e) => setRoom(e.target.value)} style={{ width: 170 }}>
              <option value="">כל החדרים</option>
              {boot?.rooms.map((r) => (
                <option key={r.code} value={r.code}>
                  {r.name}
                </option>
              ))}
            </select>
            <select className="select" value={sort} onChange={(e) => setSort(e.target.value)} style={{ width: 150 }}>
              <option value="activity">לפי פעילות</option>
              <option value="recent">לפי כניסה אחרונה</option>
              <option value="spend">לפי הוצאה</option>
              <option value="name">לפי שם</option>
            </select>
          </>
        }
      />

      <div className="row wrap mb" style={{ gap: 6 }}>
        <button className={`btn sm ${segment === 'all' ? 'primary' : ''}`} onClick={() => setSegment('all')}>
          כולם
        </button>
        {Object.entries(dict?.segments ?? {}).map(([id, s]) => (
          <button
            key={id}
            className={`btn sm ${segment === id ? 'primary' : ''}`}
            title={s.hint}
            onClick={() => setSegment(id)}
          >
            {s.label}
            {data?.segments?.[id]?.length ? ` (${data.segments[id].length})` : ''}
          </button>
        ))}
      </div>

      <Card tight>
        {loading && !data ? (
          <Loading rows={8} />
        ) : !data?.users.length ? (
          <Empty icon="🔍" title="אין משתמשים תואמים" />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>משתמש</th>
                  <th>חדרים</th>
                  <th>פעולות (30 יום)</th>
                  <th>ימים פעילים</th>
                  <th>סשן ממוצע</th>
                  <th>הוצאה</th>
                  <th>מאזן</th>
                  <th>כניסה אחרונה</th>
                  <th>פלחים</th>
                </tr>
              </thead>
              <tbody>
                {data.users.map((user) => (
                  <tr key={user.uid}>
                    <td>
                      <span className="row" style={{ gap: 8 }}>
                        <Avatar name={user.displayName} size="sm" />
                        <span>
                          <Link to={`/users/${user.uid}`} className="bold">
                            {user.displayName}
                          </Link>
                          <div className="tiny muted">{user.email}</div>
                        </span>
                      </span>
                    </td>
                    <td className="num">{user.roomsCount}</td>
                    <td className="num">{user.window.actions}</td>
                    <td className="num">
                      {user.window.activeDays}
                      <span className="muted tiny"> ({user.window.activeDayRatio}%)</span>
                    </td>
                    <td className="tiny">{duration(user.window.avgSessionMs)}</td>
                    <td className="num">{shekels(user.stats.totalSpent)}</td>
                    <td className={`num ${user.stats.netBalance >= 0 ? 'pos' : 'neg'}`}>
                      {signedShekels(user.stats.netBalance)}
                    </td>
                    <td className="tiny muted nowrap">{relativeTime(user.lastActiveAt)}</td>
                    <td>
                      <span className="row wrap" style={{ gap: 3 }}>
                        {user.segments
                          .filter((s) => ['power', 'freeloader', 'power_buyer', 'dormant', 'at_risk', 'inactive'].includes(s))
                          .map((s) => (
                            <Badge key={s} tone={(dict?.segments?.[s]?.tone as never) ?? 'neutral'}>
                              {dict?.segments?.[s]?.label ?? s}
                            </Badge>
                          ))}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
