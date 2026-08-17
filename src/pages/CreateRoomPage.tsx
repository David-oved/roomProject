import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { PlainShell } from '../components/layout/AppShell';
import { Button } from '../components/ui/Button';
import { Input, Textarea } from '../components/ui/Input';
import { TopBar } from '../components/layout/TopBar';
import { createRoom } from '../services/roomService';
import { useAuth } from '../store/AuthContext';
import { useConnection } from '../store/ConnectionContext';
import { ALL_CATEGORIES, CATEGORY_EMOJI, CATEGORY_LABELS, type Category } from '../types/models';

export default function CreateRoomPage() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { isOnline } = useConnection();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [categories, setCategories] = useState<Category[]>(['kitchen', 'bathroom', 'cleaning']);
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
      const code = await createRoom(user.uid, profile, { name, description, categories });
      navigate(`/r/${code}?created=1`, { replace: true });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <TopBar title="יצירת חדר חדש" back="/onboarding" />
      <PlainShell>
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
                        : 'border-ink-200 bg-white text-ink-600',
                    ].join(' ')}
                  >
                    <span aria-hidden className="text-lg">
                      {CATEGORY_EMOJI[c]}
                    </span>
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

          {error && (
            <p role="alert" className="rounded-xl bg-rose-50 px-3 py-2.5 text-sm text-rose-700">
              {error}
            </p>
          )}

          <div className="rounded-xl bg-brand-50/70 px-3.5 py-3 text-xs leading-relaxed text-brand-900">
            💡 עם יצירת החדר תקבלו <b>קוד בן 6 תווים</b>. שתפו אותו עם השותפים כדי שיוכלו
            לבקש להצטרף. אתם תאשרו כל בקשה.
          </div>

          <Button type="submit" size="lg" fullWidth loading={busy} disabled={!canSubmit}>
            צור חדר
          </Button>
        </form>
      </PlainShell>
    </>
  );
}
