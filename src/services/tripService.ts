import { get, push, ref, runTransaction, serverTimestamp, update } from 'firebase/database';
import { db } from '../config/firebase';
import { assertOnline, assertRoomWritable } from './guard';
import { enqueueNotification } from './outboxService';
import { splitEqual } from '../lib/money';
import { formatILS } from '../lib/format';
import type { Agorot, Category, Trip, TripLine, TripLineState } from '../types/models';

export class TripInProgressError extends Error {
  constructor() {
    super('כבר יש קנייה גדולה פעילה בחדר. סיימו או בטלו אותה קודם.');
    this.name = 'TripInProgressError';
  }
}

export interface TripLineDraft {
  name: string;
  category: Category;
  qty?: number;
  productId?: string | null;
  itemId?: string | null;
}

const tripsPath = (code: string) => `rooms/${code}/trips`;

/**
 * יצירת קנייה גדולה חדשה.
 *
 * תופסת את activeTripId אטומית, בדיוק כמו תפיסת שם חדר ב-roomService —
 * כולל התאוששות מ"יתום": אם הכתיבה הקודמת נכשלה אחרי שהתפיסה כבר
 * הצליחה, או ששחרור הסלוט בסיום קנייה קודמת נכשל, הפונקציה מזהה
 * שהקנייה התפוסה כבר done/cancelled ותופסת מחדש.
 */
export async function createTrip(code: string, userId: string, title: string): Promise<string> {
  assertOnline('להתחיל קנייה גדולה');
  assertRoomWritable(code, 'להתחיל קנייה גדולה');

  const tripId = push(ref(db, tripsPath(code))).key!;
  const activeRef = ref(db, `rooms/${code}/activeTripId`);

  const claim = await runTransaction(activeRef, (current: string | null) =>
    current === null ? tripId : undefined
  );

  if (!claim.committed) {
    const heldId = claim.snapshot.val() as string | null;
    if (!heldId) throw new TripInProgressError();

    const heldStatusSnap = await get(ref(db, `${tripsPath(code)}/${heldId}/status`));
    const heldStatus = heldStatusSnap.val();
    const orphaned = !heldStatusSnap.exists() || heldStatus === 'done' || heldStatus === 'cancelled';
    if (!orphaned) throw new TripInProgressError();

    const retry = await runTransaction(activeRef, (current: string | null) =>
      current === heldId ? tripId : undefined
    );
    if (!retry.committed) throw new TripInProgressError();
  }

  try {
    await update(ref(db), {
      [`${tripsPath(code)}/${tripId}`]: {
        status: 'planning',
        title: title.trim() || 'קנייה גדולה',
        createdBy: userId,
        createdAt: serverTimestamp(),
        shopperId: null,
        startedAt: null,
        finishedAt: null,
        receiptTotal: null,
        purchaseId: null,
      },
    });
  } catch (err) {
    // פיצוי: משחררים את הסלוט, אחרת הוא נשאר תפוס לנצח (ראו roomService.createRoom)
    try {
      await runTransaction(activeRef, (cur: string | null) => (cur === tripId ? null : cur));
    } catch {
      /* יישאר יתום — ייפתר בניסיון הבא, ראו לוגיקת ה-orphaned למעלה */
    }
    throw err;
  }

  return tripId;
}

export async function addTripLine(
  code: string,
  tripId: string,
  userId: string,
  draft: TripLineDraft
): Promise<string> {
  assertOnline('להוסיף מוצר לרשימה');
  assertRoomWritable(code, 'להוסיף מוצר לרשימה');

  const lineId = push(ref(db, `${tripsPath(code)}/${tripId}/lines`)).key!;
  await update(ref(db), {
    [`${tripsPath(code)}/${tripId}/lines/${lineId}`]: {
      name: draft.name.trim(),
      category: draft.category,
      qty: draft.qty ?? 1,
      productId: draft.productId ?? null,
      itemId: draft.itemId ?? null,
      state: 'planned',
      addedBy: userId,
      addedAt: serverTimestamp(),
    },
  });
  return lineId;
}

export async function removeTripLine(code: string, tripId: string, lineId: string): Promise<void> {
  assertOnline('להסיר מוצר מהרשימה');
  assertRoomWritable(code, 'להסיר מוצר מהרשימה');
  await update(ref(db), { [`${tripsPath(code)}/${tripId}/lines/${lineId}`]: null });
}

/** סימון שורה כ"נקנה" או "לא נמצא בסופר", בזמן הקנייה בפועל. */
export async function setTripLineState(
  code: string,
  tripId: string,
  lineId: string,
  state: TripLineState
): Promise<void> {
  assertOnline('לסמן מוצר');
  assertRoomWritable(code, 'לסמן מוצר');
  await update(ref(db), {
    [`${tripsPath(code)}/${tripId}/lines/${lineId}/state`]: state,
  });
}

/**
 * "אני יוצא/ת לסופר" — תופס את תפקיד הקונה, בדיוק כמו claimItem.
 * גם תופס (status: 'buying') את כל הפריטים המקושרים לשורות הרשימה,
 * כדי שלא יופיעו כפנויים לתפיסה נפרדת במסך המוצרים החסרים.
 */
export async function startShopping(code: string, tripId: string, userId: string): Promise<void> {
  assertOnline('להתחיל קנייה');
  assertRoomWritable(code, 'להתחיל קנייה');

  const tripRef = ref(db, `${tripsPath(code)}/${tripId}`);
  const result = await runTransaction(tripRef, (trip: Trip | null) => {
    if (!trip) return;
    if (trip.status !== 'planning') return;
    return { ...trip, status: 'shopping', shopperId: userId, startedAt: Date.now() };
  });

  if (!result.committed) throw new Error('מישהו כבר יצא לקנייה הזו');

  const linesSnap = await get(ref(db, `${tripsPath(code)}/${tripId}/lines`));
  const lines = (linesSnap.val() ?? {}) as Record<string, TripLine>;

  const updates: Record<string, unknown> = {};
  for (const line of Object.values(lines)) {
    if (line.itemId) {
      updates[`rooms/${code}/items/${line.itemId}/status`] = 'buying';
      updates[`rooms/${code}/items/${line.itemId}/assignedTo`] = userId;
    }
  }
  if (Object.keys(updates).length > 0) await update(ref(db), updates);
}

/**
 * סיום קנייה גדולה — רק ע"י מי שיצא בפועל לסופר (shopperId).
 *
 * כתיבה אטומית אחת: סוגר את הקנייה הגדולה, יוצר קנייה יחידה שמתחלקת
 * שווה בשווה בין החברים הפעילים, ומתאם את המוצרים החסרים — מה שנקנה
 * מסומן 'done' עם הקישור לקנייה, מה שלא נמצא חוזר להיות 'needed' ומשוחרר.
 * הכסף נכנס למאזן מיד — בלי אישור מנהל, כמו כל קנייה אחרת (createPurchase).
 */
export async function finalizeTrip(
  code: string,
  tripId: string,
  userId: string,
  userName: string,
  activeMemberIds: string[],
  receiptTotal: Agorot
): Promise<string> {
  assertOnline('לסיים קנייה גדולה');
  assertRoomWritable(code, 'לסיים קנייה גדולה');

  if (!Number.isInteger(receiptTotal) || receiptTotal <= 0) {
    throw new Error('סכום החשבונית חייב להיות חיובי');
  }

  const tripSnap = await get(ref(db, `${tripsPath(code)}/${tripId}`));
  if (!tripSnap.exists()) throw new Error('הקנייה הגדולה לא נמצאה');
  const trip = tripSnap.val() as Trip;
  if (trip.status !== 'shopping') throw new Error('הקנייה הגדולה אינה בעיצומה');
  if (trip.shopperId !== userId) throw new Error('רק מי שיצא לסופר יכול לסיים את הקנייה');

  const linesSnap = await get(ref(db, `${tripsPath(code)}/${tripId}/lines`));
  const lines = (linesSnap.val() ?? {}) as Record<string, TripLine>;
  // ‼️ בדיקת קיום מפורשת: אם פריט מקושר נמחק (למשל ע"י מנהל) תוך כדי
  // הקנייה, כתיבה אליו הייתה מפילה את כל העדכון האטומי — כולל הקנייה
  // עצמה, שהיא כסף אמיתי. לכן מדלגים על פריטים שכבר לא קיימים.
  const itemsSnap = await get(ref(db, `rooms/${code}/items`));
  const existingItemIds = new Set(Object.keys(itemsSnap.val() ?? {}));

  const purchaseId = push(ref(db, `rooms/${code}/purchases`)).key!;
  const notifId = push(ref(db, `rooms/${code}/notifications`)).key!;
  const shares = splitEqual(receiptTotal, activeMemberIds);

  const updates: Record<string, unknown> = {
    [`${tripsPath(code)}/${tripId}/status`]: 'done',
    [`${tripsPath(code)}/${tripId}/finishedAt`]: serverTimestamp(),
    [`${tripsPath(code)}/${tripId}/receiptTotal`]: receiptTotal,
    [`${tripsPath(code)}/${tripId}/purchaseId`]: purchaseId,

    [`rooms/${code}/purchases/${purchaseId}`]: {
      itemId: null,
      title: trip.title,
      boughtBy: userId,
      amount: receiptTotal,
      date: serverTimestamp(),
      createdAt: serverTimestamp(),
      splitMethod: 'equal',
      splitBetween: Object.fromEntries(activeMemberIds.map((id) => [id, true])),
      shares,
      receipt: null,
      status: 'approved',
      approvedBy: userId,
      tripId,
    },

    [`rooms/${code}/notifications/${notifId}`]: {
      type: 'purchase_made',
      actorId: userId,
      actorName: userName,
      text: `${userName} סיים/ה את "${trip.title}" — ${formatILS(receiptTotal)}`,
      entityId: purchaseId,
      createdAt: serverTimestamp(),
      readBy: { [userId]: true },
    },
  };

  for (const line of Object.values(lines)) {
    if (!line.itemId || !existingItemIds.has(line.itemId)) continue;
    if (line.state === 'bought') {
      updates[`rooms/${code}/items/${line.itemId}/status`] = 'done';
      updates[`rooms/${code}/items/${line.itemId}/purchaseId`] = purchaseId;
    } else {
      // לא נמצא, או שנשאר planned בלי סימון — חוזר להיות פנוי לתפיסה
      updates[`rooms/${code}/items/${line.itemId}/status`] = 'needed';
      updates[`rooms/${code}/items/${line.itemId}/assignedTo`] = null;
    }
  }

  await update(ref(db), updates);

  // משחררים את סלוט הקנייה הפעילה כדי שאפשר יהיה להתחיל קנייה גדולה הבאה
  try {
    await runTransaction(ref(db, `rooms/${code}/activeTripId`), (cur: string | null) =>
      cur === tripId ? null : cur
    );
  } catch {
    /* יישאר יתום — createTrip מזהה ומתאושש, ראו שם */
  }

  void enqueueNotification({
    roomCode: code,
    title: 'קנייה גדולה הסתיימה',
    body: `${userName} סיים/ה את "${trip.title}" — ${formatILS(receiptTotal)}`,
    url: `/r/${code}/balances`,
    tag: 'purchases',
    priority: 'digest',
    audience: 'room',
    actorUid: userId,
  });

  return purchaseId;
}

export async function cancelTrip(code: string, tripId: string, userId: string): Promise<void> {
  assertOnline('לבטל קנייה גדולה');
  assertRoomWritable(code, 'לבטל קנייה גדולה');

  await update(ref(db), {
    [`${tripsPath(code)}/${tripId}/status`]: 'cancelled',
    [`${tripsPath(code)}/${tripId}/cancelledBy`]: userId,
  });

  try {
    await runTransaction(ref(db, `rooms/${code}/activeTripId`), (cur: string | null) =>
      cur === tripId ? null : cur
    );
  } catch {
    /* ראו finalizeTrip */
  }
}
