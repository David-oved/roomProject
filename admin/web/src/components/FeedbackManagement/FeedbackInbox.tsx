import { useState } from 'react';
import { useApi } from '../../hooks/useApi';
import { useDict, useStore } from '../../lib/store';
import { Card, Empty, Loading, PageHead, SearchInput, Stat, Tabs } from '../ui/primitives';
import { FeedbackList } from './FeedbackList';
import { FeedbackAnalytics } from './FeedbackAnalytics';
import type { FeedbackCounts, FeedbackItem } from '../../lib/types';

interface FeedbackResponse {
  items: FeedbackItem[];
  counts: FeedbackCounts;
  analytics: {
    byType: Record<string, number>;
    byRoom: Array<{ code: string; name: string; count: number }>;
    weekly: Array<{ weekStart: number; count: number }>;
    avgResolutionMs: number;
    sentiment: number;
    responseRate: number;
  };
}

/**
 * ═══════════════════════════════════════════════════════════════
 *  תיבת המשוב
 * ═══════════════════════════════════════════════════════════════
 *  משוב מהחדרים הוא ערוץ הקשר היחיד מהמשתמשים אליי. התיבה בנויה
 *  כמו תיבת דואר ולא כמו טבלה — כי מה שחשוב הוא מה עוד לא נענה.
 * ═══════════════════════════════════════════════════════════════
 */
export function FeedbackInbox() {
  const dict = useDict();
  const { boot } = useStore();
  const [status, setStatus] = useState('open');
  const [type, setType] = useState('all');
  const [room, setRoom] = useState('');
  const [sort, setSort] = useState('newest');
  const [search, setSearch] = useState('');

  const { data, loading } = useApi<FeedbackResponse>('/feedback', {
    status,
    type,
    room: room || undefined,
    sort,
    search: search || undefined,
  });

  const counts = data?.counts;

  return (
    <>
      <PageHead
        title="תיבת משוב"
        subtitle="כל מה שהמשתמשים כתבו לי — תקלות, בקשות, שאלות ומחמאות"
        actions={<SearchInput value={search} onChange={setSearch} placeholder="חיפוש בנושא ובתוכן…" />}
      />

      <div className="grid cols-4 mb">
        <Stat label="חדשים" value={counts?.new ?? 0} tone={counts?.new ? 'warn' : undefined} hint="עוד לא נפתחו" />
        <Stat label="פתוחים" value={counts?.open ?? 0} hint="בטיפול או ממתינים" />
        <Stat label="טופלו" value={counts?.resolved ?? 0} tone="success" hint="נסגרו" />
        <Stat
          label="אחוז מענה"
          value={`${data?.analytics.responseRate ?? 0}%`}
          hint="מהמשוב שקיבל תשובה"
        />
      </div>

      <div className="grid side">
        <Card
          tight
          title="הודעות"
          actions={
            <>
              <select className="select" value={room} onChange={(e) => setRoom(e.target.value)} style={{ width: 170 }}>
                <option value="">כל החדרים</option>
                {boot?.rooms.map((r) => (
                  <option key={r.code} value={r.code}>
                    {r.name}
                  </option>
                ))}
              </select>
              <select className="select" value={sort} onChange={(e) => setSort(e.target.value)} style={{ width: 130 }}>
                <option value="newest">החדש ביותר</option>
                <option value="oldest">הישן ביותר</option>
                <option value="priority">לפי עדיפות</option>
                <option value="room">לפי חדר</option>
              </select>
            </>
          }
        >
          <div style={{ padding: '8px 14px 0' }}>
            <Tabs
              active={status}
              onChange={setStatus}
              tabs={[
                { id: 'open', label: 'פתוחים', count: counts?.open },
                { id: 'new', label: 'חדשים', count: counts?.new },
                { id: 'resolved', label: 'טופלו', count: counts?.resolved },
                { id: 'archived', label: 'ארכיון', count: counts?.archived },
                { id: 'all', label: 'הכל', count: counts?.total },
              ]}
            />
            <div className="row wrap mb" style={{ gap: 6 }}>
              <button className={`btn sm ${type === 'all' ? 'primary' : ''}`} onClick={() => setType('all')}>
                כל הסוגים
              </button>
              {Object.entries(dict?.feedbackTypes ?? {}).map(([id, t]) => (
                <button key={id} className={`btn sm ${type === id ? 'primary' : ''}`} onClick={() => setType(id)}>
                  {t.icon} {t.label}
                  {counts?.byType?.[id] ? ` (${counts.byType[id]})` : ''}
                </button>
              ))}
            </div>
          </div>

          {loading && !data ? (
            <Loading rows={6} />
          ) : !data?.items.length ? (
            <Empty icon="📭" title="אין משוב תואם">
              כשמשתמש ישלח משוב מהאפליקציה, הוא יופיע כאן.
            </Empty>
          ) : (
            <FeedbackList items={data.items} />
          )}
        </Card>

        {data && <FeedbackAnalytics analytics={data.analytics} counts={data.counts} />}
      </div>
    </>
  );
}
