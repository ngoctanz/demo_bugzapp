import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  BookOpen,
  CheckCircle2,
  ClipboardList,
  ExternalLink,
  Gamepad2,
  KeyRound,
  Library,
  LogOut,
  PlusCircle,
  RefreshCw,
  Settings,
  ShieldAlert,
  Sparkles,
  UserPlus,
  Users,
  Wrench,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import type { UserRole } from '../types/bugz';
import type {
  AuditLogRecord,
  CaptureMetadataRecord,
  CertificateRequestRecord,
  ExcelDeviceRecord,
  NotificationJobRecord,
  StudentRecord,
} from '../domain/p01RbacStore';
import {
  EXTERNAL_LINKS,
  LEARNING_DAYS_28,
  PRESS_LINKS,
  PROFESSIONAL_CERTIFICATES,
  RUNTIME_FULL_FLASHCARD_PATH,
  SOURCE_VERIFICATION_REPORT,
  TEAM_MEMBERS,
  type LearningDayManifestItem,
  type SourceVerificationEntry,
} from '../data/sourceMapping';
import { NotificationCenterPanel } from '../components/NotificationCenterPanel';
import { AtlasIllustration } from '../components/AtlasIllustration';
import {
  GAME_BLUEPRINTS,
  type GentleReminderTemplateRecord,
  type IllustrationId,
  type PublicQuestionRecord,
} from '../domain/p05GameEngine';
import { RobotAdminTechnicalPanel } from './RobotPages';
import { IntegrationStatusPage } from './LibraryAndSystemPages';

interface RuleEvalResponse {
  operation: 'read' | 'write';
  path: string;
  allowed: boolean;
  reason: string;
  matchedPath: string;
  indexVerified?: boolean;
}

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const {
    uid,
    email,
    userRecord,
    effectiveRole,
    activeStudent,
    isRealFirebaseConfigured,
    signInQuickDemo,
    signInStaticAdmin,
    signInWithGoogleReal,
    signOutAndWipeSession,
    pendingReturnTo,
    savePendingReturnTo,
    consumePendingReturnTo,
  } = useAuth();

  const [quickName, setQuickName] = useState<string>(userRecord?.full_name || '');
  const [quickEmail, setQuickEmail] = useState<string>(email || '');
  const [quickPhone, setQuickPhone] = useState<string>(userRecord?.phone || '');
  const [adminUsername, setAdminUsername] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [notice, setNotice] = useState<{ type: 'info' | 'error' | 'success'; text: string } | null>(
    null
  );

  useEffect(() => {
    const queryReturnTo = searchParams.get('returnTo');
    if (queryReturnTo) {
      savePendingReturnTo(queryReturnTo);
    }
  }, [savePendingReturnTo, searchParams]);

  const handleQuickDemoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setNotice(null);
    const res = await signInQuickDemo({
      fullName: quickName,
      email: quickEmail,
      phone: quickPhone,
    });
    if (res.ok) {
      const targetReturnTo = consumePendingReturnTo() || searchParams.get('returnTo') || '/robot';
      if (targetReturnTo && targetReturnTo.startsWith('/') && !targetReturnTo.startsWith('//')) {
        navigate(targetReturnTo);
        return;
      }
    }
    setNotice({
      type: res.ok ? 'success' : 'error',
      text: res.message,
    });
  };

  const handleRealGoogleClick = async () => {
    setNotice(null);
    const res = await signInWithGoogleReal();
    if (res.ok) {
      const targetReturnTo = consumePendingReturnTo() || searchParams.get('returnTo') || '/robot';
      if (targetReturnTo && targetReturnTo.startsWith('/') && !targetReturnTo.startsWith('//')) {
        navigate(targetReturnTo);
        return;
      }
    }
    setNotice({
      type: res.ok ? 'success' : 'error',
      text: res.message,
    });
  };

  const handleAdminSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setNotice(null);
    const result = await signInStaticAdmin({
      username: adminUsername.trim(),
      password: adminPassword,
    });
    if (result.ok) {
      navigate('/admin');
      return;
    }
    setNotice({ type: 'error', text: result.message });
  };

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-teal-200 bg-gradient-to-br from-teal-900 via-teal-800 to-slate-900 p-6 sm:p-8 text-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="inline-flex items-center gap-2 rounded-full border border-teal-400/30 bg-teal-500/20 px-3 py-1 text-xs font-semibold text-teal-100">
            <span>Chào mừng đến với BUGZ BrightUpGenZ</span>
          </div>
          <span className="rounded-full border border-amber-300/40 bg-amber-400/20 px-3 py-1 text-xs font-bold text-amber-200">
            Mắt sáng · Lưng thẳng
          </span>
        </div>

        <h1 className="mt-2.5 text-2xl sm:text-3xl font-extrabold text-white">
          Đăng nhập &amp; Bắt đầu Trải nghiệm
        </h1>
        <p className="mt-1.5 max-w-3xl text-sm leading-relaxed text-teal-50/90">
          Nhập thông tin cá nhân thực tế để ghi nhận tiến độ học tập 28 ngày, điểm số Trò chơi rèn luyện và lịch sử đồng hành cùng Robot của riêng bạn.
        </p>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs">

        {pendingReturnTo && (
          <div
            role="status"
            className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-4 text-xs text-amber-950"
          >
            <div className="font-bold">
              Vui lòng đăng nhập để xem nội dung bạn vừa chọn
            </div>
            <p className="mt-1">
              Sau khi đăng nhập thành công, ứng dụng sẽ tự động chuyển bạn tới trang đang chờ.
            </p>
          </div>
        )}

        {notice && (
          <div
            role="alert"
            className={`mt-4 rounded-xl border p-4 text-xs ${
              notice.type === 'error'
                ? 'border-rose-300 bg-rose-50 text-rose-950'
                : 'border-teal-300 bg-teal-50 text-teal-950'
            }`}
          >
            <div className="font-bold">{notice.text}</div>
          </div>
        )}

        {/* Trạng thái phiên hiện tại */}
        <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-xs font-semibold text-slate-500">Tài khoản đang sử dụng</div>
              {uid ? (
                <div className="mt-1 space-y-0.5">
                  <div className="text-sm font-bold text-slate-900">
                    {userRecord?.full_name || email}{' '}
                    <span className="ml-1 rounded bg-teal-100 px-2 py-0.5 text-xs text-teal-900">
                      {effectiveRole === 'superadmin' ? 'Superadmin' : 'Học sinh'}
                    </span>
                  </div>
                  <div className="text-xs text-slate-600">
                    Email: {email}
                    {userRecord?.phone ? ` · SĐT: ${userRecord.phone}` : ''} · Thiết bị:{' '}
                    <strong>Robot01</strong> · Hồ sơ học sinh:{' '}
                    <strong>{activeStudent ? activeStudent.display_name : userRecord?.full_name || email}</strong>
                  </div>
                </div>
              ) : (
                <div className="mt-1 text-sm font-semibold text-slate-700">
                  Chưa đăng nhập — Điền thông tin cá nhân bên dưới để bắt đầu
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {uid && (
                <>
                  <Link
                    to="/robot"
                    className="rounded-xl bg-teal-800 px-3.5 py-2 text-xs font-semibold text-white hover:bg-teal-900"
                  >
                    Mở Robot đồng hành
                  </Link>
                  <Link
                    to="/profile"
                    className="rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-100"
                  >
                    Tài khoản của tôi
                  </Link>
                  <button
                    type="button"
                    onClick={async () => {
                      await signOutAndWipeSession();
                      setNotice({
                        type: 'info',
                        text: 'Đã đăng xuất khỏi tài khoản.',
                      });
                    }}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-rose-700 px-3.5 py-2 text-xs font-semibold text-white hover:bg-rose-800"
                  >
                    <LogOut className="h-3.5 w-3.5" />
                    <span>Đăng xuất</span>
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Tài khoản quản trị cố định: được xác minh hoàn toàn ở server. */}
        <form
          onSubmit={handleAdminSubmit}
          className="mt-6 rounded-2xl border border-slate-300 bg-slate-950 p-5 text-white"
        >
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 text-sm font-extrabold">
                <KeyRound className="h-4 w-4 text-amber-300" /> Đăng nhập Quản trị viên
              </div>
              <p className="mt-1 text-xs text-slate-300">
                Tài khoản quản trị được kiểm tra trực tiếp tại máy chủ và không lưu vào MongoDB.
              </p>
            </div>
            <label className="block lg:w-52">
              <span className="text-xs font-semibold text-slate-200">Tài khoản</span>
              <input
                value={adminUsername}
                onChange={(event) => setAdminUsername(event.target.value)}
                autoComplete="username"
                required
                placeholder="Nhập tài khoản quản trị"
                className="mt-1 w-full rounded-xl border border-slate-600 bg-white px-3.5 py-2.5 text-sm text-slate-950"
              />
            </label>
            <label className="block lg:w-52">
              <span className="text-xs font-semibold text-slate-200">Mật khẩu</span>
              <input
                type="password"
                value={adminPassword}
                onChange={(event) => setAdminPassword(event.target.value)}
                autoComplete="current-password"
                required
                placeholder="Nhập mật khẩu"
                className="mt-1 w-full rounded-xl border border-slate-600 bg-white px-3.5 py-2.5 text-sm text-slate-950"
              />
            </label>
            <button
              type="submit"
              className="inline-flex min-h-11 items-center justify-center rounded-xl bg-amber-400 px-5 text-sm font-extrabold text-slate-950 hover:bg-amber-300"
            >
              Vào trang Admin
            </button>
          </div>
        </form>

        {/* Biểu mẫu Đăng nhập bằng Thông tin Cá nhân Thực tế */}
        <form
          onSubmit={handleQuickDemoSubmit}
          className="mt-6 rounded-2xl border-2 border-teal-600 bg-teal-50/50 p-5 space-y-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-teal-900">
                Đăng nhập bằng Thông tin Cá nhân
              </div>
              <p className="mt-0.5 text-xs text-slate-700">
                Nhập <strong>Họ tên, Email và Số điện thoại</strong> của bạn để tạo hoặc mở hồ sơ học tập cá nhân thực tế và kết nối thiết bị Robot01.
              </p>
            </div>
            <span className="rounded-lg bg-teal-800 px-3 py-1 text-xs font-bold text-white">
              Hồ sơ cá nhân độc lập
            </span>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label htmlFor="demo-login-name" className="block text-xs font-semibold text-slate-800">
                1. Họ và tên
              </label>
              <input
                id="demo-login-name"
                type="text"
                required
                value={quickName}
                onChange={(e) => setQuickName(e.target.value)}
                placeholder="Nhập họ và tên của bạn"
                className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900"
              />
            </div>

            <div>
              <label htmlFor="demo-login-email" className="block text-xs font-semibold text-slate-800">
                2. Địa chỉ Email
              </label>
              <input
                id="demo-login-email"
                type="email"
                required
                value={quickEmail}
                onChange={(e) => setQuickEmail(e.target.value)}
                placeholder="vidu@gmail.com"
                className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900"
              />
            </div>

            <div>
              <label htmlFor="demo-login-phone" className="block text-xs font-semibold text-slate-800">
                3. Số điện thoại
              </label>
              <input
                id="demo-login-phone"
                type="tel"
                required
                value={quickPhone}
                onChange={(e) => setQuickPhone(e.target.value)}
                placeholder="Nhập số điện thoại"
                className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              data-testid="quick-demo-login-submit"
              className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-teal-800 px-6 py-2.5 text-sm font-bold text-white shadow-xs hover:bg-teal-900"
            >
              <CheckCircle2 className="h-4 w-4" />
              <span>Đăng nhập &amp; Vào sử dụng</span>
            </button>
          </div>
        </form>

        {/* Tùy chọn Đăng nhập bằng Tài khoản Google (Chỉ hiển thị khi đã bật cấu hình Firebase) */}
        {isRealFirebaseConfigured && (
          <div className="mt-6 rounded-xl border border-slate-200 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-teal-800">
                Đăng nhập bằng Tài khoản Google
              </div>
              <p className="mt-1 text-xs leading-relaxed text-slate-600">
                Sử dụng tài khoản Google cá nhân để đồng bộ tiến độ học tập 28 ngày, lịch sử ngồi học cùng Robot và điểm số trò chơi trên mọi thiết bị.
              </p>
            </div>
            <button
              type="button"
              onClick={handleRealGoogleClick}
              className="inline-flex min-h-[44px] shrink-0 items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-xs font-semibold text-white hover:bg-slate-800"
            >
              <KeyRound className="h-4 w-4" />
              <span>Đăng nhập với Google</span>
            </button>
          </div>
        )}
      </section>
    </div>
  );
};

export const OnboardingPage: React.FC = () => {
  const {
    uid,
    email,
    userRecord,
    activeStudent,
    authenticatedFetch,
    refreshProfileFromServer,
  } = useAuth();

  const [fullName, setFullName] = useState(userRecord?.full_name || '');
  const [ageGroup, setAgeGroup] = useState<'primary_6_10' | 'middle_11_15'>(
    activeStudent?.age_group || 'primary_6_10'
  );
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    if (userRecord?.full_name) {
      setFullName(userRecord.full_name);
    }
    if (activeStudent?.age_group) {
      setAgeGroup(activeStudent.age_group);
    }
  }, [userRecord, activeStudent]);

  const handleSaveOnboarding = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    const res = await authenticatedFetch('/api/users/profile', {
      method: 'POST',
      body: JSON.stringify({
        full_name: fullName,
        age_group: ageGroup,
      }),
    });
    const data = await res.json();
    setFeedback({
      ok: res.ok,
      text: data.message || (res.ok ? 'Đã lưu hồ sơ học sinh.' : 'Lỗi khi lưu hồ sơ.'),
    });
    if (res.ok) {
      await refreshProfileFromServer();
    }
  };

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-teal-200 bg-gradient-to-br from-teal-900 via-teal-800 to-slate-900 p-6 sm:p-8 text-white shadow-sm">
        <div className="inline-flex items-center gap-2 rounded-full border border-teal-400/30 bg-teal-500/20 px-3 py-1 text-xs font-semibold text-teal-100">
          <span>Thiết lập Hồ sơ Học sinh</span>
        </div>
        <h1 className="mt-2.5 text-2xl sm:text-3xl font-extrabold text-white">
          Cập nhật Thông tin Tài khoản Học sinh
        </h1>
        <p className="mt-1.5 text-sm text-teal-50/90">
          Cập nhật họ tên hiển thị và nhóm độ tuổi cho tài khoản Học sinh của bạn.
        </p>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs">
        {!uid && (
          <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-4 text-xs text-amber-950">
            Bạn chưa đăng nhập. Hãy đăng nhập tại trang{' '}
            <Link to="/login" className="font-bold underline">
              Đăng nhập
            </Link>{' '}
            trước khi cập nhật hồ sơ.
          </div>
        )}

        {feedback && (
          <div
            role="alert"
            className={`mt-4 rounded-xl border p-4 text-xs ${
              feedback.ok
                ? 'border-emerald-300 bg-emerald-50 text-emerald-950'
                : 'border-rose-300 bg-rose-50 text-rose-950'
            }`}
          >
            <strong>Thông báo:</strong> {feedback.text}
          </div>
        )}

        <div className="mt-6 max-w-xl">
          <form onSubmit={handleSaveOnboarding} className="rounded-xl border border-slate-200 p-5 space-y-4">
            <h2 className="text-base font-bold text-slate-900">
              Thông tin Hồ sơ Học sinh
            </h2>
            <div>
              <label className="block text-xs font-semibold text-slate-700">
                Địa chỉ Email
              </label>
              <input
                type="email"
                value={email || 'Chưa đăng nhập'}
                disabled
                className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-100 px-3.5 py-2 text-xs text-slate-600"
              />
            </div>

            <div>
              <label htmlFor="onboard-fullname" className="block text-xs font-semibold text-slate-700">
                Họ và tên Học sinh
              </label>
              <input
                id="onboard-fullname"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Nhập họ tên học sinh"
                className="mt-1 w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm text-slate-900"
              />
            </div>

            <div>
              <label htmlFor="onboard-age-group" className="block text-xs font-semibold text-slate-700">
                Nhóm độ tuổi
              </label>
              <select
                id="onboard-age-group"
                value={ageGroup}
                onChange={(e) => setAgeGroup(e.target.value as 'primary_6_10' | 'middle_11_15')}
                className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900"
              >
                <option value="primary_6_10">Tiểu học (6 – 10 tuổi)</option>
                <option value="middle_11_15">THCS (11 – 15 tuổi)</option>
              </select>
            </div>

            <button
              type="submit"
              className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-teal-800 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-900"
            >
              Lưu Hồ sơ Học sinh
            </button>
          </form>
        </div>
      </section>
    </div>
  );
};

export const ProfilePage: React.FC = () => {
  const {
    uid,
    email,
    userRecord,
    accountRole,
    activeStudent,
    devices,
    authenticatedFetch,
    refreshProfileFromServer,
    signOutAndWipeSession,
  } = useAuth();

  const [fullName, setFullName] = useState(userRecord?.full_name || '');
  const [phone, setPhone] = useState(userRecord?.phone || '');
  const [statusMsg, setStatusMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    if (userRecord?.full_name) {
      setFullName(userRecord.full_name);
    }
    if (userRecord?.phone) {
      setPhone(userRecord.phone);
    }
  }, [userRecord]);

  const handleUpdateName = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMsg(null);
    const res = await authenticatedFetch('/api/users/profile', {
      method: 'POST',
      body: JSON.stringify({ full_name: fullName, phone }),
    });
    const data = await res.json();
    setStatusMsg({ ok: res.ok, text: data.message });
    if (res.ok) await refreshProfileFromServer();
  };

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-teal-200 bg-gradient-to-br from-teal-900 via-teal-800 to-slate-900 p-6 sm:p-8 text-white shadow-sm">
        <div className="inline-flex items-center gap-2 rounded-full border border-teal-400/30 bg-teal-500/20 px-3 py-1 text-xs font-semibold text-teal-100">
          <span>Tài khoản Học sinh</span>
        </div>
        <h1 className="mt-2.5 text-2xl sm:text-3xl font-extrabold text-white">
          Tài khoản của tôi
        </h1>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs">
        {!uid ? (
          <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-4 text-xs text-amber-950">
            Vui lòng <Link to="/login" className="font-bold underline">đăng nhập</Link> để xem và chỉnh sửa thông tin cá nhân.
          </div>
        ) : (
          <div className="mt-5 grid grid-cols-1 gap-6 lg:grid-cols-2">
            <form onSubmit={handleUpdateName} className="rounded-xl border border-slate-200 p-5 space-y-4">
              <h2 className="text-base font-bold text-slate-900">
                Cập nhật Thông tin Học sinh
              </h2>
              <div>
                <label htmlFor="profile-fullname" className="block text-xs font-semibold text-slate-700">
                  Họ và tên Học sinh
                </label>
                <input
                  id="profile-fullname"
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm text-slate-900"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Địa chỉ Email
                </label>
                <input
                  type="text"
                  disabled
                  value={email || ''}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-100 px-3.5 py-2 text-xs text-slate-600"
                />
              </div>
              <div>
                <label htmlFor="profile-phone" className="block text-xs font-semibold text-slate-700">
                  Số điện thoại
                </label>
                <input
                  id="profile-phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="0901234567"
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm text-slate-900"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="submit"
                  className="rounded-xl bg-teal-800 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-900"
                >
                  Lưu thay đổi
                </button>
                <button
                  type="button"
                  onClick={signOutAndWipeSession}
                  className="rounded-xl border border-rose-300 bg-rose-50 px-4 py-2 text-xs font-semibold text-rose-900 hover:bg-rose-100"
                >
                  Đăng xuất
                </button>
              </div>
            </form>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-5 space-y-4">
              <h2 className="text-base font-bold text-slate-900">
                Tổng quan Tài khoản &amp; Phân quyền
              </h2>
              <div className="space-y-2 text-xs text-slate-700">
                <div>
                  • <strong>Cấp phân quyền:</strong>{' '}
                  <span className="rounded bg-teal-100 px-2 py-0.5 font-bold text-teal-900">
                    {accountRole?.role === 'superadmin' ? 'Superadmin (Cấp cao nhất)' : 'Học sinh'}
                  </span>
                </div>
                <div>
                  • <strong>Trạng thái hoạt động:</strong>{' '}
                  <span>{accountRole?.disabled ? 'Đang tạm khóa' : 'Đang hoạt động'}</span>
                </div>
                <div>
                  • <strong>Hồ sơ học sinh:</strong>{' '}
                  <strong>{activeStudent?.display_name || userRecord?.full_name || email}</strong>
                </div>
                <div>
                  • <strong>Thiết bị Robot đồng hành:</strong> {devices.length} thiết bị
                </div>
              </div>

              <div className="pt-2 flex flex-wrap gap-2">
                <Link
                  to="/parent"
                  className="rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-100"
                >
                  Hồ sơ Học sinh &amp; Thiết bị Robot
                </Link>
                {accountRole?.role === 'superadmin' && (
                  <Link
                    to="/admin"
                    className="rounded-xl bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white hover:bg-slate-800"
                  >
                    Mở Trung tâm Superadmin
                  </Link>
                )}
              </div>
            </div>
          </div>
        )}

        {statusMsg && (
          <div
            role="alert"
            className={`mt-4 rounded-xl border p-4 text-xs ${
              statusMsg.ok
                ? 'border-emerald-300 bg-emerald-50 text-emerald-950'
                : 'border-rose-300 bg-rose-50 text-rose-950'
            }`}
          >
            {statusMsg.text}
          </div>
        )}
      </section>
    </div>
  );
};

export const ParentDashboardPage: React.FC = () => {
  const {
    uid,
    email,
    userRecord,
    activeStudent,
    devices,
    notificationPreferences,
    authenticatedFetch,
    refreshProfileFromServer,
  } = useAuth();

  const [studentDisplayName, setStudentDisplayName] = useState(
    activeStudent?.display_name || userRecord?.full_name || ''
  );
  const [studentAgeGroup, setStudentAgeGroup] = useState<'primary_6_10' | 'middle_11_15'>(
    activeStudent?.age_group || 'primary_6_10'
  );
  const [pairDeviceId, setPairDeviceId] = useState('robot01');
  const [pairCode] = useState('BUGZ-PAIR-2026');
  const [pairDeviceName, setPairDeviceName] = useState('Robot đồng hành BUGZ (Robot01)');
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    if (activeStudent?.display_name) {
      setStudentDisplayName(activeStudent.display_name);
    } else if (userRecord?.full_name) {
      setStudentDisplayName(userRecord.full_name);
    }
    if (activeStudent?.age_group) {
      setStudentAgeGroup(activeStudent.age_group);
    }
  }, [activeStudent, userRecord]);

  if (!uid) {
    return (
      <div className="space-y-6">
        <section className="rounded-2xl border border-slate-200 bg-white p-6">
          <div className="text-xs font-semibold text-teal-800">
            Hồ sơ Học sinh &amp; Thiết bị
          </div>
          <h1 className="mt-1 text-2xl font-bold text-slate-900">
            Hồ sơ Học sinh, Thiết bị Robot &amp; Cài đặt Thông báo
          </h1>
          <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-4 text-xs text-amber-950">
            Vui lòng{' '}
            <Link to="/login" className="font-bold underline">
              đăng nhập
            </Link>{' '}
            để quản lý hồ sơ học sinh và cài đặt thông báo của bạn.
          </div>
        </section>
      </div>
    );
  }

  const handleUpdateStudentProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    const res = await authenticatedFetch('/api/users/profile', {
      method: 'POST',
      body: JSON.stringify({
        full_name: studentDisplayName,
        phone: userRecord?.phone,
        age_group: studentAgeGroup,
      }),
    });
    const data = await res.json();
    setFeedback({ ok: res.ok, text: data.message });
    if (res.ok) {
      await refreshProfileFromServer();
    }
  };

  const handlePairDevice = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    const res = await authenticatedFetch('/api/devices/pair', {
      method: 'POST',
      body: JSON.stringify({
        device_id: pairDeviceId,
        pairing_code: pairCode,
        device_name: pairDeviceName,
      }),
    });
    const data = await res.json();
    setFeedback({ ok: res.ok, text: data.message });
    if (res.ok) {
      await refreshProfileFromServer();
    }
  };

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-teal-200 bg-gradient-to-br from-teal-900 via-teal-800 to-slate-900 p-6 sm:p-8 text-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="inline-flex items-center gap-2 rounded-full border border-teal-400/30 bg-teal-500/20 px-3 py-1 text-xs font-semibold text-teal-100">
            <span>Hồ sơ Học sinh &amp; Thiết bị Robot</span>
          </div>
          <span className="rounded-full border border-amber-300/40 bg-amber-400/20 px-3 py-1 text-xs font-bold text-amber-200">
            {email}
          </span>
        </div>

        <h1 className="mt-2.5 text-2xl sm:text-3xl font-extrabold text-white">
          Hồ sơ Học sinh, Kết nối Robot &amp; Cài đặt Thông báo
        </h1>
        <p className="mt-1.5 text-sm text-teal-50/90">
          Mỗi tài khoản là một Hồ sơ Học sinh độc lập, kết nối trực tiếp với Robot đồng hành và tùy chỉnh cách nhận lời nhắc tư thế.
        </p>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs">
        {feedback && (
          <div
            role="alert"
            className={`mt-4 rounded-xl border p-4 text-xs ${
              feedback.ok
                ? 'border-emerald-300 bg-emerald-50 text-emerald-950'
                : 'border-rose-300 bg-rose-50 text-rose-950'
            }`}
          >
            {feedback.text}
          </div>
        )}

        {/* Hồ sơ Học sinh hiện tại */}
        {activeStudent && (
          <div className="mt-6">
            <h2 className="text-base font-bold text-slate-900">
              1. Hồ sơ Học sinh của tôi
            </h2>
            <div className="mt-3 rounded-xl border border-teal-700 bg-teal-50/40 p-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">{activeStudent.display_name}</h3>
                <div className="mt-0.5 text-xs text-slate-600">
                  Mã hồ sơ: <code className="font-mono font-bold text-teal-900">{activeStudent.student_id}</code> · Múi giờ: Việt Nam (GMT+7)
                </div>
              </div>
              <span className="rounded bg-white px-3 py-1 text-xs font-semibold text-teal-900 border border-teal-200">
                {activeStudent.age_group === 'primary_6_10' ? 'Tiểu học (6–10 tuổi)' : 'THCS (11–15 tuổi)'}
              </span>
            </div>
          </div>
        )}

        {/* Hai biểu mẫu hành động: Cập nhật hồ sơ học sinh & Kết nối Robot */}
        <div className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-2">
          <form onSubmit={handleUpdateStudentProfile} className="rounded-xl border border-slate-200 p-4 space-y-3">
            <div className="flex items-center gap-1.5 text-xs font-bold text-teal-800">
              <PlusCircle className="h-4 w-4" />
              <span>Cập nhật Hồ sơ Học sinh</span>
            </div>
            <div>
              <label htmlFor="child-name-input" className="block text-xs font-semibold text-slate-700">
                Tên hiển thị của Học sinh
              </label>
              <input
                id="child-name-input"
                type="text"
                value={studentDisplayName}
                onChange={(e) => setStudentDisplayName(e.target.value)}
                placeholder="Ví dụ: Học sinh Nguyễn Văn An"
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-xs text-slate-900"
              />
            </div>
            <div>
              <label htmlFor="child-age-select" className="block text-xs font-semibold text-slate-700">
                Nhóm độ tuổi
              </label>
              <select
                id="child-age-select"
                value={studentAgeGroup}
                onChange={(e) => setStudentAgeGroup(e.target.value as 'primary_6_10' | 'middle_11_15')}
                className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900"
              >
                <option value="primary_6_10">Tiểu học (6 – 10 tuổi)</option>
                <option value="middle_11_15">THCS (11 – 15 tuổi)</option>
              </select>
            </div>
            <button
              type="submit"
              className="w-full rounded-xl bg-teal-800 px-3 py-2 text-xs font-semibold text-white hover:bg-teal-900"
            >
              Lưu Hồ sơ Học sinh
            </button>
          </form>

          <form onSubmit={handlePairDevice} className="rounded-xl border border-slate-200 p-4 space-y-3">
            <div className="flex items-center gap-1.5 text-xs font-bold text-teal-800">
              <Sparkles className="h-4 w-4" />
              <span>Kết nối Thiết bị Robot Đồng hành</span>
            </div>
            <div>
              <label htmlFor="pair-device-id" className="block text-xs font-semibold text-slate-700">
                Mã thiết bị Robot
              </label>
              <input
                id="pair-device-id"
                type="text"
                value={pairDeviceId}
                onChange={(e) => setPairDeviceId(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 font-mono text-xs text-slate-900"
              />
            </div>
            <div>
              <label htmlFor="pair-code-input" className="block text-xs font-semibold text-slate-700">
                Tên gọi thiết bị
              </label>
              <input
                id="pair-code-input"
                type="text"
                value={pairDeviceName}
                onChange={(e) => setPairDeviceName(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-xs text-slate-900"
              />
            </div>
            <button
              type="submit"
              className="w-full rounded-xl bg-teal-800 px-3 py-2 text-xs font-semibold text-white hover:bg-teal-900"
            >
              Kết nối &amp; Bật Giám sát Ngay
            </button>
          </form>
        </div>

        {/* Thiết bị Robot đã kết nối & Cấu hình thông báo */}
        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <h3 className="text-sm font-bold text-slate-900">
              Thiết bị Robot Đang Kết nối ({devices.length})
            </h3>
            <ul className="mt-2 space-y-2 text-xs">
              {devices.map((d) => (
                <li key={d.device_id} className="rounded-lg border border-slate-200 bg-white p-3">
                  <div className="flex items-center justify-between font-bold text-slate-900">
                    <span>{d.device_name}</span>
                    <span className="rounded bg-teal-50 px-2 py-0.5 text-teal-800 border border-teal-200">
                      {d.device_id}
                    </span>
                  </div>
                  <div className="mt-1 text-[11px] text-slate-600">
                    Thời gian nhắc khi ngồi chưa chuẩn: <strong>{d.alert_after_sec} giây</strong>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <h3 className="text-sm font-bold text-slate-900">
              Tóm tắt Cài đặt Nhận Lời nhắc
            </h3>
            {notificationPreferences && (
              <div className="mt-2 space-y-1.5 text-xs text-slate-700">
                <div>• Thông báo đẩy trên thiết bị: <strong>{notificationPreferences.push_enabled ? 'Đang bật' : 'Đang tắt'}</strong></div>
                <div>• Giọng nói nhắc nhở khi mở trang: <strong>{notificationPreferences.voice_enabled ? 'Đang bật' : 'Đang tắt'}</strong></div>
                <div>• Gửi thông báo qua Email: <strong>{notificationPreferences.email_enabled ? 'Đang bật' : 'Đang tắt'}</strong></div>
                <div>• Tần suất nhận: <strong>{notificationPreferences.mode === 'every_alert' ? 'Nhận ngay từng lời nhắc' : 'Nhận bản tổng hợp'}</strong></div>
                <div>
                  • Khung giờ nghỉ ngơi:{' '}
                  <strong>
                    {notificationPreferences.quiet_hours_start} – {notificationPreferences.quiet_hours_end}
                  </strong>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      <NotificationCenterPanel showTechnicalTools={false} />
    </div>
  );
};

interface AdminUserSummary {
  uid: string;
  full_name: string;
  email: string;
  role: UserRole;
  disabled: boolean;
  updated_at: number;
  linked_students: string[];
  student_accounts: string[];
}

interface AdminDeviceSummary extends ExcelDeviceRecord {
  device_id: string;
  credential?: {
    revoked?: boolean;
    calibration_valid?: boolean;
  } | null;
}

interface AdminQuestionRow extends PublicQuestionRecord {
  correct_option_id: 'A' | 'B' | 'C';
  explanation: string;
  feedback_correct: string;
  feedback_incorrect: string;
}

type AdminModuleId =
  | 'users'
  | 'learning'
  | 'games'
  | 'library'
  | 'settings'
  | 'all';

export const AdminConsolePage: React.FC = () => {
  const { uid, email, effectiveRole, authenticatedFetch, refreshProfileFromServer } = useAuth();
  const [activeModule, setActiveModule] = useState<AdminModuleId>('users');
  const [technicalModeEnabled, setTechnicalModeEnabled] = useState<boolean>(false);

  const [users, setUsers] = useState<AdminUserSummary[]>([]);
  const [devices, setDevices] = useState<AdminDeviceSummary[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogRecord[]>([]);
  const [learningDays, setLearningDays] = useState<LearningDayManifestItem[]>(LEARNING_DAYS_28);
  const [certificateRequests, setCertificateRequests] = useState<CertificateRequestRecord[]>([]);
  const [sourceReport, setSourceReport] = useState<SourceVerificationEntry[]>(SOURCE_VERIFICATION_REPORT);
  const [questions, setQuestions] = useState<AdminQuestionRow[]>([]);
  const [reminderTemplates, setReminderTemplates] = useState<GentleReminderTemplateRecord[]>([]);
  const [notificationJobs, setNotificationJobs] = useState<NotificationJobRecord[]>([]);
  const [captures, setCaptures] = useState<CaptureMetadataRecord[]>([]);

  const [searchQuery, setSearchQuery] = useState('');
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);
  const [ruleResult, setRuleResult] = useState<RuleEvalResponse | null>(null);

  // State cho Module 2: Quản lý Nội dung Học tập (28 ngày)
  const [selectedDayNum, setSelectedDayNum] = useState<number>(1);
  const [editTitle, setEditTitle] = useState<string>('');
  const [editSlogan, setEditSlogan] = useState<string>('');
  const [editStepsText, setEditStepsText] = useState<string>('');
  const [editClinicalFlag, setEditClinicalFlag] = useState<boolean>(false);
  const [editClinicalNote, setEditClinicalNote] = useState<string>('');
  const [editInfoVerified, setEditInfoVerified] = useState<boolean>(false);
  const [editPublishStatus, setEditPublishStatus] = useState<
    'draft_pending_asset_and_content_verification' | 'published'
  >('draft_pending_asset_and_content_verification');

  // State cho Module 3: Quản lý Nội dung Trò chơi (40 câu hỏi)
  const [qTopicFilter, setQTopicFilter] = useState<'all' | 'lung_thang' | 'mat_sang'>('all');
  const [qStatusFilter, setQStatusFilter] = useState<'all' | 'published' | 'editorial_draft'>('all');
  const [selectedQuestionId, setSelectedQuestionId] = useState<string>('BUGZ-Q007');
  const [editQPrompt, setEditQPrompt] = useState<string>('');
  const [editQIllId, setEditQIllId] = useState<IllustrationId>('POSTURE');
  const [editQOptA, setEditQOptA] = useState<string>('');
  const [editQOptB, setEditQOptB] = useState<string>('');
  const [editQOptC, setEditQOptC] = useState<string>('');
  const [editQCorrectOpt, setEditQCorrectOpt] = useState<'A' | 'B' | 'C'>('B');
  const [editQFeedbackCorrect, setEditQFeedbackCorrect] = useState<string>('');
  const [editQFeedbackIncorrect, setEditQFeedbackIncorrect] = useState<string>('');
  const [editQExplanation, setEditQExplanation] = useState<string>('');
  const [editQSourceDays, setEditQSourceDays] = useState<string>('1, 2');
  const [editQContentReviewed, setEditQContentReviewed] = useState<boolean>(false);
  const [editQClinicalReviewed, setEditQClinicalReviewed] = useState<boolean>(false);
  const [editQStatus, setEditQStatus] = useState<'editorial_draft' | 'published'>('editorial_draft');

  // State cho Module 5: Quản lý Thiết lập Cấu hình, Thiết bị, Mẫu lời nhắc & Capture
  const [deviceEdits, setDeviceEdits] = useState<
    Record<string, { device_name: string; alert_after_sec: number }>
  >({});
  const [templateEdits, setTemplateEdits] = useState<
    Record<string, { title: string; push_body: string; voice_text: string }>
  >({});
  const [captureSupportReason, setCaptureSupportReason] = useState<string>(
    'Hỗ trợ kỹ thuật kiểm tra góc camera theo yêu cầu phụ huynh'
  );
  const [previewCaptureSvg, setPreviewCaptureSvg] = useState<{
    captureId: string;
    dataUri: string;
  } | null>(null);

  const loadAdminOverview = async () => {
    const res = await authenticatedFetch('/api/admin/overview');
    if (!res.ok) return;
    const data = await res.json();
    if (Array.isArray(data.users)) setUsers(data.users);
    if (Array.isArray(data.devices)) {
      setDevices(data.devices);
      const nextDevEdits: Record<string, { device_name: string; alert_after_sec: number }> = {};
      for (const d of data.devices) {
        nextDevEdits[d.device_id] = {
          device_name: d.device_name,
          alert_after_sec: d.alert_after_sec,
        };
      }
      setDeviceEdits(nextDevEdits);
    }
    if (Array.isArray(data.auditLogs)) setAuditLogs(data.auditLogs);
    if (Array.isArray(data.learningDays) && data.learningDays.length === 28) {
      setLearningDays(data.learningDays);
    }
    if (Array.isArray(data.certificateRequests)) {
      setCertificateRequests(data.certificateRequests);
    }
    if (Array.isArray(data.sourceVerificationReport)) {
      setSourceReport(data.sourceVerificationReport);
    }
    if (Array.isArray(data.questions)) {
      setQuestions(data.questions);
    }
    if (Array.isArray(data.reminderTemplates)) {
      setReminderTemplates(data.reminderTemplates);
      const nextTplEdits: Record<
        string,
        { title: string; push_body: string; voice_text: string }
      > = {};
      for (const t of data.reminderTemplates) {
        nextTplEdits[t.template_id] = {
          title: t.title,
          push_body: t.push_body,
          voice_text: t.voice_text,
        };
      }
      setTemplateEdits(nextTplEdits);
    }
    if (Array.isArray(data.notificationJobs)) {
      setNotificationJobs(data.notificationJobs);
    }
    if (Array.isArray(data.captures)) {
      setCaptures(data.captures);
    }
  };

  useEffect(() => {
    if (effectiveRole === 'superadmin') {
      loadAdminOverview();
    }
  }, [effectiveRole, uid]);

  const currentEditDay =
    learningDays.find((d) => d.day_number === selectedDayNum) || LEARNING_DAYS_28[selectedDayNum - 1];

  useEffect(() => {
    if (!currentEditDay) return;
    setEditTitle(currentEditDay.title_transcribed);
    setEditSlogan(currentEditDay.slogan_transcribed);
    setEditStepsText(currentEditDay.practice_steps.join('\n'));
    setEditClinicalFlag(Boolean(currentEditDay.clinical_review_flag));
    setEditClinicalNote(currentEditDay.clinical_review_note || '');
    setEditInfoVerified(Boolean(currentEditDay.info_asset.original_bytes_downloaded));
    setEditPublishStatus(currentEditDay.publish_status);
  }, [
    selectedDayNum,
    currentEditDay?.source_version,
    currentEditDay?.publish_status,
    currentEditDay?.clinical_review_flag,
  ]);

  const currentEditQuestion =
    questions.find((q) => q.id === selectedQuestionId) || questions[0] || null;

  useEffect(() => {
    if (!currentEditQuestion) return;
    setEditQPrompt(currentEditQuestion.prompt);
    setEditQIllId(currentEditQuestion.illustration_id);
    const optA = currentEditQuestion.options.find((o) => o.id === 'A')?.text || '';
    const optB = currentEditQuestion.options.find((o) => o.id === 'B')?.text || '';
    const optC = currentEditQuestion.options.find((o) => o.id === 'C')?.text || '';
    setEditQOptA(optA);
    setEditQOptB(optB);
    setEditQOptC(optC);
    setEditQCorrectOpt(currentEditQuestion.correct_option_id || 'B');
    setEditQFeedbackCorrect(currentEditQuestion.feedback_correct || '');
    setEditQFeedbackIncorrect(currentEditQuestion.feedback_incorrect || '');
    setEditQExplanation(currentEditQuestion.explanation || '');
    setEditQSourceDays(currentEditQuestion.source_days.join(', '));
    setEditQContentReviewed(Boolean(currentEditQuestion.approval?.content_reviewed));
    setEditQClinicalReviewed(Boolean(currentEditQuestion.approval?.clinical_reviewed));
    setEditQStatus(currentEditQuestion.status);
  }, [
    selectedQuestionId,
    currentEditQuestion?.version,
    currentEditQuestion?.status,
    currentEditQuestion?.approval?.content_reviewed,
    currentEditQuestion?.approval?.clinical_reviewed,
  ]);

  const handleTestUnauthorizedAdminCall = async () => {
    setFeedback(null);
    const res = await authenticatedFetch('/api/admin/roles', {
      method: 'POST',
      body: JSON.stringify({
        target_uid: uid || 'uid-student-a1',
        new_role: 'superadmin',
      }),
    });
    const data = await res.json();
    setFeedback({
      ok: res.ok,
      text: `[HTTP ${res.status}] ${data.message}`,
    });
  };

  if (effectiveRole !== 'superadmin') {
    return (
      <div className="space-y-6">
        <section className="rounded-2xl border border-rose-300 bg-rose-50 p-6 text-rose-950">
          <div className="flex items-center gap-2 text-xs font-bold uppercase">
            <ShieldAlert className="h-4 w-4" />
            <span>Khu vực Dành riêng cho Superadmin</span>
          </div>
          <h1 className="mt-1 text-2xl font-bold">
            Từ chối Truy cập: Chỉ cấp quyền cao nhất Superadmin mới được phép mở Trung tâm Quản trị
          </h1>
          <p className="mt-1.5 text-xs leading-relaxed">
            Tài khoản hiện tại của bạn ({email || 'chưa đăng nhập'}) là tài khoản Học sinh, không có quyền Superadmin. Vui lòng chuyển sang tài khoản Superadmin tại trang Đăng nhập để tiếp tục.
          </p>

          <div className="mt-4 flex flex-wrap gap-2.5">
            <Link
              to="/login"
              className="rounded-xl bg-rose-800 px-4 py-2 text-xs font-semibold text-white hover:bg-rose-900"
            >
              Chuyển sang tài khoản Superadmin tại trang Đăng nhập
            </Link>
            <button
              type="button"
              onClick={handleTestUnauthorizedAdminCall}
              className="rounded-xl border border-rose-400 bg-white px-4 py-2 text-xs font-semibold text-rose-950 hover:bg-rose-100"
            >
              Kiểm tra bảo mật quyền truy cập
            </button>
          </div>

          {feedback && (
            <div className="mt-4 rounded-xl border border-rose-400 bg-white p-3.5 font-mono text-xs text-rose-950">
              {feedback.text}
            </div>
          )}
        </section>
      </div>
    );
  }

  const handleChangeRole = async (targetUid: string, newRole: UserRole) => {
    setFeedback(null);
    const res = await authenticatedFetch('/api/admin/roles', {
      method: 'POST',
      body: JSON.stringify({
        target_uid: targetUid,
        new_role: newRole,
        reason: `Superadmin ${email} đổi quyền trên Trung tâm Quản trị`,
      }),
    });
    const data = await res.json();
    setFeedback({ ok: res.ok, text: data.message });
    if (res.ok) {
      await loadAdminOverview();
      await refreshProfileFromServer();
    }
  };

  const handleToggleDisabled = async (targetUid: string, nextDisabled: boolean) => {
    setFeedback(null);
    const res = await authenticatedFetch(`/api/admin/users/${targetUid}/status`, {
      method: 'POST',
      body: JSON.stringify({
        disabled: nextDisabled,
        reason: nextDisabled ? 'Tạm khóa tài khoản' : 'Mở khóa tài khoản',
      }),
    });
    const data = await res.json();
    setFeedback({ ok: res.ok, text: data.message });
    if (res.ok) {
      await loadAdminOverview();
    }
  };

  const handleSaveLearningDay = async (
    overridePublishStatus?: 'draft_pending_asset_and_content_verification' | 'published'
  ) => {
    setFeedback(null);
    const targetPublishStatus = overridePublishStatus ?? editPublishStatus;
    const isDirectApproveAction =
      overridePublishStatus === 'published' && !technicalModeEnabled;
    const effectiveClinicalFlag = isDirectApproveAction ? false : editClinicalFlag;
    const effectiveInfoVerified = isDirectApproveAction ? true : editInfoVerified;

    if (isDirectApproveAction) {
      setEditClinicalFlag(false);
      setEditInfoVerified(true);
      setEditPublishStatus('published');
    }

    const stepsArray = editStepsText
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);

    const res = await authenticatedFetch(`/api/admin/content/days/${selectedDayNum}`, {
      method: 'POST',
      body: JSON.stringify({
        title_transcribed: editTitle,
        slogan_transcribed: editSlogan,
        practice_steps: stepsArray,
        clinical_review_flag: effectiveClinicalFlag,
        clinical_review_note: editClinicalNote,
        info_asset_verified: effectiveInfoVerified,
        publish_status: targetPublishStatus,
      }),
    });
    const data = await res.json();
    setFeedback({ ok: res.ok, text: data.message });
    await loadAdminOverview();
  };

  const handleBulkPublishLearningDays = async () => {
    setFeedback(null);
    const res = await authenticatedFetch('/api/admin/content/days/bulk-publish', {
      method: 'POST',
    });
    const data = await res.json();
    setFeedback({ ok: res.ok, text: data.message });
    if (res.ok) {
      await loadAdminOverview();
    }
  };

  const handleImportQuestionSeed = async (
    dryRun: boolean,
    mode: 'strict_editorial_draft' | 'sandbox_with_12_published'
  ) => {
    setFeedback(null);
    const res = await authenticatedFetch('/api/admin/questions/import', {
      method: 'POST',
      body: JSON.stringify({
        dry_run: dryRun,
        mode,
      }),
    });
    const data = await res.json();
    setFeedback({ ok: res.ok, text: data.message });
    if (!dryRun && res.ok) {
      await loadAdminOverview();
    }
  };

  const handleBulkPublishQuestions = async (
    mode: 'publish_all_40' | 'publish_12_sample' | 'reset_all_draft' = 'publish_all_40'
  ) => {
    setFeedback(null);
    const res = await authenticatedFetch('/api/admin/questions/bulk-publish', {
      method: 'POST',
      body: JSON.stringify({
        mode,
      }),
    });
    const data = await res.json();
    setFeedback({ ok: res.ok, text: data.message });
    if (res.ok) {
      await loadAdminOverview();
    }
  };

  const handleSaveQuestion = async (overrideStatus?: 'editorial_draft' | 'published') => {
    if (!currentEditQuestion) return;
    setFeedback(null);
    const targetStatus = overrideStatus ?? editQStatus;
    const isDirectPublishAction =
      overrideStatus === 'published' && !technicalModeEnabled;
    const effectiveContentReviewed = isDirectPublishAction ? true : editQContentReviewed;
    const effectiveClinicalReviewed = isDirectPublishAction ? true : editQClinicalReviewed;

    if (isDirectPublishAction) {
      setEditQContentReviewed(true);
      setEditQClinicalReviewed(true);
      setEditQStatus('published');
    }

    const parsedSourceDays = editQSourceDays
      .split(',')
      .map((s) => Number(s.trim()))
      .filter((n) => Number.isInteger(n) && n >= 1 && n <= 28);

    const res = await authenticatedFetch(
      `/api/admin/questions/${encodeURIComponent(currentEditQuestion.id)}`,
      {
        method: 'POST',
        body: JSON.stringify({
          prompt: editQPrompt,
          illustration_id: editQIllId,
          options: [
            { id: 'A', text: editQOptA },
            { id: 'B', text: editQOptB },
            { id: 'C', text: editQOptC },
          ],
          correct_option_id: editQCorrectOpt,
          feedback_correct: editQFeedbackCorrect,
          feedback_incorrect: editQFeedbackIncorrect,
          explanation: editQExplanation,
          source_days: parsedSourceDays.length > 0 ? parsedSourceDays : [1],
          content_reviewed: effectiveContentReviewed,
          clinical_reviewed: effectiveClinicalReviewed,
          status: targetStatus,
        }),
      }
    );
    const data = await res.json();
    setFeedback({ ok: res.ok, text: data.message });
    await loadAdminOverview();
  };

  const handleUpdateDeviceConfig = async (
    deviceId: string,
    payload: {
      device_name?: string;
      alert_after_sec?: number;
      revoked?: boolean;
      calibration_valid?: boolean;
    }
  ) => {
    setFeedback(null);
    const res = await authenticatedFetch(`/api/admin/devices/${encodeURIComponent(deviceId)}/config`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    setFeedback({ ok: res.ok, text: data.message });
    if (res.ok) await loadAdminOverview();
  };

  const handleUpdateReminderTemplate = async (tpl: GentleReminderTemplateRecord) => {
    setFeedback(null);
    const draft = templateEdits[tpl.template_id];
    const nextTitle = (draft?.title ?? tpl.title).trim() || tpl.title;
    const nextVoiceText = (draft?.voice_text ?? tpl.voice_text).trim() || tpl.voice_text;
    const nextPushBody = (draft?.push_body ?? tpl.push_body).trim() || tpl.push_body;

    const res = await authenticatedFetch('/api/admin/notifications/templates', {
      method: 'POST',
      body: JSON.stringify({
        template_id: tpl.template_id,
        title: `${nextTitle.replace(/ \(Đã duyệt\)$/, '')} (Đã duyệt)`,
        voice_text: nextVoiceText,
        push_body: nextPushBody,
      }),
    });
    const data = await res.json();
    setFeedback({ ok: res.ok, text: data.message });
    if (res.ok) await loadAdminOverview();
  };

  const handlePreviewSupportCapture = async (captureId: string) => {
    setFeedback(null);
    const res = await authenticatedFetch(
      `/api/captures/${encodeURIComponent(captureId)}?reason=${encodeURIComponent(
        captureSupportReason
      )}`
    );
    const data = await res.json();
    if (res.ok && data.signedViewDescriptor?.preview_svg_data_uri) {
      setPreviewCaptureSvg({
        captureId,
        dataUri: data.signedViewDescriptor.preview_svg_data_uri,
      });
      setFeedback({
        ok: true,
        text: `Đã mở xem ảnh hỗ trợ ${captureId}.`,
      });
      await loadAdminOverview();
    } else {
      setFeedback({ ok: false, text: data.message || 'Không thể mở ảnh hỗ trợ.' });
    }
  };

  const handleDeleteSupportCapture = async (captureId: string) => {
    setFeedback(null);
    const res = await authenticatedFetch(`/api/admin/captures/${encodeURIComponent(captureId)}`, {
      method: 'DELETE',
      body: JSON.stringify({
        reason: captureSupportReason,
      }),
    });
    const data = await res.json();
    setFeedback({ ok: res.ok, text: data.message });
    if (res.ok) {
      if (previewCaptureSvg?.captureId === captureId) setPreviewCaptureSvg(null);
      await loadAdminOverview();
    }
  };

  const handleUpdateCertStatus = async (
    studentId: string,
    requestId: string,
    status: 'received' | 'processing' | 'completed'
  ) => {
    setFeedback(null);
    const res = await authenticatedFetch(`/api/admin/certificates/${studentId}/${requestId}/status`, {
      method: 'POST',
      body: JSON.stringify({
        status,
        admin_note:
          status === 'completed'
            ? 'Đã đối chiếu cảm nghĩ & ảnh góc học tập, hoàn tất gửi chứng nhận qua email.'
            : 'Đang rà soát hồ sơ chứng nhận 28 ngày.',
      }),
    });
    const data = await res.json();
    setFeedback({ ok: res.ok, text: data.message });
    if (res.ok) {
      await loadAdminOverview();
    }
  };

  const runLiveRuleCheck = async (scenario: {
    label: string;
    operation: 'read' | 'write';
    path: string;
    auth: unknown;
    method?: 'PUT' | 'PATCH';
    value?: unknown;
    query?: unknown;
  }) => {
    const res = await fetch('/api/rtdb/evaluate-rule', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(scenario),
    });
    const data = (await res.json()) as RuleEvalResponse;
    setRuleResult(data);
  };

  const filteredUsers = users.filter(
    (u) =>
      u.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.uid.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredQuestions = questions.filter((q) => {
    if (qTopicFilter !== 'all' && q.topic !== qTopicFilter) return false;
    if (qStatusFilter !== 'all' && q.status !== qStatusFilter) return false;
    return true;
  });

  const publishedQCount = questions.filter((q) => q.status === 'published').length;
  const draftQCount = questions.filter((q) => q.status === 'editorial_draft').length;

  const isModuleVisible = (mod: AdminModuleId) => activeModule === 'all' || activeModule === mod;

  return (
    <div className="space-y-6">
      {/* Header Superadmin & Công tắc Chế độ Kỹ thuật */}
      <section className="rounded-3xl border border-teal-200 bg-gradient-to-br from-teal-900 via-teal-800 to-slate-900 p-6 sm:p-8 text-white shadow-sm">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-teal-400/30 bg-teal-500/20 px-3 py-1 text-xs font-semibold text-teal-100">
                Trung tâm Quản trị Hệ thống BUGZ BrightUpGenZ
              </span>
              <span className="rounded-full border border-amber-300/40 bg-amber-400/20 px-3 py-1 text-xs font-bold text-amber-200">
                Superadmin: {email}
              </span>
            </div>
            <h1 className="mt-2.5 text-2xl sm:text-3xl font-extrabold text-white">
              Quản lý Tài khoản Học sinh, Học tập 28 Ngày, Trò chơi, Thư viện &amp; Cấu hình
            </h1>
            <p className="mt-1.5 text-sm text-teal-50/90">
              Hệ thống vận hành theo 2 cấp phân quyền duy nhất: <strong>Học sinh (student)</strong> và cấp cao nhất <strong>Superadmin</strong>. Toàn bộ công cụ kiểm thử kỹ thuật được gom gọn vào nút <strong>Chế độ Kỹ thuật</strong>.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <Link
              to="/admin/study-logs"
              className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-teal-300/40 bg-white/10 px-4 py-2.5 text-xs font-bold text-white transition-colors hover:bg-white/20"
            >
              <ClipboardList className="h-4 w-4" />
              <span>Nhật ký thời gian học</span>
            </Link>
            <button
              type="button"
              data-testid="toggle-admin-technical-mode"
              onClick={() => setTechnicalModeEnabled((v) => !v)}
              className={`inline-flex min-h-[44px] items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition-all shadow-xs ${
                technicalModeEnabled
                  ? 'bg-amber-400 text-slate-950 ring-2 ring-amber-200'
                  : 'border border-teal-300/40 bg-white/10 text-white hover:bg-white/20'
              }`}
            >
              <Wrench className="h-4 w-4 text-amber-300" />
              <span>
                {technicalModeEnabled
                  ? 'Chế độ Kỹ thuật: ĐANG BẬT (Nhấn để ẩn)'
                  : 'Bật Chế độ Kỹ thuật (Dành cho Superadmin)'}
              </span>
            </button>

            <button
              type="button"
              onClick={loadAdminOverview}
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl bg-amber-400 px-3.5 py-2 text-xs font-bold text-slate-950 hover:bg-amber-300 transition-colors"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span>Làm mới dữ liệu</span>
            </button>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs">
        {/* Thống kê tổng quan nhanh */}
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5" data-testid="admin-group-overview">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5">
            <div className="text-[11px] font-semibold text-slate-500">1. Tài khoản Học sinh</div>
            <div className="mt-1 text-xl font-bold text-slate-900">{users.length} tài khoản</div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5">
            <div className="text-[11px] font-semibold text-slate-500">2. Học tập 28 Ngày</div>
            <div className="mt-1 text-xl font-bold text-slate-900">
              {learningDays.length} bài · {certificateRequests.length} YC chứng nhận
            </div>
          </div>
          <div className="rounded-xl border border-teal-200 bg-teal-50/60 p-3.5">
            <div className="text-[11px] font-semibold text-teal-900">3. Câu hỏi Trò chơi</div>
            <div className="mt-1 text-xl font-bold text-teal-950">
              {publishedQCount} mở / {draftQCount} nháp
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5">
            <div className="text-[11px] font-semibold text-slate-500">4. Danh mục Thư viện</div>
            <div className="mt-1 text-xl font-bold text-slate-900">
              7 chuyên mục
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5">
            <div className="text-[11px] font-semibold text-slate-500">5. Thiết bị &amp; Cấu hình</div>
            <div className="mt-1 text-xl font-bold text-slate-900">
              {devices.length} Robot · {reminderTemplates.length} mẫu nhắc
            </div>
          </div>
        </div>

        {/* Thanh điều hướng 5 Phân hệ Quản lý Chuyên biệt */}
        <div className="mt-6 flex flex-wrap gap-2 border-b border-slate-200 pb-4">
          <button
            type="button"
            data-testid="admin-tab-users"
            onClick={() => setActiveModule('users')}
            className={`inline-flex min-h-[42px] items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-colors ${
              activeModule === 'users'
                ? 'bg-teal-800 text-white shadow-xs'
                : 'border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
            }`}
          >
            <Users className="h-4 w-4" />
            <span>1. Quản lý Tài khoản &amp; Phân quyền</span>
          </button>

          <button
            type="button"
            data-testid="admin-tab-content"
            onClick={() => setActiveModule('learning')}
            className={`inline-flex min-h-[42px] items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-colors ${
              activeModule === 'learning'
                ? 'bg-teal-800 text-white shadow-xs'
                : 'border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
            }`}
          >
            <BookOpen className="h-4 w-4" />
            <span>2. Quản lý Nội dung Học tập (28 Ngày)</span>
          </button>

          <button
            type="button"
            data-testid="admin-tab-questions"
            onClick={() => setActiveModule('games')}
            className={`inline-flex min-h-[42px] items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-colors ${
              activeModule === 'games'
                ? 'bg-teal-800 text-white shadow-xs'
                : 'border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
            }`}
          >
            <Gamepad2 className="h-4 w-4" />
            <span>3. Quản lý Nội dung Trò chơi (40 Câu)</span>
          </button>

          <button
            type="button"
            data-testid="admin-tab-library"
            onClick={() => setActiveModule('library')}
            className={`inline-flex min-h-[42px] items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-colors ${
              activeModule === 'library'
                ? 'bg-teal-800 text-white shadow-xs'
                : 'border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
            }`}
          >
            <Library className="h-4 w-4" />
            <span>4. Quản lý Nội dung Thư viện</span>
          </button>

          <button
            type="button"
            data-testid="admin-tab-settings"
            onClick={() => setActiveModule('settings')}
            className={`inline-flex min-h-[42px] items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-colors ${
              activeModule === 'settings'
                ? 'bg-teal-800 text-white shadow-xs'
                : 'border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
            }`}
          >
            <Settings className="h-4 w-4" />
            <span>5. Quản lý Thiết lập Cấu hình</span>
          </button>

          <button
            type="button"
            data-testid="admin-tab-all"
            onClick={() => setActiveModule('all')}
            className={`inline-flex min-h-[42px] items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-semibold transition-colors ${
              activeModule === 'all'
                ? 'bg-slate-900 text-white'
                : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            <span>Hiển thị tất cả</span>
          </button>
        </div>

        {feedback && (
          <div
            role="alert"
            data-testid="admin-action-feedback"
            className={`mt-4 rounded-xl border p-4 text-xs ${
              feedback.ok
                ? 'border-emerald-300 bg-emerald-50 text-emerald-950'
                : 'border-rose-300 bg-rose-50 text-rose-950'
            }`}
          >
            <strong>Thông báo:</strong> {feedback.text}
          </div>
        )}

        {/* ==================== MODULE 1: QUẢN LÝ NGƯỜI DÙNG & PHÂN QUYỀN ==================== */}
        {isModuleVisible('users') && (
          <div className="mt-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  1. Quản lý Tài khoản Học sinh &amp; Phân quyền Superadmin ({filteredUsers.length} tài khoản)
                </h2>
                <p className="text-xs text-slate-600">
                  Hệ thống chỉ sử dụng 1 loại tài khoản <strong>Học sinh (student)</strong> và 1 cấp quản trị cao nhất là <strong>Superadmin</strong> (không có tài khoản liên kết phụ huynh hay cấp Admin trung gian).
                </p>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Tìm theo tên hoặc email..."
                  className="rounded-xl border border-slate-300 px-3.5 py-2 text-xs text-slate-900"
                />
              </div>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
                  <tr>
                    <th className="p-3 font-semibold">Email Tài khoản</th>
                    <th className="p-3 font-semibold">Họ và tên Học sinh</th>
                    <th className="p-3 font-semibold">Cấp phân quyền</th>
                    <th className="p-3 font-semibold">Trạng thái</th>
                    <th className="p-3 font-semibold">Mã Hồ sơ Học sinh</th>
                    <th className="p-3 font-semibold">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filteredUsers.map((u) => (
                    <tr key={u.uid} className="hover:bg-slate-50/80">
                      <td className="p-3">
                        <div className="font-bold text-slate-900">{u.email}</div>
                        {technicalModeEnabled && (
                          <div className="font-mono text-[11px] text-slate-500">UID: {u.uid}</div>
                        )}
                      </td>
                      <td className="p-3 font-medium text-slate-900">{u.full_name}</td>
                      <td className="p-3">
                        <select
                          aria-label={`Đổi vai trò cho ${u.email}`}
                          value={u.role === 'superadmin' ? 'superadmin' : 'student'}
                          onChange={(e) => handleChangeRole(u.uid, e.target.value as UserRole)}
                          className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-900"
                        >
                          <option value="student">Học sinh (student)</option>
                          <option value="superadmin">Superadmin</option>
                        </select>
                      </td>
                      <td className="p-3">
                        <span
                          className={`rounded px-2 py-0.5 text-[11px] font-bold ${
                            u.disabled
                              ? 'bg-rose-100 text-rose-900'
                              : 'bg-emerald-100 text-emerald-900'
                          }`}
                        >
                          {u.disabled ? 'Đã khóa' : 'Đang hoạt động'}
                        </span>
                      </td>
                      <td className="p-3 text-xs font-mono text-slate-700">
                        {u.student_accounts.length > 0
                          ? u.student_accounts.join(', ')
                          : `stu-${u.uid.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 28)}`}
                      </td>
                      <td className="p-3">
                        {u.uid !== uid && (
                          <button
                            type="button"
                            onClick={() => handleToggleDisabled(u.uid, !u.disabled)}
                            className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                              u.disabled
                                ? 'bg-emerald-700 text-white hover:bg-emerald-800'
                                : 'border border-rose-300 bg-rose-50 text-rose-900 hover:bg-rose-100'
                            }`}
                          >
                            {u.disabled ? 'Mở khóa' : 'Khóa tài khoản'}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ==================== MODULE 2: QUẢN LÝ NỘI DUNG HỌC TẬP (28 NGÀY & CHỨNG NHẬN) ==================== */}
        {isModuleVisible('learning') && (
          <div className="mt-8 space-y-6 border-t border-slate-200 pt-6" data-testid="admin-p02-cms-section">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  2. Quản lý Nội dung Học tập 4 Tuần · 28 Ngày &amp; Duyệt Chứng nhận
                </h2>
                <p className="text-xs text-slate-600">
                  Biên tập tiêu đề, khẩu hiệu, các bước hướng dẫn thực hành của từng ngày và xét duyệt yêu cầu nhận chứng nhận hoàn thành. Đã duyệt &amp; xuất bản:{' '}
                  <strong className="text-teal-900">
                    {learningDays.filter((d) => d.publish_status === 'published').length}/28 ngày
                  </strong>
                  .
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  data-testid="btn-cms-bulk-publish-days"
                  onClick={handleBulkPublishLearningDays}
                  className="rounded-xl bg-teal-800 px-3.5 py-2 text-xs font-bold text-white hover:bg-teal-900"
                >
                  Duyệt &amp; Xuất bản Toàn bộ 28 Ngày
                </button>
                <Link
                  to={`/learn/days/${selectedDayNum}`}
                  className="rounded-xl border border-teal-600 bg-teal-50 px-3.5 py-2 text-xs font-bold text-teal-900 hover:bg-teal-100"
                >
                  Xem trang bài học Ngày {selectedDayNum} →
                </Link>
              </div>
            </div>

            <div className="grid grid-cols-7 sm:grid-cols-14 gap-1.5">
              {learningDays.map((d) => (
                <button
                  key={d.day_number}
                  type="button"
                  onClick={() => setSelectedDayNum(d.day_number)}
                  className={`py-2 px-1 rounded-lg border text-xs font-bold transition-colors ${
                    selectedDayNum === d.day_number
                      ? 'border-teal-800 bg-teal-800 text-white'
                      : d.publish_status === 'published'
                      ? 'border-emerald-300 bg-emerald-50 text-emerald-900'
                      : d.clinical_review_flag
                      ? 'border-amber-300 bg-amber-50 text-amber-900'
                      : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  Ngày {d.day_number}
                </button>
              ))}
            </div>

            {currentEditDay && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 rounded-xl border border-slate-200 bg-slate-50 p-5">
                <div className="lg:col-span-4 space-y-3">
                  <div className="text-xs font-bold text-teal-900">
                    Thumbnail Cover & Thẻ bài học Ngày {currentEditDay.day_number} (Tuần {currentEditDay.week_number})
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-xl border border-slate-200 bg-white p-2 flex flex-col items-center gap-1">
                      <span className="text-[10px] font-semibold text-teal-800">Thumbnail Cover (WebP)</span>
                      <div className="w-full max-w-[140px] aspect-[2/3] overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
                        <img
                          src={currentEditDay.cover_asset?.runtime_url || `/assets/drive/cover%20d${currentEditDay.day_number}.webp`}
                          alt={`Cover Ngày ${currentEditDay.day_number}`}
                          className="h-full w-full object-cover"
                          loading="lazy"
                          decoding="async"
                        />
                      </div>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-white p-2 flex flex-col items-center gap-1">
                      <span className="text-[10px] font-semibold text-slate-600">Thẻ bài học chính</span>
                      <div className="w-full max-w-[140px] aspect-[2/3] overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
                        <img
                          src={currentEditDay.primary_asset.runtime_url || `/assets/drive/day${currentEditDay.day_number}.png`}
                          alt={`Ngày ${currentEditDay.day_number}`}
                          className="h-full w-full object-contain"
                          loading="lazy"
                          decoding="async"
                        />
                      </div>
                    </div>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white p-3 text-xs space-y-1 text-slate-700">
                    <div>• Thumbnail Cover (WebP): <strong>{currentEditDay.cover_asset?.name || `cover d${currentEditDay.day_number}.png`}</strong></div>
                    <div>• Thẻ bài học: <strong>{currentEditDay.primary_asset.name}</strong></div>
                    <div>• Giải thích Bóng đèn: <strong>{currentEditDay.info_asset.name}</strong></div>
                    <div>• Huy chương: <strong>{currentEditDay.medal_asset.name}</strong></div>
                    <div data-testid="cms-day-version">• Phiên bản nội dung: <strong>{currentEditDay.source_version}</strong></div>
                  </div>
                </div>

                <div className="lg:col-span-8 space-y-4 flex flex-col justify-between">
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700">
                        Tiêu đề bài học Ngày {currentEditDay.day_number}
                      </label>
                      <input
                        type="text"
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        data-testid="cms-title-input"
                        className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs text-slate-900"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700">
                        Khẩu hiệu ghi nhớ
                      </label>
                      <input
                        type="text"
                        value={editSlogan}
                        onChange={(e) => setEditSlogan(e.target.value)}
                        className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs text-slate-900"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700">
                        Các bước hướng dẫn thực hành (mỗi dòng 1 bước)
                      </label>
                      <textarea
                        rows={4}
                        value={editStepsText}
                        onChange={(e) => setEditStepsText(e.target.value)}
                        className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs text-slate-900"
                      />
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-white p-3.5 space-y-2">
                      <label className="flex items-start gap-2 text-xs text-slate-800 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={editClinicalFlag}
                          onChange={(e) => setEditClinicalFlag(e.target.checked)}
                          data-testid="cms-clinical-flag-checkbox"
                          className="mt-0.5 rounded border-slate-400"
                        />
                        <span>
                          <strong>Cần lưu ý rà soát ngôn ngữ sức khỏe cho bài học này</strong>
                        </span>
                      </label>

                      <label className="flex items-start gap-2 text-xs text-slate-800 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={editInfoVerified}
                          onChange={(e) => setEditInfoVerified(e.target.checked)}
                          data-testid="cms-info-verified-checkbox"
                          className="mt-0.5 rounded border-slate-400"
                        />
                        <span>
                          <strong>Đã xác nhận đầy đủ học liệu giải thích ({currentEditDay.info_asset.name})</strong>
                        </span>
                      </label>

                      <div className="pt-1">
                        <label className="block text-xs font-semibold text-slate-700">
                          Trạng thái xuất bản bài học
                        </label>
                        <select
                          value={editPublishStatus}
                          onChange={(e) =>
                            setEditPublishStatus(
                              e.target.value as 'draft_pending_asset_and_content_verification' | 'published'
                            )
                          }
                          data-testid="cms-publish-status-select"
                          className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-900"
                        >
                          <option value="draft_pending_asset_and_content_verification">
                            Bản nháp (Chờ rà soát)
                          </option>
                          <option value="published">Đã duyệt &amp; Xuất bản</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 pt-3 border-t border-slate-200">
                    <button
                      type="button"
                      data-testid="btn-cms-save-day"
                      onClick={() => handleSaveLearningDay()}
                      className="rounded-xl bg-teal-800 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-900"
                    >
                      Lưu Cập nhật Ngày {currentEditDay.day_number}
                    </button>
                    <button
                      type="button"
                      data-testid="btn-cms-test-publish-guard"
                      onClick={() => handleSaveLearningDay('published')}
                      className="rounded-xl border border-teal-600 bg-white px-4 py-2 text-xs font-semibold text-teal-900 hover:bg-teal-50"
                    >
                      Duyệt &amp; Xuất bản Ngày {currentEditDay.day_number}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Hàng đợi Duyệt Yêu cầu Chứng nhận Ngày 28 */}
            <div className="space-y-3 border-t border-slate-200 pt-5" data-testid="admin-cert-requests-section">
              <h3 className="text-base font-bold text-slate-900">
                Danh sách Yêu cầu Nhận Chứng nhận Hoàn thành 28 Ngày ({certificateRequests.length} yêu cầu)
              </h3>
              {certificateRequests.length === 0 ? (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-500">
                  Hiện chưa có yêu cầu nhận chứng nhận nào. Người dùng có thể gửi từ trang{' '}
                  <Link to="/certificate-request" className="font-bold text-teal-800 underline">
                    Nhận chứng nhận Ngày 28
                  </Link>.
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-slate-200">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
                      <tr>
                        <th className="p-3 font-semibold">Hồ sơ Học sinh</th>
                        <th className="p-3 font-semibold">Email Liên hệ</th>
                        <th className="p-3 font-semibold">Cảm nghĩ 28 Ngày &amp; Ảnh góc học tập</th>
                        <th className="p-3 font-semibold">Trạng thái</th>
                        <th className="p-3 font-semibold">Xét duyệt</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {certificateRequests.map((req) => (
                        <tr key={req.request_id}>
                          <td className="p-3">
                            <div className="font-bold text-slate-900">{req.student_display_name}</div>
                            <div className="text-[11px] text-slate-500">{req.request_id}</div>
                          </td>
                          <td className="p-3 text-slate-700">{req.guardian_email}</td>
                          <td className="p-3 max-w-md">
                            <div className="font-medium text-slate-900">“{req.reflection_text}”</div>
                            <div className="text-[11px] text-teal-800 mt-0.5">
                              Ảnh đính kèm: {req.achievement_photo_name}
                            </div>
                          </td>
                          <td className="p-3">
                            <span
                              className={`rounded px-2 py-0.5 text-[11px] font-bold ${
                                req.status === 'completed'
                                  ? 'bg-emerald-100 text-emerald-900'
                                  : req.status === 'processing'
                                  ? 'bg-amber-100 text-amber-900'
                                  : 'bg-sky-100 text-sky-900'
                              }`}
                            >
                              {req.status === 'completed'
                                ? 'Đã cấp chứng nhận'
                                : req.status === 'processing'
                                ? 'Đang xử lý'
                                : 'Chờ duyệt'}
                            </span>
                          </td>
                          <td className="p-3">
                            <div className="flex flex-wrap gap-1.5">
                              <button
                                type="button"
                                onClick={() =>
                                  handleUpdateCertStatus(req.student_id, req.request_id, 'processing')
                                }
                                className="rounded border border-amber-300 bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-900 hover:bg-amber-100"
                              >
                                Đang xử lý
                              </button>
                              <button
                                type="button"
                                data-testid={`btn-approve-cert-${req.request_id}`}
                                onClick={() =>
                                  handleUpdateCertStatus(req.student_id, req.request_id, 'completed')
                                }
                                className="rounded bg-emerald-700 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-emerald-800"
                              >
                                Duyệt &amp; Hoàn tất
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ==================== MODULE 3: QUẢN LÝ NỘI DUNG TRÒ CHƠI (3 CHẾ ĐỘ & 40 CÂU HỎI) ==================== */}
        {isModuleVisible('games') && (
          <div className="mt-8 space-y-5 border-t border-slate-200 pt-6" data-testid="admin-p05-questions-section">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  3. Quản lý Nội dung Trò chơi &amp; Ngân hàng 40 Câu hỏi
                </h2>
                <p className="text-xs text-slate-600">
                  Quản lý 3 chế độ trò chơi và biên tập, duyệt xuất bản ngân hàng 40 câu hỏi (20 câu Lưng thẳng · 20 câu Mắt sáng).
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  data-testid="btn-admin-dryrun-seed"
                  onClick={() => handleImportQuestionSeed(true, 'strict_editorial_draft')}
                  className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-50"
                >
                  Kiểm tra Ngân hàng 40 câu
                </button>
                <button
                  type="button"
                  data-testid="btn-admin-import-draft"
                  onClick={() => handleImportQuestionSeed(false, 'strict_editorial_draft')}
                  className="rounded-xl border border-amber-400 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-950 hover:bg-amber-100"
                >
                  Đặt tất cả về Bản nháp
                </button>
                <button
                  type="button"
                  data-testid="btn-admin-import-sandbox"
                  onClick={() => handleImportQuestionSeed(false, 'sandbox_with_12_published')}
                  className="rounded-xl border border-teal-400 bg-teal-50 px-3 py-1.5 text-xs font-semibold text-teal-950 hover:bg-teal-100"
                >
                  Mở 12 câu mẫu tiêu chuẩn
                </button>
                <button
                  type="button"
                  data-testid="btn-admin-bulk-publish-all"
                  onClick={() => handleBulkPublishQuestions()}
                  className="rounded-xl bg-teal-800 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-teal-900"
                >
                  Duyệt &amp; Mở Toàn bộ 40 Câu
                </button>
              </div>
            </div>

            {/* Tóm tắt 3 chế độ chơi */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              {GAME_BLUEPRINTS.games.map((g) => (
                <div key={g.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4 flex flex-col justify-between">
                  <div>
                    <div className="text-xs font-bold text-teal-800">{g.title}</div>
                    <p className="mt-1 text-xs text-slate-600">
                      {g.id === 'situations'
                        ? publishedQCount >= 40
                          ? `Đã duyệt & mở TOÀN BỘ ${publishedQCount}/40 câu hỏi (20 câu Lưng thẳng · 20 câu Mắt sáng — tối đa 400 điểm).`
                          : `Sử dụng trực tiếp ngân hàng câu hỏi đã duyệt bên dưới (Đang mở ${publishedQCount}/40 câu — có thể chơi toàn bộ câu đã duyệt hoặc 5 câu/vòng).`
                        : g.id === 'desk_builder'
                        ? 'Tương tác sắp xếp 3 vị trí bàn học chuẩn (Đèn học, Mặt bàn, Kê chân — tối đa 30 điểm).'
                        : 'Sắp xếp thứ tự 4 bước thói quen học tập và nghỉ mắt (tối đa 20 điểm).'}
                    </p>
                  </div>
                  <div className="mt-3 pt-2 border-t border-slate-200 flex items-center justify-between text-xs">
                    <span className="font-semibold text-emerald-800">
                      {g.id === 'situations'
                        ? `Đang mở ${publishedQCount}/40 câu`
                        : 'Đang hoạt động'}
                    </span>
                    <Link
                      to={
                        g.id === 'situations'
                          ? `/games/play/situations?topic=all&limit=${publishedQCount >= 40 ? 'all' : 'all'}`
                          : `/games/play/${g.id}`
                      }
                      className="font-bold text-teal-800 hover:underline"
                    >
                      Mở chơi thử →
                    </Link>
                  </div>
                </div>
              ))}
            </div>

            {/* Bộ lọc 40 câu hỏi */}
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold text-slate-700">Chủ đề:</span>
                {(['all', 'lung_thang', 'mat_sang'] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setQTopicFilter(t)}
                    className={`rounded-lg px-2.5 py-1 font-semibold ${
                      qTopicFilter === t
                        ? 'bg-slate-900 text-white'
                        : 'bg-white text-slate-700 border border-slate-300'
                    }`}
                  >
                    {t === 'all' ? 'Tất cả (40)' : t === 'lung_thang' ? 'Lưng thẳng (20)' : 'Mắt sáng (20)'}
                  </button>
                ))}

                <span className="ml-2 font-semibold text-slate-700">Trạng thái:</span>
                {(['all', 'published', 'editorial_draft'] as const).map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setQStatusFilter(st)}
                    className={`rounded-lg px-2.5 py-1 font-semibold ${
                      qStatusFilter === st
                        ? 'bg-teal-800 text-white'
                        : 'bg-white text-slate-700 border border-slate-300'
                    }`}
                  >
                    {st === 'all'
                      ? `Tất cả (${questions.length})`
                      : st === 'published'
                      ? `Đã xuất bản (${publishedQCount})`
                      : `Bản nháp (${draftQCount})`}
                  </button>
                ))}
              </div>

              <span className="text-slate-600" data-testid="admin-question-stats">
                Đang hiển thị {filteredQuestions.length} / {questions.length} câu
              </span>
            </div>

            {/* Lưới chọn nhanh 40 câu hỏi */}
            <div className="grid grid-cols-5 gap-1.5 sm:grid-cols-10">
              {filteredQuestions.map((q) => (
                <button
                  key={q.id}
                  type="button"
                  data-testid={`admin-q-btn-${q.id}`}
                  onClick={() => setSelectedQuestionId(q.id)}
                  className={`rounded-lg border px-2 py-1.5 font-mono text-[11px] font-bold transition-colors ${
                    selectedQuestionId === q.id
                      ? 'border-slate-900 bg-slate-900 text-white'
                      : q.status === 'published'
                      ? 'border-emerald-300 bg-emerald-50 text-emerald-900'
                      : 'border-amber-300 bg-amber-50 text-amber-900'
                  }`}
                >
                  {q.id.replace('BUGZ-', '')}
                </button>
              ))}
            </div>

            {/* Trình biên tập chi tiết câu hỏi */}
            {currentEditQuestion && (
              <div className="grid grid-cols-1 gap-6 rounded-xl border border-slate-200 bg-slate-50 p-5 lg:grid-cols-12">
                <div className="lg:col-span-5 space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-teal-900">
                      Câu hỏi {currentEditQuestion.id} ({currentEditQuestion.topic === 'lung_thang' ? 'Lưng thẳng' : 'Mắt sáng'})
                    </span>
                    <span
                      data-testid="admin-q-version"
                      className="rounded bg-white px-2 py-0.5 font-bold text-slate-800 border border-slate-200"
                    >
                      v{currentEditQuestion.version} · {currentEditQuestion.status === 'published' ? 'Đã xuất bản' : 'Bản nháp'}
                    </span>
                  </div>

                  <AtlasIllustration illustrationId={editQIllId} showCaption={true} />

                  <div>
                    <label className="block text-xs font-semibold text-slate-700">
                      Hình minh họa tình huống
                    </label>
                    <select
                      value={editQIllId}
                      onChange={(e) => setEditQIllId(e.target.value as IllustrationId)}
                      className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-900"
                    >
                      <option value="POSTURE">Tư thế ngồi thẳng &amp; cầm sách</option>
                      <option value="DESK">Sắp xếp đèn học, bàn ghế &amp; kê chân</option>
                      <option value="EYES">Thư giãn mắt nhìn xa qua cửa sổ 20-20-20</option>
                      <option value="MOVE">Vươn vai vận động nghỉ giải lao</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700">
                      Bài học liên quan trong 28 ngày (cách nhau dấu phẩy)
                    </label>
                    <input
                      type="text"
                      value={editQSourceDays}
                      onChange={(e) => setEditQSourceDays(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900"
                    />
                  </div>
                </div>

                <div className="lg:col-span-7 space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700">
                      Nội dung câu hỏi tình huống
                    </label>
                    <textarea
                      rows={2}
                      data-testid="admin-q-prompt-input"
                      value={editQPrompt}
                      onChange={(e) => setEditQPrompt(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900"
                    />
                  </div>

                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700">
                        Phương án A
                      </label>
                      <input
                        type="text"
                        value={editQOptA}
                        onChange={(e) => setEditQOptA(e.target.value)}
                        className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700">
                        Phương án B
                      </label>
                      <input
                        type="text"
                        value={editQOptB}
                        onChange={(e) => setEditQOptB(e.target.value)}
                        className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700">
                        Phương án C
                      </label>
                      <input
                        type="text"
                        value={editQOptC}
                        onChange={(e) => setEditQOptC(e.target.value)}
                        className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700">
                        Đáp án đúng
                      </label>
                      <select
                        value={editQCorrectOpt}
                        onChange={(e) => setEditQCorrectOpt(e.target.value as 'A' | 'B' | 'C')}
                        className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-teal-900"
                      >
                        <option value="A">Phương án A</option>
                        <option value="B">Phương án B</option>
                        <option value="C">Phương án C</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700">
                        Giải thích đáp án
                      </label>
                      <input
                        type="text"
                        value={editQExplanation}
                        onChange={(e) => setEditQExplanation(e.target.value)}
                        className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900"
                      />
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-white p-3.5 space-y-2">
                    <div className="text-xs font-bold text-slate-900">
                      Xác nhận Kiểm duyệt trước khi Xuất bản:
                    </div>
                    <label className="flex items-center gap-2 text-xs text-slate-800 cursor-pointer">
                      <input
                        type="checkbox"
                        data-testid="q-content-reviewed-checkbox"
                        checked={editQContentReviewed}
                        onChange={(e) => setEditQContentReviewed(e.target.checked)}
                        className="rounded border-slate-400"
                      />
                      <span>
                        <strong>1. Đã duyệt nội dung sư phạm phù hợp lứa tuổi</strong>
                      </span>
                    </label>
                    <label className="flex items-center gap-2 text-xs text-slate-800 cursor-pointer">
                      <input
                        type="checkbox"
                        data-testid="q-clinical-reviewed-checkbox"
                        checked={editQClinicalReviewed}
                        onChange={(e) => setEditQClinicalReviewed(e.target.checked)}
                        className="rounded border-slate-400"
                      />
                      <span>
                        <strong>2. Đã rà soát chuẩn ngôn ngữ sức khỏe học đường</strong>
                      </span>
                    </label>
                  </div>

                  <div className="flex flex-wrap gap-2 pt-2">
                    <button
                      type="button"
                      data-testid="btn-q-save"
                      onClick={() => handleSaveQuestion('editorial_draft')}
                      className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-100"
                    >
                      Lưu Bản nháp ({currentEditQuestion.id})
                    </button>
                    <button
                      type="button"
                      data-testid="btn-q-publish"
                      onClick={() => handleSaveQuestion('published')}
                      className="rounded-xl bg-teal-800 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-900"
                    >
                      Duyệt &amp; Xuất bản ({currentEditQuestion.id})
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ==================== MODULE 4: QUẢN LÝ NỘI DUNG THƯ VIỆN ==================== */}
        {isModuleVisible('library') && (
          <div className="mt-8 space-y-5 border-t border-slate-200 pt-6" data-testid="admin-library-section">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  4. Quản lý Nội dung Thư viện (7 Chuyên mục)
                </h2>
                <p className="text-xs text-slate-600">
                  Quản lý và đối chiếu toàn bộ nội dung hiển thị tại Thư viện: Bảng tổng hợp Flashcard, 6 bài Báo chí, 4 hồ sơ Đội ngũ, 4 Chứng nhận chuyên môn, BOT AI, Cộng đồng và Hỗ trợ.
                </p>
              </div>
              <Link
                to="/library/flashcard"
                className="rounded-xl border border-teal-600 bg-teal-50 px-3.5 py-2 text-xs font-bold text-teal-900 hover:bg-teal-100"
              >
                Mở trang Thư viện Người dùng →
              </Link>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {/* 1. Flashcard & BOT AI & Cộng đồng */}
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-900">1. Bảng Flashcard 28 Ngày &amp; Liên kết Cộng đồng</h3>
                  <Link to="/library/flashcard" className="text-xs font-bold text-teal-800 hover:underline">
                    Xem trực tiếp →
                  </Link>
                </div>
                <div className="text-xs text-slate-700 space-y-1.5">
                  <div>• <strong>Ảnh Flashcard tổng:</strong> <code className="font-mono">{RUNTIME_FULL_FLASHCARD_PATH}</code></div>
                  <div>
                    • <strong>Trợ lý BOT AI:</strong>{' '}
                    <a href={EXTERNAL_LINKS.botAiGpt} target="_blank" rel="noopener noreferrer" className="text-teal-800 underline">
                      Mở liên kết GPT
                    </a>
                  </div>
                  <div>
                    • <strong>Cộng đồng Facebook:</strong>{' '}
                    <a href={EXTERNAL_LINKS.facebookCommunity} target="_blank" rel="noopener noreferrer" className="text-teal-800 underline">
                      Mở trang Facebook
                    </a>
                  </div>
                  <div>• <strong>Email Hỗ trợ &amp; Quản trị:</strong> {EXTERNAL_LINKS.superAdminBootstrapEmail}</div>
                </div>
              </div>

              {/* 2. Chứng nhận chuyên môn */}
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-900">
                    2. Chứng nhận Chuyên môn ({PROFESSIONAL_CERTIFICATES.length} văn bản)
                  </h3>
                  <Link to="/library/certificates" className="text-xs font-bold text-teal-800 hover:underline">
                    Xem trình chiếu →
                  </Link>
                </div>
                <ul className="space-y-1.5 text-xs text-slate-700">
                  {PROFESSIONAL_CERTIFICATES.map((cert) => (
                    <li key={cert.index} className="flex items-center justify-between gap-2 rounded-lg bg-white p-2 border border-slate-200">
                      <div>
                        <div className="font-bold text-slate-900">{cert.title}</div>
                        <div className="text-[11px] text-slate-500">{cert.issuer}</div>
                      </div>
                      <a
                        href={cert.runtimeUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="shrink-0 text-xs font-semibold text-teal-800 hover:underline"
                      >
                        Xem ảnh
                      </a>
                    </li>
                  ))}
                </ul>
              </div>

              {/* 3. Danh sách 6 bài Báo chí */}
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-900">
                    3. Báo chí &amp; Truyền thông ({PRESS_LINKS.length} bài viết)
                  </h3>
                  <Link to="/library/press" className="text-xs font-bold text-teal-800 hover:underline">
                    Xem trang Báo chí →
                  </Link>
                </div>
                <ul className="space-y-1.5 text-xs text-slate-700">
                  {PRESS_LINKS.map((item) => (
                    <li key={item.url} className="flex items-center justify-between gap-2 rounded-lg bg-white p-2 border border-slate-200">
                      <div className="min-w-0">
                        <div className="font-bold text-slate-900 truncate">{item.title}</div>
                        <div className="text-[11px] text-slate-500">{item.outlet} ({item.position})</div>
                      </div>
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="shrink-0 inline-flex items-center gap-1 text-xs font-semibold text-teal-800 hover:underline"
                      >
                        <span>Mở bài</span>
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </li>
                  ))}
                </ul>
              </div>

              {/* 4. Danh sách 4 thành viên Đội ngũ */}
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-900">
                    4. Hồ sơ Đội ngũ Phát triển ({TEAM_MEMBERS.length} thành viên)
                  </h3>
                  <Link to="/library/team" className="text-xs font-bold text-teal-800 hover:underline">
                    Xem trang Đội ngũ →
                  </Link>
                </div>
                <ul className="space-y-1.5 text-xs text-slate-700">
                  {TEAM_MEMBERS.map((member) => (
                    <li key={member.id} className="flex items-center justify-between gap-2 rounded-lg bg-white p-2 border border-slate-200">
                      <div>
                        <div className="font-bold text-slate-900">{member.name}</div>
                        <div className="text-[11px] text-slate-500">{member.role}</div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <a
                          href={member.cvRuntimeUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs font-semibold text-teal-800 hover:underline"
                        >
                          Hồ sơ CV
                        </a>
                        <span>·</span>
                        <a
                          href={member.contactRuntimeUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs font-semibold text-teal-800 hover:underline"
                        >
                          Liên hệ
                        </a>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* ==================== MODULE 5: QUẢN LÝ THIẾT LẬP CẤU HÌNH ==================== */}
        {isModuleVisible('settings') && (
          <div className="mt-8 space-y-6 border-t border-slate-200 pt-6">
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                5. Quản lý Thiết lập Cấu hình Hệ thống, Thiết bị Robot &amp; Mẫu Lời nhắc
              </h2>
              <p className="text-xs text-slate-600">
                Cấu hình thời gian nhắc tư thế của thiết bị Robot, chỉnh sửa mẫu câu nhắc lịch sự, quản lý ảnh hỗ trợ và nhật ký hoạt động.
              </p>
            </div>

            {/* 5.1 Quản lý Thiết bị Robot */}
            <div className="space-y-3" data-testid="admin-group-devices">
              <h3 className="text-sm font-bold text-slate-900">
                5.1. Thiết lập Thiết bị Robot &amp; Thời gian Nhắc Tư thế ({devices.length} thiết bị)
              </h3>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                {devices.map((dev) => {
                  const draft = deviceEdits[dev.device_id] || {
                    device_name: dev.device_name,
                    alert_after_sec: dev.alert_after_sec,
                  };
                  return (
                    <div key={dev.device_id} className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-2.5 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-bold text-teal-900">{dev.device_id}</span>
                        <span className="rounded bg-white px-2 py-0.5 text-[11px] border border-slate-200 font-semibold">
                          {dev.device_id === 'sim-dev01' ? 'Thiết bị Mô phỏng' : 'Thiết bị Chính'}
                        </span>
                      </div>
                      <div className="space-y-2">
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-600">
                            Tên thiết bị
                          </label>
                          <input
                            type="text"
                            value={draft.device_name}
                            onChange={(e) =>
                              setDeviceEdits((prev) => ({
                                ...prev,
                                [dev.device_id]: {
                                  ...draft,
                                  device_name: e.target.value,
                                },
                              }))
                            }
                            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-900"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-600">
                            Ngưỡng nhắc tư thế (giây, từ 10–300s)
                          </label>
                          <input
                            type="number"
                            min={10}
                            max={300}
                            value={draft.alert_after_sec}
                            onChange={(e) =>
                              setDeviceEdits((prev) => ({
                                ...prev,
                                [dev.device_id]: {
                                  ...draft,
                                  alert_after_sec: Number(e.target.value) || 30,
                                },
                              }))
                            }
                            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-bold text-teal-900"
                          />
                        </div>
                      </div>
                      <div className="text-[11px] text-slate-600">
                        Đang áp dụng: <strong>{dev.alert_after_sec} giây</strong> · Trạng thái kết nối:{' '}
                        <strong>{dev.credential?.revoked ? 'Đã tạm ngưng' : 'Đang hoạt động'}</strong>
                      </div>
                      <div className="flex flex-wrap gap-1.5 pt-2 border-t border-slate-200">
                        <button
                          type="button"
                          onClick={() =>
                            handleUpdateDeviceConfig(dev.device_id, {
                              device_name: draft.device_name,
                              alert_after_sec: draft.alert_after_sec,
                            })
                          }
                          className="rounded-lg bg-teal-800 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-teal-900"
                        >
                          Lưu Cấu hình
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            handleUpdateDeviceConfig(dev.device_id, {
                              alert_after_sec: dev.alert_after_sec === 30 ? 45 : 30,
                            })
                          }
                          className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-slate-800 hover:bg-slate-100"
                        >
                          Đổi nhanh ({dev.alert_after_sec === 30 ? '45s' : '30s'})
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            handleUpdateDeviceConfig(dev.device_id, {
                              revoked: !dev.credential?.revoked,
                            })
                          }
                          className="rounded-lg border border-rose-300 bg-rose-50 px-2.5 py-1.5 text-[11px] font-semibold text-rose-900 hover:bg-rose-100"
                        >
                          {dev.credential?.revoked ? 'Kích hoạt lại' : 'Tạm ngưng'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 5.2 Quản lý Mẫu lời nhắc */}
            <div className="space-y-3 border-t border-slate-200 pt-5" data-testid="admin-group-notifications">
              <h3 className="text-sm font-bold text-slate-900">
                5.2. Mẫu Lời nhắc Tư thế Lịch sự ({reminderTemplates.length} mẫu)
              </h3>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                {reminderTemplates.map((tpl) => {
                  const draft = templateEdits[tpl.template_id] || {
                    title: tpl.title,
                    push_body: tpl.push_body,
                    voice_text: tpl.voice_text,
                  };
                  return (
                    <div key={tpl.template_id} className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs space-y-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-[11px] font-bold text-teal-800">
                          {tpl.template_id}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleUpdateReminderTemplate(tpl)}
                          className="rounded-lg bg-teal-800 px-3 py-1 text-[11px] font-bold text-white hover:bg-teal-900"
                        >
                          Lưu &amp; Duyệt Mẫu
                        </button>
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600">
                          Tiêu đề mẫu nhắc
                        </label>
                        <input
                          type="text"
                          value={draft.title}
                          onChange={(e) =>
                            setTemplateEdits((prev) => ({
                              ...prev,
                              [tpl.template_id]: {
                                ...draft,
                                title: e.target.value,
                              },
                            }))
                          }
                          className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-900"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600">
                          Nội dung thông báo Push / Email
                        </label>
                        <textarea
                          rows={2}
                          value={draft.push_body}
                          onChange={(e) =>
                            setTemplateEdits((prev) => ({
                              ...prev,
                              [tpl.template_id]: {
                                ...draft,
                                push_body: e.target.value,
                              },
                            }))
                          }
                          className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-800"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600">
                          Lời đọc giọng nói (Voice)
                        </label>
                        <textarea
                          rows={2}
                          value={draft.voice_text}
                          onChange={(e) =>
                            setTemplateEdits((prev) => ({
                              ...prev,
                              [tpl.template_id]: {
                                ...draft,
                                voice_text: e.target.value,
                              },
                            }))
                          }
                          className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-800"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 5.3 Quản lý Ảnh Hỗ trợ Kỹ thuật */}
            <div className="space-y-3 border-t border-slate-200 pt-5" data-testid="admin-group-captures">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    5.3. Quản lý Ảnh Hỗ trợ Riêng tư ({captures.length} bản ghi)
                  </h3>
                  <p className="text-xs text-slate-600">
                    Mọi thao tác mở xem hoặc xóa ảnh đều yêu cầu ghi rõ lý do hỗ trợ.
                  </p>
                </div>
                <input
                  type="text"
                  value={captureSupportReason}
                  onChange={(e) => setCaptureSupportReason(e.target.value)}
                  placeholder="Nhập lý do hỗ trợ..."
                  className="w-72 rounded-xl border border-slate-300 px-3 py-1.5 text-xs text-slate-900"
                />
              </div>

              {previewCaptureSvg && (
                <div className="rounded-xl border border-teal-300 bg-teal-50/40 p-4 flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <img
                      src={previewCaptureSvg.dataUri}
                      alt={`Ảnh hỗ trợ ${previewCaptureSvg.captureId}`}
                      className="h-20 w-32 rounded-lg border border-slate-300 object-cover"
                    />
                    <div className="text-xs">
                      <div className="font-bold text-teal-950">
                        Đang xem: {previewCaptureSvg.captureId}
                      </div>
                      <div className="text-slate-600">Đã ghi nhận vào nhật ký hệ thống</div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPreviewCaptureSvg(null)}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-700"
                  >
                    Đóng ảnh
                  </button>
                </div>
              )}

              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
                    <tr>
                      <th className="p-2.5 font-semibold">Mã ảnh</th>
                      <th className="p-2.5 font-semibold">Thiết bị &amp; Hồ sơ</th>
                      <th className="p-2.5 font-semibold">Trạng thái</th>
                      <th className="p-2.5 font-semibold">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-xs">
                    {captures.map((cap) => (
                      <tr key={cap.capture_id}>
                        <td className="p-2.5 font-mono font-bold text-slate-900">{cap.capture_id}</td>
                        <td className="p-2.5">
                          {cap.device_id} · {cap.student_id}
                        </td>
                        <td className="p-2.5 font-semibold">{cap.status}</td>
                        <td className="p-2.5">
                          <div className="flex flex-wrap gap-1.5">
                            {cap.status === 'uploaded' && (
                              <button
                                type="button"
                                onClick={() => handlePreviewSupportCapture(cap.capture_id)}
                                className="rounded bg-teal-700 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-teal-800"
                              >
                                Xem ảnh hỗ trợ
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => handleDeleteSupportCapture(cap.capture_id)}
                              className="rounded border border-rose-300 bg-rose-50 px-2.5 py-1 text-[11px] font-semibold text-rose-900 hover:bg-rose-100"
                            >
                              Xóa ảnh
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 5.4 Nhật ký hoạt động quản trị */}
            <div className="space-y-3 border-t border-slate-200 pt-5" data-testid="admin-group-audit">
              <h3 className="text-sm font-bold text-slate-900">
                5.4. Nhật ký Hoạt động Quản trị &amp; Bảo mật ({auditLogs.length} bản ghi gần nhất)
              </h3>
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
                    <tr>
                      <th className="p-2.5 font-semibold">Thời gian</th>
                      <th className="p-2.5 font-semibold">Người thực hiện</th>
                      <th className="p-2.5 font-semibold">Hành động</th>
                      <th className="p-2.5 font-semibold">Đối tượng</th>
                      <th className="p-2.5 font-semibold">Kết quả</th>
                      <th className="p-2.5 font-semibold">Chi tiết</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 font-mono text-[11px]">
                    {auditLogs.slice(0, 15).map((log) => (
                      <tr key={log.log_id}>
                        <td className="p-2.5 text-slate-500">
                          {new Date(log.time).toLocaleTimeString('vi-VN')}
                        </td>
                        <td className="p-2.5 font-bold text-slate-900">
                          {log.actor_email || log.actor_uid}
                        </td>
                        <td className="p-2.5 text-teal-900">{log.action}</td>
                        <td className="p-2.5 text-slate-700">{log.target}</td>
                        <td className="p-2.5">
                          <span
                            className={`rounded px-1.5 py-0.5 font-bold ${
                              log.result === 'SUCCESS'
                                ? 'bg-emerald-100 text-emerald-900'
                                : 'bg-rose-100 text-rose-900'
                            }`}
                          >
                            {log.result}
                          </span>
                        </td>
                        <td className="p-2.5 font-sans text-slate-600">{log.details}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* ==================== CHẾ ĐỘ KỸ THUẬT DÀNH CHO ADMIN (CHỈ HIỂN THỊ KHI BẬT CÔNG TẮC) ==================== */}
      {technicalModeEnabled && (
        <div className="space-y-6 rounded-2xl border-2 border-amber-400 bg-amber-50/30 p-6" data-testid="admin-technical-mode-container">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-300 pb-4">
            <div>
              <div className="inline-flex items-center gap-2 rounded-md bg-amber-500 px-3 py-1 text-xs font-bold text-slate-950">
                <Wrench className="h-3.5 w-3.5" />
                <span>CHẾ ĐỘ KỸ THUẬT DÀNH CHO QUẢN TRỊ VIÊN</span>
              </div>
              <h2 className="mt-2 text-xl font-bold text-slate-900">
                Bảng Chẩn đoán Kết nối MQTT, Kiểm thử Phần cứng ESP32, Security Rules &amp; Ma trận Hệ thống
              </h2>
              <p className="mt-0.5 text-xs text-slate-700">
                Toàn bộ thông số kỹ thuật, công cụ kiểm lỗi MQTT/Simulator, bảng kiểm tra nguồn học liệu và kiểm thử phân quyền được tập trung tại đây và ẩn hoàn toàn khỏi giao diện người dùng cuối.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setTechnicalModeEnabled(false)}
              className="rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-bold text-slate-800 hover:bg-slate-100"
            >
              Đóng Chế độ Kỹ thuật
            </button>
          </div>

          {/* 1. Công cụ Chẩn đoán Robot01, MQTT Broker TLS 8883, Firmware ESP32 & Simulator */}
          <RobotAdminTechnicalPanel />

          {/* 2. Bộ Kiểm chứng Trực tiếp Realtime Database Rules (database.rules.json) */}
          <section className="rounded-2xl border border-slate-200 bg-white p-6">
            <div className="text-xs font-semibold text-teal-800">
              Kiểm thử Bảo mật Realtime Database · Thực thi trực tiếp file database.rules.json
            </div>
            <h3 className="mt-1 text-lg font-bold text-slate-900">
              Trình Kiểm chứng Realtime Database Security Rules (T01, T02, T03, T04 &amp; Query .indexOn)
            </h3>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() =>
                  runLiveRuleCheck({
                    label: 'Chưa đăng nhập đọc dữ liệu',
                    operation: 'read',
                    path: '/students/stu-a1',
                    auth: null,
                  })
                }
                className="rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-100"
              >
                Thử: Chưa đăng nhập đọc /students/stu-a1
              </button>

              <button
                type="button"
                onClick={() =>
                  runLiveRuleCheck({
                    label: 'T03: Gia đình A đọc con Gia đình B',
                    operation: 'read',
                    path: '/students/stu-b1',
                    auth: { uid: 'uid-guardian-a', token: { role: 'guardian' } },
                  })
                }
                className="rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-100"
              >
                Thử T03: Gia đình A đọc /students/stu-b1
              </button>

              <button
                type="button"
                onClick={() =>
                  runLiveRuleCheck({
                    label: 'T02: Tự ghi role=superadmin vào users/{uid}',
                    operation: 'write',
                    method: 'PUT',
                    path: '/users/uid-student-a1',
                    auth: { uid: 'uid-student-a1', token: { role: 'student' } },
                    value: {
                      full_name: 'Học sinh Minh',
                      email: 'hocsinh.minh.a1@example.com',
                      role: 'superadmin',
                    },
                  })
                }
                className="rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-100"
              >
                Thử T02: Client tự chèn role=&quot;superadmin&quot;
              </button>

              <button
                type="button"
                onClick={() =>
                  runLiveRuleCheck({
                    label: 'Tự sửa bộ đếm phiên good_count',
                    operation: 'write',
                    method: 'PATCH',
                    path: '/sessions/robot-fam-a-01/sess-a-001',
                    auth: { uid: 'uid-student-a1', token: { role: 'student' } },
                    value: { good_count: 999 },
                  })
                }
                className="rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-100"
              >
                Thử: Client tự cộng bộ đếm good_count=999
              </button>

              <button
                type="button"
                onClick={() =>
                  runLiveRuleCheck({
                    label: 'Query /devices theo user_id có .indexOn',
                    operation: 'read',
                    path: '/devices',
                    auth: { uid: 'uid-guardian-a', token: { role: 'guardian' } },
                    query: { orderByChild: 'user_id', equalTo: 'uid-guardian-a' },
                  })
                }
                className="rounded-xl border border-teal-300 bg-teal-50 px-3 py-2 text-xs font-semibold text-teal-900 hover:bg-teal-100"
              >
                Thử Query Hợp lệ: /devices?orderBy=&quot;user_id&quot;
              </button>
            </div>

            {ruleResult && (
              <div
                className={`mt-4 rounded-xl border p-4 font-mono text-xs ${
                  ruleResult.allowed
                    ? 'border-emerald-300 bg-emerald-50 text-emerald-950'
                    : 'border-rose-300 bg-rose-50 text-rose-950'
                }`}
              >
                <div className="font-bold">
                  Kết quả Rules ({ruleResult.operation.toUpperCase()} {ruleResult.path}):{' '}
                  {ruleResult.allowed ? 'ALLOWED (Cho phép)' : 'PERMISSION_DENIED (Từ chối)'}
                </div>
                <div className="mt-1">Chi tiết: {ruleResult.reason}</div>
              </div>
            )}
          </section>

          {/* 3. Bảng Đối chiếu Nguồn Học liệu P02 */}
          <section className="rounded-2xl border border-slate-200 bg-white p-6 space-y-3">
            <h3 className="text-base font-bold text-slate-900">
              Bảng Đối chiếu Nguồn Học liệu &amp; Tài nguyên (source_manifest.json)
            </h3>
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                  <tr>
                    <th className="p-2.5">Nhóm tài nguyên</th>
                    <th className="p-2.5">Tên trong đặc tả</th>
                    <th className="p-2.5">Tên thực tế trên Drive</th>
                    <th className="p-2.5">Trạng thái Runtime</th>
                    <th className="p-2.5">Ghi chú</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-slate-700">
                  {sourceReport.map((item) => (
                    <tr key={item.asset_key}>
                      <td className="p-2.5 font-mono text-[11px]">{item.category}</td>
                      <td className="p-2.5 font-semibold">{item.word_spec_name}</td>
                      <td className="p-2.5 font-mono text-teal-800">{item.actual_drive_name}</td>
                      <td className="p-2.5">
                        {item.in_runtime_bundle ? (
                          <span className="rounded bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-900">
                            Đã nạp ({item.runtime_path})
                          </span>
                        ) : (
                          <span className="rounded bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-900">
                            Chưa có trên Drive gốc
                          </span>
                        )}
                      </td>
                      <td className="p-2.5 text-slate-500">{item.note}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* 4. Công cụ Kiểm thử Thông báo & Hàng đợi Jobs */}
          <NotificationCenterPanel showTechnicalTools={true} />

          {/* 5. Ma trận Nghiệm thu, Đo độ trễ p95 & Backup/Restore Demo */}
          <IntegrationStatusPage />
        </div>
      )}
    </div>
  );
};
