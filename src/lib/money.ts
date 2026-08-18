import type { Agorot, Purchase, Settlement } from '../types/models';

/**
 * ═══════════════════════════════════════════════════════════════
 *  מנוע הכספים
 * ═══════════════════════════════════════════════════════════════
 *  כלל ברזל: כל הסכומים כאן הם **מספרים שלמים באגורות**.
 *
 *  ❌  20 / 3 = 6.6666… → 6.67 → 6.67 × 3 = 20.01 ₪  (נוצרה אגורה יש מאין)
 *  ✅  2000 / 3 = 666 שארית 2 → 667, 667, 666 → 2000 בדיוק. תמיד.
 * ═══════════════════════════════════════════════════════════════
 */

/**
 * מחלק סכום שווה בשווה, כך שסכום החלקים תמיד שווה בדיוק לסכום המקורי.
 *
 * השארית מחולקת לפי סדר לקסיקוגרפי של המזהים — כך התוצאה **זהה בכל
 * מכשיר**. בלי המיון, שני מכשירים שמחשבים את אותה חלוקה עלולים לתת את
 * האגורה העודפת לאנשים שונים, והמאזנים ייבדלו באגורה בלי הסבר.
 */
export function splitEqual(total: Agorot, userIds: string[]): Record<string, Agorot> {
  if (userIds.length === 0) throw new Error('אין משתתפים בחלוקה');

  const ids = [...new Set(userIds)].sort();
  const base = Math.floor(total / ids.length);
  let remainder = total - base * ids.length;

  const shares: Record<string, Agorot> = {};
  for (const id of ids) {
    shares[id] = base + (remainder-- > 0 ? 1 : 0);
  }
  return shares;
}

/** חלוקה לפי אחוזים. האחרון סופג את שגיאת העיגול. */
export function splitPercentage(
  total: Agorot,
  percentages: Record<string, number>
): Record<string, Agorot> {
  const ids = Object.keys(percentages).sort();
  if (ids.length === 0) throw new Error('אין משתתפים בחלוקה');

  const sum = ids.reduce((a, id) => a + percentages[id], 0);
  if (Math.abs(sum - 100) > 0.01) {
    throw new Error(`סכום האחוזים חייב להיות 100, התקבל ${sum.toFixed(1)}`);
  }

  const shares: Record<string, Agorot> = {};
  let allocated = 0;

  ids.forEach((id, i) => {
    if (i === ids.length - 1) {
      shares[id] = total - allocated;
    } else {
      shares[id] = Math.round((total * percentages[id]) / 100);
      allocated += shares[id];
    }
  });

  return shares;
}

/**
 * אחוזים ברירת-מחדל לחלוקה שווה, שמסתכמים **בדיוק** ל-100.
 *
 * הגישה הנאיבית `(100 / n).toFixed(1)` נשברת ברוב גדלי החדר:
 *   3 אנשים → 33.3 × 3 = 99.9  ❌
 *   6 אנשים → 16.7 × 6 = 100.2 ❌
 *   7 אנשים → 14.3 × 7 = 100.1 ❌
 * ודווקא 3 שותפים הוא גודל החדר הנפוץ ביותר במעונות.
 * לכן האחרון סופג את השארית — בדיוק כמו בשאר מנוע הכספים.
 */
export function defaultPercentages(userIds: string[]): Record<string, number> {
  const ids = [...new Set(userIds)].sort();
  if (ids.length === 0) return {};

  const each = Math.round((100 / ids.length) * 10) / 10;
  const out: Record<string, number> = {};
  let allocated = 0;

  ids.forEach((id, i) => {
    if (i === ids.length - 1) {
      out[id] = Math.round((100 - allocated) * 10) / 10;
    } else {
      out[id] = each;
      allocated += each;
    }
  });

  return out;
}

/** אימות חלוקה מותאמת אישית. */
export function validateCustomSplit(
  total: Agorot,
  shares: Record<string, Agorot>
): { valid: boolean; remaining: Agorot } {
  const sum = Object.values(shares).reduce((a, b) => a + b, 0);
  return { valid: sum === total, remaining: total - sum };
}

/**
 * מחשב את המאזן של כל חבר מתוך יומן הקניות.
 *
 * זהו נתון **נגזר** ולא מצטבר — אפשר לחשב אותו מחדש בכל רגע, ולכן
 * אישור כפול של קנייה לא מכפיל את החוב. ראו docs/06-edge-cases.md.
 *
 * חיובי = מגיע לו כסף · שלילי = הוא חייב
 */
export function computeBalances(
  purchases: Purchase[],
  settlements: Settlement[],
  memberIds: string[]
): Record<string, Agorot> {
  const balances: Record<string, Agorot> = Object.fromEntries(memberIds.map((id) => [id, 0]));

  for (const p of purchases) {
    if (p.status !== 'approved' && p.status !== 'settled') continue;

    balances[p.boughtBy] = (balances[p.boughtBy] ?? 0) + p.amount; // הוציא כסף
    for (const [uid, share] of Object.entries(p.shares ?? {})) {
      balances[uid] = (balances[uid] ?? 0) - share; // צרך
    }
  }

  for (const s of settlements) {
    balances[s.from] = (balances[s.from] ?? 0) + s.amount;
    balances[s.to] = (balances[s.to] ?? 0) - s.amount;
  }

  return balances;
}

/**
 * כמה כל אחד באמת נשא בעלות.
 *
 * זה המדד שהופך את "לקחתי על עצמי" למשהו הוגן ולא לחור שחור: כשאף
 * אחד לא מחויב, המאזן תמיד אפס — ואז אין שום דרך לראות שאחד קונה כל
 * שבוע והשני אף פעם. המספר הזה חושף בדיוק את זה.
 *
 *  borne   — כמה עלות נשא בפועל (סכום החלקים שלו). בקנייה "על עצמי"
 *            זה הסכום המלא; בחלוקה שווה זה החלק שלו.
 *  paidOut — כמה כסף הוציא מהכיס בפועל (סכום הקניות שביצע).
 *
 * בחדר מאוזן, borne דומה בין כולם. פער גדול הוא הסימן שמשהו לא הוגן.
 */
export function computeContributions(
  purchases: Purchase[],
  memberIds: string[]
): { borne: Record<string, Agorot>; paidOut: Record<string, Agorot>; total: Agorot } {
  const borne: Record<string, Agorot> = Object.fromEntries(memberIds.map((id) => [id, 0]));
  const paidOut: Record<string, Agorot> = Object.fromEntries(memberIds.map((id) => [id, 0]));
  let total = 0;

  for (const p of purchases) {
    if (p.status !== 'approved' && p.status !== 'settled') continue;

    total += p.amount;
    paidOut[p.boughtBy] = (paidOut[p.boughtBy] ?? 0) + p.amount;

    for (const [uid, share] of Object.entries(p.shares ?? {})) {
      borne[uid] = (borne[uid] ?? 0) + share;
    }
  }

  return { borne, paidOut, total };
}

export interface Transfer {
  from: string;
  to: string;
  amount: Agorot;
}

/**
 * מזעור מספר ההעברות הנדרשות לאיפוס כל החובות.
 *
 * במקום "דנה חייבת ליוסי ₪12, יוסי לרון ₪12, רון לדנה ₪8" —
 * העברה אחת. זה הפיצ'ר שמשתמשים הכי אוהבים.
 */
export function simplifyDebts(balances: Record<string, Agorot>): Transfer[] {
  const debtors = Object.entries(balances)
    .filter(([, v]) => v < 0)
    .map(([id, v]) => ({ id, amount: -v }))
    .sort((a, b) => b.amount - a.amount || a.id.localeCompare(b.id));

  const creditors = Object.entries(balances)
    .filter(([, v]) => v > 0)
    .map(([id, v]) => ({ id, amount: v }))
    .sort((a, b) => b.amount - a.amount || a.id.localeCompare(b.id));

  const transfers: Transfer[] = [];
  let i = 0;
  let j = 0;

  while (i < debtors.length && j < creditors.length) {
    const amount = Math.min(debtors[i].amount, creditors[j].amount);
    if (amount > 0) {
      transfers.push({ from: debtors[i].id, to: creditors[j].id, amount });
    }
    debtors[i].amount -= amount;
    creditors[j].amount -= amount;
    if (debtors[i].amount === 0) i++;
    if (creditors[j].amount === 0) j++;
  }

  return transfers;
}
