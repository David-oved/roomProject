import { useMemo, useState } from 'react';
import { Sheet } from '../ui/Sheet';
import { BasketIcon, PlusIcon } from '../ui/icons';
import { useCatalog, type RoomProduct } from '../../hooks/useCatalog';
import { useItems } from '../../hooks/useRoomData';
import { useAuth } from '../../store/AuthContext';
import { useRoom } from '../../store/RoomContext';
import { useToast } from '../../store/ToastContext';
import { addTripLine } from '../../services/tripService';
import { CATEGORY_ICON } from '../../lib/categoryIcons';
import type { Item, TripLine, WithId } from '../../types/models';

/**
 * הוספה לרשימת הקנייה הגדולה — משתי מקורות: מוצרים חסרים בחדר (שורה
 * מקושרת ל-item קיים, מה שמאפשר את התיאום החכם בסיום הקנייה) או
 * חיפוש בקטלוג / טקסט חופשי (שורה בלי item, פשוט משהו שרוצים לקנות).
 */
export function AddTripLineSheet({
  open,
  onClose,
  tripId,
  existingLines,
}: {
  open: boolean;
  onClose: () => void;
  tripId: string;
  existingLines: WithId<TripLine>[];
}) {
  const { user } = useAuth();
  const { roomCode } = useRoom();
  const { items: neededItems } = useItems('needed');
  const { search, stapleProducts } = useCatalog();
  const toast = useToast();
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);

  const linkedItemIds = useMemo(
    () => new Set(existingLines.map((l) => l.itemId).filter(Boolean) as string[]),
    [existingLines]
  );
  const linkedProductIds = useMemo(
    () => new Set(existingLines.map((l) => l.productId).filter(Boolean) as string[]),
    [existingLines]
  );

  const availableNeeded = useMemo(
    () => neededItems.filter((i) => !linkedItemIds.has(i.id)),
    [neededItems, linkedItemIds]
  );

  const results = useMemo(() => {
    const pool = query.trim().length === 0 ? stapleProducts : search(query, undefined, 30);
    return pool.filter((p) => !linkedProductIds.has(p.id));
  }, [query, search, stapleProducts, linkedProductIds]);

  async function addFromItem(item: WithId<Item>) {
    if (!roomCode || !user) return;
    setBusy(true);
    await toast.run(() =>
      addTripLine(roomCode, tripId, user.uid, {
        name: item.name,
        category: item.category,
        itemId: item.id,
        productId: item.productId ?? null,
      })
    );
    setBusy(false);
  }

  async function addFromProduct(p: RoomProduct) {
    if (!roomCode || !user) return;
    setBusy(true);
    await toast.run(() =>
      addTripLine(roomCode, tripId, user.uid, { name: p.name, category: p.category, productId: p.id })
    );
    setBusy(false);
  }

  async function addFreeText() {
    const name = query.trim();
    if (!roomCode || !user || name.length === 0) return;
    setBusy(true);
    await toast.run(() => addTripLine(roomCode, tripId, user.uid, { name, category: 'other' }));
    setQuery('');
    setBusy(false);
  }

  return (
    <Sheet open={open} onClose={onClose} title="הוספה לרשימה">
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="חיפוש מוצר…"
        type="search"
        enterKeyHint="search"
        autoFocus
        disabled={busy}
        className="w-full rounded-2xl border border-ink-200 bg-surface px-4 py-3.5 text-[16px]
                   shadow-sm placeholder:text-ink-500 transition focus:border-brand-400
                   focus:outline-none focus:ring-2 focus:ring-brand-500/25 disabled:opacity-60"
      />

      {availableNeeded.length > 0 && (
        <div className="mt-4">
          <p className="mb-2 px-0.5 text-xs font-medium text-ink-500">מוצרים חסרים בחדר</p>
          <ul className="space-y-1.5">
            {availableNeeded.map((item) => {
              const Icon = CATEGORY_ICON[item.category];
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => addFromItem(item)}
                    className="flex w-full items-center gap-2.5 rounded-xl border border-ink-100
                               bg-surface px-3 py-2.5 text-start transition hover:border-brand-300
                               hover:bg-brand-50/40 disabled:opacity-60"
                  >
                    <Icon width={16} height={16} className="shrink-0 text-ink-500" />
                    <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink-900">
                      {item.name}
                    </span>
                    <PlusIcon width={14} height={14} className="shrink-0 text-brand-700" />
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <div className="mt-4">
        <p className="mb-2 flex items-center gap-1.5 px-0.5 text-xs font-medium text-ink-500">
          <BasketIcon width={13} height={13} className="shrink-0" />
          {query.trim().length === 0 ? 'מוצרי הבסיס של החדר' : `תוצאות עבור "${query.trim()}"`}
        </p>
        <div className="grid grid-cols-2 gap-2">
          {results.map((p) => {
            const Icon = CATEGORY_ICON[p.category];
            return (
              <button
                key={p.id}
                type="button"
                disabled={busy}
                onClick={() => addFromProduct(p)}
                className="flex flex-col items-start gap-1 rounded-2xl border border-ink-100 bg-surface
                           p-3 text-start shadow-sm transition hover:border-brand-300 hover:shadow-card
                           disabled:opacity-60"
              >
                <Icon width={18} height={18} className="text-ink-500" />
                <span className="line-clamp-2 text-sm font-semibold leading-tight text-ink-900">
                  {p.name}
                </span>
              </button>
            );
          })}
        </div>

        {results.length === 0 && (
          <p className="py-6 text-center text-sm text-ink-500">אין תוצאות</p>
        )}

        {query.trim().length >= 2 && (
          <button
            type="button"
            disabled={busy}
            onClick={addFreeText}
            className="mt-3 w-full rounded-2xl border border-dashed border-ink-300 bg-surface
                       px-4 py-3 text-sm font-medium text-ink-700 transition
                       hover:border-brand-400 hover:bg-brand-50/50 disabled:opacity-60"
          >
            הוספת "{query.trim()}" כמו שהוא
          </button>
        )}
      </div>
    </Sheet>
  );
}
