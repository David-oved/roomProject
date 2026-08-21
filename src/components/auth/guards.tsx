import { lazy, Suspense } from 'react';
import { Navigate, Outlet, useLocation, useParams } from 'react-router-dom';
import { useAuth } from '../../store/AuthContext';
import { useRoom } from '../../store/RoomContext';
import { useSuspension } from '../../hooks/useAdminMessages';
import { FullPageSpinner } from '../ui/Spinner';

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
  const { myMembership, loading, metadata } = useRoom();

  if (loading) return <FullPageSpinner label="טוען את החדר…" />;

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
