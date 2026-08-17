import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AppShell } from '../components/layout/AppShell';
import { TopBar } from '../components/layout/TopBar';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { EmptyState, ErrorState } from '../components/ui/EmptyState';
import { ListSkeleton } from '../components/ui/Skeleton';
import { ReportItemSheet } from '../components/items/ReportItemSheet';
import { MarkBoughtSheet } from '../components/items/MarkBoughtSheet';
import { useItems } from '../hooks/useRoomData';
import { useRoom } from '../store/RoomContext';
import { useAuth } from '../store/AuthContext';
import { useConnection } from '../store/ConnectionContext';
import { useToast } from '../store/ToastContext';
import { claimItem, deleteItem, unclaimItem } from '../services/itemService';
import { formatRelativeTime, formatTime } from '../lib/format';
import {
  CATEGORY_EMOJI,
  CATEGORY_LABELS,
  PRIORITY_LABELS,
  type Item,
  type ItemStatus,
  type WithId,
} from '../types/models';

type Filter = 'open' | 'needed' | 'buying' | 'done';

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'open', label: 'פעילים' },
  { key: 'needed', label: 'חסרים' },
  { key: 'buying', label: 'בקנייה' },
  { key: 'done', label: 'הושלמו' },
];

export default function ItemsPage() {
  const [params, setParams] = useSearchParams();
  const [filter, setFilter] = useState<Filter>('open');
  const [reportOpen, setReportOpen] = useState(false);
  const [buyingItem, setBuyingItem] = useState<WithId<Item> | null>(null);

  const { items, loading, error, fromCache, cachedAt } = useItems(filter as ItemStatus | 'open');
  const { isOnline } = useConnection();

  // הכפתור המרכזי בניווט מנווט לכאן עם ?new=1
  useEffect(() => {
    if (params.get('new') === '1') {
      setReportOpen(true);
      setParams({}, { replace: true });
    }
  }, [params, setParams]);

  return (
    <AppShell>
      <TopBar
        title="מוצרים חסרים"
        subtitle={items.length > 0 ? `${items.length} פריטים` : undefined}
        actions={
          <Button
            size="sm"
            onClick={() => setReportOpen(true)}
            disabled={!isOnline}
            title={isOnline ? undefined : 'פעולה זו דורשת חיבור לאינטרנט'}
          >
            + דיווח
          </Button>
        }
      />

      {/* פילטרים */}
      <div className="scroll-area -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 pt-4">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            aria-pressed={filter === f.key}
            className={[
              'shrink-0 rounded-full px-3.5 py-1.5 text-sm font-semibold transition',
              filter === f.key
                ? 'bg-brand-700 text-white shadow-sm'
                : 'bg-white text-ink-600 ring-1 ring-ink-200',
            ].join(' ')}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="pt-3">
        {fromCache && !isOnline && cachedAt && (
          <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
            מציג נתונים מ־{formatTime(cachedAt)}. ייתכן שהשתנו מאז.
          </p>
        )}

        {loading ? (
          <ListSkeleton rows={4} />
        ) : error && !fromCache ? (
          <ErrorState message={error.message} onRetry={() => location.reload()} />
        ) : items.length === 0 ? (
          <EmptyState
            icon={filter === 'done' ? '📦' : '🎉'}
            title={filter === 'done' ? 'אין קניות שהושלמו' : 'אין מוצרים חסרים'}
            body={
              filter === 'done'
                ? 'קניות שיאושרו יופיעו כאן.'
                : 'הכל מלא. כשמשהו נגמר — דווחו עליו כאן.'
            }
            action={
              filter !== 'done' && (
                <Button onClick={() => setReportOpen(true)} disabled={!isOnline}>
                  דיווח על מוצר חסר
                </Button>
              )
            }
          />
        ) : (
          <ul className="space-y-2.5">
            {items.map((item) => (
              <li key={item.id}>
                <ItemCard item={item} onBuy={() => setBuyingItem(item)} />
              </li>
            ))}
          </ul>
        )}
      </div>

      <ReportItemSheet open={reportOpen} onClose={() => setReportOpen(false)} />
      <MarkBoughtSheet
        open={!!buyingItem}
        onClose={() => setBuyingItem(null)}
        item={buyingItem}
      />
    </AppShell>
  );
}

function ItemCard({ item, onBuy }: { item: WithId<Item>; onBuy: () => void }) {
  const { user } = useAuth();
  const { roomCode, isAdmin, memberName } = useRoom();
  const { isOnline } = useConnection();
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  const mine = item.assignedTo === user?.uid;
  const guard = {
    disabled: !isOnline || busy,
    title: isOnline ? undefined : 'פעולה זו דורשת חיבור לאינטרנט',
  };

  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    await toast.run(fn);
    setBusy(false);
  }

  return (
    <article className="card p-4">
      <div className="flex items-start gap-3">
        <span aria-hidden className="mt-0.5 text-2xl">
          {CATEGORY_EMOJI[item.category]}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <h3 className="truncate font-bold text-ink-900">{item.name}</h3>
            {item.priority === 'high' && <Badge tone="danger">{PRIORITY_LABELS.high}</Badge>}
            {item.status === 'buying' && (
              <Badge tone="info">{mine ? 'אתה קונה' : `${memberName(item.assignedTo ?? '')} קונה`}</Badge>
            )}
            {item.status === 'bought' && <Badge tone="warning">ממתין לאישור</Badge>}
            {item.status === 'done' && <Badge tone="success">הושלם</Badge>}
          </div>

          <p className="mt-0.5 text-xs text-ink-500">
            {CATEGORY_LABELS[item.category]} · דיווח {memberName(item.reportedBy)} ·{' '}
            {item.reportedAt ? formatRelativeTime(item.reportedAt) : ''}
          </p>

          {item.notes && (
            <p className="mt-2 rounded-lg bg-ink-50 px-2.5 py-1.5 text-xs leading-relaxed text-ink-600">
              {item.notes}
            </p>
          )}
        </div>
      </div>

      {/* פעולות */}
      {item.status !== 'done' && item.status !== 'bought' && (
        <div className="mt-3 flex gap-2">
          {item.status === 'needed' && (
            <Button size="sm" {...guard} onClick={() => run(() => claimItem(roomCode!, item.id, user!.uid))}>
              אני קונה את זה
            </Button>
          )}

          {item.status === 'buying' && mine && (
            <>
              <Button size="sm" {...guard} onClick={onBuy}>
                קניתי — הזן סכום
              </Button>
              <Button
                size="sm"
                variant="ghost"
                {...guard}
                onClick={() => run(() => unclaimItem(roomCode!, item.id))}
              >
                ביטול
              </Button>
            </>
          )}

          {isAdmin && (
            <Button
              size="sm"
              variant="ghost"
              className="ms-auto text-rose-600"
              {...guard}
              onClick={() => {
                if (confirm(`למחוק את "${item.name}"?`)) {
                  void run(() => deleteItem(roomCode!, item.id));
                }
              }}
            >
              מחק
            </Button>
          )}
        </div>
      )}
    </article>
  );
}
