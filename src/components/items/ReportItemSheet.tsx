import { useEffect, useMemo, useState } from 'react';
import { Sheet } from '../ui/Sheet';
import { Button } from '../ui/Button';
import { Input, Textarea } from '../ui/Input';
import { Badge } from '../ui/Badge';
import { AddProductForm } from '../catalog/AddProductForm';
import { reportItem } from '../../services/itemService';
import { useAuth } from '../../store/AuthContext';
import { useRoom } from '../../store/RoomContext';
import { useToast } from '../../store/ToastContext';
import { useItems } from '../../hooks/useRoomData';
import { useCatalog, type RoomProduct } from '../../hooks/useCatalog';
import { formatILS } from '../../lib/format';
import {
  ALL_CATEGORIES,
  CATEGORY_EMOJI,
  CATEGORY_LABELS,
  ITEM_STATUS_LABELS,
  PRIORITY_LABELS,
  type Category,
  type Priority,
} from '../../types/models';

const PRIORITY_TONES: Record<Priority, string> = {
  high: 'border-rose-400 bg-rose-50 text-rose-800 ring-rose-400/30',
  normal: 'border-brand-500 bg-brand-50 text-brand-900 ring-brand-500/30',
  low: 'border-ink-400 bg-ink-100 text-ink-700 ring-ink-400/30',
};

export function ReportItemSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user, profile } = useAuth();
  const { roomCode, metadata, memberName } = useRoom();
  const { items } = useItems('open');
  const { search, stapleProducts } = useCatalog();
  const toast = useToast();

  const [name, setName] = useState('');
  const [category, setCategory] = useState<Category>('kitchen');
  const [priority, setPriority] = useState<Priority>('normal');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);

  /** המוצר מהקטלוג שנבחר. null = טקסט חופשי. */
  const [picked, setPicked] = useState<RoomProduct | null>(null);
  const [addingProduct, setAddingProduct] = useState(false);

  const categories = useMemo(() => {
    const active = ALL_CATEGORIES.filter((c) => metadata?.categories?.[c]);
    return active.length > 0 ? active : ALL_CATEGORIES;
  }, [metadata]);

  /** מוצרים שכבר דווחו — לא מציעים אותם שוב */
  const reportedIds = useMemo(
    () => new Set(items.map((i) => i.productId).filter(Boolean) as string[]),
    [items]
  );

  /**
   * הצעות מהקטלוג.
   *
   * כשהשדה ריק מציגים את מוצרי הבסיס של החדר — זה מה שנגמר בפועל
   * ברוב המקרים, ולחיצה אחת חוסכת הקלדה שלמה. כשמקלידים, מחפשים
   * בכל הקטלוג.
   */
  const suggestions = useMemo(() => {
    const q = name.trim();
    const pool = q.length === 0 ? stapleProducts : search(q, undefined, 24);
    return pool.filter((p) => !reportedIds.has(p.id)).slice(0, q.length === 0 ? 8 : 12);
  }, [name, search, stapleProducts, reportedIds]);

  /** התאמה מדויקת — כדי לא להציע מוצר שכבר נבחר */
  const exactPick = picked && picked.name === name.trim();

  // אזהרת כפילות על טקסט חופשי
  const duplicate = useMemo(() => {
    const q = name.trim().toLowerCase();
    if (q.length < 2) return null;
    return items.find((i) => i.nameLower === q) ?? null;
  }, [name, items]);

  useEffect(() => {
    if (!open) return;
    setName('');
    setPicked(null);
    setAddingProduct(false);
    setCategory(categories[0] ?? 'kitchen');
    setPriority('normal');
    setNotes('');
  }, [open, categories]);

  function choose(p: RoomProduct) {
    setPicked(p);
    setName(p.name);
    setCategory(p.category);
  }

  async function submit() {
    if (!user || !profile || !roomCode) return;
    setBusy(true);
    const res = await toast.run(() =>
      reportItem(roomCode, user.uid, profile.displayName, {
        name,
        category,
        priority,
        notes,
        // הקישור לקטלוג הוא מה שמאפשר אחר כך למלא מחיר אוטומטית
        productId: exactPick ? picked.id : null,
      })
    );
    setBusy(false);
    if (res !== null) {
      toast.success(`${name.trim()} נוסף לרשימה`);
      onClose();
    }
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="דיווח על מוצר חסר"
      footer={
        <Button
          size="lg"
          fullWidth
          loading={busy}
          disabled={name.trim().length === 0}
          onClick={submit}
        >
          הוסף לרשימה
        </Button>
      }
    >
      <div className="space-y-5 pb-2">
        <div>
          <Input
            label="מה חסר?"
            placeholder="הקלידו או בחרו מהרשימה"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setPicked(null);
            }}
            maxLength={60}
            autoFocus
            required
          />

          {/* ── הוספת מוצר חדש לקטלוג ── */}
          {addingProduct ? (
            <div className="mt-2">
              <AddProductForm
                initialName={name.trim()}
                onCancel={() => setAddingProduct(false)}
                onAdded={({ id, name: addedName, category: cat, priceShekels }) => {
                  setName(addedName);
                  setCategory(cat);
                  setAddingProduct(false);
                  // מקשר את הדיווח למוצר החדש, בדיוק כמו בחירה מהקטלוג
                  setPicked({
                    id,
                    name: addedName,
                    category: cat,
                    price: Math.round(priceShekels * 100),
                  } as RoomProduct);
                }}
              />
            </div>
          ) : (
            <>
              {/* ── הצעות מהקטלוג ── */}
              {!exactPick && suggestions.length > 0 && (
                <div className="mt-2">
                  <p className="mb-1.5 px-1 text-xs font-medium text-ink-500">
                    {name.trim().length === 0 ? '🧺 מוצרי הבסיס של החדר' : 'מהקטלוג'}
                  </p>
                  <ul className="divide-y divide-ink-100 overflow-hidden rounded-xl border border-ink-200 bg-white">
                    {suggestions.map((p) => (
                      <li key={p.id}>
                        <button
                          type="button"
                          onClick={() => choose(p)}
                          className="flex w-full items-center gap-2.5 px-3 py-2.5 text-start
                                     transition hover:bg-brand-50/60"
                        >
                          <span aria-hidden className="shrink-0 text-base">
                            {CATEGORY_EMOJI[p.category]}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium text-ink-900">
                              {p.name}
                            </span>
                            {p.unit && <span className="text-xs text-ink-400">{p.unit}</span>}
                          </span>
                          <span className="num shrink-0 text-sm text-ink-500">
                            {formatILS(p.price)}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* ── קישור להוספה לקטלוג — רק כשיש שם שלא נבחר מדויק מהקטלוג ── */}
              {!exactPick && name.trim().length >= 2 && (
                <button
                  type="button"
                  onClick={() => setAddingProduct(true)}
                  className="mt-2 w-full rounded-xl px-3 py-2 text-center text-xs font-semibold
                             text-brand-700 transition hover:bg-brand-50"
                >
                  ➕ הוספת "{name.trim()}" כמוצר קבוע בקטלוג
                </button>
              )}
            </>
          )}

          {/* ── נבחר מהקטלוג ── */}
          {exactPick && (
            <div className="mt-2 flex items-center gap-2 rounded-xl bg-brand-50 px-3 py-2.5
                            text-sm text-brand-900">
              <span aria-hidden>{CATEGORY_EMOJI[picked.category]}</span>
              <span className="flex-1">
                מהקטלוג · מחיר משוער{' '}
                <span className="num font-semibold">{formatILS(picked.price)}</span>
              </span>
              <button
                type="button"
                onClick={() => setPicked(null)}
                className="text-xs font-semibold text-brand-700 underline"
              >
                נקה
              </button>
            </div>
          )}
        </div>

        {duplicate && (
          <div role="alert" className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
            ⚠️ <b>{duplicate.name}</b> כבר ברשימה — דיווח {memberName(duplicate.reportedBy)},
            סטטוס: {ITEM_STATUS_LABELS[duplicate.status]}.
            <span className="mt-0.5 block text-xs opacity-80">
              אפשר להוסיף בכל זאת אם זה מוצר אחר.
            </span>
          </div>
        )}

        <fieldset>
          <legend className="mb-2 flex items-center gap-2 text-sm font-medium text-ink-700">
            קטגוריה
            {exactPick && <Badge tone="brand">נקבעה מהקטלוג</Badge>}
          </legend>
          <div className="grid grid-cols-2 gap-2">
            {categories.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCategory(c)}
                aria-pressed={category === c}
                className={[
                  'tap flex items-center gap-2 rounded-xl border px-3 text-sm font-medium',
                  'transition active:scale-[.98]',
                  category === c
                    ? 'border-brand-500 bg-brand-50 text-brand-900 ring-1 ring-brand-500/30'
                    : 'border-ink-200 bg-white text-ink-600',
                ].join(' ')}
              >
                <span aria-hidden>{CATEGORY_EMOJI[c]}</span>
                {CATEGORY_LABELS[c]}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className="mb-2 block text-sm font-medium text-ink-700">עדיפות</legend>
          <div className="grid grid-cols-3 gap-2">
            {(['high', 'normal', 'low'] as Priority[]).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPriority(p)}
                aria-pressed={priority === p}
                className={[
                  'tap rounded-xl border px-2 text-sm font-semibold transition active:scale-[.98]',
                  priority === p
                    ? `${PRIORITY_TONES[p]} ring-1`
                    : 'border-ink-200 bg-white text-ink-500',
                ].join(' ')}
              >
                {PRIORITY_LABELS[p]}
              </button>
            ))}
          </div>
        </fieldset>

        <Textarea
          label="הערה (אופציונלי)"
          placeholder="לדוגמה: צריך עד יום חמישי"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          maxLength={500}
        />
      </div>
    </Sheet>
  );
}
