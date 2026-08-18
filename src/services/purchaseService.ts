import { push, ref, runTransaction, serverTimestamp, update } from 'firebase/database';
import { db } from '../config/firebase';
import { assertOnline } from './guard';
import { splitEqual, splitPercentage } from '../lib/money';
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

  if (!Number.isInteger(draft.amount) || draft.amount <= 0) {
    throw new Error('הסכום חייב להיות חיובי');
  }
  // ב"לקחתי על עצמי" המשתתף היחיד הוא הקונה, תמיד
  const participants = draft.splitMethod === 'covered' ? [userId] : draft.splitBetween;
  if (participants.length === 0) {
    throw new Error('בחרו לפחות משתתף אחד');
  }

  const shares = computeShares({ ...draft, splitBetween: participants });
  const purchaseId = push(ref(db, `rooms/${code}/purchases`)).key!;
  const notifId = push(ref(db, `rooms/${code}/notifications`)).key!;

  const updates: Record<string, unknown> = {
    [`rooms/${code}/purchases/${purchaseId}`]: {
      itemId: draft.itemId,
      title: draft.title.trim(),
      boughtBy: userId,
      amount: draft.amount,
      date: serverTimestamp(),
      createdAt: serverTimestamp(),
      splitMethod: draft.splitMethod,
      splitBetween: Object.fromEntries(participants.map((id) => [id, true])),
      shares,
      receipt: null,
      status: 'pending',
      approvedBy: null,
      ...(draft.note ? { note: draft.note.trim() } : {}),
    },
    [`rooms/${code}/notifications/${notifId}`]: {
      type: 'purchase_made',
      actorId: userId,
      actorName: userName,
      text:
        draft.splitMethod === 'covered'
          ? `${userName} קנה ${draft.title.trim()} ב-${formatILS(draft.amount)} — על חשבונו`
          : `${userName} קנה ${draft.title.trim()} ב-${formatILS(draft.amount)}`,
      entityId: purchaseId,
      createdAt: serverTimestamp(),
      readBy: { [userId]: true },
    },
  };

  // אם הקנייה קשורה למוצר — מקדמים גם אותו, באותה פעולה אטומית
  if (draft.itemId) {
    updates[`rooms/${code}/items/${draft.itemId}/status`] = 'bought';
    updates[`rooms/${code}/items/${draft.itemId}/purchaseId`] = purchaseId;
  }

  await update(ref(db), updates);
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
}

export async function rejectPurchase(
  code: string,
  adminId: string,
  adminName: string,
  purchaseId: string,
  reason?: string
): Promise<void> {
  assertOnline('לדחות קנייה');

  const notifId = push(ref(db, `rooms/${code}/notifications`)).key!;

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
}

/** רישום תשלום שסוגר חוב בין שני חברים. */
export async function createSettlement(
  code: string,
  from: string,
  to: string,
  amount: Agorot
): Promise<void> {
  assertOnline('לרשום תשלום');
  if (!Number.isInteger(amount) || amount <= 0) throw new Error('הסכום חייב להיות חיובי');

  const id = push(ref(db, `rooms/${code}/settlements`)).key!;
  await update(ref(db), {
    [`rooms/${code}/settlements/${id}`]: {
      from,
      to,
      amount,
      date: serverTimestamp(),
      confirmedBy: null,
    },
  });
}
