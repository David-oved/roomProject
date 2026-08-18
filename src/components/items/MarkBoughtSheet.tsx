import { useEffect, useMemo, useState } from 'react';
import { Sheet } from '../ui/Sheet';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Avatar } from '../ui/Avatar';
import { CheckIcon } from '../ui/icons';
import { useAuth } from '../../store/AuthContext';
import { useRoom } from '../../store/RoomContext';
import { useToast } from '../../store/ToastContext';
import { useCatalog } from '../../hooks/useCatalog';
import { useBalances } from '../../hooks/useRoomData';
import { createPurchase } from '../../services/purchaseService';
import {
  defaultPercentages,
  splitEqual,
  splitPercentage,
  splitWithDebtOffset,
} from '../../lib/money';
import { formatILS, toAgorot } from '../../lib/format';
import {
  SPLIT_METHOD_LABELS,
  type Agorot,
  type Item,
  type SplitMethod,
  type WithId,
} from '../../types/models';

/** איך המשתמש בוחר לרשום. שונה מ-SplitMethod כי 'split' מתפצל לשלוש שיטות. */
type Mode = 'covered' | 'offset' | 'split';
type SplitStyle = 'equal' | 'percentage' | 'custom';

const SPLIT_STYLES: SplitStyle[] = ['equal', 'percentage', 'custom'];

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
  const { getProduct } = useCatalog();
  const { myBalance } = useBalances();
  const toast = useToast();

  const [amountText, setAmountText] = useState('');
  const [priceFromCatalog, setPriceFromCatalog] = useState(false);
  const [mode, setMode] = useState<Mode>('covered');
  const [splitStyle, setSplitStyle] = useState<SplitStyle>('equal');
  const [participants, setParticipants] = useState<string[]>([]);
  const [percentages, setPercentages] = useState<Record<string, string>>({});
  const [customText, setCustomText] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  /** החוב הנוכחי של הקונה, כמספר חיובי. 0 = לא חייב כלום. */
  const myDebt = Math.max(0, -myBalance);

  useEffect(() => {
    if (!open) return;

    const ids = activeMembers.map((m) => m.id);
    setParticipants(ids);
    setPercentages(
      Object.fromEntries(
        Object.entries(defaultPercentages(ids)).map(([id, v]) => [id, String(v)])
      )
    );
    setCustomText({});
    setSplitStyle('equal');

    // מי שחייב כסף — ברירת המחדל היא קיזוז. זה כמעט תמיד מה שהוא רוצה,
    // וזו גם ההתנהגות שמונעת מחובות ישנים להיתקע לנצח.
    setMode(myDebt > 0 ? 'offset' : 'covered');

    // מילוי המחיר מהקטלוג, כולל מחיר שהחדר עדכן לעצמו
    const product = item?.productId ? getProduct(item.productId) : null;
    if (product) {
      setAmountText((product.price / 100).toFixed(2));
      setPriceFromCatalog(true);
    } else {
      setAmountText('');
      setPriceFromCatalog(false);
    }
    // myDebt מכוון לא ב-deps: הוא נקרא פעם אחת בפתיחה. שינוי שלו באמצע
    // המילוי לא אמור להחליף למשתמש את המצב שכבר בחר.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, activeMembers, item, getProduct]);

  const amount: Agorot = useMemo(() => {
    const n = Number(amountText.replace(',', '.'));
    return Number.isFinite(n) && n > 0 ? toAgorot(n) : 0;
  }, [amountText]);

  const toggleParticipant = (id: string) =>
    setParticipants((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );

  /**
   * מחשב את החלוקה עבור מצב נתון.
   *
   * מקבל את המצב כפרמטר ולא קורא מה-state, כי התצוגה המקדימה צריכה
   * לחשב את **כל** המצבים בו-זמנית — זה מה שמאפשר להראות למשתמש מה
   * יקרה בכל אחד מהם לפני שהוא בוחר.
   */
  const computeFor = useMemo(
    () =>
      (m: Mode): { shares: Record<string, Agorot>; error: string | null } => {
        if (!user || amount <= 0) return { shares: {}, error: null };

        // ‼️ "על עצמי" חייב לצאת כאן. בלי הענף הזה הקוד נפל לחישוב
        // החלוקה הידנית, כל החלקים יצאו 0, ונוצרה שגיאת "נותר לחלק"
        // שנעלה את כפתור השמירה.
        if (m === 'covered') return { shares: { [user.uid]: amount }, error: null };

        if (participants.length === 0) return { shares: {}, error: 'בחרו לפחות משתתף אחד' };

        try {
          if (m === 'offset') {
            const ids = participants.includes(user.uid)
              ? participants
              : [...participants, user.uid];
            return { shares: splitWithDebtOffset(amount, user.uid, ids, myDebt), error: null };
          }

          if (splitStyle === 'equal') {
            return { shares: splitEqual(amount, participants), error: null };
          }

          if (splitStyle === 'percentage') {
            const pct = Object.fromEntries(
              participants.map((id) => [id, Number(percentages[id] ?? 0)])
            );
            return { shares: splitPercentage(amount, pct), error: null };
          }

          const custom = Object.fromEntries(
            participants.map((id) => [id, toAgorot(Number(customText[id] ?? 0))])
          );
          const sum = Object.values(custom).reduce((a, b) => a + b, 0);
          if (sum !== amount) {
            const diff = amount - sum;
            return {
              shares: custom,
              error:
                diff > 0 ? `נותר לחלק ${formatILS(diff)}` : `חולק ${formatILS(-diff)} יותר מדי`,
            };
          }
          return { shares: custom, error: null };
        } catch (err) {
          return { shares: {}, error: (err as Error).message };
        }
      },
    [user, amount, participants, splitStyle, percentages, customText, myDebt]
  );

  const { shares, error: splitError } = useMemo(() => computeFor(mode), [computeFor, mode]);

  /** בכמה המאזן שלי ישתנה במצב נתון — הלב של התצוגה המקדימה */
  const deltaFor = (m: Mode): Agorot => {
    if (!user || amount <= 0) return 0;
    const res = computeFor(m);
    if (res.error) return 0;
    return amount - (res.shares[user.uid] ?? 0);
  };

  const canSubmit =
    amount > 0 && !splitError && !busy && (mode === 'covered' || participants.length > 0);

  async function submit() {
    if (!user || !profile || !roomCode) return;

    const splitMethod: SplitMethod =
      mode === 'covered' ? 'covered' : mode === 'offset' ? 'offset' : splitStyle;

    setBusy(true);
    const res = await toast.run(() =>
      createPurchase(roomCode, user.uid, profile.displayName, {
        itemId: item?.id ?? null,
        title: item?.name ?? 'קנייה',
        amount,
        splitMethod,
        splitBetween:
          mode === 'offset' && !participants.includes(user.uid)
            ? [...participants, user.uid]
            : participants,
        percentages:
          mode === 'split' && splitStyle === 'percentage'
            ? Object.fromEntries(participants.map((id) => [id, Number(percentages[id] ?? 0)]))
            : undefined,
        customShares: mode === 'split' && splitStyle === 'custom' ? shares : undefined,
        buyerDebt: myDebt,
        buyerId: user.uid,
      })
    );
    setBusy(false);
    if (res !== null) {
      toast.success('הקנייה נרשמה וממתינה לאישור המנהל');
      onClose();
    }
  }

  const offsetCredit = deltaFor('offset');

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={item ? `קניתי: ${item.name}` : 'רישום קנייה'}
      footer={
        <Button size="lg" fullWidth loading={busy} disabled={!canSubmit} onClick={submit}>
          {amount > 0
            ? `${mode === 'covered' ? 'רשום על חשבוני' : 'שמור קנייה'} · ${formatILS(amount)}`
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
          onChange={(e) => {
            setAmountText(e.target.value);
            setPriceFromCatalog(false);
          }}
          onFocus={(e) => e.currentTarget.select()}
          suffix="₪"
          hint={
            priceFromCatalog ? 'מולא לפי המחיר בקטלוג של החדר — שנו אם שילמתם אחרת' : undefined
          }
          autoFocus
          required
        />

        {/* ── בחירת מצב, עם ההשפעה על המאזן ── */}
        <fieldset>
          <legend className="mb-2 block text-sm font-medium text-ink-700">איך לרשום?</legend>
          <div className={`grid gap-2 ${myDebt > 0 ? 'grid-cols-3' : 'grid-cols-2'}`}>
            <ModeCard
              active={mode === 'covered'}
              onClick={() => setMode('covered')}
              emoji="🙋"
              title="על עצמי"
              body="אף אחד לא מחויב"
              delta={0}
              balance={myBalance}
              show={amount > 0}
            />

            {myDebt > 0 && (
              <ModeCard
                active={mode === 'offset'}
                onClick={() => setMode('offset')}
                emoji="⚖️"
                title="קיזוז מהחוב"
                body="השאר על חשבונך"
                delta={offsetCredit}
                balance={myBalance}
                show={amount > 0}
              />
            )}

            <ModeCard
              active={mode === 'split'}
              onClick={() => setMode('split')}
              emoji="👥"
              title="לחלק"
              body="כל אחד את חלקו"
              delta={deltaFor('split')}
              balance={myBalance}
              show={amount > 0}
            />
          </div>
        </fieldset>

        {mode === 'covered' && (
          <p className="rounded-xl bg-emerald-50 px-3.5 py-3 text-sm leading-relaxed text-emerald-900">
            💚 הקנייה תירשם על שמך ותופיע לכולם, אבל <b>המאזנים לא ישתנו</b>. ככה מתגלגלים
            בלי התחשבנות על כל דבר קטן.
          </p>
        )}

        {mode === 'offset' && amount > 0 && (
          <div className="rounded-xl bg-brand-50 px-3.5 py-3 text-sm leading-relaxed text-brand-900">
            ⚖️ החוב שלך יקטן ב־<span className="num font-bold">{formatILS(offsetCredit)}</span>
            {amount - offsetCredit > 0 && (
              <>
                , ואת השאר (<span className="num">{formatILS(amount - offsetCredit)}</span>) אתה
                סופג
              </>
            )}
            .
            <span className="mt-1 block text-xs opacity-80">
              השותפים לא מחויבים ביותר ממה שהיו משלמים בחלוקה רגילה — רק בפחות.
            </span>
          </div>
        )}

        {/* ── שיטת חלוקה — רק בחלוקה מלאה ── */}
        {mode === 'split' && (
          <fieldset>
            <legend className="mb-2 block text-sm font-medium text-ink-700">שיטת החלוקה</legend>
            <div className="grid grid-cols-3 gap-2">
              {SPLIT_STYLES.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setSplitStyle(m)}
                  aria-pressed={splitStyle === m}
                  className={[
                    'tap rounded-xl border px-2 text-xs font-semibold transition active:scale-[.98]',
                    splitStyle === m
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

        {/* ── משתתפים ── */}
        {mode !== 'covered' && (
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

                      {on && mode === 'split' && splitStyle === 'percentage' && (
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

                      {on && mode === 'split' && splitStyle === 'custom' && (
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

                      {on && amount > 0 && (mode === 'offset' || splitStyle === 'equal') && (
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

        {/* סיכום חי — מונע חלוקה שלא מסתכמת */}
        {amount > 0 && mode !== 'covered' && (
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
          {mode === 'covered'
            ? 'הקנייה תישלח לאישור מנהל החדר ותופיע בסיכום התרומות.'
            : 'הקנייה תישלח לאישור מנהל החדר. המאזנים יתעדכנו רק לאחר האישור.'}
        </p>
      </div>
    </Sheet>
  );
}

/* ═══════════════ כרטיס מצב ═══════════════ */

/**
 * מציג לא רק את שם המצב אלא את **התוצאה שלו** על המאזן.
 *
 * בלי זה המשתמש צריך לחשב בעצמו מה עדיף — וזה בדיוק מה שאף אחד לא
 * עושה בפועל, ולכן חובות נתקעים במקום.
 */
function ModeCard({
  active,
  onClick,
  emoji,
  title,
  body,
  delta,
  balance,
  show,
}: {
  active: boolean;
  onClick: () => void;
  emoji: string;
  title: string;
  body: string;
  delta: Agorot;
  balance: Agorot;
  show: boolean;
}) {
  const after = balance + delta;

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={[
        'rounded-xl border p-2.5 text-start transition active:scale-[.98]',
        active
          ? 'border-brand-500 bg-brand-50 ring-1 ring-brand-500/30'
          : 'border-ink-200 bg-white',
      ].join(' ')}
    >
      <span aria-hidden className="block text-lg">
        {emoji}
      </span>
      <span
        className={`mt-0.5 block text-[13px] font-bold ${
          active ? 'text-brand-900' : 'text-ink-700'
        }`}
      >
        {title}
      </span>
      <span className="mt-0.5 block text-[10px] leading-snug text-ink-500">{body}</span>

      {show && (
        <span className="num mt-1.5 block border-t border-ink-100 pt-1.5 text-[11px] leading-tight">
          {delta === 0 ? (
            <span className="text-ink-400">ללא שינוי</span>
          ) : (
            <>
              <span className="text-ink-400">{formatILS(balance)}</span>
              <span className="mx-0.5 text-ink-300">←</span>
              <span
                className={
                  after >= 0 ? 'font-bold text-emerald-700' : 'font-bold text-rose-700'
                }
              >
                {formatILS(after)}
              </span>
            </>
          )}
        </span>
      )}
    </button>
  );
}
