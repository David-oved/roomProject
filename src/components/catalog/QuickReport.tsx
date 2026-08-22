import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useCatalog } from '../../hooks/useCatalog';
import { useItems } from '../../hooks/useRoomData';
import { useRoom } from '../../store/RoomContext';
import { useAuth } from '../../store/AuthContext';
import { useConnection } from '../../store/ConnectionContext';
import { useToast } from '../../store/ToastContext';
import { reportItem } from '../../services/itemService';
import { CATEGORY_EMOJI } from '../../types/models';
import { Spinner } from '../ui/Spinner';

/**
 * דיווח מהיר ממוצרי הבסיס — במסך הבית.
 *
 * זה המקום שבו הקטלוג באמת משתלם: המצב הנפוץ הוא "נגמר החלב", והוא
 * צריך לקחת לחיצה אחת מהמסך הראשי — לא פתיחת טופס, הקלדת שם, בחירת
 * קטגוריה ובחירת עדיפות.
 *
 * מוצגים רק מוצרים שעדיין לא דווחו, כך שהרשימה מתקצרת תוך כדי שימוש
 * ואף פעם לא מציעה משהו שכבר ברשימה.
 */
export function QuickReport() {
  const { stapleProducts } = useCatalog();
  const { items } = useItems('open');
  const { roomCode } = useRoom();
  const { user, profile } = useAuth();
  const { isOnline } = useConnection();
  const toast = useToast();
  const [busyId, setBusyId] = useState<string | null>(null);

  const reportedIds = useMemo(
    () => new Set(items.map((i) => i.productId).filter(Boolean) as string[]),
    [items]
  );

  const available = useMemo(
    () => stapleProducts.filter((p) => !reportedIds.has(p.id)),
    [stapleProducts, reportedIds]
  );

  if (stapleProducts.length === 0) return null;

  const missingCount = reportedIds.size;

  async function report(productId: string, name: string, category: Parameters<typeof reportItem>[3]['category']) {
    if (!roomCode || !user || !profile) return;
    setBusyId(productId);
    const res = await toast.run(() =>
      reportItem(roomCode, user.uid, profile.displayName, {
        name,
        category,
        priority: 'normal',
        productId,
      })
    );
    setBusyId(null);
    if (res !== null) toast.success(`${name} נוסף לרשימה`);
  }

  return (
    <section>
      <div className="mb-2 flex items-center justify-between px-1">
        <h2 className="text-sm font-bold text-ink-700">
          🧺 מלאי הבית
          {missingCount > 0 && (
            <span className="ms-1.5 font-normal text-ink-500">
              · <span className="num text-amber-700">{missingCount}</span> חסרים
            </span>
          )}
        </h2>
        <Link
          to={`/r/${roomCode}/items?tab=staples`}
          className="tap-area text-xs font-semibold text-brand-700"
        >
          הצג הכל
        </Link>
      </div>

      <div className="card p-3.5">
        {available.length === 0 ? (
          <p className="py-2 text-center text-sm text-ink-500">
            כל מוצרי הבסיס כבר ברשימת החסרים
          </p>
        ) : (
          <>
            <p className="mb-2.5 text-xs text-ink-500">
              נגמר משהו? לחיצה אחת מדווחת עליו
            </p>
            <div className="flex flex-wrap gap-2">
              {available.slice(0, 10).map((p) => (
                <button
                  key={p.id}
                  onClick={() => void report(p.id, p.name, p.category)}
                  disabled={!isOnline || busyId !== null}
                  title={isOnline ? `דיווח שנגמר ${p.name}` : 'פעולה זו דורשת חיבור לאינטרנט'}
                  className="tap inline-flex items-center gap-1.5 rounded-full border
                             border-ink-200 bg-surface px-3 text-sm font-medium text-ink-700
                             transition active:scale-95 hover:border-brand-300 hover:bg-brand-50
                             disabled:opacity-50 disabled:active:scale-100"
                >
                  {busyId === p.id ? (
                    <Spinner size={14} />
                  ) : (
                    <span aria-hidden>{CATEGORY_EMOJI[p.category]}</span>
                  )}
                  {p.name}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </section>
  );
}
