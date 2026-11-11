import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { AppShell } from './components/AppShell';
import {
  CertificateRequestPage,
  DayDetailPage,
  DayInfoPage,
  DayMedalPage,
  LearnHomePage,
  WeekDetailPage,
} from './pages/LearnPages';
import {
  AlertDetailPage,
  RobotCompanionPage,
  RobotHistoryPage,
} from './pages/RobotPages';
import {
  GamePlayPage,
  GameResultsPage,
  GamesHubPage,
} from './pages/GamesPages';
import {
  IntegrationStatusPage,
  LibrarySectionPage,
} from './pages/LibraryAndSystemPages';
import {
  AdminConsolePage,
  LoginPage,
  OnboardingPage,
  ParentDashboardPage,
  ProfilePage,
} from './pages/P01AccountPages';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppShell>
          <Routes>
            <Route path="/" element={<Navigate to="/learn" replace />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/onboarding" element={<OnboardingPage />} />
            <Route path="/profile" element={<ProfilePage />} />

            {/* Module 1: Học và thực hành 28 ngày (P02) */}
            <Route path="/learn" element={<LearnHomePage />} />
            <Route path="/learn/weeks/:week" element={<WeekDetailPage />} />
            <Route path="/learn/days/:day" element={<DayDetailPage />} />
            <Route path="/learn/days/:day/info" element={<DayInfoPage />} />
            <Route path="/learn/days/:day/medal" element={<DayMedalPage />} />
            <Route path="/certificate-request" element={<CertificateRequestPage />} />

          {/* Module 2: Robot đồng hành & Lịch sử */}
          <Route path="/robot" element={<RobotCompanionPage />} />
          <Route path="/robot/history" element={<RobotHistoryPage />} />
          <Route path="/alerts/:alertId" element={<AlertDetailPage />} />

          {/* Module 3: Trò chơi rèn luyện */}
          <Route path="/games" element={<GamesHubPage />} />
          <Route path="/games/play/:gameId" element={<GamePlayPage />} />
          <Route path="/games/results/:attemptId" element={<GameResultsPage />} />

          {/* Thư viện nguồn & Các phân hệ Quản lý */}
          <Route path="/library/:section" element={<LibrarySectionPage />} />
          <Route path="/parent" element={<ParentDashboardPage />} />
          <Route path="/admin" element={<AdminConsolePage />} />
          <Route path="/integration-status" element={<IntegrationStatusPage />} />

          <Route path="*" element={<Navigate to="/learn" replace />} />
        </Routes>
      </AppShell>
    </BrowserRouter>
    </AuthProvider>
  );
}
