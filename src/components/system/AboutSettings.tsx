import { Button } from '../ui/Button';
import { RefreshIcon } from '../ui/icons';
import { useConnection } from '../../store/ConnectionContext';
import { useUpdate } from '../../store/UpdateContext';
import { useTutorial } from '../../store/TutorialContext';
import { APP_VERSION, BUILD_TIME } from '../../lib/version';
import { formatSmartDate } from '../../lib/format';

/** גרסה, עדכונים, ומידע על הבנייה הנוכחית. */
export function AboutSettings() {
  const { isOnline } = useConnection();
  const { status, remote, checkNow, applyUpdate } = useUpdate();
  const { openTutorial } = useTutorial();

  return (
    <section className="card p-4">
      <h2 className="mb-3 text-sm font-bold text-ink-700">גרסת האפליקציה</h2>

      <dl className="space-y-2 text-sm">
        <div className="flex justify-between">
          <dt className="text-ink-500">גרסה מותקנת</dt>
          <dd className="num font-semibold text-ink-900">{APP_VERSION}</dd>
        </div>
        {remote && (
          <div className="flex justify-between">
            <dt className="text-ink-500">גרסה בשרת</dt>
            <dd
              className={`num font-semibold ${
                remote.version === APP_VERSION ? 'text-ink-900' : 'text-brand-700'
              }`}
            >
              {remote.version}
            </dd>
          </div>
        )}
        <div className="flex justify-between">
          <dt className="text-ink-500">נבנתה</dt>
          <dd className="text-ink-600">{formatSmartDate(new Date(BUILD_TIME).getTime())}</dd>
        </div>
      </dl>

      <div className="mt-4">
        {status === 'available' ? (
          <Button fullWidth onClick={applyUpdate} icon={<RefreshIcon width={18} height={18} />}>
            עדכן לגרסה {remote?.version}
          </Button>
        ) : (
          <Button
            variant="secondary"
            fullWidth
            disabled={!isOnline || status === 'checking'}
            loading={status === 'checking'}
            onClick={checkNow}
            icon={<RefreshIcon width={18} height={18} />}
          >
            {status === 'current' ? 'האפליקציה מעודכנת ✓' : 'בדוק אם יש עדכון'}
          </Button>
        )}
      </div>

      <p className="mt-2 text-[11px] leading-relaxed text-ink-500">
        האפליקציה בודקת עדכונים אוטומטית בכל כניסה. עדכון מוריד מחדש את כל קבצי האפליקציה.
      </p>

      <div className="mt-4 border-t border-ink-100 pt-4">
        <Button variant="secondary" fullWidth onClick={openTutorial}>
          🎓 הצגת ההדרכה מחדש
        </Button>
      </div>
    </section>
  );
}
