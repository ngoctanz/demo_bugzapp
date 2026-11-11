/**
 * Chặng P04: Pipeline Thông báo Đa kênh (In-App, FCM Web Push, Voice trang đang mở, Email/SMTP)
 * Tuân thủ nghiêm ngặt Mục 5 BUGZ_PROJECT_INSTRUCTIONS.md và Mục 7, 11.2, 13.2, 19 Artifact:
 * - Định tuyến người nhận phía Server: device đã xác thực -> session -> student_id phía server -> học sinh & phụ huynh liên kết -> notification_preferences/{uid}.
 * - Tuyệt đối không tin email hoặc student_id tự khai trong payload MQTT (T20).
 * - Tạo notification_jobs/{alert_id}_{uid}_{channel} với trạng thái queued | accepted_by_provider | failed | suppressed, retry có giới hạn và idempotency_key (T24).
 * - Không đồng nhất accepted_by_provider với delivered hoặc is_read.
 * - Không đính kèm ảnh trẻ em (capture) hoặc thông tin nhạy cảm vào email/push ngoài màn hình khóa; chỉ gửi lời nhắc lịch sự và liên kết /alerts/{alert_id} yêu cầu đăng nhập (T22, T24).
 * - Dedupe cảnh báo giữa RTDB listener và FCM push theo alert_id để chỉ hiện 1 thẻ và phát âm tối đa 1 lần (T21).
 */

import type {
  NotificationDeliveryState,
  PostureCode,
  UserRole,
} from '../types/bugz.ts';
import { buildGentleAlertMessage } from './p03RobotEngine.ts';

export type NotificationChannel = 'push' | 'email' | 'voice';

export interface UserNotificationPreferences {
  push_enabled: boolean;
  voice_enabled: boolean;
  email_enabled: boolean;
  mode: 'every_alert' | 'digest';
  quiet_hours_start: string; // Định dạng HH:mm theo giờ Việt Nam (VD: "22:00")
  quiet_hours_end: string; // Định dạng HH:mm theo giờ Việt Nam (VD: "06:30")
}

export const DEFAULT_NOTIFICATION_PREFERENCES: UserNotificationPreferences = {
  push_enabled: true,
  voice_enabled: true,
  email_enabled: true,
  mode: 'every_alert',
  quiet_hours_start: '22:00',
  quiet_hours_end: '06:30',
};

export interface PushTokenRecord {
  uid: string;
  installation_id: string;
  token: string;
  platform: 'web_desktop' | 'web_android' | 'ios_homescreen_pwa' | 'web_mobile_browser';
  user_agent: string;
  status: 'active' | 'expired' | 'unlinked_on_logout';
  created_at: number;
  updated_at: number;
  last_error?: string;
}

export interface PrivacySafeExternalPayload {
  title: string;
  body: string;
  deep_link_path: string;
  alert_id: string;
  tag: string;
  contains_capture_image: false;
  contains_medical_diagnosis: false;
}

export interface NotificationJobRecord {
  job_id: string; // `${alert_id}_${uid}_${channel}`
  alert_id: string;
  uid: string;
  recipient_role: UserRole;
  recipient_email?: string;
  student_id: string;
  device_id: string;
  session_id: string;
  channel: NotificationChannel;
  state: NotificationDeliveryState; // 'queued' | 'accepted_by_provider' | 'failed' | 'suppressed'
  attempts: number;
  max_attempts: number;
  idempotency_key: string; // `bugz-notif:${alert_id}:${uid}:${channel}`
  delivery_guarantee: 'at_least_once_with_dedupe'; // Không hứa exactly-once cho provider không hỗ trợ
  suppression_reason?:
    | 'channel_disabled_by_user'
    | 'quiet_hours_active'
    | 'digest_mode_batched'
    | 'no_active_push_token'
    | 'unverified_email'
    | 'provider_not_configured';
  last_error?: string;
  provider_message_id?: string;
  external_payload: PrivacySafeExternalPayload;
  created_at: number;
  updated_at: number;
  next_retry_at?: number;
}

export interface ResolvedRecipientTarget {
  uid: string;
  role: UserRole;
  email: string;
  email_verified: boolean;
  full_name: string;
  relationship: 'student_self' | 'parent_owner' | 'linked_guardian';
  preferences: UserNotificationPreferences;
  active_push_tokens: PushTokenRecord[];
}

export type SimulatedProviderOutcome =
  | 'auto'
  | 'accepted_by_provider'
  | 'provider_transient_error'
  | 'fcm_token_expired';

/**
 * Chuyển chuỗi "HH:mm" thành số phút trong ngày [0..1439]
 */
export function parseTimeHhMmToMinutes(hhmm: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec((hhmm || '').trim());
  if (!m) return null;
  const h = Number(m[1]);
  const mins = Number(m[2]);
  if (!Number.isInteger(h) || !Number.isInteger(mins) || h < 0 || h > 23 || mins < 0 || mins > 59) {
    return null;
  }
  return h * 60 + mins;
}

/**
 * Kiểm tra thời điểm `nowUtcMs` có nằm trong khung Giờ yên lặng (Quiet Hours) theo múi giờ Việt Nam (UTC+7) hay không.
 * Hỗ trợ cả khoảng qua nửa đêm (VD: 22:00 -> 06:30) và khoảng trong cùng ngày (VD: 12:00 -> 13:30).
 */
export function isWithinVietnamQuietHours(
  nowUtcMs: number,
  quietStartHhMm: string,
  quietEndHhMm: string
): boolean {
  const startMins = parseTimeHhMmToMinutes(quietStartHhMm);
  const endMins = parseTimeHhMmToMinutes(quietEndHhMm);
  if (startMins === null || endMins === null || startMins === endMins) {
    return false;
  }

  // Giờ Việt Nam là UTC+7 (+420 phút)
  const vnShifted = new Date(nowUtcMs + 7 * 3600 * 1000);
  const currentMins = vnShifted.getUTCHours() * 60 + vnShifted.getUTCMinutes();

  if (startMins < endMins) {
    return currentMins >= startMins && currentMins < endMins;
  }
  // Khoảng vắt qua nửa đêm (ví dụ 22:00 đến 06:30 sáng hôm sau)
  return currentMins >= startMins || currentMins < endMins;
}

/**
 * Chọn câu nhắc nhẹ nhàng, hóm hỉnh, động tác cụ thể, không chê hình thể, không gọi Robot là công cụ chẩn đoán.
 * Nếu posture_code không có hoặc là UNSPECIFIED_BAD_POSTURE, dùng câu nhắc chung lịch sự.
 */
export function selectGentleReminderMessage(
  postureCode?: PostureCode,
  reminderIndex = 1
): string {
  const baseMessage = buildGentleAlertMessage(postureCode);
  if (reminderIndex <= 1) {
    return baseMessage;
  }
  return `${baseMessage} (Nhắc nhẹ lần ${reminderIndex})`;
}

/**
 * Xây dựng nội dung thông báo an toàn quyền riêng tư cho Push ngoài màn hình khóa & Email:
 * - Tuyệt đối KHÔNG đính kèm ảnh chụp trẻ em (`contains_capture_image: false`).
 * - Tuyệt đối KHÔNG chẩn đoán y khoa hay lộ thông tin nhạy cảm (`contains_medical_diagnosis: false`).
 * - Chỉ chứa lời nhắc hành động lịch sự và đường dẫn `/alerts/{alert_id}` yêu cầu đăng nhập để xem chi tiết.
 */
export function buildPrivacySafeNotificationCopy(params: {
  alert_id: string;
  posture_code?: PostureCode;
  reminder_index?: number;
}): PrivacySafeExternalPayload {
  const politeBody = selectGentleReminderMessage(params.posture_code, params.reminder_index || 1);
  return {
    title: 'BUGZ Đồng hành Tư thế Học tập',
    body: `${politeBody} Bấm để đăng nhập và xem chi tiết phiên học.`,
    deep_link_path: `/alerts/${params.alert_id}`,
    alert_id: params.alert_id,
    tag: `bugz-alert-${params.alert_id}`,
    contains_capture_image: false,
    contains_medical_diagnosis: false,
  };
}

/**
 * Định tuyến danh sách người nhận hợp lệ từ dữ liệu phía Server (Ca kiểm thử T20):
 * `device_id (đã xác thực) -> session -> student_id (server gán) -> tài khoản học sinh + phụ huynh liên kết -> notification_preferences/{uid}`.
 * Bỏ qua hoàn toàn mọi `student_id` hoặc `email` tự khai trong payload MQTT!
 */
export function resolveAlertRecipientsFromServerState(params: {
  serverStudentId: string;
  students: Record<
    string,
    {
      student_id: string;
      display_name: string;
      guardian_owner_uid: string;
      auth_uid?: string;
    }
  >;
  guardianStudents: Record<string, Record<string, { can_manage: boolean }>>;
  studentAccounts: Record<string, Record<string, unknown>>;
  users: Record<string, { full_name: string; email: string }>;
  accountRoles: Record<string, { role: UserRole; disabled: boolean }>;
  notificationPreferences: Record<string, UserNotificationPreferences>;
  pushTokens: Record<string, Record<string, PushTokenRecord>>;
}): ResolvedRecipientTarget[] {
  const student = params.students[params.serverStudentId];
  if (!student) {
    return [];
  }

  const recipientMap = new Map<
    string,
    { relationship: 'student_self' | 'parent_owner' | 'linked_guardian' }
  >();

  // 1. Phụ huynh sở hữu chính (guardian_owner_uid)
  if (student.guardian_owner_uid) {
    recipientMap.set(student.guardian_owner_uid, { relationship: 'parent_owner' });
  }

  // 2. Các phụ huynh đồng quản lý trong guardian_students/{guardian_uid}/{student_id}
  for (const [guardianUid, links] of Object.entries(params.guardianStudents)) {
    if (links && links[params.serverStudentId] && !recipientMap.has(guardianUid)) {
      recipientMap.set(guardianUid, { relationship: 'linked_guardian' });
    }
  }

  // 3. Tài khoản học sinh đã liên kết xác minh (student.auth_uid hoặc student_accounts/{uid}/{student_id})
  if (student.auth_uid && !recipientMap.has(student.auth_uid)) {
    recipientMap.set(student.auth_uid, { relationship: 'student_self' });
  }
  for (const [stuUid, links] of Object.entries(params.studentAccounts)) {
    if (links && links[params.serverStudentId] && !recipientMap.has(stuUid)) {
      recipientMap.set(stuUid, { relationship: 'student_self' });
    }
  }

  const targets: ResolvedRecipientTarget[] = [];

  for (const [uid, rel] of recipientMap.entries()) {
    const roleRec = params.accountRoles[uid];
    if (roleRec?.disabled) {
      continue;
    }

    const userRec = params.users[uid];
    if (!userRec || !userRec.email) {
      continue;
    }

    const prefs: UserNotificationPreferences = {
      ...DEFAULT_NOTIFICATION_PREFERENCES,
      ...(params.notificationPreferences[uid] || {}),
    };

    const userTokensMap = params.pushTokens[uid] || {};
    const activeTokens = Object.values(userTokensMap).filter((t) => t.status === 'active');

    targets.push({
      uid,
      role: roleRec?.role || (rel.relationship === 'student_self' ? 'student' : 'guardian'),
      email: userRec.email,
      email_verified: true,
      full_name: userRec.full_name,
      relationship: rel.relationship,
      preferences: prefs,
      active_push_tokens: activeTokens,
    });
  }

  return targets;
}

/**
 * Tạo và điều phối các Notification Jobs cho một cảnh báo hợp lệ (`T20`, `T24`)
 */
export function buildAndEvaluateNotificationJobsForAlert(params: {
  alert_id: string;
  device_id: string;
  session_id: string;
  server_student_id: string;
  posture_code?: PostureCode;
  reminder_index?: number;
  recipients: ResolvedRecipientTarget[];
  nowUtcMs: number;
  fcmProviderConfigured: boolean;
  emailProviderConfigured: boolean;
  simulateProviderOutcome?: SimulatedProviderOutcome;
  existingJobs?: Record<string, NotificationJobRecord>;
}): {
  jobs: NotificationJobRecord[];
  expiredTokenLocations: Array<{ uid: string; installation_id: string }>;
} {
  const externalPayload = buildPrivacySafeNotificationCopy({
    alert_id: params.alert_id,
    posture_code: params.posture_code,
    reminder_index: params.reminder_index,
  });

  const jobs: NotificationJobRecord[] = [];
  const expiredTokenLocations: Array<{ uid: string; installation_id: string }> = [];
  const channels: NotificationChannel[] = ['push', 'email', 'voice'];

  for (const recipient of params.recipients) {
    const inQuietHours = isWithinVietnamQuietHours(
      params.nowUtcMs,
      recipient.preferences.quiet_hours_start,
      recipient.preferences.quiet_hours_end
    );

    for (const channel of channels) {
      const jobId = `${params.alert_id}_${recipient.uid}_${channel}`;
      const idempotencyKey = `bugz-notif:${params.alert_id}:${recipient.uid}:${channel}`;

      // Nếu job đã tồn tại và đã accepted_by_provider trước đó -> giữ nguyên để đảm bảo idempotent!
      const prevJob = params.existingJobs?.[jobId];
      if (prevJob && prevJob.state === 'accepted_by_provider') {
        jobs.push(prevJob);
        continue;
      }

      const baseJob: NotificationJobRecord = {
        job_id: jobId,
        alert_id: params.alert_id,
        uid: recipient.uid,
        recipient_role: recipient.role,
        recipient_email: channel === 'email' ? recipient.email : undefined,
        student_id: params.server_student_id,
        device_id: params.device_id,
        session_id: params.session_id,
        channel,
        state: 'queued',
        attempts: prevJob ? prevJob.attempts : 0,
        max_attempts: 3,
        idempotency_key: idempotencyKey,
        delivery_guarantee: 'at_least_once_with_dedupe',
        external_payload: externalPayload,
        created_at: prevJob ? prevJob.created_at : params.nowUtcMs,
        updated_at: params.nowUtcMs,
      };

      // 1. Kiểm tra bật/tắt kênh trong notification_preferences/{uid}
      const isChannelEnabled =
        channel === 'push'
          ? recipient.preferences.push_enabled
          : channel === 'email'
          ? recipient.preferences.email_enabled
          : recipient.preferences.voice_enabled;

      if (!isChannelEnabled) {
        jobs.push({
          ...baseJob,
          state: 'suppressed',
          suppression_reason: 'channel_disabled_by_user',
        });
        continue;
      }

      // 2. Kiểm tra Giờ yên lặng (Quiet Hours) cho Push & Email
      if (inQuietHours && (channel === 'push' || channel === 'email')) {
        jobs.push({
          ...baseJob,
          state: 'suppressed',
          suppression_reason: 'quiet_hours_active',
        });
        continue;
      }

      // 3. Kênh Voice: chỉ phát trên trang đang mở của client (không gọi external provider phía server)
      if (channel === 'voice') {
        jobs.push({
          ...baseJob,
          state: 'queued',
          attempts: 1,
          provider_message_id: `client-active-page-voice:${params.alert_id}`,
        });
        continue;
      }

      // 4. Kênh Email: kiểm tra chế độ digest vs every_alert và email_verified
      if (channel === 'email') {
        if (!recipient.email_verified) {
          jobs.push({
            ...baseJob,
            state: 'suppressed',
            suppression_reason: 'unverified_email',
          });
          continue;
        }
        if (recipient.preferences.mode === 'digest') {
          jobs.push({
            ...baseJob,
            state: 'suppressed',
            suppression_reason: 'digest_mode_batched',
          });
          continue;
        }

        const nextAttempt = baseJob.attempts + 1;
        if (params.simulateProviderOutcome === 'provider_transient_error') {
          jobs.push({
            ...baseJob,
            state: 'failed',
            attempts: nextAttempt,
            last_error: 'SMTP/Email Provider trả lỗi tạm thời (503 Service Unavailable).',
            next_retry_at:
              nextAttempt < baseJob.max_attempts ? params.nowUtcMs + nextAttempt * 30_000 : undefined,
          });
          continue;
        }

        if (
          params.simulateProviderOutcome === 'accepted_by_provider' ||
          params.emailProviderConfigured
        ) {
          jobs.push({
            ...baseJob,
            state: 'accepted_by_provider',
            attempts: nextAttempt,
            provider_message_id: `email-msg-${params.alert_id}-${recipient.uid}`,
          });
          continue;
        }

        // Mặc định khi chưa cấu hình SMTP/Email thật và không bật cờ mô phỏng provider:
        // Giữ trạng thái queued/suppressed trung thực với lý do provider_not_configured
        jobs.push({
          ...baseJob,
          state: 'suppressed',
          suppression_reason: 'provider_not_configured',
          last_error:
            'Chưa cấu hình EMAIL_PROVIDER / SMTP trên server (BLOCKED). Không giả gửi email thành công.',
        });
        continue;
      }

      // 5. Kênh Push (FCM Web Push)
      if (channel === 'push') {
        if (recipient.active_push_tokens.length === 0) {
          jobs.push({
            ...baseJob,
            state: 'suppressed',
            suppression_reason: 'no_active_push_token',
          });
          continue;
        }

        const nextAttempt = baseJob.attempts + 1;
        if (params.simulateProviderOutcome === 'fcm_token_expired') {
          for (const tk of recipient.active_push_tokens) {
            expiredTokenLocations.push({
              uid: recipient.uid,
              installation_id: tk.installation_id,
            });
          }
          jobs.push({
            ...baseJob,
            state: 'failed',
            attempts: nextAttempt,
            last_error:
              'FCM trả mã messaging/registration-token-not-registered: Đã đánh dấu token hết hạn (expired) để dừng gửi lặp.',
          });
          continue;
        }

        if (params.simulateProviderOutcome === 'provider_transient_error') {
          jobs.push({
            ...baseJob,
            state: 'failed',
            attempts: nextAttempt,
            last_error: 'FCM trả lỗi mạng tạm thời (messaging/internal-error).',
            next_retry_at:
              nextAttempt < baseJob.max_attempts ? params.nowUtcMs + nextAttempt * 15_000 : undefined,
          });
          continue;
        }

        if (
          params.simulateProviderOutcome === 'accepted_by_provider' ||
          params.fcmProviderConfigured
        ) {
          jobs.push({
            ...baseJob,
            state: 'accepted_by_provider',
            attempts: nextAttempt,
            provider_message_id: `fcm-msg-${params.alert_id}-${recipient.uid}`,
          });
          continue;
        }

        jobs.push({
          ...baseJob,
          state: 'suppressed',
          suppression_reason: 'provider_not_configured',
          last_error:
            'Chưa cấu hình VITE_FIREBASE_VAPID_KEY / FCM Admin SDK (BLOCKED). Không giả gửi Web Push thật.',
        });
      }
    }
  }

  return { jobs, expiredTokenLocations };
}

/**
 * Thử gửi lại (Retry) một Notification Job bị lỗi (`state === 'failed'`) trong giới hạn `max_attempts` (`T24`)
 */
export function retryFailedNotificationJob(params: {
  job: NotificationJobRecord;
  nowUtcMs: number;
  simulateOutcome: 'accepted_by_provider' | 'provider_transient_error';
}): {
  ok: boolean;
  status: number;
  code: string;
  message: string;
  updatedJob: NotificationJobRecord;
} {
  const { job, nowUtcMs, simulateOutcome } = params;

  if (job.state === 'accepted_by_provider') {
    return {
      ok: true,
      status: 200,
      code: 'ALREADY_ACCEPTED_IDEMPOTENT',
      message: `Job "${job.job_id}" đã được provider chấp nhận trước đó (idempotency_key=${job.idempotency_key}). Không gửi trùng.`,
      updatedJob: job,
    };
  }

  if (job.attempts >= job.max_attempts) {
    return {
      ok: false,
      status: 429,
      code: 'RETRY_LIMIT_EXCEEDED',
      message: `Từ chối retry job "${job.job_id}": Đã chạm giới hạn tối đa ${job.max_attempts}/${job.max_attempts} lần thử.`,
      updatedJob: job,
    };
  }

  const nextAttempts = job.attempts + 1;
  if (simulateOutcome === 'accepted_by_provider') {
    const updated: NotificationJobRecord = {
      ...job,
      state: 'accepted_by_provider',
      attempts: nextAttempts,
      updated_at: nowUtcMs,
      provider_message_id: `${job.channel}-retry-ok-${job.alert_id}-${nextAttempts}`,
      last_error: undefined,
      next_retry_at: undefined,
    };
    return {
      ok: true,
      status: 200,
      code: 'RETRY_ACCEPTED_BY_PROVIDER',
      message: `Retry lần ${nextAttempts}/${job.max_attempts} thành công: Provider đã chấp nhận job "${job.job_id}" (accepted_by_provider).`,
      updatedJob: updated,
    };
  }

  const updated: NotificationJobRecord = {
    ...job,
    state: 'failed',
    attempts: nextAttempts,
    updated_at: nowUtcMs,
    last_error: `Lỗi provider ở lần thử ${nextAttempts}/${job.max_attempts}.`,
    next_retry_at: nextAttempts < job.max_attempts ? nowUtcMs + nextAttempts * 30_000 : undefined,
  };
  return {
    ok: false,
    status: 502,
    code: 'RETRY_FAILED_AGAIN',
    message: `Retry lần ${nextAttempts}/${job.max_attempts} thất bại. ${
      nextAttempts >= job.max_attempts ? 'Đã hết lượt retry.' : 'Đã xếp lịch retry kế tiếp.'
    }`,
    updatedJob: updated,
  };
}

// ============================================================================
// CLIENT DEDUPLICATION (RTDB LISTENER + FCM PUSH) & ACTIVE-PAGE VOICE CONTROLLER (T21, T23)
// ============================================================================

export interface DeduplicatedAlertFeedItem {
  alert_id: string;
  student_id: string;
  student_display_name: string;
  device_id: string;
  device_name: string;
  session_id: string;
  message: string;
  created_at: number;
  severity: 'low' | 'medium' | 'high';
  is_read_by_guardian: boolean; // alerts.is_read
  is_read_by_me: boolean; // notification_reads/{uid}/{alert_id}
  sources_seen: Array<'rtdb_listener' | 'fcm_foreground' | 'fcm_service_worker'>;
  voice_spoken_count: number;
  last_voice_spoken_at?: number;
}

export interface ClientAlertDeduplicatorState {
  byAlertId: Record<string, DeduplicatedAlertFeedItem>;
  orderedAlertIds: string[];
  lastVoiceSpokenAtMs: number | null;
}

export function createInitialAlertDeduplicatorState(): ClientAlertDeduplicatorState {
  return {
    byAlertId: {},
    orderedAlertIds: [],
    lastVoiceSpokenAtMs: null,
  };
}

/**
 * Hợp nhất sự kiện cảnh báo đến từ cả RTDB Listener lẫn FCM Push (`onMessage` / Service Worker) theo `alert_id` (`T21`).
 * Đảm bảo:
 * - Cùng một `alert_id` đến từ 2 nguồn chỉ tạo ĐÚNG 1 thẻ cảnh báo trên giao diện (`orderedAlertIds` không trùng).
 * - Lời nhắc âm thanh (Voice) chỉ được kích hoạt tự động tối đa 1 lần cho mỗi `alert_id` mới khi trang đang mở, đã bật voice và qua thời gian cooldown (`T23`).
 */
export function ingestAlertIntoClientDeduplicator(params: {
  state: ClientAlertDeduplicatorState;
  incoming: {
    alert_id: string;
    student_id: string;
    student_display_name?: string;
    device_id: string;
    device_name?: string;
    session_id: string;
    message: string;
    created_at: number;
    severity?: 'low' | 'medium' | 'high';
    is_read_by_guardian?: boolean;
    is_read_by_me?: boolean;
    arrival_source: 'rtdb_listener' | 'fcm_foreground' | 'fcm_service_worker';
  };
  voiceContext: {
    pageVisible: boolean;
    voiceEnabled: boolean;
    audioPermittedByBrowser: boolean;
    nowMs: number;
    cooldownMs?: number;
  };
}): {
  nextState: ClientAlertDeduplicatorState;
  isNewAlert: boolean;
  wasDeduplicated: boolean;
  shouldAutoSpeakVoice: boolean;
  voiceBlockedReason?:
    | 'duplicate_alert_already_seen'
    | 'page_not_visible_or_closed'
    | 'voice_disabled_by_user'
    | 'browser_autoplay_blocked'
    | 'voice_cooldown_active';
} {
  const { state, incoming, voiceContext } = params;
  const cooldownMs = voiceContext.cooldownMs ?? 15_000;
  const existing = state.byAlertId[incoming.alert_id];

  if (existing) {
    const updatedSources = existing.sources_seen.includes(incoming.arrival_source)
      ? existing.sources_seen
      : [...existing.sources_seen, incoming.arrival_source];

    const mergedItem: DeduplicatedAlertFeedItem = {
      ...existing,
      student_display_name: incoming.student_display_name || existing.student_display_name,
      device_name: incoming.device_name || existing.device_name,
      is_read_by_guardian:
        incoming.is_read_by_guardian !== undefined
          ? incoming.is_read_by_guardian
          : existing.is_read_by_guardian,
      is_read_by_me:
        incoming.is_read_by_me !== undefined ? incoming.is_read_by_me : existing.is_read_by_me,
      sources_seen: updatedSources,
    };

    return {
      nextState: {
        ...state,
        byAlertId: {
          ...state.byAlertId,
          [incoming.alert_id]: mergedItem,
        },
      },
      isNewAlert: false,
      wasDeduplicated: true,
      shouldAutoSpeakVoice: false,
      voiceBlockedReason: 'duplicate_alert_already_seen',
    };
  }

  // Đây là alert_id mới lần đầu tiên xuất hiện trên client: kiểm tra điều kiện phát âm thanh tự động (T23)
  let shouldAutoSpeakVoice = false;
  let voiceBlockedReason:
    | 'page_not_visible_or_closed'
    | 'voice_disabled_by_user'
    | 'browser_autoplay_blocked'
    | 'voice_cooldown_active'
    | undefined;

  if (!voiceContext.pageVisible) {
    voiceBlockedReason = 'page_not_visible_or_closed';
  } else if (!voiceContext.voiceEnabled) {
    voiceBlockedReason = 'voice_disabled_by_user';
  } else if (!voiceContext.audioPermittedByBrowser) {
    voiceBlockedReason = 'browser_autoplay_blocked';
  } else if (
    state.lastVoiceSpokenAtMs !== null &&
    voiceContext.nowMs - state.lastVoiceSpokenAtMs < cooldownMs
  ) {
    voiceBlockedReason = 'voice_cooldown_active';
  } else {
    shouldAutoSpeakVoice = true;
  }

  const newItem: DeduplicatedAlertFeedItem = {
    alert_id: incoming.alert_id,
    student_id: incoming.student_id,
    student_display_name: incoming.student_display_name || incoming.student_id,
    device_id: incoming.device_id,
    device_name: incoming.device_name || incoming.device_id,
    session_id: incoming.session_id,
    message: incoming.message,
    created_at: incoming.created_at,
    severity: incoming.severity || 'low',
    is_read_by_guardian: Boolean(incoming.is_read_by_guardian),
    is_read_by_me: Boolean(incoming.is_read_by_me),
    sources_seen: [incoming.arrival_source],
    voice_spoken_count: shouldAutoSpeakVoice ? 1 : 0,
    ...(shouldAutoSpeakVoice ? { last_voice_spoken_at: voiceContext.nowMs } : {}),
  };

  const nextById = {
    ...state.byAlertId,
    [incoming.alert_id]: newItem,
  };

  const nextOrderedIds = Object.values(nextById)
    .sort((a, b) => {
      if (b.created_at !== a.created_at) return b.created_at - a.created_at;
      return b.alert_id.localeCompare(a.alert_id);
    })
    .map((item) => item.alert_id);

  return {
    nextState: {
      byAlertId: nextById,
      orderedAlertIds: nextOrderedIds,
      lastVoiceSpokenAtMs: shouldAutoSpeakVoice ? voiceContext.nowMs : state.lastVoiceSpokenAtMs,
    },
    isNewAlert: true,
    wasDeduplicated: false,
    shouldAutoSpeakVoice,
    voiceBlockedReason,
  };
}

/**
 * Kiểm tra đường dẫn `returnTo` hợp lệ và an toàn khi người dùng chưa đăng nhập bấm từ thông báo Push/Email (`T22`)
 */
export function sanitizeReturnToPath(rawReturnTo?: string | null): string | null {
  if (!rawReturnTo || typeof rawReturnTo !== 'string') return null;
  const trimmed = rawReturnTo.trim();
  // Chỉ chấp nhận đường dẫn nội bộ bắt đầu bằng 1 dấu '/' (chống open-redirect '//evil.com' hoặc 'http://')
  if (!trimmed.startsWith('/') || trimmed.startsWith('//') || trimmed.startsWith('/login')) {
    return null;
  }
  return trimmed;
}
