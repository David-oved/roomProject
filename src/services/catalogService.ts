import { get, ref, serverTimestamp, update } from 'firebase/database';
import { db } from '../config/firebase';
import { assertOnline } from './guard';
import type { Agorot, Category } from '../types/models';
import type { CatalogProduct } from '../data/catalog';

/**
 * ═══════════════════════════════════════════════════════════════════
 *  קטלוג מוצרים — גלובלי בשם, פרטי במחיר
 * ═══════════════════════════════════════════════════════════════════
 *
 *  · מוצר שמישהו מוסיף נעשה זמין **לכל החדרים** — /catalog הוא גלובלי
 *  · מחיר שחדר משנה נשאר **רק אצלו** — /rooms/{code}/catalogPrices
 *
 *  ההפרדה הזו היא כל הרעיון: הידע על "מה קיים בעולם" משותף, כי הוא
 *  זהה לכולם. הידע על "כמה זה עולה לנו" פרטי, כי הוא באמת שונה בין
 *  חדרים — סופר שכונתי מול רשת, מותג מול מותג פרטי, עיר מול פריפריה.
 * ═══════════════════════════════════════════════════════════════════
 */

/**
 * מזהה דטרמיניסטי מתוך שם המוצר.
 *
 * למה לא push() אקראי: הקטלוג גלובלי ואי אפשר לשאול אותו ("האם קיים
 * כבר מוצר בשם הזה?"). מזהה שנגזר מהשם הופך את הכפילות לבלתי אפשרית
 * מעצם המבנה — שני משתמשים בשני חדרים שמוסיפים "מרכך כביסה" מקבלים
 * את אותו מזהה, וכותבים לאותו צומת.
 */
export function productIdFromName(name: string): string {
  const norm = name.trim().toLowerCase().replace(/\s+/g, ' ');

  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < norm.length; i++) {
    const c = norm.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0;
    h2 = Math.imul(h2 + c, 0x85ebca6b) >>> 0;
  }
  return `u${h1.toString(36)}${h2.toString(36)}`.slice(0, 20);
}

export interface NewProductDraft {
  name: string;
  category: Category;
  /** מחיר משוער בשקלים */
  priceShekels: number;
  unit?: string;
}

/**
 * מוסיף מוצר לקטלוג הגלובלי.
 * מחזיר את המזהה — גם אם המוצר כבר היה קיים (הכתיבה פשוט מעדכנת אותו).
 */
export async function addGlobalProduct(
  userId: string,
  draft: NewProductDraft
): Promise<string> {
  assertOnline('להוסיף מוצר לקטלוג');

  const name = draft.name.trim();
  if (name.length < 2) throw new Error('שם המוצר קצר מדי');

  const price = Math.round(draft.priceShekels * 100);
  if (!Number.isFinite(price) || price < 0 || price > 10_000_00) {
    throw new Error('מחיר לא תקין');
  }

  const id = productIdFromName(name);

  // המזהה דטרמיניסטי, ולכן ייתכן שהמוצר כבר קיים — נוצר ע"י מישהו
  // אחר, בחדר אחר. הכללים מתירים עדכון רק ליוצר, אז כתיבה במקרה כזה
  // הייתה נכשלת ב-PERMISSION_DENIED. המוצר כבר בקטלוג; זו הצלחה.
  const existing = await get(ref(db, `catalog/${id}`));
  if (existing.exists()) return id;

  await update(ref(db, `catalog/${id}`), {
    name,
    nameLower: name.toLowerCase(),
    category: draft.category,
    defaultPrice: price,
    ...(draft.unit?.trim() ? { unit: draft.unit.trim() } : {}),
    createdBy: userId,
    createdAt: serverTimestamp(),
  });

  return id;
}

/** קובע מחיר מקומי לחדר. משפיע רק על החדר הזה. */
export async function setRoomPrice(
  roomCode: string,
  productId: string,
  priceShekels: number,
  userId: string
): Promise<void> {
  assertOnline('לעדכן מחיר');

  const price = Math.round(priceShekels * 100);
  if (!Number.isFinite(price) || price < 0 || price > 10_000_00) {
    throw new Error('מחיר לא תקין');
  }

  await update(ref(db, `rooms/${roomCode}/catalogPrices/${productId}`), {
    price,
    updatedAt: serverTimestamp(),
    updatedBy: userId,
  });
}

/** מחזיר את המוצר למחיר ברירת המחדל של הקטלוג. */
export async function clearRoomPrice(roomCode: string, productId: string): Promise<void> {
  assertOnline('לאפס מחיר');
  await update(ref(db), { [`rooms/${roomCode}/catalogPrices/${productId}`]: null });
}

/** מוסיף או מסיר מוצר מרשימת מוצרי הבסיס של החדר. */
export async function toggleStaple(
  roomCode: string,
  productId: string,
  on: boolean
): Promise<void> {
  assertOnline('לעדכן את מוצרי הבסיס');
  await update(ref(db), { [`rooms/${roomCode}/staples/${productId}`]: on ? true : null });
}

/** קובע את כל רשימת מוצרי הבסיס בבת אחת — משמש ביצירת חדר. */
export function staplesMap(productIds: string[]): Record<string, true> {
  return Object.fromEntries(productIds.map((id) => [id, true as const]));
}

/* ═══════════════ עזרי תצוגה ═══════════════ */

/** המחיר שבאמת רלוונטי לחדר: עקיפה מקומית, ואם אין — ברירת המחדל */
export const effectivePrice = (
  product: CatalogProduct,
  overrides: Record<string, { price: Agorot }> | undefined
): Agorot => overrides?.[product.id]?.price ?? product.defaultPrice;

/** האם החדר שינה את המחיר של המוצר הזה */
export const hasCustomPrice = (
  productId: string,
  overrides: Record<string, { price: Agorot }> | undefined
): boolean => overrides?.[productId] !== undefined;
