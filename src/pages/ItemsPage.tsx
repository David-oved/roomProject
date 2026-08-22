import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AppShell } from '../components/layout/AppShell';
import { RoomArchivedBanner } from '../components/system/RoomArchivedBanner';
import { TopBar } from '../components/layout/TopBar';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { EmptyState, ErrorState } from '../components/ui/EmptyState';
import { ListSkeleton } from '../components/ui/Skeleton';
import { ReportItemSheet } from '../components/items/ReportItemSheet';
import { MarkBoughtSheet } from '../components/items/MarkBoughtSheet';
import { StaplesView } from '../components/catalog/StaplesView';
import { useItems } from '../hooks/useRoomData';
import { useRoom } from '../store/RoomContext';
import { useAuth } from '../store/AuthContext';
import { useConnection } from '../store/ConnectionContext';
import { useToast } from '../store/ToastContext';
import { useConfirm } from '../store/ConfirmContext';
import { claimItem, deleteItem, unclaimItem } from '../services/itemService';
import { formatILS, formatRelativeTime, formatTime } from '../lib/format';
import { friendlyError } from '../lib/errors';
import { useCatalog, type RoomProduct } from '../hooks/useCatalog';
import { useHintRef } from '../store/HintContext';
import { CATEGORY_ICON } from '../lib/categoryIcons';
import { BasketIcon, BoxIcon, SparklesIcon } from '../components/ui/icons';
import {
  CATEGORY_LABELS,
  PRIORITY_LABELS,
  type Item,
  type ItemStatus,
  type WithId,
} from '../types/models';

type Filter = 'open' | 'needed' | 'buying' | 'done' | 'staples';

const FILTERS: { key: Filter; label: string; icon?: typeof BasketIcon }[] = [
  { key: 'open', label: 'פעילים' },
  { key: 'staples', label: 'מלאי הבית', icon: BasketIcon },
  { key: 'needed', label: 'חסרים' },
  { key: 'buying', label: 'בקנייה' },
  { key: 'done', label: 'הושלמו' },
];

export default function ItemsPage() {
  const [params, setParams] = useSearchParams();
  const [filter, setFilter] = useState<Filter>('open');
  const [reportOpen, setReportOpen] = useState(false);
  const [buyingItem, setBuyingItem] = useState<WithId<Item> | null>(null);

  // 'staples' אינו סטטוס של פריט אלא תצוגה אחרת לגמרי
  const isStaples = filter === 'staples';
  const { items, loading, error, fromCache, cachedAt } = useItems(
    isStaples ? 'open' : (filter as ItemStatus | 'open')
  );
  const { isOnline } = useConnection();
  // חדר בארכיון = קריאה בלבד. אותה השבתה כמו אופליין, נימוק אחר.
  const { isArchived } = useRoom();
  const canWrite = isOnline && !isArchived;
  // ‼️ הוק אחד לכל הדף — לא אחד לכל שורה. useCatalog פותח שלוש האזנות
  // RTDB ובונה מחדש את כל הקטלוג; קריאה שלו בתוך ItemCard הכפילה את זה
  // במספר הפריטים על המסך.
  const { getProduct } = useCatalog();

  const reportHintRef = useHintRef<HTMLButtonElement>(
    'items.report',
    'דיווח מהיר על מוצר שנגמר או עומד להיגמר'
  );
  // ‼️ מזהה נפרד מ-reportHintRef, לא משותף: שני הכפתורים יכולים להיות
  // מורכבים בו-זמנית (הרשימה ריקה = גם כפתור הכותרת וגם EmptyState
  // מוצגים יחד) — id משותף על שני אלמנטים חיים בו-זמנית גורם ל-unmount
  // של אחד למחוק בטעות את הרישום של השני מהתור.
  const reportEmptyHintRef = useHintRef<HTMLButtonElement>(
    'items.reportEmpty',
    'דיווח מהיר על מוצר שנגמר או עומד להיגמר'
  );
  // אחד לכל פילטר קבוע — לא בתוך .map, כי useHintRef הוא hook.
  const filterHintRefs: Record<Filter, ReturnType<typeof useHintRef<HTMLButtonElement>>> = {
    open: useHintRef<HTMLButtonElement>('items.filter.open', 'כל המוצרים הפתוחים — לא כולל מה שכבר הושלם'),
    staples: useHintRef<HTMLButtonElement>('items.filter.staples', 'המוצרים הקבועים שתמיד צריך שיהיו בבית'),
    needed: useHintRef<HTMLButtonElement>('items.filter.needed', 'מוצרים שדווחו ועדיין לא לקח אותם אף אחד'),
    buying: useHintRef<HTMLButtonElement>('items.filter.buying', 'מוצרים שמישהו כבר התחייב לקנות'),
    done: useHintRef<HTMLButtonElement>('items.filter.done', 'היסטוריית מוצרים שנקנו והושלמו'),
  };

  // הכפתור המרכזי בניווט מנווט לכאן עם ?new=1
  useEffect(() => {
    if (params.get('new') === '1') {
      setReportOpen(true);
      setParams({}, { replace: true });
      return;
    }
    // קישור ישיר ללשונית מלאי הבית, מהדשבורד
    if (params.get('tab') === 'staples') {
      setFilter('staples');
      setParams({}, { replace: true });
    }
  }, [params, setParams]);

  return (
    <AppShell>
      <TopBar
        title="מוצרים חסרים"
        subtitle={
          !isStaples && items.length > 0 ? (
            <>
              <span className="num">{items.length}</span> פריטים
            </>
          ) : undefined
        }
        actions={
          <Button
            ref={reportHintRef}
            size="sm"
            onClick={() => setReportOpen(true)}
            disabled={!canWrite}
            title={
              isArchived
                ? 'החדר בארכיון — לצפייה בלבד'
                : isOnline
                  ? undefined
                  : 'פעולה זו דורשת חיבור לאינטרנט'
            }
          >
            + דיווח
          </Button>
        }
      />

      <RoomArchivedBanner />

      {/* פילטרים */}
      <div className="scroll-area -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 pt-4">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            ref={filterHintRefs[f.key]}
            onClick={() => setFilter(f.key)}
            aria-pressed={filter === f.key}
            className={[
              'tap flex shrink-0 items-center gap-1.5 rounded-full px-4 text-sm font-semibold transition',
              filter === f.key
                ? 'bg-brand-700 text-white shadow-sm'
                : 'bg-surface text-ink-600 ring-1 ring-ink-200',
            ].join(' ')}
          >
            {f.icon && <f.icon width={15} height={15} />}
            {f.label}
          </button>
        ))}
      </div>

      <div className="pt-3">
        {fromCache && !isOnline && cachedAt && (
          <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
            מציג נתונים מ־{formatTime(cachedAt)}. ייתכן שהשתנו מאז.
          </p>
        )}

        {isStaples ? (
          <StaplesView />
        ) : loading ? (
          <ListSkeleton rows={4} />
        ) : error && !fromCache ? (
          // friendlyError ולא error.message: הודעת RTDB הגולמית היא
          // "permission_denied" — מחרוזת שלא אומרת למשתמש כלום.
          <ErrorState message={friendlyError(error)} onRetry={() => location.reload()} />
        ) : items.length === 0 ? (
          <EmptyState
            icon={
              filter === 'done' ? (
                <BoxIcon width={30} height={30} />
              ) : (
                <SparklesIcon width={30} height={30} />
              )
            }
            title={filter === 'done' ? 'אין קניות שהושלמו' : 'אין מוצרים חסרים'}
            body={
              filter === 'done'
                ? 'קניות שיאושרו יופיעו כאן.'
                : 'הכל מלא. כשמשהו נגמר — דווחו עליו כאן.'
            }
            action={
              filter !== 'done' && (
                <Button ref={reportEmptyHintRef} onClick={() => setReportOpen(true)} disabled={!canWrite}>
                  דיווח על מוצר חסר
                </Button>
              )
            }
          />
        ) : (
          <ul className="space-y-2.5">
            {items.map((item, idx) => (
              <li key={item.id}>
                <ItemCard
                  item={item}
                  product={item.productId ? getProduct(item.productId) : null}
                  onBuy={() => setBuyingItem(item)}
                  isFirst={idx === 0}
                />
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* ‼️ מרכיבים רק כשפתוח. GlassModal אמנם מחזיר null כשסגור, אבל זה
          קורה *אחרי* שכל ההוקים של העטיפה כבר רצו (useCatalog, useItems,
          useBalances) — כלומר האזנות RTDB פתוחות לגיליון שלא מוצג. אין
          אנימציית יציאה שנפגעת מכך: GlassModal נעלם מיידית ממילא. */}
      {reportOpen && <ReportItemSheet open onClose={() => setReportOpen(false)} />}
      {buyingItem && (
        <MarkBoughtSheet open onClose={() => setBuyingItem(null)} item={buyingItem} />
      )}
    </AppShell>
  );
}

function ItemCard({
  item,
  product,
  onBuy,
  isFirst,
}: {
  item: WithId<Item>;
  /** מוצר מהקטלוג — נפתר בדף ומועבר פנימה, ראו ההערה ב-ItemsPage */
  product: RoomProduct | null;
  onBuy: () => void;
  /** מצמידים הערת-הקשר רק לכרטיס הראשון ברשימה — לא לכל שורה בלולאה */
  isFirst: boolean;
}) {
  const { user } = useAuth();
  const { roomCode, isAdmin, isArchived, memberName } = useRoom();
  const { isOnline } = useConnection();
  const toast = useToast();
  const confirm = useConfirm();
  const [busy, setBusy] = useState(false);
  const claimHintRef = useHintRef<HTMLButtonElement>(
    'items.card.claim',
    'מסמן שאתם מתחייבים לקנות את המוצר הזה'
  );
  const buyHintRef = useHintRef<HTMLButtonElement>(
    'items.card.buy',
    'פותח טופס לרישום כמה שילמתם ואיך לחלק'
  );
  const unclaimHintRef = useHintRef<HTMLButtonElement>(
    'items.card.unclaim',
    'מבטל את ההתחייבות שלכם — המוצר חוזר לרשימה'
  );
  const deleteHintRef = useHintRef<HTMLButtonElement>(
    'items.card.delete',
    'מוחק את המוצר לצמיתות מרשימת החדר'
  );

  const mine = item.assignedTo === user?.uid;
  const guard = {
    disabled: !isOnline || isArchived || busy,
    title: isOnline ? undefined : 'פעולה זו דורשת חיבור לאינטרנט',
  };

  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    await toast.run(fn);
    setBusy(false);
  }

  const CategoryIcon = CATEGORY_ICON[item.category];

  return (
    <article className="card p-4">
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-ink-100 text-ink-700"
        >
          <CategoryIcon width={16} height={16} />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <h3 className="min-w-0 flex-1 truncate font-bold text-ink-900">{item.name}</h3>
            {item.priority === 'high' && <Badge tone="danger">{PRIORITY_LABELS.high}</Badge>}
            {item.status === 'buying' && (
              <Badge tone="info">{mine ? 'אתה קונה' : `${memberName(item.assignedTo ?? '')} קונה`}</Badge>
            )}
            {item.status === 'bought' && <Badge tone="warning">ממתין לאישור</Badge>}
            {item.status === 'done' && <Badge tone="success">הושלם</Badge>}
          </div>

          <p className="mt-0.5 text-xs text-ink-500">
            {CATEGORY_LABELS[item.category]} · דיווח {memberName(item.reportedBy)} ·{' '}
            {item.reportedAt ? formatRelativeTime(item.reportedAt) : ''}
          </p>

          {product && (
            <p className="mt-1 text-xs text-ink-500">
              מחיר משוער <span className="num font-medium text-ink-600">{formatILS(product.price)}</span>
              {product.unit && <span> · {product.unit}</span>}
            </p>
          )}

          {item.notes && (
            <p className="mt-2 rounded-lg bg-ink-50 px-2.5 py-1.5 text-xs leading-relaxed text-ink-600">
              {item.notes}
            </p>
          )}
        </div>
      </div>

      {/* פעולות */}
      {item.status !== 'done' && item.status !== 'bought' && (
        <div className="mt-3 flex gap-2">
          {item.status === 'needed' && (
            <Button
              ref={isFirst ? claimHintRef : undefined}
              size="sm"
              {...guard}
              onClick={() => run(() => claimItem(roomCode!, item.id, user!.uid))}
            >
              אני קונה את זה
            </Button>
          )}

          {item.status === 'buying' && mine && (
            <>
              <Button ref={isFirst ? buyHintRef : undefined} size="sm" {...guard} onClick={onBuy}>
                קניתי — הזן סכום
              </Button>
              <Button
                ref={isFirst ? unclaimHintRef : undefined}
                size="sm"
                variant="ghost"
                {...guard}
                onClick={() => run(() => unclaimItem(roomCode!, item.id))}
              >
                ביטול
              </Button>
            </>
          )}

          {isAdmin && (
            <Button
              ref={isFirst ? deleteHintRef : undefined}
              size="sm"
              variant="ghost"
              className="ms-auto text-rose-600"
              {...guard}
              onClick={async () => {
                const ok = await confirm({
                  title: 'מחיקת מוצר',
                  body: `למחוק את "${item.name}" מהרשימה?`,
                  confirmLabel: 'מחק',
                  danger: true,
                });
                if (ok) await run(() => deleteItem(roomCode!, item.id));
              }}
            >
              מחק
            </Button>
          )}
        </div>
      )}
    </article>
  );
}
