import { useCallback, useMemo } from 'react';
import { useRtdbValue } from './useRtdb';
import { useRoom } from '../store/RoomContext';
import { SEED_CATALOG, type CatalogProduct } from '../data/catalog';
import type { Agorot, Category } from '../types/models';

export interface PriceOverride {
  price: Agorot;
  updatedAt: number;
  updatedBy: string;
}

/** מוצר כפי שהוא נראה **לחדר מסוים** — עם המחיר האפקטיבי שלו */
export interface RoomProduct extends CatalogProduct {
  /** המחיר שרלוונטי לחדר הזה */
  price: Agorot;
  /** האם החדר שינה את המחיר מברירת המחדל */
  customPrice: boolean;
  /** האם המוצר מוגדר כמוצר בסיס בחדר */
  isStaple: boolean;
}

/**
 * מאחד שלושה מקורות לתמונה אחת:
 *
 *   קטלוג מובנה (bundle)  ─┐
 *   מוצרים שמשתמשים הוסיפו ─┼─→  רשימת מוצרים גלובלית
 *                           │
 *   מחירי החדר ─────────────┴─→  מחיר אפקטיבי לכל מוצר
 *
 * הקטלוג המובנה נטען מיידית, כך שהמסך אף פעם לא ריק — גם לפני
 * שהתשובה מ-Firebase הגיעה, וגם כשאין רשת בכלל.
 */
export function useCatalog() {
  const { roomCode } = useRoom();

  const added = useRtdbValue<Record<string, Omit<CatalogProduct, 'id'>>>('catalog');
  const prices = useRtdbValue<Record<string, PriceOverride>>(
    roomCode ? `rooms/${roomCode}/catalogPrices` : null
  );
  const staples = useRtdbValue<Record<string, true>>(
    roomCode ? `rooms/${roomCode}/staples` : null
  );

  /** כל המוצרים שקיימים בעולם — מובנים + מה שמשתמשים הוסיפו */
  const allProducts = useMemo<CatalogProduct[]>(() => {
    const userAdded = Object.entries(added.data ?? {}).map(([id, p]) => ({ ...p, id }));

    // מוצר שמשתמש הוסיף וקיים גם בקטלוג המובנה — המובנה מנצח,
    // כדי שהעריכה לא תשבש מוצר שכל החדרים מסתמכים עליו
    const seedIds = new Set(SEED_CATALOG.map((p) => p.id));
    return [...SEED_CATALOG, ...userAdded.filter((p) => !seedIds.has(p.id))];
  }, [added.data]);

  const byId = useMemo(
    () => new Map(allProducts.map((p) => [p.id, p])),
    [allProducts]
  );

  /** מעשיר מוצר בנתוני החדר */
  const decorate = useCallback(
    (p: CatalogProduct): RoomProduct => {
      const override = prices.data?.[p.id];
      return {
        ...p,
        price: override?.price ?? p.defaultPrice,
        customPrice: override !== undefined,
        isStaple: staples.data?.[p.id] === true,
      };
    },
    [prices.data, staples.data]
  );

  const products = useMemo(() => allProducts.map(decorate), [allProducts, decorate]);

  /** מוצרי הבסיס של החדר, ממוינים לפי קטגוריה ואז לפי שם */
  const stapleProducts = useMemo(
    () =>
      products
        .filter((p) => p.isStaple)
        .sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name, 'he')),
    [products]
  );

  /**
   * חיפוש. מדרג התאמות שמתחילות במחרוזת לפני התאמות באמצע —
   * הקלדת "חל" צריכה להעלות "חלב" לפני "לחם מלא".
   */
  const search = useCallback(
    (query: string, category?: Category, limit = 40): RoomProduct[] => {
      const q = query.trim().toLowerCase();
      if (!q) {
        return products
          .filter((p) => !category || p.category === category)
          .slice(0, limit);
      }

      const scored: Array<{ p: RoomProduct; score: number }> = [];
      for (const p of products) {
        if (category && p.category !== category) continue;
        const name = p.name.toLowerCase();
        const idx = name.indexOf(q);
        if (idx === -1) continue;
        scored.push({ p, score: idx === 0 ? 0 : 1 });
      }

      return scored
        .sort((a, b) => a.score - b.score || a.p.name.localeCompare(b.p.name, 'he'))
        .slice(0, limit)
        .map((s) => s.p);
    },
    [products]
  );

  /** מוצר בודד לפי מזהה, עם נתוני החדר */
  const getProduct = useCallback(
    (id: string): RoomProduct | null => {
      const p = byId.get(id);
      return p ? decorate(p) : null;
    },
    [byId, decorate]
  );

  return {
    products,
    stapleProducts,
    search,
    getProduct,
    /** הקטלוג המובנה זמין תמיד, לכן אין מצב טעינה אמיתי */
    loading: false,
    /** נטען מ-Firebase — משפיע רק על מוצרים שמשתמשים הוסיפו */
    syncing: added.loading || prices.loading || staples.loading,
  };
}
