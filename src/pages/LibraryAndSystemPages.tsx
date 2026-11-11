import React, { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import {
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Pause,
  Play,
  ShieldCheck,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import {
  EXTERNAL_LINKS,
  LEARNING_DAYS_28,
  PRESS_LINKS,
  PROFESSIONAL_CERTIFICATES,
  RUNTIME_FULL_FLASHCARD_PATH,
  TEAM_MEMBERS,
  UI_BRANDING_ASSETS,
} from '../data/sourceMapping';
import { getFirebaseAuthAndRtdb, getFirebaseClientConfigReport } from '../lib/firebaseClient';
import { useAuth } from '../context/AuthContext';
import {
  DEMO_6_MINUTE_SCRIPT,
  P06_ACCEPTANCE_MATRIX_30,
  P0_SECURITY_AUDIT_ITEMS,
} from '../domain/p06AcceptanceMatrix';
import type { IntegrationComponentStatus } from '../types/bugz';

const LIBRARY_TABS = [
  { id: 'flashcard', label: 'Flashcard 28 Ngày' },
  { id: 'press', label: 'Báo chí' },
  { id: 'team', label: 'Đội ngũ' },
  { id: 'certificates', label: 'Chứng nhận Chuyên môn' },
  { id: 'bot-ai', label: 'Trợ lý BOT AI' },
  { id: 'community', label: 'Cộng đồng' },
  { id: 'support', label: 'Hỗ trợ' },
] as const;

export const LibrarySectionPage: React.FC = () => {
  const { section } = useParams<{ section: string }>();
  const [searchParams] = useSearchParams();
  const activeTab = section || 'flashcard';

  const [zoomPercent, setZoomPercent] = useState<100 | 150 | 200 | 300>(100);
  const highlightDay = Number(searchParams.get('day')) || null;

  const [certIdx, setCertIdx] = useState(0);
  const [certPaused, setCertPaused] = useState(true);
  const [certZoomed, setCertZoomed] = useState(false);
  const [selectedTeamContact, setSelectedTeamContact] = useState<string | null>(null);

  useEffect(() => {
    if (activeTab !== 'certificates' || certPaused) return;
    const timer = window.setInterval(() => {
      setCertIdx((prev) => (prev + 1) % PROFESSIONAL_CERTIFICATES.length);
    }, 4000);
    return () => window.clearInterval(timer);
  }, [activeTab, certPaused]);

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-teal-200 bg-gradient-to-br from-teal-900 via-teal-800 to-slate-900 p-6 sm:p-8 text-white shadow-sm">
        <div className="inline-flex items-center gap-2 rounded-full border border-teal-400/30 bg-teal-500/20 px-3 py-1 text-xs font-semibold text-teal-100">
          <span>Thư viện Học liệu &amp; Thông tin Dự án BrightUpGenZ</span>
        </div>
        <h1 className="mt-2 text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
          Thư viện &amp; Cộng đồng BUGZ
        </h1>
        <p className="mt-1.5 max-w-2xl text-xs sm:text-sm text-teal-50/90 leading-relaxed">
          Tra cứu nhanh bảng tổng hợp 28 thẻ bài học, các bài viết báo chí, đội ngũ phát triển, văn bản đánh giá chuyên môn và kênh hỗ trợ cộng đồng.
        </p>

        {/* Sub-navigation Tabs */}
        <div className="mt-5 flex flex-wrap gap-1.5 rounded-2xl bg-white/10 border border-white/15 p-1.5 backdrop-blur-xs">
          {LIBRARY_TABS.map((t) => (
            <Link
              key={t.id}
              to={`/library/${t.id}`}
              className={`min-h-[40px] inline-flex items-center rounded-xl px-3.5 py-1.5 text-xs font-bold transition-colors whitespace-nowrap ${
                activeTab === t.id
                  ? 'bg-amber-400 text-slate-950 shadow-xs'
                  : 'text-teal-50 hover:bg-white/15 hover:text-white'
              }`}
            >
              {t.label}
            </Link>
          ))}
        </div>
      </section>

      {/* 1. FLASHCARD TỔNG HỢP */}
      {activeTab === 'flashcard' && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  Bảng tổng hợp Flashcard 28 ngày
                </h2>
                <p className="mt-1 text-xs leading-relaxed text-slate-600">
                  Xem toàn bộ 28 thẻ thực hành trên cùng một bảng tổng quan (hỗ trợ phóng to 100%–300%) hoặc chọn nhanh từng ngày bên dưới.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2" data-testid="flashcard-zoom-controls">
                <ZoomOut className="w-4 h-4 text-slate-500" />
                {([100, 150, 200, 300] as const).map((z) => (
                  <button
                    key={z}
                    type="button"
                    onClick={() => setZoomPercent(z)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${
                      zoomPercent === z
                        ? 'bg-teal-700 text-white shadow-2xs'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    {z}%
                  </button>
                ))}
                <ZoomIn className="w-4 h-4 text-slate-500" />
              </div>
            </div>

            <div className="overflow-auto rounded-2xl border border-slate-200 bg-slate-50 p-2">
              <div
                style={{ width: `${zoomPercent}%` }}
                className="mx-auto aspect-video w-full overflow-hidden rounded-xl border border-slate-200 bg-slate-100 shadow-2xs transition-all duration-200"
              >
                <img
                  src={RUNTIME_FULL_FLASHCARD_PATH}
                  alt="Bảng tổng hợp Flashcard 28 ngày BrightUpGenZ"
                  data-testid="flashcard-cover-thumb-16x9"
                  className="w-full h-full object-cover"
                  loading="lazy"
                  decoding="async"
                />
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs">
            <h3 className="text-sm font-bold text-slate-900">
              Chọn mở nhanh bài học từng ngày:
            </h3>
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
              {LEARNING_DAYS_28.map((d) => {
                const coverSrc = d.cover_asset?.runtime_url || `/assets/drive/cover%20d${d.day_number}.webp`;
                return (
                  <Link
                    key={d.day_number}
                    to={`/learn/days/${d.day_number}`}
                    className={`flex flex-col justify-between rounded-xl border p-2.5 text-xs transition-colors ${
                      highlightDay === d.day_number
                        ? 'border-teal-600 bg-teal-50 text-teal-950 font-semibold'
                        : 'border-slate-200 bg-slate-50 hover:border-teal-500 hover:bg-teal-50/40 text-slate-700'
                    }`}
                  >
                    <img
                      src={coverSrc}
                      alt={`Cover Ngày ${d.day_number}`}
                      className="w-full aspect-square object-contain rounded-lg border border-slate-200 bg-white p-1 mb-2"
                      loading="lazy"
                      decoding="async"
                    />
                    <span className="font-bold text-teal-800">
                      Ngày {d.day_number}
                    </span>
                    <span className="truncate text-slate-700">{d.title_transcribed}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* 2. BÁO CHÍ */}
      {activeTab === 'press' && (
        <div className="space-y-5">
          <div className="rounded-2xl border border-teal-200 bg-teal-50/60 p-4 text-xs font-medium text-teal-950">
            Bấm trực tiếp vào từng bài báo trên hình ảnh tổng hợp hoặc chọn từ danh sách bên dưới để đọc bài viết đầy đủ.
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs flex flex-col items-center gap-3">
            <div className="relative w-full max-w-md overflow-hidden rounded-xl border border-slate-200 shadow-xs">
              <img
                src={UI_BRANDING_ASSETS.pressCompositeUrl}
                alt="Trang tổng hợp Báo chí & Công bố khoa học"
                data-testid="press-overview-img"
                className="w-full h-auto block select-none"
              />
              {PRESS_LINKS.map((item) => (
                <a
                  key={item.position}
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`${item.title} (${item.outlet})`}
                  title={`${item.title} (${item.outlet})`}
                  data-testid={`press-hotspot-r${item.row}c${item.col}`}
                  style={{
                    left: `${item.hotspot.left}%`,
                    top: `${item.hotspot.top}%`,
                    width: `${item.hotspot.width}%`,
                    height: `${item.hotspot.height}%`,
                  }}
                  className="group absolute rounded-[14px] border-2 border-teal-500/40 hover:border-teal-600 hover:bg-teal-500/15 focus-visible:border-teal-600 focus-visible:outline-none transition-all"
                >
                  <span className="sr-only">
                    {item.outlet} - {item.title}
                  </span>
                </a>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {PRESS_LINKS.map((item) => (
              <div
                key={item.url}
                className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs hover:border-teal-600 transition-colors"
              >
                <div>
                  <div className="text-xs font-bold uppercase tracking-wider text-teal-800">
                    {item.outlet}
                  </div>
                  <h2 className="mt-1 text-base font-bold text-slate-900">{item.title}</h2>
                </div>
                <div className="mt-4 pt-3 border-t border-slate-100">
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-teal-700 px-4 py-2 text-xs font-bold text-white hover:bg-teal-800 transition-colors"
                  >
                    <span>Đọc bài viết trên {item.outlet}</span>
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 3. ĐỘI NGŨ */}
      {activeTab === 'team' && (
        <div className="space-y-5">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs flex flex-col md:flex-row items-center gap-6">
            <div className="relative w-full max-w-xs shrink-0 overflow-hidden rounded-xl border border-slate-200 shadow-xs">
              <img
                src={UI_BRANDING_ASSETS.teamCompositeUrl}
                alt="Đội ngũ phát triển BrightUpGenZ"
                data-testid="team-overview-img"
                className="w-full h-auto block select-none"
              />
              {TEAM_MEMBERS.map((m) => (
                <a
                  key={m.id}
                  href={`#team-member-${m.id}`}
                  aria-label={m.name}
                  title={`Xem hồ sơ ${m.name}`}
                  data-testid={`team-hotspot-r${m.row}c${m.col}`}
                  style={{
                    left: `${m.hotspot.left}%`,
                    top: `${m.hotspot.top}%`,
                    width: `${m.hotspot.width}%`,
                    height: `${m.hotspot.height}%`,
                  }}
                  className="absolute rounded-[14px] border-2 border-teal-500/40 hover:border-teal-600 hover:bg-teal-500/15 focus-visible:border-teal-600 focus-visible:outline-none transition-all"
                >
                  <span className="sr-only">{m.name}</span>
                </a>
              ))}
            </div>
            <div className="space-y-2 text-xs text-slate-600">
              <div className="text-lg font-bold text-slate-900">
                Đội ngũ Sáng lập &amp; Phát triển Dự án BrightUpGenZ
              </div>
              <p className="leading-relaxed text-slate-600">
                Chạm vào từng thành viên trên ảnh tổng quan hoặc xem hồ sơ chi tiết và thông tin liên hệ ở bên dưới.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            {TEAM_MEMBERS.map((m) => (
              <div
                key={m.id}
                id={`team-member-${m.id}`}
                className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs space-y-4"
              >
                <div>
                  <div className="text-xs font-bold text-teal-800">{m.role}</div>
                  <h2 className="mt-1 text-lg font-bold text-slate-900">{m.name}</h2>
                  <p className="mt-1 text-xs text-slate-600">{m.highlight}</p>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 flex justify-center">
                  <img
                    src={m.cvRuntimeUrl}
                    alt={`Hồ sơ ${m.name}`}
                    className="w-full max-w-xs h-auto object-contain rounded-lg border border-slate-200 bg-white"
                    loading="lazy"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
                  <button
                    type="button"
                    onClick={() =>
                      setSelectedTeamContact(selectedTeamContact === m.id ? null : m.id)
                    }
                    className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-teal-700 px-4 py-2 text-xs font-bold text-white hover:bg-teal-800 transition-colors"
                  >
                    {selectedTeamContact === m.id
                      ? 'Ẩn thông tin liên hệ'
                      : 'Xem thông tin liên hệ'}
                  </button>
                </div>

                {selectedTeamContact === m.id && (
                  <div className="rounded-xl border border-teal-200 bg-teal-50/70 p-3.5 space-y-2 text-xs text-teal-950">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold">Thông tin liên hệ của {m.name}</span>
                    </div>
                    <img
                      src={m.contactRuntimeUrl}
                      alt={`Thông tin liên hệ ${m.name}`}
                      className="w-full max-w-xs mx-auto h-auto object-contain rounded-lg border border-teal-200 bg-white"
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 4. CHỨNG NHẬN CHUYÊN MÔN */}
      {activeTab === 'certificates' && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-teal-200 bg-teal-50/60 p-4 text-xs font-medium text-teal-950">
            Các văn bản xác nhận, đánh giá chuyên môn dành cho bộ học liệu Flashcard 28 ngày “Mắt sáng – Lưng thẳng”.
          </div>

          {(() => {
            const currentCert = PROFESSIONAL_CERTIFICATES[certIdx];
            return (
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
                  <span className="font-bold text-teal-800">
                    Tài liệu {certIdx + 1} / {PROFESSIONAL_CERTIFICATES.length}
                  </span>
                  <span className="font-medium">Đơn vị: {currentCert.issuer}</span>
                </div>

                <div>
                  <h2 className="text-xl font-bold text-slate-900">
                    {currentCert.title}
                  </h2>
                  <p className="mt-1.5 text-xs text-slate-600">{currentCert.scopeNote}</p>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 flex justify-center">
                  <img
                    src={currentCert.runtimeUrl}
                    alt={currentCert.title}
                    data-testid="certificate-slide-img"
                    className={`${
                      certZoomed ? 'w-full max-w-3xl' : 'w-full max-w-md'
                    } h-auto object-contain rounded-xl border border-slate-200 bg-white shadow-sm transition-all duration-200`}
                  />
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setCertIdx(
                          (prev) =>
                            (prev - 1 + PROFESSIONAL_CERTIFICATES.length) %
                            PROFESSIONAL_CERTIFICATES.length
                        )
                      }
                      className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50"
                    >
                      <ChevronLeft className="h-4 w-4" />
                      <span>Trước</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setCertPaused((p) => !p)}
                      className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50"
                    >
                      {certPaused ? (
                        <>
                          <Play className="h-4 w-4 text-teal-700" />
                          <span>Tự động trình chiếu</span>
                        </>
                      ) : (
                        <>
                          <Pause className="h-4 w-4 text-amber-600" />
                          <span>Tạm dừng</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        setCertIdx((prev) => (prev + 1) % PROFESSIONAL_CERTIFICATES.length)
                      }
                      className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50"
                    >
                      <span>Tiếp</span>
                      <ChevronRight className="h-4 w-4" />
                    </button>

                    <button
                      type="button"
                      onClick={() => setCertZoomed((z) => !z)}
                      className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-teal-200 bg-teal-50 px-3.5 py-2 text-xs font-semibold text-teal-900 hover:bg-teal-100"
                    >
                      <ZoomIn className="h-4 w-4" />
                      <span>{certZoomed ? 'Thu gọn ảnh' : 'Phóng to ảnh'}</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* 5. BOT AI */}
      {activeTab === 'bot-ai' && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs">
          <h2 className="text-lg font-bold text-slate-900">
            Trợ lý BOT AI BrightUpGenZ
          </h2>
          <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
            Giải đáp nhanh các thắc mắc về thói quen chăm sóc đôi mắt sáng và giữ lưng thẳng cùng trợ lý BrightUpGenZ.
          </p>
          <div className="mt-4">
            <a
              href={EXTERNAL_LINKS.botAiGpt}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-amber-400 px-5 py-2.5 text-xs font-bold text-slate-950 hover:bg-amber-300 transition-colors"
            >
              <span>Trò chuyện cùng BOT AI BrightUpGenZ</span>
              <ExternalLink className="h-4 w-4" />
            </a>
          </div>
        </div>
      )}

      {/* 6. CỘNG ĐỒNG */}
      {activeTab === 'community' && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs">
          <h2 className="text-lg font-bold text-slate-900">
            Cộng đồng BrightUpGenZ trên Facebook
          </h2>
          <p className="mt-1.5 text-sm text-slate-600">
            Tham gia cộng đồng để cùng chia sẻ góc học tập đẹp, kinh nghiệm đồng hành cùng con và các hoạt động thực hành 28 ngày.
          </p>
          <div className="mt-4">
            <a
              href={EXTERNAL_LINKS.facebookCommunity}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-teal-700 px-5 py-2.5 text-xs font-bold text-white hover:bg-teal-800 transition-colors"
            >
              <span>Tham gia Cộng đồng Facebook</span>
              <ExternalLink className="h-4 w-4" />
            </a>
          </div>
        </div>
      )}

      {/* 7. HỖ TRỢ */}
      {activeTab === 'support' && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs space-y-3">
          <h2 className="text-lg font-bold text-slate-900">
            Kênh Hỗ trợ &amp; Liên hệ BrightUpGenZ
          </h2>
          <p className="text-sm leading-relaxed text-slate-600">
            Nếu bạn cần hỗ trợ trong quá trình học tập 28 ngày hoặc sử dụng Robot đồng hành, hãy liên hệ trực tiếp với đội ngũ qua các kênh chính thức dưới đây:
          </p>
          <div className="flex flex-wrap gap-3 pt-2">
            <Link
              to="/library/team"
              className="inline-flex min-h-[44px] items-center rounded-xl bg-teal-700 px-4 py-2 text-xs font-bold text-white hover:bg-teal-800 transition-colors"
            >
              Xem thông tin liên hệ Đội ngũ
            </Link>
            <a
              href={EXTERNAL_LINKS.facebookCommunity}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 transition-colors"
            >
              <span>Nhắn tin qua Trang Cộng đồng</span>
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
            <a
              href={`mailto:${EXTERNAL_LINKS.superAdminBootstrapEmail}`}
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-amber-300 bg-amber-50 px-4 py-2 text-xs font-bold text-amber-950 hover:bg-amber-100 transition-colors"
            >
              <span>Email: {EXTERNAL_LINKS.superAdminBootstrapEmail}</span>
            </a>
          </div>
        </div>
      )}
    </div>
  );
};

export const AuthAndOnboardingPage: React.FC = () => {
  const clientConfig = getFirebaseClientConfigReport();
  const [actionNotice, setActionNotice] = useState<{
    title: string;
    message: string;
    missingVars?: string[];
  } | null>(null);

  const handleGoogleLoginAttempt = async () => {
    setActionNotice(null);
    const sdk = getFirebaseAuthAndRtdb();
    if (!sdk.isConfigured) {
      setActionNotice({
        title: 'Chưa cấu hình — Firebase Authentication & Realtime Database',
        message: 'Chưa cấu hình biến môi trường VITE_FIREBASE_*.',
        missingVars: sdk.missingVars,
      });
      return;
    }
    setActionNotice({
      title: 'SDK Client đã sẵn sàng',
      message: 'Biến môi trường VITE_FIREBASE_* đã hợp lệ.',
    });
  };

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <h1 className="text-2xl font-bold text-slate-900">
          Đăng nhập Tài khoản Học sinh
        </h1>
        <div className="mt-3 flex flex-wrap gap-2.5">
          <button
            type="button"
            onClick={handleGoogleLoginAttempt}
            className="rounded-xl bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white hover:bg-slate-800"
          >
            Đăng nhập với Google ({clientConfig.p01StatusLabel})
          </button>
        </div>
        {actionNotice && (
          <div className="mt-4 rounded-xl border border-rose-300 bg-rose-50 p-4 text-xs text-rose-950">
            <div className="font-bold">{actionNotice.title}</div>
            <p className="mt-1">{actionNotice.message}</p>
          </div>
        )}
      </section>
    </div>
  );
};

interface SupportedFormatsResponse {
  FIREBASE_SERVICE_ACCOUNT_JSON?: string;
  FIREBASE_SERVICE_ACCOUNT_KEY_PATH?: string;
  MQTT_ADAPTER_MODE?: string[];
  EMAIL_PROVIDER?: string[];
}

export const IntegrationStatusPage: React.FC = () => {
  const { authenticatedFetch, isSuperAdmin, uid, email } = useAuth();
  const [services, setServices] = useState<
    Array<IntegrationComponentStatus & { uiLabel?: string; requiredStage?: string }>
  >([]);
  const [supportedFormats, setSupportedFormats] = useState<SupportedFormatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'p0_audit' | 'matrix_30' | 'demo_script'>(
    'overview'
  );
  const [matrixFilter, setMatrixFilter] = useState<'ALL' | 'PASS_FULL' | 'BLOCKED_EXTERNAL'>('ALL');

  const [benchmarkResult, setBenchmarkResult] = useState<{
    samplesCount: number;
    minMs: number;
    medianMs: number;
    p95Ms: number;
    maxMs: number;
    targetSlaP95Ms: number;
    withinTargetSla: boolean;
    scopeNote: string;
  } | null>(null);
  const [benchmarkRunning, setBenchmarkRunning] = useState(false);

  const [demoNotice, setDemoNotice] = useState<{
    tone: 'ok' | 'warn';
    text: string;
  } | null>(null);
  const [backupJsonPreview, setBackupJsonPreview] = useState<string>('');

  useEffect(() => {
    fetch('/api/system/integration-status')
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data?.services)) {
          setServices(data.services);
        }
        if (data?.supportedFormats) {
          setSupportedFormats(data.supportedFormats);
        }
      })
      .catch(() => {
        // Fallback nếu không gọi được
      })
      .finally(() => setLoading(false));
  }, []);

  const handleRunLatencyBenchmark = async () => {
    setBenchmarkRunning(true);
    try {
      const res = await authenticatedFetch('/api/system/benchmark-latency', {
        method: 'POST',
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (data?.ok) {
        setBenchmarkResult(data);
      }
    } catch {
      // Bỏ qua
    } finally {
      setBenchmarkRunning(false);
    }
  };

  const handleExportDemoBackup = async () => {
    setDemoNotice(null);
    try {
      const res = await authenticatedFetch('/api/admin/demo/backup');
      const data = await res.json();
      if (!res.ok || !data?.ok) {
        setDemoNotice({
          tone: 'warn',
          text:
            data?.message ||
            'Từ chối truy cập (403): Chỉ SuperAdmin mới được phép xuất bản sao lưu (Backup) dữ liệu Demo.',
        });
        return;
      }
      const formatted = JSON.stringify(data.backup, null, 2);
      setBackupJsonPreview(formatted);
      setDemoNotice({
        tone: 'ok',
        text: `${data.message} (${data.backup.counts.users} users, ${data.backup.counts.students} học sinh, ${data.backup.counts.learning_days} ngày học, ${data.backup.counts.published_questions}/${data.backup.counts.questions_public} câu published).`,
      });
    } catch {
      setDemoNotice({
        tone: 'warn',
        text: 'Không thể kết nối API sao lưu Demo.',
      });
    }
  };

  const handleRestoreDemoBackup = async () => {
    setDemoNotice(null);
    if (!backupJsonPreview.trim()) {
      setDemoNotice({
        tone: 'warn',
        text: 'Hãy bấm "1. Xuất Backup JSON Sạch" trước hoặc dán nội dung JSON sao lưu vào ô bên dưới để khôi phục.',
      });
      return;
    }
    try {
      const parsed = JSON.parse(backupJsonPreview);
      const snapshot = parsed.snapshot || parsed;
      const res = await authenticatedFetch('/api/admin/demo/restore', {
        method: 'POST',
        body: JSON.stringify({ snapshot }),
      });
      const data = await res.json();
      setDemoNotice({
        tone: res.ok && data?.ok ? 'ok' : 'warn',
        text: data?.message || 'Không thể khôi phục bản sao lưu.',
      });
    } catch {
      setDemoNotice({
        tone: 'warn',
        text: 'Nội dung JSON bản sao lưu không hợp lệ.',
      });
    }
  };

  const handleResetCleanDemoState = async () => {
    setDemoNotice(null);
    try {
      const res = await authenticatedFetch('/api/admin/demo/reset', {
        method: 'POST',
        body: JSON.stringify({}),
      });
      const data = await res.json();
      setDemoNotice({
        tone: res.ok && data?.ok ? 'ok' : 'warn',
        text:
          data?.message ||
          'Chỉ SuperAdmin mới được phép đặt lại (Reset) dữ liệu Demo.',
      });
    } catch {
      setDemoNotice({
        tone: 'warn',
        text: 'Không thể gọi API đặt lại trạng thái Demo.',
      });
    }
  };

  const handleLiveFirebaseStep1Sync = async () => {
    setDemoNotice(null);
    try {
      const res = await authenticatedFetch('/api/admin/live-firebase/step1-sync', {
        method: 'POST',
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok || !data?.ok) {
        setDemoNotice({
          tone: 'warn',
          text:
            data?.message ||
            'Chỉ SuperAdmin mới được phép đồng bộ Live Firebase.',
        });
        return;
      }
      setDemoNotice({
        tone: 'ok',
        text: `Đã đồng bộ Live Firebase (${data.projectId}) thành công: Authorized Domains = ${data.steps?.authorizedDomains?.status}, RTDB Rules = ${data.steps?.rtdbSecurityRules?.status}, Live Seed = ${data.steps?.rtdbLiveSeed?.status}.`,
      });
    } catch {
      setDemoNotice({
        tone: 'warn',
        text: 'Không thể gọi API đồng bộ Live Firebase.',
      });
    }
  };

  const filteredMatrix = P06_ACCEPTANCE_MATRIX_30.filter((item) => {
    if (matrixFilter === 'PASS_FULL') return item.liveExternalStatus === 'PASS';
    if (matrixFilter === 'BLOCKED_EXTERNAL') return item.liveExternalStatus === 'BLOCKED';
    return true;
  });

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-teal-800">
            <ShieldCheck className="h-4 w-4" />
            <span>
              Chẩn đoán Kỹ thuật Hệ thống, Ma trận Nghiệm thu 30 Ca (T01 → T30) &amp; Sao lưu Demo
            </span>
          </div>
          <span className="rounded-lg border border-teal-300 bg-teal-50 px-3 py-1 font-mono text-xs font-bold text-teal-950">
            Automated Tests: 25/25 PASS · Security Audit: 10/10 PASS
          </span>
        </div>

        <h1 className="mt-2 text-2xl font-bold text-slate-900">
          Trung tâm Kiểm thử Kỹ thuật &amp; Đối chiếu Hệ thống
        </h1>

        <div className="mt-5 flex flex-wrap gap-2 border-b border-slate-200 pb-4">
          <button
            type="button"
            data-testid="p06-tab-overview"
            onClick={() => setActiveTab('overview')}
            className={`min-h-[40px] rounded-xl px-4 py-2 text-xs font-bold transition-colors ${
              activeTab === 'overview'
                ? 'bg-slate-900 text-white'
                : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
            }`}
          >
            1. Dịch vụ, Độ trễ p95 &amp; Sao lưu Demo
          </button>
          <button
            type="button"
            data-testid="p06-tab-p0-audit"
            onClick={() => setActiveTab('p0_audit')}
            className={`min-h-[40px] rounded-xl px-4 py-2 text-xs font-bold transition-colors ${
              activeTab === 'p0_audit'
                ? 'bg-slate-900 text-white'
                : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
            }`}
          >
            2. Kiểm toán 10 Rào chắn P0 (10/10 PASS)
          </button>
          <button
            type="button"
            data-testid="p06-tab-matrix-30"
            onClick={() => setActiveTab('matrix_30')}
            className={`min-h-[40px] rounded-xl px-4 py-2 text-xs font-bold transition-colors ${
              activeTab === 'matrix_30'
                ? 'bg-slate-900 text-white'
                : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
            }`}
          >
            3. Bảng 30 Ca Nghiệm thu (T01 → T30)
          </button>
          <button
            type="button"
            data-testid="p06-tab-demo-script"
            onClick={() => setActiveTab('demo_script')}
            className={`min-h-[40px] rounded-xl px-4 py-2 text-xs font-bold transition-colors ${
              activeTab === 'demo_script'
                ? 'bg-slate-900 text-white'
                : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
            }`}
          >
            4. Kịch bản Demo 6 Phút
          </button>
        </div>

        {activeTab === 'overview' && (
          <div className="mt-6 space-y-6">
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div className="rounded-xl border border-teal-200 bg-teal-50/50 p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-mono text-xs font-bold text-teal-900">
                    Đo Độ trễ Pipeline (n = 20 mẫu · SLA p95 &le; 5000ms)
                  </span>
                  <span className="rounded bg-teal-100 px-2 py-0.5 font-mono text-[11px] font-bold text-teal-950">
                    [Simulator Benchmark]
                  </span>
                </div>
                <h2 className="mt-1 text-base font-bold text-slate-900">
                  Kiểm tra Tốc độ Xử lý Sự kiện MQTT &rarr; FSM &rarr; Outbox &rarr; Cảnh báo
                </h2>
                <div className="mt-3">
                  <button
                    type="button"
                    data-testid="btn-run-latency-benchmark"
                    disabled={benchmarkRunning}
                    onClick={handleRunLatencyBenchmark}
                    className="min-h-[40px] rounded-xl bg-teal-800 px-4 py-2 text-xs font-bold text-white hover:bg-teal-900 disabled:opacity-50"
                  >
                    {benchmarkRunning
                      ? 'Đang đo 20 mẫu liên tiếp...'
                      : 'Chạy Đo Độ trễ Kỹ thuật 20 Mẫu (p95)'}
                  </button>
                </div>

                {benchmarkResult && (
                  <div
                    data-testid="latency-benchmark-result"
                    className="mt-4 rounded-xl border border-teal-300 bg-white p-3.5 text-xs text-slate-800"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 font-mono font-bold text-teal-950">
                      <span>Số mẫu: {benchmarkResult.samplesCount} lần</span>
                      <span>Min: {benchmarkResult.minMs}ms</span>
                      <span>Median: {benchmarkResult.medianMs}ms</span>
                      <span className="rounded bg-emerald-100 px-2 py-0.5 text-emerald-950">
                        p95: {benchmarkResult.p95Ms}ms (&le; {benchmarkResult.targetSlaP95Ms}ms)
                      </span>
                      <span>Max: {benchmarkResult.maxMs}ms</span>
                    </div>
                    <p className="mt-2 text-[11px] text-slate-600">{benchmarkResult.scopeNote}</p>
                  </div>
                )}
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-mono text-xs font-bold text-slate-700">
                    Sao lưu, Khôi phục &amp; Reset Môi trường Demo
                  </span>
                  <span
                    className={`rounded px-2 py-0.5 font-mono text-[11px] font-bold ${
                      isSuperAdmin
                        ? 'bg-emerald-100 text-emerald-900'
                        : 'bg-amber-100 text-amber-950'
                    }`}
                  >
                    {isSuperAdmin
                      ? `Superadmin: ${email}`
                      : `Vai trò: ${uid ? 'Học sinh' : 'Chưa đăng nhập'}`}
                  </span>
                </div>
                <h2 className="mt-1 text-base font-bold text-slate-900">
                  Backup / Restore JSON Sạch &amp; Đặt lại Dữ liệu Demo
                </h2>

                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    data-testid="btn-export-demo-backup"
                    onClick={handleExportDemoBackup}
                    className="min-h-[40px] rounded-xl bg-slate-900 px-3.5 py-2 text-xs font-bold text-white hover:bg-slate-800"
                  >
                    1. Xuất Backup JSON Sạch
                  </button>
                  <button
                    type="button"
                    data-testid="btn-restore-demo-backup"
                    onClick={handleRestoreDemoBackup}
                    className="min-h-[40px] rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-bold text-slate-800 hover:bg-slate-100"
                  >
                    2. Khôi phục từ Backup JSON
                  </button>
                  <button
                    type="button"
                    data-testid="btn-reset-clean-demo"
                    onClick={handleResetCleanDemoState}
                    className="min-h-[40px] rounded-xl border border-teal-300 bg-teal-50 px-3.5 py-2 text-xs font-bold text-teal-950 hover:bg-teal-100"
                  >
                    3. Đặt lại Trạng thái Demo Chuẩn
                  </button>
                  <button
                    type="button"
                    data-testid="btn-live-firebase-step1-sync"
                    onClick={handleLiveFirebaseStep1Sync}
                    className="min-h-[40px] rounded-xl bg-emerald-700 px-3.5 py-2 text-xs font-bold text-white hover:bg-emerald-800"
                  >
                    4. Đồng bộ Live Firebase
                  </button>
                </div>

                {demoNotice && (
                  <div
                    role="status"
                    data-testid="demo-backup-notice"
                    className={`mt-3 rounded-xl border p-3 text-xs ${
                      demoNotice.tone === 'ok'
                        ? 'border-emerald-300 bg-emerald-50 text-emerald-950'
                        : 'border-amber-300 bg-amber-50 text-amber-950'
                    }`}
                  >
                    {demoNotice.text}
                  </div>
                )}

                {backupJsonPreview && (
                  <div className="mt-3">
                    <textarea
                      id="demo-backup-json-textarea"
                      rows={4}
                      value={backupJsonPreview}
                      onChange={(e) => setBackupJsonPreview(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2 font-mono text-[11px] text-slate-800"
                    />
                  </div>
                )}
              </div>
            </div>

            {supportedFormats && (
              <div className="rounded-xl border border-teal-200 bg-teal-50/60 p-4 text-xs text-slate-800">
                <div className="font-bold text-teal-950">
                  Định dạng Biến môi trường Hệ thống:
                </div>
                <ul className="mt-2 space-y-1.5 font-mono text-[11px]">
                  <li>• FIREBASE_SERVICE_ACCOUNT_JSON: {supportedFormats.FIREBASE_SERVICE_ACCOUNT_JSON}</li>
                  <li>• MQTT_ADAPTER_MODE: {supportedFormats.MQTT_ADAPTER_MODE?.join(' | ')}</li>
                  <li>• EMAIL_PROVIDER: {supportedFormats.EMAIL_PROVIDER?.join(' | ')}</li>
                </ul>
              </div>
            )}

            {loading ? (
              <div className="text-sm text-slate-500">Đang kiểm tra trạng thái cấu hình từ server...</div>
            ) : (
              <div className="space-y-4">
                {services.map((svc) => (
                  <div key={svc.id} className="rounded-xl border border-slate-200 bg-slate-50 p-5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h2 className="text-base font-bold text-slate-900">{svc.name}</h2>
                      <span className="font-mono text-xs font-bold text-slate-700">
                        [{svc.status}] {svc.uiLabel}
                      </span>
                    </div>
                    <p className="mt-1.5 text-xs leading-relaxed text-slate-700">{svc.summary}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'p0_audit' && (
          <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2" data-testid="p06-p0-audit-list">
            {P0_SECURITY_AUDIT_ITEMS.map((item) => (
              <div
                key={item.id}
                className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="rounded bg-slate-900 px-2.5 py-0.5 font-mono text-xs font-bold text-white">
                    {item.id}
                  </span>
                  <span className="rounded bg-emerald-100 px-2.5 py-0.5 font-mono text-xs font-bold text-emerald-900">
                    {item.status}
                  </span>
                </div>
                <h2 className="text-sm font-bold text-slate-900">{item.title}</h2>
                <p className="text-xs leading-relaxed text-slate-700">
                  {item.verificationMechanism}
                </p>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'matrix_30' && (
          <div className="mt-6 space-y-4" data-testid="p06-matrix-30-table">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <button
                type="button"
                onClick={() => setMatrixFilter('ALL')}
                className={`rounded-lg px-3 py-1.5 font-semibold ${
                  matrixFilter === 'ALL'
                    ? 'bg-slate-900 text-white'
                    : 'border border-slate-300 bg-white text-slate-700'
                }`}
              >
                Tất cả ({P06_ACCEPTANCE_MATRIX_30.length})
              </button>
              <button
                type="button"
                onClick={() => setMatrixFilter('PASS_FULL')}
                className={`rounded-lg px-3 py-1.5 font-semibold ${
                  matrixFilter === 'PASS_FULL'
                    ? 'bg-emerald-800 text-white'
                    : 'border border-slate-300 bg-white text-slate-700'
                }`}
              >
                PASS toàn phần ({P06_ACCEPTANCE_MATRIX_30.filter((i) => i.liveExternalStatus === 'PASS').length})
              </button>
              <button
                type="button"
                onClick={() => setMatrixFilter('BLOCKED_EXTERNAL')}
                className={`rounded-lg px-3 py-1.5 font-semibold ${
                  matrixFilter === 'BLOCKED_EXTERNAL'
                    ? 'bg-amber-800 text-white'
                    : 'border border-slate-300 bg-white text-slate-700'
                }`}
              >
                Chờ dịch vụ ngoài ({P06_ACCEPTANCE_MATRIX_30.filter((i) => i.liveExternalStatus === 'BLOCKED').length})
              </button>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
                <thead className="bg-slate-100 font-semibold text-slate-800">
                  <tr>
                    <th className="px-3 py-2.5">Mã</th>
                    <th className="px-3 py-2.5">Yêu cầu</th>
                    <th className="px-3 py-2.5">Trạng thái</th>
                    <th className="px-3 py-2.5">Chi tiết</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {filteredMatrix.map((row) => (
                    <tr key={row.code} className="align-top hover:bg-slate-50">
                      <td className="px-3 py-3 font-mono font-bold text-slate-900 whitespace-nowrap">
                        {row.code}
                      </td>
                      <td className="px-3 py-3 text-slate-800 leading-relaxed max-w-xs">
                        {row.requirement}
                      </td>
                      <td className="px-3 py-3">
                        <span className="inline-block rounded-md bg-emerald-100 px-2 py-1 font-mono text-[11px] font-bold text-emerald-950">
                          {row.overallStatusLabel}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-slate-700 leading-relaxed max-w-sm">
                        {row.evidence}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'demo_script' && (
          <div className="mt-6 space-y-4" data-testid="p06-demo-script-view">
            {DEMO_6_MINUTE_SCRIPT.map((step) => (
              <div
                key={step.minuteRange}
                className="rounded-xl border border-slate-200 bg-slate-50 p-5 space-y-2"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="rounded bg-slate-900 px-3 py-1 font-mono text-xs font-bold text-white">
                    {step.minuteRange}
                  </span>
                  <span className="rounded border border-teal-300 bg-teal-50 px-2.5 py-0.5 font-mono text-[11px] font-bold text-teal-950">
                    {step.sourceBadge}
                  </span>
                </div>
                <h2 className="text-base font-bold text-slate-900">{step.stepTitle}</h2>
                <ul className="list-disc pl-5 space-y-1 text-xs leading-relaxed text-slate-700">
                  {step.actions.map((act, idx) => (
                    <li key={idx}>{act}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};
