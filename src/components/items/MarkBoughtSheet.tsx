import { useEffect, useMemo, useState } from 'react';
import { Sheet } from '../ui/Sheet';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Avatar } from '../ui/Avatar';
import { CheckIcon } from '../ui/icons';
import { useAuth } from '../../store/AuthContext';
import { useRoom } from '../../store/RoomContext';
import { useToast } from '../../store/ToastContext';
import { createPurchase } from '../../services/purchaseService';
import { defaultPercentages, splitEqual, splitPercentage } from '../../lib/money';
import { formatILS, toAgorot } from '../../lib/format';
import { SPLIT_METHOD_LABELS, type Agorot, type SplitMethod, type WithId, type Item } from '../../types/models';

const SPLIT_MODES: SplitMethod[] = ['equal', 'percentage', 'custom'];

function ModeCard({
  active,
  onClick,
  emoji,
  title,
  body,
}: {
  active: boolean;
  onClick: () => void;
  emoji: string;
  title: string;
  body: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={[
        'rounded-xl border p-3 text-start transition active:scale-[.98]',
        active
          ? 'border-brand-500 bg-brand-50 ring-1 ring-brand-500/30'
          : 'border-ink-200 bg-white',
      ].join(' ')}
    >
      <span aria-hidden className="block text-xl">
        {emoji}
      </span>
      <span
        className={`mt-1 block text-sm font-bold ${active ? 'text-brand-900' : 'text-ink-700'}`}
      >
        {title}
      </span>
      <span className="mt-0.5 block text-[11px] leading-snug text-ink-500">{body}</span>
    </button>
  );
}

export function MarkBoughtSheet({
  open,
  onClose,
  item,
}: {
  open: boolean;
  onClose: () => void;
  item: WithId<Item> | null;
}) {
  const { user, profile } = useAuth();
  const { roomCode, activeMembers } = useRoom();
  const toast = useToast();

  const [amountText, setAmountText] = useState('');
  const [method, setMethod] = useState<SplitMethod>('covered');
  const [participants, setParticipants] = useState<string[]>([]);
  const [percentages, setPercentages] = useState<Record<string, string>>({});
  const [customText, setCustomText] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  // ברירת מחדל: כל החברים הפעילים משתתפים
  useEffect(() => {
    if (!open) return;
    const ids = activeMembers.map((m) => m.id);
    setParticipants(ids);
    // defaultPercentages מבטיח סכום של 100 בדיוק.
    // (100 / n).toFixed(1) נשבר ברוב גדלי החדר — ראו lib/money.ts
    setPercentages(
      Object.fromEntries(Object.entries(defaultPercentages(ids)).map(([id, v]) => [id, String(v)]))
    );
    setCustomText({});
    setAmountText('');
    setMethod('covered');
  }, [open, activeMembers]);

  const amount: Agorot = useMemo(() => {
    const n = Number(amountText.replace(',', '.'));
    return Number.isFinite(n) && n > 0 ? toAgorot(n) : 0;
  }, [amountText]);

  const toggleParticipant = (id: string) =>
    setParticipants((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );

  // ── חישוב החלוקה + הודעת שגיאה ──
  const { shares, splitError } = useMemo((): {
    shares: Record<string, Agorot>;
    splitError: string | null;
  } => {
    if (amount <= 0) return { shares: {}, splitError: null };
    if (participants.length === 0) return { shares: {}, splitError: 'בחרו לפחות משתתף אחד' };

    try {
      if (method === 'equal') {
        return { shares: splitEqual(amount, participants), splitError: null };
      }
      if (method === 'percentage') {
        const pct = Object.fromEntries(
          participants.map((id) => [id, Number(percentages[id] ?? 0)])
        );
        return { shares: splitPercentage(amount, pct), splitError: null };
      }
      const custom = Object.fromEntries(
        participants.map((id) => [id, toAgorot(Number(customText[id] ?? 0))])
      );
      const sum = Object.values(custom).reduce((a, b) => a + b, 0);
      if (sum !== amount) {
        const diff = amount - sum;
        return {
          shares: custom,
          splitError:
            diff > 0
              ? `נותר לחלק ${formatILS(diff)}`
              : `חולק ${formatILS(-diff)} יותר מדי`,
        };
      }
      return { shares: custom, splitError: null };
    } catch (err) {
      return { shares: {}, splitError: (err as Error).message };
    }
  }, [amount, method, participants, percentages, customText, user]);

  const canSubmit =
    amount > 0 && !splitError && !busy && (method === 'covered' || participants.length > 0);

  async function submit() {
    if (!user || !profile || !roomCode) return;
    setBusy(true);
    const res = await toast.run(() =>
      createPurchase(roomCode, user.uid, profile.displayName, {
        itemId: item?.id ?? null,
        title: item?.name ?? 'קנייה',
        amount,
        splitMethod: method,
        splitBetween: participants,
        percentages:
          method === 'percentage'
            ? Object.fromEntries(participants.map((id) => [id, Number(percentages[id] ?? 0)]))
            : undefined,
        customShares: method === 'custom' ? shares : undefined,
      })
    );
    setBusy(false);
    if (res !== null) {
      toast.success('הקנייה נרשמה וממתינה לאישור המנהל');
      onClose();
    }
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={item ? `קניתי: ${item.name}` : 'רישום קנייה'}
      footer={
        <Button size="lg" fullWidth loading={busy} disabled={!canSubmit} onClick={submit}>
          {amount > 0
            ? `${method === 'covered' ? 'רשום על חשבוני' : 'שמור קנייה'} · ${formatILS(amount)}`
            : 'שמור קנייה'}
        </Button>
      }
    >
      <div className="space-y-5 pb-2">
        <Input
          label="כמה שילמת?"
          type="number"
          inputMode="decimal"
          step="0.01"
          min="0.01"
          placeholder="0.00"
          value={amountText}
          onChange={(e) => setAmountText(e.target.value)}
          suffix="₪"
          autoFocus
          required
        />

        {/* ── שתי דרכים לרשום קנייה ── */}
        <fieldset>
          <legend className="mb-2 block text-sm font-medium text-ink-700">איך לרשום?</legend>
          <div className="grid grid-cols-2 gap-2">
            <ModeCard
              active={method === 'covered'}
              onClick={() => setMethod('covered')}
              emoji="🙋"
              title="לקחתי על עצמי"
              body="אף אחד לא מחויב. כולם רואים שקנית."
            />
            <ModeCard
              active={method !== 'covered'}
              onClick={() => setMethod((m) => (m === 'covered' ? 'equal' : m))}
              emoji="👥"
              title="לחלק בין השותפים"
              body="כל אחד חייב את חלקו."
            />
          </div>
        </fieldset>

        {method === 'covered' && (
          <p className="rounded-xl bg-emerald-50 px-3.5 py-3 text-sm leading-relaxed text-emerald-900">
            💚 הקנייה תירשם על שמך ותופיע לכולם, אבל <b>המאזנים לא ישתנו</b>. ככה
            מתגלגלים בלי התחשבנות על כל דבר קטן.
          </p>
        )}

        {method !== 'covered' && (
        <fieldset>
          <legend className="mb-2 block text-sm font-medium text-ink-700">שיטת החלוקה</legend>
          <div className="grid grid-cols-3 gap-2">
            {SPLIT_MODES.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMethod(m)}
                aria-pressed={method === m}
                className={[
                  'tap rounded-xl border px-2 py-2.5 text-xs font-semibold transition active:scale-[.98]',
                  method === m
                    ? 'border-brand-500 bg-brand-50 text-brand-900 ring-1 ring-brand-500/30'
                    : 'border-ink-200 bg-white text-ink-500',
                ].join(' ')}
              >
                {SPLIT_METHOD_LABELS[m]}
              </button>
            ))}
          </div>
        </fieldset>
        )}

        {method !== 'covered' && (
        <fieldset>
          <legend className="mb-2 block text-sm font-medium text-ink-700">
            בין מי לחלק? (<span className="num">{participants.length}</span>)
          </legend>
          <ul className="space-y-1.5">
            {activeMembers.map((m) => {
              const on = participants.includes(m.id);
              return (
                <li key={m.id}>
                  <div
                    className={[
                      'flex items-center gap-3 rounded-xl border px-3 py-2.5 transition',
                      on ? 'border-brand-300 bg-brand-50/60' : 'border-ink-200 bg-white',
                    ].join(' ')}
                  >
                    <button
                      type="button"
                      onClick={() => toggleParticipant(m.id)}
                      aria-pressed={on}
                      aria-label={`${on ? 'הסר את' : 'הוסף את'} ${m.name}`}
                      className="flex flex-1 items-center gap-3 text-start"
                    >
                      <span
                        aria-hidden
                        className={[
                          'grid h-5 w-5 shrink-0 place-items-center rounded-md border-2 transition',
                          on ? 'border-brand-600 bg-brand-600 text-white' : 'border-ink-300',
                        ].join(' ')}
                      >
                        {on && <CheckIcon width={13} height={13} />}
                      </span>
                      <Avatar name={m.name} uid={m.id} src={m.avatar} size="xs" />
                      <span className="truncate text-sm font-medium text-ink-800">
                        {m.name}
                        {m.id === user?.uid && (
                          <span className="text-xs text-ink-400"> (אתה)</span>
                        )}
                      </span>
                    </button>

                    {on && method === 'percentage' && (
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.1"
                        value={percentages[m.id] ?? ''}
                        onChange={(e) =>
                          setPercentages((p) => ({ ...p, [m.id]: e.target.value }))
                        }
                        aria-label={`אחוז עבור ${m.name}`}
                        className="num h-11 w-16 rounded-lg border border-ink-200 px-2 text-center text-sm"
                      />
                    )}

                    {on && method === 'custom' && (
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="0.00"
                        value={customText[m.id] ?? ''}
                        onChange={(e) =>
                          setCustomText((c) => ({ ...c, [m.id]: e.target.value }))
                        }
                        aria-label={`סכום עבור ${m.name}`}
                        className="num h-11 w-20 rounded-lg border border-ink-200 px-2 text-center text-sm"
                      />
                    )}

                    {on && method === 'equal' && amount > 0 && (
                      <span className="num shrink-0 text-sm font-semibold text-brand-800">
                        {formatILS(shares[m.id] ?? 0)}
                      </span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </fieldset>
        )}

        {/* סיכום חי — זה מה שמונע חלוקה שלא מסתכמת */}
        {amount > 0 && method !== 'covered' && (
          <div
            className={[
              'rounded-xl px-3.5 py-3 text-sm',
              splitError ? 'bg-rose-50 text-rose-800' : 'bg-emerald-50 text-emerald-900',
            ].join(' ')}
          >
            <div className="flex items-center justify-between font-semibold">
              <span>סה"כ הקנייה</span>
              <span className="num">{formatILS(amount)}</span>
            </div>
            <div className="mt-1 flex items-center justify-between text-xs opacity-90">
              <span>חולק</span>
              <span className="num">
                {formatILS(Object.values(shares).reduce((a, b) => a + b, 0))}
              </span>
            </div>
            {splitError && (
              <p role="alert" className="mt-1.5 font-semibold">
                {splitError}
              </p>
            )}
          </div>
        )}

        <p className="rounded-xl bg-ink-100/70 px-3.5 py-2.5 text-xs leading-relaxed text-ink-600">
          {method === 'covered'
            ? 'הקנייה תישלח לאישור מנהל החדר ותופיע בסיכום התרומות.'
            : 'הקנייה תישלח לאישור מנהל החדר. המאזנים יתעדכנו רק לאחר האישור.'}
        </p>
      </div>
    </Sheet>
  );
}
