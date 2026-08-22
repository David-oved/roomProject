import { GlassModal } from '../ui/GlassModal';
import { Button } from '../ui/Button';
import { useInstallGuide } from '../../store/InstallGuideContext';
import { getInstallGuideContent } from '../../lib/installGuide';

/**
 * הסבר "איך מתקינים את RoomMate למסך הבית" — מותאם לדפדפן ולמכשיר של
 * המשתמש (ראו lib/installGuide.ts). מוצג פעם אחת אוטומטית אחרי הרשמה
 * (RegisterPage), ופתוח לחזרה מ-הגדרות ← אודות ומהבאנר בדשבורד.
 *
 * מרונדרת כאחות ל-InstallGuideProvider (ב-App.tsx) ולא בתוכו, בדיוק
 * כמו UpdateNotice מול UpdateProvider — כדי למנוע ייבוא מעגלי בין
 * הקונטקסט לרכיב שהוא מרנדר.
 */
export function InstallGuideModal() {
  const { open, closeGuide, installed, canNativeInstall, promptNativeInstall } = useInstallGuide();
  const content = getInstallGuideContent(canNativeInstall);

  if (installed) return null;

  return (
    <GlassModal open={open} onClose={closeGuide} labelledBy="install-guide-title">
      <div className="flex flex-col p-5 pt-4">
        <div className="mb-3 flex items-start gap-3 pe-12">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-brand-50 text-brand-700">
            <content.icon width={22} height={22} />
          </span>
          <h2 id="install-guide-title" className="mt-1.5 text-lg font-bold leading-tight text-ink-900">
            {content.headline}
          </h2>
        </div>

        <p className="text-[15px] leading-relaxed text-ink-700">
          התקנה הופכת את RoomMate לאפליקציה אמיתית על המסך שלכם — פותחת מיד, בלי סרגלי
          דפדפן, ומאפשרת לקבל התראות.
        </p>

        {content.steps.length > 0 && (
          <ol className="mt-4 space-y-2.5">
            {content.steps.map((step, i) => (
              <li key={i} className="flex items-start gap-2.5 text-sm text-ink-700">
                <span
                  className="num grid h-6 w-6 shrink-0 place-items-center rounded-full
                             bg-ink-100 text-xs font-bold text-ink-600"
                >
                  {i + 1}
                </span>
                <span className="pt-0.5 leading-relaxed">{step}</span>
              </li>
            ))}
          </ol>
        )}

        {content.note && (
          <p className="mt-3 rounded-xl bg-brand-50 p-3 text-sm leading-relaxed text-brand-900">
            {content.note}
          </p>
        )}

        <div className="mt-5 flex gap-2">
          {content.offersNativeButton ? (
            <Button
              fullWidth
              onClick={() => {
                void promptNativeInstall();
                closeGuide();
              }}
            >
              התקנה עכשיו
            </Button>
          ) : (
            <Button variant="secondary" fullWidth onClick={closeGuide}>
              הבנתי, תודה
            </Button>
          )}
        </div>
      </div>
    </GlassModal>
  );
}
