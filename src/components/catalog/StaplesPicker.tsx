import { useMemo, useState } from 'react';
import { Sheet } from '../ui/Sheet';
import { Button } from '../ui/Button';
import { CheckIcon } from '../ui/icons';
import { useCatalog } from '../../hooks/useCatalog';
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
  const { search } = useCatalog();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<Category | null>(null);

  const selected = useMemo(() => new Set(value), [value]);

  const results = useMemo(
    () => search(query, category ?? undefined, 300),
    [search, query, category]
  );

  /**
   * עלות משוערת של סל הבסיס.
   * זה המספר שהופך רשימת מוצרים מופשטת למשהו שאפשר להחליט לפיו —
   * "בחרתי 40 מוצרים" לא אומר כלום, "כ-₪620 לסבב מלא" כן.
   */
  const estimate = useMemo(() => {
    const byId = new Map(results.map((p) => [p.id, p]));
    return value.reduce((sum, id) => sum + (byId.get(id)?.price ?? 0), 0);
  }, [value, results]);

  const toggle = (id: string) =>
    onChange(selected.has(id) ? value.filter((x) => x !== id) : [...value, id]);

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
                עלות משוערת <span className="font-semibold text-brand-800">{formatILS(estimate)}</span>
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

        {/* חיפוש */}
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="חיפוש מוצר…"
          type="search"
          className="w-full rounded-xl border border-ink-200 bg-white px-3.5 py-3
                     text-[16px] placeholder:text-ink-400 focus:border-brand-500
                     focus:outline-none focus:ring-2 focus:ring-brand-500/30"
        />

        {/* קטגוריות */}
        <div className="scroll-area -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          <Chip active={category === null} onClick={() => setCategory(null)}>
            הכל
          </Chip>
          {ALL_CATEGORIES.map((c) => (
            <Chip key={c} active={category === c} onClick={() => setCategory(c)}>
              {CATEGORY_EMOJI[c]} {CATEGORY_LABELS[c]}
            </Chip>
          ))}
        </div>

        {/* רשימה */}
        {results.length === 0 ? (
          <p className="py-8 text-center text-sm text-ink-500">
            לא נמצאו מוצרים עבור "{query}"
          </p>
        ) : (
          <ul className="divide-y divide-ink-100 rounded-xl border border-ink-200 bg-white">
            {results.map((p) => {
              const on = selected.has(p.id);
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => toggle(p.id)}
                    aria-pressed={on}
                    className={`flex w-full items-center gap-3 px-3 py-2.5 text-start
                                transition ${on ? 'bg-brand-50/70' : 'hover:bg-ink-50'}`}
                  >
                    <span
                      aria-hidden
                      className={`grid h-5 w-5 shrink-0 place-items-center rounded-md border-2
                                  transition ${
                                    on
                                      ? 'border-brand-600 bg-brand-600 text-white'
                                      : 'border-ink-300'
                                  }`}
                    >
                      {on && <CheckIcon width={13} height={13} />}
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
              );
            })}
          </ul>
        )}
      </div>
    </Sheet>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
        active ? 'bg-brand-700 text-white' : 'bg-ink-100 text-ink-600'
      }`}
    >
      {children}
    </button>
  );
}
