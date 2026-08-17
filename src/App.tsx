import { HashRouter } from 'react-router-dom';
import { AuthProvider } from './store/AuthContext';
import { ConnectionProvider } from './store/ConnectionContext';
import { ToastProvider } from './store/ToastContext';
import { UpdateProvider } from './store/UpdateContext';
import { UpdateNotice } from './components/system/UpdateNotice';
import { AppRoutes } from './router';
import { isFirebaseConfigured } from './config/firebase';
import SetupRequiredPage from './pages/SetupRequiredPage';

/**
 * HashRouter ולא BrowserRouter.
 *
 * האפליקציה מתארחת ב-GitHub Pages, שאינו תומך ב-rewrite של SPA.
 * עם BrowserRouter, רענון בכתובת /r/ABC123 היה מחזיר 404 — וזה קורה
 * גם בכל קישור הצטרפות שנשלח בוואטסאפ.
 */
export default function App() {
  // אין קונפיגורציה — מסך הסבר במקום מסך לבן
  if (!isFirebaseConfigured) return <SetupRequiredPage />;

  return (
    <UpdateProvider>
      <ToastProvider>
        <AuthProvider>
          <ConnectionProvider>
            <HashRouter>
              <AppRoutes />
            </HashRouter>
            <UpdateNotice />
          </ConnectionProvider>
        </AuthProvider>
      </ToastProvider>
    </UpdateProvider>
  );
}
