import { Navigate, Outlet, useLocation, useParams } from 'react-router-dom';
import { useAuth } from '../../store/AuthContext';
import { useRoom } from '../../store/RoomContext';
import { FullPageSpinner } from '../ui/Spinner';

/**
 * ⚠️ שומרי הסף הם **חוויית משתמש בלבד**, לא אבטחה.
 * מי שיערוך את ה-JS בדפדפן יעקוף אותם — ויגלה שהשרת פשוט לא נותן לו
 * נתונים, כי האכיפה האמיתית היא ב-Security Rules.
 */

/** דורש התחברות */
export function RequireAuth() {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <FullPageSpinner />;
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
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

/** דורש הרשאת מנהל */
export function RequireAdmin() {
  const { code } = useParams<{ code: string }>();
  const { isAdmin, loading } = useRoom();

  if (loading) return <FullPageSpinner />;
  if (!isAdmin) return <Navigate to={`/r/${code}`} replace />;
  return <Outlet />;
}
