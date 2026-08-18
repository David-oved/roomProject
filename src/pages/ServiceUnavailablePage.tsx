import { AppLogo } from '../components/layout/AppLogo';

/**
 * מה שמשתמש קצה רואה אם השרת אינו מוגדר או אינו זמין.
 *
 * ‼️ בכוונה בלי שום פרט טכני: לא שמות משתני סביבה, לא קוד שגיאה,
 * לא הוראות התקנה. משתמש לא אמור לדעת ש-Firebase בכלל קיים, ובוודאי
 * לא לנסות לתקן משהו בעצמו. הפירוט הטכני מוצג רק בסביבת פיתוח —
 * ראו SetupRequiredPage.
 */
export default function ServiceUnavailablePage() {
  return (
    <div
      className="mx-auto flex min-h-[100dvh] max-w-sm flex-col items-center justify-center
                 gap-5 px-8 text-center"
      style={{
        paddingTop: 'calc(var(--safe-top) + 1rem)',
        paddingBottom: 'calc(var(--safe-bottom) + 1rem)',
      }}
    >
      <AppLogo showVersion={false} />

      <div>
        <h1 className="text-lg font-bold text-ink-900">האפליקציה לא זמינה כרגע</h1>
        <p className="mt-2 text-sm leading-relaxed text-ink-500">
          אנחנו עובדים על זה. נסו שוב בעוד כמה דקות.
        </p>
      </div>

      <button
        type="button"
        onClick={() => window.location.reload()}
        className="tap rounded-xl bg-brand-700 px-6 font-semibold text-white
                   transition active:scale-[.98] hover:bg-brand-800"
      >
        נסה שוב
      </button>
    </div>
  );
}
