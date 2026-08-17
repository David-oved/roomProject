import { missingConfigKeys } from '../config/firebase';
import { AppLogo } from '../components/layout/AppLogo';

/**
 * מוצג כשמשתני הסביבה של Firebase חסרים.
 * עדיף מסך הסבר על פני מסך לבן או קריסה.
 */
export default function SetupRequiredPage() {
  return (
    <div
      className="mx-auto flex min-h-[100dvh] max-w-md flex-col justify-center gap-6 px-6"
      style={{
        paddingTop: 'calc(var(--safe-top) + 1rem)',
        paddingBottom: 'calc(var(--safe-bottom) + 1rem)',
      }}
    >
      <AppLogo />

      <div className="card p-5">
        <h1 className="text-lg font-bold text-ink-900">נדרשת הגדרת Firebase</h1>
        <p className="mt-2 text-sm leading-relaxed text-ink-600">
          האפליקציה נבנתה בהצלחה, אבל חסרים משתני הסביבה של Firebase. בלעדיהם אין חיבור
          לבסיס הנתונים.
        </p>

        <div className="mt-4 rounded-xl bg-ink-100 p-3">
          <p className="text-xs font-semibold text-ink-700">משתנים חסרים:</p>
          <ul className="mt-1.5 space-y-0.5" dir="ltr">
            {missingConfigKeys.map((k) => (
              <li key={k} className="num font-mono text-xs text-rose-700">
                {k}
              </li>
            ))}
          </ul>
        </div>

        <ol className="mt-4 space-y-2 text-sm text-ink-700">
          <li className="flex gap-2">
            <span className="num font-bold text-brand-700">1.</span>
            <span>
              העתיקו את <code className="rounded bg-ink-100 px-1 text-xs">.env.example</code> אל{' '}
              <code className="rounded bg-ink-100 px-1 text-xs">.env.local</code>
            </span>
          </li>
          <li className="flex gap-2">
            <span className="num font-bold text-brand-700">2.</span>
            <span>
              מלאו את הערכים מ-Firebase Console ← ⚙️ Project settings ← Your apps
            </span>
          </li>
          <li className="flex gap-2">
            <span className="num font-bold text-brand-700">3.</span>
            <span>
              הפעילו מחדש: <code className="rounded bg-ink-100 px-1 text-xs">npm run dev</code>
            </span>
          </li>
        </ol>

        <p className="mt-4 text-xs leading-relaxed text-ink-500">
          לפריסה ב-GitHub Pages: הוסיפו את אותם משתנים כ-Secrets במאגר
          (Settings ← Secrets and variables ← Actions).
        </p>

        <p className="mt-3 text-xs text-ink-400">
          מדריך מלא: <span className="num">docs/02-firebase-setup.md</span>
        </p>
      </div>
    </div>
  );
}
