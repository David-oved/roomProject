import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { PlainShell } from '../components/layout/AppShell';
import { Button } from '../components/ui/Button';
import { Input, Textarea } from '../components/ui/Input';
import { TopBar } from '../components/layout/TopBar';
import { createRoom } from '../services/roomService';
import { friendlyError } from '../lib/errors';
import { useAuth } from '../store/AuthContext';
import { useConnection } from '../store/ConnectionContext';
import { ALL_CATEGORIES, CATEGORY_LABELS, type Category } from '../types/models';
import { CATEGORY_ICON } from '../lib/categoryIcons';
import { StaplesPicker } from '../components/catalog/StaplesPicker';
import { DEFAULT_STAPLES } from '../data/catalog';
import { BasketIcon, ChevronIcon, LightbulbIcon } from '../components/ui/icons';

export default function CreateRoomPage() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { isOnline } = useConnection();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [categories, setCategories] = useState<Category[]>(['kitchen', 'bathroom', 'cleaning']);
  // מסומנים מראש — רוב החדרים צריכים בדיוק את אלה, וההתאמה קלה
  const [staples, setStaples] = useState<string[]>(DEFAULT_STAPLES);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const toggle = (c: Category) =>
    setCategories((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]));

  const canSubmit = name.trim().length >= 2 && categories.length > 0 && isOnline;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!user || !profile) return;
    setError('');
    setBusy(true);
    try {
      const code = await createRoom(user.uid, profile, {
        name,
        description,
        categories,
        staples,
      });
      navigate(`/r/${code}?created=1`, { replace: true });
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <TopBar title="יצירת חדר חדש" back="/onboarding" />
      <PlainShell hasTopBar>
        <form onSubmit={handleSubmit} className="space-y-5 py-4" noValidate>
          <Input
            label="שם החדר"
            placeholder="לדוגמה: דירה 12, בניין ג׳"
            value={name}
            onChange={(e) => setName(e.target.value)}
            hint="השם חייב להיות ייחודי במערכת"
            maxLength={50}
            required
          />

          <Textarea
            label="תיאור (אופציונלי)"
            placeholder="קומה 3, ליד חדר הכביסה"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={300}
          />

          <fieldset>
            <legend className="mb-2 block text-sm font-medium text-ink-700">
              אילו קטגוריות רלוונטיות לחדר?
            </legend>
            <div className="grid grid-cols-2 gap-2">
              {ALL_CATEGORIES.map((c) => {
                const on = categories.includes(c);
                const CatIcon = CATEGORY_ICON[c];
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => toggle(c)}
                    aria-pressed={on}
                    className={[
                      'tap flex items-center gap-2 rounded-xl border px-3 py-3 text-sm font-medium',
                      'transition active:scale-[.98]',
                      on
                        ? 'border-brand-500 bg-brand-50 text-brand-900 ring-1 ring-brand-500/30'
                        : 'border-ink-200 bg-surface text-ink-600',
                    ].join(' ')}
                  >
                    <CatIcon width={16} height={16} className="shrink-0" />
                    {CATEGORY_LABELS[c]}
                  </button>
                );
              })}
            </div>
            {categories.length === 0 && (
              <p role="alert" className="mt-2 text-sm text-rose-600">
                בחרו לפחות קטגוריה אחת
              </p>
            )}
          </fieldset>

          {/* ── מוצרי בסיס ── */}
          <div>
            <span className="mb-2 block text-sm font-medium text-ink-700">מוצרי בסיס</span>
            <button
              type="button"
              onClick={() => setPickerOpen(true)}
              className="flex w-full items-center gap-3 rounded-xl border border-ink-200
                         bg-surface p-3.5 text-start transition active:scale-[.99] hover:bg-ink-50"
            >
              <span aria-hidden className="grid h-10 w-10 shrink-0 place-items-center
                                           rounded-xl bg-brand-50 text-brand-700">
                <BasketIcon width={19} height={19} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-ink-900">
                  <span className="num">{staples.length}</span> מוצרים נבחרו
                </span>
                <span className="block text-xs text-ink-500">
                  {staples.length > 0 ? 'לחצו כדי לערוך את הרשימה' : 'לחצו כדי לבחור מהקטלוג'}
                </span>
              </span>
              <ChevronIcon width={20} height={20} className="shrink-0 text-ink-300" />
            </button>
            <p className="mt-1.5 text-xs leading-relaxed text-ink-500">
              המוצרים שתמיד צריכים להיות בבית. כשמשהו נגמר — לחיצה אחת מדווחת עליו.
              אפשר לשנות בכל רגע.
            </p>
          </div>

          {error && (
            <p role="alert" className="rounded-xl bg-rose-50 px-3 py-2.5 text-sm text-rose-700">
              {error}
            </p>
          )}

          <div className="flex items-start gap-1.5 rounded-xl bg-brand-50/70 px-3.5 py-3 text-xs leading-relaxed text-brand-900">
            <LightbulbIcon width={14} height={14} className="mt-0.5 shrink-0" />
            <span>
              עם יצירת החדר תקבלו <b>קוד בן 6 תווים</b>. שתפו אותו עם השותפים כדי שיוכלו
              לבקש להצטרף. אתם תאשרו כל בקשה.
            </span>
          </div>

          <Button type="submit" size="lg" fullWidth loading={busy} disabled={!canSubmit}>
            צור חדר
          </Button>
        </form>

        <StaplesPicker
          open={pickerOpen}
          onClose={() => setPickerOpen(false)}
          value={staples}
          onChange={setStaples}
        />
      </PlainShell>
    </>
  );
}
