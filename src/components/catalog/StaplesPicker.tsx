import { useMemo, useState } from 'react';
import { Sheet } from '../ui/Sheet';
import { Button } from '../ui/Button';
import { CheckIcon, ChevronIcon } from '../ui/icons';
import { AddProductForm } from './AddProductForm';
import { useCatalog, type RoomProduct } from '../../hooks/useCatalog';
import { formatILS } from '../../lib/format';
import {
  ALL_CATEGORIES,
  CATEGORY_EMOJI,
  CATEGORY_LABELS,
  type Category,
} from '../../types/models';

/**
 * בורר מוצרי בסיס.
 *
 * מוצג גם ביצירת חדר (לפני שיש חדר בכלל) וגם מתוך חדר קיים, ולכן הוא
 * **controlled**: הוא לא יודע איפה הבחירה נשמרת, רק מה נבחר כרגע.
 *
 * המבנה: קטגוריות מתקפלות. 213 מוצרים ברשימה שטוחה אחת הם קיר —
 * אי אפשר לסרוק אותו בעין ואי אפשר להתמצא בו. מקופל, המסך מתחיל
 * בארבע שורות שאפשר להבין במבט אחד, ונפתח רק מה שמעניין.
 *
 * חיפוש עוקף את הקיפול לגמרי: מי שיודע מה הוא מחפש לא צריך לנווט.
 */
export function StaplesPicker({
  open,
  onClose,
  value,
  onChange,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  value: string[];
  onChange: (ids: string[]) => void;
  onDone?: () => void;
}) {
  const { products, search } = useCatalog();
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState<Category | null>(null);
  const [addingProduct, setAddingProduct] = useState(false);

  const selected = useMemo(() => new Set(value), [value]);
  const searching = query.trim().length > 0;

  const results = useMemo(() => (searching ? search(query, undefined, 60) : []), [
    searching,
    search,
    query,
  ]);

  /** מוצרים לפי קטגוריה + כמה מהם נבחרו */
  const byCategory = useMemo(() => {
    return ALL_CATEGORIES.map((category) => {
      const list = products
        .filter((p) => p.category === category)
        .sort((a, b) => a.name.localeCompare(b.name, 'he'));
      return {
        category,
        list,
        chosen: list.filter((p) => selected.has(p.id)).length,
      };
    }).filter((g) => g.list.length > 0);
  }, [products, selected]);

  /**
   * עלות משוערת של סל הבסיס.
   * "בחרתי 40 מוצרים" לא אומר כלום. "כ-₪620 לסבב מלא" כן.
   */
  const estimate = useMemo(() => {
    const byId = new Map(products.map((p) => [p.id, p]));
    return value.reduce((sum, id) => sum + (byId.get(id)?.price ?? 0), 0);
  }, [value, products]);

  const toggle = (id: string) =>
    onChange(selected.has(id) ? value.filter((x) => x !== id) : [...value, id]);

  const toggleAll = (list: RoomProduct[], on: boolean) => {
    const ids = list.map((p) => p.id);
    onChange(on ? [...new Set([...value, ...ids])] : value.filter((x) => !ids.includes(x)));
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="מוצרי בסיס לחדר"
      footer={
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-ink-500">
              נבחרו <span className="num font-semibold text-ink-800">{value.length}</span> מוצרים
            </span>
            {estimate > 0 && (
              <span className="num text-ink-500">
                עלות משוערת{' '}
                <span className="font-semibold text-brand-800">{formatILS(estimate)}</span>
              </span>
            )}
          </div>
          <Button
            size="lg"
            fullWidth
            onClick={() => {
              onDone?.();
              onClose();
            }}
          >
            סיימתי
          </Button>
        </div>
      }
    >
      <div className="space-y-3 pb-2">
        <p className="text-sm leading-relaxed text-ink-500">
          המוצרים שתמיד צריכים להיות בבית. כשמשהו נגמר — לחיצה אחת מדווחת עליו,
          בלי להקליד שם ומחיר מחדש.
        </p>

        {/* ── חיפוש מהיר ── */}
        <div className="sticky top-0 z-10 -mx-1 bg-white px-1 pb-1 pt-0.5">
          <div className="relative">
            <input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setAddingProduct(false);
              }}
              placeholder="חיפוש מהיר…"
              type="search"
              enterKeyHint="search"
              className="w-full rounded-xl border border-ink-200 bg-white ps-10 pe-3 py-3
                         text-[16px] placeholder:text-ink-400 focus:border-brand-500
                         focus:outline-none focus:ring-2 focus:ring-brand-500/30"
            />
            <span
              aria-hidden
              className="pointer-events-none absolute inset-y-0 start-3 grid place-items-center
                         text-ink-400"
            >
              🔍
            </span>
          </div>
        </div>

        {searching ? (
          /* ── תוצאות חיפוש: רשימה שטוחה, בלי קיפול ── */
          <div>
            {addingProduct ? (
              <AddProductForm
                initialName={query.trim()}
                onCancel={() => setAddingProduct(false)}
                onAdded={({ id, category }) => {
                  onChange([...new Set([...value, id])]);
                  setExpanded(category);
                  setQuery('');
                  setAddingProduct(false);
                }}
              />
            ) : results.length === 0 ? (
              <div className="space-y-3 py-4 text-center">
                <p className="text-sm text-ink-500">לא נמצאו מוצרים עבור "{query.trim()}"</p>
                <button
                  type="button"
                  onClick={() => setAddingProduct(true)}
                  className="rounded-xl bg-brand-50 px-4 py-2 text-sm font-semibold text-brand-800
                             transition hover:bg-brand-100"
                >
                  ➕ הוספת "{query.trim()}" כמוצר חדש
                </button>
              </div>
            ) : (
              <>
                <p className="mb-1.5 px-1 text-xs text-ink-500">
                  <span className="num">{results.length}</span> תוצאות
                </p>
                <ul className="divide-y divide-ink-100 overflow-hidden rounded-xl border border-ink-200 bg-white">
                  {results.map((p) => (
                    <ProductRow
                      key={p.id}
                      product={p}
                      checked={selected.has(p.id)}
                      onToggle={() => toggle(p.id)}
                      showCategory
                    />
                  ))}
                </ul>
                <button
                  type="button"
                  onClick={() => setAddingProduct(true)}
                  className="mt-2 w-full rounded-xl px-3 py-2 text-center text-xs font-semibold
                             text-brand-700 transition hover:bg-brand-50"
                >
                  לא מוצאים את מה שמחפשים? הוספת מוצר חדש
                </button>
              </>
            )}
          </div>
        ) : (
          /* ── קטגוריות מתקפלות ── */
          <ul className="space-y-2">
            {byCategory.map(({ category, list, chosen }) => {
              const isOpen = expanded === category;
              const allChosen = chosen === list.length;

              return (
                <li
                  key={category}
                  className="overflow-hidden rounded-xl border border-ink-200 bg-white"
                >
                  <button
                    type="button"
                    onClick={() => setExpanded(isOpen ? null : category)}
                    aria-expanded={isOpen}
                    className={`tap flex w-full items-center gap-3 px-3.5 text-start transition
                                ${isOpen ? 'bg-brand-50/60' : 'hover:bg-ink-50'}`}
                  >
                    <span aria-hidden className="text-xl">
                      {CATEGORY_EMOJI[category]}
                    </span>

                    <span className="min-w-0 flex-1">
                      <span className="block font-bold text-ink-900">
                        {CATEGORY_LABELS[category]}
                      </span>
                      <span className="num block text-xs text-ink-500">
                        {chosen > 0 ? (
                          <>
                            <span className="font-semibold text-brand-700">{chosen}</span> נבחרו
                            מתוך {list.length}
                          </>
                        ) : (
                          <>{list.length} מוצרים</>
                        )}
                      </span>
                    </span>

                    {/* החץ מסתובב כלפי מטה כשפתוח */}
                    <ChevronIcon
                      width={20}
                      height={20}
                      className={`shrink-0 text-ink-400 transition-transform duration-200
                                  ${isOpen ? '-rotate-90' : ''}`}
                    />
                  </button>

                  {isOpen && (
                    <div className="animate-fade-in border-t border-ink-100">
                      <div className="flex justify-end px-3.5 py-2">
                        <button
                          type="button"
                          onClick={() => toggleAll(list, !allChosen)}
                          className="rounded-lg px-2 py-1 text-xs font-semibold text-brand-700
                                     transition hover:bg-brand-50"
                        >
                          {allChosen ? 'הסר הכל' : 'בחר הכל'}
                        </button>
                      </div>
                      <ul className="divide-y divide-ink-100 border-t border-ink-100">
                        {list.map((p) => (
                          <ProductRow
                            key={p.id}
                            product={p}
                            checked={selected.has(p.id)}
                            onToggle={() => toggle(p.id)}
                          />
                        ))}
                      </ul>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Sheet>
  );
}

/* ═══════════════ שורת מוצר ═══════════════ */

function ProductRow({
  product,
  checked,
  onToggle,
  showCategory,
}: {
  product: RoomProduct;
  checked: boolean;
  onToggle: () => void;
  showCategory?: boolean;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onToggle}
        aria-pressed={checked}
        className={`flex w-full items-center gap-3 px-3.5 py-2.5 text-start transition
                    ${checked ? 'bg-brand-50/70' : 'hover:bg-ink-50'}`}
      >
        <span
          aria-hidden
          className={`grid h-5 w-5 shrink-0 place-items-center rounded-md border-2 transition
                      ${checked ? 'border-brand-600 bg-brand-600 text-white' : 'border-ink-300'}`}
        >
          {checked && <CheckIcon width={13} height={13} />}
        </span>

        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-ink-900">{product.name}</span>
          <span className="text-xs text-ink-400">
            {showCategory && (
              <>
                {CATEGORY_EMOJI[product.category]} {CATEGORY_LABELS[product.category]}
                {product.unit && ' · '}
              </>
            )}
            {product.unit}
          </span>
        </span>

        <span className="num shrink-0 text-sm text-ink-500">{formatILS(product.price)}</span>
      </button>
    </li>
  );
}
