/**
 * Hợp đồng kiểu dữ liệu gốc và mở rộng cho dự án BUGZ BrightUpGenZ
 * Tuân thủ firebase_schema_contract.json (v1) và BUGZ_ARTIFACT_TRIEN_KHAI_5_NGAY.md
 * Database: Firebase Realtime Database (KHÔNG dùng Firestore/SQL)
 */

export type UserRole = 'superadmin' | 'user' | 'guardian' | 'student';

export type PostureState = 'good' | 'bad' | 'absent' | 'unknown';

export type DataSourceType = 'real' | 'simulator';

export type PublishStatus = 'editorial_draft' | 'published' | 'unverified_asset';

export type VerificationStatus = 'PASS' | 'FAIL' | 'BLOCKED' | 'NOT_RUN';

export type NotificationDeliveryState =
  | 'queued'
  | 'accepted_by_provider'
  | 'failed'
  | 'suppressed';

export type PostureReasonCode =
  | 'HEAD_FORWARD'
  | 'TRUNK_LEAN'
  | 'EYES_TOO_CLOSE'
  | 'UNSPECIFIED_BAD_POSTURE';

export type PostureCode = PostureReasonCode;

export type AlertSeverity = 'low' | 'medium' | 'high';

// ============================================================================
// 1. BỐN NHÁNH GỐC BẮT BUỘC TRONG EXCEL (core_paths)
// ============================================================================

/** Đường dẫn: users/{uid} */
export interface UserRecord {
  full_name: string;
  email: string;
  phone?: string;
}

/** Đường dẫn: devices/{device_id} */
export interface DeviceRecord {
  /** UID của Phụ huynh sở hữu thiết bị */
  user_id: string;
  device_name: string;
  /** Yêu cầu bật/tắt giám sát từ phía ứng dụng */
  monitoring_enabled: boolean;
  /** Trạng thái tư thế hiện tại: chỉ nhận good | bad | absent | unknown */
  current_posture: PostureState;
  /** Trạng thái Robot đã ACK đang giám sát thực tế */
  monitoring_active: boolean;
  /** Ngưỡng giây cảnh báo kỹ thuật thử nghiệm (ví dụ: 30) */
  alert_after_sec: number;
  /** Thời điểm kết nối cuối (UTC epoch ms, tùy chọn) */
  last_seen_at?: number;
}

/** Đường dẫn: sessions/{device_id}/{session_id} */
export interface SessionRecord {
  device_id: string;
  started_at: number; // UTC epoch ms
  /** Chỉ có khi phiên đã đóng (RTDB không lưu null, bỏ trường khi đang mở) */
  ended_at?: number; // UTC epoch ms >= started_at
  /** Số ĐỢT tư thế đúng ổn định (không phải số khung hình) */
  good_count: number;
  /** Số ĐỢT tư thế chưa phù hợp ổn định (không phải số cảnh báo hay khung hình) */
  bad_count: number;
  // Trường mở rộng có lý do theo Artifact Mục 11.2:
  student_id?: string;
  source?: DataSourceType;
  content_day?: number;
}

/** Đường dẫn: alerts/{device_id}/{session_id}/{alert_id} */
export interface AlertRecord {
  session_id: string;
  message: string;
  created_at: number; // UTC epoch ms
  /** Trạng thái phụ huynh đã đọc trong ứng dụng (không đồng nhất với FCM/Email) */
  is_read: boolean;
  // Trường mở rộng có lý do theo Artifact Mục 11.2:
  student_id?: string;
  event_id?: string;
  episode_id?: string;
  posture_code?: PostureReasonCode;
  severity?: AlertSeverity;
  occurred_at?: number;
  received_at?: number;
  time_basis?: 'observed_at' | 'received_at';
  image_id?: string;
  source?: DataSourceType;
}

// ============================================================================
// 2. CÁC NHÁNH MỞ RỘNG CÓ LÝ DO (extensions trong firebase_schema_contract.json)
// ============================================================================

/** Đường dẫn: account_roles/{uid} */
export interface AccountRoleRecord {
  role: UserRole;
  disabled?: boolean;
  updated_at: number;
  verified_by: 'server_bootstrap' | 'admin_sdk';
}

/** Đường dẫn: students/{student_id} */
export interface StudentRecord {
  student_id: string;
  display_name: string;
  age_group: 'primary' | 'middle_school';
  guardian_owner_uid: string;
  auth_uid?: string;
  timezone: string; // Mặc định: 'Asia/Ho_Chi_Minh'
}

/** Đường dẫn: learning_days/{day_number} */
export interface LearningDayMeta {
  day_number: number;
  week_number: 1 | 2 | 3 | 4;
  title: string;
  main_asset_filename: string;
  main_asset_drive_id?: string;
  main_asset_verified: boolean;
  info_asset_filename?: string;
  info_asset_drive_id?: string;
  info_asset_verified: boolean;
  medal_asset_filename?: string;
  medal_asset_drive_id?: string;
  medal_asset_verified: boolean;
  needs_clinical_review: boolean;
  is_certificate_day?: boolean;
  source_version: string;
  publish_status: PublishStatus;
}

/** Đường dẫn: learning_progress/{student_id}/{day_number} */
export interface LearningProgressRecord {
  day_number: number;
  status: 'not_started' | 'viewing' | 'self_completed';
  viewed_at?: number;
  self_completed_at?: number;
  source_version: string;
  medal_asset?: string;
}

/** Hợp đồng gói tin MQTT từ Robot hoặc Simulator (Mục 12.2 Artifact) */
export interface MqttObservationPayload {
  schema_version: 1;
  event_id: string;
  device_id: string;
  session_id: string;
  boot_id: string;
  sequence: number;
  type: 'posture.observed' | 'episode.started' | 'episode.ended';
  observed_at: number;
  posture: PostureState;
  posture_code?: PostureReasonCode;
  confidence?: number;
  robot_moving: boolean;
  capture_id?: string;
  source: DataSourceType;
}

/** Trạng thái thực tế của từng dịch vụ tích hợp (Mục 6 & 7 Instructions) */
export interface IntegrationComponentStatus {
  id: string;
  name: string;
  status: VerificationStatus;
  uiLabel?: string;
  requiredStage?: string;
  summary: string;
  requiredEnvVars: string[];
  configuredEnvVars: string[];
  externalActionRequired: string;
}

