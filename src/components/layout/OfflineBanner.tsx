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
      className="sticky top-0 z-[45] flex items-center gap-2 bg-ink-800 px-4 py-2 text-white"
      style={{ paddingTop: 'calc(0.5rem + var(--safe-top))' }}
    >
      <OfflineIcon width={17} height={17} className="shrink-0 text-amber-300" />
      <span className="text-sm font-semibold">אין חיבור לאינטרנט</span>
      <span className="text-sm text-ink-300">· צפייה בלבד</span>
      {lastSyncAt && (
        <span className="ms-auto shrink-0 text-[11px] text-ink-400">
          עודכן {formatRelativeTime(lastSyncAt)}
        </span>
      )}
    </div>
  );
}
