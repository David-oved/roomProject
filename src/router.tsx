import { lazy, Suspense } from 'react';
import { Navigate, Outlet, Route, Routes, useLocation, useParams } from 'react-router-dom';
import { RequireAuth, RequireDeveloper, RequireGuest, RequireRoomMember } from './components/auth/guards';
import { RoomProvider } from './store/RoomContext';
import { TutorialProvider } from './store/TutorialContext';
import { TutorialModal } from './components/onboarding/TutorialModal';
import { FullPageSpinner } from './components/ui/Spinner';
import { ErrorBoundary } from './components/system/ErrorBoundary';
import { BottomNav } from './components/layout/BottomNav';
import { OfflineBanner } from './components/layout/OfflineBanner';
import { useLiveNotifications } from './hooks/useLiveNotifications';
import { useChatWatcher } from './hooks/useChatWatcher';
import { isRoomTabRoot } from './lib/roomNav';

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
const TripPage = lazy(() => import('./pages/TripPage'));
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
const SettingsDisplayPage = lazy(() => import('./pages/SettingsDisplayPage'));
const SettingsAboutPage = lazy(() => import('./pages/SettingsAboutPage'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));
const AdminMessagesPage = lazy(() => import('./pages/AdminMessagesPage'));
const FeedbackPage = lazy(() => import('./pages/FeedbackPage'));
const DeveloperPage = lazy(() => import('./pages/DeveloperPage'));
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
        <RoomShell />
        <TutorialModal />
      </TutorialProvider>
    </RoomProvider>
  );
}

/**
 * המסגרת הקבועה של החדר — הרקע, ה-banner, וסרגל הניווט התחתון — מסביב
 * ל-<Outlet/> המשותף לכל מסכי החדר.
 *
 * ‼️ קודם כל אחד מ-15+ מסכי החדר רינדר AppShell נפרד עם BottomNav
 * משלו. מבחינת React, זה עץ-רכיבים *שונה* בכל Route — כל מעבר טאב
 * הרס את מופע ה-BottomNav הקודם ובנה אחד חדש מאפס, כולל אובדן כל
 * מצב הבועה הגולשת שלו (ותוך כך ביטל כל טרנזישן/אנימציה על מיקומה —
 * זה בדיוק מה שגרם לתחושה ש"אין אנימציה" במעבר טאבים רגיל, לעומת
 * גרירה שנשארת בתוך מופע אחד ולכן עבדה). הסרגל וההתראות עוברים לכאן,
 * מעל ה-Outlet, כדי שהם יישארו רכיב אחד יציב לכל אורך השהייה בחדר —
 * רק תוכן העמוד (ה-Outlet) מוחלף בכל ניווט.
 *
 * ‼️ הסרגל מוצג רק בשורשי הטאבים עצמם (ראו isRoomTabRoot) — לא בכל מסך
 * תחת /r/:code. מסכי-צלילה כמו הגדרות, התראות או שיחת צ'אט בודדת מסתירים
 * אותו, כמו tab bar שנעלם במסך שנדחף מעל טאב.
 */
function RoomShell() {
  const { code } = useParams<{ code: string }>();
  const location = useLocation();
  // התראה מיידית כשהאפליקציה ברקע — בלי להמתין לשרת
  useLiveNotifications();
  // עוקב אחרי כל שיחות הצ'אט: מסמן delivered, סופר לא-נקרא, וטוסט מקומי
  const { unreadTotal } = useChatWatcher();
  const showNav = isRoomTabRoot(location.pathname, code);

  return (
    <div className="relative min-h-[100dvh] overflow-x-clip bg-ink-50">
      <OfflineBanner />
      <Outlet />
      {showNav && <BottomNav unreadChat={unreadTotal} />}
    </div>
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
            {/* ‼️ מחוץ ל-RoomLayout בכוונה: הודעה ממנהל המערכת ופנייה אליו
                שייכות למשתמש ולא לחדר. מי שנמצא בשלושה חדרים אמור לראות
                הודעה פעם אחת, ומי שעזב את כולם עדיין צריך לקבל תשובה
                לפנייה ששלח. */}
            <Route path="/messages" element={<AdminMessagesPage />} />
            <Route path="/feedback" element={<FeedbackPage />} />

            {/* גלוי ונגיש רק לחשבון המפתח (src/lib/developer.ts) — ראו
                docs/14-developer-panel.md. גם כאן: מחוץ ל-RoomLayout,
                כי המידע חוצה-חדרים ולא שייך לחדר מסוים. */}
            <Route element={<RequireDeveloper />}>
              <Route path="/developer" element={<DeveloperPage />} />
            </Route>
            <Route path="/rooms/create" element={<CreateRoomPage />} />
            <Route path="/rooms/join" element={<JoinRoomPage />} />
            <Route path="/rooms/:code/pending" element={<PendingApprovalPage />} />

            {/* ── בתוך חדר ── */}
            <Route path="/r/:code" element={<RoomLayout />}>
              <Route element={<RequireRoomMember />}>
                <Route index element={<DashboardPage />} />
                <Route path="items" element={<ItemsPage />} />
                <Route path="trip" element={<TripPage />} />
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
                <Route path="settings/display" element={<SettingsDisplayPage />} />
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
