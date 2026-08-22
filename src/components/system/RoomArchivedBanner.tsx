import { useRoom } from '../../store/RoomContext';
import { formatFullDate } from '../../lib/format';
import { ArchiveIcon } from '../ui/icons';

/**
 * באנר "החדר בארכיון".
 *
 * ‼️ מוצג בכל מסך בחדר ולא רק בהגדרות: משתמש שינסה לדווח על מוצר
 *    ויקבל שגיאה יחשוב שהאפליקציה שבורה. הבאנר הופך כישלון עתידי
 *    להסבר מקדים.
 *
 * ‼️ הצ׳אט נשאר פתוח בכוונה, וזה נאמר במפורש — חדר שהועבר לארכיון
 *    הוא בדיוק המצב שבו השותפים צריכים לדבר על מה שקרה.
 */
export function RoomArchivedBanner() {
  const { isArchived, metadata } = useRoom();
  if (!isArchived) return null;

  return (
    <div
      role="status"
      className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 p-3.5 text-start"
    >
      <div className="flex items-start gap-2.5">
        <span aria-hidden className="mt-0.5 shrink-0 text-amber-700">
          <ArchiveIcon width={17} height={17} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-amber-900">החדר הועבר לארכיון</p>
          <p className="mt-0.5 text-xs leading-relaxed text-amber-800">
            כל הנתונים נשמרו וניתן לצפות בהם, אבל אי אפשר לדווח על מוצרים, לרשום קניות או להוסיף
            מטלות. הצ׳אט עדיין פתוח.
          </p>
          {metadata?.archivedAt && (
            <p className="mt-1 text-[11px] text-amber-700">
              מתאריך {formatFullDate(metadata.archivedAt)}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
