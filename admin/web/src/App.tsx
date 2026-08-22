import { HashRouter, Route, Routes } from 'react-router-dom';
import { StoreProvider, useStore } from './lib/store';
import { Sidebar } from './components/Shell/Sidebar';
import { TopBar } from './components/Shell/TopBar';
import { Dashboard } from './components/Dashboard';
import { ActivityFeed } from './components/ActivityMonitoring/ActivityFeed';
import { RoomHealthDash } from './components/RoomMonitoring/RoomHealthDash';
import { RoomDetail } from './components/RoomMonitoring/RoomDetail';
import { UsersList } from './components/UserInsights/UsersList';
import { UserDetail } from './components/UserInsights/UserDetail';
import { UserAnalyticsDash } from './components/UserInsights/UserAnalyticsDash';
import { FeedbackInbox } from './components/FeedbackManagement/FeedbackInbox';
import { FeedbackDetail } from './components/FeedbackManagement/FeedbackDetail';
import { MessagingPage } from './components/MessagingSystem/MessagingPage';
import { AlertCenter } from './components/Alerts/AlertCenter';
import { ReportsPage } from './components/Reports/ReportsPage';
import { SystemPage } from './components/SystemPage';
import { Loading } from './components/ui/primitives';
import { AccessGate } from './components/Shell/AccessGate';

/**
 * שורש האפליקציה.
 *
 * ניתוב ב-Hash ולא ב-History: הקונסולה מוגשת גם מקובץ סטטי על ידי
 * השרת המקומי, ו-hash עובד זהה בשני המצבים בלי כללי rewrite.
 */
export default function App() {
  return (
    <HashRouter>
      <StoreProvider>
        <Shell />
      </StoreProvider>
    </HashRouter>
  );
}

function Shell() {
  const { loading, error, toasts, dismissToast } = useStore();

  if (error) return <AccessGate message={error} />;

  return (
    <div className="app">
      <Sidebar />
      <div className="main">
        <TopBar />
        <main className="content">
          {loading ? (
            <Loading rows={8} />
          ) : (
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/activity" element={<ActivityFeed />} />
              <Route path="/rooms" element={<RoomHealthDash />} />
              <Route path="/rooms/:code" element={<RoomDetail />} />
              <Route path="/users" element={<UsersList />} />
              <Route path="/users/:uid" element={<UserDetail />} />
              <Route path="/insights" element={<UserAnalyticsDash />} />
              <Route path="/feedback" element={<FeedbackInbox />} />
              {/* ‼️ החלונית חייבת להיות *בתוך* ה-Route ולא לצדו — רק כך
                  useParams רואה את המזהה. מחוץ ל-Routes היא נטענת בלי id. */}
              <Route
                path="/feedback/:id"
                element={
                  <>
                    <FeedbackInbox />
                    <FeedbackDetail />
                  </>
                }
              />
              <Route path="/messages" element={<MessagingPage />} />
              <Route path="/alerts" element={<AlertCenter />} />
              <Route path="/reports" element={<ReportsPage />} />
              <Route path="/system" element={<SystemPage />} />
              <Route path="*" element={<Dashboard />} />
            </Routes>
          )}
        </main>
      </div>

      <div className="toast-stack">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.kind}`} onClick={() => dismissToast(t.id)}>
            <span>{t.kind === 'error' ? '⚠️' : t.kind === 'success' ? '✅' : 'ℹ️'}</span>
            <span>{t.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
