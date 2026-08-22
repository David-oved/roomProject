import { useState } from 'react';
import { Button } from '../ui/Button';
import { CloseIcon, DeviceIcon } from '../ui/icons';
import { useInstallGuide } from '../../store/InstallGuideContext';
import { getInstallPromptDismissed, setInstallPromptDismissed } from '../../lib/prefs';
import { useHintRef } from '../../store/HintContext';

/**
 * הזמנה להתקין את האפליקציה, במסך הבית.
 *
 * דגל הסגירה נשמר במכשיר הזה בלבד (ולא לצמיתות בשרת) — אם המשתמש
 * מחליף מכשיר, ההצעה תופיע שוב שם, וזה בדיוק הרצוי.
 */
export function InstallPrompt() {
  const { installed, openGuide } = useInstallGuide();
  const [dismissed, setDismissed] = useState(getInstallPromptDismissed);
  const openHintRef = useHintRef<HTMLButtonElement>(
    'installPrompt.open',
    'פותח הסבר מותאם אישית איך להתקין את האפליקציה למסך הבית, לפי הדפדפן שלכם'
  );

  if (installed || dismissed) return null;

  function hide() {
    setDismissed(true);
    setInstallPromptDismissed();
  }

  return (
    <section className="relative rounded-card border border-brand-200 bg-gradient-to-b from-brand-50 to-white p-4">
      <button
        onClick={hide}
        aria-label="סגירה"
        className="tap absolute end-1 top-1 grid place-items-center rounded-full
                   text-ink-500 transition hover:bg-black/5 hover:text-ink-600"
      >
        <CloseIcon width={17} height={17} />
      </button>

      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand-100 text-brand-700"
        >
          <DeviceIcon width={20} height={20} />
        </span>

        <div className="min-w-0 flex-1 pe-6">
          <h3 className="font-bold text-ink-900">התקינו את RoomMate</h3>
          <p className="mt-1 text-sm leading-relaxed text-ink-600">
            הוסיפו למסך הבית לפתיחה מהירה בלחיצה אחת, בלי סרגלי דפדפן.
          </p>

          <Button ref={openHintRef} className="mt-3" size="sm" onClick={openGuide}>
            איך מתקינים
          </Button>
        </div>
      </div>
    </section>
  );
}
