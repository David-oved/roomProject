import { HashRouter } from 'react-router-dom';
import { AuthProvider } from './store/AuthContext';
import { ConnectionProvider } from './store/ConnectionContext';
import { ToastProvider } from './store/ToastContext';
import { ConfirmProvider } from './store/ConfirmContext';
import { UpdateProvider } from './store/UpdateContext';
import { UpdateNotice } from './components/system/UpdateNotice';
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
          {isFirebaseConfigured ? (
            <AuthProvider>
              <ConnectionProvider>
                <HashRouter>
                  <AppRoutes />
                </HashRouter>
              </ConnectionProvider>
            </AuthProvider>
          ) : import.meta.env.DEV ? (
            // בפיתוח: הוראות טכניות מפורטות
            <SetupRequiredPage />
          ) : (
            // בייצור: הודעה ידידותית בלי שום פרט טכני
            <ServiceUnavailablePage />
          )}

          <UpdateNotice />
        </ConfirmProvider>
      </ToastProvider>
    </UpdateProvider>
  );
}
