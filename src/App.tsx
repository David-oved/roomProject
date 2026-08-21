import { HashRouter } from 'react-router-dom';
import { AuthProvider } from './store/AuthContext';
import { ConnectionProvider } from './store/ConnectionContext';
import { ToastProvider } from './store/ToastContext';
import { ConfirmProvider } from './store/ConfirmContext';
import { HintProvider } from './store/HintContext';
import { InstallGuideProvider } from './store/InstallGuideContext';
import { InstallGuideModal } from './components/onboarding/InstallGuideModal';
import { UpdateProvider } from './store/UpdateContext';
import { UpdateNotice } from './components/system/UpdateNotice';
import { RootErrorBoundary } from './components/system/ErrorBoundary';
import { AppRoutes } from './router';
import { isFirebaseConfigured } from './config/firebase';
import SetupRequiredPage from './pages/SetupRequiredPage';
import ServiceUnavailablePage from './pages/ServiceUnavailablePage';

/**
 * HashRouter ולא BrowserRouter.
 *
 * האפליקציה מתארחת ב-GitHub Pages, שאינו תומך ב-rewrite של SPA.
 * עם BrowserRouter, רענון בכתובת /r/ABC123 היה מחזיר 404 — וזה קורה
 * גם בכל קישור הצטרפות שנשלח בוואטסאפ.
 */
export default function App() {
  return (
    /**
     * ‼️ UpdateProvider ו-UpdateNotice עוטפים את הכל, ותמיד נטענים.
     *
     * בגרסה קודמת בדיקת הקונפיגורציה החזירה מסך *לפני* הספק הזה.
     * התוצאה הייתה מלכודת: גרסה שהגיעה למצב "לא מוגדר" לא הריצה את
     * בדיקת העדכונים, ולכן לא יכלה לעולם לקבל את התיקון — המשתמש
     * נשאר תקוע בה לצמיתות. מנגנון העדכון הוא פתח המילוט של
     * האפליקציה, ולכן הוא חייב לרוץ בכל מצב שהוא.
     */
    <UpdateProvider>
      <ToastProvider>
        <ConfirmProvider>
          {/*
            ‼️ גבול השגיאה נמצא *בתוך* UpdateProvider ולא עוטף אותו, ו-
            UpdateNotice נשאר מחוצה לו — מאותו טעם בדיוק שמתואר למעלה.
            אם הגבול היה עוטף גם את מנגנון העדכון, קריסה הייתה מפילה יחד
            איתה את פתח המילוט, והמשתמש היה נתקע בגרסה השבורה לנצח.
            כך: גם אם כל האפליקציה קרסה, ההודעה על גרסה חדשה עדיין מוצגת.
          */}
          <RootErrorBoundary>
            {isFirebaseConfigured ? (
              <AuthProvider>
                <ConnectionProvider>
                  {/* ‼️ ברמת השורש, לא בתוך RoomLayout כמו TutorialProvider —
                      הערות-הקשר חלות על כל מסך באפליקציה, כולל התחברות
                      ויצירת/הצטרפות לחדר, שקודמים לכניסה לחדר עצמו. */}
                  <HintProvider>
                    {/* גם היא ברמת השורש: ההרשמה, שמפעילה את הפתיחה
                        האוטומטית הראשונה שלה, קודמת לכניסה לחדר */}
                    <InstallGuideProvider>
                      <HashRouter>
                        <AppRoutes />
                      </HashRouter>
                      <InstallGuideModal />
                    </InstallGuideProvider>
                  </HintProvider>
                </ConnectionProvider>
              </AuthProvider>
            ) : import.meta.env.DEV ? (
              // בפיתוח: הוראות טכניות מפורטות
              <SetupRequiredPage />
            ) : (
              // בייצור: הודעה ידידותית בלי שום פרט טכני
              <ServiceUnavailablePage />
            )}
          </RootErrorBoundary>

          <UpdateNotice />
        </ConfirmProvider>
      </ToastProvider>
    </UpdateProvider>
  );
}
