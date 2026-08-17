import { useMemo, useState } from 'react';
import { Sheet } from '../ui/Sheet';
import { Button } from '../ui/Button';
import { Input, Textarea } from '../ui/Input';
import { reportItem } from '../../services/itemService';
import { useAuth } from '../../store/AuthContext';
import { useRoom } from '../../store/RoomContext';
import { useToast } from '../../store/ToastContext';
import { useItems } from '../../hooks/useRoomData';
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
  const toast = useToast();

  const [name, setName] = useState('');
  const [category, setCategory] = useState<Category>('kitchen');
  const [priority, setPriority] = useState<Priority>('normal');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);

  // קטגוריות שהוגדרו בחדר; אם לא הוגדרו — כולן
  const categories = useMemo(() => {
    const active = ALL_CATEGORIES.filter((c) => metadata?.categories?.[c]);
    return active.length > 0 ? active : ALL_CATEGORIES;
  }, [metadata]);

  // אזהרת כפילות — לא חוסמת. יכולים באמת להיות שני "חלב".
  const duplicate = useMemo(() => {
    const q = name.trim().toLowerCase();
    if (q.length < 2) return null;
    return items.find((i) => i.nameLower === q) ?? null;
  }, [name, items]);

  function reset() {
    setName('');
    setCategory(categories[0] ?? 'kitchen');
    setPriority('normal');
    setNotes('');
  }

  async function submit() {
    if (!user || !profile || !roomCode) return;
    setBusy(true);
    const res = await toast.run(() =>
      reportItem(roomCode, user.uid, profile.displayName, { name, category, priority, notes })
    );
    setBusy(false);
    if (res !== null) {
      toast.success(`${name.trim()} נוסף לרשימה`);
      reset();
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
        <Input
          label="מה חסר?"
          placeholder="לדוגמה: חלב, נייר טואלט"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={60}
          autoFocus
          required
        />

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
          <legend className="mb-2 block text-sm font-medium text-ink-700">קטגוריה</legend>
          <div className="grid grid-cols-2 gap-2">
            {categories.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCategory(c)}
                aria-pressed={category === c}
                className={[
                  'tap flex items-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-medium',
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
                  'tap rounded-xl border px-2 py-2.5 text-sm font-semibold transition active:scale-[.98]',
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
