import { lazy, Suspense } from 'react';
import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { RequireAuth, RequireGuest, RequireRoomMember } from './components/auth/guards';
import { RoomProvider } from './store/RoomContext';
import { TutorialProvider } from './store/TutorialContext';
import { TutorialModal } from './components/onboarding/TutorialModal';
import { FullPageSpinner } from './components/ui/Spinner';
import { ErrorBoundary } from './components/system/ErrorBoundary';

// מסכי הכניסה נטענים מיד — הם הראשונים שהמשתמש רואה
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';

// השאר בטעינה עצלה — חוסך ~40% מהמסלול הקריטי
const ForgotPasswordPage = lazy(() => import('./pages/ForgotPasswordPage'));
const OnboardingPage = lazy(() => import('./pages/OnboardingPage'));
const CreateRoomPage = lazy(() => import('./pages/CreateRoomPage'));
const JoinRoomPage = lazy(() => import('./pages/JoinRoomPage'));
const PendingApprovalPage = lazy(() => import('./pages/PendingApprovalPage'));
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const ItemsPage = lazy(() => import('./pages/ItemsPage'));
const BalancesPage = lazy(() => import('./pages/BalancesPage'));
const TasksPage = lazy(() => import('./pages/TasksPage'));
const AnnouncementsPage = lazy(() => import('./pages/AnnouncementsPage'));
const ChatPage = lazy(() => import('./pages/ChatPage'));
const ChatConversationPage = lazy(() => import('./pages/ChatConversationPage'));
const NotificationsPage = lazy(() => import('./pages/NotificationsPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const SettingsAccountPage = lazy(() => import('./pages/SettingsAccountPage'));
const SettingsRoomPage = lazy(() => import('./pages/SettingsRoomPage'));
const SettingsMembersPage = lazy(() => import('./pages/SettingsMembersPage'));
const SettingsNotificationsPage = lazy(() => import('./pages/SettingsNotificationsPage'));
const SettingsAboutPage = lazy(() => import('./pages/SettingsAboutPage'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'));

/**
 * גבול שגיאה ברמת המסך.
 *
 * ‼️ resetKey הוא ה-pathname: בלעדיו מסך שקרס היה נשאר במצב השגיאה גם
 * אחרי ניווט למסך אחר (גבול שגיאה לא מתאפס מעצמו), והמשתמש היה נתקע
 * במסך "משהו השתבש" עד רענון מלא. כאן כל ניווט מנקה את המצב.
 *
 * הגבול הזה תופס קריסות של מסך בודד; RootErrorBoundary ב-App.tsx תופס
 * את מה שקורס מחוץ לניתוב.
 */
function RouteBoundary() {
  const location = useLocation();
  return (
    <ErrorBoundary resetKey={location.pathname}>
      <Outlet />
    </ErrorBoundary>
  );
}

/** עוטף את כל מסכי החדר ב-RoomProvider, כדי שיהיה להם הקשר משותף */
function RoomLayout() {
  return (
    <RoomProvider>
      <TutorialProvider>
        <Outlet />
        <TutorialModal />
      </TutorialProvider>
    </RoomProvider>
  );
}

export function AppRoutes() {
  return (
    <Suspense fallback={<FullPageSpinner />}>
      <Routes>
        <Route element={<RouteBoundary />}>
          {/* ── אורחים ── */}
          <Route element={<RequireGuest />}>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          </Route>

          {/* ── דורש התחברות ── */}
          <Route element={<RequireAuth />}>
            <Route path="/onboarding" element={<OnboardingPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/rooms/create" element={<CreateRoomPage />} />
            <Route path="/rooms/join" element={<JoinRoomPage />} />
            <Route path="/rooms/:code/pending" element={<PendingApprovalPage />} />

            {/* ── בתוך חדר ── */}
            <Route path="/r/:code" element={<RoomLayout />}>
              <Route element={<RequireRoomMember />}>
                <Route index element={<DashboardPage />} />
                <Route path="items" element={<ItemsPage />} />
                <Route path="balances" element={<BalancesPage />} />
                <Route path="tasks" element={<TasksPage />} />
                <Route path="announcements" element={<AnnouncementsPage />} />
                <Route path="chat" element={<ChatPage />} />
                <Route path="chat/general" element={<ChatConversationPage />} />
                <Route path="chat/dm/:uid" element={<ChatConversationPage />} />
                <Route path="notifications" element={<NotificationsPage />} />
                <Route path="settings" element={<SettingsPage />} />
                <Route path="settings/account" element={<SettingsAccountPage />} />
                <Route path="settings/room" element={<SettingsRoomPage />} />
                <Route path="settings/members" element={<SettingsMembersPage />} />
                <Route path="settings/notifications" element={<SettingsNotificationsPage />} />
                <Route path="settings/about" element={<SettingsAboutPage />} />
              </Route>
            </Route>
          </Route>

          <Route path="/" element={<Navigate to="/onboarding" replace />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </Suspense>
  );
}
