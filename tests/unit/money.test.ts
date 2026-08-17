import { describe, expect, it } from 'vitest';
import {
  computeBalances,
  simplifyDebts,
  splitEqual,
  splitPercentage,
  validateCustomSplit,
} from '../../src/lib/money';
import { toAgorot } from '../../src/lib/format';
import type { Purchase, Settlement } from '../../src/types/models';

/* ═══════════════════ חלוקה שווה ═══════════════════ */

describe('splitEqual', () => {
  it('משמר את הסכום המדויק כשהחלוקה לא עגולה', () => {
    // ₪20 בין 3 אנשים — המקרה מהמפרט
    const shares = splitEqual(2000, ['a', 'b', 'c']);
    expect(Object.values(shares).reduce((x, y) => x + y, 0)).toBe(2000);
    expect(Object.values(shares).sort()).toEqual([666, 667, 667]);
  });

  it('דטרמיניסטי — סדר הקלט לא משנה את התוצאה', () => {
    expect(splitEqual(2000, ['c', 'a', 'b'])).toEqual(splitEqual(2000, ['a', 'b', 'c']));
  });

  it('משתתף יחיד מקבל את הכל', () => {
    expect(splitEqual(1234, ['a'])).toEqual({ a: 1234 });
  });

  it('מסנן כפילויות במזהים', () => {
    expect(splitEqual(1000, ['a', 'a', 'b'])).toEqual({ a: 500, b: 500 });
  });

  it('זורק על אפס משתתפים', () => {
    expect(() => splitEqual(1000, [])).toThrow();
  });

  it('סכום החלקים תמיד שווה למקור — 1000 מקרים אקראיים', () => {
    for (let i = 0; i < 1000; i++) {
      const total = Math.floor(Math.random() * 100_000) + 1;
      const n = Math.floor(Math.random() * 8) + 1;
      const ids = Array.from({ length: n }, (_, k) => `u${k}`);
      const sum = Object.values(splitEqual(total, ids)).reduce((x, y) => x + y, 0);
      expect(sum).toBe(total);
    }
  });
});

/* ═══════════════════ חלוקה באחוזים ═══════════════════ */

describe('splitPercentage', () => {
  it('מחלק לפי אחוזים ומשמר את הסכום', () => {
    const shares = splitPercentage(10_000, { a: 50, b: 30, c: 20 });
    expect(shares).toEqual({ a: 5000, b: 3000, c: 2000 });
    expect(Object.values(shares).reduce((x, y) => x + y, 0)).toBe(10_000);
  });

  it('האחרון סופג את שגיאת העיגול', () => {
    const shares = splitPercentage(1000, { a: 33.33, b: 33.33, c: 33.34 });
    expect(Object.values(shares).reduce((x, y) => x + y, 0)).toBe(1000);
  });

  it('זורק כשהאחוזים לא מסתכמים ל-100', () => {
    expect(() => splitPercentage(1000, { a: 50, b: 30 })).toThrow(/100/);
  });
});

/* ═══════════════════ המרת כסף ═══════════════════ */

describe('toAgorot', () => {
  it.each([
    [12.34, 1234],
    [0.01, 1],
    [100, 10_000],
    [0.1 + 0.2, 30], // 0.30000000000000004 ב-float
  ])('₪%s → %s אגורות', (shekels, agorot) => {
    expect(toAgorot(shekels)).toBe(agorot);
  });
});

/* ═══════════════════ חלוקה מותאמת ═══════════════════ */

describe('validateCustomSplit', () => {
  it('מזהה חלוקה חסרה ומחזיר את היתרה', () => {
    expect(validateCustomSplit(2500, { a: 1000, b: 1000 })).toEqual({
      valid: false,
      remaining: 500,
    });
  });

  it('מאשר חלוקה מדויקת', () => {
    expect(validateCustomSplit(2000, { a: 1200, b: 800 })).toEqual({
      valid: true,
      remaining: 0,
    });
  });
});

/* ═══════════════════ מאזנים ═══════════════════ */

function purchase(over: Partial<Purchase>): Purchase {
  return {
    itemId: null,
    title: 'קנייה',
    boughtBy: 'a',
    amount: 2000,
    date: 1,
    createdAt: 1,
    splitMethod: 'equal',
    splitBetween: { a: true, b: true },
    shares: { a: 1000, b: 1000 },
    receipt: null,
    status: 'approved',
    approvedBy: 'admin',
    ...over,
  };
}

describe('computeBalances', () => {
  it('הקונה מזוכה והצרכנים מחויבים', () => {
    expect(computeBalances([purchase({})], [], ['a', 'b'])).toEqual({ a: 1000, b: -1000 });
  });

  it('קניות ממתינות אינן משפיעות על המאזן', () => {
    expect(computeBalances([purchase({ status: 'pending' })], [], ['a', 'b'])).toEqual({
      a: 0,
      b: 0,
    });
  });

  it('קניות שנדחו אינן משפיעות', () => {
    expect(computeBalances([purchase({ status: 'rejected' })], [], ['a', 'b'])).toEqual({
      a: 0,
      b: 0,
    });
  });

  it('אישור כפול לא מכפיל את החוב — המאזן נגזר ולא מצטבר', () => {
    const once = computeBalances([purchase({})], [], ['a', 'b']);
    const twice = computeBalances([purchase({})], [], ['a', 'b']);
    expect(once).toEqual(twice);
  });

  it('סגירת חשבון מאפסת את החוב', () => {
    const settlement: Settlement = { from: 'b', to: 'a', amount: 1000, date: 2, confirmedBy: null };
    expect(computeBalances([purchase({})], [settlement], ['a', 'b'])).toEqual({ a: 0, b: 0 });
  });

  it('קנייה אישית (הקונה לבדו) לא משפיעה על אף אחד', () => {
    const personal = purchase({ splitBetween: { a: true }, shares: { a: 2000 } });
    expect(computeBalances([personal], [], ['a', 'b'])).toEqual({ a: 0, b: 0 });
  });

  /**
   * 🔴 הבדיקה החשובה ביותר בפרויקט.
   * אם היא נכשלת — יש באג בכסף, ולא משנה מה שאר הבדיקות אומרות.
   */
  it('סכום כל המאזנים בחדר הוא תמיד אפס', () => {
    const ids = ['a', 'b', 'c', 'd'];
    const purchases: Purchase[] = [];
    const settlements: Settlement[] = [];

    for (let i = 0; i < 500; i++) {
      const amount = Math.floor(Math.random() * 50_000) + 1;
      const n = Math.floor(Math.random() * 4) + 1;
      const participants = [...ids].sort(() => Math.random() - 0.5).slice(0, n);
      purchases.push(
        purchase({
          boughtBy: ids[Math.floor(Math.random() * ids.length)],
          amount,
          splitBetween: Object.fromEntries(participants.map((p) => [p, true as const])),
          shares: splitEqual(amount, participants),
          status: Math.random() > 0.2 ? 'approved' : 'pending',
        })
      );
    }

    for (let i = 0; i < 50; i++) {
      const [from, to] = [...ids].sort(() => Math.random() - 0.5);
      settlements.push({
        from,
        to,
        amount: Math.floor(Math.random() * 10_000) + 1,
        date: i,
        confirmedBy: null,
      });
    }

    const balances = computeBalances(purchases, settlements, ids);
    expect(Object.values(balances).reduce((x, y) => x + y, 0)).toBe(0);
  });
});

/* ═══════════════════ מזעור העברות ═══════════════════ */

describe('simplifyDebts', () => {
  it('מצמצם מעגל חובות להעברות מינימליות', () => {
    // a חייב 30, b מגיע לו 10, c מגיע לו 20
    const transfers = simplifyDebts({ a: -3000, b: 1000, c: 2000 });
    expect(transfers).toHaveLength(2);
    expect(transfers.every((t) => t.from === 'a')).toBe(true);
    expect(transfers.reduce((s, t) => s + t.amount, 0)).toBe(3000);
  });

  it('מאזן מאופס לא מייצר העברות', () => {
    expect(simplifyDebts({ a: 0, b: 0 })).toEqual([]);
  });

  it('ההעברות מאפסות את כל המאזנים', () => {
    const balances = { a: -5000, b: -1500, c: 4000, d: 2500 };
    const after = { ...balances };
    for (const t of simplifyDebts(balances)) {
      after[t.from as keyof typeof after] += t.amount;
      after[t.to as keyof typeof after] -= t.amount;
    }
    expect(Object.values(after).every((v) => v === 0)).toBe(true);
  });
});
