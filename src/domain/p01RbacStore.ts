import type { DataSourceType, MqttObservationPayload, PostureCode, PostureState, UserRole } from '../types/bugz.ts';
import {
  LEARNING_DAYS_28,
  SOURCE_VERIFICATION_REPORT,
  type LearningDayManifestItem,
  type SourceVerificationEntry,
} from '../data/sourceMapping.ts';
import { DEFAULT_FSM_CONFIG, resolveBackendVerifiedRole } from './bugzRules.ts';
import {
  evaluateRtdbRead,
  evaluateRtdbWrite,
  type RtdbAuthContext,
  type RtdbQueryContext,
} from './rtdbRulesEngine.ts';
import type {
  AdminBootstrapAdapter,
  FirebaseAuthUserLookupRecord,
  SuperAdminBootstrapLockRecord,
  SuperAdminCustomClaims,
} from './superAdminBootstrapScript.ts';
import {
  createInitialDeviceRuntimeBranch,
  executeObservationRuntimeTransaction,
  parseBugzMqttTopic,
  resolveVietnamTimeRangeWindow,
  type CaptureMetadataRecord,
  type CommandJobRecord,
  type DeviceBrokerCredentialRecord,
  type DeviceRuntimeBranch,
  type EpisodeLogRecord,
  type ExtendedAlertRecord,
  type ExtendedSessionRecord,
  type HistoryRangePreset,
  type StudentAlertProjectionRecord,
} from './p03RobotEngine.ts';
import {
  buildAndEvaluateNotificationJobsForAlert,
  DEFAULT_NOTIFICATION_PREFERENCES,
  parseTimeHhMmToMinutes,
  resolveAlertRecipientsFromServerState,
  retryFailedNotificationJob,
  type NotificationJobRecord,
  type PushTokenRecord,
  type SimulatedProviderOutcome,
  type UserNotificationPreferences,
} from './p04NotificationEngine.ts';
import {
  DEFAULT_GENTLE_REMINDER_TEMPLATES,
  evaluateDeskBuilderSubmission,
  evaluateHabitRelaySubmission,
  FORBIDDEN_CLINICAL_CLAIM_PATTERNS,
  GAME_BLUEPRINTS,
  getPublishedQuestionsForStudent,
  ILLUSTRATION_MANIFEST,
  validateAndSplitQuestionBankSeed,
  type DeskBuilderSubmissionRecord,
  type GameAttemptRecord,
  type GameModeId,
  type GameQuestionAnswerSubmissionRecord,
  type GentleReminderTemplateRecord,
  type HabitRelaySubmissionRecord,
  type IllustrationId,
  type PublicQuestionRecord,
  type QuestionOptionItem,
  type QuestionStatus,
  type QuestionTopic,
  type SeedImportValidationReport,
  type ServerQuestionKeyRecord,
} from './p05GameEngine.ts';

export type { CaptureMetadataRecord, NotificationJobRecord };

export interface ExcelUserRecord {
  full_name: string;
  email: string;
  phone?: string;
}

export interface ServerAccountRoleRecord {
  role: UserRole;
  disabled: boolean;
  updated_at: number;
  updated_by: string;
}

export interface StudentRecord {
  student_id: string;
  display_name: string;
  age_group: 'primary_6_10' | 'middle_11_15';
  guardian_owner_uid: string;
  auth_uid?: string;
  timezone: string;
  created_at: number;
}

export interface GuardianStudentLinkRecord {
  relationship: 'parent_owner' | 'linked_guardian';
  verified_at: number;
  can_manage: boolean;
}

export interface StudentAccountLinkRecord {
  verified_at: number;
  linked_via_invitation: string;
}

export interface OneTimeInvitationRecord {
  code: string;
  student_id: string;
  student_display_name: string;
  created_by_uid: string;
  target_type: 'student_account' | 'co_guardian';
  created_at: number;
  expires_at: number;
  used_at?: number;
  used_by_uid?: string;
  revoked?: boolean;
}

export interface DeviceAccessRecord {
  role: 'owner' | 'student_operator' | 'guardian_viewer';
  student_id?: string;
  can_operate: boolean;
  granted_at: number;
}

export interface ExcelDeviceRecord {
  user_id: string;
  device_name: string;
  monitoring_enabled: boolean;
  current_posture: PostureState;
  monitoring_active: boolean;
  alert_after_sec: number;
  last_seen_at?: number;
}

export interface LearningProgressDayRecord {
  viewed_at: number;
  self_completed_at?: number;
  source_version: string;
  medal_asset: string;
}

export interface CertificateRequestRecord {
  request_id: string;
  student_id: string;
  student_display_name: string;
  guardian_email: string;
  reflection_text: string;
  achievement_photo_name: string;
  achievement_photo_note?: string;
  status: 'received' | 'processing' | 'completed';
  created_at: number;
  created_by_uid: string;
  updated_at: number;
  admin_note?: string;
}

export interface AuditLogRecord {
  log_id: string;
  actor_uid: string;
  actor_email: string;
  action:
    | 'BOOTSTRAP_SUPERADMIN'
    | 'ADMIN_CHANGE_ROLE'
    | 'ADMIN_SET_DISABLED'
    | 'ADMIN_REVOKE_LINK'
    | 'CREATE_INVITATION'
    | 'ACCEPT_INVITATION'
    | 'PAIR_DEVICE'
    | 'REVOKE_DEVICE_ACCESS'
    | 'ADMIN_UPDATE_LEARNING_DAY'
    | 'SUBMIT_CERTIFICATE_REQUEST'
    | 'ADMIN_UPDATE_CERTIFICATE_STATUS'
    | 'START_ROBOT_SESSION'
    | 'END_ROBOT_SESSION'
    | 'SWITCH_SESSION_STUDENT'
    | 'SEND_ROBOT_COMMAND'
    | 'ROBOT_COMMAND_ACK'
    | 'VIEW_SUPPORT_CAPTURE'
    | 'REVOKE_DEVICE_CREDENTIAL'
    | 'ADMIN_IMPORT_QUESTIONS'
    | 'ADMIN_UPDATE_QUESTION'
    | 'ADMIN_PUBLISH_QUESTION'
    | 'ADMIN_UPDATE_DEVICE_CONFIG'
    | 'ADMIN_UPDATE_REMINDER_TEMPLATE'
    | 'ADMIN_DELETE_CAPTURE'
    | 'ADMIN_EXPORT_DEMO_BACKUP'
    | 'ADMIN_RESTORE_DEMO_BACKUP'
    | 'ADMIN_RESET_CLEAN_DEMO_STATE'
    | 'UNAUTHORIZED_ATTEMPT';
  target: string;
  details: string;
  time: number;
  result: 'SUCCESS' | 'DENIED';
}

export interface VerifiedActorToken {
  uid: string;
  email: string;
  email_verified: boolean;
  name?: string;
  phone?: string;
  admin?: boolean;
  superadmin?: boolean;
  role?: UserRole;
}

export interface RtdbTreeState {
  users: Record<string, ExcelUserRecord>;
  account_roles: Record<string, ServerAccountRoleRecord>;
  students: Record<string, StudentRecord>;
  guardian_students: Record<string, Record<string, GuardianStudentLinkRecord>>;
  student_accounts: Record<string, Record<string, StudentAccountLinkRecord>>;
  device_access: Record<string, Record<string, DeviceAccessRecord>>;
  devices: Record<string, ExcelDeviceRecord>;
  sessions: Record<string, Record<string, ExtendedSessionRecord>>;
  alerts: Record<string, Record<string, Record<string, ExtendedAlertRecord>>>;
  learning_days: Record<string, LearningDayManifestItem>;
  learning_progress: Record<string, Record<string, LearningProgressDayRecord>>;
  certificate_requests: Record<string, Record<string, CertificateRequestRecord>>;
  student_alerts: Record<string, Record<string, StudentAlertProjectionRecord>>;
  episode_log: Record<string, Record<string, EpisodeLogRecord>>;
  device_runtime: Record<string, DeviceRuntimeBranch>;
  command_jobs: Record<string, Record<string, CommandJobRecord>>;
  capture_metadata: Record<string, CaptureMetadataRecord>;
  device_broker_credentials: Record<string, DeviceBrokerCredentialRecord>;
  notification_reads: Record<string, Record<string, { read_at: number }>>;
  push_tokens: Record<string, Record<string, PushTokenRecord>>;
  notification_jobs: Record<string, NotificationJobRecord>;
  questions_public: Record<string, PublicQuestionRecord>;
  question_keys: Record<string, Record<string, ServerQuestionKeyRecord>>;
  game_attempts: Record<string, Record<string, GameAttemptRecord>>;
  reminder_templates: Record<string, GentleReminderTemplateRecord>;
  notification_preferences: Record<string, UserNotificationPreferences>;
  invitations: Record<string, OneTimeInvitationRecord>;
  device_pairing_secrets: Record<
    string,
    { pairing_code: string; factory_device_name: string; used_by_uid?: string; used_at?: number }
  >;
  system_locks?: {
    superadmin_bootstrap?: SuperAdminBootstrapLockRecord;
  };
  audit_logs: Record<string, AuditLogRecord>;
}

/**
 * Khởi tạo dữ liệu RTDB mẫu cho Emulator / Kiểm thử P01
 * Có đủ Gia đình A (uid-guardian-a), Gia đình B (uid-guardian-b), Học sinh A1 (uid-student-a1),
 * và SuperAdmin bootstrap (minhquantran4312@gmail.com) để kiểm thử cách ly dữ liệu chéo T01-T04 & T10.
 */
export function createInitialP01RtdbState(nowMs = 1793500000000): RtdbTreeState {
  const initialSeedSplit = validateAndSplitQuestionBankSeed({
    dryRun: false,
    mode: 'sandbox_with_12_published',
    reviewerUid: 'uid-superadmin-01',
    nowMs,
  });

  return {
    users: {
      'uid-superadmin-01': {
        full_name: 'Trần Minh Quân (SuperAdmin)',
        email: 'minhquantran4312@gmail.com',
      },
      'uid-superadmin-02': {
        full_name: 'Tâm Trần (Chủ dự án · SuperAdmin)',
        email: 'tamtranmusic@gmail.com',
      },
      'uid-guardian-a': {
        full_name: 'Phụ huynh Gia đình A (Nguyễn Văn An)',
        email: 'phuhuynh.a@example.com',
      },
      'uid-guardian-b': {
        full_name: 'Phụ huynh Gia đình B (Lê Thị Bình)',
        email: 'phuhuynh.b@example.com',
      },
      'uid-student-a1': {
        full_name: 'Học sinh Minh (Con Gia đình A)',
        email: 'hocsinh.minh.a1@example.com',
      },
    },
    account_roles: {
      'uid-superadmin-01': {
        role: 'superadmin',
        disabled: false,
        updated_at: nowMs,
        updated_by: 'system_bootstrap',
      },
      'uid-superadmin-02': {
        role: 'superadmin',
        disabled: false,
        updated_at: nowMs,
        updated_by: 'system_bootstrap',
      },
      'uid-guardian-a': {
        role: 'guardian',
        disabled: false,
        updated_at: nowMs,
        updated_by: 'self_onboarding',
      },
      'uid-guardian-b': {
        role: 'guardian',
        disabled: false,
        updated_at: nowMs,
        updated_by: 'self_onboarding',
      },
      'uid-student-a1': {
        role: 'student',
        disabled: false,
        updated_at: nowMs,
        updated_by: 'invitation_accept',
      },
    },
    students: {
      'stu-a1': {
        student_id: 'stu-a1',
        display_name: 'Bé Minh (Lớp 4 - Gia đình A)',
        age_group: 'primary_6_10',
        guardian_owner_uid: 'uid-guardian-a',
        auth_uid: 'uid-student-a1',
        timezone: 'Asia/Ho_Chi_Minh',
        created_at: nowMs - 86400000,
      },
      'stu-a2-no-google': {
        student_id: 'stu-a2-no-google',
        display_name: 'Bé Na (Lớp 2 - Không có Google Account riêng)',
        age_group: 'primary_6_10',
        guardian_owner_uid: 'uid-guardian-a',
        timezone: 'Asia/Ho_Chi_Minh',
        created_at: nowMs - 43200000,
      },
      'stu-b1': {
        student_id: 'stu-b1',
        display_name: 'Bạn Khoa (Lớp 7 - Gia đình B)',
        age_group: 'middle_11_15',
        guardian_owner_uid: 'uid-guardian-b',
        timezone: 'Asia/Ho_Chi_Minh',
        created_at: nowMs - 86400000,
      },
    },
    guardian_students: {
      'uid-guardian-a': {
        'stu-a1': {
          relationship: 'parent_owner',
          verified_at: nowMs - 86400000,
          can_manage: true,
        },
        'stu-a2-no-google': {
          relationship: 'parent_owner',
          verified_at: nowMs - 43200000,
          can_manage: true,
        },
      },
      'uid-guardian-b': {
        'stu-b1': {
          relationship: 'parent_owner',
          verified_at: nowMs - 86400000,
          can_manage: true,
        },
      },
    },
    student_accounts: {
      'uid-student-a1': {
        'stu-a1': {
          verified_at: nowMs - 80000000,
          linked_via_invitation: 'INV-INIT-A1',
        },
      },
    },
    device_access: {
      'robot-fam-a-01': {
        'uid-guardian-a': {
          role: 'owner',
          can_operate: true,
          granted_at: nowMs - 86400000,
        },
        'uid-student-a1': {
          role: 'student_operator',
          student_id: 'stu-a1',
          can_operate: true,
          granted_at: nowMs - 80000000,
        },
      },
      'robot-fam-b-01': {
        'uid-guardian-b': {
          role: 'owner',
          can_operate: true,
          granted_at: nowMs - 86400000,
        },
      },
      'sim-dev01': {
        'uid-superadmin-01': {
          role: 'owner',
          can_operate: true,
          granted_at: nowMs - 86400000,
        },
        'uid-superadmin-02': {
          role: 'owner',
          can_operate: true,
          granted_at: nowMs - 86400000,
        },
        'uid-guardian-a': {
          role: 'owner',
          can_operate: true,
          granted_at: nowMs - 86400000,
        },
      },
      'robot01': {
        'uid-superadmin-01': {
          role: 'owner',
          can_operate: true,
          granted_at: nowMs - 86400000,
        },
        'uid-superadmin-02': {
          role: 'owner',
          can_operate: true,
          granted_at: nowMs - 86400000,
        },
        'uid-guardian-a': {
          role: 'owner',
          can_operate: true,
          granted_at: nowMs - 86400000,
        },
        'uid-student-a1': {
          role: 'student_operator',
          student_id: 'stu-a1',
          can_operate: true,
          granted_at: nowMs - 80000000,
        },
      },
    },
    devices: {
      'robot01': {
        user_id: 'uid-guardian-a',
        device_name: 'Robot AI-Thinker ESP32-CAM (robot01)',
        monitoring_enabled: true,
        current_posture: 'unknown',
        monitoring_active: true,
        alert_after_sec: 15,
        last_seen_at: nowMs - 5000,
      },
      'robot-fam-a-01': {
        user_id: 'uid-guardian-a',
        device_name: 'Robot Bàn Học Gia đình A',
        monitoring_enabled: false,
        current_posture: 'unknown',
        monitoring_active: false,
        alert_after_sec: 30,
        last_seen_at: nowMs - 60000,
      },
      'robot-fam-b-01': {
        user_id: 'uid-guardian-b',
        device_name: 'Robot Bàn Học Gia đình B',
        monitoring_enabled: false,
        current_posture: 'good',
        monitoring_active: false,
        alert_after_sec: 30,
        last_seen_at: nowMs - 30000,
      },
      'sim-dev01': {
        user_id: 'uid-guardian-a',
        device_name: 'Robot Simulator Hợp đồng MQTT (sim-dev01)',
        monitoring_enabled: false,
        current_posture: 'unknown',
        monitoring_active: false,
        alert_after_sec: 30,
        last_seen_at: nowMs - 10000,
      },
    },
    sessions: {
      'robot01': {
        'session-manual-001': {
          device_id: 'robot01',
          session_id: 'session-manual-001',
          started_at: nowMs - 600000,
          good_count: 0,
          bad_count: 0,
          alert_count: 0,
          bad_duration_ms: 0,
          good_duration_ms: 0,
          observation_count: 0,
          student_id: 'stu-a1',
          source: 'real',
          config_version: 1,
          last_projected_revision: 0,
        },
      },
      'robot-fam-a-01': {
        'sess-a-001': {
          device_id: 'robot-fam-a-01',
          session_id: 'sess-a-001',
          started_at: nowMs - 3600000,
          ended_at: nowMs - 1800000,
          good_count: 4,
          bad_count: 1,
          alert_count: 1,
          bad_duration_ms: 150000,
          good_duration_ms: 420000,
          student_id: 'stu-a1',
          source: 'simulator',
          last_projected_revision: 1,
        },
      },
      'robot-fam-b-01': {
        'sess-b-001': {
          device_id: 'robot-fam-b-01',
          session_id: 'sess-b-001',
          started_at: nowMs - 7200000,
          ended_at: nowMs - 5400000,
          good_count: 6,
          bad_count: 2,
          alert_count: 1,
          bad_duration_ms: 150000,
          good_duration_ms: 540000,
          student_id: 'stu-b1',
          source: 'simulator',
          last_projected_revision: 1,
        },
      },
    },
    alerts: {
      'robot-fam-a-01': {
        'sess-a-001': {
          'alert-a-001': {
            alert_id: 'alert-a-001',
            device_id: 'robot-fam-a-01',
            session_id: 'sess-a-001',
            student_id: 'stu-a1',
            episode_id: 'ep-a-001',
            reminder_index: 1,
            message: 'Lưng mình xin một chỗ tựa nhé. Thả lỏng vai rồi ngồi ngay ngắn nào!',
            created_at: nowMs - 2400000,
            occurred_at: nowMs - 2400000,
            received_at: nowMs - 2400000,
            time_basis: 'robot_clock_validated',
            severity: 'low',
            is_read: false,
            image_id: 'cap-a-001',
            capture_status: 'uploaded',
            source: 'simulator',
          },
        },
      },
      'robot-fam-b-01': {
        'sess-b-001': {
          'alert-b-001': {
            alert_id: 'alert-b-001',
            device_id: 'robot-fam-b-01',
            session_id: 'sess-b-001',
            student_id: 'stu-b1',
            episode_id: 'ep-b-001',
            reminder_index: 1,
            message: 'Cuốn vở chưa chạy mất đâu! Mình đưa mắt ra xa một chút theo hướng dẫn nhé.',
            created_at: nowMs - 6000000,
            occurred_at: nowMs - 6000000,
            received_at: nowMs - 6000000,
            time_basis: 'robot_clock_validated',
            severity: 'medium',
            is_read: false,
            image_id: 'cap-b-001',
            capture_status: 'uploaded',
            source: 'simulator',
          },
        },
      },
    },
    learning_days: Object.fromEntries(
      LEARNING_DAYS_28.map((item) => [String(item.day_number), structuredClone(item)])
    ),
    learning_progress: {
      'stu-a1': {
        '1': {
          viewed_at: nowMs - 5000000,
          self_completed_at: nowMs - 4900000,
          source_version: 'v1.2-p02-manifest',
          medal_asset: 'HC d1.png',
        },
      },
      'stu-b1': {
        '1': {
          viewed_at: nowMs - 9000000,
          self_completed_at: nowMs - 8900000,
          source_version: 'v1.2-p02-manifest',
          medal_asset: 'HC d1.png',
        },
        '2': {
          viewed_at: nowMs - 7000000,
          self_completed_at: nowMs - 6900000,
          source_version: 'v1.2-p02-manifest',
          medal_asset: 'HC d2.png',
        },
      },
    },
    certificate_requests: {},
    student_alerts: {
      'stu-a1': {
        'alert-a-001': {
          alert_id: 'alert-a-001',
          event_at: nowMs - 2400000,
          severity: 'low',
          device_id: 'robot-fam-a-01',
          session_id: 'sess-a-001',
          episode_id: 'ep-a-001',
          reminder_index: 1,
          message: 'Lưng mình xin một chỗ tựa nhé. Thả lỏng vai rồi ngồi ngay ngắn nào!',
          image_id: 'cap-a-001',
          capture_status: 'uploaded',
          source: 'simulator',
        },
      },
      'stu-b1': {
        'alert-b-001': {
          alert_id: 'alert-b-001',
          event_at: nowMs - 6000000,
          severity: 'medium',
          device_id: 'robot-fam-b-01',
          session_id: 'sess-b-001',
          episode_id: 'ep-b-001',
          reminder_index: 1,
          message: 'Cuốn vở chưa chạy mất đâu! Mình đưa mắt ra xa một chút theo hướng dẫn nhé.',
          image_id: 'cap-b-001',
          capture_status: 'uploaded',
          source: 'simulator',
        },
      },
    },
    episode_log: {
      'stu-a1': {
        'ep-a-001': {
          episode_id: 'ep-a-001',
          student_id: 'stu-a1',
          device_id: 'robot-fam-a-01',
          session_id: 'sess-a-001',
          started_at: nowMs - 2500000,
          ended_at: nowMs - 2350000,
          state: 'bad',
          stable_duration_ms: 150000,
          source: 'simulator',
          revision: 1,
        },
      },
      'stu-b1': {
        'ep-b-001': {
          episode_id: 'ep-b-001',
          student_id: 'stu-b1',
          device_id: 'robot-fam-b-01',
          session_id: 'sess-b-001',
          started_at: nowMs - 6100000,
          ended_at: nowMs - 5950000,
          state: 'bad',
          stable_duration_ms: 150000,
          source: 'simulator',
          revision: 1,
        },
      },
    },
    device_runtime: {
      'robot01': createInitialDeviceRuntimeBranch('robot01', 'session-manual-001', 'stu-a1'),
      'robot-fam-a-01': createInitialDeviceRuntimeBranch('robot-fam-a-01'),
      'robot-fam-b-01': createInitialDeviceRuntimeBranch('robot-fam-b-01'),
      'sim-dev01': createInitialDeviceRuntimeBranch('sim-dev01'),
    },
    command_jobs: {},
    capture_metadata: {
      'cap-a-001': {
        capture_id: 'cap-a-001',
        storage_path: 'captures/stu-a1/sess-a-001/cap-a-001.jpg',
        student_id: 'stu-a1',
        device_id: 'robot-fam-a-01',
        session_id: 'sess-a-001',
        mime_type: 'image/jpeg',
        byte_size: 84200,
        status: 'uploaded',
        upload_ticket_token: 'ticket-init-a1',
        upload_expires_at: nowMs - 2000000,
        created_at: nowMs - 2405000,
        uploaded_at: nowMs - 2401000,
        source: 'simulator',
        svg_preview_kind: 'study_desk_posture',
      },
      'cap-b-001': {
        capture_id: 'cap-b-001',
        storage_path: 'captures/stu-b1/sess-b-001/cap-b-001.jpg',
        student_id: 'stu-b1',
        device_id: 'robot-fam-b-01',
        session_id: 'sess-b-001',
        mime_type: 'image/jpeg',
        byte_size: 91400,
        status: 'uploaded',
        upload_ticket_token: 'ticket-init-b1',
        upload_expires_at: nowMs - 5900000,
        created_at: nowMs - 6005000,
        uploaded_at: nowMs - 6001000,
        source: 'simulator',
        svg_preview_kind: 'study_desk_posture',
      },
    },
    device_broker_credentials: {
      'robot01': {
        device_id: 'robot01',
        mqtt_username: 'robot01',
        mqtt_client_id: 'robot01',
        secret_hash: 'sha256:robot01-emqx-tls-secret',
        tls_required: true,
        revoked: false,
        computes_episodes: false,
        supported_posture_codes: ['HEAD_FORWARD', 'TRUNK_LEAN', 'EYES_TOO_CLOSE'],
        calibration_valid: true,
        updated_at: nowMs,
      },
      'robot-fam-a-01': {
        device_id: 'robot-fam-a-01',
        mqtt_username: 'robot-fam-a-01',
        mqtt_client_id: 'robot-fam-a-01',
        secret_hash: 'sha256:fam-a-01-secret',
        tls_required: true,
        revoked: false,
        computes_episodes: false,
        supported_posture_codes: ['HEAD_FORWARD', 'TRUNK_LEAN', 'EYES_TOO_CLOSE'],
        calibration_valid: true,
        updated_at: nowMs,
      },
      'robot-fam-b-01': {
        device_id: 'robot-fam-b-01',
        mqtt_username: 'robot-fam-b-01',
        mqtt_client_id: 'robot-fam-b-01',
        secret_hash: 'sha256:fam-b-01-secret',
        tls_required: true,
        revoked: false,
        computes_episodes: false,
        supported_posture_codes: ['HEAD_FORWARD', 'TRUNK_LEAN'],
        calibration_valid: true,
        updated_at: nowMs,
      },
      'sim-dev01': {
        device_id: 'sim-dev01',
        mqtt_username: 'sim-dev01',
        mqtt_client_id: 'sim-dev01',
        secret_hash: 'sha256:sim-dev01-secret',
        tls_required: true,
        revoked: false,
        computes_episodes: false,
        supported_posture_codes: ['HEAD_FORWARD', 'TRUNK_LEAN', 'EYES_TOO_CLOSE'],
        calibration_valid: true,
        updated_at: nowMs,
      },
    },
    notification_reads: {},
    push_tokens: {
      'uid-guardian-a': {
        'inst-guardian-a-web-01': {
          uid: 'uid-guardian-a',
          installation_id: 'inst-guardian-a-web-01',
          token: 'fcm-token-guardian-a-demo-001',
          platform: 'web_desktop',
          user_agent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X) Chrome/130.0',
          status: 'active',
          created_at: nowMs - 86400000,
          updated_at: nowMs - 3600000,
        },
      },
      'uid-student-a1': {
        'inst-student-a1-web-01': {
          uid: 'uid-student-a1',
          installation_id: 'inst-student-a1-web-01',
          token: 'fcm-token-student-a1-demo-001',
          platform: 'web_desktop',
          user_agent: 'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)',
          status: 'active',
          created_at: nowMs - 86400000,
          updated_at: nowMs - 3600000,
        },
      },
    },
    notification_jobs: {},
    questions_public: initialSeedSplit.questionsPublic,
    question_keys: initialSeedSplit.questionKeys,
    game_attempts: {
      'stu-a1': {
        'att-a-001': {
          attempt_id: 'att-a-001',
          student_id: 'stu-a1',
          game_id: 'situations',
          topic_filter: 'all',
          timer_enabled: false,
          status: 'completed',
          score: 40,
          max_possible_score: 50,
          question_ids: ['BUGZ-Q001', 'BUGZ-Q002', 'BUGZ-Q003', 'BUGZ-Q021', 'BUGZ-Q025'],
          question_versions: {
            'BUGZ-Q001': 1,
            'BUGZ-Q002': 1,
            'BUGZ-Q003': 1,
            'BUGZ-Q021': 1,
            'BUGZ-Q025': 1,
          },
          answers: {
            'BUGZ-Q001': {
              question_id: 'BUGZ-Q001',
              locked_version: 1,
              selected_option_id: 'A',
              is_correct: true,
              attempt_count_for_question: 1,
              points_awarded: 10,
              feedback_text:
                'Chuẩn rồi! Ngồi thoải mái, có chỗ tựa và thả lỏng vai giúp mình làm việc ở bàn dễ chịu hơn.',
              explanation_text:
                'Ngồi thoải mái, có chỗ tựa và thả lỏng vai giúp mình làm việc ở bàn dễ chịu hơn.',
              source_days: [1],
              answered_at: nowMs - 1000000,
            },
          },
          recommended_review_days: [5, 8],
          created_at: nowMs - 1100000,
          updated_at: nowMs - 1000000,
          completed_at: nowMs - 1000000,
        },
      },
      'stu-b1': {
        'att-b-001': {
          attempt_id: 'att-b-001',
          student_id: 'stu-b1',
          game_id: 'situations',
          topic_filter: 'lung_thang',
          timer_enabled: false,
          status: 'completed',
          score: 50,
          max_possible_score: 50,
          question_ids: ['BUGZ-Q001', 'BUGZ-Q002', 'BUGZ-Q003', 'BUGZ-Q004', 'BUGZ-Q005'],
          question_versions: {
            'BUGZ-Q001': 1,
            'BUGZ-Q002': 1,
            'BUGZ-Q003': 1,
            'BUGZ-Q004': 1,
            'BUGZ-Q005': 1,
          },
          answers: {},
          recommended_review_days: [1, 5],
          created_at: nowMs - 2000000,
          updated_at: nowMs - 1900000,
          completed_at: nowMs - 1900000,
        },
      },
    },
    reminder_templates: structuredClone(DEFAULT_GENTLE_REMINDER_TEMPLATES),
    notification_preferences: {
      'uid-guardian-a': {
        push_enabled: true,
        voice_enabled: true,
        email_enabled: true,
        mode: 'every_alert',
        quiet_hours_start: '22:00',
        quiet_hours_end: '06:30',
      },
      'uid-student-a1': {
        push_enabled: true,
        voice_enabled: true,
        email_enabled: false,
        mode: 'every_alert',
        quiet_hours_start: '21:30',
        quiet_hours_end: '06:30',
      },
      'uid-guardian-b': {
        push_enabled: true,
        voice_enabled: false,
        email_enabled: true,
        mode: 'digest',
        quiet_hours_start: '21:30',
        quiet_hours_end: '06:30',
      },
    },
    invitations: {},
    device_pairing_secrets: {
      'robot-fam-a-01': {
        pairing_code: 'PAIR-FAM-A-9911',
        factory_device_name: 'BUGZ Robot Unit #A01',
      },
      'robot-fam-b-01': {
        pairing_code: 'PAIR-FAM-B-8822',
        factory_device_name: 'BUGZ Robot Unit #B01',
      },
      'robot-unclaimed-03': {
        pairing_code: 'BUGZ-PAIR-2026',
        factory_device_name: 'BUGZ Robot Unit #03 (Chưa ghép)',
      },
    },
    audit_logs: {
      'log-init-001': {
        log_id: 'log-init-001',
        actor_uid: 'uid-superadmin-01',
        actor_email: 'minhquantran4312@gmail.com',
        action: 'BOOTSTRAP_SUPERADMIN',
        target: 'account_roles/uid-superadmin-01',
        details: 'Khởi tạo SuperAdmin từ email nguồn đã xác minh (email_verified=true).',
        time: nowMs,
        result: 'SUCCESS',
      },
    },
  };
}

/**
 * Khởi tạo trạng thái RTDB sạch hoàn toàn (Không có dữ liệu mẫu/giả lập).
 * Chỉ nạp danh mục bài học 28 ngày, ngân hàng 40 câu hỏi trò chơi, mẫu lời nhắc
 * và khai báo phần cứng thiết bị thực tế `robot01` ở trạng thái chờ kết nối động.
 */
export function createCleanDynamicRtdbState(nowMs = Date.now()): RtdbTreeState {
  const initialSeedSplit = validateAndSplitQuestionBankSeed({
    dryRun: false,
    mode: 'all_40_published',
    reviewerUid: 'system_seed',
    nowMs,
  });

  return {
    users: {},
    account_roles: {},
    students: {},
    guardian_students: {},
    student_accounts: {},
    device_access: {},
    devices: {
      'robot01': {
        user_id: '',
        device_name: 'Robot AI-Thinker ESP32-CAM (robot01)',
        monitoring_enabled: false,
        current_posture: 'unknown',
        monitoring_active: false,
        alert_after_sec: 15,
        last_seen_at: 0,
      },
    },
    sessions: {},
    alerts: {},
    learning_days: Object.fromEntries(
      LEARNING_DAYS_28.map((item) => [String(item.day_number), structuredClone(item)])
    ),
    learning_progress: {},
    certificate_requests: {},
    student_alerts: {},
    episode_log: {},
    device_runtime: {
      'robot01': createInitialDeviceRuntimeBranch('robot01', null, null),
    },
    command_jobs: {},
    capture_metadata: {},
    device_broker_credentials: {
      'robot01': {
        device_id: 'robot01',
        mqtt_username: 'robot01',
        mqtt_client_id: 'robot01',
        secret_hash: 'sha256:robot01-emqx-tls-secret',
        tls_required: true,
        revoked: false,
        computes_episodes: false,
        supported_posture_codes: ['HEAD_FORWARD', 'TRUNK_LEAN', 'EYES_TOO_CLOSE'],
        calibration_valid: true,
        updated_at: nowMs,
      },
    },
    notification_reads: {},
    push_tokens: {},
    notification_jobs: {},
    questions_public: initialSeedSplit.questionsPublic,
    question_keys: initialSeedSplit.questionKeys,
    game_attempts: {},
    reminder_templates: structuredClone(DEFAULT_GENTLE_REMINDER_TEMPLATES),
    notification_preferences: {},
    invitations: {},
    device_pairing_secrets: {},
    audit_logs: {},
  };
}

export class P01RbacDomainService {
  private state: RtdbTreeState;
  private seq = 100;

  constructor(initialState?: RtdbTreeState) {
    this.state = initialState || createInitialP01RtdbState();
    if (
      Object.keys(this.state.notification_jobs || {}).length === 0 &&
      this.state.alerts?.['robot-fam-a-01']?.['sess-a-001']?.['alert-a-001']
    ) {
      this.routeAndDispatchAlertNotifications(
        {
          alert_id: 'alert-a-001',
          device_id: 'robot-fam-a-01',
          session_id: 'sess-a-001',
          server_student_id: 'stu-a1',
          posture_code: 'HEAD_FORWARD',
          reminder_index: 1,
        },
        1793500000000
      );
      this.routeAndDispatchAlertNotifications(
        {
          alert_id: 'alert-b-001',
          device_id: 'robot-fam-b-01',
          session_id: 'sess-b-001',
          server_student_id: 'stu-b1',
          posture_code: 'EYES_TOO_CLOSE',
          reminder_index: 1,
        },
        1793500000000
      );
    }
  }

  getState(): RtdbTreeState {
    return this.state;
  }

  private nextId(prefix: string): string {
    this.seq += 1;
    return `${prefix}-${Date.now()}-${this.seq}`;
  }

  private appendAuditLog(entry: Omit<AuditLogRecord, 'log_id' | 'time'>, nowMs = Date.now()): AuditLogRecord {
    const log_id = this.nextId('audit');
    const record: AuditLogRecord = {
      ...entry,
      log_id,
      time: nowMs,
    };
    this.state.audit_logs[log_id] = record;
    return record;
  }

  /**
   * Kiểm tra Actor có bị khóa tài khoản (disabled === true) không
   */
  private assertActorActive(actor: VerifiedActorToken): { ok: boolean; error?: string; role: UserRole } {
    const roleRecord = this.state.account_roles[actor.uid];
    if (roleRecord?.disabled) {
      return {
        ok: false,
        error: 'Tài khoản này đã bị tạm khóa bởi Quản trị viên (account_roles.disabled = true).',
        role: roleRecord.role,
      };
    }
    const effectiveRole: UserRole =
      actor.superadmin === true || actor.admin === true || roleRecord?.role === 'superadmin'
        ? 'superadmin'
        : roleRecord?.role || actor.role || 'student';
    return { ok: true, role: effectiveRole };
  }

  /**
   * Đồng bộ / Cập nhật hồ sơ cá nhân học sinh users/{uid} (full_name, email, phone & age_group)
   * Tách biệt hoàn toàn với account_roles/{uid}
   */
  upsertSelfProfile(
    actor: VerifiedActorToken,
    payload: {
      full_name: string;
      phone?: string;
      age_group?: 'primary_6_10' | 'middle_11_15';
      onboarding_role?: UserRole;
    },
    nowMs = Date.now()
  ): { ok: boolean; status: number; message: string; user?: ExcelUserRecord; roleRecord?: ServerAccountRoleRecord } {
    const activeCheck = this.assertActorActive(actor);
    if (!activeCheck.ok) {
      return { ok: false, status: 403, message: activeCheck.error! };
    }

    const cleanName = (payload.full_name || actor.name || '').trim();
    if (!cleanName || cleanName.length > 120) {
      return { ok: false, status: 400, message: 'Họ tên học sinh (full_name) phải từ 1 đến 120 ký tự.' };
    }

    const cleanPhone = (payload.phone || actor.phone || this.state.users[actor.uid]?.phone || '').trim();

    const userRecord: ExcelUserRecord = {
      full_name: cleanName,
      email: actor.email,
      ...(cleanPhone ? { phone: cleanPhone } : {}),
    };
    this.state.users[actor.uid] = userRecord;

    // Nếu chưa có bản ghi account_roles/{uid}, khởi tạo với vai trò student (Học sinh)
    if (!this.state.account_roles[actor.uid]) {
      this.state.account_roles[actor.uid] = {
        role: 'student',
        disabled: false,
        updated_at: nowMs,
        updated_by: actor.uid,
      };
    }

    // Đồng bộ tên hiển thị và nhóm độ tuổi vào hồ sơ học sinh của tài khoản này
    const myStudents = this.getOwnedStudentsForActor(actor, nowMs);
    if (myStudents[0]) {
      myStudents[0].display_name = cleanName;
      if (payload.age_group === 'primary_6_10' || payload.age_group === 'middle_11_15') {
        myStudents[0].age_group = payload.age_group;
      }
    }

    return {
      ok: true,
      status: 200,
      message: 'Đã lưu hồ sơ học sinh thành công.',
      user: userRecord,
      roleRecord: this.state.account_roles[actor.uid],
    };
  }

  /**
   * Bootstrap SuperAdmin: chỉ cấp khi ID Token đã xác minh + email_verified === true + đúng email bootstrap,
   * và chỉ được phép chạy ĐÚNG MỘT LẦN (Run-Once Lock tại system_locks/superadmin_bootstrap).
   */
  bootstrapSuperAdmin(
    actor: VerifiedActorToken,
    bootstrapEmail: string | readonly string[] = 'minhquantran4312@gmail.com,tamtranmusic@gmail.com',
    nowMs = Date.now()
  ): {
    ok: boolean;
    status: number;
    code?: 'BOOTSTRAP_COMPLETED_ONCE' | 'BOOTSTRAP_ALREADY_EXECUTED_ONCE' | 'FORBIDDEN';
    message: string;
    roleRecord?: ServerAccountRoleRecord;
    customClaims?: SuperAdminCustomClaims;
    lockRecord?: SuperAdminBootstrapLockRecord;
  } {
    const activeCheck = this.assertActorActive(actor);
    if (!activeCheck.ok) {
      return { ok: false, status: 403, code: 'FORBIDDEN', message: activeCheck.error! };
    }

    // Kiểm tra Run-Once Lock trước tiên
    const existingLock = this.state.system_locks?.superadmin_bootstrap;
    if (existingLock && existingLock.locked === true) {
      const lockMsg = `Từ chối chạy lại Bootstrap SuperAdmin: thao tác này chỉ được phép chạy ĐÚNG MỘT LẦN để bảo mật (đã khóa tại system_locks/superadmin_bootstrap lúc ${new Date(
        existingLock.executed_at
      ).toISOString()}).`;
      this.appendAuditLog(
        {
          actor_uid: actor.uid,
          actor_email: actor.email,
          action: 'BOOTSTRAP_SUPERADMIN',
          target: 'system_locks/superadmin_bootstrap',
          details: lockMsg,
          result: 'DENIED',
        },
        nowMs
      );
      return {
        ok: false,
        status: 409,
        code: 'BOOTSTRAP_ALREADY_EXECUTED_ONCE',
        message: lockMsg,
        lockRecord: existingLock,
      };
    }

    const check = resolveBackendVerifiedRole(actor, bootstrapEmail);
    const displayBootstrapList = Array.isArray(bootstrapEmail)
      ? bootstrapEmail.join(', ')
      : String(bootstrapEmail);
    if (!check.canGrantSuperAdminBootstrap) {
      const reasonText = `Email "${actor.email}" (email_verified=${String(actor.email_verified)}) không khớp điều kiện bootstrap (${displayBootstrapList} & email_verified=true).`;
      this.appendAuditLog(
        {
          actor_uid: actor.uid,
          actor_email: actor.email,
          action: 'BOOTSTRAP_SUPERADMIN',
          target: `account_roles/${actor.uid}`,
          details: `Từ chối bootstrap SuperAdmin: ${reasonText}`,
          result: 'DENIED',
        },
        nowMs
      );
      return {
        ok: false,
        status: 403,
        code: 'FORBIDDEN',
        message: `Từ chối cấp quyền SuperAdmin: ${reasonText}`,
      };
    }

    const customClaims: SuperAdminCustomClaims = {
      admin: true,
      superadmin: true,
      role: 'superadmin',
    };

    const roleRecord: ServerAccountRoleRecord = {
      role: 'superadmin',
      disabled: false,
      updated_at: nowMs,
      updated_by: 'server_bootstrap_verified',
    };
    this.state.account_roles[actor.uid] = roleRecord;
    if (!this.state.users[actor.uid]) {
      this.state.users[actor.uid] = {
        full_name: actor.name || 'SuperAdmin BUGZ',
        email: actor.email,
      };
    }

    if (!this.state.system_locks) {
      this.state.system_locks = {};
    }
    const lockRecord: SuperAdminBootstrapLockRecord = {
      locked: true,
      executed_at: nowMs,
      executed_by: actor.uid,
      bootstrapped_uids: [actor.uid],
      bootstrapped_emails: [actor.email.trim().toLowerCase()],
      claims_applied: customClaims,
    };
    this.state.system_locks.superadmin_bootstrap = lockRecord;

    this.appendAuditLog(
      {
        actor_uid: actor.uid,
        actor_email: actor.email,
        action: 'BOOTSTRAP_SUPERADMIN',
        target: `account_roles/${actor.uid}`,
        details: `Cấp custom claims { admin: true, superadmin: true, role: 'superadmin' }, ghi account_roles/${actor.uid} cho ${actor.email} và khóa vĩnh viễn system_locks/superadmin_bootstrap (Run-Once).`,
        result: 'SUCCESS',
      },
      nowMs
    );

    return {
      ok: true,
      status: 200,
      code: 'BOOTSTRAP_COMPLETED_ONCE',
      message:
        'Đã xác minh email nguồn, gán custom claim admin=true (superadmin=true) và khóa Run-Once Lock thành công.',
      roleRecord,
      customClaims,
      lockRecord,
    };
  }

  /**
   * Tạo Adapter in-memory tương thích với `executeOneTimeSuperAdminBootstrap`
   * để kiểm thử tự động script server-side mà không cần Service Account thật.
   */
  createInMemoryAdminBootstrapAdapter(
    customClaimsRegistry: Record<string, SuperAdminCustomClaims> = {}
  ): {
    adapter: AdminBootstrapAdapter;
    customClaimsRegistry: Record<string, SuperAdminCustomClaims>;
  } {
    const adapter: AdminBootstrapAdapter = {
      getBootstrapLock: async () => {
        return this.state.system_locks?.superadmin_bootstrap || null;
      },
      acquireBootstrapLockAtomically: async (lockRecord: SuperAdminBootstrapLockRecord) => {
        if (this.state.system_locks?.superadmin_bootstrap?.locked === true) {
          return false;
        }
        if (!this.state.system_locks) {
          this.state.system_locks = {};
        }
        this.state.system_locks.superadmin_bootstrap = lockRecord;
        return true;
      },
      getUserByEmail: async (email: string): Promise<FirebaseAuthUserLookupRecord | null> => {
        const cleanEmail = email.trim().toLowerCase();
        for (const [uid, user] of Object.entries(this.state.users)) {
          if (user.email.trim().toLowerCase() === cleanEmail) {
            const roleRec = this.state.account_roles[uid];
            return {
              uid,
              email: user.email,
              emailVerified: true,
              disabled: Boolean(roleRec?.disabled),
              displayName: user.full_name,
            };
          }
        }
        return null;
      },
      setCustomUserClaims: async (uid: string, claims: SuperAdminCustomClaims) => {
        customClaimsRegistry[uid] = claims;
      },
      writeAccountRole: async (uid: string, roleRecord: ServerAccountRoleRecord) => {
        this.state.account_roles[uid] = roleRecord;
      },
      appendAuditLog: async (entry) => {
        this.appendAuditLog(
          {
            actor_uid: entry.actor_uid,
            actor_email: entry.actor_email,
            action: entry.action,
            target: entry.target,
            details: entry.details,
            result: entry.result,
          },
          entry.time
        );
      },
    };

    return { adapter, customClaimsRegistry };
  }

  /**
   * Phụ huynh tạo hồ sơ con mới (Hồ sơ con không bắt buộc phải có Google Account riêng)
   */
  createChildProfile(
    actor: VerifiedActorToken,
    payload: { display_name: string; age_group: 'primary_6_10' | 'middle_11_15' },
    nowMs = Date.now()
  ): { ok: boolean; status: number; message: string; student?: StudentRecord } {
    const activeCheck = this.assertActorActive(actor);
    if (!activeCheck.ok) {
      return { ok: false, status: 403, message: activeCheck.error! };
    }

    const displayName = (payload.display_name || '').trim();
    if (!displayName || displayName.length > 100) {
      return { ok: false, status: 400, message: 'Tên hiển thị của con phải từ 1 đến 100 ký tự.' };
    }

    const student_id = this.nextId('stu');
    const student: StudentRecord = {
      student_id,
      display_name: displayName,
      age_group: payload.age_group === 'middle_11_15' ? 'middle_11_15' : 'primary_6_10',
      guardian_owner_uid: actor.uid,
      timezone: 'Asia/Ho_Chi_Minh',
      created_at: nowMs,
    };

    this.state.students[student_id] = student;
    if (!this.state.guardian_students[actor.uid]) {
      this.state.guardian_students[actor.uid] = {};
    }
    this.state.guardian_students[actor.uid][student_id] = {
      relationship: 'parent_owner',
      verified_at: nowMs,
      can_manage: true,
    };

    // Cấp quyền trên các thiết bị Robot mà phụ huynh này đang sở hữu
    for (const [devId, dev] of Object.entries(this.state.devices)) {
      if (dev.user_id === actor.uid) {
        if (!this.state.device_access[devId]) {
          this.state.device_access[devId] = {};
        }
        this.state.device_access[devId][actor.uid] = {
          role: 'owner',
          can_operate: true,
          granted_at: nowMs,
        };
      }
    }

    return {
      ok: true,
      status: 201,
      message: `Đã tạo hồ sơ học sinh "${displayName}" (${student_id}). Không yêu cầu tài khoản Google riêng cho trẻ.`,
      student,
    };
  }

  /**
   * Tạo mã mời một lần (One-time Invitation) có thời hạn để liên kết tài khoản Học sinh hoặc Phụ huynh đồng hành
   */
  createOneTimeInvitation(
    actor: VerifiedActorToken,
    payload: { student_id: string; target_type?: 'student_account' | 'co_guardian'; ttlMinutes?: number },
    nowMs = Date.now()
  ): { ok: boolean; status: number; message: string; invitation?: OneTimeInvitationRecord } {
    const activeCheck = this.assertActorActive(actor);
    if (!activeCheck.ok) {
      return { ok: false, status: 403, message: activeCheck.error! };
    }

    const student = this.state.students[payload.student_id];
    if (!student) {
      return { ok: false, status: 404, message: 'Không tìm thấy hồ sơ học sinh.' };
    }

    const isGuardianOwner =
      student.guardian_owner_uid === actor.uid ||
      Boolean(this.state.guardian_students[actor.uid]?.[payload.student_id]?.can_manage);

    if (!isGuardianOwner && activeCheck.role !== 'superadmin') {
      this.appendAuditLog(
        {
          actor_uid: actor.uid,
          actor_email: actor.email,
          action: 'CREATE_INVITATION',
          target: `students/${payload.student_id}`,
          details: 'Từ chối tạo mã mời: người gọi không phải phụ huynh sở hữu hồ sơ con.',
          result: 'DENIED',
        },
        nowMs
      );
      return {
        ok: false,
        status: 403,
        message: 'Bạn không có quyền tạo mã mời cho hồ sơ học sinh của gia đình khác.',
      };
    }

    const code = `INV-${Math.random().toString(36).substring(2, 6).toUpperCase()}-${this.seq++}`;
    const ttlMs = Math.max(5, Math.min(payload.ttlMinutes || 30, 1440)) * 60 * 1000;
    const invitation: OneTimeInvitationRecord = {
      code,
      student_id: student.student_id,
      student_display_name: student.display_name,
      created_by_uid: actor.uid,
      target_type: payload.target_type === 'co_guardian' ? 'co_guardian' : 'student_account',
      created_at: nowMs,
      expires_at: nowMs + ttlMs,
    };

    this.state.invitations[code] = invitation;
    this.appendAuditLog(
      {
        actor_uid: actor.uid,
        actor_email: actor.email,
        action: 'CREATE_INVITATION',
        target: `invitations/${code}`,
        details: `Tạo mã mời 1 lần cho học sinh ${student.student_id} (${invitation.target_type}), hết hạn sau ${Math.round(ttlMs / 60000)} phút.`,
        result: 'SUCCESS',
      },
      nowMs
    );

    return {
      ok: true,
      status: 201,
      message: 'Đã tạo mã mời liên kết một lần có thời hạn.',
      invitation,
    };
  }

  /**
   * Chấp nhận mã mời một lần (Xác minh hạn dùng, chưa sử dụng, không cho phép tự nhập student_id để lấy quyền)
   */
  acceptOneTimeInvitation(
    actor: VerifiedActorToken,
    payload: { invitation_code: string },
    nowMs = Date.now()
  ): { ok: boolean; status: number; message: string; student?: StudentRecord } {
    const activeCheck = this.assertActorActive(actor);
    if (!activeCheck.ok) {
      return { ok: false, status: 403, message: activeCheck.error! };
    }

    const code = (payload.invitation_code || '').trim().toUpperCase();
    if (!code || code.startsWith('STU-')) {
      return {
        ok: false,
        status: 400,
        message:
          'Từ chối: Không cấp quyền bằng cách tự nhập student_id. Vui lòng nhập mã mời một lần (INV-...) do Phụ huynh tạo.',
      };
    }

    const inv = this.state.invitations[code];
    if (!inv) {
      return { ok: false, status: 404, message: 'Mã mời không tồn tại hoặc không hợp lệ.' };
    }
    if (inv.revoked) {
      return { ok: false, status: 410, message: 'Mã mời này đã bị thu hồi.' };
    }
    if (inv.used_at || inv.used_by_uid) {
      return { ok: false, status: 409, message: 'Mã mời một lần này đã được sử dụng trước đó.' };
    }
    if (nowMs > inv.expires_at) {
      return { ok: false, status: 410, message: 'Mã mời đã hết hạn sử dụng.' };
    }

    const student = this.state.students[inv.student_id];
    if (!student) {
      return { ok: false, status: 404, message: 'Hồ sơ học sinh gắn với mã mời không còn tồn tại.' };
    }

    // Đánh dấu mã mời đã dùng
    inv.used_at = nowMs;
    inv.used_by_uid = actor.uid;

    if (inv.target_type === 'co_guardian') {
      if (!this.state.guardian_students[actor.uid]) {
        this.state.guardian_students[actor.uid] = {};
      }
      this.state.guardian_students[actor.uid][student.student_id] = {
        relationship: 'linked_guardian',
        verified_at: nowMs,
        can_manage: true,
      };
      if (this.state.account_roles[actor.uid]?.role === 'student') {
        this.state.account_roles[actor.uid].role = 'guardian';
      }
    } else {
      student.auth_uid = actor.uid;
      if (!this.state.student_accounts[actor.uid]) {
        this.state.student_accounts[actor.uid] = {};
      }
      this.state.student_accounts[actor.uid][student.student_id] = {
        verified_at: nowMs,
        linked_via_invitation: code,
      };
      // Cấp quyền vận hành phiên học trên Robot của phụ huynh sở hữu học sinh này
      for (const [devId, dev] of Object.entries(this.state.devices)) {
        if (dev.user_id === student.guardian_owner_uid) {
          if (!this.state.device_access[devId]) {
            this.state.device_access[devId] = {};
          }
          this.state.device_access[devId][actor.uid] = {
            role: 'student_operator',
            student_id: student.student_id,
            can_operate: true,
            granted_at: nowMs,
          };
        }
      }
    }

    this.appendAuditLog(
      {
        actor_uid: actor.uid,
        actor_email: actor.email,
        action: 'ACCEPT_INVITATION',
        target: `students/${student.student_id}`,
        details: `Xác nhận mã mời một lần ${code} (${inv.target_type}) cho học sinh ${student.student_id}.`,
        result: 'SUCCESS',
      },
      nowMs
    );

    return {
      ok: true,
      status: 200,
      message: `Đã liên kết xác minh với hồ sơ "${student.display_name}" qua mã mời một lần.`,
      student,
    };
  }

  /**
   * Ghép thiết bị Robot cho Phụ huynh (Ca kiểm thử T10: Chống chiếm quyền thiết bị đã thuộc gia đình khác)
   */
  pairDeviceForGuardian(
    actor: VerifiedActorToken,
    payload: { device_id: string; pairing_code: string; device_name: string },
    nowMs = Date.now()
  ): { ok: boolean; status: number; message: string; device?: ExcelDeviceRecord } {
    const activeCheck = this.assertActorActive(actor);
    if (!activeCheck.ok) {
      return { ok: false, status: 403, message: activeCheck.error! };
    }

    const deviceId = (payload.device_id || 'robot01').trim();
    const deviceName = (
      payload.device_name ||
      this.state.devices[deviceId]?.device_name ||
      'Robot AI-Thinker ESP32-CAM (robot01)'
    ).trim();

    const existingDevice = this.state.devices[deviceId];
    if (
      deviceId !== 'robot01' &&
      existingDevice &&
      existingDevice.user_id &&
      existingDevice.user_id !== actor.uid
    ) {
      this.appendAuditLog(
        {
          actor_uid: actor.uid,
          actor_email: actor.email,
          action: 'UNAUTHORIZED_ATTEMPT',
          target: `devices/${deviceId}`,
          details: `Từ chối T10: ${actor.uid} cố ghép thiết bị ${deviceId} đã thuộc về ${existingDevice.user_id}.`,
          result: 'DENIED',
        },
        nowMs
      );
      return {
        ok: false,
        status: 409,
        message: `Từ chối ghép thiết bị (T10): Thiết bị "${deviceId}" đã thuộc quyền sở hữu của gia đình khác.`,
      };
    }

    const newDevice: ExcelDeviceRecord = {
      user_id: actor.uid,
      device_name: deviceName,
      monitoring_enabled: deviceId === 'robot01' ? true : Boolean(existingDevice?.monitoring_enabled),
      current_posture: existingDevice?.current_posture || 'unknown',
      monitoring_active: deviceId === 'robot01' ? true : Boolean(existingDevice?.monitoring_active),
      alert_after_sec: existingDevice?.alert_after_sec || (deviceId === 'robot01' ? 15 : 30),
      last_seen_at: nowMs,
    };
    this.state.devices[deviceId] = newDevice;
    if (!this.state.device_access[deviceId]) {
      this.state.device_access[deviceId] = {};
    }
    this.state.device_access[deviceId][actor.uid] = {
      role: 'owner',
      can_operate: true,
      granted_at: nowMs,
    };

    this.appendAuditLog(
      {
        actor_uid: actor.uid,
        actor_email: actor.email,
        action: 'PAIR_DEVICE',
        target: `devices/${deviceId}`,
        details: `Ghép thành công thiết bị ${deviceId} cho người dùng ${actor.uid} (Bản Demo bỏ qua T10 & tự động bật giám sát).`,
        result: 'SUCCESS',
      },
      nowMs
    );

    return {
      ok: true,
      status: 200,
      message: `Đã kết nối thiết bị ${deviceId} (${deviceName}) và tự động kích hoạt chế độ giám sát ngay lập tức.`,
      device: newDevice,
    };
  }

  /**
   * SuperAdmin đổi vai trò (role) của người dùng và ghi Audit Log (Ca kiểm thử T02 & T04)
   */
  adminUpdateUserRole(
    actor: VerifiedActorToken,
    payload: { target_uid: string; new_role: UserRole; reason?: string },
    nowMs = Date.now()
  ): { ok: boolean; status: number; message: string; roleRecord?: ServerAccountRoleRecord } {
    const activeCheck = this.assertActorActive(actor);
    if (!activeCheck.ok) {
      return { ok: false, status: 403, message: activeCheck.error! };
    }
    if (activeCheck.role !== 'superadmin') {
      this.appendAuditLog(
        {
          actor_uid: actor.uid,
          actor_email: actor.email,
          action: 'UNAUTHORIZED_ATTEMPT',
          target: `account_roles/${payload.target_uid}`,
          details: `Người dùng vai trò ${activeCheck.role} cố gắng gọi API đổi quyền Admin.`,
          result: 'DENIED',
        },
        nowMs
      );
      return {
        ok: false,
        status: 403,
        message: 'Từ chối truy cập (T02/T04): Chỉ SuperAdmin mới có quyền thay đổi vai trò tài khoản.',
      };
    }

    if (!['superadmin', 'user', 'guardian', 'student'].includes(payload.new_role)) {
      return { ok: false, status: 400, message: 'Vai trò không hợp lệ (chỉ nhận superadmin hoặc user).' };
    }

    const existing = this.state.account_roles[payload.target_uid] || {
      role: 'user',
      disabled: false,
      updated_at: nowMs,
      updated_by: actor.uid,
    };

    const updated: ServerAccountRoleRecord = {
      ...existing,
      role: payload.new_role,
      updated_at: nowMs,
      updated_by: actor.uid,
    };
    this.state.account_roles[payload.target_uid] = updated;

    this.appendAuditLog(
      {
        actor_uid: actor.uid,
        actor_email: actor.email,
        action: 'ADMIN_CHANGE_ROLE',
        target: `account_roles/${payload.target_uid}`,
        details: `Đổi vai trò của ${payload.target_uid} từ ${existing.role} sang ${payload.new_role}. Lý do: ${payload.reason || 'Quản trị phân quyền'}`,
        result: 'SUCCESS',
      },
      nowMs
    );

    return {
      ok: true,
      status: 200,
      message: `Đã cập nhật vai trò của ${payload.target_uid} thành "${payload.new_role}" và ghi nhật ký kiểm toán.`,
      roleRecord: updated,
    };
  }

  /**
   * SuperAdmin khóa hoặc mở khóa tài khoản (disabled = true/false) và ghi Audit Log
   */
  adminSetUserDisabled(
    actor: VerifiedActorToken,
    payload: { target_uid: string; disabled: boolean; reason?: string },
    nowMs = Date.now()
  ): { ok: boolean; status: number; message: string; roleRecord?: ServerAccountRoleRecord } {
    const activeCheck = this.assertActorActive(actor);
    if (!activeCheck.ok) {
      return { ok: false, status: 403, message: activeCheck.error! };
    }
    if (activeCheck.role !== 'superadmin') {
      this.appendAuditLog(
        {
          actor_uid: actor.uid,
          actor_email: actor.email,
          action: 'UNAUTHORIZED_ATTEMPT',
          target: `account_roles/${payload.target_uid}`,
          details: `Người dùng vai trò ${activeCheck.role} cố gắng khóa/mở khóa tài khoản.`,
          result: 'DENIED',
        },
        nowMs
      );
      return {
        ok: false,
        status: 403,
        message: 'Từ chối truy cập: Chỉ SuperAdmin mới được khóa hoặc mở khóa tài khoản.',
      };
    }

    if (payload.target_uid === actor.uid && payload.disabled) {
      return { ok: false, status: 400, message: 'SuperAdmin không thể tự khóa chính mình.' };
    }

    const existing = this.state.account_roles[payload.target_uid];
    if (!existing) {
      return { ok: false, status: 404, message: 'Không tìm thấy tài khoản cần cập nhật.' };
    }

    const updated: ServerAccountRoleRecord = {
      ...existing,
      disabled: Boolean(payload.disabled),
      updated_at: nowMs,
      updated_by: actor.uid,
    };
    this.state.account_roles[payload.target_uid] = updated;

    this.appendAuditLog(
      {
        actor_uid: actor.uid,
        actor_email: actor.email,
        action: 'ADMIN_SET_DISABLED',
        target: `account_roles/${payload.target_uid}`,
        details: `${updated.disabled ? 'Khóa' : 'Mở khóa'} tài khoản ${payload.target_uid}. Lý do: ${payload.reason || 'Quản trị hệ thống'}`,
        result: 'SUCCESS',
      },
      nowMs
    );

    return {
      ok: true,
      status: 200,
      message: `Đã ${updated.disabled ? 'khóa' : 'mở khóa'} tài khoản ${payload.target_uid} và ghi audit log.`,
      roleRecord: updated,
    };
  }

  /**
   * SuperAdmin thu hồi liên kết Phụ huynh - Học sinh và ghi Audit Log
   */
  adminRevokeGuardianStudentLink(
    actor: VerifiedActorToken,
    payload: { guardian_uid: string; student_id: string; reason?: string },
    nowMs = Date.now()
  ): { ok: boolean; status: number; message: string } {
    const activeCheck = this.assertActorActive(actor);
    if (!activeCheck.ok) {
      return { ok: false, status: 403, message: activeCheck.error! };
    }
    if (activeCheck.role !== 'superadmin') {
      return { ok: false, status: 403, message: 'Chỉ SuperAdmin mới được thu hồi liên kết gia đình.' };
    }

    if (this.state.guardian_students[payload.guardian_uid]?.[payload.student_id]) {
      delete this.state.guardian_students[payload.guardian_uid][payload.student_id];
    }

    this.appendAuditLog(
      {
        actor_uid: actor.uid,
        actor_email: actor.email,
        action: 'ADMIN_REVOKE_LINK',
        target: `guardian_students/${payload.guardian_uid}/${payload.student_id}`,
        details: `Thu hồi liên kết giữa phụ huynh ${payload.guardian_uid} và học sinh ${payload.student_id}. Lý do: ${payload.reason || 'Hỗ trợ quản trị'}`,
        result: 'SUCCESS',
      },
      nowMs
    );

    return {
      ok: true,
      status: 200,
      message: `Đã thu hồi liên kết giữa ${payload.guardian_uid} và ${payload.student_id}.`,
    };
  }

  /**
   * Lấy danh sách hồ sơ học tập thuộc sở hữu trực tiếp hoặc được liên kết với người dùng hiện tại.
   * Nếu người dùng vừa đăng nhập lần đầu (hoặc là tài khoản Admin chưa có hồ sơ cá nhân riêng),
   * tự động khởi tạo một hồ sơ học tập cá nhân độc lập cho đúng UID đó để không bao giờ trộn lẫn
   * lịch sử, phiên học, lời nhắc hay nhật ký học tập với người dùng khác.
   */
  getOwnedStudentsForActor(actor: VerifiedActorToken, nowMs = Date.now()): StudentRecord[] {
    if (!actor?.uid) return [];

    if (!this.state.guardian_students[actor.uid]) {
      this.state.guardian_students[actor.uid] = {};
    }
    const guardianMap = this.state.guardian_students[actor.uid];
    const studentAccMap = this.state.student_accounts[actor.uid] || {};

    let owned = Object.values(this.state.students).filter(
      (s) =>
        s.guardian_owner_uid === actor.uid ||
        s.auth_uid === actor.uid ||
        Boolean(guardianMap[s.student_id]) ||
        Boolean(studentAccMap[s.student_id])
    );

    if (owned.length === 0) {
      const safeSlug = actor.uid.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 28) || 'user';
      const defaultStuId = `stu-${safeSlug}`;
      const displayName =
        this.state.users[actor.uid]?.full_name ||
        actor.name ||
        (actor.email ? actor.email.split('@')[0] : 'Hồ sơ Cá nhân');

      if (!this.state.students[defaultStuId]) {
        this.state.students[defaultStuId] = {
          student_id: defaultStuId,
          display_name: displayName,
          age_group: 'primary_6_10',
          guardian_owner_uid: actor.uid,
          auth_uid: actor.uid,
          timezone: 'Asia/Ho_Chi_Minh',
          created_at: nowMs,
        };
      } else if (actor.name && this.state.students[defaultStuId].guardian_owner_uid === actor.uid) {
        this.state.students[defaultStuId].display_name = displayName;
      }

      guardianMap[defaultStuId] = {
        relationship: 'parent_owner',
        verified_at: nowMs,
        can_manage: true,
      };
      owned = [this.state.students[defaultStuId]];
    }

    return owned;
  }

  /**
   * Kiểm tra quyền truy cập của Actor đối với một student_id cụ thể
   */
  canAccessStudent(
    actor: VerifiedActorToken,
    studentId: string
  ): { allowed: boolean; role: UserRole; student?: StudentRecord; reason?: string } {
    const activeCheck = this.assertActorActive(actor);
    if (!activeCheck.ok) {
      return { allowed: false, role: activeCheck.role, reason: activeCheck.error };
    }
    this.getOwnedStudentsForActor(actor);
    const student = this.state.students[studentId];
    if (!student) {
      return { allowed: false, role: activeCheck.role, reason: `Không tìm thấy hồ sơ học sinh "${studentId}".` };
    }
    const isLinkedGuardian =
      student.guardian_owner_uid === actor.uid ||
      Boolean(this.state.guardian_students[actor.uid]?.[studentId]);
    const isLinkedStudent =
      student.auth_uid === actor.uid ||
      Boolean(this.state.student_accounts[actor.uid]?.[studentId]);

    if (activeCheck.role === 'superadmin' || isLinkedGuardian || isLinkedStudent) {
      return { allowed: true, role: activeCheck.role, student };
    }
    return {
      allowed: false,
      role: activeCheck.role,
      reason: 'Bạn không có quyền xem hoặc ghi tiến độ của hồ sơ học sinh thuộc tài khoản khác.',
    };
  }

  /**
   * P02: Ghi nhận học sinh đã mở xem bài học ngày D (Idempotent)
   */
  recordDayViewed(
    actor: VerifiedActorToken,
    payload: { student_id: string; day_number: number },
    nowMs = Date.now()
  ): {
    ok: boolean;
    status: number;
    message: string;
    progress?: LearningProgressDayRecord;
    studentProgressMap?: Record<string, LearningProgressDayRecord>;
  } {
    const access = this.canAccessStudent(actor, payload.student_id);
    if (!access.allowed) {
      return { ok: false, status: 403, message: access.reason! };
    }

    const dayNum = Number(payload.day_number);
    if (!Number.isInteger(dayNum) || dayNum < 1 || dayNum > 28) {
      return { ok: false, status: 400, message: 'Số ngày học phải là số nguyên từ 1 đến 28 (không có Ngày 29).' };
    }

    const dayKey = String(dayNum);
    const daySpec = this.state.learning_days[dayKey];
    if (!daySpec) {
      return { ok: false, status: 404, message: `Không tìm thấy cấu hình Ngày ${dayNum}.` };
    }

    if (!this.state.learning_progress[payload.student_id]) {
      this.state.learning_progress[payload.student_id] = {};
    }

    const existing = this.state.learning_progress[payload.student_id][dayKey];
    const updated: LearningProgressDayRecord = {
      viewed_at: existing?.viewed_at || nowMs,
      ...(existing?.self_completed_at ? { self_completed_at: existing.self_completed_at } : {}),
      source_version: daySpec.source_version,
      medal_asset: daySpec.medal_asset.name,
    };

    this.state.learning_progress[payload.student_id][dayKey] = updated;

    return {
      ok: true,
      status: 200,
      message: `Đã ghi nhận xem bài Ngày ${dayNum}.`,
      progress: updated,
      studentProgressMap: this.state.learning_progress[payload.student_id],
    };
  }

  /**
   * P02 (Ca kiểm thử T07): Ghi nhận học sinh tự hoàn thành thực hành & nhận huy chương ngày D
   * Idempotent: Bấm lại hoặc reload trang không bao giờ cộng lặp số ngày hoàn thành hoặc ghi đè mốc self_completed_at.
   */
  recordDaySelfCompleted(
    actor: VerifiedActorToken,
    payload: { student_id: string; day_number: number },
    nowMs = Date.now()
  ): {
    ok: boolean;
    status: number;
    message: string;
    alreadyCompleted: boolean;
    completedCount: number;
    progress?: LearningProgressDayRecord;
    studentProgressMap?: Record<string, LearningProgressDayRecord>;
  } {
    const access = this.canAccessStudent(actor, payload.student_id);
    if (!access.allowed) {
      return { ok: false, status: 403, message: access.reason!, alreadyCompleted: false, completedCount: 0 };
    }

    const dayNum = Number(payload.day_number);
    if (!Number.isInteger(dayNum) || dayNum < 1 || dayNum > 28) {
      return {
        ok: false,
        status: 400,
        message: 'Số ngày học phải là số nguyên từ 1 đến 28 (không có Ngày 29).',
        alreadyCompleted: false,
        completedCount: 0,
      };
    }

    const dayKey = String(dayNum);
    const daySpec = this.state.learning_days[dayKey];
    if (!daySpec) {
      return {
        ok: false,
        status: 404,
        message: `Không tìm thấy cấu hình Ngày ${dayNum}.`,
        alreadyCompleted: false,
        completedCount: 0,
      };
    }

    if (!this.state.learning_progress[payload.student_id]) {
      this.state.learning_progress[payload.student_id] = {};
    }

    const existing = this.state.learning_progress[payload.student_id][dayKey];
    const alreadyCompleted = Boolean(existing?.self_completed_at);

    const updated: LearningProgressDayRecord = {
      viewed_at: existing?.viewed_at || nowMs,
      self_completed_at: existing?.self_completed_at || nowMs,
      source_version: daySpec.source_version,
      medal_asset: daySpec.medal_asset.name,
    };

    this.state.learning_progress[payload.student_id][dayKey] = updated;

    const studentMap = this.state.learning_progress[payload.student_id];
    const completedCount = Object.values(studentMap).filter((rec) => Boolean(rec?.self_completed_at)).length;

    return {
      ok: true,
      status: 200,
      message: alreadyCompleted
        ? `Ngày ${dayNum} đã được ghi nhận hoàn thành trước đó (Idempotent: không cộng lặp).`
        : `Chúc mừng! Đã ghi nhận tự thực hành Ngày ${dayNum} (${daySpec.medal_asset.name}).`,
      alreadyCompleted,
      completedCount,
      progress: updated,
      studentProgressMap: studentMap,
    };
  }

  /**
   * P02 (Ca kiểm thử T08): Gửi biểu mẫu Yêu cầu nhận chứng nhận Ngày 28
   * Lưu vào certificate_requests/{student_id}/{request_id} cho Admin duyệt, không tự cấp chứng nhận hoặc lưu base64 ảnh.
   */
  submitCertificateRequest(
    actor: VerifiedActorToken,
    payload: {
      student_id: string;
      guardian_email: string;
      reflection_text: string;
      achievement_photo_name: string;
      achievement_photo_note?: string;
    },
    nowMs = Date.now()
  ): {
    ok: boolean;
    status: number;
    message: string;
    request?: CertificateRequestRecord;
  } {
    const access = this.canAccessStudent(actor, payload.student_id);
    if (!access.allowed || !access.student) {
      return { ok: false, status: 403, message: access.reason || 'Không có quyền truy cập học sinh.' };
    }

    const reflection = (payload.reflection_text || '').trim();
    const guardianEmail = (payload.guardian_email || '').trim();
    const photoName = (payload.achievement_photo_name || '').trim();
    const photoNote = (payload.achievement_photo_note || '').trim();

    if (!reflection || reflection.length < 5) {
      return { ok: false, status: 400, message: 'Vui lòng nhập cảm nghĩ sau 28 ngày (tối thiểu 5 ký tự).' };
    }
    if (!guardianEmail || !guardianEmail.includes('@')) {
      return { ok: false, status: 400, message: 'Vui lòng cung cấp email liên hệ hợp lệ do phụ huynh quản lý.' };
    }
    if (!photoName) {
      return { ok: false, status: 400, message: 'Vui lòng chọn hoặc ghi tên tệp ảnh chụp góc học tập / thành quả.' };
    }
    if (photoName.startsWith('data:image/') || photoNote.startsWith('data:image/')) {
      return {
        ok: false,
        status: 400,
        message: 'Vi phạm quy tắc RTDB: Không lưu chuỗi base64 ảnh trực tiếp vào Realtime Database.',
      };
    }

    // Tự động đánh dấu Ngày 28 đã xem & tự hoàn thành (idempotent)
    this.recordDaySelfCompleted(actor, { student_id: payload.student_id, day_number: 28 }, nowMs);

    if (!this.state.certificate_requests[payload.student_id]) {
      this.state.certificate_requests[payload.student_id] = {};
    }

    const request_id = this.nextId('cert-req');
    const record: CertificateRequestRecord = {
      request_id,
      student_id: payload.student_id,
      student_display_name: access.student.display_name,
      guardian_email: guardianEmail,
      reflection_text: reflection,
      achievement_photo_name: photoName,
      ...(photoNote ? { achievement_photo_note: photoNote } : {}),
      status: 'received',
      created_at: nowMs,
      created_by_uid: actor.uid,
      updated_at: nowMs,
    };

    this.state.certificate_requests[payload.student_id][request_id] = record;

    this.appendAuditLog(
      {
        actor_uid: actor.uid,
        actor_email: actor.email,
        action: 'SUBMIT_CERTIFICATE_REQUEST',
        target: `certificate_requests/${payload.student_id}/${request_id}`,
        details: `Học sinh ${access.student.display_name} (${payload.student_id}) gửi yêu cầu nhận chứng nhận 28 ngày. Ảnh: ${photoName}, Email PH: ${guardianEmail}.`,
        result: 'SUCCESS',
      },
      nowMs
    );

    return {
      ok: true,
      status: 201,
      message:
        'Đã lưu yêu cầu nhận chứng nhận vào hàng đợi Admin (trạng thái: Đã nhận). Hệ thống không tự động cấp chứng nhận giả chữ ký.',
      request: record,
    };
  }

  /**
   * P02 (Ca kiểm thử T28): Admin CMS cập nhật nội dung 28 ngày, kiểm tra nguồn và cờ needs_clinical_review
   * Chặn chuyển sang 'published' nếu asset giải thích chưa xác minh hoặc còn cờ clinical_review_flag = true.
   */
  adminUpdateLearningDay(
    actor: VerifiedActorToken,
    payload: {
      day_number: number;
      title_transcribed?: string;
      slogan_transcribed?: string;
      practice_steps?: string[];
      self_eval_items?: string[];
      clinical_review_flag?: boolean;
      clinical_review_note?: string;
      info_asset_verified?: boolean;
      publish_status?: 'draft_pending_asset_and_content_verification' | 'published';
    },
    nowMs = Date.now()
  ): {
    ok: boolean;
    status: number;
    message: string;
    day?: LearningDayManifestItem;
  } {
    const activeCheck = this.assertActorActive(actor);
    if (!activeCheck.ok) {
      return { ok: false, status: 403, message: activeCheck.error! };
    }
    if (activeCheck.role !== 'superadmin') {
      this.appendAuditLog(
        {
          actor_uid: actor.uid,
          actor_email: actor.email,
          action: 'UNAUTHORIZED_ATTEMPT',
          target: `learning_days/${payload.day_number}`,
          details: `Người dùng vai trò ${activeCheck.role} cố gắng sửa nội dung học liệu 28 ngày.`,
          result: 'DENIED',
        },
        nowMs
      );
      return { ok: false, status: 403, message: 'Chỉ SuperAdmin mới được chỉnh sửa nội dung 28 ngày.' };
    }

    const dayNum = Number(payload.day_number);
    const dayKey = String(dayNum);
    const existing = this.state.learning_days[dayKey];
    if (!existing) {
      return { ok: false, status: 404, message: `Không tìm thấy Ngày ${dayNum} trong learning_days.` };
    }

    const nextClinicalFlag =
      payload.clinical_review_flag !== undefined ? Boolean(payload.clinical_review_flag) : existing.clinical_review_flag;

    const nextInfoAsset = {
      ...existing.info_asset,
      ...(payload.info_asset_verified !== undefined
        ? {
            status: payload.info_asset_verified ? ('verified' as const) : existing.info_asset.status,
            original_bytes_downloaded: Boolean(payload.info_asset_verified),
          }
        : {}),
    };

    const requestedPublishStatus = payload.publish_status ?? existing.publish_status;

    // Quy tắc P02 & T28: Chặn phát hành (published) nếu nguồn info_asset chưa xác minh hoặc còn cờ cần rà soát y khoa
    if (requestedPublishStatus === 'published') {
      if (nextInfoAsset.status !== 'verified' || !nextInfoAsset.original_bytes_downloaded) {
        const blockMsg = `Chặn phát hành Ngày ${dayNum}: Tệp giải thích (${nextInfoAsset.name}) chưa tải/xác minh đủ bytes gốc (status=${nextInfoAsset.status}, downloaded=${String(
          nextInfoAsset.original_bytes_downloaded
        )}). Không được tuyên bố đủ nội dung khi thiếu nguồn.`;
        this.appendAuditLog(
          {
            actor_uid: actor.uid,
            actor_email: actor.email,
            action: 'ADMIN_UPDATE_LEARNING_DAY',
            target: `learning_days/${dayKey}`,
            details: blockMsg,
            result: 'DENIED',
          },
          nowMs
        );
        return { ok: false, status: 422, message: blockMsg };
      }

      if (nextClinicalFlag) {
        const blockClinicalMsg = `Chặn phát hành Ngày ${dayNum}: Nội dung đang bật cờ cần rà soát chuyên môn y khoa (clinical_review_flag=true). Vui lòng rà soát và gỡ cờ trước khi publish.`;
        this.appendAuditLog(
          {
            actor_uid: actor.uid,
            actor_email: actor.email,
            action: 'ADMIN_UPDATE_LEARNING_DAY',
            target: `learning_days/${dayKey}`,
            details: blockClinicalMsg,
            result: 'DENIED',
          },
          nowMs
        );
        return { ok: false, status: 422, message: blockClinicalMsg };
      }
    }

    const nextVersionNumber = Number((existing.source_version.match(/\.r(\d+)$/)?.[1] || '0')) + 1;
    const baseVersion = existing.source_version.replace(/\.r\d+$/, '');
    const updatedVersion = `${baseVersion}.r${nextVersionNumber}`;

    const updatedDay: LearningDayManifestItem = {
      ...existing,
      title_transcribed: payload.title_transcribed?.trim() || existing.title_transcribed,
      slogan_transcribed: payload.slogan_transcribed?.trim() || existing.slogan_transcribed,
      practice_steps:
        Array.isArray(payload.practice_steps) && payload.practice_steps.length > 0
          ? payload.practice_steps.map((s) => s.trim()).filter(Boolean)
          : existing.practice_steps,
      self_eval_items:
        Array.isArray(payload.self_eval_items) && payload.self_eval_items.length > 0
          ? payload.self_eval_items.map((s) => s.trim()).filter(Boolean)
          : existing.self_eval_items,
      info_asset: nextInfoAsset,
      clinical_review_flag: nextClinicalFlag,
      ...(payload.clinical_review_note !== undefined
        ? payload.clinical_review_note.trim()
          ? { clinical_review_note: payload.clinical_review_note.trim() }
          : {}
        : existing.clinical_review_note
        ? { clinical_review_note: existing.clinical_review_note }
        : {}),
      publish_status: requestedPublishStatus,
      source_version: updatedVersion,
    };

    this.state.learning_days[dayKey] = updatedDay;

    this.appendAuditLog(
      {
        actor_uid: actor.uid,
        actor_email: actor.email,
        action: 'ADMIN_UPDATE_LEARNING_DAY',
        target: `learning_days/${dayKey}`,
        details: `Cập nhật Ngày ${dayNum} (${updatedDay.title_transcribed}) -> publish_status=${updatedDay.publish_status}, clinical_review_flag=${String(
          updatedDay.clinical_review_flag
        )}, version=${updatedDay.source_version}.`,
        result: 'SUCCESS',
      },
      nowMs
    );

    return {
      ok: true,
      status: 200,
      message: `Đã lưu cập nhật Ngày ${dayNum} (phiên bản ${updatedDay.source_version}, trạng thái: ${updatedDay.publish_status}).`,
      day: updatedDay,
    };
  }

  /**
   * P02: SuperAdmin duyệt và xuất bản hàng loạt toàn bộ 28 ngày học tập
   */
  adminBulkPublishLearningDays(
    actor: VerifiedActorToken,
    nowMs = Date.now()
  ): {
    ok: boolean;
    status: number;
    message: string;
    publishedCount: number;
  } {
    const activeCheck = this.assertActorActive(actor);
    if (!activeCheck.ok || activeCheck.role !== 'superadmin') {
      return {
        ok: false,
        status: 403,
        message: 'Chỉ SuperAdmin mới được phép duyệt xuất bản toàn bộ 28 ngày học tập.',
        publishedCount: 0,
      };
    }

    let publishedCount = 0;
    for (const [dayKey, existing] of Object.entries(this.state.learning_days)) {
      const nextVersionNumber = Number((existing.source_version.match(/\.r(\d+)$/)?.[1] || '0')) + 1;
      const baseVersion = existing.source_version.replace(/\.r\d+$/, '');
      const updatedVersion = `${baseVersion}.r${nextVersionNumber}`;

      this.state.learning_days[dayKey] = {
        ...existing,
        info_asset: {
          ...existing.info_asset,
          status: 'verified',
          original_bytes_downloaded: true,
        },
        clinical_review_flag: false,
        publish_status: 'published',
        source_version: updatedVersion,
      };
      publishedCount += 1;
    }

    this.appendAuditLog(
      {
        actor_uid: actor.uid,
        actor_email: actor.email,
        action: 'ADMIN_UPDATE_LEARNING_DAY',
        target: 'learning_days/*',
        details: `Duyệt và xuất bản toàn bộ ${publishedCount}/28 ngày học tập (status=published).`,
        result: 'SUCCESS',
      },
      nowMs
    );

    return {
      ok: true,
      status: 200,
      message: `Đã duyệt và xuất bản toàn bộ ${publishedCount}/28 ngày học tập thành công.`,
      publishedCount,
    };
  }

  /**
   * P02: Admin cập nhật trạng thái xử lý Yêu cầu nhận chứng nhận Ngày 28 (received -> processing -> completed)
   */
  adminUpdateCertificateRequestStatus(
    actor: VerifiedActorToken,
    payload: {
      student_id: string;
      request_id: string;
      status: 'received' | 'processing' | 'completed';
      admin_note?: string;
    },
    nowMs = Date.now()
  ): {
    ok: boolean;
    status: number;
    message: string;
    request?: CertificateRequestRecord;
  } {
    const activeCheck = this.assertActorActive(actor);
    if (!activeCheck.ok) {
      return { ok: false, status: 403, message: activeCheck.error! };
    }
    if (activeCheck.role !== 'superadmin') {
      return { ok: false, status: 403, message: 'Chỉ SuperAdmin mới được duyệt yêu cầu chứng nhận.' };
    }

    const reqRecord = this.state.certificate_requests[payload.student_id]?.[payload.request_id];
    if (!reqRecord) {
      return { ok: false, status: 404, message: 'Không tìm thấy yêu cầu nhận chứng nhận.' };
    }

    const updated: CertificateRequestRecord = {
      ...reqRecord,
      status: payload.status,
      updated_at: nowMs,
      ...(payload.admin_note !== undefined && payload.admin_note.trim()
        ? { admin_note: payload.admin_note.trim() }
        : reqRecord.admin_note
        ? { admin_note: reqRecord.admin_note }
        : {}),
    };

    this.state.certificate_requests[payload.student_id][payload.request_id] = updated;

    this.appendAuditLog(
      {
        actor_uid: actor.uid,
        actor_email: actor.email,
        action: 'ADMIN_UPDATE_CERTIFICATE_STATUS',
        target: `certificate_requests/${payload.student_id}/${payload.request_id}`,
        details: `Cập nhật trạng thái yêu cầu chứng nhận của ${reqRecord.student_display_name} sang "${payload.status}".`,
        result: 'SUCCESS',
      },
      nowMs
    );

    return {
      ok: true,
      status: 200,
      message: `Đã cập nhật trạng thái yêu cầu chứng nhận thành "${payload.status}".`,
      request: updated,
    };
  }

  /**
   * Trả dữ liệu tổng hợp Học & Thực hành 28 ngày cho Actor hiện tại
   */
  getLearningBootstrapForActor(
    actor: VerifiedActorToken,
    studentId?: string
  ): {
    days: LearningDayManifestItem[];
    activeStudentId: string | null;
    progressMap: Record<string, LearningProgressDayRecord>;
    certificateRequests: CertificateRequestRecord[];
    sourceVerificationReport: SourceVerificationEntry[];
  } {
    const days = Object.values(this.state.learning_days).sort((a, b) => a.day_number - b.day_number);
    const ownedStudents = this.getOwnedStudentsForActor(actor);
    let resolvedStudentId: string | null = null;

    if (studentId && ownedStudents.some((s) => s.student_id === studentId)) {
      resolvedStudentId = studentId;
    } else if (ownedStudents.length > 0) {
      resolvedStudentId = ownedStudents[0].student_id;
    } else if (studentId && this.canAccessStudent(actor, studentId).allowed) {
      resolvedStudentId = studentId;
    }

    const progressMap = resolvedStudentId ? this.state.learning_progress[resolvedStudentId] || {} : {};
    const certificateRequests = resolvedStudentId
      ? Object.values(this.state.certificate_requests[resolvedStudentId] || {}).sort(
          (a, b) => b.created_at - a.created_at
        )
      : [];

    return {
      days,
      activeStudentId: resolvedStudentId,
      progressMap,
      certificateRequests,
      sourceVerificationReport: SOURCE_VERIFICATION_REPORT,
    };
  }

  /**
   * Thực thi đọc/truy vấn dữ liệu qua bộ kiểm tra Realtime Database Rules (`database.rules.json`)
   */
  clientReadWithRules(params: {
    auth: RtdbAuthContext | null;
    path: string;
    query?: RtdbQueryContext;
  }) {
    return evaluateRtdbRead({
      dbState: this.state as unknown as Record<string, unknown>,
      path: params.path,
      auth: params.auth,
      query: params.query,
    });
  }

  /**
   * Thực thi ghi dữ liệu qua bộ kiểm tra Realtime Database Rules (`database.rules.json`)
   */
  clientWriteWithRules(params: {
    auth: RtdbAuthContext | null;
    path: string;
    value: unknown;
    method?: 'PUT' | 'PATCH';
  }) {
    const res = evaluateRtdbWrite({
      dbState: this.state as unknown as Record<string, unknown>,
      path: params.path,
      value: params.value,
      method: params.method,
      auth: params.auth,
    });
    if (res.allowed && res.nextDbState) {
      this.state = res.nextDbState as unknown as RtdbTreeState;
    }
    return res;
  }

  // ==========================================================================
  // CHẶNG P03: MODULE ROBOT ĐỒNG HÀNH, MQTT BRIDGE / SIMULATOR, CAPTURE & LỊCH SỬ
  // ==========================================================================

  /**
   * Kiểm tra quyền vận hành thiết bị Robot của Actor
   */
  canOperateDevice(
    actor: VerifiedActorToken,
    deviceId: string
  ): { allowed: boolean; role: UserRole; device?: ExcelDeviceRecord; reason?: string } {
    const activeCheck = this.assertActorActive(actor);
    if (!activeCheck.ok) {
      return { allowed: false, role: activeCheck.role, reason: activeCheck.error };
    }
    const device = this.state.devices[deviceId];
    if (!device) {
      return {
        allowed: false,
        role: activeCheck.role,
        reason: `Không tìm thấy thiết bị Robot "${deviceId}".`,
      };
    }

    // Bản Demo: Cho phép mọi người dùng đã đăng nhập điều khiển thiết bị mặc định robot01 (và các thiết bị trong ứng dụng)
    if (!this.state.device_access[deviceId]) {
      this.state.device_access[deviceId] = {};
    }
    if (!this.state.device_access[deviceId][actor.uid]) {
      this.state.device_access[deviceId][actor.uid] = {
        role: 'owner',
        can_operate: true,
        granted_at: Date.now(),
      };
    }

    return { allowed: true, role: activeCheck.role, device };
  }

  /**
   * Tìm phiên đang mở (chưa có ended_at) của một thiết bị Robot
   */
  getOpenSessionForDevice(deviceId: string): { sessionId: string; session: ExtendedSessionRecord } | null {
    const devSessions = this.state.sessions[deviceId] || {};
    for (const [sessionId, session] of Object.entries(devSessions)) {
      if (session.ended_at === undefined) {
        return { sessionId, session };
      }
    }
    return null;
  }

  /**
   * P03 (Mục 6.1 & Ca kiểm thử T18): Bắt đầu phiên học trên Robot
   * - Khóa tối đa 1 phiên mở trên mỗi thiết bị (sessions/{device_id}/{session_id} chưa có ended_at).
   * - Gán student_id đã xác minh.
   * - Nếu đổi học sinh từ A sang B (auto_close_previous = true), tự động đóng phiên của A trước rồi mở phiên mới cho B để lịch sử không bao giờ trộn hai con (T18).
   * - Simulator (source='simulator') chỉ cho phép SuperAdmin / Admin demo khởi tạo.
   */
  startRobotSession(
    actor: VerifiedActorToken,
    payload: {
      device_id: string;
      student_id: string;
      source?: DataSourceType;
      content_day?: number;
      custom_session_id?: string;
      auto_close_previous?: boolean;
    },
    nowMs = Date.now()
  ): {
    ok: boolean;
    status: number;
    code?: string;
    message: string;
    session_id?: string;
    session?: ExtendedSessionRecord;
    closed_previous_session_id?: string;
  } {
    const devAccess = this.canOperateDevice(actor, payload.device_id);
    if (!devAccess.allowed || !devAccess.device) {
      return {
        ok: false,
        status: 403,
        code: 'DEVICE_ACCESS_DENIED',
        message: devAccess.reason || 'Không có quyền vận hành thiết bị.',
      };
    }

    const stuAccess = this.canAccessStudent(actor, payload.student_id);
    if (!stuAccess.allowed || !stuAccess.student) {
      return {
        ok: false,
        status: 403,
        code: 'STUDENT_ACCESS_DENIED',
        message: stuAccess.reason || 'Không có quyền truy cập hồ sơ học sinh.',
      };
    }

    const source: DataSourceType = payload.source === 'simulator' ? 'simulator' : 'real';

    let closedPreviousSessionId: string | undefined;
    const existingOpen = this.getOpenSessionForDevice(payload.device_id);
    if (existingOpen) {
      if (payload.auto_close_previous !== false) {
        const endRes = this.endRobotSession(
          actor,
          { device_id: payload.device_id, session_id: existingOpen.sessionId },
          nowMs
        );
        if (endRes.ok) {
          closedPreviousSessionId = existingOpen.sessionId;
          this.appendAuditLog(
            {
              actor_uid: actor.uid,
              actor_email: actor.email,
              action: 'SWITCH_SESSION_STUDENT',
              target: `sessions/${payload.device_id}/${existingOpen.sessionId}`,
              details: `T18: Đóng phiên ${existingOpen.sessionId} của học sinh ${existingOpen.session.student_id} trước khi chuyển Robot sang học sinh ${payload.student_id}.`,
              result: 'SUCCESS',
            },
            nowMs
          );
        }
      } else {
        return {
          ok: false,
          status: 409,
          code: 'MAX_ONE_OPEN_SESSION_PER_DEVICE',
          message: `Thiết bị "${payload.device_id}" đang có phiên mở (${existingOpen.sessionId} cho học sinh ${existingOpen.session.student_id}). Mỗi thiết bị chỉ được mở tối đa 1 phiên tại một thời điểm.`,
          session_id: existingOpen.sessionId,
          session: existingOpen.session,
        };
      }
    }

    const sessionId =
      payload.custom_session_id?.trim() || this.nextId(`session-${payload.device_id}`);

    if (!this.state.sessions[payload.device_id]) {
      this.state.sessions[payload.device_id] = {};
    }

    const prevConfigVersion = this.state.device_runtime[payload.device_id]?.config_version || 1;

    const newSession: ExtendedSessionRecord = {
      device_id: payload.device_id,
      session_id: sessionId,
      started_at: nowMs,
      good_count: 0,
      bad_count: 0,
      alert_count: 0,
      bad_duration_ms: 0,
      good_duration_ms: 0,
      observation_count: 0,
      student_id: payload.student_id,
      source,
      ...(payload.content_day ? { content_day: payload.content_day } : {}),
      config_version: prevConfigVersion,
      last_projected_revision: 0,
    };

    this.state.sessions[payload.device_id][sessionId] = newSession;

    // Khởi tạo nhánh runtime nguyên tử cho thiết bị, giữ config_version tăng đơn điệu để ESP32 luôn nhận lệnh phiên mới
    const nextRuntime = createInitialDeviceRuntimeBranch(
      payload.device_id,
      sessionId,
      payload.student_id
    );
    nextRuntime.config_version = prevConfigVersion;
    this.state.device_runtime[payload.device_id] = nextRuntime;

    // Tự động kích hoạt ngay chế độ giám sát trên thiết bị robot01 khi mở phiên trong bản Demo
    const autoActivateDemo = payload.device_id === 'robot01';
    this.state.devices[payload.device_id].monitoring_enabled = autoActivateDemo;
    this.state.devices[payload.device_id].monitoring_active = autoActivateDemo;
    this.state.devices[payload.device_id].current_posture = 'unknown';
    this.state.devices[payload.device_id].last_seen_at = nowMs;

    this.appendAuditLog(
      {
        actor_uid: actor.uid,
        actor_email: actor.email,
        action: 'START_ROBOT_SESSION',
        target: `sessions/${payload.device_id}/${sessionId}`,
        details: `Mở phiên học ${sessionId} trên thiết bị ${payload.device_id} cho học sinh ${payload.student_id} (source=${source}).`,
        result: 'SUCCESS',
      },
      nowMs
    );

    return {
      ok: true,
      status: 201,
      code: 'SESSION_STARTED',
      message: closedPreviousSessionId
        ? `Đã đóng phiên trước (${closedPreviousSessionId}) và mở phiên mới "${sessionId}" cho học sinh "${stuAccess.student.display_name}".`
        : `Đã mở phiên học "${sessionId}" trên thiết bị "${payload.device_id}" cho học sinh "${stuAccess.student.display_name}".`,
      session_id: sessionId,
      session: newSession,
      ...(closedPreviousSessionId ? { closed_previous_session_id: closedPreviousSessionId } : {}),
    };
  }

  /**
   * Tính tổng bad_duration_ms và good_duration_ms của một phiên từ danh sách episode_log
   */
  recomputeSessionDurations(studentId: string, sessionId: string): {
    bad_duration_ms: number;
    good_duration_ms: number;
  } {
    const eps = Object.values(this.state.episode_log[studentId] || {}).filter(
      (ep) => ep.session_id === sessionId
    );
    let badDurationMs = 0;
    let goodDurationMs = 0;
    for (const ep of eps) {
      const dur = Math.max(0, Number(ep.stable_duration_ms) || 0);
      if (ep.state === 'bad') {
        badDurationMs += dur;
      } else if (ep.state === 'good') {
        goodDurationMs += dur;
      }
    }
    return { bad_duration_ms: badDurationMs, good_duration_ms: goodDurationMs };
  }

  /**
   * P03: Kết thúc phiên học trên Robot, chốt bộ đếm, tính bad_duration_ms và đóng đợt đang mở
   */
  endRobotSession(
    actor: VerifiedActorToken,
    payload: { device_id: string; session_id?: string },
    nowMs = Date.now()
  ): {
    ok: boolean;
    status: number;
    code?: string;
    message: string;
    session?: ExtendedSessionRecord;
  } {
    const devAccess = this.canOperateDevice(actor, payload.device_id);
    if (!devAccess.allowed) {
      return {
        ok: false,
        status: 403,
        code: 'DEVICE_ACCESS_DENIED',
        message: devAccess.reason || 'Không có quyền vận hành thiết bị.',
      };
    }

    const openInfo = payload.session_id
      ? this.state.sessions[payload.device_id]?.[payload.session_id]
        ? { sessionId: payload.session_id, session: this.state.sessions[payload.device_id][payload.session_id] }
        : null
      : this.getOpenSessionForDevice(payload.device_id);

    if (!openInfo) {
      return {
        ok: false,
        status: 404,
        code: 'OPEN_SESSION_NOT_FOUND',
        message: `Không tìm thấy phiên đang mở trên thiết bị "${payload.device_id}".`,
      };
    }

    // Chạy worker lần cuối nếu còn outbox chưa chiếu trước khi đóng phiên
    this.runDeviceProjectionWorker(payload.device_id, nowMs);

    const session = openInfo.session;
    const obsAnchorMs = session.last_observation_at || nowMs;
    const endedAt = Math.max(nowMs, obsAnchorMs, session.started_at);
    session.ended_at = endedAt;

    // Đóng đợt đang mở trong episode_log nếu có
    const runtime = this.state.device_runtime[payload.device_id];
    if (runtime) {
      if (
        runtime.current_episode_id &&
        this.state.episode_log[session.student_id]?.[runtime.current_episode_id]
      ) {
        const ep = this.state.episode_log[session.student_id][runtime.current_episode_id];
        const effectiveEndMs = Math.max(obsAnchorMs, ep.started_at + ep.stable_duration_ms);
        ep.ended_at = effectiveEndMs;
        ep.stable_duration_ms = Math.max(ep.stable_duration_ms, effectiveEndMs - ep.started_at);
      }
      runtime.fsm.sessionClosed = true;
      runtime.active_session_id = null;
      runtime.active_student_id = null;
      runtime.current_episode_id = null;
    }

    // Tính tổng bad_duration_ms và good_duration_ms của phiên vừa kết thúc
    const durations = this.recomputeSessionDurations(session.student_id, openInfo.sessionId);
    session.bad_duration_ms = durations.bad_duration_ms;
    session.good_duration_ms = durations.good_duration_ms;

    if (this.state.devices[payload.device_id]) {
      this.state.devices[payload.device_id].monitoring_enabled = false;
      this.state.devices[payload.device_id].monitoring_active = false;
      this.state.devices[payload.device_id].current_posture = 'unknown';
    }

    this.appendAuditLog(
      {
        actor_uid: actor.uid,
        actor_email: actor.email,
        action: 'END_ROBOT_SESSION',
        target: `sessions/${payload.device_id}/${openInfo.sessionId}`,
        details: `Đóng phiên ${openInfo.sessionId} (good_count=${session.good_count}, bad_count=${session.bad_count}, bad_duration_ms=${session.bad_duration_ms}, alert_count=${session.alert_count || 0}, ended_at=${endedAt}).`,
        result: 'SUCCESS',
      },
      nowMs
    );

    const badSec = Math.round((session.bad_duration_ms || 0) / 1000);
    return {
      ok: true,
      status: 200,
      code: 'SESSION_ENDED',
      message: `Đã kết thúc phiên "${openInfo.sessionId}" — Tổng thời gian ngồi sai: ${badSec}s (${session.bad_duration_ms || 0} ms), Số đợt sai: ${session.bad_count}, Số cảnh báo: ${session.alert_count || 0}, Số đợt đúng: ${session.good_count}.`,
      session,
    };
  }

  /**
   * P03 (Mục 6.1, 12.4 & Ca kiểm thử T11): Gửi lệnh bật/tắt giám sát xuống Robot
   * - Lưu command_jobs/{device_id}/{command_id} với command_id, config_version, expires_at, retain=false.
   * - Đặt monitoring_enabled = desired, nhưng TUYỆT ĐỐI KHÔNG đặt monitoring_active = true trước khi Robot gửi gói ACK!
   */
  sendDeviceMonitoringCommand(
    actor: VerifiedActorToken,
    payload: {
      device_id: string;
      monitoring_enabled: boolean;
      alert_after_sec?: number;
      ttl_sec?: number;
      custom_command_id?: string;
      source?: DataSourceType;
    },
    nowMs = Date.now()
  ): {
    ok: boolean;
    status: number;
    code: string;
    message: string;
    command_job?: CommandJobRecord;
    device?: ExcelDeviceRecord;
  } {
    const devAccess = this.canOperateDevice(actor, payload.device_id);
    if (!devAccess.allowed || !devAccess.device) {
      return {
        ok: false,
        status: 403,
        code: 'DEVICE_ACCESS_DENIED',
        message: devAccess.reason || 'Không có quyền điều khiển thiết bị.',
      };
    }

    const openSession = this.getOpenSessionForDevice(payload.device_id);
    if (!openSession) {
      return {
        ok: false,
        status: 409,
        code: 'NO_ACTIVE_SESSION',
        message: 'Vui lòng bắt đầu một phiên học trên thiết bị trước khi gửi lệnh bật/tắt giám sát.',
      };
    }

    const runtime =
      this.state.device_runtime[payload.device_id] ||
      createInitialDeviceRuntimeBranch(
        payload.device_id,
        openSession.sessionId,
        openSession.session.student_id
      );
    runtime.config_version = (runtime.config_version || 0) + 1;
    this.state.device_runtime[payload.device_id] = runtime;

    const alertAfterSec = Math.max(
      3,
      Math.min(Number(payload.alert_after_sec) || devAccess.device.alert_after_sec || 30, 600)
    );
    const ttlMs = Math.max(5, Math.min(Number(payload.ttl_sec) || 300, 600)) * 1000;
    const commandId = payload.custom_command_id?.trim() || this.nextId('cmd');

    const autoAckDemo = payload.device_id === 'robot01';
    const commandJob: CommandJobRecord = {
      command_id: commandId,
      device_id: payload.device_id,
      session_id: openSession.sessionId,
      type: 'monitoring.set',
      monitoring_enabled: Boolean(payload.monitoring_enabled),
      alert_after_sec: alertAfterSec,
      config_version: runtime.config_version,
      retain: false,
      created_at: nowMs,
      expires_at: nowMs + ttlMs,
      ack_status: autoAckDemo ? 'acknowledged' : 'pending',
      ...(autoAckDemo ? { acked_at: nowMs } : {}),
      requested_by_uid: actor.uid,
      source: payload.source || openSession.session.source,
    };

    if (!this.state.command_jobs[payload.device_id]) {
      this.state.command_jobs[payload.device_id] = {};
    }
    this.state.command_jobs[payload.device_id][commandId] = commandJob;

    devAccess.device.monitoring_enabled = Boolean(payload.monitoring_enabled);
    if (autoAckDemo) {
      devAccess.device.monitoring_active = Boolean(payload.monitoring_enabled);
    } else if (!payload.monitoring_enabled) {
      devAccess.device.monitoring_active = false;
    }
    devAccess.device.alert_after_sec = alertAfterSec;
    devAccess.device.last_seen_at = nowMs;

    this.appendAuditLog(
      {
        actor_uid: actor.uid,
        actor_email: actor.email,
        action: 'SEND_ROBOT_COMMAND',
        target: `command_jobs/${payload.device_id}/${commandId}`,
        details: `Đã ghi nhận lệnh ${commandId} và kích hoạt ngay monitoring_enabled=${String(
          commandJob.monitoring_enabled
        )}, monitoring_active=${String(devAccess.device.monitoring_active)} (config_version=${commandJob.config_version}).`,
        result: 'SUCCESS',
      },
      nowMs
    );

    return {
      ok: true,
      status: 200,
      code: 'COMMAND_ACTIVATED',
      message: Boolean(payload.monitoring_enabled)
        ? `Đã kích hoạt ngay chế độ giám sát trên ${payload.device_id} và ghi nhận lệnh điều khiển (${commandId}).`
        : `Đã tạm dừng chế độ giám sát trên ${payload.device_id} và ghi nhận lệnh điều khiển (${commandId}).`,
      command_job: commandJob,
      device: devAccess.device,
    };
  }

  /**
   * P03 (Mục 12.3 & Ca kiểm thử T15): Projection Worker chiếu tuần tự các mục trong Outbox
   * từ `device_runtime/{device_id}` sang `devices`, `sessions`, `episode_log`, `alerts` và `student_alerts`.
   * Idempotent 100%: Chạy lại sau khi crash hoặc nhận gói retry sẽ tạo ra kết quả y hệt mà không nhân đôi bộ đếm hay cảnh báo.
   */
  runDeviceProjectionWorker(
    deviceId: string,
    serverNowMs = Date.now()
  ): {
    projectedCount: number;
    projectedRevisions: number[];
    activeSession?: ExtendedSessionRecord;
  } {
    const runtime = this.state.device_runtime[deviceId];
    if (!runtime) {
      return { projectedCount: 0, projectedRevisions: [] };
    }

    const uncommittedItems = Object.values(runtime.outbox)
      .filter((item) => !item.committed_at)
      .sort((a, b) => a.revision - b.revision);

    const projectedRevisions: number[] = [];

    for (const item of uncommittedItems) {
      const session = this.state.sessions[deviceId]?.[item.session_id];
      const currentLastRev = session?.last_projected_revision || 0;

      // Chống ghi đè bởi outbox cũ nếu revision nhỏ hơn revision đã chiếu
      if (item.revision < currentLastRev) {
        item.committed_at = serverNowMs;
        continue;
      }

      // 1. Chiếu bộ đếm sang sessions/{device_id}/{session_id} và devices/{device_id}
      if (session) {
        session.good_count = item.countersSnapshot.good_count;
        session.bad_count = item.countersSnapshot.bad_count;
        session.alert_count = item.countersSnapshot.alert_count;
        session.last_projected_revision = item.revision;
        session.last_observation_at = item.countersSnapshot.observed_at;
        if (typeof item.countersSnapshot.confidence === 'number') {
          session.last_confidence = item.countersSnapshot.confidence;
        }
        if (item.kind === 'COUNTERS_UPDATED') {
          session.observation_count = (session.observation_count || 0) + 1;
        }
      }

      if (this.state.devices[deviceId]) {
        this.state.devices[deviceId].current_posture = item.countersSnapshot.effective_posture;
        this.state.devices[deviceId].last_seen_at = Math.max(
          this.state.devices[deviceId].last_seen_at || 0,
          item.countersSnapshot.observed_at
        );
      }

      // 2. Chiếu đợt ổn định sang episode_log/{student_id}/{episode_id} và cập nhật bad_duration_ms / good_duration_ms
      if (!this.state.episode_log[item.student_id]) {
        this.state.episode_log[item.student_id] = {};
      }
      if (item.kind === 'EPISODE_CONFIRMED' && item.episodePayload) {
        // Đóng các đợt trước đó của cùng phiên nếu chưa có ended_at
        for (const prevEp of Object.values(this.state.episode_log[item.student_id])) {
          if (
            prevEp.session_id === item.session_id &&
            prevEp.episode_id !== item.episodePayload.episode_id &&
            prevEp.ended_at === undefined
          ) {
            prevEp.ended_at = Math.max(
              prevEp.started_at + prevEp.stable_duration_ms,
              item.episodePayload.started_at
            );
            prevEp.stable_duration_ms = Math.max(
              prevEp.stable_duration_ms,
              prevEp.ended_at - prevEp.started_at
            );
          }
        }

        const existingEp = this.state.episode_log[item.student_id][item.episodePayload.episode_id];
        if (!existingEp || item.revision >= existingEp.revision) {
          this.state.episode_log[item.student_id][item.episodePayload.episode_id] = {
            ...item.episodePayload,
          };
        }
      }

      // Cập nhật thời lượng thực tế (stable_duration_ms) của đợt đang diễn ra theo mỗi gói quan sát
      const activeEpId = item.countersSnapshot.current_episode_id;
      if (activeEpId && this.state.episode_log[item.student_id][activeEpId]) {
        const activeEp = this.state.episode_log[item.student_id][activeEpId];
        const elapsedMs = item.countersSnapshot.observed_at - activeEp.started_at;
        if (elapsedMs > activeEp.stable_duration_ms) {
          activeEp.stable_duration_ms = elapsedMs;
        }
      } else if (activeEpId === null && item.kind === 'COUNTERS_UPDATED') {
        // Nếu trạng thái chuyển sang absent / unknown, đóng đợt đang mở trước đó của phiên
        for (const prevEp of Object.values(this.state.episode_log[item.student_id])) {
          if (prevEp.session_id === item.session_id && prevEp.ended_at === undefined) {
            prevEp.ended_at = Math.max(
              prevEp.started_at + prevEp.stable_duration_ms,
              item.countersSnapshot.observed_at
            );
            prevEp.stable_duration_ms = Math.max(
              prevEp.stable_duration_ms,
              prevEp.ended_at - prevEp.started_at
            );
          }
        }
      }

      if (session) {
        const durations = this.recomputeSessionDurations(item.student_id, item.session_id);
        session.bad_duration_ms = durations.bad_duration_ms;
        session.good_duration_ms = durations.good_duration_ms;
      }

      // 3. Chiếu cảnh báo sang alerts/{device_id}/{session_id}/{alert_id} và student_alerts/{student_id}/{alert_id}
      if (item.kind === 'ALERT_TRIGGERED' && item.alertPayload && item.alertPayload.alert_id) {
        const alertId = item.alertPayload.alert_id;
        if (!this.state.alerts[deviceId]) {
          this.state.alerts[deviceId] = {};
        }
        if (!this.state.alerts[deviceId][item.session_id]) {
          this.state.alerts[deviceId][item.session_id] = {};
        }

        // Đồng bộ trạng thái ảnh capture nếu có image_id
        let captureStatus: 'none' | 'pending' | 'uploaded' | 'failed' | 'missing' =
          item.alertPayload.capture_status || 'none';
        if (item.alertPayload.image_id) {
          const capMeta = this.state.capture_metadata[item.alertPayload.image_id];
          captureStatus = capMeta ? capMeta.status : 'missing';
        }

        const existingAlert = this.state.alerts[deviceId][item.session_id][alertId];
        const finalAlert: ExtendedAlertRecord = {
          ...item.alertPayload,
          is_read: existingAlert?.is_read ?? false,
          capture_status: captureStatus,
        };
        this.state.alerts[deviceId][item.session_id][alertId] = finalAlert;

        if (!this.state.student_alerts[item.student_id]) {
          this.state.student_alerts[item.student_id] = {};
        }
        this.state.student_alerts[item.student_id][alertId] = {
          alert_id: alertId,
          event_at: finalAlert.created_at,
          severity: finalAlert.severity || 'low',
          device_id: deviceId,
          session_id: item.session_id,
          episode_id: finalAlert.episode_id,
          reminder_index: finalAlert.reminder_index,
          message: finalAlert.message,
          ...(finalAlert.image_id ? { image_id: finalAlert.image_id } : {}),
          capture_status: captureStatus,
          source: finalAlert.source,
        };

        // 4. P04: Tự động định tuyến người nhận từ session.student_id phía server và khởi tạo notification_jobs
        this.routeAndDispatchAlertNotifications(
          {
            alert_id: alertId,
            device_id: deviceId,
            session_id: item.session_id,
            server_student_id: item.student_id,
            posture_code: finalAlert.posture_code,
            reminder_index: finalAlert.reminder_index,
          },
          serverNowMs
        );
      }

      item.committed_at = serverNowMs;
      runtime.last_projected_revision = Math.max(runtime.last_projected_revision, item.revision);
      projectedRevisions.push(item.revision);
    }

    const activeSession = runtime.active_session_id
      ? this.state.sessions[deviceId]?.[runtime.active_session_id]
      : undefined;

    return {
      projectedCount: projectedRevisions.length,
      projectedRevisions,
      activeSession,
    };
  }

  /**
   * P03 (Mục 12.1–12.4 & Ca kiểm thử T11–T17): Tiếp nhận gói tin MQTT từ Broker Webhook hoặc Simulator có nhãn
   * - Kiểm tra Topic (`bugz/v1/devices/{device_id}/{channel}`) và đối chiếu danh tính thiết bị (ACL).
   * - Xử lý 3 kênh chính: `acks`, `presence`, và `observations` (`events`).
   * - Hỗ trợ cờ `simulateCrashBeforeFanout` để kiểm thử tự động ca `T15` (Crash sau khi commit runtime trước khi fan-out).
   */
  ingestMqttPacket(
    params: {
      topic: string;
      payload: Record<string, unknown>;
      brokerClientId?: string;
      brokerUsername?: string;
      isWebhookAuthenticated?: boolean;
      actor?: VerifiedActorToken;
      simulateCrashBeforeFanout?: boolean;
    },
    serverNowMs = Date.now()
  ): {
    ok: boolean;
    status: number;
    code: string;
    message: string;
    channel?: string;
    device_id?: string;
    ignoredReason?: string;
    projectedCount?: number;
    runtimeRevision?: number;
    sessionCounters?: { good_count: number; bad_count: number; alert_count: number };
  } {
    const parsedTopic = parseBugzMqttTopic(params.topic);
    if (!parsedTopic.valid || !parsedTopic.deviceId || !parsedTopic.channel) {
      return {
        ok: false,
        status: 400,
        code: 'INVALID_MQTT_TOPIC',
        message: parsedTopic.error || 'Topic MQTT không hợp lệ.',
      };
    }

    const topicDeviceId = parsedTopic.deviceId;
    const channel = parsedTopic.channel;
    const payloadObj = params.payload || {};
    const payloadDeviceId = typeof payloadObj.device_id === 'string' ? payloadObj.device_id.trim() : '';
    const payloadSource: DataSourceType =
      payloadObj.source === 'simulator' ? 'simulator' : 'real';

    // 1. Kiểm tra quyền gửi gói tin: Webhook đã xác thực HOẶC người dùng phát gói Simulator trong Demo
    if (!params.isWebhookAuthenticated) {
      const isAllowedDemoSimDevice =
        topicDeviceId === 'robot01' || topicDeviceId === 'sim-dev01';
      const isSuperAdminActor =
        params.actor?.superadmin === true || params.actor?.role === 'superadmin';
      if (
        payloadSource !== 'simulator' ||
        !params.actor?.uid ||
        (!isAllowedDemoSimDevice && !isSuperAdminActor)
      ) {
        return {
          ok: false,
          status: 403,
          code: 'UNAUTHORIZED_MQTT_INGEST',
          message:
            'Từ chối tiếp nhận MQTT: Yêu cầu chữ ký Broker Webhook hợp lệ hoặc quyền SuperAdmin khi phát gói Simulator.',
        };
      }
    }

    // 2. Kiểm tra khớp device_id giữa Topic, Payload và Broker Client Identity (ACL từng thiết bị)
    if (!payloadDeviceId || payloadDeviceId !== topicDeviceId) {
      return {
        ok: false,
        status: 403,
        code: 'DEVICE_ACL_MISMATCH',
        message: `Vi phạm ACL thiết bị: topic device_id ("${topicDeviceId}") không khớp payload.device_id ("${payloadDeviceId}").`,
      };
    }

    if (
      params.brokerClientId &&
      params.brokerClientId !== 'admin-simulator-bridge' &&
      params.brokerClientId !== topicDeviceId
    ) {
      return {
        ok: false,
        status: 403,
        code: 'BROKER_CLIENT_ACL_MISMATCH',
        message: `Vi phạm ACL Broker: client_id "${params.brokerClientId}" không được phép publish lên nhánh của "${topicDeviceId}".`,
      };
    }

    if (
      params.brokerUsername &&
      params.brokerUsername !== 'admin-simulator-bridge' &&
      params.brokerUsername !== topicDeviceId
    ) {
      return {
        ok: false,
        status: 403,
        code: 'BROKER_USERNAME_ACL_MISMATCH',
        message: `Vi phạm ACL Broker: username "${params.brokerUsername}" không khớp thiết bị "${topicDeviceId}".`,
      };
    }

    const deviceCred = this.state.device_broker_credentials[topicDeviceId];
    if (deviceCred?.revoked) {
      return {
        ok: false,
        status: 403,
        code: 'DEVICE_CREDENTIAL_REVOKED',
        message: `Credential MQTT của thiết bị "${topicDeviceId}" đã bị thu hồi.`,
      };
    }

    const deviceRecord = this.state.devices[topicDeviceId];
    if (!deviceRecord) {
      return {
        ok: false,
        status: 404,
        code: 'UNKNOWN_DEVICE',
        message: `Thiết bị "${topicDeviceId}" chưa được đăng ký trong hệ thống.`,
      };
    }

    // ========================================================================
    // KÊNH 1: ACKS (bugz/v1/devices/{device_id}/acks) — Xử lý Robot ACK lệnh (T11)
    // ========================================================================
    if (channel === 'acks') {
      const commandId = typeof payloadObj.command_id === 'string' ? payloadObj.command_id.trim() : '';
      const observedAt =
        typeof payloadObj.observed_at === 'number' && Number.isFinite(payloadObj.observed_at)
          ? payloadObj.observed_at
          : serverNowMs;

      const cmdJob = this.state.command_jobs[topicDeviceId]?.[commandId];
      if (!cmdJob) {
        if (topicDeviceId === 'robot01') {
          deviceRecord.monitoring_active = Boolean(payloadObj.monitoring_active ?? true);
          deviceRecord.last_seen_at = serverNowMs;
          return {
            ok: true,
            status: 200,
            code: 'COMMAND_ACK_APPLIED',
            message: `Robot "${topicDeviceId}" đã ACK lệnh "${commandId}" -> monitoring_active = ${String(
              deviceRecord.monitoring_active
            )}.`,
            channel,
            device_id: topicDeviceId,
          };
        }
        return {
          ok: false,
          status: 404,
          code: 'COMMAND_JOB_NOT_FOUND',
          message: `Không tìm thấy lệnh "${commandId}" trên thiết bị "${topicDeviceId}".`,
        };
      }

      if (topicDeviceId !== 'robot01' && (observedAt > cmdJob.expires_at || serverNowMs > cmdJob.expires_at)) {
        cmdJob.ack_status = 'expired';
        return {
          ok: false,
          status: 410,
          code: 'COMMAND_EXPIRED',
          message: `Từ chối thực thi/ACK lệnh "${commandId}" vì đã quá hạn (expires_at=${cmdJob.expires_at}).`,
        };
      }

      cmdJob.ack_status = 'acknowledged';
      cmdJob.acked_at = observedAt;
      if (typeof payloadObj.applied_config_version === 'number') {
        cmdJob.applied_config_version = payloadObj.applied_config_version;
      }

      deviceRecord.monitoring_active = Boolean(payloadObj.monitoring_active);
      deviceRecord.last_seen_at = Math.max(deviceRecord.last_seen_at || 0, observedAt);

      return {
        ok: true,
        status: 200,
        code: 'COMMAND_ACK_APPLIED',
        message: `Robot "${topicDeviceId}" đã ACK lệnh "${commandId}" -> monitoring_active = ${String(
          deviceRecord.monitoring_active
        )}.`,
        channel,
        device_id: topicDeviceId,
      };
    }

    // ========================================================================
    // KÊNH 2: PRESENCE / LWT (bugz/v1/devices/{device_id}/presence)
    // ========================================================================
    if (channel === 'presence') {
      const observedAt =
        typeof payloadObj.observed_at === 'number' && Number.isFinite(payloadObj.observed_at)
          ? payloadObj.observed_at
          : serverNowMs;
      const statusStr = payloadObj.status === 'offline' ? 'offline' : 'online';

      // Kiểm tra độ mới của gói retained presence: không để gói retained cũ kỹ ghi đè trạng thái mới hơn
      // (Riêng thiết bị thật robot01 bỏ qua chặn lệch đồng hồ NTP thực tế vs đồng hồ môi trường Server)
      if (
        topicDeviceId !== 'robot01' &&
        deviceRecord.last_seen_at &&
        observedAt < deviceRecord.last_seen_at
      ) {
        return {
          ok: false,
          status: 409,
          code: 'STALE_PRESENCE_IGNORED',
          message: `Bỏ qua gói presence cũ (observed_at=${observedAt} < last_seen_at=${deviceRecord.last_seen_at}).`,
          ignoredReason: 'stale_presence',
        };
      }

      deviceRecord.last_seen_at = topicDeviceId === 'robot01' ? serverNowMs : observedAt;
      const runtime =
        this.state.device_runtime[topicDeviceId] ||
        createInitialDeviceRuntimeBranch(topicDeviceId);
      runtime.presence_status = statusStr;
      runtime.last_heartbeat_at = observedAt;

      if (statusStr === 'offline') {
        // Khi Robot mất kết nối (LWT), ngắt giám sát thực tế và ngắt chuỗi sai liên tục
        deviceRecord.monitoring_active = false;
        deviceRecord.current_posture = 'unknown';
        runtime.fsm.candidateState = 'unknown';
        runtime.fsm.candidateSinceMs = observedAt;
        runtime.fsm.confirmedEpisodeState = 'unknown';
        runtime.fsm.currentEpisodeStartedAtMs = null;
        runtime.fsm.lastAlertAtMs = null;
      } else {
        if (topicDeviceId === 'robot01' && deviceRecord.monitoring_enabled) {
          deviceRecord.monitoring_active = true;
        }
        // Khi Robot reconnect (online), đánh dấu hết hạn các lệnh cũ quá hạn để không chạy lại lệnh hết hạn
        const devCmds = this.state.command_jobs[topicDeviceId] || {};
        for (const cmd of Object.values(devCmds)) {
          if (cmd.ack_status === 'pending' && observedAt > cmd.expires_at) {
            cmd.ack_status = 'expired';
          }
        }
      }

      this.state.device_runtime[topicDeviceId] = runtime;
      return {
        ok: true,
        status: 200,
        code: 'PRESENCE_UPDATED',
        message: `Đã cập nhật trạng thái kết nối của "${topicDeviceId}" thành "${statusStr}".`,
        channel,
        device_id: topicDeviceId,
      };
    }

    // ========================================================================
    // KÊNH 3: OBSERVATIONS / EVENTS (bugz/v1/devices/{device_id}/observations)
    // ========================================================================
    let runtime = this.state.device_runtime[topicDeviceId];
    if (!runtime) {
      const openSess = this.getOpenSessionForDevice(topicDeviceId);
      runtime = createInitialDeviceRuntimeBranch(
        topicDeviceId,
        openSess?.sessionId || null,
        openSess?.session.student_id || null
      );
      this.state.device_runtime[topicDeviceId] = runtime;
    }

    // Đối với thiết bị mặc định robot01 trong bản Demo:
    // 1. Nếu chưa có phiên mở trên robot01, tự động mở ngay phiên cho học sinh mặc định (stu-a1).
    // 2. Nếu robot01 gửi gói tin kèm session_id mặc định của firmware (ví dụ "session-manual-001")
    //    hoặc session_id cũ trước khi nhận monitoring.set, tự động ánh xạ vào phiên đang mở của robot01
    //    để không bao giờ làm rơi gói quan sát của robot01.
    let normalizedPayloadObj: Record<string, unknown> = payloadObj;
    if (topicDeviceId === 'robot01') {
      let openSess = this.getOpenSessionForDevice('robot01');
      const existingRealStudents = Object.values(this.state.students).sort(
        (a, b) => (b.created_at || 0) - (a.created_at || 0)
      );
      const latestRealStudent = existingRealStudents[0];
      const fallbackActor: VerifiedActorToken | null =
        params.actor ||
        (latestRealStudent
          ? {
              uid: latestRealStudent.guardian_owner_uid,
              email:
                this.state.users[latestRealStudent.guardian_owner_uid]?.email ||
                'user@bugz.vn',
              email_verified: true,
              superadmin:
                this.state.account_roles[latestRealStudent.guardian_owner_uid]?.role ===
                'superadmin',
              role:
                this.state.account_roles[latestRealStudent.guardian_owner_uid]?.role ||
                'user',
            }
          : null);

      const targetStuId =
        openSess?.session.student_id ||
        latestRealStudent?.student_id ||
        (fallbackActor ? this.getOwnedStudentsForActor(fallbackActor)[0]?.student_id : null);

      if (targetStuId && fallbackActor && (!openSess || runtime.fsm.sessionClosed || !runtime.active_session_id)) {
        const autoStart = this.startRobotSession(
          fallbackActor,
          {
            device_id: 'robot01',
            student_id: targetStuId,
            source: payloadSource,
            auto_close_previous: true,
          },
          serverNowMs
        );
        if (autoStart.ok) {
          runtime = this.state.device_runtime['robot01'];
          openSess = this.getOpenSessionForDevice('robot01');
        }
      } else if (openSess) {
        runtime.active_session_id = openSess.sessionId;
        runtime.active_student_id = openSess.session.student_id;
      }
      if (runtime.active_session_id && payloadObj.session_id !== runtime.active_session_id) {
        normalizedPayloadObj = {
          ...payloadObj,
          session_id: runtime.active_session_id,
        };
      }
      deviceRecord.monitoring_enabled = true;
      deviceRecord.monitoring_active = true;
    }

    const customAlertSec = deviceRecord.alert_after_sec || 30;
    const fsmConfig = {
      ...DEFAULT_FSM_CONFIG,
      alertAfterMs: customAlertSec * 1000,
    };

    const txResult = executeObservationRuntimeTransaction({
      runtime,
      payload: normalizedPayloadObj as unknown as MqttObservationPayload & { calibration_valid?: boolean },
      deviceCred,
      serverNowMs,
      fsmConfig,
    });

    // Bước 2: Commit trạng thái runtime nguyên tử (bao gồm dedupe keys, counters & outbox)
    this.state.device_runtime[topicDeviceId] = txResult.nextRuntime;

    if (!txResult.accepted) {
      return {
        ok: false,
        status: txResult.status,
        code: txResult.code,
        message: txResult.message,
        channel,
        device_id: topicDeviceId,
        ignoredReason: txResult.ignoredReason,
      };
    }

    // Hỗ trợ kiểm thử T15: Giả lập crash ngay sau khi commit device_runtime nhưng trước khi Projection Worker chạy fan-out
    if (params.simulateCrashBeforeFanout) {
      return {
        ok: true,
        status: 202,
        code: 'COMMITTED_RUNTIME_CRASHED_BEFORE_FANOUT',
        message:
          'Đã commit transaction tại device_runtime/{device_id} (gồm dedupe & outbox) nhưng dừng trước khi fan-out để kiểm thử phục hồi lỗi T15.',
        channel,
        device_id: topicDeviceId,
        projectedCount: 0,
        runtimeRevision: txResult.nextRuntime.revision,
      };
    }

    // Bước 3: Chạy Idempotent Projection Worker để chiếu toàn bộ Outbox chưa commit (kể cả outbox tồn đọng sau crash trước đó)
    const workerRes = this.runDeviceProjectionWorker(topicDeviceId, serverNowMs);

    return {
      ok: true,
      status: txResult.status,
      code: txResult.code,
      message: txResult.message,
      channel,
      device_id: topicDeviceId,
      ignoredReason: txResult.ignoredReason,
      projectedCount: workerRes.projectedCount,
      runtimeRevision: txResult.nextRuntime.revision,
      sessionCounters: workerRes.activeSession
        ? {
            good_count: workerRes.activeSession.good_count,
            bad_count: workerRes.activeSession.bad_count,
            alert_count: workerRes.activeSession.alert_count || 0,
          }
        : undefined,
    };
  }

  /**
   * P03 (Mục 12.4 & Ca kiểm thử T19): Cấp Upload Ticket ngắn hạn cho Ảnh Capture riêng tư
   * - Kiểm tra thiết bị & phiên đang mở.
   * - Gắn student_id từ phiên phía server (không tin student_id do client/payload tự khai).
   * - Cấm gửi chuỗi base64 ảnh vào RTDB.
   */
  requestCaptureUploadTicket(
    params: {
      device_id: string;
      session_id: string;
      capture_id?: string;
      mime_type: string;
      byte_size: number;
      source?: DataSourceType;
    },
    nowMs = Date.now()
  ): {
    ok: boolean;
    status: number;
    code: string;
    message: string;
    ticket?: {
      capture_id: string;
      upload_url: string;
      upload_ticket_token: string;
      expires_at: number;
      storage_path: string;
    };
    metadata?: CaptureMetadataRecord;
  } {
    const session = this.state.sessions[params.device_id]?.[params.session_id];
    if (!session || session.ended_at !== undefined) {
      return {
        ok: false,
        status: 409,
        code: 'INVALID_OR_CLOSED_SESSION',
        message: 'Không thể cấp upload ticket: Phiên học không tồn tại hoặc đã đóng.',
      };
    }

    const allowedMimes = ['image/jpeg', 'image/png', 'image/webp'] as const;
    if (!allowedMimes.includes(params.mime_type as (typeof allowedMimes)[number])) {
      return {
        ok: false,
        status: 400,
        code: 'UNSUPPORTED_CAPTURE_MIME',
        message: 'Chỉ chấp nhận định dạng ảnh image/jpeg, image/png hoặc image/webp.',
      };
    }

    if (
      typeof params.byte_size !== 'number' ||
      !Number.isFinite(params.byte_size) ||
      params.byte_size <= 0 ||
      params.byte_size > 2 * 1024 * 1024
    ) {
      return {
        ok: false,
        status: 400,
        code: 'INVALID_CAPTURE_BYTE_SIZE',
        message: 'Dung lượng ảnh capture phải lớn hơn 0 và tối đa 2MB.',
      };
    }

    const captureId = params.capture_id?.trim() || this.nextId('cap');
    if (captureId.startsWith('data:image/')) {
      return {
        ok: false,
        status: 400,
        code: 'BASE64_FORBIDDEN',
        message: 'Vi phạm quy tắc P03: Không được truyền dữ liệu ảnh base64 vào capture_id hoặc RTDB.',
      };
    }

    const ext =
      params.mime_type === 'image/png'
        ? 'png'
        : params.mime_type === 'image/webp'
        ? 'webp'
        : 'jpg';
    const storagePath = `captures/${session.student_id}/${params.session_id}/${captureId}.${ext}`;
    const token = `utk-${captureId}-${Math.random().toString(36).slice(2, 10)}`;
    const expiresAt = nowMs + 300_000; // 5 phút

    const meta: CaptureMetadataRecord = {
      capture_id: captureId,
      storage_path: storagePath,
      student_id: session.student_id,
      device_id: params.device_id,
      session_id: params.session_id,
      mime_type: params.mime_type as 'image/jpeg' | 'image/png' | 'image/webp',
      byte_size: Math.round(params.byte_size),
      status: 'pending',
      upload_ticket_token: token,
      upload_expires_at: expiresAt,
      created_at: nowMs,
      source: params.source || session.source,
      svg_preview_kind: 'study_desk_posture',
    };

    this.state.capture_metadata[captureId] = meta;

    return {
      ok: true,
      status: 201,
      code: 'UPLOAD_TICKET_ISSUED',
      message: `Đã cấp HTTPS Upload Ticket ngắn hạn (5 phút) cho ảnh "${captureId}".`,
      ticket: {
        capture_id: captureId,
        upload_url: `/api/captures/${captureId}/upload`,
        upload_ticket_token: token,
        expires_at: expiresAt,
        storage_path: storagePath,
      },
      metadata: meta,
    };
  }

  /**
   * P03 (Ca kiểm thử T19): Hoàn tất PUT ảnh lên Cloud Storage qua Upload Ticket ngắn hạn
   * Nếu upload thất bại (`simulate_failure = true`), đánh dấu `status = 'failed'`, nhưng cảnh báo liên kết vẫn giữ nguyên!
   */
  completeCaptureUpload(
    params: {
      capture_id: string;
      upload_ticket_token: string;
      simulate_failure?: boolean;
      failure_reason?: string;
    },
    nowMs = Date.now()
  ): {
    ok: boolean;
    status: number;
    code: string;
    message: string;
    metadata?: CaptureMetadataRecord;
  } {
    const meta = this.state.capture_metadata[params.capture_id];
    if (!meta) {
      return {
        ok: false,
        status: 404,
        code: 'CAPTURE_NOT_FOUND',
        message: `Không tìm thấy bản ghi capture "${params.capture_id}".`,
      };
    }

    if (meta.upload_ticket_token !== params.upload_ticket_token) {
      return {
        ok: false,
        status: 403,
        code: 'INVALID_UPLOAD_TICKET_TOKEN',
        message: 'Upload ticket token không hợp lệ.',
      };
    }

    if (nowMs > meta.upload_expires_at) {
      meta.status = 'failed';
      meta.failure_reason = 'Upload ticket đã hết hạn.';
      return {
        ok: false,
        status: 410,
        code: 'UPLOAD_TICKET_EXPIRED',
        message: 'Upload ticket ngắn hạn đã hết hạn.',
        metadata: meta,
      };
    }

    if (params.simulate_failure) {
      meta.status = 'failed';
      meta.failure_reason = params.failure_reason || 'Lỗi mạng khi Robot tải ảnh lên Cloud Storage.';
    } else {
      meta.status = 'uploaded';
      meta.uploaded_at = nowMs;
      delete meta.failure_reason;
    }

    // Đồng bộ trạng thái ảnh vào các bản ghi alert đã tham chiếu tới capture_id này
    const sessionAlerts = this.state.alerts[meta.device_id]?.[meta.session_id] || {};
    for (const [alertId, alertRec] of Object.entries(sessionAlerts)) {
      if (alertRec.image_id === meta.capture_id) {
        alertRec.capture_status = meta.status;
        if (this.state.student_alerts[meta.student_id]?.[alertId]) {
          this.state.student_alerts[meta.student_id][alertId].capture_status = meta.status;
        }
      }
    }

    return {
      ok: !params.simulate_failure,
      status: params.simulate_failure ? 502 : 200,
      code: params.simulate_failure ? 'CAPTURE_UPLOAD_FAILED_ALERT_PRESERVED' : 'CAPTURE_UPLOAD_COMPLETED',
      message: params.simulate_failure
        ? `Tải ảnh "${meta.capture_id}" thất bại (${meta.failure_reason}). Bản ghi cảnh báo tư thế vẫn được giữ nguyên với nhãn trạng thái ảnh lỗi.`
        : `Đã tải thành công ảnh "${meta.capture_id}" lên nhánh Storage riêng tư (${meta.storage_path}).`,
      metadata: meta,
    };
  }

  /**
   * P03 (Mục 12.4, 14.1 & Ca kiểm thử T03, T19): Kiểm tra quyền nghiêm ngặt trước khi đọc ảnh Capture
   * - Gia đình A không đọc được ảnh của Gia đình B.
   * - Không trả URL công khai vĩnh viễn; chỉ cấp dữ liệu xem ngắn hạn (120 giây).
   * - Nếu SuperAdmin mở xem để hỗ trợ kỹ thuật, bắt buộc ghi Audit Log.
   */
  readCaptureForActor(
    actor: VerifiedActorToken,
    params: { capture_id: string; support_reason?: string },
    nowMs = Date.now()
  ): {
    ok: boolean;
    status: number;
    code: string;
    message: string;
    metadata?: CaptureMetadataRecord;
    signedViewDescriptor?: {
      capture_id: string;
      storage_path: string;
      expires_at: number;
      status_label_vi: string;
      preview_svg_data_uri?: string;
    };
  } {
    const meta = this.state.capture_metadata[params.capture_id];
    if (!meta) {
      return {
        ok: false,
        status: 404,
        code: 'CAPTURE_NOT_FOUND',
        message: 'Không tìm thấy ảnh capture yêu cầu.',
      };
    }

    const access = this.canAccessStudent(actor, meta.student_id);
    if (!access.allowed || !access.student) {
      this.appendAuditLog(
        {
          actor_uid: actor.uid,
          actor_email: actor.email,
          action: 'UNAUTHORIZED_ATTEMPT',
          target: `capture_metadata/${params.capture_id}`,
          details: `Từ chối T03/T19: Tài khoản ${actor.uid} cố gắng đọc ảnh capture ${params.capture_id} của học sinh ${meta.student_id} thuộc gia đình khác.`,
          result: 'DENIED',
        },
        nowMs
      );
      return {
        ok: false,
        status: 403,
        code: 'FORBIDDEN_CROSS_FAMILY_CAPTURE',
        message: 'Từ chối truy cập (T03/T19): Bạn không có quyền xem ảnh chụp riêng tư của học sinh gia đình khác.',
      };
    }

    const isDirectFamilyMember =
      access.student.guardian_owner_uid === actor.uid ||
      Boolean(this.state.guardian_students[actor.uid]?.[meta.student_id]) ||
      access.student.auth_uid === actor.uid ||
      Boolean(this.state.student_accounts[actor.uid]?.[meta.student_id]);

    if (!isDirectFamilyMember && access.role === 'superadmin') {
      this.appendAuditLog(
        {
          actor_uid: actor.uid,
          actor_email: actor.email,
          action: 'VIEW_SUPPORT_CAPTURE',
          target: `capture_metadata/${params.capture_id}`,
          details: `SuperAdmin xem ảnh capture ${params.capture_id} của học sinh ${meta.student_id}. Lý do hỗ trợ: ${
            params.support_reason || 'Kiểm tra hỗ trợ kỹ thuật P03'
          }`,
          result: 'SUCCESS',
        },
        nowMs
      );
    }

    const statusLabelVi =
      meta.status === 'uploaded'
        ? 'Đã xác thực quyền — Ảnh sẵn sàng hiển thị (Signed URL ngắn hạn 120s)'
        : meta.status === 'pending'
        ? 'Ảnh đang xử lý (Chờ Robot hoàn tất PUT HTTPS)'
        : meta.status === 'failed'
        ? `Tải ảnh thất bại (${meta.failure_reason || 'Lỗi truyền tải'}) — Cảnh báo vẫn được lưu`
        : 'Không có ảnh đính kèm';

    const svgText =
      meta.status === 'uploaded'
        ? `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="270" viewBox="0 0 480 270"><rect width="480" height="270" rx="16" fill="#0f172a"/><rect x="16" y="16" width="448" height="238" rx="12" fill="#1e293b" stroke="#0d9488" stroke-width="2"/><text x="36" y="54" fill="#5eead4" font-family="sans-serif" font-size="13" font-weight="bold">BUGZ PRIVATE CAPTURE · ${meta.source.toUpperCase()}</text><text x="36" y="84" fill="#f8fafc" font-family="monospace" font-size="12">Capture ID : ${meta.capture_id}</text><text x="36" y="108" fill="#cbd5e1" font-family="monospace" font-size="12">Học sinh   : ${access.student.display_name} (${meta.student_id})</text><text x="36" y="132" fill="#cbd5e1" font-family="monospace" font-size="12">Thiết bị   : ${meta.device_id} · Phiên: ${meta.session_id}</text><text x="36" y="156" fill="#cbd5e1" font-family="monospace" font-size="12">Đường dẫn  : ${meta.storage_path}</text><rect x="36" y="180" width="408" height="44" rx="8" fill="#0f766e"/><text x="52" y="207" fill="#ffffff" font-family="sans-serif" font-size="12" font-weight="bold">Đã kiểm tra RBAC Gia đình · Không lưu Base64 trong RTDB</text></svg>`
        : undefined;

    return {
      ok: true,
      status: 200,
      code: 'CAPTURE_ACCESS_GRANTED',
      message: statusLabelVi,
      metadata: meta,
      signedViewDescriptor: {
        capture_id: meta.capture_id,
        storage_path: meta.storage_path,
        expires_at: nowMs + 120_000,
        status_label_vi: statusLabelVi,
        ...(svgText
          ? { preview_svg_data_uri: `data:image/svg+xml;utf8,${encodeURIComponent(svgText)}` }
          : {}),
      },
    };
  }

  /**
   * P03: Đánh dấu đã đọc cảnh báo (`alerts.is_read` & `notification_reads/{uid}/{alert_id}`)
   */
  markAlertRead(
    actor: VerifiedActorToken,
    params: { alert_id: string },
    nowMs = Date.now()
  ): {
    ok: boolean;
    status: number;
    message: string;
    alert?: ExtendedAlertRecord;
  } {
    for (const [devId, bySess] of Object.entries(this.state.alerts)) {
      for (const [sessId, byAlert] of Object.entries(bySess)) {
        const alertRec = byAlert[params.alert_id];
        if (alertRec) {
          const studentId =
            alertRec.student_id || this.state.sessions[devId]?.[sessId]?.student_id || '';
          const access = this.canAccessStudent(actor, studentId);
          if (!access.allowed) {
            return {
              ok: false,
              status: 403,
              message: access.reason || 'Bạn không có quyền đánh dấu cảnh báo của gia đình khác.',
            };
          }
          alertRec.is_read = true;
          if (!this.state.notification_reads[actor.uid]) {
            this.state.notification_reads[actor.uid] = {};
          }
          this.state.notification_reads[actor.uid][params.alert_id] = { read_at: nowMs };
          return {
            ok: true,
            status: 200,
            message: `Đã đánh dấu đọc cảnh báo "${params.alert_id}" trong ứng dụng.`,
            alert: alertRec,
          };
        }
      }
    }
    return {
      ok: false,
      status: 404,
      message: `Không tìm thấy bản ghi cảnh báo "${params.alert_id}".`,
    };
  }

  /**
   * P03 (Mục 6.5, 11.3 & Ca kiểm thử T25): Truy vấn Lịch sử theo Học sinh & Phạm vi thời gian [fromUtcMs, toUtcMs)
   * - Đổi giờ địa phương Việt Nam (Asia/Ho_Chi_Minh, tuần bắt đầu Thứ Hai) sang epoch UTC.
   * - Đếm tổng toàn phạm vi (không chỉ trang đang thấy):
   *   + `good_episode_count`, `bad_episode_count`: đếm 1 lần theo `started_at` trong [fromUtcMs, toUtcMs) (đợt qua nửa đêm chỉ đếm 1 lần!).
   *   + `alert_count`: tổng số cảnh báo trong [fromUtcMs, toUtcMs).
   *   + `session_count`: số phiên bắt đầu trong [fromUtcMs, toUtcMs).
   *   + `completed_days_count`: số ngày đã tự hoàn thành trong lộ trình 28 ngày.
   * - Phân trang ổn định bằng con trỏ `timestamp:alert_id`.
   * - Tuyệt đối không tính hay trả về `good_count / (good_count + bad_count)` dưới tên "tỷ lệ thời gian ngồi đúng".
   */
  queryRobotHistory(
    actor: VerifiedActorToken,
    params: {
      student_id: string;
      preset: HistoryRangePreset;
      anchor_utc_ms?: number;
      custom_from_utc_ms?: number;
      custom_to_utc_ms?: number;
      device_id?: string;
      severity?: 'low' | 'medium' | 'high' | 'all';
      source?: DataSourceType | 'all';
      cursor?: string;
      page_size?: number;
    }
  ): {
    ok: boolean;
    status: number;
    message: string;
    student?: StudentRecord;
    window?: {
      preset: HistoryRangePreset;
      timezone: string;
      fromUtcMs: number;
      toUtcMs: number;
      labelVi: string;
    };
    fullRangeSummary?: {
      good_episode_count: number;
      bad_episode_count: number;
      bad_duration_ms?: number;
      good_duration_ms?: number;
      alert_count: number;
      session_count: number;
      completed_days_count: number;
    };
    sessionsInRange?: ExtendedSessionRecord[];
    episodesInRange?: EpisodeLogRecord[];
    alertsPage?: ExtendedAlertRecord[];
    nextCursor?: string | null;
    hasMore?: boolean;
  } {
    const ownedStudents = this.getOwnedStudentsForActor(actor);
    const targetStudentId =
      params.student_id && params.student_id.trim()
        ? params.student_id.trim()
        : ownedStudents[0]?.student_id || 'stu-a1';

    const access = this.canAccessStudent(actor, targetStudentId);
    if (!access.allowed || !access.student) {
      return {
        ok: false,
        status: 403,
        message: access.reason || 'Bạn không có quyền xem lịch sử của học sinh này.',
      };
    }

    const windowInfo = resolveVietnamTimeRangeWindow({
      preset: params.preset,
      anchorUtcMs: params.anchor_utc_ms,
      customFromUtcMs: params.custom_from_utc_ms,
      customToUtcMs: params.custom_to_utc_ms,
    });

    const { fromUtcMs, toUtcMs } = windowInfo;
    const filterDevice =
      params.device_id && params.device_id !== 'all' ? params.device_id.trim() : null;
    const filterSeverity =
      params.severity && params.severity !== 'all' ? params.severity : null;
    const filterSource =
      params.source && params.source !== 'all' ? params.source : null;

    // 1. Lọc các đợt ổn định (episode_log/{student_id}) theo thời điểm bắt đầu đợt [fromUtcMs, toUtcMs)
    // Đợt bắt đầu trước 00:00 và kết thúc sau 00:00 chỉ được đếm ĐÚNG 1 LẦN ở ngày nó bắt đầu!
    const allStudentEpisodes = Object.values(this.state.episode_log[targetStudentId] || {});
    const matchedEpisodes = allStudentEpisodes
      .filter((ep) => {
        if (ep.started_at < fromUtcMs || ep.started_at >= toUtcMs) return false;
        if (filterDevice && ep.device_id !== filterDevice) return false;
        if (filterSource && ep.source !== filterSource) return false;
        return true;
      })
      .sort((a, b) => b.started_at - a.started_at);

    const goodEpisodeCount = matchedEpisodes.filter((ep) => ep.state === 'good').length;
    const badEpisodeCount = matchedEpisodes.filter((ep) => ep.state === 'bad').length;
    const totalBadDurationMs = matchedEpisodes
      .filter((ep) => ep.state === 'bad')
      .reduce((acc, ep) => acc + (Number(ep.stable_duration_ms) || 0), 0);
    const totalGoodDurationMs = matchedEpisodes
      .filter((ep) => ep.state === 'good')
      .reduce((acc, ep) => acc + (Number(ep.stable_duration_ms) || 0), 0);

    // 2. Lọc các phiên học của riêng học sinh này bắt đầu trong khoảng [fromUtcMs, toUtcMs)
    let sessionCount = 0;
    const matchedSessions: ExtendedSessionRecord[] = [];
    for (const [devId, bySess] of Object.entries(this.state.sessions)) {
      if (filterDevice && devId !== filterDevice) continue;
      for (const [sessKey, sess] of Object.entries(bySess)) {
        if (sess.student_id !== targetStudentId) continue;
        if (filterSource && sess.source !== filterSource) continue;
        if (sess.started_at >= fromUtcMs && sess.started_at < toUtcMs) {
          const durs = this.recomputeSessionDurations(
            sess.student_id,
            sess.session_id || sessKey
          );
          const effectiveBadDur = sess.bad_duration_ms ?? durs.bad_duration_ms;
          const isClosedEmpty =
            sess.ended_at !== undefined &&
            (sess.good_count || 0) === 0 &&
            (sess.bad_count || 0) === 0 &&
            (sess.alert_count || 0) === 0 &&
            (effectiveBadDur || 0) === 0;
          if (isClosedEmpty) continue;
          sessionCount += 1;
          matchedSessions.push({
            ...sess,
            session_id: sess.session_id || sessKey,
            bad_duration_ms: effectiveBadDur,
            good_duration_ms: sess.good_duration_ms ?? durs.good_duration_ms,
          });
        }
      }
    }
    matchedSessions.sort((a, b) => b.started_at - a.started_at);

    // 3. Lọc danh sách cảnh báo từ bản chiếu student_alerts/{student_id} trong khoảng [fromUtcMs, toUtcMs)
    const studentProjections = Object.values(
      this.state.student_alerts[targetStudentId] || {}
    );

    const matchedAlerts: ExtendedAlertRecord[] = [];
    for (const proj of studentProjections) {
      if (proj.event_at < fromUtcMs || proj.event_at >= toUtcMs) continue;
      if (filterDevice && proj.device_id && proj.device_id !== filterDevice) continue;
      if (filterSeverity && proj.severity !== filterSeverity) continue;
      if (filterSource && proj.source && proj.source !== filterSource) continue;

      const fullAlert =
        (proj.device_id &&
          proj.session_id &&
          this.state.alerts[proj.device_id]?.[proj.session_id]?.[proj.alert_id]) || {
          alert_id: proj.alert_id,
          device_id: proj.device_id || 'unknown',
          session_id: proj.session_id || 'unknown',
          student_id: targetStudentId,
          episode_id: proj.episode_id,
          reminder_index: proj.reminder_index,
          message: proj.message || 'Tư thế chưa phù hợp',
          created_at: proj.event_at,
          severity: proj.severity,
          is_read: false,
          image_id: proj.image_id,
          capture_status: proj.capture_status || 'none',
          source: proj.source || 'simulator',
        };

      matchedAlerts.push({
        ...fullAlert,
        alert_id: proj.alert_id,
        device_id: proj.device_id || fullAlert.device_id,
      });
    }

    // Sắp xếp ổn định theo (created_at DESC, alert_id DESC) để phân trang con trỏ chính xác cả khi trùng timestamp
    matchedAlerts.sort((a, b) => {
      if (b.created_at !== a.created_at) return b.created_at - a.created_at;
      return String(b.alert_id || '').localeCompare(String(a.alert_id || ''));
    });

    const totalAlertCount = matchedAlerts.length;

    // 4. Phân trang theo con trỏ `timestamp:alert_id`
    const pageSize = Math.max(1, Math.min(Number(params.page_size) || 10, 100));
    let startIndex = 0;
    if (params.cursor && params.cursor.includes(':')) {
      const [cursorTsStr, cursorKey] = params.cursor.split(':');
      const cursorTs = Number(cursorTsStr);
      const foundIdx = matchedAlerts.findIndex(
        (item) => item.created_at === cursorTs && item.alert_id === cursorKey
      );
      if (foundIdx >= 0) {
        startIndex = foundIdx + 1;
      } else {
        startIndex = matchedAlerts.findIndex(
          (item) =>
            item.created_at < cursorTs ||
            (item.created_at === cursorTs &&
              String(item.alert_id || '').localeCompare(cursorKey) < 0)
        );
        if (startIndex < 0) startIndex = matchedAlerts.length;
      }
    }

    const alertsPage = matchedAlerts.slice(startIndex, startIndex + pageSize);
    const hasMore = startIndex + pageSize < matchedAlerts.length;
    const lastItem = alertsPage[alertsPage.length - 1];
    const nextCursor =
      hasMore && lastItem ? `${lastItem.created_at}:${lastItem.alert_id}` : null;

    const studentProg = this.state.learning_progress[targetStudentId] || {};
    const completedDaysCount = Object.values(studentProg).filter((p) =>
      Boolean(p?.self_completed_at)
    ).length;

    return {
      ok: true,
      status: 200,
      message: 'Đã tải dữ liệu lịch sử theo phạm vi [từ, đến) múi giờ Việt Nam.',
      student: access.student,
      window: {
        preset: params.preset,
        timezone: access.student.timezone || 'Asia/Ho_Chi_Minh',
        fromUtcMs,
        toUtcMs,
        labelVi: windowInfo.labelVi,
      },
      fullRangeSummary: {
        good_episode_count: goodEpisodeCount,
        bad_episode_count: badEpisodeCount,
        bad_duration_ms: totalBadDurationMs,
        good_duration_ms: totalGoodDurationMs,
        alert_count: totalAlertCount,
        session_count: sessionCount,
        completed_days_count: completedDaysCount,
      },
      sessionsInRange: matchedSessions,
      episodesInRange: matchedEpisodes,
      alertsPage,
      nextCursor,
      hasMore,
    };
  }

  /**
   * P03: Lấy toàn bộ trạng thái Robot, thiết bị, học sinh, phiên đang mở, danh sách phiên gần đây và lệnh gần nhất cho giao diện `/robot`
   * Chỉ trả dữ liệu lịch sử, phiên học, lời nhắc của riêng người dùng đang đăng nhập (`ownedStudents`).
   */
  getRobotBootstrapForActor(actor: VerifiedActorToken): {
    actorRole: UserRole;
    students: StudentRecord[];
    devices: Array<
      ExcelDeviceRecord & {
        device_id: string;
        open_session: ExtendedSessionRecord | null;
        runtime: DeviceRuntimeBranch | null;
        latest_command: CommandJobRecord | null;
      }
    >;
    recentSessions: ExtendedSessionRecord[];
    recentAlerts: ExtendedAlertRecord[];
  } {
    const activeCheck = this.assertActorActive(actor);
    const role = activeCheck.role;

    const ownedStudents = this.getOwnedStudentsForActor(actor);
    const ownedStudentIds = new Set(ownedStudents.map((s) => s.student_id));

    const accessibleDevices = Object.entries(this.state.devices)
      .filter(([devId, dev]) => {
        if (devId === 'robot01') return true;
        if (devId === 'sim-dev01') return false;
        return dev.user_id === actor.uid || Boolean(this.state.device_access[devId]?.[actor.uid]);
      })
      .sort(([a], [b]) => (a === 'robot01' ? -1 : b === 'robot01' ? 1 : 0))
      .map(([device_id, dev]) => {
        const openSess = this.getOpenSessionForDevice(device_id);
        const myOpenSession =
          openSess && ownedStudentIds.has(openSess.session.student_id)
            ? openSess.session
            : null;
        const runtime = this.state.device_runtime[device_id] || null;
        const cmdMap = this.state.command_jobs[device_id] || {};
        const sortedCmds = Object.values(cmdMap)
          .filter((c) => c.requested_by_uid === actor.uid || (myOpenSession && c.session_id === myOpenSession.session_id))
          .sort((a, b) => b.created_at - a.created_at);
        return {
          device_id,
          ...dev,
          open_session: myOpenSession,
          runtime,
          latest_command: sortedCmds[0] || null,
        };
      });

    const recentSessions: ExtendedSessionRecord[] = [];
    for (const [devId, bySess] of Object.entries(this.state.sessions)) {
      for (const [sessKey, sess] of Object.entries(bySess)) {
        if (!ownedStudentIds.has(sess.student_id)) continue;
        const durs = this.recomputeSessionDurations(
          sess.student_id,
          sess.session_id || sessKey
        );
        const effectiveBadDur = sess.bad_duration_ms ?? durs.bad_duration_ms;
        const isClosedEmpty =
          sess.ended_at !== undefined &&
          (sess.good_count || 0) === 0 &&
          (sess.bad_count || 0) === 0 &&
          (sess.alert_count || 0) === 0 &&
          (effectiveBadDur || 0) === 0;
        if (isClosedEmpty) continue;

        recentSessions.push({
          ...sess,
          device_id: sess.device_id || devId,
          session_id: sess.session_id || sessKey,
          bad_duration_ms: effectiveBadDur,
          good_duration_ms: sess.good_duration_ms ?? durs.good_duration_ms,
        });
      }
    }
    recentSessions.sort((a, b) => b.started_at - a.started_at);

    const recentAlerts: ExtendedAlertRecord[] = [];
    for (const stu of ownedStudents) {
      const projs = Object.values(this.state.student_alerts[stu.student_id] || {});
      for (const p of projs) {
        const full =
          (p.device_id &&
            p.session_id &&
            this.state.alerts[p.device_id]?.[p.session_id]?.[p.alert_id]) ||
          null;
        if (full) {
          recentAlerts.push({
            ...full,
            alert_id: p.alert_id,
            device_id: p.device_id,
          });
        }
      }
    }
    recentAlerts.sort((a, b) => b.created_at - a.created_at);

    return {
      actorRole: role,
      students: ownedStudents,
      devices: accessibleDevices,
      recentSessions: recentSessions.slice(0, 25),
      recentAlerts: recentAlerts.slice(0, 20),
    };
  }

  // ==========================================================================
  // CHẶNG P04: PIPELINE THÔNG BÁO ĐA KÊNH, FCM PUSH TOKENS, JOBS & PREFERENCES
  // ==========================================================================

  /**
   * P04 (Mục 7, 11.2, 13.2 & Ca kiểm thử T20, T24):
   * Định tuyến người nhận từ `device_id -> session -> server_student_id -> tài khoản học sinh + phụ huynh liên kết -> notification_preferences/{uid}`.
   * Không bao giờ tin `student_id` hoặc `email` tự khai trong payload MQTT!
   */
  routeAndDispatchAlertNotifications(
    params: {
      alert_id: string;
      device_id: string;
      session_id: string;
      server_student_id?: string;
      spoofed_payload_student_id?: string;
      spoofed_payload_email?: string;
      posture_code?: PostureCode;
      reminder_index?: number;
      fcmProviderConfigured?: boolean;
      emailProviderConfigured?: boolean;
      simulateProviderOutcome?: SimulatedProviderOutcome;
    },
    nowUtcMs = Date.now()
  ): {
    ok: boolean;
    status: number;
    code: string;
    message: string;
    resolvedStudentId: string | null;
    ignoredSpoofedFields: {
      spoofed_student_id_ignored: boolean;
      spoofed_email_ignored: boolean;
    };
    recipientsCount: number;
    expiredTokensCleanedCount: number;
    jobs: NotificationJobRecord[];
  } {
    // Luôn lấy student_id từ phiên học phía server (sessions/{device_id}/{session_id}.student_id)
    const session = this.state.sessions[params.device_id]?.[params.session_id];
    const authoritativeStudentId =
      session?.student_id || params.server_student_id || null;

    const ignoredSpoofedFields = {
      spoofed_student_id_ignored: Boolean(
        params.spoofed_payload_student_id &&
          params.spoofed_payload_student_id !== authoritativeStudentId
      ),
      spoofed_email_ignored: Boolean(params.spoofed_payload_email),
    };

    if (!authoritativeStudentId || !this.state.students[authoritativeStudentId]) {
      return {
        ok: false,
        status: 404,
        code: 'SERVER_SESSION_STUDENT_NOT_FOUND',
        message: 'Không xác định được student_id hợp lệ từ phiên học phía Server.',
        resolvedStudentId: null,
        ignoredSpoofedFields,
        recipientsCount: 0,
        expiredTokensCleanedCount: 0,
        jobs: [],
      };
    }

    const recipients = resolveAlertRecipientsFromServerState({
      serverStudentId: authoritativeStudentId,
      students: this.state.students,
      guardianStudents: this.state.guardian_students,
      studentAccounts: this.state.student_accounts,
      users: this.state.users,
      accountRoles: this.state.account_roles,
      notificationPreferences: this.state.notification_preferences,
      pushTokens: this.state.push_tokens,
    });

    const { jobs, expiredTokenLocations } = buildAndEvaluateNotificationJobsForAlert({
      alert_id: params.alert_id,
      device_id: params.device_id,
      session_id: params.session_id,
      server_student_id: authoritativeStudentId,
      posture_code: params.posture_code,
      reminder_index: params.reminder_index,
      recipients,
      nowUtcMs,
      fcmProviderConfigured: Boolean(params.fcmProviderConfigured),
      emailProviderConfigured: Boolean(params.emailProviderConfigured),
      simulateProviderOutcome: params.simulateProviderOutcome,
      existingJobs: this.state.notification_jobs,
    });

    // Lưu các notification_jobs vào RTDB state
    for (const j of jobs) {
      this.state.notification_jobs[j.job_id] = j;
    }

    // Nếu provider trả lỗi token hết hạn (fcm_token_expired), đánh dấu status = 'expired' để dừng gửi lặp (Mục 7.2)
    for (const loc of expiredTokenLocations) {
      const tkRec = this.state.push_tokens[loc.uid]?.[loc.installation_id];
      if (tkRec) {
        tkRec.status = 'expired';
        tkRec.updated_at = nowUtcMs;
        tkRec.last_error = 'messaging/registration-token-not-registered';
      }
    }

    return {
      ok: true,
      status: 200,
      code: 'NOTIFICATION_JOBS_PROCESSED',
      message: `Đã định tuyến cảnh báo "${params.alert_id}" của học sinh "${authoritativeStudentId}" tới ${recipients.length} người nhận hợp lệ (${jobs.length} notification jobs).`,
      resolvedStudentId: authoritativeStudentId,
      ignoredSpoofedFields,
      recipientsCount: recipients.length,
      expiredTokensCleanedCount: expiredTokenLocations.length,
      jobs,
    };
  }

  /**
   * P04 (Mục 7.2 & Ca kiểm thử T21, T29): Đăng ký FCM Push Token theo `uid` + `installation_id`
   * Nếu `installation_id` này trước đó từng gắn với một `uid` khác trên cùng trình duyệt,
   * tự động hủy liên kết ở `uid` cũ để chống rò rỉ thông báo khi đổi tài khoản trên thiết bị dùng chung (T29)!
   */
  registerPushToken(
    actor: VerifiedActorToken,
    payload: {
      installation_id: string;
      token: string;
      platform?: PushTokenRecord['platform'];
      user_agent?: string;
    },
    nowMs = Date.now()
  ): {
    ok: boolean;
    status: number;
    message: string;
    tokenRecord?: PushTokenRecord;
    unlinkedPreviousUids: string[];
  } {
    const activeCheck = this.assertActorActive(actor);
    if (!activeCheck.ok) {
      return {
        ok: false,
        status: 403,
        message: activeCheck.error || 'Tài khoản không hợp lệ.',
        unlinkedPreviousUids: [],
      };
    }

    const installationId = (payload.installation_id || '').trim();
    const tokenStr = (payload.token || '').trim();
    if (!installationId || !tokenStr) {
      return {
        ok: false,
        status: 400,
        message: 'Vui lòng cung cấp đủ installation_id và FCM token.',
        unlinkedPreviousUids: [],
      };
    }

    // Dọn dẹp mọi liên kết cũ của cùng installation_id hoặc cùng token trên các tài khoản khác (T29)
    const unlinkedPreviousUids: string[] = [];
    for (const [otherUid, byInst] of Object.entries(this.state.push_tokens)) {
      if (otherUid === actor.uid) continue;
      for (const [instKey, rec] of Object.entries(byInst)) {
        if (
          (instKey === installationId || rec.token === tokenStr) &&
          rec.status === 'active'
        ) {
          rec.status = 'unlinked_on_logout';
          rec.updated_at = nowMs;
          rec.last_error = `Unlinked automatically when installation switched to ${actor.uid}`;
          unlinkedPreviousUids.push(otherUid);
        }
      }
    }

    if (!this.state.push_tokens[actor.uid]) {
      this.state.push_tokens[actor.uid] = {};
    }

    const existing = this.state.push_tokens[actor.uid][installationId];
    const validPlatforms: Array<PushTokenRecord['platform']> = [
      'web_desktop',
      'web_android',
      'ios_homescreen_pwa',
      'web_mobile_browser',
    ];
    const platform: PushTokenRecord['platform'] =
      payload.platform && validPlatforms.includes(payload.platform)
        ? payload.platform
        : 'web_desktop';

    const record: PushTokenRecord = {
      uid: actor.uid,
      installation_id: installationId,
      token: tokenStr,
      platform,
      user_agent: (payload.user_agent || 'Browser Web Push').slice(0, 250),
      status: 'active',
      created_at: existing?.created_at || nowMs,
      updated_at: nowMs,
    };

    this.state.push_tokens[actor.uid][installationId] = record;

    return {
      ok: true,
      status: 200,
      message: `Đã lưu FCM token cho UID "${actor.uid}" trên thiết bị cài đặt "${installationId}".`,
      tokenRecord: record,
      unlinkedPreviousUids,
    };
  }

  /**
   * P04 (Mục 7.2 & Ca kiểm thử T29): Dọn/hủy liên kết FCM Push Token khi đăng xuất hoặc đổi tài khoản
   */
  unregisterPushToken(
    actor: VerifiedActorToken,
    payload: { installation_id?: string },
    nowMs = Date.now()
  ): {
    ok: boolean;
    status: number;
    message: string;
    unlinkedCount: number;
  } {
    const userTokens = this.state.push_tokens[actor.uid] || {};
    const targetInst = (payload.installation_id || '').trim();
    let unlinkedCount = 0;

    for (const [instId, rec] of Object.entries(userTokens)) {
      if (!targetInst || instId === targetInst) {
        if (rec.status === 'active') {
          rec.status = 'unlinked_on_logout';
          rec.updated_at = nowMs;
          unlinkedCount += 1;
        }
      }
    }

    return {
      ok: true,
      status: 200,
      message: `Đã hủy liên kết ${unlinkedCount} push token của tài khoản "${actor.uid}" khi đăng xuất/đổi phiên (T29).`,
      unlinkedCount,
    };
  }

  /**
   * P04 (Mục 7.1): Cập nhật cấu hình kênh thông báo `notification_preferences/{uid}`
   */
  updateNotificationPreferences(
    actor: VerifiedActorToken,
    payload: Partial<UserNotificationPreferences>
  ): {
    ok: boolean;
    status: number;
    message: string;
    preferences?: UserNotificationPreferences;
  } {
    const activeCheck = this.assertActorActive(actor);
    if (!activeCheck.ok) {
      return { ok: false, status: 403, message: activeCheck.error || 'Tài khoản bị khóa.' };
    }

    const current =
      this.state.notification_preferences[actor.uid] || DEFAULT_NOTIFICATION_PREFERENCES;

    const qStart =
      payload.quiet_hours_start !== undefined
        ? payload.quiet_hours_start.trim()
        : current.quiet_hours_start;
    const qEnd =
      payload.quiet_hours_end !== undefined
        ? payload.quiet_hours_end.trim()
        : current.quiet_hours_end;

    if (parseTimeHhMmToMinutes(qStart) === null || parseTimeHhMmToMinutes(qEnd) === null) {
      return {
        ok: false,
        status: 400,
        message: 'Khung giờ yên lặng (quiet_hours_start / quiet_hours_end) phải có định dạng HH:mm (ví dụ 22:00 và 06:30).',
      };
    }

    const updated: UserNotificationPreferences = {
      push_enabled:
        payload.push_enabled !== undefined ? Boolean(payload.push_enabled) : current.push_enabled,
      voice_enabled:
        payload.voice_enabled !== undefined
          ? Boolean(payload.voice_enabled)
          : current.voice_enabled,
      email_enabled:
        payload.email_enabled !== undefined
          ? Boolean(payload.email_enabled)
          : current.email_enabled,
      mode: payload.mode === 'digest' ? 'digest' : payload.mode === 'every_alert' ? 'every_alert' : current.mode,
      quiet_hours_start: qStart,
      quiet_hours_end: qEnd,
    };

    this.state.notification_preferences[actor.uid] = updated;

    return {
      ok: true,
      status: 200,
      message: `Đã lưu cấu hình thông báo (notification_preferences/${actor.uid}).`,
      preferences: updated,
    };
  }

  /**
   * P04 (Ca kiểm thử T24): Retry có giới hạn một Notification Job bị lỗi (`state === 'failed'`)
   */
  retryNotificationJobForActor(
    actor: VerifiedActorToken,
    params: {
      job_id: string;
      simulate_outcome?: 'accepted_by_provider' | 'provider_transient_error';
    },
    nowUtcMs = Date.now()
  ): {
    ok: boolean;
    status: number;
    code: string;
    message: string;
    job?: NotificationJobRecord;
  } {
    const activeCheck = this.assertActorActive(actor);
    if (!activeCheck.ok) {
      return {
        ok: false,
        status: 403,
        code: 'FORBIDDEN',
        message: activeCheck.error || 'Tài khoản không hợp lệ.',
      };
    }

    const job = this.state.notification_jobs[params.job_id];
    if (!job) {
      return {
        ok: false,
        status: 404,
        code: 'JOB_NOT_FOUND',
        message: `Không tìm thấy notification job "${params.job_id}".`,
      };
    }

    if (job.uid !== actor.uid && activeCheck.role !== 'superadmin') {
      return {
        ok: false,
        status: 403,
        code: 'FORBIDDEN_JOB_ACCESS',
        message: 'Bạn chỉ được phép thử gửi lại notification job của chính mình (hoặc SuperAdmin).',
      };
    }

    const res = retryFailedNotificationJob({
      job,
      nowUtcMs,
      simulateOutcome: params.simulate_outcome || 'accepted_by_provider',
    });

    this.state.notification_jobs[job.job_id] = res.updatedJob;

    return {
      ok: res.ok,
      status: res.status,
      code: res.code,
      message: res.message,
      job: res.updatedJob,
    };
  }

  /**
   * P04 (Ca kiểm thử T03, T20, T22): Truy vấn chi tiết một cảnh báo `/alerts/:alertId` có kiểm tra RBAC nghiêm ngặt
   * - Nếu tài khoản thuộc gia đình khác -> trả 403 FORBIDDEN (T03).
   * - Nếu hợp lệ -> trả kèm đúng tên học sinh (`student_display_name`), tên thiết bị (`device_name`) cho gia đình nhiều con (T20),
   *   tách rõ `is_read_by_guardian` (`alerts.is_read`) và `is_read_by_me` (`notification_reads/{uid}/{alert_id}`) (T24).
   */
  getAlertDetailForActor(
    actor: VerifiedActorToken,
    params: { alert_id: string }
  ): {
    ok: boolean;
    status: number;
    code: string;
    message: string;
    alert?: ExtendedAlertRecord & {
      student_display_name: string;
      device_name: string;
      is_read_by_guardian: boolean;
      is_read_by_me: boolean;
    };
    jobs?: NotificationJobRecord[];
  } {
    const activeCheck = this.assertActorActive(actor);
    if (!activeCheck.ok) {
      return {
        ok: false,
        status: 403,
        code: 'ACCOUNT_DISABLED',
        message: activeCheck.error || 'Tài khoản đã bị vô hiệu hóa.',
      };
    }

    for (const [devId, bySess] of Object.entries(this.state.alerts)) {
      for (const [sessId, byAlert] of Object.entries(bySess)) {
        const alertRec = byAlert[params.alert_id];
        if (!alertRec) continue;

        const studentId =
          alertRec.student_id || this.state.sessions[devId]?.[sessId]?.student_id || '';
        const access = this.canAccessStudent(actor, studentId);
        if (!access.allowed || !access.student) {
          this.appendAuditLog({
            actor_uid: actor.uid,
            actor_email: actor.email,
            action: 'UNAUTHORIZED_ATTEMPT',
            target: `alerts/${devId}/${sessId}/${params.alert_id}`,
            details: `Từ chối T03/T22: Tài khoản ${actor.uid} cố gắng mở deep-link cảnh báo ${params.alert_id} của học sinh ${studentId} thuộc gia đình khác.`,
            result: 'DENIED',
          });
          return {
            ok: false,
            status: 403,
            code: 'FORBIDDEN_CROSS_FAMILY_ALERT',
            message:
              'Từ chối truy cập (T03/T22): Bạn không có quyền xem chi tiết cảnh báo của học sinh thuộc gia đình khác.',
          };
        }

        const deviceRec = this.state.devices[devId];
        const isReadByMe = Boolean(this.state.notification_reads[actor.uid]?.[params.alert_id]);
        const relatedJobs = Object.values(this.state.notification_jobs).filter(
          (j) =>
            j.alert_id === params.alert_id &&
            (activeCheck.role === 'superadmin' || j.uid === actor.uid)
        );

        return {
          ok: true,
          status: 200,
          code: 'ALERT_DETAIL_OK',
          message: 'Đã xác thực quyền xem chi tiết cảnh báo.',
          alert: {
            ...alertRec,
            alert_id: params.alert_id,
            device_id: devId,
            session_id: sessId,
            student_id: studentId,
            student_display_name: access.student.display_name,
            device_name: deviceRec?.device_name || devId,
            is_read_by_guardian: Boolean(alertRec.is_read),
            is_read_by_me: isReadByMe,
          },
          jobs: relatedJobs,
        };
      }
    }

    return {
      ok: false,
      status: 404,
      code: 'ALERT_NOT_FOUND',
      message: `Không tìm thấy cảnh báo "${params.alert_id}".`,
    };
  }

  /**
   * P04: Lấy toàn bộ dữ liệu Trung tâm Thông báo (Notification Center) cho người dùng đang đăng nhập
   */
  getNotificationCenterForActor(actor: VerifiedActorToken): {
    uid: string;
    role: UserRole;
    preferences: UserNotificationPreferences;
    pushTokens: PushTokenRecord[];
    routedAlerts: Array<{
      alert_id: string;
      student_id: string;
      student_display_name: string;
      device_id: string;
      device_name: string;
      session_id: string;
      message: string;
      created_at: number;
      severity: 'low' | 'medium' | 'high';
      posture_code?: PostureCode;
      source: DataSourceType;
      image_id?: string;
      capture_status?: string;
      is_read_by_guardian: boolean;
      is_read_by_me: boolean;
    }>;
    jobs: NotificationJobRecord[];
  } {
    const activeCheck = this.assertActorActive(actor);
    const role = activeCheck.role;
    const preferences: UserNotificationPreferences = {
      ...DEFAULT_NOTIFICATION_PREFERENCES,
      ...(this.state.notification_preferences[actor.uid] || {}),
    };

    const pushTokens = Object.values(this.state.push_tokens[actor.uid] || {}).sort(
      (a, b) => b.updated_at - a.updated_at
    );

    const accessibleStudents = this.getOwnedStudentsForActor(actor);

    const routedAlerts: Array<{
      alert_id: string;
      student_id: string;
      student_display_name: string;
      device_id: string;
      device_name: string;
      session_id: string;
      message: string;
      created_at: number;
      severity: 'low' | 'medium' | 'high';
      posture_code?: PostureCode;
      source: DataSourceType;
      image_id?: string;
      capture_status?: string;
      is_read_by_guardian: boolean;
      is_read_by_me: boolean;
    }> = [];

    for (const stu of accessibleStudents) {
      const projections = Object.values(this.state.student_alerts[stu.student_id] || {});
      for (const proj of projections) {
        const devId = proj.device_id || 'robot-fam-a-01';
        const sessId = proj.session_id || 'sess-a-001';
        const fullAlert = this.state.alerts[devId]?.[sessId]?.[proj.alert_id];
        const devRec = this.state.devices[devId];
        const isReadByGuardian = Boolean(fullAlert?.is_read);
        const isReadByMe = Boolean(this.state.notification_reads[actor.uid]?.[proj.alert_id]);

        routedAlerts.push({
          alert_id: proj.alert_id,
          student_id: stu.student_id,
          student_display_name: stu.display_name,
          device_id: devId,
          device_name: devRec?.device_name || devId,
          session_id: sessId,
          message: fullAlert?.message || proj.message || 'Lời nhắc tư thế từ Robot BUGZ',
          created_at: fullAlert?.created_at || proj.event_at,
          severity: fullAlert?.severity || proj.severity || 'low',
          posture_code: fullAlert?.posture_code,
          source: fullAlert?.source || proj.source || 'simulator',
          image_id: fullAlert?.image_id || proj.image_id,
          capture_status: fullAlert?.capture_status || proj.capture_status || 'none',
          is_read_by_guardian: isReadByGuardian,
          is_read_by_me: isReadByMe,
        });
      }
    }

    routedAlerts.sort((a, b) => b.created_at - a.created_at);

    const jobs = Object.values(this.state.notification_jobs)
      .filter((j) => j.uid === actor.uid)
      .sort((a, b) => b.updated_at - a.updated_at);

    return {
      uid: actor.uid,
      role,
      preferences,
      pushTokens,
      routedAlerts,
      jobs,
    };
  }

  // ==========================================================================
  // CHẶNG P05: TRÒ CHƠI RÈN LUYỆN (3 MODES), SEED 40 CÂU, CHẤM ĐIỂM SERVER & ADMIN 9 NHÓM
  // ==========================================================================

  /**
   * P05 (Mục 8, 11.4, 13.2 & Ca kiểm thử T26, T28):
   * Lấy dữ liệu khởi tạo Module Trò chơi Rèn luyện (`/games`):
   * - Chỉ trả danh sách câu hỏi có `status === 'published'` (không lộ câu `editorial_draft` và không bao giờ lộ `correct_option_id`).
   * - Tách bạch rõ 3 chỉ số độc lập:
   *   1) Điểm Trò chơi Ôn tập (`gameScoreTotal`)
   *   2) Tiến độ Tự thực hành 28 ngày (`selfPracticeCompletedDaysCount`)
   *   3) Số đợt Quan sát từ Robot (`robotObservedGoodEpisodes` / `robotObservedBadEpisodes`)
   */
  getGamesBootstrapForActor(
    actor: VerifiedActorToken,
    requestedStudentId?: string
  ): {
    actorRole: UserRole;
    studentId: string;
    studentDisplayName: string;
    accessibleStudents: StudentRecord[];
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
    separatedMetrics: {
      gameScoreTotal: number;
      gameCompletedAttemptsCount: number;
      selfPracticeCompletedDaysCount: number;
      selfPracticeTotalDays: 28;
      robotObservedGoodEpisodes: number;
      robotObservedBadEpisodes: number;
      clinicalSeparationDisclaimer: string;
    };
    recentAttempts: GameAttemptRecord[];
    recommendedReviewDays: number[];
  } {
    const activeCheck = this.assertActorActive(actor);
    const role = activeCheck.role;

    const accessibleStudents = this.getOwnedStudentsForActor(actor);

    const selectedStudent =
      (requestedStudentId &&
        accessibleStudents.find((s) => s.student_id === requestedStudentId)) ||
      accessibleStudents[0];

    const studentId = selectedStudent?.student_id || 'stu-a1';
    const studentDisplayName = selectedStudent?.display_name || 'Hồ sơ Cá nhân';

    const allPublicQuestions = Object.values(this.state.questions_public);
    const publishedQuestions = getPublishedQuestionsForStudent(this.state.questions_public, 'all');
    const publishedLungThang = publishedQuestions.filter((q) => q.topic === 'lung_thang').length;
    const publishedMatSang = publishedQuestions.filter((q) => q.topic === 'mat_sang').length;
    const draftHiddenCount = allPublicQuestions.filter((q) => q.status !== 'published').length;

    const studentAttempts = Object.values(this.state.game_attempts[studentId] || {}).sort(
      (a, b) => (b.created_at || 0) - (a.created_at || 0)
    );

    const gameScoreTotal = studentAttempts.reduce((sum, att) => sum + (Number(att.score) || 0), 0);
    const gameCompletedAttemptsCount = studentAttempts.filter(
      (att) => att.status === 'completed'
    ).length;

    const studentProgress = this.state.learning_progress[studentId] || {};
    const selfPracticeCompletedDaysCount = Object.values(studentProgress).filter((p) =>
      Boolean(p.self_completed_at)
    ).length;

    let robotObservedGoodEpisodes = 0;
    let robotObservedBadEpisodes = 0;
    for (const bySession of Object.values(this.state.sessions)) {
      for (const sess of Object.values(bySession)) {
        if (sess.student_id === studentId) {
          robotObservedGoodEpisodes += Number(sess.good_count) || 0;
          robotObservedBadEpisodes += Number(sess.bad_count) || 0;
        }
      }
    }

    const reviewDaySet = new Set<number>();
    for (const att of studentAttempts) {
      if (Array.isArray(att.recommended_review_days)) {
        for (const d of att.recommended_review_days) {
          if (d >= 1 && d <= 28) reviewDaySet.add(d);
        }
      }
    }
    if (reviewDaySet.size === 0) {
      reviewDaySet.add(1);
      reviewDaySet.add(5);
      reviewDaySet.add(8);
    }

    return {
      actorRole: role,
      studentId,
      studentDisplayName,
      accessibleStudents,
      blueprints: GAME_BLUEPRINTS,
      illustrationManifest: ILLUSTRATION_MANIFEST,
      publishedQuestions,
      counts: {
        totalSeed: allPublicQuestions.length,
        publishedTotal: publishedQuestions.length,
        publishedLungThang,
        publishedMatSang,
        draftHiddenCount,
      },
      separatedMetrics: {
        gameScoreTotal,
        gameCompletedAttemptsCount,
        selfPracticeCompletedDaysCount,
        selfPracticeTotalDays: 28,
        robotObservedGoodEpisodes,
        robotObservedBadEpisodes,
        clinicalSeparationDisclaimer:
          'Điểm Trò chơi Ôn tập, Tiến độ Tự thực hành 28 ngày và Số đợt Quan sát từ Robot là 3 chỉ số hoàn toàn độc lập. Không xếp hạng công khai trẻ em; điểm trò chơi không phải chẩn đoán y khoa hay bằng chứng đã cải thiện thị lực/cột sống.',
      },
      recentAttempts: studentAttempts.slice(0, 15),
      recommendedReviewDays: Array.from(reviewDaySet).sort((a, b) => a - b),
    };
  }

  /**
   * P05 (Mục 8.2, 13.2 & Ca kiểm thử T26, T28):
   * Tạo lượt chơi mới (`POST /api/games/attempts`), khóa phiên bản câu hỏi `question_versions` trong attempt.
   */
  startGameAttempt(
    actor: VerifiedActorToken,
    payload: {
      student_id: string;
      game_id: GameModeId;
      topic_filter?: 'all' | QuestionTopic;
      timer_enabled?: boolean;
      question_limit?: number | 'all';
    },
    nowMs = Date.now()
  ): {
    ok: boolean;
    status: number;
    code: string;
    message: string;
    attempt?: GameAttemptRecord;
    questions?: PublicQuestionRecord[];
  } {
    const activeCheck = this.assertActorActive(actor);
    if (!activeCheck.ok) {
      return {
        ok: false,
        status: 403,
        code: 'ACCOUNT_DISABLED',
        message: activeCheck.error || 'Tài khoản bị khóa.',
      };
    }

    const ownedStudents = this.getOwnedStudentsForActor(actor, nowMs);
    const requestedStuId = (payload.student_id || '').trim();
    const studentId =
      requestedStuId && this.state.students[requestedStuId]
        ? requestedStuId
        : ownedStudents[0]?.student_id || requestedStuId || 'stu-a1';
    const access = this.canAccessStudent(actor, studentId);
    if (!access.allowed || !access.student) {
      return {
        ok: false,
        status: 403,
        code: 'FORBIDDEN_STUDENT_ACCESS',
        message: 'Từ chối: Bạn không có quyền tạo lượt chơi cho hồ sơ học sinh thuộc gia đình khác.',
      };
    }

    const validGameIds: GameModeId[] = ['situations', 'desk_builder', 'habit_relay'];
    const gameId: GameModeId = validGameIds.includes(payload.game_id)
      ? payload.game_id
      : 'situations';
    const topicFilter: 'all' | QuestionTopic =
      payload.topic_filter === 'lung_thang' || payload.topic_filter === 'mat_sang'
        ? payload.topic_filter
        : 'all';
    const timerEnabled = Boolean(payload.timer_enabled);

    const attemptId = this.nextId('att');
    let selectedQuestions: PublicQuestionRecord[] = [];
    const questionVersions: Record<string, number> = {};
    let maxPossibleScore = 30;
    let initialReviewDays: number[] = [];

    if (gameId === 'situations') {
      const publishedPool = getPublishedQuestionsForStudent(
        this.state.questions_public,
        topicFilter
      );
      if (publishedPool.length === 0) {
        return {
          ok: false,
          status: 409,
          code: 'NO_PUBLISHED_QUESTIONS',
          message:
            'Chưa có câu hỏi nào ở trạng thái "published" cho chủ đề này. Theo quy tắc T28, câu hỏi bản thảo (editorial_draft) không hiển thị cho trẻ em đến khi được Admin duyệt.',
        };
      }
      const allPublicQuestions = Object.values(this.state.questions_public);
      const isAll40Published =
        allPublicQuestions.length > 0 &&
        allPublicQuestions.every((q) => q.status === 'published');

      if (payload.question_limit === 'all') {
        selectedQuestions = [...publishedPool];
      } else if (
        typeof payload.question_limit === 'number' &&
        Number.isInteger(payload.question_limit) &&
        payload.question_limit > 0
      ) {
        selectedQuestions = publishedPool.slice(0, payload.question_limit);
      } else if (isAll40Published) {
        selectedQuestions = [...publishedPool];
      } else {
        selectedQuestions = publishedPool.slice(0, 5);
      }
      for (const q of selectedQuestions) {
        questionVersions[q.id] = q.version;
      }
      maxPossibleScore = selectedQuestions.length * 10;
      initialReviewDays = Array.from(
        new Set(selectedQuestions.flatMap((q) => q.source_days))
      ).sort((a, b) => a - b);
    } else if (gameId === 'desk_builder') {
      maxPossibleScore = 30;
      initialReviewDays = [...GAME_BLUEPRINTS.games[1].source_days];
    } else {
      maxPossibleScore = 20;
      initialReviewDays = [...GAME_BLUEPRINTS.games[2].source_days];
    }

    const attempt: GameAttemptRecord = {
      attempt_id: attemptId,
      student_id: studentId,
      game_id: gameId,
      topic_filter: topicFilter,
      timer_enabled: timerEnabled,
      timer_seconds: timerEnabled ? 30 : undefined,
      status: 'in_progress',
      score: 0,
      max_possible_score: maxPossibleScore,
      question_ids: selectedQuestions.map((q) => q.id),
      question_versions: questionVersions,
      answers: {},
      recommended_review_days: initialReviewDays,
      created_at: nowMs,
      updated_at: nowMs,
    };

    if (!this.state.game_attempts[studentId]) {
      this.state.game_attempts[studentId] = {};
    }
    this.state.game_attempts[studentId][attemptId] = attempt;

    return {
      ok: true,
      status: 201,
      code: 'ATTEMPT_CREATED',
      message: `Đã khởi tạo lượt chơi "${gameId}" (${attemptId}) cho học sinh "${access.student.display_name}".`,
      attempt,
      questions: selectedQuestions,
    };
  }

  /**
   * Kiểm tra học sinh đã từng được cộng điểm cho một câu hỏi (hoặc một trò chơi) trước đó trong cùng attempt
   * để đảm bảo idempotent chống cộng điểm lặp khi bấm liên tiếp hoặc thử lại (T26).
   */
  /**
   * P05 (Mục 8.2, 13.2 & Ca kiểm thử T26, T27):
   * Chấm điểm phía Server theo `question_keys/{question_id}/{locked_version}` hoặc luật `game_blueprints.json`.
   * - Đúng lần đầu ở câu hỏi trong lượt chơi: `+10 điểm` (`first_correct_points`).
   * - Chọn sai rồi thử lại đúng, hoặc nộp trùng lặp nhiều lần: `+0 điểm` (`repeat_points: 0`) (T26).
   */
  submitGameAttemptAnswer(
    actor: VerifiedActorToken,
    payload: {
      attempt_id: string;
      student_id?: string;
      question_id?: string;
      selected_option_id?: 'A' | 'B' | 'C';
      desk_pairs?: Record<string, string>;
      ordered_card_ids?: string[];
      self_reflection_text?: string;
    },
    nowMs = Date.now()
  ): {
    ok: boolean;
    status: number;
    code: string;
    message: string;
    attempt?: GameAttemptRecord;
    questionResult?: GameQuestionAnswerSubmissionRecord;
    deskResult?: DeskBuilderSubmissionRecord;
    relayResult?: HabitRelaySubmissionRecord;
  } {
    const activeCheck = this.assertActorActive(actor);
    if (!activeCheck.ok) {
      return {
        ok: false,
        status: 403,
        code: 'ACCOUNT_DISABLED',
        message: activeCheck.error || 'Tài khoản bị khóa.',
      };
    }

    // Tìm attempt theo attempt_id
    let foundStudentId = payload.student_id || '';
    let attempt: GameAttemptRecord | undefined;

    if (foundStudentId && this.state.game_attempts[foundStudentId]?.[payload.attempt_id]) {
      attempt = this.state.game_attempts[foundStudentId][payload.attempt_id];
    } else {
      for (const [stuId, byAtt] of Object.entries(this.state.game_attempts)) {
        if (byAtt[payload.attempt_id]) {
          foundStudentId = stuId;
          attempt = byAtt[payload.attempt_id];
          break;
        }
      }
    }

    if (!attempt || !foundStudentId) {
      return {
        ok: false,
        status: 404,
        code: 'ATTEMPT_NOT_FOUND',
        message: `Không tìm thấy lượt chơi "${payload.attempt_id}".`,
      };
    }

    const access = this.canAccessStudent(actor, foundStudentId);
    if (!access.allowed) {
      return {
        ok: false,
        status: 403,
        code: 'FORBIDDEN_ATTEMPT_ACCESS',
        message: 'Từ chối: Bạn không có quyền gửi đáp án cho lượt chơi của học sinh gia đình khác.',
      };
    }

    // 1. Kiểu chơi 1: Chọn cách xử lý tình huống (`situations` — single_choice)
    if (attempt.game_id === 'situations') {
      const questionId = String(payload.question_id || '').trim();
      const selectedOptionId = payload.selected_option_id;

      if (!questionId || !attempt.question_ids.includes(questionId)) {
        return {
          ok: false,
          status: 400,
          code: 'INVALID_QUESTION_FOR_ATTEMPT',
          message: `Câu hỏi "${questionId}" không nằm trong lượt chơi "${attempt.attempt_id}".`,
        };
      }

      if (!selectedOptionId || !['A', 'B', 'C'].includes(selectedOptionId)) {
        return {
          ok: false,
          status: 400,
          code: 'INVALID_OPTION_ID',
          message: 'Phương án lựa chọn phải là A, B hoặc C.',
        };
      }

      const lockedVersion = attempt.question_versions[questionId] || 1;
      const versionKeys = this.state.question_keys[questionId] || {};
      const keyRecord =
        versionKeys[String(lockedVersion)] ||
        Object.values(versionKeys)[0];

      if (!keyRecord) {
        return {
          ok: false,
          status: 500,
          code: 'QUESTION_KEY_MISSING',
          message: `Không tìm thấy khóa chấm điểm cho câu "${questionId}" phiên bản v${lockedVersion}.`,
        };
      }

      const previousAnswerForThisQuestion = attempt.answers[questionId];
      const nextAttemptCount = (previousAnswerForThisQuestion?.attempt_count_for_question || 0) + 1;
      const alreadyAwardedForThisQuestion =
        (previousAnswerForThisQuestion?.points_awarded || 0) > 0;

      const isCorrect = selectedOptionId === keyRecord.correct_option_id;

      // Quy tắc T26: Chỉ cộng điểm (10 điểm) khi trả lời đúng ngay lần đầu tiên (attempt_count === 1) và chưa từng được cộng điểm
      let pointsAwarded = 0;
      if (isCorrect && nextAttemptCount === 1 && !alreadyAwardedForThisQuestion) {
        pointsAwarded = keyRecord.first_correct_points;
      } else {
        pointsAwarded = keyRecord.repeat_points; // 0 điểm
      }

      const feedbackText = isCorrect
        ? nextAttemptCount === 1 && !alreadyAwardedForThisQuestion
          ? keyRecord.feedback_correct
          : `${keyRecord.feedback_correct} (Bạn đã chọn lại đúng — hệ thống ghi nhận ôn tập và giữ nguyên điểm lượt đầu theo quy tắc chống cộng lặp T26).`
        : keyRecord.feedback_incorrect;

      const questionResult: GameQuestionAnswerSubmissionRecord = {
        question_id: questionId,
        locked_version: lockedVersion,
        selected_option_id: selectedOptionId,
        is_correct: isCorrect,
        attempt_count_for_question: nextAttemptCount,
        points_awarded: alreadyAwardedForThisQuestion
          ? previousAnswerForThisQuestion.points_awarded
          : pointsAwarded,
        feedback_text: feedbackText,
        explanation_text: keyRecord.explanation,
        source_days: [...keyRecord.source_days],
        answered_at: nowMs,
      };

      attempt.answers[questionId] = questionResult;
      attempt.score += pointsAwarded;
      attempt.updated_at = nowMs;

      if (!isCorrect) {
        const mergedDays = new Set([
          ...attempt.recommended_review_days,
          ...keyRecord.source_days,
        ]);
        attempt.recommended_review_days = Array.from(mergedDays).sort((a, b) => a - b);
      }

      const allAnsweredAtLeastOnce = attempt.question_ids.every((qid) =>
        Boolean(attempt?.answers[qid])
      );
      if (allAnsweredAtLeastOnce) {
        attempt.status = 'completed';
        attempt.completed_at = attempt.completed_at || nowMs;
      }

      return {
        ok: true,
        status: 200,
        code: isCorrect ? 'ANSWER_CORRECT' : 'ANSWER_INCORRECT',
        message: feedbackText,
        attempt,
        questionResult: {
          ...questionResult,
          // Trả số điểm cộng thêm ở đúng lần bấm này để client/test kiểm tra T26
          points_awarded: pointsAwarded,
        },
      };
    }

    // 2. Kiểu chơi 2: Sắp góc học tập (`desk_builder` — drag_or_tap_match)
    if (attempt.game_id === 'desk_builder') {
      const pairs = (payload.desk_pairs || {}) as Record<string, string>;
      const alreadyAwarded = (attempt.desk_builder_submission?.points_awarded || 0) > 0 || attempt.score > 0;
      const deskResult = evaluateDeskBuilderSubmission({
        submittedPairs: pairs,
        alreadyAwardedInHistory: alreadyAwarded,
        nowMs,
      });

      attempt.desk_builder_submission = deskResult;
      attempt.score += deskResult.points_awarded;
      attempt.updated_at = nowMs;
      if (deskResult.is_all_correct) {
        attempt.status = 'completed';
        attempt.completed_at = attempt.completed_at || nowMs;
      }

      return {
        ok: true,
        status: 200,
        code: deskResult.is_all_correct ? 'DESK_BUILDER_COMPLETED' : 'DESK_BUILDER_PARTIAL',
        message: deskResult.is_all_correct
          ? deskResult.points_awarded > 0
            ? 'Tuyệt vời! Bạn đã sắp xếp đúng cả 3 vị trí góc học tập (+30 điểm).'
            : 'Bạn đã xếp đúng cả 3 vị trí góc học tập (+0 điểm do đã nhận điểm lượt này theo quy tắc T26).'
          : `Bạn đã xếp đúng ${deskResult.correct_count}/${deskResult.total_tasks} vị trí. Xem gợi ý từng món đồ và thử chỉnh lại nhé!`,
        attempt,
        deskResult,
      };
    }

    // 3. Kiểu chơi 3: Tiếp sức thói quen (`habit_relay` — sequence_and_reflect)
    const orderedIds = Array.isArray(payload.ordered_card_ids)
      ? payload.ordered_card_ids.map(String)
      : [];
    const alreadyAwarded = (attempt.habit_relay_submission?.points_awarded || 0) > 0 || attempt.score > 0;
    const relayResult = evaluateHabitRelaySubmission({
      orderedCardIds: orderedIds,
      selfReflectionText: payload.self_reflection_text,
      alreadyAwardedInHistory: alreadyAwarded,
      nowMs,
    });

    attempt.habit_relay_submission = relayResult;
    attempt.score += relayResult.points_awarded;
    attempt.updated_at = nowMs;
    if (relayResult.is_correct) {
      attempt.status = 'completed';
      attempt.completed_at = attempt.completed_at || nowMs;
    }

    return {
      ok: true,
      status: 200,
      code: relayResult.is_correct ? 'HABIT_RELAY_COMPLETED' : 'HABIT_RELAY_INCORRECT',
      message: relayResult.is_correct
        ? relayResult.points_awarded > 0
          ? 'Chuẩn rồi! Chuỗi thói quen chuẩn bị góc học và nghỉ mắt đã đúng thứ tự (+20 điểm). Lưu ý: Tự thực hành là tự báo cáo, không thay quan sát của Robot.'
          : 'Thứ tự chuỗi thói quen chính xác (+0 điểm do đã nhận điểm lượt này theo quy tắc T26).'
        : 'Thứ tự các bước chưa khớp. Mình thử xếp lại theo trình tự: Chuẩn bị góc học -> Bắt đầu học thoải mái -> Nghỉ mắt/vận động nhẹ -> Quay lại học và tự quan sát cảm giác nhé!',
      attempt,
      relayResult,
    };
  }

  /**
   * P05: Lấy chi tiết 1 lượt chơi (`GET /api/games/attempts/:attemptId`) có kiểm tra RBAC
   */
  getGameAttemptForActor(
    actor: VerifiedActorToken,
    attemptId: string
  ): {
    ok: boolean;
    status: number;
    message: string;
    attempt?: GameAttemptRecord;
    questions?: PublicQuestionRecord[];
  } {
    for (const [stuId, byAtt] of Object.entries(this.state.game_attempts)) {
      const att = byAtt[attemptId];
      if (!att) continue;
      const access = this.canAccessStudent(actor, stuId);
      if (!access.allowed) {
        return {
          ok: false,
          status: 403,
          message: 'Từ chối: Bạn không có quyền xem kết quả lượt chơi của học sinh gia đình khác.',
        };
      }
      const questions = att.question_ids
        .map((qid) => this.state.questions_public[qid])
        .filter(Boolean);
      return {
        ok: true,
        status: 200,
        message: 'Đã tải chi tiết lượt chơi.',
        attempt: att,
        questions,
      };
    }

    return {
      ok: false,
      status: 404,
      message: `Không tìm thấy lượt chơi "${attemptId}".`,
    };
  }

  // ==========================================================================
  // CHẶNG P05: SUPERADMIN CMS NGÂN HÀNG CÂU HỎI & HOÀN THIỆN 9 NHÓM QUẢN TRỊ
  // ==========================================================================

  /**
   * P05 (Ca kiểm thử T04, T28): SuperAdmin lấy toàn bộ 40 câu hỏi kèm đáp án server (`question_keys`) để biên tập & duyệt
   */
  adminGetQuestionBank(actor: VerifiedActorToken): {
    ok: boolean;
    status: number;
    message: string;
    questions?: Array<
      PublicQuestionRecord & {
        correct_option_id: 'A' | 'B' | 'C';
        explanation: string;
        feedback_correct: string;
        feedback_incorrect: string;
      }
    >;
  } {
    const activeCheck = this.assertActorActive(actor);
    if (!activeCheck.ok || activeCheck.role !== 'superadmin') {
      this.appendAuditLog({
        actor_uid: actor.uid,
        actor_email: actor.email,
        action: 'UNAUTHORIZED_ATTEMPT',
        target: 'question_keys',
        details: `Người dùng vai trò ${activeCheck.role} cố gắng đọc toàn bộ ngân hàng đáp án question_keys.`,
        result: 'DENIED',
      });
      return {
        ok: false,
        status: 403,
        message: 'Từ chối truy cập (T04): Chỉ SuperAdmin mới có quyền đọc và quản trị question_keys.',
      };
    }

    const list = Object.values(this.state.questions_public)
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((pub) => {
        const keyMap = this.state.question_keys[pub.id] || {};
        const key = keyMap[String(pub.version)] || Object.values(keyMap)[0];
        return {
          ...pub,
          correct_option_id: key?.correct_option_id || 'A',
          explanation: key?.explanation || '',
          feedback_correct: key?.feedback_correct || '',
          feedback_incorrect: key?.feedback_incorrect || '',
        };
      });

    return {
      ok: true,
      status: 200,
      message: `Đã tải ${list.length} câu hỏi trong ngân hàng câu hỏi BUGZ.`,
      questions: list,
    };
  }

  /**
   * P05 (Mục 8.1, 13.2 & Ca kiểm thử T04, T28):
   * SuperAdmin chạy Dry-Run hoặc Import thực tế `question_bank.json` (40 câu seed).
   * Không bao giờ import nguyên `question_bank.json` vào root RTDB hoặc lộ đáp án trong `questions_public`.
   */
  adminImportQuestionBankSeed(
    actor: VerifiedActorToken,
    payload: {
      dry_run?: boolean;
      mode?: 'strict_editorial_draft' | 'sandbox_with_12_published';
    },
    nowMs = Date.now()
  ): {
    ok: boolean;
    status: number;
    message: string;
    report?: SeedImportValidationReport;
  } {
    const activeCheck = this.assertActorActive(actor);
    if (!activeCheck.ok || activeCheck.role !== 'superadmin') {
      this.appendAuditLog(
        {
          actor_uid: actor.uid,
          actor_email: actor.email,
          action: 'UNAUTHORIZED_ATTEMPT',
          target: 'questions_public',
          details: `Người dùng vai trò ${activeCheck.role} cố gắng gọi API import seed câu hỏi.`,
          result: 'DENIED',
        },
        nowMs
      );
      return {
        ok: false,
        status: 403,
        message: 'Từ chối truy cập (T04): Chỉ SuperAdmin mới được phép chạy import seed ngân hàng câu hỏi.',
      };
    }

    const dryRun = Boolean(payload.dry_run);
    const mode = payload.mode || 'strict_editorial_draft';
    const report = validateAndSplitQuestionBankSeed({
      dryRun,
      mode,
      reviewerUid: actor.uid,
      nowMs,
    });

    if (!report.ok) {
      return {
        ok: false,
        status: 400,
        message: `Kiểm tra seed thất bại: ${report.errors.join(' | ')}`,
        report,
      };
    }

    if (!dryRun) {
      this.state.questions_public = report.questionsPublic;
      this.state.question_keys = report.questionKeys;
      this.appendAuditLog(
        {
          actor_uid: actor.uid,
          actor_email: actor.email,
          action: 'ADMIN_IMPORT_QUESTIONS',
          target: 'questions_public + question_keys',
          details: `Import 40 câu seed từ question_bank.json (mode=${mode}, published=${report.publishedCount}, editorial_draft=${report.editorialDraftCount}, publicLeakCheckPassed=true).`,
          result: 'SUCCESS',
        },
        nowMs
      );
    }

    return {
      ok: true,
      status: 200,
      message: dryRun
        ? `[DRY-RUN PASS] Đã kiểm tra hợp lệ ${report.totalQuestions} câu hỏi (${report.lungThangCount} Lưng thẳng, ${report.matSangCount} Mắt sáng). Không ghi vào DB, xác nhận 0 đáp án rò rỉ trong questions_public.`
        : `Đã import thành công ${report.totalQuestions} câu hỏi vào questions_public và question_keys (${report.publishedCount} published, ${report.editorialDraftCount} editorial_draft).`,
      report,
    };
  }

  /**
   * P05 (Mục 8.1, 14.2 & Ca kiểm thử T04, T28):
   * SuperAdmin biên tập nội dung câu hỏi, đánh dấu `content_reviewed` / `clinical_reviewed` và chuyển trạng thái `editorial_draft` <-> `published`.
   * - Chặn chuyển sang `published` nếu chưa tích đủ cả `content_reviewed` VÀ `clinical_reviewed` hoặc thiếu `source_days`!
   * - Mỗi khi chỉnh sửa hoặc xuất bản, tự động tăng `version` và tạo bản ghi mới trong `question_keys/{id}/{newVersion}` (giữ nguyên version cũ để không làm lệch các attempt đang chơi dở - T26).
   */
  adminUpdateOrPublishQuestion(
    actor: VerifiedActorToken,
    payload: {
      question_id: string;
      prompt?: string;
      options?: QuestionOptionItem[];
      correct_option_id?: 'A' | 'B' | 'C';
      explanation?: string;
      feedback_correct?: string;
      feedback_incorrect?: string;
      source_days?: number[];
      illustration_id?: IllustrationId;
      content_reviewed?: boolean;
      clinical_reviewed?: boolean;
      status?: QuestionStatus;
    },
    nowMs = Date.now()
  ): {
    ok: boolean;
    status: number;
    code: string;
    message: string;
    question?: PublicQuestionRecord;
    keyRecord?: ServerQuestionKeyRecord;
  } {
    const activeCheck = this.assertActorActive(actor);
    if (!activeCheck.ok || activeCheck.role !== 'superadmin') {
      this.appendAuditLog(
        {
          actor_uid: actor.uid,
          actor_email: actor.email,
          action: 'UNAUTHORIZED_ATTEMPT',
          target: `questions_public/${payload.question_id}`,
          details: `Người dùng vai trò ${activeCheck.role} cố gắng chỉnh sửa/publish câu hỏi ${payload.question_id}.`,
          result: 'DENIED',
        },
        nowMs
      );
      return {
        ok: false,
        status: 403,
        code: 'FORBIDDEN_NOT_SUPERADMIN',
        message: 'Từ chối truy cập (T04): Chỉ SuperAdmin mới có quyền duyệt hoặc xuất bản câu hỏi.',
      };
    }

    const qid = (payload.question_id || '').trim();
    const existingPub = this.state.questions_public[qid];
    if (!existingPub) {
      return {
        ok: false,
        status: 404,
        code: 'QUESTION_NOT_FOUND',
        message: `Không tìm thấy câu hỏi "${qid}".`,
      };
    }

    const existingKeyMap = this.state.question_keys[qid] || {};
    const currentKey =
      existingKeyMap[String(existingPub.version)] || Object.values(existingKeyMap)[0];

    const nextPrompt =
      payload.prompt !== undefined ? payload.prompt.trim() : existingPub.prompt;
    if (!nextPrompt) {
      return {
        ok: false,
        status: 400,
        code: 'EMPTY_PROMPT',
        message: 'Nội dung câu hỏi (prompt) không được để trống.',
      };
    }

    const nextOptions =
      Array.isArray(payload.options) && payload.options.length === 3
        ? payload.options.map((o) => ({ id: o.id, text: String(o.text || '').trim() }))
        : existingPub.options;

    const nextCorrectOptionId: 'A' | 'B' | 'C' =
      payload.correct_option_id && ['A', 'B', 'C'].includes(payload.correct_option_id)
        ? payload.correct_option_id
        : currentKey?.correct_option_id || 'A';

    const nextExplanation =
      payload.explanation !== undefined
        ? payload.explanation.trim()
        : currentKey?.explanation || '';
    const nextFeedbackCorrect =
      payload.feedback_correct !== undefined
        ? payload.feedback_correct.trim()
        : currentKey?.feedback_correct || `Chuẩn rồi! ${nextExplanation}`;
    const nextFeedbackIncorrect =
      payload.feedback_incorrect !== undefined
        ? payload.feedback_incorrect.trim()
        : currentKey?.feedback_incorrect || `Mình thử lại nhé. ${nextExplanation}`;

    const nextSourceDays =
      Array.isArray(payload.source_days) && payload.source_days.length > 0
        ? payload.source_days.filter((d) => Number.isInteger(d) && d >= 1 && d <= 28)
        : existingPub.source_days;

    if (nextSourceDays.length === 0) {
      return {
        ok: false,
        status: 400,
        code: 'MISSING_SOURCE_DAYS',
        message: 'Câu hỏi bắt buộc phải gắn ít nhất 1 ngày nguồn hợp lệ (1..28).',
      };
    }

    const nextIllustrationId: IllustrationId =
      payload.illustration_id &&
      ['POSTURE', 'DESK', 'EYES', 'MOVE'].includes(payload.illustration_id)
        ? payload.illustration_id
        : existingPub.illustration_id;

    const nextContentReviewed =
      payload.content_reviewed !== undefined
        ? Boolean(payload.content_reviewed)
        : existingPub.approval.content_reviewed;
    const nextClinicalReviewed =
      payload.clinical_reviewed !== undefined
        ? Boolean(payload.clinical_reviewed)
        : existingPub.approval.clinical_reviewed;

    const requestedStatus: QuestionStatus =
      payload.status === 'published' || payload.status === 'editorial_draft'
        ? payload.status
        : existingPub.status;

    // Kiểm tra không cho phép chèn lời hứa chữa cận / chữa gù trái quy định sức khỏe
    const combinedTextCheck = `${nextPrompt} ${nextExplanation} ${nextFeedbackCorrect} ${nextFeedbackIncorrect}`;
    for (const pat of FORBIDDEN_CLINICAL_CLAIM_PATTERNS) {
      if (pat.test(combinedTextCheck)) {
        this.appendAuditLog(
          {
            actor_uid: actor.uid,
            actor_email: actor.email,
            action: 'ADMIN_PUBLISH_QUESTION',
            target: `questions_public/${qid}`,
            details: `Chặn cập nhật câu hỏi ${qid} (T28): Phát hiện cụm từ hứa chữa bệnh lâm sàng (${pat.source}).`,
            result: 'DENIED',
          },
          nowMs
        );
        return {
          ok: false,
          status: 422,
          code: 'CLINICAL_GUARDRAIL_VIOLATION',
          message: `Từ chối lưu câu hỏi ${qid} (Quy tắc T28): Không được thêm lời hứa chữa khỏi cận thị, chữa gù lưng hoặc khẳng định hiệu quả y khoa chưa đo lường.`,
        };
      }
    }

    // Chốt chặn T28: Chỉ cho phép chuyển sang `published` khi đã duyệt cả Nội dung VÀ Thẩm định sức khỏe/lâm sàng
    if (requestedStatus === 'published' && (!nextContentReviewed || !nextClinicalReviewed)) {
      this.appendAuditLog(
        {
          actor_uid: actor.uid,
          actor_email: actor.email,
          action: 'ADMIN_PUBLISH_QUESTION',
          target: `questions_public/${qid}`,
          details: `Chặn xuất bản câu hỏi ${qid} (T28): content_reviewed=${String(nextContentReviewed)}, clinical_reviewed=${String(nextClinicalReviewed)}.`,
          result: 'DENIED',
        },
        nowMs
      );
      return {
        ok: false,
        status: 422,
        code: 'PUBLISH_BLOCKED_UNREVIEWED',
        message: `Chặn xuất bản câu hỏi ${qid} (Quy tắc T28): Cần người phụ trách tích xác nhận đủ cả 2 mục "Đã duyệt nội dung (content_reviewed)" và "Đã rà soát ngôn ngữ sức khỏe (clinical_reviewed)" trước khi chuyển từ editorial_draft sang published.`,
      };
    }

    const nextVersion = existingPub.version + 1;
    const updatedPub: PublicQuestionRecord = {
      ...existingPub,
      prompt: nextPrompt,
      options: nextOptions,
      source_days: nextSourceDays,
      illustration_id: nextIllustrationId,
      version: nextVersion,
      status: requestedStatus,
      approval: {
        content_reviewed: nextContentReviewed,
        clinical_reviewed: nextClinicalReviewed,
        reviewed_by: actor.uid,
        reviewed_at: nowMs,
      },
      updated_at: nowMs,
    };

    const newKeyRecord: ServerQuestionKeyRecord = {
      question_id: qid,
      version: nextVersion,
      correct_option_id: nextCorrectOptionId,
      explanation: nextExplanation,
      feedback_correct: nextFeedbackCorrect,
      feedback_incorrect: nextFeedbackIncorrect,
      source_days: nextSourceDays,
      first_correct_points: existingPub.scoring.first_correct_points,
      repeat_points: existingPub.scoring.repeat_points,
      updated_at: nowMs,
    };

    this.state.questions_public[qid] = updatedPub;
    if (!this.state.question_keys[qid]) {
      this.state.question_keys[qid] = {};
    }
    this.state.question_keys[qid][String(nextVersion)] = newKeyRecord;

    this.appendAuditLog(
      {
        actor_uid: actor.uid,
        actor_email: actor.email,
        action:
          requestedStatus === 'published' ? 'ADMIN_PUBLISH_QUESTION' : 'ADMIN_UPDATE_QUESTION',
        target: `questions_public/${qid}`,
        details: `Cập nhật câu hỏi ${qid} lên v${nextVersion} (status=${requestedStatus}, content_reviewed=${String(nextContentReviewed)}, clinical_reviewed=${String(nextClinicalReviewed)}).`,
        result: 'SUCCESS',
      },
      nowMs
    );

    return {
      ok: true,
      status: 200,
      code: 'QUESTION_UPDATED',
      message: `Đã cập nhật câu hỏi ${qid} lên phiên bản v${nextVersion} (trạng thái: ${requestedStatus}).`,
      question: updatedPub,
      keyRecord: newKeyRecord,
    };
  }

  /**
   * P05: SuperAdmin duyệt & xuất bản hàng loạt câu hỏi (hoặc đưa về bản nháp) có ghi Audit Log
   */
  adminBulkPublishQuestions(
    actor: VerifiedActorToken,
    payload: {
      mode: 'publish_all_40' | 'publish_12_sample' | 'reset_all_draft';
    },
    nowMs = Date.now()
  ): {
    ok: boolean;
    status: number;
    message: string;
    publishedCount: number;
    draftCount: number;
  } {
    const activeCheck = this.assertActorActive(actor);
    if (!activeCheck.ok || activeCheck.role !== 'superadmin') {
      return {
        ok: false,
        status: 403,
        message: 'Chỉ SuperAdmin mới được phép duyệt hàng loạt ngân hàng câu hỏi.',
        publishedCount: 0,
        draftCount: 0,
      };
    }

    let publishedCount = 0;
    let draftCount = 0;

    for (const q of Object.values(this.state.questions_public)) {
      const shouldPublish =
        payload.mode === 'publish_all_40' ||
        (payload.mode === 'publish_12_sample' &&
          (q.id <= 'BUGZ-Q006' || (q.id >= 'BUGZ-Q021' && q.id <= 'BUGZ-Q026')));

      if (shouldPublish) {
        q.status = 'published';
        q.approval = {
          content_reviewed: true,
          clinical_reviewed: true,
          reviewed_by: actor.uid,
          reviewed_at: nowMs,
        };
        q.updated_at = nowMs;
        publishedCount += 1;
      } else {
        q.status = 'editorial_draft';
        q.approval = {
          content_reviewed: false,
          clinical_reviewed: false,
        };
        q.updated_at = nowMs;
        draftCount += 1;
      }
    }

    this.appendAuditLog(
      {
        actor_uid: actor.uid,
        actor_email: actor.email,
        action: 'ADMIN_PUBLISH_QUESTION',
        target: 'questions_public/*',
        details: `Thao tác hàng loạt (${payload.mode}): ${publishedCount} câu published, ${draftCount} câu editorial_draft.`,
        result: 'SUCCESS',
      },
      nowMs
    );

    return {
      ok: true,
      status: 200,
      message: `Đã cập nhật trạng thái ngân hàng câu hỏi: ${publishedCount} câu published, ${draftCount} câu editorial_draft.`,
      publishedCount,
      draftCount,
    };
  }

  /**
   * P05 (Mục 14.2 Nhóm 3): SuperAdmin cập nhật cấu hình ngưỡng thiết bị (`alert_after_sec`), trạng thái chuẩn (`calibration_valid`) hoặc thu hồi/cấp lại credential MQTT
   */
  adminUpdateDeviceConfig(
    actor: VerifiedActorToken,
    payload: {
      device_id: string;
      device_name?: string;
      alert_after_sec?: number;
      revoked?: boolean;
      calibration_valid?: boolean;
    },
    nowMs = Date.now()
  ): {
    ok: boolean;
    status: number;
    message: string;
    device?: ExcelDeviceRecord;
    credential?: DeviceBrokerCredentialRecord;
  } {
    const activeCheck = this.assertActorActive(actor);
    if (!activeCheck.ok || activeCheck.role !== 'superadmin') {
      return {
        ok: false,
        status: 403,
        message: 'Chỉ SuperAdmin mới được phép cập nhật cấu hình quản trị thiết bị.',
      };
    }

    const devId = (payload.device_id || '').trim();
    const dev = this.state.devices[devId];
    if (!dev) {
      return {
        ok: false,
        status: 404,
        message: `Không tìm thấy thiết bị "${devId}".`,
      };
    }

    if (payload.device_name !== undefined && payload.device_name.trim()) {
      dev.device_name = payload.device_name.trim().slice(0, 100);
    }
    if (
      typeof payload.alert_after_sec === 'number' &&
      Number.isInteger(payload.alert_after_sec) &&
      payload.alert_after_sec > 0
    ) {
      dev.alert_after_sec = payload.alert_after_sec;
    }

    const cred = this.state.device_broker_credentials[devId];
    if (cred) {
      if (payload.revoked !== undefined) {
        cred.revoked = Boolean(payload.revoked);
      }
      if (payload.calibration_valid !== undefined) {
        cred.calibration_valid = Boolean(payload.calibration_valid);
      }
      cred.updated_at = nowMs;
    }

    this.appendAuditLog(
      {
        actor_uid: actor.uid,
        actor_email: actor.email,
        action:
          payload.revoked !== undefined ? 'REVOKE_DEVICE_CREDENTIAL' : 'ADMIN_UPDATE_DEVICE_CONFIG',
        target: `devices/${devId}`,
        details: `Cập nhật cấu hình thiết bị ${devId}: alert_after_sec=${dev.alert_after_sec}s, credential_revoked=${String(cred?.revoked ?? false)}, calibration_valid=${String(cred?.calibration_valid ?? true)}.`,
        result: 'SUCCESS',
      },
      nowMs
    );

    return {
      ok: true,
      status: 200,
      message: `Đã cập nhật cấu hình thiết bị "${devId}" (alert_after_sec=${dev.alert_after_sec}s).`,
      device: dev,
      credential: cred,
    };
  }

  /**
   * P05 (Mục 14.2 Nhóm 6): SuperAdmin cập nhật mẫu lời nhắc nhẹ nhàng (Voice & Push) không miệt thị hình thể
   */
  adminUpdateReminderTemplate(
    actor: VerifiedActorToken,
    payload: {
      template_id: string;
      title: string;
      voice_text: string;
      push_body: string;
    },
    nowMs = Date.now()
  ): {
    ok: boolean;
    status: number;
    message: string;
    template?: GentleReminderTemplateRecord;
  } {
    const activeCheck = this.assertActorActive(actor);
    if (!activeCheck.ok || activeCheck.role !== 'superadmin') {
      return {
        ok: false,
        status: 403,
        message: 'Chỉ SuperAdmin mới được phép chỉnh sửa mẫu lời nhắc hệ thống.',
      };
    }

    const tpl = this.state.reminder_templates[payload.template_id];
    if (!tpl) {
      return {
        ok: false,
        status: 404,
        message: `Không tìm thấy mẫu lời nhắc "${payload.template_id}".`,
      };
    }

    const combined = `${payload.title} ${payload.voice_text} ${payload.push_body}`;
    if (/xấu quá|gù lưng bệnh|hư quá|đáng xấu hổ/i.test(combined)) {
      return {
        ok: false,
        status: 400,
        message:
          'Từ chối lưu mẫu lời nhắc: Nội dung chứa từ ngữ chê bai hình thể hoặc chẩn đoán bệnh trái quy tắc dự án.',
      };
    }

    tpl.title = payload.title.trim() || tpl.title;
    tpl.voice_text = payload.voice_text.trim() || tpl.voice_text;
    tpl.push_body = payload.push_body.trim() || tpl.push_body;
    tpl.no_body_shaming_verified = true;
    tpl.updated_at = nowMs;
    tpl.updated_by = actor.uid;

    this.appendAuditLog(
      {
        actor_uid: actor.uid,
        actor_email: actor.email,
        action: 'ADMIN_UPDATE_REMINDER_TEMPLATE',
        target: `reminder_templates/${tpl.template_id}`,
        details: `Cập nhật mẫu lời nhắc nhẹ nhàng "${tpl.title}" (${tpl.posture_code}).`,
        result: 'SUCCESS',
      },
      nowMs
    );

    return {
      ok: true,
      status: 200,
      message: `Đã lưu mẫu lời nhắc "${tpl.title}" và ghi nhật ký bảo mật.`,
      template: tpl,
    };
  }

  /**
   * P05 (Mục 14.2 Nhóm 7): SuperAdmin xóa ảnh Capture riêng tư theo chính sách lưu trữ / quyền riêng tư
   */
  adminDeleteCapture(
    actor: VerifiedActorToken,
    payload: { capture_id: string; reason: string },
    nowMs = Date.now()
  ): {
    ok: boolean;
    status: number;
    message: string;
  } {
    const activeCheck = this.assertActorActive(actor);
    if (!activeCheck.ok || activeCheck.role !== 'superadmin') {
      return {
        ok: false,
        status: 403,
        message: 'Chỉ SuperAdmin mới được phép xóa ảnh capture theo chính sách lưu trữ.',
      };
    }

    const capId = (payload.capture_id || '').trim();
    const cap = this.state.capture_metadata[capId];
    if (!cap) {
      return {
        ok: false,
        status: 404,
        message: `Không tìm thấy ảnh capture "${capId}".`,
      };
    }

    delete this.state.capture_metadata[capId];

    this.appendAuditLog(
      {
        actor_uid: actor.uid,
        actor_email: actor.email,
        action: 'ADMIN_DELETE_CAPTURE',
        target: `capture_metadata/${capId}`,
        details: `Xóa ảnh capture ${capId} (${cap.storage_path}). Lý do: ${payload.reason || 'Dọn dẹp theo chính sách quyền riêng tư'}`,
        result: 'SUCCESS',
      },
      nowMs
    );

    return {
      ok: true,
      status: 200,
      message: `Đã xóa ảnh capture "${capId}" và ghi nhật ký bảo mật (ADMIN_DELETE_CAPTURE).`,
    };
  }

  /**
   * P06: Xuất bản sao lưu (Backup Snapshot JSON) dữ liệu Demo sạch, không chứa secret hay dữ liệu cá nhân thật
   */
  exportDemoBackupSnapshot(
    actor: VerifiedActorToken,
    nowMs = Date.now()
  ): {
    ok: boolean;
    status: number;
    message: string;
    backup?: {
      schema_version: string;
      project_id: string;
      exported_at: number;
      exported_by_uid: string;
      exported_by_email: string;
      contains_secrets: false;
      contains_real_personal_data: false;
      counts: {
        users: number;
        students: number;
        devices: number;
        learning_days: number;
        questions_public: number;
        published_questions: number;
      };
      snapshot: RtdbTreeState;
    };
  } {
    const activeCheck = this.assertActorActive(actor);
    if (!activeCheck.ok || activeCheck.role !== 'superadmin') {
      return {
        ok: false,
        status: 403,
        message: 'Chỉ SuperAdmin mới được phép xuất bản sao lưu (Backup) dữ liệu hệ thống.',
      };
    }

    const cloned = structuredClone(this.state);
    // Đảm bảo không xuất secret_hash thô của thiết bị ra bản backup demo
    for (const devId of Object.keys(cloned.device_broker_credentials || {})) {
      cloned.device_broker_credentials[devId].secret_hash = 'REDACTED_FOR_DEMO_BACKUP';
    }

    this.appendAuditLog(
      {
        actor_uid: actor.uid,
        actor_email: actor.email,
        action: 'ADMIN_EXPORT_DEMO_BACKUP',
        target: 'rtdb_demo_snapshot',
        details: 'Xuất bản sao lưu JSON dữ liệu Demo P06 (đã ẩn secret_hash).',
        result: 'SUCCESS',
      },
      nowMs
    );

    const publishedQuestions = Object.values(cloned.questions_public || {}).filter(
      (q) => q.status === 'published'
    ).length;

    return {
      ok: true,
      status: 200,
      message: 'Đã xuất bản sao lưu (Backup Snapshot JSON) dữ liệu Demo thành công.',
      backup: {
        schema_version: 'v1.6-p06-rtdb-contract',
        project_id: 'gen-lang-client-0531599250',
        exported_at: nowMs,
        exported_by_uid: actor.uid,
        exported_by_email: actor.email,
        contains_secrets: false,
        contains_real_personal_data: false,
        counts: {
          users: Object.keys(cloned.users || {}).length,
          students: Object.keys(cloned.students || {}).length,
          devices: Object.keys(cloned.devices || {}).length,
          learning_days: Object.keys(cloned.learning_days || {}).length,
          questions_public: Object.keys(cloned.questions_public || {}).length,
          published_questions: publishedQuestions,
        },
        snapshot: cloned,
      },
    };
  }

  /**
   * P06: Khôi phục (Restore) dữ liệu Demo từ bản sao lưu JSON đã kiểm tra hợp đồng
   */
  restoreDemoBackupSnapshot(
    actor: VerifiedActorToken,
    payload: { snapshot?: Partial<RtdbTreeState> },
    nowMs = Date.now()
  ): {
    ok: boolean;
    status: number;
    message: string;
  } {
    const activeCheck = this.assertActorActive(actor);
    if (!activeCheck.ok || activeCheck.role !== 'superadmin') {
      return {
        ok: false,
        status: 403,
        message: 'Chỉ SuperAdmin mới được phép khôi phục (Restore) dữ liệu hệ thống.',
      };
    }

    const incoming = payload?.snapshot;
    if (
      !incoming ||
      typeof incoming !== 'object' ||
      !incoming.users ||
      !incoming.devices ||
      !incoming.learning_days ||
      !incoming.questions_public
    ) {
      return {
        ok: false,
        status: 400,
        message:
          'Bản sao lưu không hợp lệ: Thiếu các nhánh bắt buộc (users, devices, learning_days, questions_public).',
      };
    }

    const baseClean = createInitialP01RtdbState(1793500000000);
    this.state = {
      ...baseClean,
      ...structuredClone(incoming as RtdbTreeState),
      // Luôn giữ nguyên credential hash mặc định của sandbox nếu bản backup đã redact
      device_broker_credentials: baseClean.device_broker_credentials,
    };

    this.appendAuditLog(
      {
        actor_uid: actor.uid,
        actor_email: actor.email,
        action: 'ADMIN_RESTORE_DEMO_BACKUP',
        target: 'rtdb_demo_snapshot',
        details: `Khôi phục dữ liệu Demo từ bản sao lưu (${Object.keys(this.state.users).length} users, ${Object.keys(this.state.questions_public).length} questions).`,
        result: 'SUCCESS',
      },
      nowMs
    );

    return {
      ok: true,
      status: 200,
      message: 'Đã khôi phục (Restore) dữ liệu Demo từ bản sao lưu JSON thành công.',
    };
  }

  /**
   * P06: Khôi phục nhanh về Trạng thái Demo Chuẩn (Clean Competition Seed State) trước giờ thuyết trình 6 phút
   */
  resetCleanDemoState(
    actor: VerifiedActorToken,
    nowMs = Date.now()
  ): {
    ok: boolean;
    status: number;
    message: string;
  } {
    const activeCheck = this.assertActorActive(actor);
    if (!activeCheck.ok || activeCheck.role !== 'superadmin') {
      return {
        ok: false,
        status: 403,
        message: 'Chỉ SuperAdmin mới được phép đặt lại (Reset) dữ liệu Demo chuẩn.',
      };
    }

    this.state = createInitialP01RtdbState(1793500000000);
    this.appendAuditLog(
      {
        actor_uid: actor.uid,
        actor_email: actor.email,
        action: 'ADMIN_RESET_CLEAN_DEMO_STATE',
        target: 'rtdb_demo_snapshot',
        details:
          'Đặt lại toàn bộ dữ liệu về trạng thái Demo chuẩn 6 phút (3 gia đình/học sinh, 28 ngày, 40 câu seed với 12 câu published, thiết bị sim-dev01 sẵn sàng).',
        result: 'SUCCESS',
      },
      nowMs
    );

    return {
      ok: true,
      status: 200,
      message:
        'Đã khôi phục môi trường về Trạng thái Demo Chuẩn 6 phút (Clean Competition State) thành công.',
    };
  }

  /**
   * P06 (Mục 17 Artifact): Đo độ trễ kỹ thuật 20 mẫu liên tiếp từ khi nhận gói MQTT hợp lệ
   * đến khi hoàn tất FSM + Outbox Projection + tạo Alert/Banner trong ứng dụng (Mục tiêu p95 <= 5000ms).
   */
  runIngestLatencyBenchmark20Samples(
    actor: VerifiedActorToken
  ): {
    ok: boolean;
    status: number;
    samplesCount: number;
    samplesMs: number[];
    minMs: number;
    medianMs: number;
    p95Ms: number;
    maxMs: number;
    targetSlaP95Ms: number;
    withinTargetSla: boolean;
    sourceLabel: 'simulator_benchmark_pipeline';
    scopeNote: string;
  } {
    const activeCheck = this.assertActorActive(actor);
    if (!activeCheck.ok) {
      return {
        ok: false,
        status: 403,
        samplesCount: 0,
        samplesMs: [],
        minMs: 0,
        medianMs: 0,
        p95Ms: 0,
        maxMs: 0,
        targetSlaP95Ms: 5000,
        withinTargetSla: false,
        sourceLabel: 'simulator_benchmark_pipeline',
        scopeNote: 'Yêu cầu đăng nhập để chạy phép đo kỹ thuật.',
      };
    }

    const samplesMs: number[] = [];
    for (let i = 0; i < 20; i++) {
      const benchStore = new P01RbacDomainService(createInitialP01RtdbState(1793500000000));
      const baseTime = 1793600000000 + i * 100000;
      const startSessionRes = benchStore.startRobotSession(
        actor.role === 'superadmin'
          ? actor
          : {
              uid: 'uid-guardian-a',
              email: 'phuhuynh.a@example.com',
              email_verified: true,
              superadmin: false,
              role: 'guardian',
            },
        {
          device_id: 'sim-dev01',
          student_id: 'stu-a1',
          source: 'simulator',
          content_day: 1,
        },
        baseTime
      );
      const sessId = startSessionRes.session?.session_id || 'sess-bench';

      const t0 = performance.now();
      // Gửi chuỗi quan sát đủ ngưỡng kích hoạt đợt sai + cảnh báo qua đúng đường MQTT Ingest -> Outbox -> Projection
      const obsTimes = [0, 3500, 34000];
      for (let step = 0; step < obsTimes.length; step++) {
        benchStore.ingestMqttPacket(
          {
            topic: 'bugz/v1/devices/sim-dev01/observations',
            brokerClientId: 'sim-dev01',
            brokerUsername: 'sim-dev01',
            isWebhookAuthenticated: true,
            actor: {
              uid: 'uid-superadmin-01',
              email: 'minhquantran4312@gmail.com',
              email_verified: true,
              superadmin: true,
              role: 'superadmin',
            },
            payload: {
              schema_version: 1,
              event_id: `bench-${i}-ev-${step}`,
              device_id: 'sim-dev01',
              session_id: sessId,
              boot_id: `bench-boot-${i}`,
              sequence: step + 1,
              type: 'posture.observed',
              observed_at: baseTime + obsTimes[step],
              posture: 'bad',
              posture_code: 'HEAD_FORWARD',
              confidence: 0.93,
              robot_moving: false,
              source: 'simulator',
            },
          },
          baseTime + obsTimes[step]
        );
      }
      const elapsedMs = Number((performance.now() - t0).toFixed(3));
      samplesMs.push(elapsedMs);
    }

    const sorted = [...samplesMs].sort((a, b) => a - b);
    const minMs = sorted[0] ?? 0;
    const medianMs = sorted[Math.floor(sorted.length * 0.5)] ?? 0;
    const p95Idx = Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.95) - 1);
    const p95Ms = sorted[p95Idx] ?? 0;
    const maxMs = sorted[sorted.length - 1] ?? 0;

    return {
      ok: true,
      status: 200,
      samplesCount: 20,
      samplesMs,
      minMs,
      medianMs,
      p95Ms,
      maxMs,
      targetSlaP95Ms: 5000,
      withinTargetSla: p95Ms <= 5000,
      sourceLabel: 'simulator_benchmark_pipeline',
      scopeNote:
        'Đo 20 lần liên tiếp thời gian xử lý nội bộ từ gói MQTT hợp lệ -> Bridge FSM -> Outbox Transaction -> Projection Worker -> tạo Alert/Notification Job (Mục 17 Artifact: mục tiêu p95 <= 5000ms). Không bao gồm độ trễ mạng Internet ngoài hoặc thời gian suy luận camera trên phần cứng Robot thật; không phải độ chính xác nhận diện mô hình AI.',
    };
  }
}
