import React, { useEffect, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  BookOpen,
  Bot,
  Gamepad2,
  Library,
  Menu,
  ShieldCheck,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import { PWAInstallButton, OfflineConnectivityBanner } from './PWAInstallButton';
import { PostureDynamicIsland } from './LivePostureCameraPanel';
import { EXTERNAL_MENU_LINKS, UI_BRANDING_ASSETS } from '../data/sourceMapping';
import { useAuth } from '../context/AuthContext';

interface AppShellProps {
  children: React.ReactNode;
}

const LIBRARY_SUBMENUS = [
  { to: '/library/flashcard', label: 'Flashcard 28 ngày' },
  { to: '/library/press', label: 'Báo chí truyền thông' },
  { to: '/library/team', label: 'Đội ngũ phát triển' },
  { to: '/library/certificates', label: 'Chứng nhận chuyên môn' },
  { to: '/library/community', label: 'Cộng đồng BrightUpGenZ' },
  { to: '/library/support', label: 'Hỗ trợ & Liên hệ' },
  { to: '/library/bot-ai', label: 'Trợ lý BOT AI' },
] as const;

export const AppShell: React.FC<AppShellProps> = ({ children }) => {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const {
    uid,
    userRecord,
    effectiveRole,
    activeStudent,
  } = useAuth();

  useEffect(() => {
    const onSwNavigate = (ev: MessageEvent) => {
      if (ev.data?.type === 'BUGZ_NAVIGATE_DEEP_LINK' && typeof ev.data.path === 'string') {
        navigate(ev.data.path);
      }
    };
    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', onSwNavigate);
    }
    return () => {
      if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
        navigator.serviceWorker.removeEventListener('message', onSwNavigate);
      }
    };
  }, [navigate]);

  const isLearnActive =
    location.pathname === '/' ||
    location.pathname.startsWith('/learn') ||
    location.pathname.startsWith('/certificate-request');
  const isRobotActive =
    location.pathname.startsWith('/robot') || location.pathname.startsWith('/alerts');
  const isGamesActive = location.pathname.startsWith('/games');

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      {/* Dynamic Island Thông báo Tư thế khi Camera chạy nền tại các trang khác */}
      <PostureDynamicIsland />

      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-2 border-b border-teal-900/10 bg-white/95 px-3 shadow-2xs backdrop-blur-xs sm:px-4 lg:gap-8 lg:px-8">
        {/* Zone 1: Brand Wordmark + Official Logo */}
        <Link
          to="/learn"
          className="inline-flex items-center gap-2.5 text-base sm:text-lg font-extrabold tracking-tight text-teal-900 whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
        >
          <img
            src={UI_BRANDING_ASSETS.logo1Url}
            alt="Logo BrightUpGenZ"
            className="h-8 w-8 rounded-lg border border-teal-100 bg-teal-50/50 p-0.5 object-contain"
          />
          <span>BUGZ BrightUpGenZ</span>
        </Link>

        {/* Zone 2: Primary Desktop Navigation Links */}
        <nav aria-label="Điều hướng chính" className="hidden lg:flex items-center gap-6 text-sm font-medium text-slate-600">
          <NavLink
            to="/learn"
            className={() =>
              `py-1 transition-colors whitespace-nowrap shrink-0 border-b-2 ${
                isLearnActive
                  ? 'border-teal-700 font-bold text-teal-900'
                  : 'border-transparent hover:text-teal-800'
              }`
            }
          >
            Học 28 ngày
          </NavLink>
          <NavLink
            to="/robot"
            className={() =>
              `py-1 transition-colors whitespace-nowrap shrink-0 border-b-2 ${
                isRobotActive
                  ? 'border-teal-700 font-bold text-teal-900'
                  : 'border-transparent hover:text-teal-800'
              }`
            }
          >
            Robot đồng hành
          </NavLink>
          <NavLink
            to="/games"
            className={() =>
              `py-1 transition-colors whitespace-nowrap shrink-0 border-b-2 ${
                isGamesActive
                  ? 'border-teal-700 font-bold text-teal-900'
                  : 'border-transparent hover:text-teal-800'
              }`
            }
          >
            Trò chơi rèn luyện
          </NavLink>
          <NavLink
            to="/library/flashcard"
            className={({ isActive }) =>
              `py-1 transition-colors whitespace-nowrap shrink-0 border-b-2 ${
                isActive || location.pathname.startsWith('/library')
                  ? 'border-teal-700 font-bold text-teal-900'
                  : 'border-transparent hover:text-teal-800'
              }`
            }
          >
            Thư viện
          </NavLink>
          <NavLink
            to="/parent"
            className={({ isActive }) =>
              `py-1 transition-colors whitespace-nowrap shrink-0 border-b-2 ${
                isActive
                  ? 'border-teal-700 font-bold text-teal-900'
                  : 'border-transparent hover:text-teal-800'
              }`
            }
          >
            Hồ sơ &amp; Thiết bị
          </NavLink>
          {effectiveRole === 'superadmin' && (
            <NavLink
              to="/admin"
              className={({ isActive }) =>
                `py-1 transition-colors whitespace-nowrap shrink-0 border-b-2 ${
                  isActive
                    ? 'border-teal-700 font-bold text-teal-900'
                    : 'border-transparent hover:text-teal-800'
                }`
              }
            >
              Superadmin
            </NavLink>
          )}
        </nav>

        {/* Zone 3: Primary Action & Menu Trigger */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <Link
            to="/login"
            className={`inline-flex min-h-[40px] items-center justify-center rounded-xl px-4 py-2 text-xs font-bold transition-colors whitespace-nowrap shrink-0 shadow-2xs ${
              uid
                ? 'bg-gradient-to-r from-teal-900 via-teal-800 to-slate-900 text-white hover:from-teal-800 hover:to-slate-800'
                : 'bg-amber-400 text-slate-950 hover:bg-amber-300'
            }`}
          >
            {uid
              ? `${userRecord?.full_name?.split(' ')[0] || 'Học sinh'}${effectiveRole === 'superadmin' ? ' (Superadmin)' : ' (Học sinh)'}`
              : 'Đăng nhập'}
          </Link>
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            aria-label="Mở menu điều hướng"
            className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-100 lg:hidden"
          >
            <Menu className="h-5 w-5" />
          </button>
        </div>
      </header>

      {/* Main Workspace with Desktop Sidebar + Content Canvas */}
      <div className="mx-auto flex w-full max-w-7xl flex-1 gap-8 px-4 py-6 pb-24 lg:px-8 lg:pb-12">
        {/* Desktop Left Sidebar */}
        <aside aria-label="Menu phụ và công cụ" className="hidden lg:flex lg:w-64 lg:shrink-0 lg:flex-col lg:gap-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
            {/* Signature Robot-style Mini Banner inside Sidebar */}
            <div className="mb-4 rounded-xl bg-gradient-to-br from-teal-900 via-teal-800 to-slate-900 p-3.5 text-white">
              <div className="text-[11px] font-semibold text-teal-200">
                Giữ Lưng Thẳng · Mắt Sáng
              </div>
              <div className="mt-0.5 text-xs font-bold text-white truncate">
                {activeStudent ? `Hồ sơ: ${activeStudent.display_name}` : 'Đồng hành mỗi ngày'}
              </div>
            </div>

            <div className="text-xs font-bold uppercase tracking-wider text-teal-800">
              Hành trình rèn luyện
            </div>
            <div className="mt-2.5 flex flex-col gap-1">
              <Link
                to="/learn"
                className={`flex min-h-[44px] items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors ${
                  isLearnActive
                    ? 'bg-gradient-to-r from-teal-900 to-teal-800 font-semibold text-white shadow-2xs'
                    : 'text-slate-700 hover:bg-teal-50/60 hover:text-teal-900'
                }`}
              >
                <BookOpen
                  className={`h-4 w-4 shrink-0 ${isLearnActive ? 'text-amber-300' : 'text-teal-700'}`}
                  aria-hidden="true"
                />
                <span>Học &amp; Thực hành 28 ngày</span>
              </Link>
              <Link
                to="/robot"
                className={`flex min-h-[44px] items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors ${
                  isRobotActive
                    ? 'bg-gradient-to-r from-teal-900 to-teal-800 font-semibold text-white shadow-2xs'
                    : 'text-slate-700 hover:bg-teal-50/60 hover:text-teal-900'
                }`}
              >
                <Bot
                  className={`h-4 w-4 shrink-0 ${isRobotActive ? 'text-amber-300' : 'text-teal-700'}`}
                  aria-hidden="true"
                />
                <span>Robot đồng hành</span>
              </Link>
              <Link
                to="/games"
                className={`flex min-h-[44px] items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors ${
                  isGamesActive
                    ? 'bg-gradient-to-r from-teal-900 to-teal-800 font-semibold text-white shadow-2xs'
                    : 'text-slate-700 hover:bg-teal-50/60 hover:text-teal-900'
                }`}
              >
                <Gamepad2
                  className={`h-4 w-4 shrink-0 ${isGamesActive ? 'text-amber-300' : 'text-teal-700'}`}
                  aria-hidden="true"
                />
                <span>Trò chơi rèn luyện</span>
              </Link>
            </div>

            <div className="my-4 border-t border-slate-100" />

            <div className="text-xs font-bold uppercase tracking-wider text-teal-800">
              Thư viện &amp; Cộng đồng
            </div>
            <div className="mt-2 flex flex-col gap-0.5">
              {LIBRARY_SUBMENUS.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    `flex min-h-[40px] items-center rounded-xl px-3 py-1.5 text-xs font-medium transition-colors ${
                      isActive
                        ? 'bg-teal-50 font-bold text-teal-900 border border-teal-200/70'
                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                    }`
                  }
                >
                  {item.label}
                </NavLink>
              ))}
            </div>

            <div className="my-4 border-t border-slate-100" />

            <div className="text-xs font-bold uppercase tracking-wider text-teal-800">
              Cá nhân &amp; Quản lý
            </div>
            <div className="mt-2 flex flex-col gap-1">
              <NavLink
                to="/profile"
                className={({ isActive }) =>
                  `flex min-h-[40px] items-center gap-2.5 rounded-xl px-3 py-1.5 text-xs font-medium transition-colors ${
                    isActive
                      ? 'bg-teal-50 font-bold text-teal-900 border border-teal-200/70'
                      : 'text-slate-600 hover:bg-slate-50'
                  }`
                }
              >
                <UserCheck className="h-4 w-4 shrink-0 text-teal-700" aria-hidden="true" />
                <span>Thông tin cá nhân</span>
              </NavLink>
              <NavLink
                to="/parent"
                className={({ isActive }) =>
                  `flex min-h-[40px] items-center gap-2.5 rounded-xl px-3 py-1.5 text-xs font-medium transition-colors ${
                    isActive
                      ? 'bg-teal-50 font-bold text-teal-900 border border-teal-200/70'
                      : 'text-slate-600 hover:bg-slate-50'
                  }`
                }
              >
                <Users className="h-4 w-4 shrink-0 text-teal-700" aria-hidden="true" />
                <span>Hồ sơ &amp; Thiết bị</span>
              </NavLink>
              <NavLink
                to="/admin"
                className={({ isActive }) =>
                  `flex min-h-[40px] items-center gap-2.5 rounded-xl px-3 py-1.5 text-xs font-medium transition-colors ${
                    isActive
                      ? 'bg-gradient-to-r from-teal-900 to-teal-800 font-bold text-white shadow-2xs'
                      : 'text-slate-600 hover:bg-slate-50'
                  }`
                }
              >
                <ShieldCheck className="h-4 w-4 shrink-0 text-teal-600" aria-hidden="true" />
                <span>Trung tâm Superadmin</span>
              </NavLink>
            </div>

            <div className="mt-5 pt-4 border-t border-slate-100">
              <PWAInstallButton />
            </div>
          </div>
        </aside>

        {/* Main View Outlet */}
        <main className="min-w-0 flex-1">{children}</main>
      </div>

      {/* Mobile Drawer for Secondary Menus */}
      {drawerOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Menu mở rộng"
          className="fixed inset-0 z-50 flex justify-end bg-slate-900/50 backdrop-blur-xs lg:hidden"
        >
          <div className="flex h-full w-80 max-w-full flex-col justify-between bg-white p-5 shadow-xl overflow-y-auto">
            <div>
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <span className="text-base font-bold text-teal-800">Menu BrightUpGenZ</span>
                <button
                  type="button"
                  onClick={() => setDrawerOpen(false)}
                  aria-label="Đóng menu"
                  className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="mt-4 space-y-1">
                <div className="px-2 py-1 text-xs font-semibold text-slate-500">Thư viện &amp; Cộng đồng</div>
                {LIBRARY_SUBMENUS.map((item) => (
                  <Link
                    key={item.to}
                    to={item.to}
                    onClick={() => setDrawerOpen(false)}
                    className="flex min-h-[44px] items-center rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
                  >
                    {item.label}
                  </Link>
                ))}
              </div>

              <div className="mt-4 border-t border-slate-100 pt-4 space-y-1">
                <div className="px-2 py-1 text-xs font-semibold text-slate-500">Cá nhân &amp; Quản lý</div>
                <Link
                  to="/profile"
                  onClick={() => setDrawerOpen(false)}
                  className="flex min-h-[44px] items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
                >
                  <UserCheck className="h-4 w-4 text-teal-700" />
                  <span>Thông tin cá nhân</span>
                </Link>
                <Link
                  to="/parent"
                  onClick={() => setDrawerOpen(false)}
                  className="flex min-h-[44px] items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
                >
                  <Users className="h-4 w-4 text-teal-700" />
                  <span>Hồ sơ &amp; Thiết bị</span>
                </Link>
                <Link
                  to="/admin"
                  onClick={() => setDrawerOpen(false)}
                  className="flex min-h-[44px] items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
                >
                  <ShieldCheck className="h-4 w-4 text-teal-700" />
                  <span>Trung tâm Superadmin</span>
                </Link>
              </div>
            </div>

            <div className="mt-6 border-t border-slate-100 pt-4 flex flex-col gap-3">
              <PWAInstallButton />
              <a
                href={EXTERNAL_MENU_LINKS.communityFacebookUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-slate-500 hover:text-slate-900 underline"
              >
                Trang Cộng đồng Facebook BrightUpGenZ
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Mobile Fixed Bottom Tab Bar */}
      <nav
        aria-label="Ba phân hệ chính trên di động"
        className="fixed bottom-0 left-0 right-0 z-40 grid h-16 grid-cols-4 items-center border-t border-slate-200 bg-white/95 backdrop-blur-xs lg:hidden"
      >
        <Link
          to="/learn"
          className={`flex h-full min-h-[44px] flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors ${
            isLearnActive ? 'text-teal-800 font-bold' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <BookOpen className="h-5 w-5" aria-hidden="true" />
          <span className="whitespace-nowrap">Học 28 ngày</span>
        </Link>
        <Link
          to="/robot"
          className={`flex h-full min-h-[44px] flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors ${
            isRobotActive ? 'text-teal-800 font-bold' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Bot className="h-5 w-5" aria-hidden="true" />
          <span className="whitespace-nowrap">Robot</span>
        </Link>
        <Link
          to="/games"
          className={`flex h-full min-h-[44px] flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors ${
            isGamesActive ? 'text-teal-800 font-bold' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Gamepad2 className="h-5 w-5" aria-hidden="true" />
          <span className="whitespace-nowrap">Trò chơi</span>
        </Link>
        <Link
          to="/library/flashcard"
          className={`flex h-full min-h-[44px] flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors ${
            location.pathname.startsWith('/library')
              ? 'text-teal-800 font-bold'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Library className="h-5 w-5" aria-hidden="true" />
          <span className="whitespace-nowrap">Thư viện</span>
        </Link>
      </nav>

      <OfflineConnectivityBanner />
    </div>
  );
};
