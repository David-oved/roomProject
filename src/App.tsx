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
  // אין קונפיגורציה.
  // בפיתוח: הוראות טכניות מפורטות. בייצור: הודעה ידידותית בלי שום
  // פרט טכני — משתמש קצה לא אמור להתעסק בהגדרות שרת.
  if (!isFirebaseConfigured) {
    return import.meta.env.DEV ? <SetupRequiredPage /> : <ServiceUnavailablePage />;
  }

  return (
    <UpdateProvider>
      <ToastProvider>
        <ConfirmProvider>
        <AuthProvider>
          <ConnectionProvider>
            <HashRouter>
              <AppRoutes />
            </HashRouter>
            <UpdateNotice />
          </ConnectionProvider>
        </AuthProvider>
        </ConfirmProvider>
      </ToastProvider>
    </UpdateProvider>
  );
}
