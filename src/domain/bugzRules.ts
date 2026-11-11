import type {
  MqttObservationPayload,
  PostureState,
  UserRole,
} from '../types/bugz.ts';

/**
 * 1. Điều hướng 28 ngày và 4 tuần (Mục 5.1 Artifact)
 * - Ngày 7 -> 8 (Tuần 2), 14 -> 15 (Tuần 3), 21 -> 22 (Tuần 4)
 * - Ngày 28 -> Yêu cầu nhận chứng nhận (/certificate-request), KHÔNG có ngày 29.
 */
export interface DayProgressionResult {
  currentDay: number;
  currentWeek: 1 | 2 | 3 | 4;
  nextAction: 'next_day' | 'certificate_request';
  nextDay: number | null;
  nextWeek: 1 | 2 | 3 | 4 | null;
  targetRoute: string;
   crossesWeekBoundary: boolean;
}

export function getWeekForDay(day: number): 1 | 2 | 3 | 4 {
  if (!Number.isInteger(day) || day < 1 || day > 28) {
    throw new RangeError(`Ngày học phải từ 1 đến 28, nhận được: ${day}`);
  }
  if (day <= 7) return 1;
  if (day <= 14) return 2;
  if (day <= 21) return 3;
  return 4;
}

export function resolveDayProgression(day: number): DayProgressionResult {
  const currentWeek = getWeekForDay(day);
  if (day === 28) {
    return {
      currentDay: 28,
      currentWeek: 4,
      nextAction: 'certificate_request',
      nextDay: null,
      nextWeek: null,
      targetRoute: '/certificate-request',
      crossesWeekBoundary: false,
    };
  }

  const nextDay = day + 1;
  const nextWeek = getWeekForDay(nextDay);
  return {
    currentDay: day,
    currentWeek,
    nextAction: 'next_day',
    nextDay,
    nextWeek,
    targetRoute: `/learn/days/${nextDay}`,
    crossesWeekBoundary: nextWeek !== currentWeek,
  };
}

/**
 * 2. Phân biệt monitoring_enabled (Yêu cầu) và monitoring_active (Robot ACK) (Mục 6.1 Artifact)
 * Không bao giờ báo "Đang giám sát" trước khi Robot ACK (monitoring_active === true).
 */
export type RobotMonitoringDisplayMode =
  | 'inactive'
  | 'waiting_enable_ack'
  | 'active_acked'
  | 'waiting_disable_ack'
  | 'ack_timeout';

export interface RobotMonitoringStatusInfo {
  mode: RobotMonitoringDisplayMode;
  labelVi: string;
  descriptionVi: string;
  isTrulyMonitoring: boolean;
}

export function resolveRobotMonitoringStatus(
  monitoringEnabled: boolean,
  monitoringActive: boolean,
  commandTimedOut = false
): RobotMonitoringStatusInfo {
  if (commandTimedOut) {
    return {
      mode: 'ack_timeout',
      labelVi: 'Chưa nhận phản hồi (Timeout ACK)',
      descriptionVi:
        'Ứng dụng đã gửi lệnh nhưng Robot chưa gửi gói ACK xác nhận trong thời gian quy định.',
      isTrulyMonitoring: monitoringActive,
    };
  }

  if (monitoringEnabled && !monitoringActive) {
    return {
      mode: 'waiting_enable_ack',
      labelVi: 'Đang chờ Robot xác nhận (Chờ ACK)',
      descriptionVi:
        'monitoring_enabled = true nhưng monitoring_active = false. Hệ thống chưa tính là đang giám sát cho tới khi Robot phản hồi ACK.',
      isTrulyMonitoring: false,
    };
  }

  if (monitoringEnabled && monitoringActive) {
    return {
      mode: 'active_acked',
      labelVi: 'Đang giám sát (Robot đã ACK)',
      descriptionVi:
        'monitoring_enabled = true và monitoring_active = true. Robot đã xác nhận lệnh giám sát phiên học.',
      isTrulyMonitoring: true,
    };
  }

  if (!monitoringEnabled && monitoringActive) {
    return {
      mode: 'waiting_disable_ack',
      labelVi: 'Đang chờ Robot dừng giám sát (Chờ ACK)',
      descriptionVi:
        'monitoring_enabled = false nhưng Robot chưa gửi ACK đóng giám sát.',
      isTrulyMonitoring: true,
    };
  }

  return {
    mode: 'inactive',
    labelVi: 'Đang tắt giám sát',
    descriptionVi: 'Chưa gửi yêu cầu giám sát hoặc phiên đang tạm nghỉ.',
    isTrulyMonitoring: false,
  };
}

/**
 * 3. Chuẩn hóa trạng thái tư thế & độ tin cậy (Mục 6.2 Artifact)
 * Khi Robot đang di chuyển (robot_moving = true) hoặc độ tin cậy thấp (< minConfidence),
 * trạng thái bắt buộc chuyển về 'unknown' và không tính là tư thế sai ('bad').
 */
export function normalizeObservedPosture(
  payload: Pick<MqttObservationPayload, 'posture' | 'robot_moving' | 'confidence'>,
  minConfidence = 0.65
): PostureState {
  if (payload.robot_moving) {
    return 'unknown';
  }
  if (
    typeof payload.confidence === 'number' &&
    (Number.isNaN(payload.confidence) || payload.confidence < minConfidence)
  ) {
    return 'unknown';
  }
  if (
    payload.posture === 'good' ||
    payload.posture === 'bad' ||
    payload.posture === 'absent' ||
    payload.posture === 'unknown'
  ) {
    return payload.posture;
  }
  return 'unknown';
}

/**
 * 4. Máy trạng thái (FSM) đếm ĐỢT ổn định (Episode) & Cảnh báo (Alert) + Chống trùng QoS1 (Mục 6.3 & 12.3 Artifact)
 * - good_count, bad_count đếm ĐỢT ổn định (>= stableThresholdMs, mặc định 3000ms), KHÔNG đếm từng khung hình.
 * - Một đợt sai kéo dài có thể phát nhiều lời nhắc (alert_count > bad_count).
 * - Khóa chống trùng: `${device_id}:${boot_id}:${event_id}`.
 */
export interface EpisodeRuntimeState {
  sessionId: string;
  sessionClosed: boolean;
  lastSequenceByBoot: Record<string, number>;
  processedDedupeKeys: string[];
  candidateState: PostureState;
  candidateSinceMs: number | null;
  confirmedEpisodeState: PostureState;
  currentEpisodeStartedAtMs: number | null;
  lastAlertAtMs: number | null;
  goodCount: number;
  badCount: number;
  alertCount: number;
  frameCount: number;
}

export interface FsmConfig {
  stableThresholdMs: number; // Mặc định 3000ms (3 giây)
  alertAfterMs: number; // Mặc định 30000ms (30 giây)
  reminderIntervalMs: number; // Mặc định 60000ms (60 giây)
  minConfidence: number; // Mặc định 0.65
}

export const DEFAULT_FSM_CONFIG: FsmConfig = {
  stableThresholdMs: 3000,
  alertAfterMs: 30000,
  reminderIntervalMs: 60000,
  minConfidence: 0.65,
};

export function createInitialEpisodeRuntime(sessionId: string): EpisodeRuntimeState {
  return {
    sessionId,
    sessionClosed: false,
    lastSequenceByBoot: {},
    processedDedupeKeys: [],
    candidateState: 'unknown',
    candidateSinceMs: null,
    confirmedEpisodeState: 'unknown',
    currentEpisodeStartedAtMs: null,
    lastAlertAtMs: null,
    goodCount: 0,
    badCount: 0,
    alertCount: 0,
    frameCount: 0,
  };
}

export interface FsmStepResult {
  state: EpisodeRuntimeState;
  ignoredReason?: 'duplicate_event' | 'session_closed' | 'wrong_session' | 'stale_sequence';
  effectivePosture: PostureState;
  triggeredAlert: boolean;
}

export function stepEpisodeFsm(
  prev: EpisodeRuntimeState,
  payload: MqttObservationPayload,
  config: FsmConfig = DEFAULT_FSM_CONFIG
): FsmStepResult {
  if (prev.sessionClosed) {
    return {
      state: prev,
      ignoredReason: 'session_closed',
      effectivePosture: prev.confirmedEpisodeState,
      triggeredAlert: false,
    };
  }

  if (payload.session_id !== prev.sessionId) {
    return {
      state: prev,
      ignoredReason: 'wrong_session',
      effectivePosture: prev.confirmedEpisodeState,
      triggeredAlert: false,
    };
  }

  const dedupeKey = `${payload.device_id}:${payload.boot_id}:${payload.event_id}`;
  if (prev.processedDedupeKeys.includes(dedupeKey)) {
    return {
      state: prev,
      ignoredReason: 'duplicate_event',
      effectivePosture: prev.confirmedEpisodeState,
      triggeredAlert: false,
    };
  }

  const lastSeq = prev.lastSequenceByBoot[payload.boot_id];
  if (typeof lastSeq === 'number' && payload.sequence <= lastSeq) {
    return {
      state: prev,
      ignoredReason: 'stale_sequence',
      effectivePosture: prev.confirmedEpisodeState,
      triggeredAlert: false,
    };
  }

  const effectivePosture = normalizeObservedPosture(payload, config.minConfidence);
  const nowMs = payload.observed_at;

  const nextState: EpisodeRuntimeState = {
    ...prev,
    lastSequenceByBoot: {
      ...prev.lastSequenceByBoot,
      [payload.boot_id]: payload.sequence,
    },
    processedDedupeKeys: [...prev.processedDedupeKeys, dedupeKey],
    frameCount: prev.frameCount + 1,
  };

  // Nếu mất người (absent) hoặc không xác định (unknown / robot di chuyển), ngắt khoảng sai liên tục
  if (effectivePosture === 'absent' || effectivePosture === 'unknown') {
    nextState.candidateState = effectivePosture;
    nextState.candidateSinceMs = nowMs;
    nextState.confirmedEpisodeState = effectivePosture;
    nextState.currentEpisodeStartedAtMs = null;
    nextState.lastAlertAtMs = null;
    return {
      state: nextState,
      effectivePosture,
      triggeredAlert: false,
    };
  }

  // Khi quan sát là 'good' hoặc 'bad'
  if (nextState.candidateState !== effectivePosture || nextState.candidateSinceMs === null) {
    nextState.candidateState = effectivePosture;
    nextState.candidateSinceMs = nowMs;
  }

  const elapsedCandidateMs = nowMs - nextState.candidateSinceMs;
  let triggeredAlert = false;

  // Đủ thời gian ổn định (ví dụ >= 3000ms) và khác với đợt đã xác nhận trước đó -> Chốt ĐỢT MỚI
  if (
    elapsedCandidateMs >= config.stableThresholdMs &&
    nextState.confirmedEpisodeState !== effectivePosture
  ) {
    nextState.confirmedEpisodeState = effectivePosture;
    nextState.currentEpisodeStartedAtMs = nextState.candidateSinceMs;
    nextState.lastAlertAtMs = null;

    if (effectivePosture === 'good') {
      nextState.goodCount += 1;
    } else if (effectivePosture === 'bad') {
      nextState.badCount += 1;
    }
  }

  // Nếu đang trong một đợt 'bad' đã xác nhận, kiểm tra ngưỡng phát cảnh báo (alert_after_sec) và nhắc lại
  if (
    nextState.confirmedEpisodeState === 'bad' &&
    nextState.currentEpisodeStartedAtMs !== null
  ) {
    const badDurationMs = nowMs - nextState.currentEpisodeStartedAtMs;
    if (badDurationMs >= config.alertAfterMs) {
      if (nextState.lastAlertAtMs === null) {
        triggeredAlert = true;
        nextState.alertCount += 1;
        nextState.lastAlertAtMs = nowMs;
      } else if (nowMs - nextState.lastAlertAtMs >= config.reminderIntervalMs) {
        triggeredAlert = true;
        nextState.alertCount += 1;
        nextState.lastAlertAtMs = nowMs;
      }
    }
  }

  return {
    state: nextState,
    effectivePosture,
    triggeredAlert,
  };
}

/**
 * 5. Xác minh quyền SuperAdmin phía Backend (Mục 2 Instructions & Mục 4 Artifact)
 * Email bootstrap: minhquantran4312@gmail.com và tamtranmusic@gmail.com (theo yêu cầu Chủ dự án)
 * Chỉ cấp khi ID token đã được Firebase Admin SDK xác minh, có uid, email_verified === true.
 */
export const DEFAULT_SUPERADMIN_BOOTSTRAP_EMAILS = [
  'minhquantran4312@gmail.com',
  'tamtranmusic@gmail.com',
] as const;

export interface VerifiedTokenClaims {
  uid: string;
  email?: string;
  email_verified?: boolean;
  superadmin?: boolean;
}

export function resolveBackendVerifiedRole(
  verifiedToken: VerifiedTokenClaims | null,
  bootstrapAdminEmail: string | readonly string[] = DEFAULT_SUPERADMIN_BOOTSTRAP_EMAILS,
  existingDbRole?: UserRole
): { canGrantSuperAdminBootstrap: boolean; effectiveRole: UserRole } {
  if (!verifiedToken || !verifiedToken.uid) {
    throw new Error('Token chưa được xác minh hợp lệ bởi Backend Admin SDK');
  }

  const allowedEmails = (
    Array.isArray(bootstrapAdminEmail)
      ? bootstrapAdminEmail
      : String(bootstrapAdminEmail).split(',')
  )
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  const normalizedTokenEmail = (verifiedToken.email || '').trim().toLowerCase();

  const isBootstrapMatch =
    Boolean(verifiedToken.email_verified) &&
    normalizedTokenEmail.length > 0 &&
    allowedEmails.includes(normalizedTokenEmail);

  if (verifiedToken.superadmin === true || isBootstrapMatch) {
    return {
      canGrantSuperAdminBootstrap: isBootstrapMatch,
      effectiveRole: 'superadmin',
    };
  }

  return {
    canGrantSuperAdminBootstrap: false,
    effectiveRole: existingDbRole === 'guardian' ? 'guardian' : 'student',
  };
}

/**
 * 6. Chấm điểm Trò chơi phía Server (Mục 8.2 Artifact)
 * - Trả lời đúng ngay lần đầu: +10 điểm
 * - Trả lời đúng ở lần thử lại hoặc gửi lặp cùng câu trong attempt: +0 điểm (tránh cộng điểm lặp)
 */
export function calculateServerGameQuestionScore(params: {
  isCorrect: boolean;
  attemptIndexForQuestion: number; // 1 = lần đầu, >1 = thử lại
  alreadyAwardedForQuestion: boolean;
}): { pointsAwarded: number; feedbackType: 'first_try_correct' | 'retry_understood' | 'incorrect' } {
  if (params.alreadyAwardedForQuestion) {
    return {
      pointsAwarded: 0,
      feedbackType: params.isCorrect ? 'retry_understood' : 'incorrect',
    };
  }

  if (!params.isCorrect) {
    return {
      pointsAwarded: 0,
      feedbackType: 'incorrect',
    };
  }

  if (params.attemptIndexForQuestion === 1) {
    return {
      pointsAwarded: 10,
      feedbackType: 'first_try_correct',
    };
  }

  return {
    pointsAwarded: 0,
    feedbackType: 'retry_understood',
  };
}
