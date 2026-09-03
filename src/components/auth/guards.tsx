import { lazy, Suspense } from 'react';
import { Navigate, Outlet, useLocation, useParams } from 'react-router-dom';
import { useAuth } from '../../store/AuthContext';
import { useRoom } from '../../store/RoomContext';
import { useSuspension } from '../../hooks/useAdminMessages';
import { isDeveloper } from '../../lib/developer';
import { FullPageSpinner } from '../ui/Spinner';
import { ErrorState } from '../ui/EmptyState';
import { PlainShell } from '../layout/AppShell';

// נטען עצלה — רוב המשתמשים לעולם לא יראו את המסך הזה
const SuspendedPage = lazy(() => import('../../pages/SuspendedPage'));

/**
 * ⚠️ שומרי הסף הם **חוויית משתמש בלבד**, לא אבטחה.
 * מי שיערוך את ה-JS בדפדפן יעקוף אותם — ויגלה שהשרת פשוט לא נותן לו
 * נתונים, כי האכיפה האמיתית היא ב-Security Rules.
 */

/** דורש התחברות — ושהמשתמש אינו חסום */
export function RequireAuth() {
  const { user, loading } = useAuth();
  const { isSuspended, loading: suspensionLoading } = useSuspension();
  const location = useLocation();

  if (loading) return <FullPageSpinner />;
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;

  /**
   * ‼️ ממתינים לתשובה על החסימה לפני שמציגים תוכן, אבל *רק* כשיש
   *    משתמש. אחרת מסכי האורח היו תלויים בקריאה שאין להם בכלל
   *    הרשאה לבצע.
   *
   * ‼️ שגיאת קריאה (רשת) אינה נחשבת לחסימה — ראו useSuspension.
   *    אחרת נפילת רשת רגעית הייתה נועלת משתמש תקין מחוץ לאפליקציה.
   */
  if (suspensionLoading) return <FullPageSpinner />;
  if (isSuspended) {
    return (
      <Suspense fallback={<FullPageSpinner />}>
        <SuspendedPage />
      </Suspense>
    );
  }

  return <Outlet />;
}

/** דורש שהמשתמש *לא* מחובר (מסכי התחברות) */
export function RequireGuest() {
  const { user, loading } = useAuth();

  if (loading) return <FullPageSpinner />;
  // כל החלטות הניתוב אחרי התחברות מרוכזות ב-OnboardingPage: חדר אחד
  // נכנס ישר, כמה חדרים מציגים בוחר, אין חדר מציעים ליצור או להצטרף.
  if (user) return <Navigate to="/onboarding" replace />;
  return <Outlet />;
}

/** דורש חברות פעילה בחדר שב-URL */
export function RequireRoomMember() {
  const { code } = useParams<{ code: string }>();
  const { myMembership, loading, metadata, error } = useRoom();

  if (loading) return <FullPageSpinner label="טוען את החדר…" />;

  /**
   * ‼️ "החיבור לא נוצר" אינו "החדר לא קיים".
   *
   * בלי ההבחנה הזו נוצרת לולאת ניתוב איטית: פסק הזמן של useRtdb מוריד
   * את loading בלי מטא-דאטה, השומר מפרש את זה כחדר שנעלם ומנווט ל-
   * onboarding, ושם משתמש עם חדר אחד מוחזר מיד לאותו חדר — וחוזר
   * חלילה כל עוד אין רשת. מסך עם כפתור "נסה שוב" הוא מה שהמשתמש
   * באמת צריך כאן.
   *
   * ‼️ מצומצם בכוונה לפסק זמן בלבד. permission_denied חייב להמשיך
   *    לנווט ל-onboarding — זו הזרימה של "הוסרת מהחדר", והיא נבדקת.
   */
  if (!metadata && error?.name === 'RtdbTimeoutError') {
    return (
      <PlainShell>
        <div className="flex flex-1 flex-col justify-center">
          <ErrorState message={error.message} onRetry={() => window.location.reload()} />
        </div>
      </PlainShell>
    );
  }

  if (!metadata) return <Navigate to="/onboarding" replace />;

  // ‼️ חובה להבחין בין "טרם היה חבר" לבין "היה והוסר".
  // בלי ההבחנה נוצרת לולאת ניתוב אינסופית: מסך ההמתנה קורא את המראה
  // האישית שעדיין רשום בה 'approved', מנווט חזרה לחדר, השומר מזהה
  // שהחברות אינה פעילה ומנווט שוב להמתנה — והמשתמש לכוד.
  if (myMembership) {
    if (myMembership.status === 'active') return <Outlet />;
    return <Navigate to="/onboarding" replace state={{ removedFrom: code }} />;
  }

  // אף פעם לא היה חבר — ייתכן שיש בקשה ממתינה
  return <Navigate to={`/rooms/${code}/pending`} replace />;
}

/**
 * דורש שהמשתמש המחובר הוא חשבון המפתח היחיד (ראו src/lib/developer.ts).
 *
 * ‼️ כמו כל שומר סף — זו נוחות ניתוב, לא ההגנה עצמה. מי שינווט לכאן
 *    ידנית בלי להיות המפתח פשוט חוזר ל-onboarding, בלי שום רמז שהמסך
 *    הזה בכלל קיים. ההגנה האמיתית על *הנתונים* יושבת ב-Security Rules.
 */
export function RequireDeveloper() {
  const { user, loading } = useAuth();

  if (loading) return <FullPageSpinner />;
  if (!isDeveloper(user?.email)) return <Navigate to="/onboarding" replace />;
  return <Outlet />;
}
