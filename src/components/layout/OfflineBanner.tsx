import { useConnection } from '../../store/ConnectionContext';
import { OfflineIcon } from '../ui/icons';
import { formatRelativeTime } from '../../lib/format';

/**
 * באנר מצב לא-מקוון.
 *
 * שלושה כללים מכוונים:
 *  1. לא ניתן לסגירה — מצב האפליקציה השתנה מהותית, זו לא הודעה חולפת.
 *  2. דביק — נשאר גלוי בגלילה.
 *  3. נעלם מיד כשהחיבור חוזר.
 */
export function OfflineBanner() {
  const { isOnline, lastSyncAt } = useConnection();
  if (isOnline) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="sticky top-0 z-[45] flex items-center gap-2 bg-info-fill px-4 py-2 text-white"
      style={{ paddingTop: 'calc(0.5rem + var(--safe-top))' }}
    >
      {/* ‼️ הרקע כאן כהה בשני המצבים (bg-info-fill לא מתהפך), ולכן כל טקסט
          עליו חייב להיות בהיר קבוע — לא טוקן ink מתהפך. קודם ישבו כאן
          bg-ink-800 עם text-ink-300/ink-500: במצב כהה הרקע התהפך לכמעט-לבן
          והטקסט הלבן ירד ל-1.07:1, כלומר הודעת "אין חיבור" נעלמה. */}
      <OfflineIcon width={17} height={17} className="shrink-0" />
      <span className="text-sm font-semibold">אין חיבור לאינטרנט</span>
      <span className="text-sm text-white/75">· צפייה בלבד</span>
      {lastSyncAt && (
        <span className="ms-auto shrink-0 text-[11px] text-white/70">
          עודכן {formatRelativeTime(lastSyncAt)}
        </span>
      )}
    </div>
  );
}
