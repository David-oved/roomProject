import { lazy, Suspense } from 'react';
import { Navigate, Outlet, Route, Routes } from 'react-router-dom';
import {
  RequireAdmin,
  RequireAuth,
  RequireGuest,
  RequireRoomMember,
} from './components/auth/guards';
import { RoomProvider } from './store/RoomContext';
import { FullPageSpinner } from './components/ui/Spinner';

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
const MembersPage = lazy(() => import('./pages/MembersPage'));
const NotificationsPage = lazy(() => import('./pages/NotificationsPage'));
const RoomSettingsPage = lazy(() => import('./pages/RoomSettingsPage'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'));

/** עוטף את כל מסכי החדר ב-RoomProvider, כדי שיהיה להם הקשר משותף */
function RoomLayout() {
  return (
    <RoomProvider>
      <Outlet />
    </RoomProvider>
  );
}

export function AppRoutes() {
  return (
    <Suspense fallback={<FullPageSpinner />}>
      <Routes>
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
              <Route path="members" element={<MembersPage />} />
              <Route path="notifications" element={<NotificationsPage />} />

              <Route element={<RequireAdmin />}>
                <Route path="settings" element={<RoomSettingsPage />} />
              </Route>
            </Route>
          </Route>
        </Route>

        <Route path="/" element={<Navigate to="/onboarding" replace />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  );
}
