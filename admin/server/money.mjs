/**
 * מנוע כספים לצד השרת — עותק מדויק של הסמנטיקה ב-src/lib/money.ts.
 *
 * ‼️ מכוון שזה עותק ולא ייבוא: הקונסולה היא כלי *ניטור*. אם מחר תשתנה
 *    שיטת החישוב באפליקציה, אני רוצה שהקונסולה תמשיך לחשב לפי הכלל
 *    שאני מכיר — ושהפער יתגלה, במקום שיוסתר על ידי שימוש חוזר בקוד.
 *    ראו admin/README.md, סעיף "למה יש כאן עותק של money".
 */

export function computeBalances(purchases, settlements, memberIds) {
  const balances = Object.fromEntries(memberIds.map((id) => [id, 0]));
  for (const p of purchases) {
    if (p.status !== 'approved' && p.status !== 'settled') continue;
    balances[p.boughtBy] = (balances[p.boughtBy] ?? 0) + p.amount;
    for (const [uid, share] of Object.entries(p.shares ?? {})) {
      balances[uid] = (balances[uid] ?? 0) - share;
    }
  }
  for (const s of settlements) {
    if (!s.confirmedBy) continue;
    balances[s.from] = (balances[s.from] ?? 0) + s.amount;
    balances[s.to] = (balances[s.to] ?? 0) - s.amount;
  }
  return balances;
}

export function computeContributions(purchases, memberIds) {
  const borne = Object.fromEntries(memberIds.map((id) => [id, 0]));
  const paidOut = Object.fromEntries(memberIds.map((id) => [id, 0]));
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

/** הפער בין הזכאי הגדול ביותר לחייב הגדול ביותר, באגורות. */
export function balanceSpread(balances) {
  const values = Object.values(balances);
  if (values.length === 0) return 0;
  return Math.max(...values) - Math.min(...values);
}

export const agorot = {
  toShekels: (a) => (a ?? 0) / 100,
  format: (a) => `₪${((a ?? 0) / 100).toLocaleString('he-IL', { maximumFractionDigits: 2 })}`,
};
