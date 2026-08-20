import { useEffect, useMemo, useState } from 'react';
import { GlassModal } from '../ui/GlassModal';
import { Button } from '../ui/Button';
import { Textarea } from '../ui/Input';
import { Badge } from '../ui/Badge';
import { CheckIcon } from '../ui/icons';
import { AddProductForm } from '../catalog/AddProductForm';
import { reportItem } from '../../services/itemService';
import { useAuth } from '../../store/AuthContext';
import { useRoom } from '../../store/RoomContext';
import { useToast } from '../../store/ToastContext';
import { useItems } from '../../hooks/useRoomData';
import { useCatalog, type RoomProduct } from '../../hooks/useCatalog';
import { formatILS } from '../../lib/format';
import { CATEGORY_EMOJI, PRIORITY_LABELS, type Priority } from '../../types/models';

const PRIORITY_TONES: Record<Priority, string> = {
  high: 'border-rose-400 bg-rose-50 text-rose-800 ring-rose-400/30',
  normal: 'border-brand-500 bg-brand-50 text-brand-900 ring-brand-500/30',
  low: 'border-ink-400 bg-ink-100 text-ink-700 ring-ink-400/30',
};

type Step = 'pick' | 'details' | 'sending';

/**
 * דיווח על מוצר חסר — מודאל זכוכית מרכזי בשני צעדים.
 *
 * צעד 1: בחירת מוצר. צעד 2: עדיפות + הערה. הבחירה עצמה מקדמת אוטומטית
 * לצעד הבא — אין כפתור "המשך" מיותר בין השניים.
 */
export function ReportItemSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user, profile } = useAuth();
  const { roomCode, memberName } = useRoom();
  const { items } = useItems('open');
  const { search, stapleProducts } = useCatalog();
  const toast = useToast();

  const [step, setStep] = useState<Step>('pick');
  const [query, setQuery] = useState('');
  const [addingProduct, setAddingProduct] = useState(false);
  const [freeName, setFreeName] = useState<string | null>(null);

  /** המוצר מהקטלוג שנבחר, אם נבחר */
  const [picked, setPicked] = useState<RoomProduct | null>(null);
  const [priority, setPriority] = useState<Priority>('normal');
  const [notes, setNotes] = useState('');

  const name = picked?.name ?? freeName ?? '';

  /** מוצרים שכבר דווחו — לא מציעים אותם שוב */
  const reportedIds = useMemo(
    () => new Set(items.map((i) => i.productId).filter(Boolean) as string[]),
    [items]
  );

  const results = useMemo(() => {
    const pool = query.trim().length === 0 ? stapleProducts : search(query, undefined, 30);
    return pool.filter((p) => !reportedIds.has(p.id));
  }, [query, search, stapleProducts, reportedIds]);

  const exactFreeMatch = useMemo(
    () => results.some((p) => p.name === query.trim()),
    [results, query]
  );

  const duplicate = useMemo(() => {
    const q = name.trim().toLowerCase();
    if (q.length < 2) return null;
    return items.find((i) => i.nameLower === q) ?? null;
  }, [name, items]);

  useEffect(() => {
    if (!open) return;
    setStep('pick');
    setQuery('');
    setAddingProduct(false);
    setFreeName(null);
    setPicked(null);
    setPriority('normal');
    setNotes('');
  }, [open]);

  function choose(p: RoomProduct) {
    setPicked(p);
    setFreeName(null);
    setStep('details');
  }

  function chooseFreeText() {
    const trimmed = query.trim();
    if (trimmed.length === 0) return;
    setPicked(null);
    setFreeName(trimmed);
    setStep('details');
  }

  async function submit() {
    if (!user || !profile || !roomCode) return;
    setStep('sending');
    const res = await reportItem(roomCode, user.uid, profile.displayName, {
      name,
      category: picked?.category ?? 'other',
      priority,
      notes,
      productId: picked?.id ?? null,
    }).catch((err) => {
      toast.error(err instanceof Error ? err.message : 'הדיווח נכשל');
      return null;
    });

    if (res === null) {
      setStep('details');
      return;
    }

    // רגע קטן לתחושת "נשלח" לפני שסוגרים — לא מספיק זמן כדי להרגיש איטי
    window.setTimeout(() => {
      onClose();
    }, 750);
  }

  return (
    <GlassModal open={open} onClose={onClose} labelledBy="report-item-title">
      {step === 'sending' ? (
        <div className="flex flex-col items-center justify-center gap-3 px-8 py-16 text-center">
          <div className="grid h-16 w-16 animate-check-pop place-items-center rounded-full bg-emerald-100 text-emerald-600">
            <CheckIcon width={32} height={32} />
          </div>
          <p className="font-bold text-ink-900">{name} נוסף לרשימה</p>
        </div>
      ) : step === 'pick' ? (
        <div className="p-5 pt-4">
          <h2 id="report-item-title" className="pe-12 text-lg font-bold text-ink-900">
            מה חסר בבית?
          </h2>

          <div className="sticky top-0 z-10 -mx-1 mt-3 bg-white/0 px-1 pb-1">
            <input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setAddingProduct(false);
              }}
              placeholder="חיפוש מוצר…"
              type="search"
              enterKeyHint="search"
              autoFocus
              className="w-full rounded-2xl border border-ink-200 bg-white/80 px-4 py-3.5
                         text-[16px] shadow-sm backdrop-blur placeholder:text-ink-500
                         transition focus:border-brand-400 focus:outline-none
                         focus:ring-2 focus:ring-brand-500/25"
            />
          </div>

          {duplicate && (
            <div role="alert" className="mt-3 rounded-xl bg-amber-50 p-3 text-xs text-amber-900">
              ⚠️ <b>{duplicate.name}</b> כבר ברשימה — דיווח {memberName(duplicate.reportedBy)}.
            </div>
          )}

          {addingProduct ? (
            <div className="mt-3">
              <AddProductForm
                initialName={query.trim()}
                onCancel={() => setAddingProduct(false)}
                onAdded={({ id, name: addedName, category, priceShekels }) => {
                  setAddingProduct(false);
                  choose({
                    id,
                    name: addedName,
                    category,
                    price: Math.round(priceShekels * 100),
                  } as RoomProduct);
                }}
              />
            </div>
          ) : (
            <>
              <p className="mb-2 mt-4 px-0.5 text-xs font-medium text-ink-500">
                {query.trim().length === 0 ? '🧺 מוצרי הבסיס של החדר' : `תוצאות עבור "${query.trim()}"`}
              </p>

              <div className="grid grid-cols-2 gap-2.5">
                {results.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => choose(p)}
                    className="flex flex-col items-start gap-1 rounded-2xl border border-ink-100
                               bg-white/70 p-3.5 text-start shadow-sm backdrop-blur transition
                               duration-150 hover:-translate-y-0.5 hover:border-brand-300
                               hover:shadow-card active:scale-[.96] active:duration-75"
                  >
                    <span aria-hidden className="text-2xl">
                      {CATEGORY_EMOJI[p.category]}
                    </span>
                    <span className="line-clamp-2 text-sm font-semibold leading-tight text-ink-900">
                      {p.name}
                    </span>
                    <span className="num text-xs text-ink-500">{formatILS(p.price)}</span>
                  </button>
                ))}
              </div>

              {results.length === 0 && query.trim().length === 0 && (
                <p className="py-8 text-center text-sm text-ink-500">
                  אין עדיין מוצרי בסיס בחדר
                </p>
              )}

              {query.trim().length >= 2 && (
                <div className="mt-3 space-y-2">
                  {!exactFreeMatch && (
                    <button
                      type="button"
                      onClick={chooseFreeText}
                      className="w-full rounded-2xl border border-dashed border-ink-300 bg-white/50
                                 px-4 py-3 text-sm font-medium text-ink-700 backdrop-blur
                                 transition hover:border-brand-400 hover:bg-brand-50/50"
                    >
                      המשך עם "{query.trim()}"
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setAddingProduct(true)}
                    className="w-full rounded-2xl px-4 py-2.5 text-center text-xs font-semibold
                               text-brand-700 transition hover:bg-brand-50/60"
                  >
                    ➕ הוספת "{query.trim()}" כמוצר קבוע בקטלוג
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      ) : (
        <div className="p-5 pt-4">
          <button
            type="button"
            onClick={() => setStep('pick')}
            className="mb-3 flex items-center gap-2 rounded-2xl bg-ink-50/80 px-3.5 py-2.5
                       text-start backdrop-blur transition hover:bg-ink-100/80"
          >
            <span aria-hidden className="text-xl">
              {picked ? CATEGORY_EMOJI[picked.category] : '📦'}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-bold text-ink-900">{name}</span>
              <span className="text-xs text-ink-500">לחיצה לשינוי</span>
            </span>
          </button>

          <fieldset>
            <legend className="mb-2 flex items-center gap-2 text-sm font-medium text-ink-700">
              דחיפות
              {picked && <Badge tone="brand">מהקטלוג</Badge>}
            </legend>
            <div className="grid grid-cols-3 gap-2">
              {(['high', 'normal', 'low'] as Priority[]).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPriority(p)}
                  aria-pressed={priority === p}
                  className={[
                    'tap rounded-2xl border px-2 text-sm font-semibold transition active:scale-[.97]',
                    priority === p ? `${PRIORITY_TONES[p]} ring-1` : 'border-ink-200 bg-white/70 text-ink-500',
                  ].join(' ')}
                >
                  {PRIORITY_LABELS[p]}
                </button>
              ))}
            </div>
          </fieldset>

          <div className="mt-4">
            <Textarea
              label="הערה (אופציונלי)"
              placeholder="לדוגמה: צריך עד יום חמישי"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={500}
            />
          </div>

          <Button size="lg" fullWidth className="mt-5" onClick={submit}>
            דיווח
          </Button>
        </div>
      )}
    </GlassModal>
  );
}
