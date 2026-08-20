import { useMemo, useState } from 'react';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { EmptyState } from '../ui/EmptyState';
import { CheckIcon, CloseIcon, SettingsIcon } from '../ui/icons';
import { StaplesPicker } from './StaplesPicker';
import { useCatalog, type RoomProduct } from '../../hooks/useCatalog';
import { useItems } from '../../hooks/useRoomData';
import { useRoom } from '../../store/RoomContext';
import { useAuth } from '../../store/AuthContext';
import { useConnection } from '../../store/ConnectionContext';
import { useToast } from '../../store/ToastContext';
import { clearRoomPrice, setRoomPrice, toggleStaple } from '../../services/catalogService';
import { reportItem } from '../../services/itemService';
import { formatILS } from '../../lib/format';
import { CATEGORY_EMOJI, CATEGORY_LABELS, type Category } from '../../types/models';

/**
 * מלאי הבית — מוצרי הבסיס של החדר.
 *
 * הרעיון: במקום להקליד "נגמר החלב" בכל פעם מחדש, המוצרים שתמיד צריכים
 * להיות בבית מוגדרים פעם אחת. אחר כך זו לחיצה אחת.
 *
 * המחיר מוצג ליד כל מוצר וניתן לעריכה במקום — הוא נשמר **רק לחדר הזה**
 * ולא משפיע על אף חדר אחר.
 */
export function StaplesView() {
  const { stapleProducts, syncing } = useCatalog();
  const { items } = useItems('open');
  const { roomCode } = useRoom();
  const { isOnline } = useConnection();
  const [pickerOpen, setPickerOpen] = useState(false);

  /** מוצרים שכבר דווחו כחסרים — כדי לא לדווח פעמיים */
  const reported = useMemo(
    () => new Set(items.map((i) => i.productId).filter(Boolean) as string[]),
    [items]
  );

  const grouped = useMemo(() => {
    const map = new Map<Category, RoomProduct[]>();
    for (const p of stapleProducts) {
      const list = map.get(p.category) ?? [];
      list.push(p);
      map.set(p.category, list);
    }
    return [...map.entries()];
  }, [stapleProducts]);

  const stapleIds = useMemo(() => stapleProducts.map((p) => p.id), [stapleProducts]);

  if (stapleProducts.length === 0) {
    return (
      <>
        <EmptyState
          icon="🧺"
          title={syncing ? 'טוען…' : 'עוד לא הוגדרו מוצרי בסיס'}
          body="בחרו מהקטלוג את המוצרים שתמיד צריכים להיות בבית. אחר כך דיווח על מוצר שנגמר הוא לחיצה אחת."
          action={
            <Button onClick={() => setPickerOpen(true)} disabled={!isOnline}>
              בחירת מוצרי בסיס
            </Button>
          }
        />
        <StaplesEditor
          open={pickerOpen}
          onClose={() => setPickerOpen(false)}
          current={stapleIds}
        />
      </>
    );
  }

  return (
    <>
      <div className="mb-3 flex items-center justify-between px-1">
        <p className="text-xs text-ink-500">
          <span className="num font-semibold text-ink-700">{stapleProducts.length}</span> מוצרי בסיס
          {reported.size > 0 && (
            <>
              {' · '}
              <span className="num font-semibold text-amber-700">{reported.size}</span> חסרים
            </>
          )}
        </p>
        <button
          onClick={() => setPickerOpen(true)}
          disabled={!isOnline}
          className="tap inline-flex items-center gap-1.5 rounded-lg px-2 text-xs
                     font-semibold text-brand-700 transition hover:bg-brand-50
                     disabled:text-ink-300"
        >
          <SettingsIcon width={15} height={15} />
          עריכת הרשימה
        </button>
      </div>

      <div className="space-y-4">
        {grouped.map(([category, list]) => (
          <section key={category}>
            <h3 className="mb-1.5 flex items-center gap-1.5 px-1 text-xs font-bold text-ink-500">
              <span aria-hidden>{CATEGORY_EMOJI[category]}</span>
              {CATEGORY_LABELS[category]}
              <span className="num font-normal text-ink-500">({list.length})</span>
            </h3>

            <ul className="card divide-y divide-ink-100">
              {list.map((p) => (
                <StapleRow key={p.id} product={p} alreadyReported={reported.has(p.id)} />
              ))}
            </ul>
          </section>
        ))}
      </div>

      <StaplesEditor
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        current={stapleIds}
        key={roomCode ?? 'none'}
      />
    </>
  );
}

/* ═══════════════ שורת מוצר ═══════════════ */

function StapleRow({
  product,
  alreadyReported,
}: {
  product: RoomProduct;
  alreadyReported: boolean;
}) {
  const { roomCode } = useRoom();
  const { user, profile } = useAuth();
  const { isOnline } = useConnection();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);

  async function report() {
    if (!roomCode || !user || !profile) return;
    setBusy(true);
    const res = await toast.run(() =>
      reportItem(roomCode, user.uid, profile.displayName, {
        name: product.name,
        category: product.category,
        priority: 'normal',
        productId: product.id,
      })
    );
    setBusy(false);
    if (res !== null) toast.success(`${product.name} נוסף לרשימת החסרים`);
  }

  return (
    <li className="flex items-center gap-3 px-3.5 py-2.5">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-ink-900">{product.name}</p>
        {product.unit && <p className="text-xs text-ink-500">{product.unit}</p>}
      </div>

      {editing ? (
        <PriceEditor product={product} onDone={() => setEditing(false)} />
      ) : (
        <>
          <button
            onClick={() => setEditing(true)}
            disabled={!isOnline}
            aria-label={`שינוי מחיר עבור ${product.name}`}
            className="tap-area num shrink-0 rounded-lg px-2 py-1 text-sm text-ink-600
                       transition hover:bg-ink-100 disabled:hover:bg-transparent"
          >
            {formatILS(product.price)}
            {product.customPrice && (
              <span
                aria-label="מחיר מותאם לחדר"
                title="מחיר שהוגדר בחדר הזה"
                className="ms-1 inline-block h-1.5 w-1.5 rounded-full bg-brand-500 align-middle"
              />
            )}
          </button>

          {alreadyReported ? (
            <Badge tone="warning" className="shrink-0">
              ברשימה
            </Badge>
          ) : (
            <Button
              size="sm"
              variant="secondary"
              className="shrink-0"
              disabled={!isOnline}
              loading={busy}
              onClick={report}
            >
              נגמר
            </Button>
          )}
        </>
      )}
    </li>
  );
}

/* ═══════════════ עריכת מחיר במקום ═══════════════ */

function PriceEditor({ product, onDone }: { product: RoomProduct; onDone: () => void }) {
  const { roomCode } = useRoom();
  const { user } = useAuth();
  const toast = useToast();
  const [value, setValue] = useState((product.price / 100).toFixed(2));
  const [busy, setBusy] = useState(false);

  async function save() {
    if (!roomCode || !user) return;
    const num = Number(value.replace(',', '.'));
    if (!Number.isFinite(num) || num < 0) {
      toast.error('מחיר לא תקין');
      return;
    }
    setBusy(true);
    await toast.run(() => setRoomPrice(roomCode, product.id, num, user.uid));
    setBusy(false);
    onDone();
  }

  async function reset() {
    if (!roomCode) return;
    setBusy(true);
    await toast.run(() => clearRoomPrice(roomCode, product.id));
    setBusy(false);
    onDone();
  }

  return (
    <div className="flex shrink-0 items-center gap-1">
      <input
        type="number"
        step="0.01"
        min="0"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') void save();
          if (e.key === 'Escape') onDone();
        }}
        aria-label={`מחיר עבור ${product.name}`}
        autoFocus
        className="num h-10 w-20 rounded-lg border border-brand-400 px-2 text-center text-sm
                   focus:outline-none focus:ring-2 focus:ring-brand-500/30"
      />
      <button
        onClick={save}
        disabled={busy}
        aria-label="שמירת מחיר"
        className="tap grid place-items-center rounded-lg text-emerald-600 hover:bg-emerald-50"
      >
        <CheckIcon width={18} height={18} />
      </button>
      {product.customPrice ? (
        <button
          onClick={reset}
          disabled={busy}
          aria-label="חזרה למחיר ברירת המחדל"
          title="חזרה למחיר ברירת המחדל"
          className="tap grid place-items-center rounded-lg text-ink-500 hover:bg-ink-100"
        >
          ↺
        </button>
      ) : (
        <button
          onClick={onDone}
          aria-label="ביטול"
          className="tap grid place-items-center rounded-lg text-ink-500 hover:bg-ink-100"
        >
          <CloseIcon width={18} height={18} />
        </button>
      )}
    </div>
  );
}

/* ═══════════════ עריכת הרשימה ═══════════════ */

/**
 * עוטף את הבורר ושומר את ההפרש בלבד.
 * כתיבה של כל הרשימה בכל שמירה הייתה דורסת שינויים של חבר אחר שקרו
 * בינתיים — כאן נכתבים רק המוצרים שבאמת נוספו או הוסרו.
 */
function StaplesEditor({
  open,
  onClose,
  current,
}: {
  open: boolean;
  onClose: () => void;
  current: string[];
}) {
  const { roomCode } = useRoom();
  const toast = useToast();
  const [draft, setDraft] = useState<string[]>(current);

  // מסתנכרן עם המצב בענן בכל פתיחה
  const [lastOpen, setLastOpen] = useState(false);
  if (open !== lastOpen) {
    setLastOpen(open);
    if (open) setDraft(current);
  }

  async function persist() {
    if (!roomCode) return;
    const before = new Set(current);
    const after = new Set(draft);

    const added = draft.filter((id) => !before.has(id));
    const removed = current.filter((id) => !after.has(id));
    if (added.length === 0 && removed.length === 0) return;

    await toast.run(async () => {
      await Promise.all([
        ...added.map((id) => toggleStaple(roomCode, id, true)),
        ...removed.map((id) => toggleStaple(roomCode, id, false)),
      ]);
    });
  }

  return (
    <StaplesPicker
      open={open}
      onClose={onClose}
      value={draft}
      onChange={setDraft}
      onDone={() => void persist()}
    />
  );
}
