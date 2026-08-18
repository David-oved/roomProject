import { push, ref, remove, runTransaction, serverTimestamp, update } from 'firebase/database';
import { db } from '../config/firebase';
import { assertOnline } from './guard';
import type { Category, Item, Priority } from '../types/models';

export interface ItemDraft {
  name: string;
  category: Category;
  priority: Priority;
  notes?: string;
  /** מזהה המוצר בקטלוג — כשהדיווח הגיע מרשימת מוצרי הבסיס */
  productId?: string | null;
}

const itemsPath = (code: string) => `rooms/${code}/items`;

export async function reportItem(
  code: string,
  userId: string,
  userName: string,
  draft: ItemDraft
): Promise<string> {
  assertOnline('לדווח על מוצר'); // ← 🔴 ללא רשת נעצרים כאן

  const itemId = push(ref(db, itemsPath(code))).key!;
  const notifId = push(ref(db, `rooms/${code}/notifications`)).key!;
  const name = draft.name.trim();

  // כתיבה אטומית אחת: הפריט + ההתראה. פריט בלי ההתראה שלו הוא באג.
  await update(ref(db), {
    [`${itemsPath(code)}/${itemId}`]: {
      name,
      nameLower: name.toLowerCase(),
      category: draft.category,
      priority: draft.priority,
      notes: draft.notes?.trim() || null,
      reportedBy: userId,
      reportedAt: serverTimestamp(),
      status: 'needed',
      assignedTo: null,
      purchaseId: null,
      productId: draft.productId ?? null,
    },
    [`rooms/${code}/notifications/${notifId}`]: {
      type: 'item_added',
      actorId: userId,
      actorName: userName,
      text: `${userName} דיווח שחסר ${name}`,
      entityId: itemId,
      createdAt: serverTimestamp(),
      readBy: { [userId]: true },
    },
  });

  return itemId;
}

/**
 * "אני קונה את זה".
 *
 * runTransaction ולא update — כי שני שותפים יכולים ללחוץ בו-זמנית.
 * Last-Write-Wins היה משאיר את שניהם משוכנעים שהם קונים, ושניהם
 * היו חוזרים הביתה עם חלב. ראו docs/06-edge-cases.md מקרה 1.
 */
export async function claimItem(code: string, itemId: string, userId: string): Promise<void> {
  assertOnline('לתפוס מוצר');

  const itemRef = ref(db, `${itemsPath(code)}/${itemId}`);
  const result = await runTransaction(itemRef, (item: Item | null) => {
    if (!item) return; // נמחק בינתיים
    if (item.status !== 'needed') return; // מישהו הקדים
    return { ...item, status: 'buying', assignedTo: userId };
  });

  if (!result.committed) {
    const current = result.snapshot.val() as Item | null;
    if (!current) throw new Error('המוצר נמחק בינתיים');
    if (current.assignedTo === userId) throw new Error('כבר תפסת את המוצר הזה');
    throw new Error('מישהו אחר כבר תפס את המוצר הזה');
  }
}

export async function unclaimItem(code: string, itemId: string): Promise<void> {
  assertOnline('לבטל תפיסה');
  await update(ref(db, `${itemsPath(code)}/${itemId}`), {
    status: 'needed',
    assignedTo: null,
  });
}

export async function updateItem(
  code: string,
  itemId: string,
  patch: Partial<Pick<Item, 'name' | 'category' | 'priority' | 'notes'>>
): Promise<void> {
  assertOnline('לערוך מוצר');

  const clean: Record<string, unknown> = { ...patch };
  if (typeof patch.name === 'string') {
    clean.name = patch.name.trim();
    clean.nameLower = patch.name.trim().toLowerCase();
  }
  if ('notes' in patch) clean.notes = patch.notes?.trim() || null;

  await update(ref(db, `${itemsPath(code)}/${itemId}`), clean);
}

/** מנהל בלבד — נאכף ב-Security Rules. */
export async function deleteItem(code: string, itemId: string): Promise<void> {
  assertOnline('למחוק מוצר');
  await remove(ref(db, `${itemsPath(code)}/${itemId}`));
}
