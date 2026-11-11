import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  Award,
  CheckCircle2,
  ExternalLink,
  HelpCircle,
  Lightbulb,
  RotateCcw,
  ShieldAlert,
  Sparkles,
  Upload,
  ZoomIn,
} from 'lucide-react';
import {
  EXTERNAL_LINKS,
  LEARNING_DAYS_28,
  SOURCE_VERIFICATION_REPORT,
  WEEK_MAPS_4,
  type LearningDayManifestItem,
  type SourceVerificationEntry,
} from '../data/sourceMapping';
import { useAuth } from '../context/AuthContext';
import type { CertificateRequestRecord, LearningProgressDayRecord } from '../domain/p01RbacStore';

const LOCAL_PROGRESS_KEY_PREFIX = 'bugz_p02_progress_';

function loadCachedProgress(studentId: string): Record<string, LearningProgressDayRecord> {
  try {
    const raw = localStorage.getItem(`${LOCAL_PROGRESS_KEY_PREFIX}${studentId}`);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, LearningProgressDayRecord>;
  } catch {
    return {};
  }
}

function saveCachedProgress(studentId: string, map: Record<string, LearningProgressDayRecord>) {
  try {
    localStorage.setItem(`${LOCAL_PROGRESS_KEY_PREFIX}${studentId}`, JSON.stringify(map));
  } catch {
    // Ignore storage quota errors
  }
}

export function useP02LearningData() {
  const { authenticatedFetch, activeStudentId: authActiveStudentId, setActiveStudentId } = useAuth();
  const [resolvedStudentId, setResolvedStudentId] = useState<string>(authActiveStudentId || '');
  const activeStudentId = authActiveStudentId || resolvedStudentId || '';
  const [days, setDays] = useState<LearningDayManifestItem[]>(LEARNING_DAYS_28);
  const [progressMap, setProgressMap] = useState<Record<string, LearningProgressDayRecord>>(() =>
    activeStudentId ? loadCachedProgress(activeStudentId) : {}
  );
  const [certificateRequests, setCertificateRequests] = useState<CertificateRequestRecord[]>([]);
  const [sourceReport, setSourceReport] = useState<SourceVerificationEntry[]>(SOURCE_VERIFICATION_REPORT);
  const [loading, setLoading] = useState(true);

  const refreshBootstrap = useCallback(async () => {
    try {
      const query = authActiveStudentId
        ? `?studentId=${encodeURIComponent(authActiveStudentId)}`
        : '';
      const res = await authenticatedFetch(`/api/learning/bootstrap${query}`);
      if (!res.ok) return;
      const data = await res.json();
      const targetStuId = data.activeStudentId || authActiveStudentId || '';
      if (data.activeStudentId && data.activeStudentId !== authActiveStudentId) {
        setResolvedStudentId(data.activeStudentId);
        setActiveStudentId(data.activeStudentId);
      }
      if (Array.isArray(data.days) && data.days.length === 28) {
        setDays(data.days);
      }
      if (data.progressMap && typeof data.progressMap === 'object') {
        setProgressMap(data.progressMap);
        if (targetStuId) {
          saveCachedProgress(targetStuId, data.progressMap);
        }
      }
      if (Array.isArray(data.certificateRequests)) {
        setCertificateRequests(data.certificateRequests);
      }
      if (Array.isArray(data.sourceVerificationReport)) {
        setSourceReport(data.sourceVerificationReport);
      }
    } catch {
      // Fallback to cached/manifest data if offline
    } finally {
      setLoading(false);
    }
  }, [authActiveStudentId, authenticatedFetch, setActiveStudentId]);

  useEffect(() => {
    setProgressMap(activeStudentId ? loadCachedProgress(activeStudentId) : {});
    refreshBootstrap();
  }, [activeStudentId, refreshBootstrap]);

  const markDayViewed = useCallback(
    async (dayNumber: number) => {
      if (!activeStudentId) return;
      try {
        const res = await authenticatedFetch(`/api/learning/days/${dayNumber}/view`, {
          method: 'POST',
          body: JSON.stringify({ student_id: activeStudentId }),
        });
        const data = await res.json();
        if (res.ok && data.studentProgressMap) {
          setProgressMap(data.studentProgressMap);
          saveCachedProgress(activeStudentId, data.studentProgressMap);
        }
      } catch {
        // Ignore transient network errors
      }
    },
    [activeStudentId, authenticatedFetch]
  );

  const markDayCompleted = useCallback(
    async (dayNumber: number) => {
      try {
        const res = await authenticatedFetch(`/api/learning/days/${dayNumber}/complete`, {
          method: 'POST',
          body: JSON.stringify({ student_id: activeStudentId }),
        });
        const data = await res.json();
        if (res.ok && data.studentProgressMap) {
          setProgressMap(data.studentProgressMap);
          saveCachedProgress(activeStudentId, data.studentProgressMap);
        }
        return data as {
          ok: boolean;
          alreadyCompleted?: boolean;
          completedCount?: number;
          message?: string;
          progress?: LearningProgressDayRecord;
        };
      } catch {
        return { ok: false, message: 'Không thể kết nối máy chủ.' };
      }
    },
    [activeStudentId, authenticatedFetch]
  );

  const completedDaysNumbers = useMemo(() => {
    return Object.entries(progressMap)
      .filter(([, rec]) => Boolean(rec?.self_completed_at))
      .map(([d]) => Number(d))
      .sort((a, b) => a - b);
  }, [progressMap]);

  const viewedDaysNumbers = useMemo(() => {
    return Object.entries(progressMap)
      .filter(([, rec]) => Boolean(rec?.viewed_at))
      .map(([d]) => Number(d))
      .sort((a, b) => a - b);
  }, [progressMap]);

  return {
    activeStudentId,
    days,
    progressMap,
    completedDaysNumbers,
    viewedDaysNumbers,
    certificateRequests,
    sourceReport,
    loading,
    refreshBootstrap,
    markDayViewed,
    markDayCompleted,
  };
}

const DayPrimaryImageCard: React.FC<{
  dayItem: LearningDayManifestItem;
}> = ({ dayItem }) => {
  const [zoomed, setZoomed] = useState(false);
  const imgSrc = dayItem.primary_asset.runtime_url || `/assets/drive/day${dayItem.day_number}.png`;

  return (
    <div className="bg-slate-50 border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
      <div className="px-4 py-3 bg-teal-50/60 border-b border-teal-100 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs font-semibold text-teal-900">
          <span>
            Thẻ bài học Ngày {dayItem.day_number}
            <span className="sr-only" data-testid="day-primary-asset-filename">
              {dayItem.primary_asset.name}
            </span>
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setZoomed((v) => !v)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-300 text-xs font-semibold text-teal-800 transition-colors"
          >
            <ZoomIn className="w-3.5 h-3.5" />
            {zoomed ? 'Thu gọn kích thước chuẩn' : 'Phóng to thẻ bài học'}
          </button>
          <a
            href={imgSrc}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-teal-700 hover:bg-teal-800 text-xs font-semibold text-white transition-colors"
          >
            <span>Xem toàn màn hình</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>

      <div className="p-4 sm:p-6 bg-white flex justify-center">
        <img
          src={imgSrc}
          alt={`Thẻ bài học chính Ngày ${dayItem.day_number}: ${dayItem.title_transcribed}`}
          data-testid="day-standalone-primary-img"
          className={`${
            zoomed ? 'w-full max-w-xl' : 'w-full max-w-sm'
          } h-auto object-contain rounded-xl border border-slate-200 shadow-sm transition-all duration-200`}
        />
      </div>
    </div>
  );
};

// 1. Màn hình Tổng quan 4 Tuần (/learn)
export const LearnHomePage: React.FC = () => {
  const { activeStudent } = useAuth();
  const {
    days,
    completedDaysNumbers,
    viewedDaysNumbers,
  } = useP02LearningData();

  const weeks = WEEK_MAPS_4.map((wm) => ({
    ...wm,
    days: days.filter((d) => d.week_number === wm.week_number),
  }));

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-teal-200 bg-gradient-to-br from-teal-900 via-teal-800 to-slate-900 p-6 sm:p-8 text-white shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-5">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-500/20 border border-teal-400/30 text-teal-100 text-xs font-semibold mb-2.5">
            <span>Hành trình 4 Tuần · 28 Ngày Thực hành</span>
            {activeStudent && (
              <>
                <span>•</span>
                <span>Hồ sơ: {activeStudent.display_name}</span>
              </>
            )}
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
            Lộ trình Học &amp; Thực hành 28 Ngày
          </h2>
          <p className="text-sm text-teal-50/90 mt-1.5 max-w-2xl leading-relaxed">
            Khám phá 4 tuần rèn luyện thói quen <strong>Mắt sáng – Lưng thẳng</strong> qua từng thẻ bài học trực quan, tìm hiểu giải thích khoa học từ biểu tượng Bóng đèn và sưu tầm đủ bộ Huy chương mỗi ngày.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <div className="rounded-2xl border border-white/15 bg-white/10 px-5 py-3.5 flex items-center gap-3.5 backdrop-blur-xs">
            <Award className="w-8 h-8 text-amber-300 shrink-0" />
            <div>
              <div className="text-xs text-teal-100/80 font-medium">Tiến độ hoàn thành</div>
              <div className="text-xl font-extrabold text-white" data-testid="completed-days-counter">
                {completedDaysNumbers.length} / 28 ngày
              </div>
              <div className="text-[11px] text-teal-100/75">Đã mở xem: {viewedDaysNumbers.length}/28 ngày</div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {weeks.map((w) => {
          const doneInWeek = w.days.filter((d) => completedDaysNumbers.includes(d.day_number)).length;
          return (
            <div
              key={w.week_number}
              className="bg-white border border-slate-200 rounded-2xl p-6 shadow-2xs flex flex-col justify-between gap-4 hover:border-teal-600 transition-colors"
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="px-2.5 py-1 rounded-md bg-teal-50 border border-teal-200 text-teal-900 text-xs font-bold">
                    TUẦN {w.week_number}
                  </span>
                  <span className="text-xs text-slate-600">
                    Hoàn thành: <strong className="text-teal-900">{doneInWeek}/7 ngày</strong>
                  </span>
                </div>
                <h3 className="text-lg font-bold text-slate-900">{w.title}</h3>

                <Link
                  to={`/learn/weeks/${w.week_number}`}
                  className="mt-3 block aspect-video w-full rounded-xl overflow-hidden border border-slate-200 bg-slate-100 hover:border-teal-500 transition-colors shadow-2xs"
                >
                  <img
                    src={w.cover_runtime_url || `/assets/drive/Tuan%20${w.week_number}.webp`}
                    alt={`Thumbnail Tuần ${w.week_number}: ${w.title}`}
                    data-testid={`week-cover-thumb-${w.week_number}`}
                    className="w-full h-full object-cover"
                    loading="lazy"
                    decoding="async"
                  />
                </Link>

                <div className="grid grid-cols-7 gap-1.5 mt-4">
                  {w.days.map((d) => {
                    const isDone = completedDaysNumbers.includes(d.day_number);
                    const isViewed = viewedDaysNumbers.includes(d.day_number);
                    const coverSrc = d.cover_asset?.runtime_url || `/assets/drive/cover%20d${d.day_number}.webp`;
                    return (
                      <Link
                        key={d.day_number}
                        to={`/learn/days/${d.day_number}`}
                        className={`flex flex-col items-center justify-between p-1.5 rounded-xl border text-xs font-bold transition-all ${
                          isDone
                            ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                            : isViewed
                            ? 'bg-teal-50 border-teal-300 text-teal-900'
                            : 'bg-slate-50 border-slate-200 text-slate-700 hover:border-teal-500 hover:bg-teal-50/40 hover:text-teal-900'
                        }`}
                        title={`Ngày ${d.day_number}: ${d.title_transcribed}`}
                      >
                        <div className="w-full aspect-[2/3] overflow-hidden rounded-lg border border-slate-200/80 bg-white mb-1">
                          <img
                            src={coverSrc}
                            alt={`Cover Ngày ${d.day_number}`}
                            className="w-full h-full object-cover"
                            loading="lazy"
                            decoding="async"
                          />
                        </div>
                        <span className="text-[10px] font-medium text-slate-500 leading-tight">Ngày</span>
                        <span className="leading-tight">{d.day_number}</span>
                      </Link>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                <Link
                  to={`/learn/weeks/${w.week_number}`}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-teal-800 hover:text-teal-950"
                >
                  <span>Khám phá Tuần {w.week_number}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
                <Link
                  to={`/learn/days/${w.days[0].day_number}`}
                  className="px-3.5 py-2 rounded-xl bg-teal-700 hover:bg-teal-800 text-xs font-semibold text-white transition-colors"
                >
                  Bắt đầu Ngày {w.days[0].day_number}
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// 2. Màn hình Chi tiết Tuần (/learn/weeks/:week)
export const WeekDetailPage: React.FC = () => {
  const { week } = useParams<{ week: string }>();
  const weekNum = Math.min(4, Math.max(1, Number(week) || 1)) as 1 | 2 | 3 | 4;
  const { days, completedDaysNumbers, viewedDaysNumbers } = useP02LearningData();
  const daysInWeek = days.filter((d) => d.week_number === weekNum);
  const weekMeta = WEEK_MAPS_4.find((wm) => wm.week_number === weekNum) || WEEK_MAPS_4[0];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          to="/learn"
          className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700 hover:text-teal-900"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Quay lại Tổng quan 4 Tuần</span>
        </Link>
        <div className="flex items-center gap-2">
          {[1, 2, 3, 4].map((w) => (
            <Link
              key={w}
              to={`/learn/weeks/${w}`}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold border transition-colors ${
                w === weekNum
                  ? 'bg-gradient-to-r from-teal-900 to-teal-800 border-teal-800 text-white shadow-2xs'
                  : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              Tuần {w}
            </Link>
          ))}
        </div>
      </div>

      <div className="rounded-3xl border border-teal-200 bg-gradient-to-br from-teal-900 via-teal-800 to-slate-900 p-6 sm:p-8 text-white shadow-sm">
        <div className="inline-flex items-center gap-2 rounded-full border border-teal-400/30 bg-teal-500/20 px-3 py-1 text-xs font-semibold text-teal-100">
          <span>Bản đồ Thực hành Tuần {weekNum}</span>
        </div>
        <h2 className="mt-2 text-2xl font-extrabold text-white">
          {weekMeta.title}
        </h2>
        <p className="text-xs sm:text-sm text-teal-50/90 mt-1">
          Chọn ngày bất kỳ để mở thẻ bài học, bấm nút Bóng đèn để đọc giải thích khoa học hoặc nhận Huy chương hoàn thành.
        </p>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-2xs space-y-6">
        <div className="aspect-video w-full max-w-3xl mx-auto rounded-2xl overflow-hidden border border-slate-200 bg-slate-100 shadow-2xs">
          <img
            src={weekMeta.cover_runtime_url || `/assets/drive/Tuan%20${weekNum}.webp`}
            alt={`Thumbnail Cover Tuần ${weekNum}`}
            data-testid="week-map-img"
            className="w-full h-full object-cover"
            loading="lazy"
            decoding="async"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {daysInWeek.map((d) => {
            const isDone = completedDaysNumbers.includes(d.day_number);
            const isViewed = viewedDaysNumbers.includes(d.day_number);
            const thumbSrc = d.cover_asset?.runtime_url || `/assets/drive/cover%20d${d.day_number}.webp`;
            return (
              <div
                key={d.day_number}
                className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs flex flex-col justify-between gap-3 hover:border-teal-600 transition-colors"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="px-2.5 py-0.5 rounded-md bg-teal-50 border border-teal-200 text-teal-900 text-xs font-bold">
                      Ngày {d.day_number} / 28
                    </span>
                    {isDone ? (
                      <span className="inline-flex items-center gap-1 text-xs text-emerald-700 font-semibold">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Đã nhận Huy chương
                      </span>
                    ) : isViewed ? (
                      <span className="text-xs text-teal-700 font-medium">Đã mở xem</span>
                    ) : (
                      <span className="text-xs text-slate-500">Chưa hoàn thành</span>
                    )}
                  </div>

                  <Link
                    to={`/learn/days/${d.day_number}`}
                    className="mx-auto mb-3 block w-full max-w-[240px] aspect-[2/3] overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 shadow-2xs hover:border-teal-500 transition-colors"
                  >
                    <img
                      src={thumbSrc}
                      alt={`Cover Ngày ${d.day_number}: ${d.title_transcribed}`}
                      data-testid={`day-cover-thumb-${d.day_number}`}
                      className="h-full w-full object-cover"
                      loading="lazy"
                      decoding="async"
                    />
                  </Link>

                  <h3 className="text-base font-bold text-slate-900">{d.title_transcribed}</h3>
                  <p className="text-xs text-teal-800 italic mt-1">“{d.slogan_transcribed}”</p>
                </div>

                <div className="flex items-center gap-2 pt-3 border-t border-slate-100">
                  <Link
                    to={`/learn/days/${d.day_number}`}
                    className="flex-1 text-center py-2.5 rounded-xl bg-teal-700 hover:bg-teal-800 text-white font-semibold text-xs transition-colors"
                  >
                    Mở Ngày {d.day_number}
                  </Link>
                  <Link
                    to={`/learn/days/${d.day_number}/info`}
                    className="px-3 py-2.5 rounded-xl bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-900 text-xs font-semibold"
                    title={`Xem giải thích Ngày ${d.day_number}`}
                  >
                    <Lightbulb className="w-4 h-4 text-amber-600" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// 3. Màn hình Bài học Ngày (/learn/days/:day)
export const DayDetailPage: React.FC = () => {
  const { day } = useParams<{ day: string }>();
  const navigate = useNavigate();
  const dayNum = Math.min(28, Math.max(1, Number(day) || 1));
  const {
    days,
    progressMap,
    markDayViewed,
    markDayCompleted,
  } = useP02LearningData();

  const dayItem = days.find((d) => d.day_number === dayNum) || LEARNING_DAYS_28[dayNum - 1];
  const dayProgress = progressMap[String(dayNum)];
  const [checkedSteps, setCheckedSteps] = useState<Record<number, boolean>>({});
  const [completingDay28, setCompletingDay28] = useState(false);

  useEffect(() => {
    setCheckedSteps({});
    markDayViewed(dayNum);
  }, [dayNum, markDayViewed]);

  const toggleStep = (idx: number) => {
    setCheckedSteps((prev) => ({ ...prev, [idx]: !prev[idx] }));
  };

  const handleCompleteDay28AndOpenCertificate = async () => {
    setCompletingDay28(true);
    try {
      await markDayCompleted(28);
    } finally {
      setCompletingDay28(false);
      navigate('/certificate-request');
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link
          to={`/learn/weeks/${dayItem.week_number}`}
          className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700 hover:text-teal-900"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Quay lại Tuần {dayItem.week_number}</span>
        </Link>

        <div className="flex flex-wrap items-center gap-2">
          {dayNum > 1 && (
            <Link
              to={`/learn/days/${dayNum - 1}`}
              className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Ngày {dayNum - 1}</span>
            </Link>
          )}
          <span className="px-2.5 py-1 text-xs font-semibold text-teal-800">
            Tuần {dayItem.week_number} · Ngày {dayItem.day_number}/28
          </span>
          {dayNum < 28 && (
            <Link
              to={`/learn/days/${dayNum + 1}`}
              className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              <span>Ngày {dayNum + 1}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          )}
        </div>
      </div>

      {/* Khung Flashcard chính */}
      <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-xs flex flex-col justify-between">
        <div className="bg-gradient-to-br from-teal-900 via-teal-800 to-slate-900 p-6 sm:p-7 text-white">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <span className="px-3 py-1 rounded-full bg-teal-500/20 border border-teal-400/30 text-teal-100 text-xs font-bold">
              NGÀY {dayItem.day_number} / 28
            </span>
            <div className="flex flex-wrap items-center gap-2">
              {dayProgress?.self_completed_at ? (
                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-emerald-400/20 border border-emerald-300/40 text-emerald-100 text-xs font-bold">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Đã nhận Huy chương
                </span>
              ) : dayProgress?.viewed_at ? (
                <span className="px-3 py-1 rounded-full bg-white/15 border border-white/20 text-teal-50 text-xs font-medium">
                  Đang thực hành
                </span>
              ) : null}
            </div>
          </div>

          <h2 className="text-2xl sm:text-3xl font-extrabold text-white">{dayItem.title_transcribed}</h2>
          <p className="text-sm sm:text-base text-amber-300 font-semibold mt-1">
            “{dayItem.slogan_transcribed}”
          </p>
        </div>

        <div className="p-5 sm:p-7 space-y-6">
          <DayPrimaryImageCard dayItem={dayItem} />

          {/* Nội dung hướng dẫn thực hành tương ứng của Ngày */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-teal-50/50 border border-teal-200 rounded-2xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-teal-900 uppercase tracking-wider">
                  👉 Cách thực hiện hôm nay
                </h3>
                <span className="text-[11px] text-slate-600">Chạm để đánh dấu hoàn thành</span>
              </div>
              <ul className="space-y-2">
                {dayItem.practice_steps.map((step, idx) => {
                  const checked = Boolean(checkedSteps[idx]);
                  return (
                    <li key={idx}>
                      <button
                        type="button"
                        onClick={() => toggleStep(idx)}
                        className={`w-full text-left p-3 rounded-xl border text-xs sm:text-sm transition-colors flex items-start gap-2.5 ${
                          checked
                            ? 'bg-emerald-50 border-emerald-300 text-emerald-950 font-medium'
                            : 'bg-white border-slate-200 text-slate-800 hover:border-teal-400'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => {}}
                          className="mt-0.5 rounded border-slate-300 text-teal-700 focus:ring-teal-500"
                          aria-label={step}
                        />
                        <span>{step}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>

            <div className="bg-amber-50/50 border border-amber-200 rounded-2xl p-5 flex flex-col justify-between gap-4">
              <div className="space-y-3">
                <h3 className="text-sm font-bold text-amber-950 uppercase tracking-wider">
                  {dayItem.self_eval_heading}
                </h3>
                <ul className="space-y-2 text-xs sm:text-sm text-slate-800">
                  {dayItem.self_eval_items.map((item, idx) => (
                    <li
                      key={idx}
                      className="p-3 rounded-xl bg-white border border-amber-200/80 flex items-start gap-2"
                    >
                      <span className="text-teal-700 font-bold">•</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>

                {dayItem.qr_note && (
                  <div className="p-3 rounded-xl bg-teal-50 border border-teal-200 text-xs text-teal-950">
                    📌 Hoạt động bổ trợ: <strong>{dayItem.qr_note}</strong>
                  </div>
                )}

                {dayItem.clinical_review_flag && dayItem.clinical_review_note && (
                  <div className="p-3 rounded-xl bg-amber-100/70 border border-amber-300 text-xs text-amber-950 flex items-start gap-2">
                    <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5 text-amber-700" />
                    <span>
                      <strong>Lưu ý sức khỏe:</strong> {dayItem.clinical_review_note}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Vùng thao tác phía dưới: Nút Huy chương bên trái, Nút Bóng đèn bên phải */}
        <div
          className="bg-slate-50 border-t border-slate-200 px-5 py-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3"
          data-testid="day-bottom-action-bar"
        >
          {dayItem.day_number < 28 ? (
            <button
              type="button"
              data-testid="btn-day-medal-bottom-left"
              onClick={() => navigate(`/learn/days/${dayItem.day_number}/medal`)}
              className="inline-flex items-center justify-center gap-2.5 px-5 py-3 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-sm transition-colors shadow-xs"
            >
              <Award className="w-5 h-5 shrink-0" />
              <span>Hoàn thành &amp; Nhận Huy chương Ngày {dayItem.day_number}</span>
            </button>
          ) : (
            <button
              type="button"
              disabled={completingDay28}
              data-testid="btn-day28-certificate-bottom-left"
              onClick={handleCompleteDay28AndOpenCertificate}
              className="inline-flex items-center justify-center gap-2.5 px-5 py-3 rounded-xl bg-amber-400 hover:bg-amber-300 disabled:opacity-60 text-slate-950 font-bold text-sm transition-colors shadow-xs"
            >
              <Sparkles className="w-5 h-5 shrink-0" />
              <span>
                {completingDay28
                  ? 'Đang ghi nhận hoàn thành Ngày 28...'
                  : 'Hoàn thành Ngày 28 · Nhận Chứng nhận 28 Ngày'}
              </span>
            </button>
          )}

          <button
            type="button"
            data-testid="btn-day-lightbulb-bottom-right"
            onClick={() => navigate(`/learn/days/${dayItem.day_number}/info`)}
            className="inline-flex items-center justify-center gap-2.5 px-5 py-3 rounded-xl bg-teal-700 hover:bg-teal-800 text-white font-bold text-sm transition-colors"
          >
            <Lightbulb className="w-5 h-5 text-amber-300 shrink-0" />
            <span>Bóng đèn Giải thích Khoa học</span>
          </button>
        </div>
      </div>
    </div>
  );
};

// 4. Màn hình Giải thích Bóng đèn (/learn/days/:day/info)
export const DayInfoPage: React.FC = () => {
  const { day } = useParams<{ day: string }>();
  const dayNum = Math.min(28, Math.max(1, Number(day) || 1));
  const { days } = useP02LearningData();
  const dayItem = days.find((d) => d.day_number === dayNum) || LEARNING_DAYS_28[dayNum - 1];
  const infoImgSrc = dayItem.info_asset.runtime_url || (dayNum <= 26 ? `/assets/drive/in4%20d${dayNum}.png` : undefined);

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-xs">
        <div className="bg-gradient-to-br from-teal-900 via-teal-800 to-slate-900 p-6 text-white space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-400/20 border border-amber-300/40 text-amber-200 text-xs font-bold">
              <Lightbulb className="w-4 h-4 text-amber-300" />
              <span>Giải thích Khoa học &amp; Thực hành · Ngày {dayItem.day_number}</span>
            </div>
            <span className="sr-only" data-testid="info-asset-filename">
              {dayItem.info_asset.name}
            </span>
          </div>

          <h2 className="text-xl sm:text-2xl font-extrabold text-white" data-testid="info-page-heading">
            Giải thích cho bài: “{dayItem.title_transcribed}” (Ngày {dayItem.day_number})
          </h2>
        </div>

        <div className="p-6 space-y-5">
          {dayItem.info_asset.status === 'not_yet_verified' || !infoImgSrc ? (
            <div className="bg-amber-50/60 border border-amber-200 rounded-2xl p-5 space-y-3 text-sm text-slate-800">
              <div className="font-bold flex items-center gap-2 text-amber-950">
                <HelpCircle className="w-4 h-4 text-amber-700" />
                <span>Tổng kết thực hành tự giác Ngày {dayItem.day_number}</span>
              </div>
              <p className="text-xs text-slate-700 leading-relaxed">
                Ở Ngày {dayItem.day_number} ({dayItem.title_transcribed}), các em hãy tự giác áp dụng toàn bộ thói quen đã rèn luyện suốt hành trình mà không cần nhìn nhắc nhở từ thẻ phụ trợ.
              </p>
              <div className="p-4 rounded-xl bg-white border border-amber-200 space-y-2">
                <div className="text-xs font-bold text-teal-900 uppercase tracking-wider">
                  Tiêu chí tự đánh giá hôm nay ({dayItem.self_eval_heading}):
                </div>
                <ul className="space-y-1.5 text-xs sm:text-sm text-slate-800">
                  {dayItem.self_eval_items.map((item, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="text-teal-700 font-bold">✓</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ) : (
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
                <span className="font-semibold text-teal-900">Giải thích trực quan Ngày {dayItem.day_number}</span>
                <a
                  href={infoImgSrc}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 font-semibold text-teal-800 hover:underline"
                >
                  <span>Phóng to ảnh giải thích</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>

              <div className="p-4 bg-white rounded-xl border border-slate-200 flex justify-center">
                <img
                  src={infoImgSrc}
                  alt={`Giải thích bóng đèn Ngày ${dayItem.day_number}: ${dayItem.title_transcribed}`}
                  data-testid="info-standalone-img"
                  className="w-full max-w-md h-auto object-contain rounded-lg border border-slate-200 shadow-sm"
                />
              </div>

              <div className="p-4 rounded-xl bg-teal-50/60 border border-teal-200 space-y-2">
                <div className="text-xs font-bold text-teal-900 uppercase tracking-wider">
                  Tóm tắt tiêu chí thực hành ({dayItem.self_eval_heading}):
                </div>
                <ul className="space-y-1.5 text-xs sm:text-sm text-slate-800">
                  {dayItem.self_eval_items.map((item, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="text-teal-700 font-bold">✓</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
            <Link
              to={`/learn/days/${dayItem.day_number}`}
              data-testid="btn-back-to-day"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-teal-700 hover:bg-teal-800 text-white font-bold text-sm transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Quay lại Ngày {dayItem.day_number}</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

// 5. Màn hình Nhận Huy chương (/learn/days/:day/medal)
export const DayMedalPage: React.FC = () => {
  const { day } = useParams<{ day: string }>();
  const navigate = useNavigate();
  const dayNum = Math.min(28, Math.max(1, Number(day) || 1));
  const {
    days,
    completedDaysNumbers,
    markDayCompleted,
  } = useP02LearningData();

  const dayItem = days.find((d) => d.day_number === dayNum) || LEARNING_DAYS_28[dayNum - 1];
  const [statusMsg, setStatusMsg] = useState<string>('');

  useEffect(() => {
    let mounted = true;
    if (dayNum === 28) {
      markDayCompleted(28).finally(() => {
        if (mounted) {
          navigate('/certificate-request', { replace: true });
        }
      });
      return () => {
        mounted = false;
      };
    }
    markDayCompleted(dayNum).then((res) => {
      if (!mounted) return;
      if (res.ok) {
        setStatusMsg(res.message || '');
      }
    });
    return () => {
      mounted = false;
    };
  }, [dayNum, markDayCompleted, navigate]);

  if (dayNum === 28) {
    return null;
  }

  const nextDay = dayItem.next_day || dayNum + 1;
  const isEndOfWeek = dayNum === 7 || dayNum === 14 || dayNum === 21;
  const nextWeekNum = Math.floor(dayNum / 7) + 1;
  const medalImgSrc = dayItem.medal_asset.runtime_url || `/assets/drive/HC%20d${dayNum}.png`;

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-xs text-center">
        <div className="bg-gradient-to-br from-teal-900 via-teal-800 to-slate-900 p-6 sm:p-8 text-white space-y-2">
          <span className="inline-block px-3 py-1 rounded-full bg-amber-400/20 border border-amber-300/40 text-amber-200 text-xs font-bold">
            CHÚC MỪNG HOÀN THÀNH NGÀY {dayNum} / 28
          </span>
          <h2 className="text-2xl font-extrabold text-white">
            Huy chương Ngày {dayNum}: {dayItem.title_transcribed}
          </h2>
        </div>

        <div className="p-6 sm:p-8 space-y-5">
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 flex justify-center">
            <img
              src={medalImgSrc}
              alt={`Huy chương Ngày ${dayNum}: ${dayItem.title_transcribed}`}
              data-testid="medal-standalone-img"
              className="w-full max-w-sm h-auto object-contain rounded-xl border border-slate-200 bg-white shadow-sm"
            />
          </div>

          <div className="bg-teal-50/60 border border-teal-200 rounded-2xl p-4 text-xs text-slate-700 leading-relaxed text-center space-y-1.5">
            <div>
              Tổng số ngày bạn đã hoàn thành:{' '}
              <strong className="text-teal-900" data-testid="medal-total-completed">
                {completedDaysNumbers.length} / 28 ngày
              </strong>
            </div>
            {statusMsg && <div className="text-emerald-800 font-semibold pt-1">{statusMsg}</div>}
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3 pt-2">
            <Link
              to={`/learn/days/${dayNum}`}
              className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 font-semibold text-sm transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Xem lại Ngày {dayNum}</span>
            </Link>

            {isEndOfWeek ? (
              <>
                <Link
                  to={`/learn/days/${nextDay}`}
                  data-testid="btn-next-week-day"
                  className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-sm transition-colors"
                >
                  <span>
                    Sang Tuần {nextWeekNum} · Ngày {nextDay}
                  </span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
                <Link
                  to={`/learn/weeks/${nextWeekNum}`}
                  className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-teal-700 hover:bg-teal-800 text-white font-semibold text-xs transition-colors"
                >
                  <span>Bản đồ Tuần {nextWeekNum}</span>
                </Link>
              </>
            ) : (
              <Link
                to={`/learn/days/${nextDay}`}
                data-testid="btn-next-day"
                className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-sm transition-colors"
              >
                <span>Tiếp tục Ngày {nextDay}</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// 6. Màn hình Yêu cầu Nhận Chứng nhận Hoàn thành 28 Ngày (/certificate-request)
export const CertificateRequestPage: React.FC = () => {
  const { authenticatedFetch, email: authEmail, activeStudent, userRecord } = useAuth();
  const {
    activeStudentId,
    completedDaysNumbers,
    certificateRequests,
    refreshBootstrap,
    markDayCompleted,
  } = useP02LearningData();

  const defaultEmail = authEmail || 'phuhuynh.a@example.com';
  const [reflection, setReflection] = useState('');
  const [photoName, setPhotoName] = useState('');
  const [photoNote, setPhotoNote] = useState('');
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null);
  const [guardianEmail, setGuardianEmail] = useState(defaultEmail);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    if (authEmail && (!guardianEmail || guardianEmail === 'phuhuynh.a@example.com')) {
      setGuardianEmail(authEmail);
    }
  }, [authEmail, guardianEmail]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoName(file.name);
    setPhotoNote(`Kích thước: ${Math.round(file.size / 1024)} KB`);
    try {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          setPhotoPreviewUrl(reader.result);
        }
      };
      reader.readAsDataURL(file);
    } catch {
      // Ignore file preview errors
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setFeedback(null);
    try {
      if (!completedDaysNumbers.includes(28)) {
        await markDayCompleted(28);
      }
      const res = await authenticatedFetch('/api/certificates/requests', {
        method: 'POST',
        body: JSON.stringify({
          student_id: activeStudentId,
          guardian_email: guardianEmail.trim(),
          reflection_text: reflection.trim(),
          achievement_photo_name: photoName.trim(),
          achievement_photo_note: photoNote.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        setFeedback({ ok: true, text: data.message });
        await refreshBootstrap();
      } else {
        setFeedback({ ok: false, text: data.message || 'Không thể gửi yêu cầu chứng nhận.' });
      }
    } catch {
      setFeedback({ ok: false, text: 'Lỗi kết nối máy chủ khi gửi yêu cầu nhận chứng nhận.' });
    } finally {
      setSubmitting(false);
    }
  };

  const latestRequest = certificateRequests[0] || null;
  const studentDisplayName =
    activeStudent?.display_name || userRecord?.full_name || authEmail || 'Học sinh BrightUpGenZ';

  const mailtoHref = useMemo(() => {
    const subject = encodeURIComponent(`Yêu cầu nhận Chứng nhận 28 Ngày BrightUpGenZ - ${studentDisplayName}`);
    const body = encodeURIComponent(
      `Xin chào Ban điều phối Dự án BrightUpGenZ,\n\n` +
        `- Hồ sơ học sinh: ${studentDisplayName}\n` +
        `- Số ngày đã hoàn thành: ${completedDaysNumbers.length}/28 ngày\n` +
        `- Cảm nghĩ sau 28 ngày: ${reflection || latestRequest?.reflection_text || '(Điền cảm nghĩ của em)'}\n` +
        `- Tệp ảnh góc học tập / thành quả đính kèm: ${photoName || latestRequest?.achievement_photo_name || '(Đính kèm ảnh vào email này)'}\n` +
        `- Email nhận phản hồi: ${guardianEmail}\n\n` +
        `Trân trọng!`
    );
    return `mailto:${EXTERNAL_LINKS.superAdminBootstrapEmail}?subject=${subject}&body=${body}`;
  }, [studentDisplayName, completedDaysNumbers.length, guardianEmail, photoName, reflection, latestRequest]);

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link
          to="/learn/days/28"
          className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700 hover:text-teal-900"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Quay lại Ngày 28</span>
        </Link>
        <div className="flex items-center gap-2 text-xs font-bold text-teal-800">
          <Award className="w-4 h-4 text-amber-500" />
          <span>Tiến độ hiện tại: {completedDaysNumbers.length} / 28 ngày</span>
        </div>
      </div>

      {/* Khung Xem Trước Giấy Chứng Nhận Hoàn Thành 28 Ngày Trực Quan */}
      <div
        data-testid="certificate-visual-preview-card"
        className="rounded-3xl border-2 border-amber-300 bg-gradient-to-b from-amber-50/70 via-white to-teal-50/40 p-6 sm:p-8 shadow-xs space-y-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-200/80 pb-4">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-teal-800">
              Dự án Khoa học &amp; Giáo dục Sức khỏe Học đường BUGZ BrightUpGenZ
            </div>
            <h2 className="mt-1 text-xl sm:text-2xl font-extrabold text-slate-900">
              GIẤY CHỨNG NHẬN HOÀN THÀNH 28 NGÀY
            </h2>
            <div className="text-xs font-semibold text-amber-800">
              Hành trình Rèn luyện Thói quen Tốt “Mắt sáng – Lưng thẳng”
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-lg border border-teal-300 bg-teal-50 px-3 py-1 text-xs font-bold text-teal-900">
              {latestRequest?.status === 'completed'
                ? 'Đã xác nhận cấp Chứng nhận'
                : latestRequest
                ? 'Đã gửi yêu cầu · Chờ Ban điều phối duyệt'
                : 'Bản xem trước Chứng nhận'}
            </span>
            <button
              type="button"
              onClick={() => window.print()}
              className="rounded-xl border border-slate-300 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-50"
            >
              In / Lưu PDF
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-12 items-center">
          <div className="sm:col-span-8 space-y-2">
            <div className="text-xs text-slate-600">Chứng nhận học sinh / thành viên:</div>
            <div className="text-2xl font-extrabold text-teal-950">{studentDisplayName}</div>
            <p className="text-xs sm:text-sm text-slate-700 leading-relaxed">
              Đã tích cực tham gia và thực hành lộ trình <strong>28 ngày rèn luyện tư thế ngồi học chuẩn &amp; bảo vệ thị lực học đường</strong> (Hoàn thành:{' '}
              <strong className="text-teal-900">{completedDaysNumbers.length}/28 ngày</strong>).
            </p>
            {(reflection || latestRequest?.reflection_text) && (
              <div className="rounded-xl border border-amber-200 bg-white/90 p-3 text-xs italic text-slate-700">
                “{reflection || latestRequest?.reflection_text}”
              </div>
            )}
          </div>

          <div className="sm:col-span-4 flex flex-col items-center justify-center rounded-2xl border border-amber-200 bg-white p-4 text-center">
            {photoPreviewUrl ? (
              <img
                src={photoPreviewUrl}
                alt="Ảnh góc học tập đính kèm"
                className="h-28 w-full rounded-xl object-cover border border-slate-200 mb-2"
              />
            ) : (
              <Award className="h-12 w-12 text-amber-500 mb-1.5" />
            )}
            <div className="text-xs font-bold text-slate-900">Huy hiệu 28 Ngày</div>
            <div className="text-[11px] text-slate-500">
              {photoName || latestRequest?.achievement_photo_name || 'Mắt sáng · Lưng thẳng'}
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-xs">
        <div className="bg-gradient-to-br from-teal-900 via-teal-800 to-slate-900 p-6 sm:p-8 text-white">
          <span className="inline-block px-3 py-1 rounded-full bg-amber-400/20 border border-amber-300/40 text-amber-200 text-xs font-bold">
            CHỨNG NHẬN HOÀN THÀNH 28 NGÀY “MẮT SÁNG – LƯNG THẲNG”
          </span>
          <h2 className="text-2xl font-extrabold text-white mt-2">
            Đăng ký Nhận Chứng nhận Hoàn thành 28 Ngày
          </h2>
          <p className="text-xs sm:text-sm text-teal-50/90 mt-1 leading-relaxed">
            Hãy chia sẻ cảm nghĩ của em sau hành trình 28 ngày kèm hình ảnh góc học tập hoặc thành quả rèn luyện để Ban điều phối gửi tặng Giấy chứng nhận nhé!
          </p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-800 mb-1.5">
              1. Cảm nghĩ của em sau hành trình 28 ngày (“Sau 28 ngày, mình cảm thấy...”) *
            </label>
            <textarea
              required
              rows={3}
              value={reflection}
              onChange={(e) => setReflection(e.target.value)}
              data-testid="cert-reflection-input"
              placeholder="Ví dụ: Sau 28 ngày, em đã quen giữ khoảng cách mắt 30cm, bàn học gọn gàng và mắt đỡ mỏi hơn nhiều!"
              className="w-full rounded-xl bg-white border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-teal-600"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-800 mb-1.5">
                2. Ảnh chụp thành quả / góc học tập *
              </label>
              <div className="space-y-2">
                <input
                  type="text"
                  required
                  value={photoName}
                  onChange={(e) => setPhotoName(e.target.value)}
                  data-testid="cert-photo-name-input"
                  placeholder="Ví dụ: goc-hoc-tap-ngay28.jpg"
                  className="w-full rounded-xl bg-white border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-teal-600"
                />
                <label className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-teal-50 hover:bg-teal-100 border border-teal-200 text-xs font-semibold text-teal-900 cursor-pointer transition-colors">
                  <Upload className="w-3.5 h-3.5" />
                  <span>Chọn tệp ảnh từ thiết bị</span>
                  <input type="file" accept="image/*" onChange={handleFileSelect} className="hidden" />
                </label>
                {photoNote && <div className="text-[11px] text-slate-600">{photoNote}</div>}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-800 mb-1.5">
                3. Email nhận chứng nhận *
              </label>
              <input
                type="email"
                required
                value={guardianEmail}
                onChange={(e) => setGuardianEmail(e.target.value)}
                data-testid="cert-guardian-email-input"
                placeholder="email@example.com"
                className="w-full rounded-xl bg-white border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-teal-600"
              />
              <p className="text-[11px] text-slate-500 mt-1">
                Ban điều phối sẽ gửi phản hồi và giấy chứng nhận qua địa chỉ email này.
              </p>
            </div>
          </div>

          {feedback && (
            <div
              data-testid="cert-submit-feedback"
              className={`p-3.5 rounded-xl border text-xs font-medium ${
                feedback.ok
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-950'
                  : 'bg-rose-50 border-rose-300 text-rose-950'
              }`}
            >
              {feedback.text}
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <button
              type="submit"
              disabled={submitting}
              data-testid="btn-submit-certificate-request"
              className="px-6 py-3 rounded-xl bg-amber-400 hover:bg-amber-300 disabled:opacity-50 text-slate-950 font-bold text-sm transition-colors shadow-xs"
            >
              {submitting ? 'Đang gửi yêu cầu...' : 'Gửi Yêu cầu Nhận Chứng nhận'}
            </button>

            <a
              href={mailtoHref}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white hover:bg-slate-50 text-slate-800 text-xs font-semibold border border-slate-300 transition-colors"
            >
              <span>Gửi kèm qua Email ({EXTERNAL_LINKS.superAdminBootstrapEmail})</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </form>
      </div>

      {/* Danh sách yêu cầu chứng nhận đã gửi */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs space-y-3">
        <h3 className="text-sm font-bold text-slate-900">
          Trạng thái Yêu cầu Nhận Chứng nhận của bạn
        </h3>
        {certificateRequests.length === 0 ? (
          <p className="text-xs text-slate-500">Chưa có yêu cầu nhận chứng nhận nào được gửi.</p>
        ) : (
          <div className="space-y-2.5">
            {certificateRequests.map((req) => (
              <div
                key={req.request_id}
                className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
              >
                <div className="space-y-1">
                  <div className="font-semibold text-slate-900">
                    Ảnh đính kèm: <span className="text-teal-800">{req.achievement_photo_name}</span>
                  </div>
                  <div className="text-slate-700">“{req.reflection_text}”</div>
                  <div className="text-[11px] text-slate-500">
                    Email nhận: {req.guardian_email} · Gửi lúc: {new Date(req.created_at).toLocaleString('vi-VN')}
                  </div>
                  {req.admin_note && (
                    <div className="text-[11px] text-teal-800 font-medium">Phản hồi từ Ban điều phối: {req.admin_note}</div>
                  )}
                </div>
                <div>
                  <span
                    className={`px-2.5 py-1 rounded-md font-bold uppercase text-[11px] ${
                      req.status === 'completed'
                        ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                        : req.status === 'processing'
                        ? 'bg-amber-100 text-amber-900 border border-amber-300'
                        : 'bg-sky-100 text-sky-900 border border-sky-300'
                    }`}
                  >
                    {req.status === 'completed'
                      ? 'Đã cấp chứng nhận'
                      : req.status === 'processing'
                      ? 'Đang xử lý'
                      : 'Đã tiếp nhận'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
