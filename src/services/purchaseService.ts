import { get, push, ref, runTransaction, serverTimestamp, update } from 'firebase/database';
import { db } from '../config/firebase';
import { assertOnline, assertRoomWritable } from './guard';
import { enqueueNotification } from './outboxService';
import { splitEqual, splitPercentage, splitWithDebtOffset } from '../lib/money';
import { formatILS } from '../lib/format';
import type { Agorot, Purchase, SplitMethod } from '../types/models';

export interface PurchaseDraft {
  itemId: string | null;
  title: string;
  amount: Agorot;
  splitMethod: SplitMethod;
  splitBetween: string[];
  /** נדרש ל-percentage */
  percentages?: Record<string, number>;
  /** נדרש ל-custom */
  customShares?: Record<string, Agorot>;
  /** נדרש ל-offset: כמה הקונה חייב כרגע, כמספר חיובי */
  buyerDebt?: Agorot;
  /** נדרש ל-offset: מזהה הקונה */
  buyerId?: string;
  note?: string;
}

/** מחשב את חלוקת החוב לפי שיטת החלוקה שנבחרה. */
export function computeShares(draft: PurchaseDraft): Record<string, Agorot> {
  switch (draft.splitMethod) {
    /**
     * "לקחתי על עצמי" — כל הסכום נזקף לקונה.
     *
     * מבחינת המאזן זה מתקזז לאפס מעצמו: הקונה מזוכה על ההוצאה ומחויב
     * על אותו סכום. לכן אין צורך בשום טיפול מיוחד ב-computeBalances —
     * הקנייה פשוט לא מזיזה כלום, אבל כן נרשמת ונראית לכולם.
     */
    case 'covered':
      return { [draft.splitBetween[0]]: draft.amount };

    /**
     * קיזוז מהחוב — הזיכוי לקונה חסום בגובה החוב שלו.
     * ראו splitWithDebtOffset ב-lib/money.ts.
     */
    case 'offset': {
      const buyerId = draft.buyerId ?? draft.splitBetween[0];
      return splitWithDebtOffset(
        draft.amount,
        buyerId,
        draft.splitBetween,
        draft.buyerDebt ?? 0
      );
    }

    case 'equal':
      return splitEqual(draft.amount, draft.splitBetween);

    case 'percentage':
      if (!draft.percentages) throw new Error('חסרים אחוזי החלוקה');
      return splitPercentage(draft.amount, draft.percentages);

    case 'custom': {
      if (!draft.customShares) throw new Error('חסרה חלוקה מותאמת');
      const sum = Object.values(draft.customShares).reduce((a, b) => a + b, 0);
      if (sum !== draft.amount) {
        throw new Error(
          `החלוקה לא מסתכמת לסכום הקנייה. נותר לחלק ${formatILS(draft.amount - sum)}`
        );
      }
      return draft.customShares;
    }
  }
}

export async function createPurchase(
  code: string,
  userId: string,
  userName: string,
  draft: PurchaseDraft
): Promise<string> {
  assertOnline('לרשום קנייה');
  assertRoomWritable(code, 'לרשום קנייה');

  if (!Number.isInteger(draft.amount) || draft.amount <= 0) {
    throw new Error('הסכום חייב להיות חיובי');
  }
  // ב"לקחתי על עצמי" המשתתף היחיד הוא הקונה, תמיד
  const participants = draft.splitMethod === 'covered' ? [userId] : draft.splitBetween;
  if (participants.length === 0) {
    throw new Error('בחרו לפחות משתתף אחד');
  }

  const shares = computeShares({ ...draft, splitBetween: participants, buyerId: userId });
  const purchaseId = push(ref(db, `rooms/${code}/purchases`)).key!;
  const notifId = push(ref(db, `rooms/${code}/notifications`)).key!;

  const title = draft.title.trim();

  const updates: Record<string, unknown> = {
    /**
     * ‼️ קניות לא דורשות אישור מנהל.
     *
     * הן נכנסות ישר כ-'approved', והקונה הוא "המאשר" של עצמו. מנגנון
     * האישור (approvePurchase/rejectPurchase, טאב "ממתינות") נשאר בקוד
     * ובחוקי האבטחה בכוונה — יופעל מחדש כאפשרות הגדרה למנהל, לא נמחק.
     */
    [`rooms/${code}/purchases/${purchaseId}`]: {
      itemId: draft.itemId,
      title,
      boughtBy: userId,
      amount: draft.amount,
      date: serverTimestamp(),
      createdAt: serverTimestamp(),
      splitMethod: draft.splitMethod,
      splitBetween: Object.fromEntries(participants.map((id) => [id, true])),
      shares,
      receipt: null,
      status: 'approved',
      approvedBy: userId,
      ...(draft.note ? { note: draft.note.trim() } : {}),
    },
    [`rooms/${code}/notifications/${notifId}`]: {
      type: 'purchase_made',
      actorId: userId,
      actorName: userName,
      text:
        draft.splitMethod === 'covered'
          ? `${userName} קנה ${title} ב-${formatILS(draft.amount)} — על חשבונו`
          : draft.splitMethod === 'offset'
            ? `${userName} קנה ${title} ב-${formatILS(draft.amount)} — בקיזוז מהחוב`
            : `${userName} קנה ${title} ב-${formatILS(draft.amount)}`,
      entityId: purchaseId,
      createdAt: serverTimestamp(),
      readBy: { [userId]: true },
    },
  };

  // אם הקנייה קשורה למוצר — מסתיים ישר, אין שלב ביניים של "ממתין לאישור"
  if (draft.itemId) {
    updates[`rooms/${code}/items/${draft.itemId}/status`] = 'done';
    updates[`rooms/${code}/items/${draft.itemId}/purchaseId`] = purchaseId;
  }

  await update(ref(db), updates);

  void enqueueNotification({
    roomCode: code,
    title: 'קנייה חדשה בחדר',
    body: `${userName} קנה ${title} ב-${formatILS(draft.amount)}`,
    url: `/r/${code}/balances`,
    tag: 'purchases',
    priority: 'digest',
    audience: 'room',
    actorUid: userId,
  });

  return purchaseId;
}

/**
 * אישור קנייה ע"י המנהל.
 *
 * runTransaction מונע אישור כפול (לחיצה כפולה / שני מכשירים).
 * ההגנה השנייה: המאזנים נגזרים מהיומן ולא מצטברים, ולכן גם אישור
 * שנרשם פעמיים לא מכפיל את החוב.
 */
export async function approvePurchase(
  code: string,
  adminId: string,
  adminName: string,
  purchaseId: string
): Promise<void> {
  assertOnline('לאשר קנייה');
  assertRoomWritable(code, 'לאשר קנייה');

  const pRef = ref(db, `rooms/${code}/purchases/${purchaseId}`);
  const result = await runTransaction(pRef, (p: Purchase | null) => {
    if (!p) return;
    if (p.status !== 'pending') return; // כבר טופל
    return { ...p, status: 'approved', approvedBy: adminId };
  });

  if (!result.committed) throw new Error('הקנייה כבר טופלה');

  const purchase = result.snapshot.val() as Purchase;
  const notifId = push(ref(db, `rooms/${code}/notifications`)).key!;
  const updates: Record<string, unknown> = {
    [`rooms/${code}/notifications/${notifId}`]: {
      type: 'purchase_approved',
      actorId: adminId,
      actorName: adminName,
      text: `הקנייה "${purchase.title}" אושרה — ${formatILS(purchase.amount)}`,
      entityId: purchaseId,
      createdAt: serverTimestamp(),
      readBy: { [adminId]: true },
    },
  };

  if (purchase.itemId) {
    updates[`rooms/${code}/items/${purchase.itemId}/status`] = 'done';
  }

  await update(ref(db), updates);

  // הקונה ממתין לתשובה — זו הפרעה שהוא רוצה לקבל
  void enqueueNotification({
    roomCode: code,
    title: 'הקנייה שלך אושרה',
    body: `${purchase.title} — ${formatILS(purchase.amount)}`,
    url: `/r/${code}/balances`,
    tag: `purchase-${purchaseId}`,
    priority: 'now',
    audience: 'user',
    targetUid: purchase.boughtBy,
    actorUid: adminId,
  });
}

export async function rejectPurchase(
  code: string,
  adminId: string,
  adminName: string,
  purchaseId: string,
  reason?: string
): Promise<void> {
  assertOnline('לדחות קנייה');
  assertRoomWritable(code, 'לדחות קנייה');

  const notifId = push(ref(db, `rooms/${code}/notifications`)).key!;

  const buyerSnap = await get(ref(db, `rooms/${code}/purchases/${purchaseId}/boughtBy`));

  await update(ref(db), {
    [`rooms/${code}/purchases/${purchaseId}/status`]: 'rejected',
    ...(reason ? { [`rooms/${code}/purchases/${purchaseId}/note`]: reason.trim() } : {}),
    [`rooms/${code}/notifications/${notifId}`]: {
      type: 'purchase_rejected',
      actorId: adminId,
      actorName: adminName,
      text: reason ? `קנייה נדחתה: ${reason.trim()}` : 'קנייה נדחתה על ידי מנהל החדר',
      entityId: purchaseId,
      createdAt: serverTimestamp(),
      readBy: { [adminId]: true },
    },
  });

  if (buyerSnap.exists()) {
    void enqueueNotification({
      roomCode: code,
      title: 'הקנייה שלך נדחתה',
      body: reason?.trim() || 'פנו למנהל החדר לפרטים',
      url: `/r/${code}/balances`,
      tag: `purchase-${purchaseId}`,
      priority: 'now',
      audience: 'user',
      targetUid: String(buyerSnap.val()),
      actorUid: adminId,
    });
  }
}

/**
 * רישום תשלום — טענה של המשלם, לא עובדה מאושרת.
 *
 * ‼️ החוב לא נסגר כאן. computeBalances מתעלם מתשלום עד ש-confirmSettlement
 * נקרא ע"י מי שהיה אמור לקבל את הכסף. ראו lib/money.ts. בלי זה, כל אחד
 * יכול היה "לסגור" חוב שהוא לא באמת שילם.
 */
export async function createSettlement(
  code: string,
  from: string,
  fromName: string,
  to: string,
  amount: Agorot
): Promise<void> {
  assertOnline('לרשום תשלום');
  assertRoomWritable(code, 'לרשום תשלום');
  if (!Number.isInteger(amount) || amount <= 0) throw new Error('הסכום חייב להיות חיובי');

  const id = push(ref(db, `rooms/${code}/settlements`)).key!;
  const notifId = push(ref(db, `rooms/${code}/notifications`)).key!;

  await update(ref(db), {
    [`rooms/${code}/settlements/${id}`]: {
      from,
      to,
      amount,
      date: serverTimestamp(),
      confirmedBy: null,
    },
    [`rooms/${code}/notifications/${notifId}`]: {
      type: 'settlement',
      actorId: from,
      actorName: fromName,
      text: `${fromName} מסמן/ת שהעביר/ה לך ${formatILS(amount)} — ממתין לאישורך`,
      entityId: id,
      createdAt: serverTimestamp(),
      readBy: { [from]: true },
    },
  });

  // הצד שמגיע לו כסף חייב לאשר קבלה — בלי זה החוב לא נסגר, וזו בדיוק
  // ההפרעה שהוא רוצה לקבל מיד
  void enqueueNotification({
    roomCode: code,
    title: 'מישהו סימן שהעביר לך תשלום',
    body: `${fromName} — ${formatILS(amount)}. אשרו שקיבלתם כדי לסגור את החוב.`,
    url: `/r/${code}/balances`,
    tag: `settlement-${id}`,
    priority: 'now',
    audience: 'user',
    targetUid: to,
    actorUid: from,
  });
}

/**
 * אישור קבלת תשלום ע"י מי שהיה אמור לקבל את הכסף.
 *
 * זה הרגע שבו החוב באמת נסגר — ראו computeBalances. רק `to` יכול לקרוא
 * לפונקציה הזו בהצלחה; חוקי ה-DB אוכפים את זה גם ברמת השרת.
 */
export async function confirmSettlement(
  code: string,
  settlementId: string,
  confirmerId: string,
  confirmerName: string,
  payerId: string,
  amount: Agorot
): Promise<void> {
  assertOnline('לאשר קבלת תשלום');
  assertRoomWritable(code, 'לאשר קבלת תשלום');

  const notifId = push(ref(db, `rooms/${code}/notifications`)).key!;

  await update(ref(db), {
    [`rooms/${code}/settlements/${settlementId}/confirmedBy`]: confirmerId,
    [`rooms/${code}/notifications/${notifId}`]: {
      type: 'settlement',
      actorId: confirmerId,
      actorName: confirmerName,
      text: `${confirmerName} אישר/ה קבלת ${formatILS(amount)} — החוב נסגר`,
      entityId: settlementId,
      createdAt: serverTimestamp(),
      readBy: { [confirmerId]: true },
    },
  });

  void enqueueNotification({
    roomCode: code,
    title: 'התשלום שלך אושר',
    body: `${confirmerName} אישר/ה שקיבל/ה ${formatILS(amount)}`,
    url: `/r/${code}/balances`,
    tag: `settlement-confirm-${settlementId}`,
    priority: 'now',
    audience: 'user',
    targetUid: payerId,
    actorUid: confirmerId,
  });
}
