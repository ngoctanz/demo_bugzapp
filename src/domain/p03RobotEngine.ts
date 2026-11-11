import type { DataSourceType, MqttObservationPayload, PostureCode, PostureState } from '../types/bugz.ts';
import {
  createInitialEpisodeRuntime,
  DEFAULT_FSM_CONFIG,
  normalizeObservedPosture,
  type EpisodeRuntimeState,
  type FsmConfig,
} from './bugzRules.ts';
import { GENTLE_VOICE_REMINDERS } from '../data/sourceMapping.ts';

export type MqttTopicChannel = 'observations' | 'events' | 'presence' | 'commands' | 'acks';

export interface ParsedMqttTopic {
  valid: boolean;
  deviceId?: string;
  channel?: MqttTopicChannel;
  error?: string;
}

export function parseBugzMqttTopic(topic: string): ParsedMqttTopic {
  const clean = (topic || '').trim();
  const match = /^bugz\/v1\/devices\/([a-zA-Z0-9_-]{2,64})\/(observations|events|presence|commands|acks)$/.exec(clean);
  if (!match) {
    return {
      valid: false,
      error: `Topic MQTT không đúng hợp đồng bugz/v1/devices/{device_id}/{channel}: "${clean}"`,
    };
  }
  return {
    valid: true,
    deviceId: match[1],
    channel: match[2] as MqttTopicChannel,
  };
}

export interface DeviceBrokerCredentialRecord {
  device_id: string;
  mqtt_username: string;
  mqtt_client_id: string;
  secret_hash: string;
  tls_required: boolean;
  revoked: boolean;
  computes_episodes: boolean;
  supported_posture_codes: PostureCode[];
  calibration_valid: boolean;
  updated_at: number;
}

export interface CommandJobRecord {
  command_id: string;
  device_id: string;
  session_id: string;
  type: 'monitoring.set';
  monitoring_enabled: boolean;
  alert_after_sec: number;
  config_version: number;
  retain: false;
  created_at: number;
  expires_at: number;
  ack_status: 'pending' | 'acknowledged' | 'expired' | 'failed';
  acked_at?: number;
  applied_config_version?: number;
  requested_by_uid: string;
  source: DataSourceType;
}

export interface EpisodeLogRecord {
  episode_id: string;
  student_id: string;
  device_id: string;
  session_id: string;
  state: 'good' | 'bad';
  started_at: number;
  ended_at?: number;
  stable_duration_ms: number;
  source: DataSourceType;
  revision: number;
}

export interface ExtendedSessionRecord {
  device_id: string;
  session_id?: string;
  started_at: number;
  ended_at?: number;
  good_count: number;
  bad_count: number;
  alert_count?: number;
  bad_duration_ms?: number;
  good_duration_ms?: number;
  observation_count?: number;
  last_observation_at?: number;
  last_confidence?: number;
  student_id: string;
  source: DataSourceType;
  content_day?: number;
  config_version?: number;
  last_projected_revision?: number;
}

export interface ExtendedAlertRecord {
  alert_id?: string;
  device_id?: string;
  session_id: string;
  student_id?: string;
  event_id?: string;
  episode_id?: string;
  reminder_index?: number;
  posture_code?: PostureCode;
  message: string;
  created_at: number;
  occurred_at?: number;
  received_at?: number;
  time_basis?: 'robot_clock_validated' | 'server_received_fallback';
  severity?: 'low' | 'medium' | 'high';
  is_read: boolean;
  image_id?: string;
  capture_status?: 'none' | 'pending' | 'uploaded' | 'failed' | 'missing';
  source?: DataSourceType;
  revision?: number;
}

export interface StudentAlertProjectionRecord {
  alert_id: string;
  event_at: number;
  severity: 'low' | 'medium' | 'high';
  device_id?: string;
  session_id?: string;
  episode_id?: string;
  reminder_index?: number;
  message?: string;
  image_id?: string;
  capture_status?: 'none' | 'pending' | 'uploaded' | 'failed' | 'missing';
  source?: DataSourceType;
}

export interface CaptureMetadataRecord {
  capture_id: string;
  storage_path: string;
  student_id: string;
  device_id: string;
  session_id: string;
  mime_type: 'image/jpeg' | 'image/png' | 'image/webp';
  byte_size: number;
  status: 'pending' | 'uploaded' | 'failed' | 'missing';
  upload_ticket_token: string;
  upload_expires_at: number;
  created_at: number;
  uploaded_at?: number;
  failure_reason?: string;
  source: DataSourceType;
  svg_preview_kind?: 'study_desk_posture' | 'camera_blocked';
}

export interface DeviceOutboxItem {
  outbox_id: string;
  revision: number;
  device_id: string;
  session_id: string;
  student_id: string;
  event_id: string;
  kind: 'COUNTERS_UPDATED' | 'EPISODE_CONFIRMED' | 'ALERT_TRIGGERED';
  created_at: number;
  committed_at?: number;
  source: DataSourceType;
  countersSnapshot: {
    good_count: number;
    bad_count: number;
    alert_count: number;
    effective_posture: PostureState;
    observed_at: number;
    current_episode_id?: string | null;
    current_episode_started_at?: number | null;
    confidence?: number;
  };
  episodePayload?: EpisodeLogRecord;
  alertPayload?: ExtendedAlertRecord;
}

export interface DeviceRuntimeBranch {
  device_id: string;
  active_session_id: string | null;
  active_student_id: string | null;
  revision: number;
  last_projected_revision: number;
  current_episode_id: string | null;
  current_episode_reminder_index: number;
  fsm: EpisodeRuntimeState;
  inbox_last_event_id?: string;
  inbox_received_at?: number;
  outbox: Record<string, DeviceOutboxItem>;
  presence_status: 'online' | 'offline' | 'unknown';
  last_heartbeat_at?: number;
  config_version: number;
}

export function createInitialDeviceRuntimeBranch(
  deviceId: string,
  sessionId: string | null = null,
  studentId: string | null = null
): DeviceRuntimeBranch {
  return {
    device_id: deviceId,
    active_session_id: sessionId,
    active_student_id: studentId,
    revision: 0,
    last_projected_revision: 0,
    current_episode_id: null,
    current_episode_reminder_index: 0,
    fsm: createInitialEpisodeRuntime(sessionId || 'no-session'),
    outbox: {},
    presence_status: 'online',
    config_version: 1,
  };
}

/**
 * Chọn câu nhắc nhẹ nhàng theo mã tư thế đã xác minh.
 * Nếu chỉ có good/bad mà không có posture_code hợp lệ, dùng câu nhắc chung "Tư thế chưa phù hợp",
 * tuyệt đối không tự suy diễn gù lưng, cúi đầu hay khoảng cách cm.
 */
export function buildGentleAlertMessage(postureCode?: PostureCode): string {
  if (!postureCode || postureCode === 'UNSPECIFIED_BAD_POSTURE') {
    return 'Tư thế chưa phù hợp — Mình thả lỏng vai rồi chỉnh chỗ ngồi ngay ngắn nhé!';
  }
  const categoryKey = postureCode === 'EYES_TOO_CLOSE' ? 'eye_distance' : 'back_neck';
  const matched = GENTLE_VOICE_REMINDERS.find((r) => r.category === categoryKey);
  return matched
    ? matched.text
    : 'Tư thế chưa phù hợp — Mình thả lỏng vai rồi chỉnh chỗ ngồi ngay ngắn nhé!';
}

export function resolveTechnicalAlertSeverity(
  badDurationMs: number,
  reminderIndex: number
): 'low' | 'medium' | 'high' {
  if (reminderIndex >= 3 || badDurationMs >= 120_000) return 'high';
  if (reminderIndex === 2 || badDurationMs >= 60_000) return 'medium';
  return 'low';
}

/**
 * Thực thi Bước 1 (Validate Inbox) + Bước 2 (Transaction nguyên tử trên device_runtime/{device_id})
 * tạo ra các mục Outbox có ID xác định (deterministic IDs) để Bước 3 (Projection Worker) chiếu sang
 * sessions, episode_log, alerts và student_alerts.
 */
export interface MqttObservationTransactionInput {
  runtime: DeviceRuntimeBranch;
  payload: MqttObservationPayload & {
    calibration_valid?: boolean;
  };
  deviceCred?: DeviceBrokerCredentialRecord;
  serverNowMs: number;
  fsmConfig?: FsmConfig;
  maxClockSkewMs?: number;
}

export interface MqttObservationTransactionResult {
  accepted: boolean;
  status: number;
  code: string;
  message: string;
  ignoredReason?: string;
  nextRuntime: DeviceRuntimeBranch;
  generatedOutboxIds: string[];
  timeBasis: 'robot_clock_validated' | 'server_received_fallback';
}

export function executeObservationRuntimeTransaction(
  input: MqttObservationTransactionInput
): MqttObservationTransactionResult {
  const {
    runtime,
    payload,
    deviceCred,
    serverNowMs,
    fsmConfig = DEFAULT_FSM_CONFIG,
    maxClockSkewMs = 300_000,
  } = input;

  // 1. Kiểm tra dữ liệu đầu vào chống gói hỏng / số âm / NaN / base64
  if (!payload || payload.schema_version !== 1) {
    return {
      accepted: false,
      status: 400,
      code: 'INVALID_SCHEMA_VERSION',
      message: 'Gói MQTT thiếu hoặc sai schema_version (yêu cầu schema_version = 1).',
      nextRuntime: runtime,
      generatedOutboxIds: [],
      timeBasis: 'server_received_fallback',
    };
  }

  if (
    !payload.event_id ||
    !payload.device_id ||
    !payload.session_id ||
    !payload.boot_id ||
    typeof payload.sequence !== 'number' ||
    !Number.isInteger(payload.sequence) ||
    payload.sequence < 0 ||
    typeof payload.observed_at !== 'number' ||
    !Number.isFinite(payload.observed_at) ||
    payload.observed_at <= 0
  ) {
    return {
      accepted: false,
      status: 400,
      code: 'MALFORMED_MQTT_PAYLOAD',
      message:
        'Gói MQTT không hợp lệ: thiếu event_id/boot_id/session_id hoặc sequence/observed_at là số âm hay NaN.',
      nextRuntime: runtime,
      generatedOutboxIds: [],
      timeBasis: 'server_received_fallback',
    };
  }

  // Chặn nhúng base64 ảnh trong gói MQTT
  const rawJson = JSON.stringify(payload);
  if (rawJson.length > 16384 || rawJson.includes('data:image/')) {
    return {
      accepted: false,
      status: 413,
      code: 'PAYLOAD_TOO_LARGE_OR_BASE64_FORBIDDEN',
      message: 'Từ chối gói MQTT: Không được gửi ảnh base64 hoặc payload vượt quá 16KB qua MQTT.',
      nextRuntime: runtime,
      generatedOutboxIds: [],
      timeBasis: 'server_received_fallback',
    };
  }

  // 2. Kiểm tra phiên mở
  if (
    runtime.fsm.sessionClosed ||
    !runtime.active_session_id ||
    !runtime.active_student_id
  ) {
    return {
      accepted: false,
      status: 409,
      code: 'SESSION_CLOSED',
      message: 'Phiên học trên thiết bị đã đóng hoặc chưa mở; không nhận gói quan sát muộn.',
      ignoredReason: 'session_closed',
      nextRuntime: runtime,
      generatedOutboxIds: [],
      timeBasis: 'robot_clock_validated',
    };
  }

  if (payload.session_id !== runtime.active_session_id) {
    return {
      accepted: false,
      status: 409,
      code: 'WRONG_SESSION_ID',
      message: `Gói tin thuộc phiên "${payload.session_id}" không khớp phiên đang mở "${runtime.active_session_id}".`,
      ignoredReason: 'wrong_session',
      nextRuntime: runtime,
      generatedOutboxIds: [],
      timeBasis: 'robot_clock_validated',
    };
  }

  // 3. Kiểm tra chống trùng QoS 1 theo khóa ${device_id}:${boot_id}:${event_id}
  const dedupeKey = `${payload.device_id}:${payload.boot_id}:${payload.event_id}`;
  if (runtime.fsm.processedDedupeKeys.includes(dedupeKey)) {
    return {
      accepted: true,
      status: 200,
      code: 'DUPLICATE_EVENT_IGNORED',
      message: `Gói QoS 1 trùng event_id (${dedupeKey}) đã được xử lý trước đó — không tăng bộ đếm lặp.`,
      ignoredReason: 'duplicate_event',
      nextRuntime: runtime,
      generatedOutboxIds: [],
      timeBasis: 'robot_clock_validated',
    };
  }

  // 4. Kiểm tra sequence cũ (Out-of-order packet)
  const lastSeq = runtime.fsm.lastSequenceByBoot[payload.boot_id];
  if (typeof lastSeq === 'number' && payload.sequence <= lastSeq) {
    return {
      accepted: false,
      status: 409,
      code: 'STALE_SEQUENCE_REJECTED',
      message: `Từ chối gói tin đến muộn/sai thứ tự: sequence=${payload.sequence} <= lastSequence=${lastSeq} (boot_id=${payload.boot_id}).`,
      ignoredReason: 'stale_sequence',
      nextRuntime: runtime,
      generatedOutboxIds: [],
      timeBasis: 'robot_clock_validated',
    };
  }

  // 5. Kiểm tra sai số đồng hồ (Clock Skew)
  const skewMs = Math.abs(serverNowMs - payload.observed_at);
  const timeBasis: 'robot_clock_validated' | 'server_received_fallback' =
    skewMs <= maxClockSkewMs ? 'robot_clock_validated' : 'server_received_fallback';

  // 6. Kiểm tra hiệu chuẩn (calibration_valid), mất người (absent) & mã tư thế (supported_posture_codes)
  const calibrationOk =
    payload.calibration_valid !== false && deviceCred?.calibration_valid !== false;
  const rawPayloadRec = payload as unknown as Record<string, unknown>;
  const explicitlyAbsent =
    payload.posture === 'absent' ||
    rawPayloadRec.person_present === false ||
    rawPayloadRec.person_detected === false;
  const rawEffective: PostureState = explicitlyAbsent
    ? 'absent'
    : normalizeObservedPosture(payload, fsmConfig.minConfidence);
  const effectivePosture: PostureState = calibrationOk ? rawEffective : 'unknown';

  const validatedPostureCode: PostureCode | undefined =
    effectivePosture === 'bad' &&
    payload.posture_code &&
    (!deviceCred ||
      deviceCred.supported_posture_codes.length === 0 ||
      deviceCred.supported_posture_codes.includes(payload.posture_code))
      ? payload.posture_code
      : undefined;

  const nowMs = payload.observed_at;
  const prevFsm = runtime.fsm;
  const nextRevision = runtime.revision + 1;

  const nextFsm: EpisodeRuntimeState = {
    ...prevFsm,
    lastSequenceByBoot: {
      ...prevFsm.lastSequenceByBoot,
      [payload.boot_id]: payload.sequence,
    },
    processedDedupeKeys: [...prevFsm.processedDedupeKeys, dedupeKey],
    frameCount: prevFsm.frameCount + 1,
  };

  let nextEpisodeId = runtime.current_episode_id;
  let nextReminderIndex = runtime.current_episode_reminder_index;
  const nextOutbox: Record<string, DeviceOutboxItem> = { ...runtime.outbox };
  const generatedOutboxIds: string[] = [];

  // Nếu trạng thái là absent hoặc unknown (bao gồm robot_moving=true, mất hiệu chuẩn, confidence thấp):
  // Ngắt chuỗi sai liên tục và không phạt học sinh!
  if (effectivePosture === 'absent' || effectivePosture === 'unknown') {
    nextFsm.candidateState = effectivePosture;
    nextFsm.candidateSinceMs = nowMs;
    nextFsm.confirmedEpisodeState = effectivePosture;
    nextFsm.currentEpisodeStartedAtMs = null;
    nextFsm.lastAlertAtMs = null;
    nextEpisodeId = null;
    nextReminderIndex = 0;
  } else {
    // Khi quan sát là 'good' hoặc 'bad'
    // Đối với luồng AI Webcam (boot_id bắt đầu bằng 'webcam-'), khi gửi posture='bad' thì trên giao diện
    // đã hoàn tất 10 giây debounce từ Vàng (WARNING) sang Đỏ (BAD), nên ghi nhận ngay đợt cần chỉnh và cộng lượt cảnh báo!
    const isWebcamPreDebouncedBad =
      effectivePosture === 'bad' && String(payload.boot_id || '').startsWith('webcam-');
    // Client đã giữ lệch liên tục đúng 10s trước khi gửi 'bad' -> lùi mốc bắt đầu đúng 10s
    // để thời gian ngồi sai (bad_duration_ms) phản ánh chính xác, không bị phồng.
    const WEBCAM_DEBOUNCE_MS = 10_000;

    if (nextFsm.candidateState !== effectivePosture || nextFsm.candidateSinceMs === null) {
      nextFsm.candidateState = effectivePosture;
      nextFsm.candidateSinceMs = isWebcamPreDebouncedBad
        ? nowMs - Math.max(WEBCAM_DEBOUNCE_MS, fsmConfig.stableThresholdMs)
        : nowMs;
    }

    const elapsedCandidateMs = nowMs - nextFsm.candidateSinceMs;

    // Đủ thời gian ổn định (>= 3000ms) và khác đợt đã xác nhận -> Chốt ĐỢT MỚI
    if (
      elapsedCandidateMs >= fsmConfig.stableThresholdMs &&
      nextFsm.confirmedEpisodeState !== effectivePosture
    ) {
      nextFsm.confirmedEpisodeState = effectivePosture;
      nextFsm.currentEpisodeStartedAtMs = nextFsm.candidateSinceMs;
      nextFsm.lastAlertAtMs = null;
      nextReminderIndex = 0;

      if (effectivePosture === 'good') {
        nextFsm.goodCount += 1;
      } else if (effectivePosture === 'bad') {
        nextFsm.badCount += 1;
      }

      const totalEpIndex = nextFsm.goodCount + nextFsm.badCount;
      nextEpisodeId = `${runtime.active_session_id}-ep-${String(totalEpIndex).padStart(3, '0')}-${effectivePosture}`;

      const epOutboxId = `outbox-${runtime.active_session_id}-rev-${nextRevision}-ep`;
      nextOutbox[epOutboxId] = {
        outbox_id: epOutboxId,
        revision: nextRevision,
        device_id: payload.device_id,
        session_id: runtime.active_session_id,
        student_id: runtime.active_student_id,
        event_id: payload.event_id,
        kind: 'EPISODE_CONFIRMED',
        created_at: serverNowMs,
        source: payload.source,
        countersSnapshot: {
          good_count: nextFsm.goodCount,
          bad_count: nextFsm.badCount,
          alert_count: nextFsm.alertCount,
          effective_posture: effectivePosture,
          observed_at: nowMs,
        },
        episodePayload: {
          episode_id: nextEpisodeId,
          student_id: runtime.active_student_id,
          device_id: payload.device_id,
          session_id: runtime.active_session_id,
          state: effectivePosture,
          started_at: nextFsm.currentEpisodeStartedAtMs,
          stable_duration_ms: elapsedCandidateMs,
          source: payload.source,
          revision: nextRevision,
        },
      };
      generatedOutboxIds.push(epOutboxId);
    }

    // Nếu đang trong đợt 'bad' đã xác nhận, kiểm tra phát cảnh báo (alert_after_sec = 30s) & nhắc lại (60s)
    if (
      nextFsm.confirmedEpisodeState === 'bad' &&
      nextFsm.currentEpisodeStartedAtMs !== null
    ) {
      const badDurationMs = nowMs - nextFsm.currentEpisodeStartedAtMs;
      // Webcam: chuyển Đỏ (sau 10s) là tính 1 lượt cảnh báo ngay; nhắc lại theo reminderIntervalMs
      const effectiveAlertAfterMs = isWebcamPreDebouncedBad
        ? Math.min(fsmConfig.alertAfterMs, WEBCAM_DEBOUNCE_MS)
        : fsmConfig.alertAfterMs;
      let shouldAlert = false;
      if (badDurationMs >= effectiveAlertAfterMs) {
        if (nextFsm.lastAlertAtMs === null) {
          shouldAlert = true;
        } else if (nowMs - nextFsm.lastAlertAtMs >= fsmConfig.reminderIntervalMs) {
          shouldAlert = true;
        }
      }

      if (shouldAlert) {
        nextFsm.alertCount += 1;
        nextFsm.lastAlertAtMs = nowMs;
        nextReminderIndex += 1;

        const episodeIdForAlert =
          nextEpisodeId || `${runtime.active_session_id}-ep-bad-${nextFsm.badCount}`;
        const deterministicAlertId = `${episodeIdForAlert}-rem-${nextReminderIndex}`;
        const severity = resolveTechnicalAlertSeverity(badDurationMs, nextReminderIndex);
        const normalizedEventAt =
          timeBasis === 'robot_clock_validated' ? nowMs : serverNowMs;

        const alertRecord: ExtendedAlertRecord = {
          alert_id: deterministicAlertId,
          device_id: payload.device_id,
          session_id: runtime.active_session_id,
          student_id: runtime.active_student_id,
          event_id: payload.event_id,
          episode_id: episodeIdForAlert,
          reminder_index: nextReminderIndex,
          ...(validatedPostureCode ? { posture_code: validatedPostureCode } : {}),
          message: buildGentleAlertMessage(validatedPostureCode),
          created_at: normalizedEventAt,
          occurred_at: nowMs,
          received_at: serverNowMs,
          time_basis: timeBasis,
          severity,
          is_read: false,
          ...(payload.capture_id
            ? { image_id: payload.capture_id, capture_status: 'pending' as const }
            : { capture_status: 'none' as const }),
          source: payload.source,
          revision: nextRevision,
        };

        const alertOutboxId = `outbox-${runtime.active_session_id}-rev-${nextRevision}-alert`;
        nextOutbox[alertOutboxId] = {
          outbox_id: alertOutboxId,
          revision: nextRevision,
          device_id: payload.device_id,
          session_id: runtime.active_session_id,
          student_id: runtime.active_student_id,
          event_id: payload.event_id,
          kind: 'ALERT_TRIGGERED',
          created_at: serverNowMs,
          source: payload.source,
          countersSnapshot: {
            good_count: nextFsm.goodCount,
            bad_count: nextFsm.badCount,
            alert_count: nextFsm.alertCount,
            effective_posture: effectivePosture,
            observed_at: nowMs,
          },
          alertPayload: alertRecord,
        };
        generatedOutboxIds.push(alertOutboxId);
      }
    }
  }

  // Luôn tạo bản ghi đồng bộ bộ đếm & trạng thái theo revision
  const counterOutboxId = `outbox-${runtime.active_session_id}-rev-${nextRevision}-state`;
  nextOutbox[counterOutboxId] = {
    outbox_id: counterOutboxId,
    revision: nextRevision,
    device_id: payload.device_id,
    session_id: runtime.active_session_id,
    student_id: runtime.active_student_id,
    event_id: payload.event_id,
    kind: 'COUNTERS_UPDATED',
    created_at: serverNowMs,
    source: payload.source,
    countersSnapshot: {
      good_count: nextFsm.goodCount,
      bad_count: nextFsm.badCount,
      alert_count: nextFsm.alertCount,
      effective_posture: effectivePosture,
      observed_at: nowMs,
      current_episode_id: nextEpisodeId,
      current_episode_started_at: nextFsm.currentEpisodeStartedAtMs,
      confidence: typeof payload.confidence === 'number' ? payload.confidence : undefined,
    },
  };
  generatedOutboxIds.push(counterOutboxId);

  const nextRuntime: DeviceRuntimeBranch = {
    ...runtime,
    revision: nextRevision,
    current_episode_id: nextEpisodeId,
    current_episode_reminder_index: nextReminderIndex,
    fsm: nextFsm,
    inbox_last_event_id: payload.event_id,
    inbox_received_at: serverNowMs,
    outbox: nextOutbox,
    last_heartbeat_at: serverNowMs,
  };

  return {
    accepted: true,
    status: 200,
    code: 'OBSERVATION_COMMITTED_TO_RUNTIME',
    message: `Đã commit gói ${payload.event_id} vào device_runtime/${payload.device_id} (revision=${nextRevision}, posture=${effectivePosture}).`,
    nextRuntime,
    generatedOutboxIds,
    timeBasis,
  };
}

/**
 * Tính khoảng thời gian [fromUtcMs, toUtcMs) theo múi giờ Việt Nam (Asia/Ho_Chi_Minh, UTC+7),
 * tuần bắt đầu từ Thứ Hai (Mục 6.5 & 11.3 Artifact).
 */
export const VN_OFFSET_MS = 7 * 3600 * 1000;

export type HistoryRangePreset = 'hour' | 'day' | 'week' | 'month' | 'year' | 'custom';

export function resolveVietnamTimeRangeWindow(params: {
  preset: HistoryRangePreset;
  anchorUtcMs?: number;
  customFromUtcMs?: number;
  customToUtcMs?: number;
}): { fromUtcMs: number; toUtcMs: number; labelVi: string } {
  const anchor = params.anchorUtcMs ?? Date.now();

  if (params.preset === 'custom') {
    const from =
      typeof params.customFromUtcMs === 'number' && Number.isFinite(params.customFromUtcMs)
        ? params.customFromUtcMs
        : anchor - 24 * 3600 * 1000;
    const to =
      typeof params.customToUtcMs === 'number' && Number.isFinite(params.customToUtcMs)
        ? Math.max(from + 1, params.customToUtcMs)
        : anchor + 1;
    return {
      fromUtcMs: from,
      toUtcMs: to,
      labelVi: 'Khoảng thời gian tùy chọn [từ, đến)',
    };
  }

  if (params.preset === 'hour') {
    return {
      fromUtcMs: anchor - 3600 * 1000,
      toUtcMs: anchor + 1,
      labelVi: '60 phút gần nhất (Múi giờ VN)',
    };
  }

  // Đổi sang trục giờ địa phương Việt Nam (UTC+7)
  const vnDate = new Date(anchor + VN_OFFSET_MS);
  const year = vnDate.getUTCFullYear();
  const month = vnDate.getUTCMonth();
  const date = vnDate.getUTCDate();
  const dayOfWeek = vnDate.getUTCDay(); // 0 = CN, 1 = Thứ Hai ... 6 = Thứ Bảy

  if (params.preset === 'day') {
    const startVnMs = Date.UTC(year, month, date, 0, 0, 0, 0) - VN_OFFSET_MS;
    const endVnMs = startVnMs + 24 * 3600 * 1000;
    return {
      fromUtcMs: startVnMs,
      toUtcMs: endVnMs,
      labelVi: `Ngày ${String(date).padStart(2, '0')}/${String(month + 1).padStart(2, '0')}/${year} (00:00–24:00 VN)`,
    };
  }

  if (params.preset === 'week') {
    // Tuần bắt đầu từ Thứ Hai (offsetToMonday: CN -> -6, T2 -> 0, T3 -> -1...)
    const daysSinceMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const startOfTodayVnMs = Date.UTC(year, month, date, 0, 0, 0, 0) - VN_OFFSET_MS;
    const startMondayVnMs = startOfTodayVnMs - daysSinceMonday * 24 * 3600 * 1000;
    const endSundayVnMs = startMondayVnMs + 7 * 24 * 3600 * 1000;
    return {
      fromUtcMs: startMondayVnMs,
      toUtcMs: endSundayVnMs,
      labelVi: 'Tuần hiện tại (Thứ Hai 00:00 → Chủ Nhật 24:00 VN)',
    };
  }

  if (params.preset === 'month') {
    const startMonthVnMs = Date.UTC(year, month, 1, 0, 0, 0, 0) - VN_OFFSET_MS;
    const endMonthVnMs = Date.UTC(year, month + 1, 1, 0, 0, 0, 0) - VN_OFFSET_MS;
    return {
      fromUtcMs: startMonthVnMs,
      toUtcMs: endMonthVnMs,
      labelVi: `Tháng ${String(month + 1).padStart(2, '0')}/${year} (Múi giờ VN)`,
    };
  }

  // year
  const startYearVnMs = Date.UTC(year, 0, 1, 0, 0, 0, 0) - VN_OFFSET_MS;
  const endYearVnMs = Date.UTC(year + 1, 0, 1, 0, 0, 0, 0) - VN_OFFSET_MS;
  return {
    fromUtcMs: startYearVnMs,
    toUtcMs: endYearVnMs,
    labelVi: `Năm ${year} (Múi giờ VN)`,
  };
}
