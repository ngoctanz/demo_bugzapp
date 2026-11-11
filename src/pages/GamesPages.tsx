import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Award,
  BookOpen,
  Bot,
  CheckCircle2,
  Clock,
  Gamepad2,
  HelpCircle,
  RotateCcw,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { AtlasIllustration } from '../components/AtlasIllustration';
import {
  DESK_BUILDER_ITEMS,
  DESK_BUILDER_TARGETS,
  GAME_BLUEPRINTS,
  HABIT_RELAY_CARDS,
  ILLUSTRATION_MANIFEST,
  type GameAttemptRecord,
  type GameModeId,
  type GameQuestionAnswerSubmissionRecord,
  type PublicQuestionRecord,
} from '../domain/p05GameEngine';

interface GamesBootstrapData {
  studentId: string;
  studentDisplayName: string;
  blueprints: typeof GAME_BLUEPRINTS;
  illustrationManifest: typeof ILLUSTRATION_MANIFEST;
  publishedQuestions: PublicQuestionRecord[];
  counts: {
    totalSeed: number;
    publishedTotal: number;
    publishedLungThang: number;
    publishedMatSang: number;
    draftHiddenCount: number;
  };
  recentAttempts: GameAttemptRecord[];
  recommendedReviewDays: number[];
  separatedMetrics: {
    gameScoreTotal: number;
    gameCompletedAttemptsCount: number;
    selfPracticeCompletedDaysCount: number;
    selfPracticeTotalDays: number;
    robotObservedGoodEpisodes: number;
    robotObservedBadEpisodes: number;
    clinicalSeparationDisclaimer: string;
  };
}

function normalizeGameModeId(rawId: string | undefined): GameModeId {
  if (rawId === 'desk_builder' || rawId === 'desk-setup') return 'desk_builder';
  if (rawId === 'habit_relay' || rawId === 'habit-relay') return 'habit_relay';
  return 'situations';
}

export const GamesHubPage: React.FC = () => {
  const { students, activeStudentId, setActiveStudentId, authenticatedFetch, effectiveRole } = useAuth();
  const [bootstrap, setBootstrap] = useState<GamesBootstrapData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedTopic, setSelectedTopic] = useState<'all' | 'lung_thang' | 'mat_sang'>('all');
  const [timerChallengeEnabled, setTimerChallengeEnabled] = useState<boolean>(false);
  const [questionLimitMode, setQuestionLimitMode] = useState<'auto' | 'all' | '5'>('auto');

  const targetStudentId = activeStudentId || students[0]?.student_id || '';

  const loadBootstrap = useCallback(async () => {
    setLoading(true);
    try {
      const query = targetStudentId ? `?studentId=${encodeURIComponent(targetStudentId)}` : '';
      const res = await authenticatedFetch(`/api/games/bootstrap${query}`);
      if (res.ok) {
        const data = await res.json();
        setBootstrap(data);
        if (data.studentId && data.studentId !== activeStudentId) {
          setActiveStudentId(data.studentId);
        }
      }
    } finally {
      setLoading(false);
    }
  }, [activeStudentId, authenticatedFetch, setActiveStudentId, targetStudentId]);

  useEffect(() => {
    loadBootstrap();
  }, [loadBootstrap]);

  const metrics = bootstrap?.separatedMetrics || {
    gameScoreTotal: 0,
    gameCompletedAttemptsCount: 0,
    selfPracticeCompletedDaysCount: 0,
    selfPracticeTotalDays: 28,
    robotObservedGoodEpisodes: 0,
    robotObservedBadEpisodes: 0,
    clinicalSeparationDisclaimer:
      'Điểm Trò chơi, Tiến độ Tự thực hành 28 ngày và Quan sát từ Robot được ghi nhận độc lập.',
  };

  const publishedTotalCount = bootstrap?.counts?.publishedTotal ?? 12;
  const lungThangPublishedCount = useMemo(
    () =>
      bootstrap?.counts?.publishedLungThang ??
      (bootstrap?.publishedQuestions || []).filter((q) => q.topic === 'lung_thang').length,
    [bootstrap]
  );
  const matSangPublishedCount = useMemo(
    () =>
      bootstrap?.counts?.publishedMatSang ??
      (bootstrap?.publishedQuestions || []).filter((q) => q.topic === 'mat_sang').length,
    [bootstrap]
  );

  const effectiveLimitMode: 'all' | '5' =
    questionLimitMode === 'auto'
      ? publishedTotalCount >= 40
        ? 'all'
        : '5'
      : questionLimitMode;

  const activeTopicPublishedCount =
    selectedTopic === 'lung_thang'
      ? lungThangPublishedCount
      : selectedTopic === 'mat_sang'
      ? matSangPublishedCount
      : publishedTotalCount;

  return (
    <div className="space-y-8">
      {/* Header & Student Selector */}
      <section className="rounded-3xl border border-teal-200 bg-gradient-to-br from-teal-900 via-teal-800 to-slate-900 p-6 sm:p-8 text-white shadow-sm">
        <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-center">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-teal-400/30 bg-teal-500/20 px-3 py-1 text-xs font-semibold text-teal-100">
              <Gamepad2 className="h-4 w-4 text-amber-300" />
              <span>Trò chơi Rèn luyện Thói quen Tốt</span>
            </div>
            <h1 className="mt-2.5 text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
              Trò chơi Rèn luyện: Lưng thẳng &amp; Mắt sáng
            </h1>
            <p className="mt-1.5 max-w-3xl text-sm leading-relaxed text-teal-50/90">
              Ôn tập những tình huống thực tế gần gũi từ hành trình 28 ngày qua 3 kiểu chơi thú vị: Chọn cách xử lý tình huống, Sắp xếp góc học tập chuẩn và Tiếp sức thói quen tốt.
            </p>
          </div>

          <div className="flex w-full flex-wrap items-center gap-3 md:w-auto">
            {students.length > 0 && (
              <div className="flex w-full flex-wrap items-center gap-2 rounded-2xl border border-white/15 bg-white/10 px-3.5 py-2 backdrop-blur-xs sm:w-auto">
                <label htmlFor="games-student-select" className="shrink-0 text-xs font-semibold text-teal-100">
                  Hồ sơ học tập:
                </label>
                <select
                  id="games-student-select"
                  data-testid="games-student-select"
                  value={targetStudentId}
                  onChange={(e) => setActiveStudentId(e.target.value)}
                  className="min-h-[38px] min-w-0 max-w-full flex-1 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-900 sm:flex-none"
                >
                  {students.map((stu) => (
                    <option key={stu.student_id} value={stu.student_id}>
                      {stu.display_name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <button
              type="button"
              data-testid="toggle-timer-challenge"
              onClick={() => setTimerChallengeEnabled((v) => !v)}
              className={`inline-flex min-h-[42px] items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold transition-colors ${
                timerChallengeEnabled
                  ? 'bg-amber-400 text-slate-950 shadow-xs'
                  : 'border border-teal-300/40 bg-white/10 text-white hover:bg-white/20'
              }`}
            >
              <Clock className="h-3.5 w-3.5" />
              <span>
                {timerChallengeEnabled
                  ? 'Thử thách 30 giây/câu: Đang bật'
                  : 'Chế độ thư giãn: Không giới hạn giờ'}
              </span>
            </button>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs">
        {/* Ba chỉ số tách biệt */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3" data-testid="separated-metrics-grid">
          <div
            data-testid="metric-game-score"
            className="rounded-xl border border-teal-200 bg-teal-50/50 p-4"
          >
            <div className="flex items-center justify-between text-xs font-semibold text-teal-900">
              <span>1. Điểm Trò chơi Ôn tập</span>
              <Gamepad2 className="h-4 w-4 text-teal-700" />
            </div>
            <div className="mt-2 font-mono text-2xl font-bold text-slate-900 tabular-nums">
              {metrics.gameScoreTotal} điểm
            </div>
            <div className="mt-1 text-xs text-slate-600">
              Qua {metrics.gameCompletedAttemptsCount} lượt chơi đã hoàn thành
            </div>
          </div>

          <div
            data-testid="metric-self-practice"
            className="rounded-xl border border-amber-200 bg-amber-50/50 p-4"
          >
            <div className="flex items-center justify-between text-xs font-semibold text-amber-950">
              <span>2. Tiến độ Thực hành 28 Ngày</span>
              <Award className="h-4 w-4 text-amber-700" />
            </div>
            <div className="mt-2 font-mono text-2xl font-bold text-slate-900 tabular-nums">
              {metrics.selfPracticeCompletedDaysCount} / {metrics.selfPracticeTotalDays} ngày
            </div>
            <div className="mt-1 flex items-center justify-between text-xs text-slate-600">
              <span>Số ngày đã nhận huy chương</span>
              <Link to="/learn" className="font-bold text-amber-900 underline">
                Mở 28 ngày →
              </Link>
            </div>
          </div>

          <div
            data-testid="metric-robot-observed"
            className="rounded-xl border border-sky-200 bg-sky-50/50 p-4"
          >
            <div className="flex items-center justify-between text-xs font-semibold text-sky-950">
              <span>3. Quan sát từ Robot Đồng hành</span>
              <Bot className="h-4 w-4 text-sky-700" />
            </div>
            <div className="mt-2 font-mono text-2xl font-bold text-slate-900 tabular-nums">
              {metrics.robotObservedGoodEpisodes} đợt tốt · {metrics.robotObservedBadEpisodes} đợt nhắc
            </div>
            <div className="mt-1 flex items-center justify-between text-xs text-slate-600">
              <span>Ghi nhận trong các phiên ngồi học</span>
              <Link to="/robot/history" className="font-bold text-sky-900 underline">
                Xem lịch sử →
              </Link>
            </div>
          </div>
        </div>

        {/* Ghi chú khích lệ */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-700">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 shrink-0 text-teal-700" />
            <span>
              Điểm trò chơi giúp em ôn lại kiến thức vui vẻ và gợi ý những bài học cần thực hành thêm trong hành trình 28 ngày.
            </span>
          </div>
          <span className="font-semibold text-teal-900" data-testid="published-question-counter">
            {publishedTotalCount >= 40
              ? `Ngân hàng câu hỏi: Đã duyệt mở toàn bộ ${publishedTotalCount}/40 câu (${lungThangPublishedCount} Lưng thẳng · ${matSangPublishedCount} Mắt sáng)`
              : `Ngân hàng câu hỏi: ${publishedTotalCount}/40 câu đang mở`}
          </span>
        </div>

        {/* Bộ lọc chủ đề & chế độ số câu cho Kiểu chơi 1 */}
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-slate-700">Chủ đề câu hỏi:</span>
            {(
              [
                { id: 'all', label: `Tất cả chủ đề (${publishedTotalCount} câu)` },
                { id: 'lung_thang', label: `Lưng thẳng (${lungThangPublishedCount} câu)` },
                { id: 'mat_sang', label: `Mắt sáng (${matSangPublishedCount} câu)` },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                data-testid={`topic-filter-${tab.id}`}
                onClick={() => setSelectedTopic(tab.id)}
                className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors ${
                  selectedTopic === tab.id
                    ? 'bg-slate-900 text-white'
                    : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                {tab.label}
              </button>
            ))}

            <span className="ml-2 text-xs font-semibold text-slate-700">Chế độ câu hỏi:</span>
            <button
              type="button"
              data-testid="limit-mode-all"
              onClick={() => setQuestionLimitMode('all')}
              className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors ${
                effectiveLimitMode === 'all'
                  ? 'bg-teal-800 text-white'
                  : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              Mở toàn bộ câu đã duyệt ({activeTopicPublishedCount} câu)
            </button>
            <button
              type="button"
              data-testid="limit-mode-5"
              onClick={() => setQuestionLimitMode('5')}
              className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors ${
                effectiveLimitMode === '5'
                  ? 'bg-teal-800 text-white'
                  : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              Chơi nhanh 5 câu / vòng
            </button>
          </div>

          {effectiveRole === 'superadmin' && (
            <Link
              to="/admin"
              className="rounded-xl border border-teal-600 bg-teal-50 px-3.5 py-1.5 text-xs font-bold text-teal-900 hover:bg-teal-100"
            >
              Quản lý câu hỏi tại Trung tâm Quản trị →
            </Link>
          )}
        </div>

        {/* 3 Game Modes Cards */}
        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
          {GAME_BLUEPRINTS.games.map((mode) => {
            const previewIllId =
              mode.id === 'situations'
                ? selectedTopic === 'mat_sang'
                  ? 'EYES'
                  : 'POSTURE'
                : mode.id === 'desk_builder'
                ? 'DESK'
                : 'MOVE';

            const playUrl =
              mode.id === 'situations'
                ? `/games/play/${mode.id}?topic=${selectedTopic}&timer=${
                    timerChallengeEnabled ? '1' : '0'
                  }&limit=${effectiveLimitMode}`
                : `/games/play/${mode.id}?topic=${selectedTopic}&timer=${
                    timerChallengeEnabled ? '1' : '0'
                  }`;

            const sourceDays =
              'source_days' in mode && Array.isArray(mode.source_days)
                ? mode.source_days
                : [1, 2, 4, 8];

            const friendlyDesc =
              mode.id === 'situations'
                ? effectiveLimitMode === 'all'
                  ? `Đang mở toàn bộ ${activeTopicPublishedCount} câu hỏi tình huống đã duyệt (${lungThangPublishedCount} câu Lưng thẳng · ${matSangPublishedCount} câu Mắt sáng).`
                  : 'Đọc tình huống thực tế và chọn cách xử lý tốt nhất cho đôi mắt và cột sống.'
                : mode.id === 'desk_builder'
                ? 'Sắp xếp đèn học, mặt bàn và ghế ngồi/kê chân vào đúng vị trí chuẩn.'
                : 'Sắp xếp đúng trình tự 4 bước từ lúc chuẩn bị bàn học đến khi nghỉ giải lao.';

            const baseRoundQuestions =
              'questions_per_round' in mode && typeof mode.questions_per_round === 'number'
                ? mode.questions_per_round
                : 5;
            const roundQuestionsCount =
              effectiveLimitMode === 'all'
                ? activeTopicPublishedCount
                : Math.min(baseRoundQuestions, activeTopicPublishedCount || 5);

            return (
              <article
                key={mode.id}
                data-testid={`game-mode-card-${mode.id}`}
                className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-xs transition-colors hover:border-teal-600"
              >
                <div>
                  <AtlasIllustration
                    illustrationId={previewIllId}
                    showCaption={true}
                    className="mb-4"
                  />
                  <div className="flex items-center justify-between gap-2 text-xs text-slate-500">
                    <span className="font-semibold text-teal-800">Trò chơi rèn luyện</span>
                    <span>
                      {mode.id === 'situations'
                        ? effectiveLimitMode === 'all'
                          ? `Mở toàn bộ ${roundQuestionsCount} câu · Tối đa ${roundQuestionsCount * 10} điểm`
                          : `${roundQuestionsCount} câu / vòng · Tối đa ${roundQuestionsCount * 10} điểm (Mở ${activeTopicPublishedCount} câu)`
                        : mode.id === 'desk_builder'
                        ? '3 vị trí bàn học · 30 điểm'
                        : '4 bước thói quen · 20 điểm'}
                    </span>
                  </div>
                  <h2 className="mt-1.5 text-lg font-bold text-slate-900">{mode.title}</h2>
                  <p className="mt-1.5 text-xs leading-relaxed text-slate-600">
                    {friendlyDesc}
                  </p>
                  <div className="mt-3 flex flex-wrap items-center gap-1.5">
                    <span className="text-[11px] font-semibold text-slate-500">Bài học liên quan:</span>
                    {sourceDays.map((d) => (
                      <Link
                        key={d}
                        to={`/learn/days/${d}`}
                        className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-semibold text-teal-800 hover:bg-teal-50"
                      >
                        Ngày {d}
                      </Link>
                    ))}
                  </div>
                </div>

                <div className="mt-5 border-t border-slate-100 pt-4">
                  <Link
                    to={playUrl}
                    data-testid={`btn-start-mode-${mode.id}`}
                    className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-teal-700 px-4 py-2.5 text-xs font-semibold text-white hover:bg-teal-800"
                  >
                    <Gamepad2 className="h-4 w-4" />
                    <span>
                      {mode.id === 'situations' && effectiveLimitMode === 'all'
                        ? `Chơi ngay Toàn bộ (${roundQuestionsCount} câu)`
                        : `Chơi ngay: ${mode.title}`}
                    </span>
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {/* Lịch sử các lượt chơi gần đây */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-base font-bold text-slate-900">
            Lịch sử Lượt chơi Gần đây
          </h2>
          {loading && <span className="text-xs text-slate-500">Đang tải...</span>}
        </div>

        {!bootstrap?.recentAttempts || bootstrap.recentAttempts.length === 0 ? (
          <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-600">
            Bạn chưa có lượt chơi nào được lưu. Hãy chọn một trong 3 trò chơi ở trên để bắt đầu nhé!
          </div>
        ) : (
          <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
                <tr>
                  <th className="p-3 font-semibold">Thời gian chơi</th>
                  <th className="p-3 font-semibold">Trò chơi</th>
                  <th className="p-3 font-semibold">Điểm đạt được</th>
                  <th className="p-3 font-semibold">Chi tiết</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {bootstrap.recentAttempts.map((att) => (
                  <tr key={att.attempt_id}>
                    <td className="p-3">
                      <div className="font-semibold text-slate-900">
                        {new Date(att.created_at).toLocaleString('vi-VN', {
                          timeZone: 'Asia/Ho_Chi_Minh',
                        })}
                      </div>
                    </td>
                    <td className="p-3 font-semibold text-slate-900">
                      {att.game_id === 'situations'
                        ? 'Chọn cách xử lý tình huống'
                        : att.game_id === 'desk_builder'
                        ? 'Sắp góc học tập chuẩn'
                        : 'Tiếp sức thói quen'}
                    </td>
                    <td className="p-3 font-mono font-bold text-teal-800">
                      {att.score} / {att.max_possible_score} điểm
                    </td>
                    <td className="p-3">
                      <Link
                        to={`/games/results/${att.attempt_id}?student_id=${encodeURIComponent(
                          att.student_id
                        )}`}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-800 hover:bg-slate-50"
                      >
                        <span>Xem kết quả</span>
                        <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
};

export const GamePlayPage: React.FC = () => {
  const { gameId } = useParams<{ gameId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { students, activeStudentId, authenticatedFetch } = useAuth();

  const normalizedMode = normalizeGameModeId(gameId);
  const topicParam =
    (searchParams.get('topic') as 'all' | 'lung_thang' | 'mat_sang' | null) || 'all';
  const initialTimerEnabled = searchParams.get('timer') === '1';
  const limitParam = searchParams.get('limit');
  const [questionLimit, setQuestionLimit] = useState<'all' | 5 | undefined>(
    limitParam === 'all' ? 'all' : limitParam === '5' ? 5 : undefined
  );

  const targetStudentId = activeStudentId || students[0]?.student_id || '';

  const [attempt, setAttempt] = useState<GameAttemptRecord | null>(null);
  const [questions, setQuestions] = useState<PublicQuestionRecord[]>([]);
  const [currentIdx, setCurrentIdx] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [selectedOptionByQ, setSelectedOptionByQ] = useState<Record<string, 'A' | 'B' | 'C'>>({});
  const [lastAnswerResultByQ, setLastAnswerResultByQ] = useState<
    Record<string, GameQuestionAnswerSubmissionRecord>
  >({});

  const [timerEnabled, setTimerEnabled] = useState<boolean>(initialTimerEnabled);
  const [secondsLeft, setSecondsLeft] = useState<number>(30);

  // State cho Mode 2: Sắp góc học tập
  const [activeDeskItemId, setActiveDeskItemId] = useState<string>('foot_support');
  const [deskPlacements, setDeskPlacements] = useState<Record<string, string>>({
    foot_support: '',
    adjust_lamp: '',
    clear_desk: '',
  });
  const [deskFeedback, setDeskFeedback] = useState<{
    isCorrect: boolean;
    pointsAwarded: number;
    feedback: string;
    explanation: string;
    sourceDays: number[];
    submissionsCount: number;
  } | null>(null);

  // State cho Mode 3: Tiếp sức thói quen
  const [habitOrder, setHabitOrder] = useState<string[]>(['study', 'prepare', 'pause', 'return']);
  const [habitReflection, setHabitReflection] = useState<string>(
    'Em đã chỉnh ghế ngồi thẳng lưng và đặt lịch nghỉ mắt 20-20-20.'
  );
  const [habitFeedback, setHabitFeedback] = useState<{
    isCorrect: boolean;
    pointsAwarded: number;
    feedback: string;
    explanation: string;
    sourceDays: number[];
    submissionsCount: number;
  } | null>(null);

  const startNewAttempt = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    setCurrentIdx(0);
    setSelectedOptionByQ({});
    setLastAnswerResultByQ({});
    setDeskFeedback(null);
    setHabitFeedback(null);
    setSecondsLeft(30);

    try {
      const res = await authenticatedFetch('/api/games/attempts', {
        method: 'POST',
        body: JSON.stringify({
          ...(targetStudentId ? { student_id: targetStudentId } : {}),
          game_id: normalizedMode,
          topic_filter: topicParam,
          timer_enabled: timerEnabled,
          ...(questionLimit !== undefined ? { question_limit: questionLimit } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.message || 'Không thể khởi tạo lượt chơi.');
      } else {
        setAttempt(data.attempt);
        setQuestions(Array.isArray(data.questions) ? data.questions : []);
      }
    } catch {
      setErrorMsg('Lỗi kết nối khi khởi tạo lượt chơi.');
    } finally {
      setLoading(false);
    }
  }, [authenticatedFetch, targetStudentId, normalizedMode, topicParam, timerEnabled, questionLimit]);

  useEffect(() => {
    startNewAttempt();
  }, [startNewAttempt]);

  useEffect(() => {
    if (!timerEnabled || normalizedMode !== 'situations') return;
    setSecondsLeft(30);
  }, [currentIdx, timerEnabled, normalizedMode]);

  useEffect(() => {
    if (!timerEnabled || normalizedMode !== 'situations') return;
    const timer = window.setInterval(() => {
      setSecondsLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [timerEnabled, normalizedMode]);

  const currentQuestion = questions[currentIdx] || null;

  const handleSubmitSituationOption = useCallback(
    async (optionId: 'A' | 'B' | 'C') => {
      if (!attempt || !currentQuestion) return;
      setSelectedOptionByQ((prev) => ({ ...prev, [currentQuestion.id]: optionId }));

      const res = await authenticatedFetch(
        `/api/games/attempts/${encodeURIComponent(attempt.attempt_id)}/answers`,
        {
          method: 'POST',
          body: JSON.stringify({
            student_id: attempt.student_id,
            question_id: currentQuestion.id,
            selected_option_id: optionId,
          }),
        }
      );
      const data = await res.json();
      if (res.ok && data.attempt && data.questionResult) {
        setAttempt(data.attempt);
        setLastAnswerResultByQ((prev) => ({
          ...prev,
          [currentQuestion.id]: data.questionResult,
        }));
      } else {
        setErrorMsg(data.message || 'Không thể chấm câu trả lời.');
      }
    },
    [attempt, currentQuestion, authenticatedFetch]
  );

  useEffect(() => {
    if (normalizedMode !== 'situations' || !currentQuestion) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === '1' || e.key.toUpperCase() === 'A') handleSubmitSituationOption('A');
      if (e.key === '2' || e.key.toUpperCase() === 'B') handleSubmitSituationOption('B');
      if (e.key === '3' || e.key.toUpperCase() === 'C') handleSubmitSituationOption('C');
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [normalizedMode, currentQuestion, handleSubmitSituationOption]);

  const handleAssignDeskTarget = (itemId: string, targetId: string) => {
    setDeskPlacements((prev) => ({
      ...prev,
      [itemId]: targetId,
    }));
  };

  const handleSubmitDeskBuilder = async (overridePlacements?: Record<string, string>) => {
    if (!attempt) return;
    const placementsToSubmit = overridePlacements || deskPlacements;
    if (overridePlacements) {
      setDeskPlacements(overridePlacements);
    }
    const res = await authenticatedFetch(
      `/api/games/attempts/${encodeURIComponent(attempt.attempt_id)}/answers`,
      {
        method: 'POST',
        body: JSON.stringify({
          student_id: attempt.student_id,
          desk_pairs: placementsToSubmit,
        }),
      }
    );
    const data = await res.json();
    if (res.ok && data.attempt && data.deskResult) {
      setAttempt(data.attempt);
      setDeskFeedback((prev) => ({
        isCorrect: data.deskResult.is_all_correct,
        pointsAwarded: data.deskResult.points_awarded,
        feedback: data.message,
        explanation: data.deskResult.task_feedbacks.map((t: { feedback: string }) => t.feedback).join(' · '),
        sourceDays: data.deskResult.source_days || [4, 5, 19],
        submissionsCount: (prev?.submissionsCount || 0) + 1,
      }));
    }
  };

  const moveHabitCard = (idx: number, direction: -1 | 1) => {
    const nextIdx = idx + direction;
    if (nextIdx < 0 || nextIdx >= habitOrder.length) return;
    const copy = [...habitOrder];
    const temp = copy[idx];
    copy[idx] = copy[nextIdx];
    copy[nextIdx] = temp;
    setHabitOrder(copy);
  };

  const handleSubmitHabitRelay = async (overrideSequence?: string[]) => {
    if (!attempt) return;
    const sequenceToSubmit = overrideSequence || habitOrder;
    if (overrideSequence) {
      setHabitOrder(overrideSequence);
    }
    const res = await authenticatedFetch(
      `/api/games/attempts/${encodeURIComponent(attempt.attempt_id)}/answers`,
      {
        method: 'POST',
        body: JSON.stringify({
          student_id: attempt.student_id,
          ordered_card_ids: sequenceToSubmit,
          self_reflection_text: habitReflection,
        }),
      }
    );
    const data = await res.json();
    if (res.ok && data.attempt && data.relayResult) {
      setAttempt(data.attempt);
      setHabitFeedback((prev) => ({
        isCorrect: data.relayResult.is_correct,
        pointsAwarded: data.relayResult.points_awarded,
        feedback: data.message,
        explanation: data.relayResult.self_reported_only_disclaimer,
        sourceDays: data.relayResult.source_days || [1, 8, 15, 18, 26],
        submissionsCount: (prev?.submissionsCount || 0) + 1,
      }));
    }
  };

  const handleFinishAndNavigate = async () => {
    if (!attempt) return;
    navigate(
      `/games/results/${encodeURIComponent(attempt.attempt_id)}?student_id=${encodeURIComponent(
        attempt.student_id
      )}`
    );
  };

  const modeBlueprint =
    GAME_BLUEPRINTS.games.find((m) => m.id === normalizedMode) || GAME_BLUEPRINTS.games[0];

  return (
    <div className="space-y-6">
      {/* Top Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Link
          to="/games"
          className="inline-flex min-h-[44px] items-center gap-2 text-sm font-semibold text-slate-700 hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Quay lại Danh sách Trò chơi</span>
        </Link>

        <div className="flex flex-wrap items-center gap-3">
          {attempt && (
            <span
              data-testid="game-attempt-id-badge"
              className="sr-only"
            >
              {attempt.attempt_id}
            </span>
          )}
          <span
            data-testid="game-current-score"
            className="rounded-lg border border-teal-300 bg-teal-50 px-3.5 py-1.5 font-mono text-xs font-bold text-teal-950 tabular-nums"
          >
            Điểm hiện tại: {attempt?.score ?? 0} / {attempt?.max_possible_score ?? 50} điểm
          </span>
          <button
            type="button"
            onClick={startNewAttempt}
            className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>Chơi lại vòng mới</span>
          </button>
        </div>
      </div>

      {errorMsg && (
        <div
          role="alert"
          className="rounded-xl border border-rose-300 bg-rose-50 p-4 text-xs text-rose-950"
        >
          <strong>Thông báo:</strong> {errorMsg}
        </div>
      )}

      {loading ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-600">
          Đang chuẩn bị câu hỏi...
        </div>
      ) : normalizedMode === 'situations' ? (
        /* ==================== MODE 1: CHỌN CÁCH XỬ LÝ ==================== */
        <section
          data-testid="gameplay-mode-situations"
          className="rounded-2xl border border-slate-200 bg-white p-6"
        >
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <div className="text-xs font-semibold text-teal-800">
                {modeBlueprint.title}
              </div>
              <h1 className="mt-0.5 text-xl font-bold text-slate-900">
                Câu {currentIdx + 1} / {questions.length}
                <span
                  data-testid="locked-question-version"
                  className="sr-only"
                >
                  v{currentQuestion ? attempt?.question_versions[currentQuestion.id] ?? currentQuestion.version : 1}
                </span>
              </h1>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                data-testid="play-toggle-question-limit"
                onClick={() =>
                  setQuestionLimit((prev) =>
                    prev === 'all' || (prev === undefined && questions.length > 5) ? 5 : 'all'
                  )
                }
                className="rounded-lg border border-teal-300 bg-teal-50 px-3 py-1.5 text-xs font-bold text-teal-900 hover:bg-teal-100"
              >
                {questions.length > 5
                  ? `Đang mở toàn bộ (${questions.length} câu) · Đổi sang 5 câu/vòng`
                  : 'Đang chơi 5 câu/vòng · Mở toàn bộ câu đã duyệt'}
              </button>
              <button
                type="button"
                onClick={() => setTimerEnabled((v) => !v)}
                className={`rounded-lg px-3 py-1.5 font-mono text-xs font-semibold ${
                  timerEnabled
                    ? secondsLeft === 0
                      ? 'bg-amber-100 text-amber-950 border border-amber-300'
                      : 'bg-teal-800 text-white'
                    : 'border border-slate-200 bg-slate-50 text-slate-600'
                }`}
              >
                {timerEnabled
                  ? secondsLeft > 0
                    ? `Thử thách 30s: còn ${secondsLeft}s`
                    : 'Hết 30s — Cứ bình tĩnh chọn đáp án nhé!'
                  : 'Không giới hạn giờ'}
              </button>
            </div>
          </div>

          {/* Thanh chọn nhanh 5 câu trong vòng */}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {questions.map((q, idx) => {
              const ans = lastAnswerResultByQ[q.id];
              return (
                <button
                  key={q.id}
                  type="button"
                  data-testid={`round-question-tab-${idx + 1}`}
                  onClick={() => setCurrentIdx(idx)}
                  className={`rounded-xl border px-3 py-1.5 text-xs font-bold transition-colors ${
                    currentIdx === idx
                      ? 'border-slate-900 bg-slate-900 text-white'
                      : ans?.is_correct
                      ? 'border-emerald-300 bg-emerald-50 text-emerald-900'
                      : ans
                      ? 'border-amber-300 bg-amber-50 text-amber-900'
                      : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  Câu {idx + 1}
                </button>
              );
            })}
          </div>

          {currentQuestion && (
            <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-12">
              {/* Cột trái: Ảnh minh họa */}
              <div className="lg:col-span-5">
                <AtlasIllustration
                  illustrationId={currentQuestion.illustration_id}
                  showCaption={true}
                />
                <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    <span>Chủ đề:</span>
                    <span className="rounded bg-teal-100 px-2 py-0.5 text-[11px] font-bold text-teal-900">
                      {currentQuestion.topic === 'lung_thang' ? 'Lưng thẳng' : 'Mắt sáng'}
                    </span>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <span>Bài học liên quan:</span>
                    {currentQuestion.source_days.map((d) => (
                      <Link
                        key={d}
                        to={`/learn/days/${d}`}
                        className="rounded border border-teal-300 bg-white px-2 py-0.5 text-[11px] font-bold text-teal-800 hover:bg-teal-50"
                      >
                        Ngày {d}
                      </Link>
                    ))}
                  </div>
                </div>
              </div>

              {/* Cột phải: Tình huống & 3 lựa chọn A/B/C */}
              <div className="lg:col-span-7 flex flex-col justify-between space-y-5">
                <div>
                  <div className="inline-flex items-center gap-1.5 rounded-md bg-teal-50 px-2.5 py-1 text-xs font-semibold text-teal-900">
                    <HelpCircle className="h-3.5 w-3.5" />
                    <span>Chọn phương án xử lý đúng nhất</span>
                  </div>
                  <h2
                    data-testid="question-prompt-text"
                    className="mt-2 text-lg font-bold leading-snug text-slate-900"
                  >
                    {currentQuestion.prompt}
                  </h2>

                  <div className="mt-4 space-y-3">
                    {currentQuestion.options.map((opt, idx) => {
                      const isSelected = selectedOptionByQ[currentQuestion.id] === opt.id;
                      const currentAns = lastAnswerResultByQ[currentQuestion.id];

                      return (
                        <button
                          key={opt.id}
                          type="button"
                          data-testid={`option-btn-${opt.id}`}
                          onClick={() => handleSubmitSituationOption(opt.id)}
                          className={`flex min-h-[52px] w-full items-center justify-between gap-3 rounded-xl border p-4 text-left text-sm transition-colors ${
                            isSelected
                              ? currentAns?.is_correct
                                ? 'border-emerald-600 bg-emerald-50 font-semibold text-emerald-950'
                                : 'border-amber-500 bg-amber-50 font-semibold text-amber-950'
                              : 'border-slate-200 bg-white font-medium text-slate-800 hover:border-teal-600 hover:bg-slate-50'
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-slate-300 bg-slate-50 font-mono text-xs font-bold text-slate-800">
                              {opt.id}
                            </span>
                            <span>{opt.text}</span>
                          </div>
                          <span className="shrink-0 font-mono text-[11px] text-slate-400">
                            Phím {idx + 1}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Phản hồi chấm điểm */}
                {lastAnswerResultByQ[currentQuestion.id] && (
                  <div
                    data-testid="game-answer-feedback"
                    className={`rounded-xl border p-4 text-xs leading-relaxed ${
                      lastAnswerResultByQ[currentQuestion.id].is_correct
                        ? 'border-emerald-300 bg-emerald-50/90 text-emerald-950'
                        : 'border-amber-300 bg-amber-50/90 text-amber-950'
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 font-bold">
                        <CheckCircle2 className="h-4 w-4 shrink-0" />
                        <span>
                          {lastAnswerResultByQ[currentQuestion.id].is_correct
                            ? 'Tuyệt vời! Đáp án chính xác!'
                            : 'Chưa chính xác — Mình xem gợi ý rồi chọn lại nhé!'}
                        </span>
                      </div>
                      <span
                        data-testid="answer-points-awarded-badge"
                        className="rounded bg-white px-2.5 py-0.5 font-mono font-bold text-slate-900 border border-slate-200"
                      >
                        +{lastAnswerResultByQ[currentQuestion.id].points_awarded} điểm
                      </span>
                    </div>

                    <p className="mt-2 font-medium">
                      {lastAnswerResultByQ[currentQuestion.id].feedback_text}
                    </p>
                    {lastAnswerResultByQ[currentQuestion.id].explanation_text && (
                      <p className="mt-1.5 text-slate-700">
                        <strong>Giải thích:</strong>{' '}
                        {lastAnswerResultByQ[currentQuestion.id].explanation_text}
                      </p>
                    )}

                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-200/60 pt-3">
                      <div className="flex flex-wrap items-center gap-2">
                        {lastAnswerResultByQ[currentQuestion.id].source_days.map((dayNum) => (
                          <Link
                            key={dayNum}
                            to={`/learn/days/${dayNum}`}
                            className="inline-flex items-center gap-1 rounded-lg border border-teal-600 bg-white px-2.5 py-1 text-xs font-bold text-teal-900 hover:bg-teal-50"
                          >
                            <BookOpen className="h-3.5 w-3.5" />
                            <span>Xem bài học Ngày {dayNum}</span>
                          </Link>
                        ))}
                      </div>

                      {currentIdx < questions.length - 1 ? (
                        <button
                          type="button"
                          onClick={() => setCurrentIdx((i) => Math.min(questions.length - 1, i + 1))}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-teal-800 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-teal-900"
                        >
                          <span>Sang Câu {currentIdx + 2}</span>
                          <ArrowRight className="h-3.5 w-3.5" />
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={handleFinishAndNavigate}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-slate-800"
                        >
                          <span>Xem Tổng kết Lượt chơi</span>
                          <ArrowRight className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* Điều hướng câu hỏi & Hoàn tất */}
                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={currentIdx === 0}
                      onClick={() => setCurrentIdx((i) => Math.max(0, i - 1))}
                      className="min-h-[40px] rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                    >
                      ← Câu trước
                    </button>
                    <button
                      type="button"
                      data-testid="btn-next-question"
                      disabled={currentIdx >= questions.length - 1}
                      onClick={() => setCurrentIdx((i) => Math.min(questions.length - 1, i + 1))}
                      className="min-h-[40px] rounded-xl bg-teal-700 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-800 disabled:opacity-40"
                    >
                      Câu tiếp theo →
                    </button>
                  </div>

                  <button
                    type="button"
                    data-testid="btn-finish-attempt"
                    onClick={handleFinishAndNavigate}
                    className="inline-flex min-h-[42px] items-center gap-2 rounded-xl bg-slate-900 px-5 py-2 text-xs font-semibold text-white hover:bg-slate-800"
                  >
                    <span>Hoàn tất &amp; Xem Kết quả</span>
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </section>
      ) : normalizedMode === 'desk_builder' ? (
        /* ==================== MODE 2: SẮP GÓC HỌC TẬP ==================== */
        <section
          data-testid="gameplay-mode-desk-builder"
          className="rounded-2xl border border-slate-200 bg-white p-6"
        >
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <div className="text-xs font-semibold text-teal-800">
                Sắp góc học tập chuẩn
              </div>
              <h1 className="mt-0.5 text-xl font-bold text-slate-900">
                Đặt Đèn học, Ghế/Kê chân và Mặt bàn vào đúng vị trí hợp lý
              </h1>
              <p className="mt-1 text-xs text-slate-600">
                Chạm chọn thẻ vật dụng rồi chạm vào vị trí đích tương ứng (hoặc chọn trực tiếp từ danh sách).
              </p>
            </div>

            <button
              type="button"
              data-testid="btn-prefill-desk-correct"
              onClick={() =>
                handleSubmitDeskBuilder({
                  foot_support: 'feet',
                  adjust_lamp: 'work_area',
                  clear_desk: 'desk',
                })
              }
              className="rounded-xl border border-teal-600 bg-teal-50 px-3.5 py-2 text-xs font-bold text-teal-900 hover:bg-teal-100"
            >
              Gợi ý xếp chuẩn &amp; Kiểm tra (+30đ)
            </button>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-12">
            <div className="lg:col-span-5">
              <AtlasIllustration illustrationId="DESK" showCaption={true} />
              <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-xs text-slate-700">
                <div className="font-bold text-slate-900">Bài học liên quan:</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {[4, 5, 19].map((d) => (
                    <Link
                      key={d}
                      to={`/learn/days/${d}`}
                      className="rounded-lg border border-teal-300 bg-white px-2.5 py-1 text-xs font-bold text-teal-900 hover:bg-teal-50"
                    >
                      Xem Ngày {d}
                    </Link>
                  ))}
                </div>
              </div>
            </div>

            <div className="lg:col-span-7 space-y-5">
              <div>
                <h2 className="text-sm font-bold text-slate-900">
                  Bước 1: Chọn vật dụng cần sắp xếp
                </h2>
                <div className="mt-2.5 grid grid-cols-1 gap-3 sm:grid-cols-3">
                  {DESK_BUILDER_ITEMS.map((item) => {
                    const isSelected = activeDeskItemId === item.id;
                    const assignedTarget = deskPlacements[item.id];
                    return (
                      <div
                        key={item.id}
                        draggable
                        onDragStart={(e) => e.dataTransfer.setData('text/plain', item.id)}
                        className={`rounded-xl border p-3.5 transition-colors ${
                          isSelected
                            ? 'border-teal-700 bg-teal-50/70'
                            : 'border-slate-200 bg-white'
                        }`}
                      >
                        <button
                          type="button"
                          data-testid={`desk-item-btn-${item.id}`}
                          onClick={() => setActiveDeskItemId(item.id)}
                          className="w-full text-left"
                        >
                          <div className="text-xs font-bold text-slate-900">
                            {item.label}
                          </div>
                          <p className="mt-1 text-[11px] text-slate-600">{item.hint}</p>
                        </button>

                        <div className="mt-2.5 border-t border-slate-200/70 pt-2">
                          <label
                            htmlFor={`select-target-${item.id}`}
                            className="block text-[11px] font-semibold text-slate-700"
                          >
                            Vị trí đặt:
                          </label>
                          <select
                            id={`select-target-${item.id}`}
                            data-testid={`desk-select-${item.id}`}
                            value={assignedTarget || ''}
                            onChange={(e) => handleAssignDeskTarget(item.id, e.target.value)}
                            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs font-semibold text-slate-900"
                          >
                            <option value="">-- Chọn vị trí --</option>
                            {DESK_BUILDER_TARGETS.map((t) => (
                              <option key={t.id} value={t.id}>
                                {t.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div>
                <h2 className="text-sm font-bold text-slate-900">
                  Bước 2: Chạm vào Vị trí Đích trên bàn học
                </h2>
                <div className="mt-2.5 grid grid-cols-1 gap-3 sm:grid-cols-3">
                  {DESK_BUILDER_TARGETS.map((target) => {
                    const placedItem = DESK_BUILDER_ITEMS.find(
                      (it) => deskPlacements[it.id] === target.id
                    );
                    return (
                      <button
                        key={target.id}
                        type="button"
                        data-testid={`desk-target-zone-${target.id}`}
                        onClick={() => handleAssignDeskTarget(activeDeskItemId, target.id)}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => {
                          e.preventDefault();
                          const draggedItemId = e.dataTransfer.getData('text/plain');
                          if (draggedItemId) handleAssignDeskTarget(draggedItemId, target.id);
                        }}
                        className={`flex min-h-[90px] flex-col justify-between rounded-xl border-2 border-dashed p-3.5 text-left transition-colors ${
                          placedItem
                            ? 'border-teal-600 bg-teal-50/40'
                            : 'border-slate-300 bg-slate-50 hover:border-teal-500'
                        }`}
                      >
                        <div>
                          <div className="text-xs font-bold text-slate-900">{target.label}</div>
                        </div>
                        <div className="mt-2 rounded-lg bg-white px-2.5 py-1.5 text-xs font-semibold text-teal-900 border border-slate-200">
                          {placedItem ? `Đã đặt: ${placedItem.label}` : 'Chạm để đặt vào đây'}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {deskFeedback && (
                <div
                  data-testid="desk-builder-feedback"
                  className={`rounded-xl border p-4 text-xs ${
                    deskFeedback.isCorrect
                      ? 'border-emerald-300 bg-emerald-50 text-emerald-950'
                      : 'border-amber-300 bg-amber-50 text-amber-950'
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 font-bold">
                    <span>{deskFeedback.feedback}</span>
                    <span
                      data-testid="desk-points-awarded"
                      className="rounded bg-white px-2.5 py-0.5 font-mono text-slate-900 border border-slate-200"
                    >
                      +{deskFeedback.pointsAwarded} điểm
                    </span>
                  </div>
                  <p className="mt-1.5">{deskFeedback.explanation}</p>
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    data-testid="btn-submit-desk-builder"
                    onClick={() => handleSubmitDeskBuilder()}
                    className="min-h-[42px] rounded-xl bg-teal-700 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-800"
                  >
                    Kiểm tra kết quả sắp xếp
                  </button>
                </div>

                <button
                  type="button"
                  data-testid="btn-finish-attempt"
                  onClick={handleFinishAndNavigate}
                  className="inline-flex min-h-[42px] items-center gap-2 rounded-xl bg-slate-900 px-5 py-2 text-xs font-semibold text-white hover:bg-slate-800"
                >
                  <span>Xem Tổng kết Lượt chơi</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </section>
      ) : (
        /* ==================== MODE 3: TIẾP SỨC THÓI QUEN (HABIT RELAY) ==================== */
        <section
          data-testid="gameplay-mode-habit-relay"
          className="rounded-2xl border border-slate-200 bg-white p-6"
        >
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <div className="text-xs font-semibold text-teal-800">
                Tiếp sức thói quen tốt
              </div>
              <h1 className="mt-0.5 text-xl font-bold text-slate-900">
                Xếp chuỗi thói quen: Chuẩn bị góc học → Ngồi học → Nghỉ mắt &amp; Vươn vai → Quay lại học
              </h1>
              <p className="mt-1 text-xs text-slate-600">
                Sắp xếp 4 bước theo đúng trình tự hợp lý khi ngồi học tại nhà.
              </p>
            </div>

            <button
              type="button"
              data-testid="btn-prefill-habit-correct"
              onClick={() =>
                handleSubmitHabitRelay(['prepare', 'study', 'pause', 'return'])
              }
              className="rounded-xl border border-teal-600 bg-teal-50 px-3.5 py-2 text-xs font-bold text-teal-900 hover:bg-teal-100"
            >
              Gợi ý thứ tự chuẩn &amp; Kiểm tra (+20đ)
            </button>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-12">
            <div className="lg:col-span-5">
              <AtlasIllustration illustrationId="MOVE" showCaption={true} />
            </div>

            <div className="lg:col-span-7 space-y-5">
              <div className="space-y-2.5">
                <div className="text-xs font-bold text-slate-800">
                  Dùng nút Lên (↑) / Xuống (↓) để xếp đúng thứ tự 4 bước:
                </div>
                {habitOrder.map((cardId, idx) => {
                  const card = HABIT_RELAY_CARDS.find((c) => c.id === cardId);
                  if (!card) return null;
                  return (
                    <div
                      key={card.id}
                      data-testid={`habit-card-${idx}`}
                      className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3.5"
                    >
                      <div className="flex items-start gap-3">
                        <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-teal-800 font-mono text-xs font-bold text-white">
                          {idx + 1}
                        </span>
                        <div>
                          <div className="text-xs font-bold text-slate-900">{card.title}</div>
                          <div className="mt-0.5 text-xs text-slate-600">{card.detail}</div>
                          <div className="mt-1 text-[11px] font-semibold text-teal-800">
                            Bài học Ngày {card.day}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          aria-label={`Đưa bước ${card.title} lên trên`}
                          disabled={idx === 0}
                          onClick={() => moveHabitCard(idx, -1)}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-40"
                        >
                          <ArrowUp className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          aria-label={`Đưa bước ${card.title} xuống dưới`}
                          disabled={idx === habitOrder.length - 1}
                          onClick={() => moveHabitCard(idx, 1)}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-40"
                        >
                          <ArrowDown className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div>
                <label
                  htmlFor="habit-reflection-input"
                  className="block text-xs font-semibold text-slate-800"
                >
                  Chia sẻ ngắn về thói quen em đã thực hiện hôm nay:
                </label>
                <input
                  id="habit-reflection-input"
                  type="text"
                  value={habitReflection}
                  onChange={(e) => setHabitReflection(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs text-slate-900"
                />
              </div>

              {habitFeedback && (
                <div
                  data-testid="habit-relay-feedback"
                  className={`rounded-xl border p-4 text-xs ${
                    habitFeedback.isCorrect
                      ? 'border-emerald-300 bg-emerald-50 text-emerald-950'
                      : 'border-amber-300 bg-amber-50 text-amber-950'
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 font-bold">
                    <span>{habitFeedback.feedback}</span>
                    <span
                      data-testid="habit-points-awarded"
                      className="rounded bg-white px-2.5 py-0.5 font-mono text-slate-900 border border-slate-200"
                    >
                      +{habitFeedback.pointsAwarded} điểm
                    </span>
                  </div>
                  <p className="mt-1.5">{habitFeedback.explanation}</p>
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    data-testid="btn-submit-habit-relay"
                    onClick={() => handleSubmitHabitRelay()}
                    className="min-h-[42px] rounded-xl bg-teal-700 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-800"
                  >
                    Kiểm tra chuỗi thói quen
                  </button>
                </div>

                <button
                  type="button"
                  data-testid="btn-finish-attempt"
                  onClick={handleFinishAndNavigate}
                  className="inline-flex min-h-[42px] items-center gap-2 rounded-xl bg-slate-900 px-5 py-2 text-xs font-semibold text-white hover:bg-slate-800"
                >
                  <span>Xem Tổng kết Lượt chơi</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </section>
      )}
    </div>
  );
};

export const GameResultsPage: React.FC = () => {
  const { attemptId } = useParams<{ attemptId: string }>();
  const [searchParams] = useSearchParams();
  const { activeStudentId, students, authenticatedFetch } = useAuth();

  const studentId =
    searchParams.get('student_id') || activeStudentId || students[0]?.student_id || 'stu-a1';

  const [attempt, setAttempt] = useState<GameAttemptRecord | null>(null);
  const [recommendedDays, setRecommendedDays] = useState<number[]>([1, 4, 8]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const loadResult = async () => {
      if (!attemptId) return;
      setLoading(true);
      try {
        const res = await authenticatedFetch(
          `/api/games/attempts/${encodeURIComponent(attemptId)}?student_id=${encodeURIComponent(
            studentId
          )}`
        );
        if (res.ok) {
          const data = await res.json();
          setAttempt(data.attempt);
          if (Array.isArray(data.attempt?.recommended_review_days) && data.attempt.recommended_review_days.length > 0) {
            setRecommendedDays(data.attempt.recommended_review_days);
          }
        }
      } finally {
        setLoading(false);
      }
    };
    loadResult();
  }, [attemptId, studentId, authenticatedFetch]);

  const answerList = useMemo(
    () => (attempt?.answers ? Object.values(attempt.answers) : []),
    [attempt]
  );

  return (
    <div className="space-y-6">
      <Link
        to="/games"
        className="inline-flex min-h-[44px] items-center gap-2 text-sm font-semibold text-slate-700 hover:text-slate-900"
      >
        <ArrowLeft className="h-4 w-4" />
        <span>Quay lại Danh sách Trò chơi</span>
      </Link>

      <section
        data-testid="game-results-summary"
        className="rounded-2xl border border-slate-200 bg-white p-6"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-teal-800">
            <Sparkles className="h-4 w-4" />
            <span>Hoàn thành Lượt chơi</span>
          </div>
          {attempt && (
            <span className="rounded-lg border border-teal-300 bg-teal-50 px-3 py-1 font-mono text-xs font-bold text-teal-950">
              Tổng điểm: {attempt.score} / {attempt.max_possible_score} điểm
            </span>
          )}
        </div>

        <h1 className="mt-1 text-2xl font-bold text-slate-900">
          Tổng kết Lượt chơi &amp; Gợi ý Bài học Ôn tập
        </h1>
        <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
          Dưới đây là kết quả chi tiết trong lượt chơi vừa rồi và những bài học trong hành trình 28 ngày giúp em rèn luyện tốt hơn.
        </p>

        {loading ? (
          <div className="mt-4 text-xs text-slate-500">Đang tải chi tiết lượt chơi...</div>
        ) : attempt ? (
          <div className="mt-5 space-y-5">
            {/* Chi tiết cho Mode 1: Chọn cách xử lý tình huống */}
            {answerList.length > 0 && (
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
                    <tr>
                      <th className="p-3 font-semibold">Câu hỏi</th>
                      <th className="p-3 font-semibold">Phương án đã chọn</th>
                      <th className="p-3 font-semibold">Kết quả</th>
                      <th className="p-3 font-semibold">Điểm cộng</th>
                      <th className="p-3 font-semibold">Nhận xét</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {answerList.map((ans, idx) => (
                      <tr key={ans.question_id}>
                        <td className="p-3 font-bold text-slate-900">
                          Câu {idx + 1} ({ans.question_id})
                        </td>
                        <td className="p-3 font-mono text-slate-700">{ans.selected_option_id}</td>
                        <td className="p-3">
                          <span
                            className={`rounded px-2 py-0.5 text-[11px] font-bold ${
                              ans.is_correct
                                ? 'bg-emerald-100 text-emerald-900'
                                : 'bg-amber-100 text-amber-900'
                            }`}
                          >
                            {ans.is_correct ? 'Chính xác' : 'Cần ôn thêm'}
                          </span>
                        </td>
                        <td className="p-3 font-mono font-bold text-teal-900">
                          +{ans.points_awarded} điểm
                        </td>
                        <td className="p-3 text-slate-700">{ans.feedback_text}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Chi tiết cho Mode 2: Sắp góc học tập chuẩn */}
            {attempt.desk_builder_submission && (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-sm font-bold text-slate-900">
                    Kết quả Sắp góc học tập chuẩn ({attempt.desk_builder_submission.correct_count}/
                    {attempt.desk_builder_submission.total_tasks} vị trí chính xác)
                  </div>
                  <span className="rounded bg-white px-2.5 py-0.5 font-mono text-xs font-bold text-teal-900 border border-slate-200">
                    +{attempt.desk_builder_submission.points_awarded} điểm
                  </span>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  {attempt.desk_builder_submission.task_feedbacks.map((tf) => {
                    const itemMeta = DESK_BUILDER_ITEMS.find((i) => i.id === tf.item);
                    return (
                      <div
                        key={tf.item}
                        className={`rounded-xl border p-3 text-xs ${
                          tf.is_correct
                            ? 'border-emerald-300 bg-emerald-50/70 text-emerald-950'
                            : 'border-amber-300 bg-amber-50/70 text-amber-950'
                        }`}
                      >
                        <div className="font-bold">{itemMeta?.label || tf.item}</div>
                        <p className="mt-1">{tf.feedback}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Chi tiết cho Mode 3: Tiếp sức thói quen tốt */}
            {attempt.habit_relay_submission && (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-sm font-bold text-slate-900">
                    Kết quả Tiếp sức thói quen tốt:{' '}
                    {attempt.habit_relay_submission.is_correct
                      ? 'Đúng trình tự 4 bước chuẩn'
                      : 'Cần điều chỉnh lại trình tự'}
                  </div>
                  <span className="rounded bg-white px-2.5 py-0.5 font-mono text-xs font-bold text-teal-900 border border-slate-200">
                    +{attempt.habit_relay_submission.points_awarded} điểm
                  </span>
                </div>
                {attempt.habit_relay_submission.self_reflection_text && (
                  <div className="rounded-lg border border-slate-200 bg-white p-3 text-xs text-slate-700">
                    <strong>Chia sẻ thực hành của em:</strong> “
                    {attempt.habit_relay_submission.self_reflection_text}”
                  </div>
                )}
              </div>
            )}
          </div>
        ) : null}

        {/* Gợi ý ngày học cần ôn lại */}
        <div className="mt-6 border-t border-slate-100 pt-5">
          <div className="text-xs font-bold text-slate-900">
            Gợi ý Bài học 28 Ngày liên quan để thực hành thêm:
          </div>
          <div className="mt-3 flex flex-wrap gap-2.5">
            {recommendedDays.map((dayNum) => (
              <Link
                key={dayNum}
                to={`/learn/days/${dayNum}`}
                className="inline-flex min-h-[42px] items-center gap-2 rounded-xl bg-teal-700 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-800"
              >
                <BookOpen className="h-4 w-4" />
                <span>Mở Bài học Ngày {dayNum}</span>
              </Link>
            ))}
            <Link
              to="/games"
              className="inline-flex min-h-[42px] items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50"
            >
              <Gamepad2 className="h-4 w-4" />
              <span>Chơi thêm vòng khác</span>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
};
