import { useState } from 'react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { useAuth } from '../../store/AuthContext';
import { useToast } from '../../store/ToastContext';
import { addGlobalProduct } from '../../services/catalogService';
import { ALL_CATEGORIES, CATEGORY_EMOJI, CATEGORY_LABELS, type Category } from '../../types/models';

/**
 * טופס הוספת מוצר חדש לקטלוג המשותף.
 *
 * מוצג כשמישהו לא מוצא את מה שהוא מחפש — בשני המקומות היחידים שבהם
 * זה קורה בפועל: בחירת מוצרי הבסיס (ביצירת חדר) ובדיווח על מוצר חסר.
 * מוצר שנוסף כאן זמין מיד לכל החדרים, לא רק לזה הנוכחי.
 */
export function AddProductForm({
  initialName = '',
  onAdded,
  onCancel,
}: {
  initialName?: string;
  /** נקרא עם המוצר החדש (או הקיים, אם מישהו כבר הוסיף בדיוק אותו שם) */
  onAdded: (product: { id: string; name: string; category: Category; priceShekels: number }) => void;
  onCancel: () => void;
}) {
  const { user } = useAuth();
  const toast = useToast();

  const [name, setName] = useState(initialName);
  const [category, setCategory] = useState<Category>('other');
  const [price, setPrice] = useState('');
  const [unit, setUnit] = useState('');
  const [busy, setBusy] = useState(false);

  const valid = name.trim().length >= 2;

  async function submit() {
    if (!user || !valid) return;
    setBusy(true);
    const priceShekels = Number(price.replace(',', '.')) || 0;
    const res = await toast.run(() =>
      addGlobalProduct(user.uid, { name, category, priceShekels, unit })
    );
    setBusy(false);
    if (res !== null) {
      toast.success(`${name.trim()} נוסף לקטלוג`);
      onAdded({ id: res, name: name.trim(), category, priceShekels });
    }
  }

  return (
    <div className="space-y-3 rounded-xl border border-brand-200 bg-brand-50/50 p-3.5">
      <p className="text-xs font-semibold text-brand-800">➕ מוצר חדש לקטלוג המשותף</p>

      <Input
        label="שם המוצר"
        value={name}
        onChange={(e) => setName(e.target.value)}
        maxLength={60}
        autoFocus
      />

      <div>
        <p className="mb-1.5 text-sm font-medium text-ink-700">קטגוריה</p>
        <div className="grid grid-cols-2 gap-2">
          {ALL_CATEGORIES.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCategory(c)}
              aria-pressed={category === c}
              className={[
                'tap flex items-center gap-2 rounded-xl border px-3 text-sm font-medium',
                'transition active:scale-[.98]',
                category === c
                  ? 'border-brand-500 bg-surface text-brand-900 ring-1 ring-brand-500/30'
                  : 'border-ink-200 bg-surface text-ink-600',
              ].join(' ')}
            >
              <span aria-hidden>{CATEGORY_EMOJI[c]}</span>
              {CATEGORY_LABELS[c]}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Input
          label="מחיר משוער (₪)"
          inputMode="decimal"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          placeholder="0"
        />
        <Input
          label="יחידה (אופציונלי)"
          value={unit}
          onChange={(e) => setUnit(e.target.value)}
          placeholder="לדוגמה: יחידה, ק״ג"
          maxLength={20}
        />
      </div>

      <div className="flex gap-2">
        <Button fullWidth loading={busy} disabled={!valid} onClick={submit}>
          הוספה לקטלוג
        </Button>
        <Button variant="ghost" onClick={onCancel}>
          ביטול
        </Button>
      </div>
    </div>
  );
}

