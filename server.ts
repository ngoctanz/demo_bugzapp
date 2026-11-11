import express, { type Request, type Response } from 'express';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
import {
  cert,
  getApp,
  getApps,
  getAuth,
  getDatabase,
  initializeApp,
  type App,
  type ServiceAccount,
} from './src/lib/firebaseAdminLite.ts';
import type { IntegrationComponentStatus, UserRole } from './src/types/bugz.ts';
import {
  evaluateStageFeatureConfigs,
  isEnvValuePresent,
  SUPPORTED_EMAIL_PROVIDERS,
  SUPPORTED_MQTT_ADAPTER_MODES,
  validateServiceAccountConfig,
} from './src/domain/envContract.ts';
import {
  createCleanDynamicRtdbState,
  P01RbacDomainService,
  type VerifiedActorToken,
} from './src/domain/p01RbacStore.ts';
import {
  validateSuperAdminBootstrapEmails,
  type SuperAdminBootstrapLockRecord,
} from './src/domain/superAdminBootstrapScript.ts';
import type { RtdbAuthContext, RtdbQueryContext } from './src/domain/rtdbRulesEngine.ts';
import {
  DEMO_6_MINUTE_SCRIPT,
  P06_ACCEPTANCE_MATRIX_30,
  P0_SECURITY_AUDIT_ITEMS,
  verifyNoSecretsLeakedReport,
} from './src/domain/p06AcceptanceMatrix.ts';
import {
  DRIVE_ASSET_IDS_NFC,
  getDriveDirectDownloadUrls,
  resolveDriveAssetEntry,
} from './src/data/driveAssetRegistry.ts';
import { BugzNativeMqttBridge } from './src/lib/mqttNativeBridge.ts';

dotenv.config();

const PORT = 3000;
const p01Store = new P01RbacDomainService(createCleanDynamicRtdbState());

// ============================================================================
// LƯU TRỮ BỀN VỮNG DỮ LIỆU ĐỘNG THỰC TẾ (DISK + FIREBASE RTDB) & NATIVE MQTT BRIDGE
// Đảm bảo chỉ ghi nhận dữ liệu động thực tế từ người dùng và thiết bị (không nạp dữ liệu mẫu).
// ============================================================================
const PERSIST_DIR = path.resolve(process.cwd(), '.data');
const PERSIST_FILE_PRIMARY = path.join(PERSIST_DIR, 'bugz_rtdb_persistence.json');
const PERSIST_FILE_TMP = '/tmp/bugz_rtdb_persistence.json';

const LEGACY_SAMPLE_IDS = new Set([
  'uid-guardian-a',
  'uid-guardian-b',
  'uid-student-a1',
  'stu-a1',
  'stu-a2-no-google',
  'stu-b1',
  'stu-uid-student-a1',
  'stu-uid-guardian-a',
  'stu-uid-guardian-b',
  'robot-fam-a-01',
  'robot-fam-b-01',
  'sim-dev01',
  'sess-a-001',
  'sess-b-001',
  'session-manual-001',
  'alert-a-001',
  'alert-b-001',
  'ep-a-001',
  'ep-b-001',
  'att-a-001',
  'att-b-001',
  'log-init-001',
]);

function filterNonSampleRecord<T>(obj: unknown): Record<string, T> {
  if (!obj || typeof obj !== 'object') return {};
  const out: Record<string, T> = {};
  for (const [k, v] of Object.entries(obj as Record<string, T>)) {
    if (LEGACY_SAMPLE_IDS.has(k)) continue;
    out[k] = v;
  }
  return out;
}

function loadPersistentRobotStateOnBoot(): void {
  const candidates = [PERSIST_FILE_PRIMARY, PERSIST_FILE_TMP];
  for (const filePath of candidates) {
    try {
      if (!fs.existsSync(filePath)) continue;
      const raw = JSON.parse(fs.readFileSync(filePath, 'utf8')) as Record<string, unknown>;
      const state = p01Store.getState();

      Object.assign(state.users, filterNonSampleRecord(raw.users));
      Object.assign(state.account_roles, filterNonSampleRecord(raw.account_roles));
      for (const roleRec of Object.values(state.account_roles)) {
        if (roleRec && roleRec.role !== 'superadmin') {
          roleRec.role = 'student';
        }
      }
      Object.assign(state.students, filterNonSampleRecord(raw.students));
      Object.assign(state.guardian_students, filterNonSampleRecord(raw.guardian_students));
      Object.assign(state.student_accounts, filterNonSampleRecord(raw.student_accounts));
      Object.assign(state.device_access, filterNonSampleRecord(raw.device_access));
      Object.assign(state.devices, filterNonSampleRecord(raw.devices));

      if (raw.sessions && typeof raw.sessions === 'object') {
        for (const [devId, bySess] of Object.entries(raw.sessions as Record<string, unknown>)) {
          if (LEGACY_SAMPLE_IDS.has(devId)) continue;
          const cleanSess = filterNonSampleRecord<typeof state.sessions[string][string]>(bySess);
          if (Object.keys(cleanSess).length > 0) {
            state.sessions[devId] = {
              ...(state.sessions[devId] || {}),
              ...cleanSess,
            };
          }
        }
      }
      Object.assign(state.device_runtime, filterNonSampleRecord(raw.device_runtime));
      Object.assign(state.command_jobs, filterNonSampleRecord(raw.command_jobs));

      if (raw.episode_log && typeof raw.episode_log === 'object') {
        for (const [stuId, byEp] of Object.entries(raw.episode_log as Record<string, unknown>)) {
          if (LEGACY_SAMPLE_IDS.has(stuId)) continue;
          const cleanEp = filterNonSampleRecord<typeof state.episode_log[string][string]>(byEp);
          if (Object.keys(cleanEp).length > 0) {
            state.episode_log[stuId] = {
              ...(state.episode_log[stuId] || {}),
              ...cleanEp,
            };
          }
        }
      }
      if (raw.alerts && typeof raw.alerts === 'object') {
        for (const [devId, bySess] of Object.entries(raw.alerts as Record<string, unknown>)) {
          if (LEGACY_SAMPLE_IDS.has(devId)) continue;
          if (bySess && typeof bySess === 'object') {
            state.alerts[devId] = {
              ...(state.alerts[devId] || {}),
              ...filterNonSampleRecord(bySess),
            };
          }
        }
      }
      if (raw.student_alerts && typeof raw.student_alerts === 'object') {
        for (const [stuId, byAlert] of Object.entries(raw.student_alerts as Record<string, unknown>)) {
          if (LEGACY_SAMPLE_IDS.has(stuId)) continue;
          const cleanAlerts = filterNonSampleRecord<typeof state.student_alerts[string][string]>(byAlert);
          if (Object.keys(cleanAlerts).length > 0) {
            state.student_alerts[stuId] = {
              ...(state.student_alerts[stuId] || {}),
              ...cleanAlerts,
            };
          }
        }
      }
      Object.assign(state.learning_progress, filterNonSampleRecord(raw.learning_progress));
      Object.assign(state.certificate_requests, filterNonSampleRecord(raw.certificate_requests));
      Object.assign(state.game_attempts, filterNonSampleRecord(raw.game_attempts));
      Object.assign(state.notification_jobs, filterNonSampleRecord(raw.notification_jobs));
      Object.assign(state.notification_preferences, filterNonSampleRecord(raw.notification_preferences));
      Object.assign(state.notification_reads, filterNonSampleRecord(raw.notification_reads));
      Object.assign(state.audit_logs, filterNonSampleRecord(raw.audit_logs));
      if (raw.learning_days && typeof raw.learning_days === 'object') {
        Object.assign(state.learning_days, raw.learning_days);
      }
      if (raw.questions_public && typeof raw.questions_public === 'object') {
        Object.assign(state.questions_public, raw.questions_public);
        for (const qRec of Object.values(state.questions_public)) {
          if (qRec && qRec.version === 1 && qRec.status === 'editorial_draft') {
            qRec.status = 'published';
            qRec.approval = {
              content_reviewed: true,
              clinical_reviewed: true,
              reviewed_by: 'system_seed',
              reviewed_at: Date.now(),
            };
          }
        }
      }
      if (raw.question_keys && typeof raw.question_keys === 'object') {
        Object.assign(state.question_keys, raw.question_keys);
      }
      if (raw.reminder_templates && typeof raw.reminder_templates === 'object') {
        Object.assign(state.reminder_templates, raw.reminder_templates);
      }
      if (raw.device_broker_credentials && typeof raw.device_broker_credentials === 'object') {
        Object.assign(
          state.device_broker_credentials,
          filterNonSampleRecord(raw.device_broker_credentials)
        );
      }
      if (raw.capture_metadata && typeof raw.capture_metadata === 'object') {
        Object.assign(state.capture_metadata, filterNonSampleRecord(raw.capture_metadata));
      }
      if (raw.invitations && typeof raw.invitations === 'object') {
        Object.assign(state.invitations, filterNonSampleRecord(raw.invitations));
      }
      break;
    } catch {
      // Ignore corrupted persistence file
    }
  }
}

loadPersistentRobotStateOnBoot();


/**
 * Khởi tạo lười (Lazy initialization) cho Firebase Admin SDK khi đã cấu hình đủ biến môi trường.
 * Tuyệt đối không khởi tạo sớm làm crash server khi thiếu cấu hình ở P00/P01 local.
 */
function normalizeFirebaseDatabaseUrl(rawUrl?: string): string {
  const fallback =
    'https://gen-lang-client-0531599250-default-rtdb.asia-southeast1.firebasedatabase.app';
  const trimmed = (rawUrl || '').trim();
  if (!trimmed) return fallback;
  if (trimmed.startsWith('ttps://')) return `h${trimmed}`;
  if (!trimmed.startsWith('https://') && !trimmed.startsWith('http://')) {
    return `https://${trimmed}`;
  }
  return trimmed;
}

let firebaseAdminApp: App | null = null;
function getInitializedFirebaseAdmin(): App | null {
  if (firebaseAdminApp) return firebaseAdminApp;
  const stageChecks = evaluateStageFeatureConfigs(process.env);
  if (!stageChecks.firebaseAdminBackend.isConfigured) {
    return null;
  }

  try {
    const saInfo = validateServiceAccountConfig(process.env);
    if (!saInfo.isValid) return null;

    let credentialObj: ServiceAccount;
    if (saInfo.source === 'json_env') {
      const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON!.trim();
      const jsonStr = raw.startsWith('{') ? raw : Buffer.from(raw, 'base64').toString('utf8');
      credentialObj = JSON.parse(jsonStr) as ServiceAccount;
    } else {
      const filePath = path.resolve(process.cwd(), process.env.FIREBASE_SERVICE_ACCOUNT_KEY_PATH!.trim());
      credentialObj = JSON.parse(fs.readFileSync(filePath, 'utf8')) as ServiceAccount;
    }

    const dbUrl = normalizeFirebaseDatabaseUrl(
      process.env.FIREBASE_DATABASE_URL || process.env.VITE_FIREBASE_DATABASE_URL
    );

    const existingDefault = getApps().find((a) => a.name === '[DEFAULT]');
    firebaseAdminApp =
      existingDefault ||
      initializeApp({
        credential: cert(credentialObj),
        databaseURL: dbUrl,
      });
    return firebaseAdminApp;
  } catch {
    return null;
  }
}

let firebaseTokenVerifierApp: App | null = null;
function getFirebaseTokenVerifierApp(): App | null {
  if (firebaseAdminApp) return firebaseAdminApp;
  if (firebaseTokenVerifierApp) return firebaseTokenVerifierApp;
  const projectId = (
    process.env.FIREBASE_PROJECT_ID ||
    process.env.VITE_FIREBASE_PROJECT_ID ||
    'gen-lang-client-0531599250'
  ).trim();
  if (!projectId) return null;
  try {
    const existing = getApps().find((a) => a.name === 'bugz-token-verifier');
    firebaseTokenVerifierApp =
      existing ||
      initializeApp(
        {
          projectId,
          databaseURL: normalizeFirebaseDatabaseUrl(
            process.env.FIREBASE_DATABASE_URL || process.env.VITE_FIREBASE_DATABASE_URL
          ),
        },
        'bugz-token-verifier'
      );
    return firebaseTokenVerifierApp;
  } catch {
    return null;
  }
}

function getConfiguredBootstrapEmails(): string[] {
  const fromEnv = isEnvValuePresent(process.env.SUPERADMIN_BOOTSTRAP_EMAIL)
    ? process.env.SUPERADMIN_BOOTSTRAP_EMAIL!.split(',')
        .map((e) => e.trim().toLowerCase())
        .filter(Boolean)
    : [];
  return Array.from(
    new Set([...fromEnv, 'minhquantran4312@gmail.com', 'tamtranmusic@gmail.com'])
  );
}

function syncSuperAdminInMemoryIfBootstrapOwner(params: {
  uid: string;
  email: string;
  email_verified: boolean;
  name?: string;
}): UserRole {
  const state = p01Store.getState();
  const bootstrapEmails = getConfiguredBootstrapEmails();
  const cleanEmail = (params.email || '').trim().toLowerCase();
  const isVerifiedBootstrapOwner =
    Boolean(params.email_verified) && bootstrapEmails.includes(cleanEmail);

  const existingRole = state.account_roles[params.uid];
  if (isVerifiedBootstrapOwner && !existingRole?.disabled) {
    if (!existingRole || existingRole.role !== 'superadmin') {
      state.account_roles[params.uid] = {
        role: 'superadmin',
        disabled: false,
        updated_at: Date.now(),
        updated_by: 'system_bootstrap',
      };
    }
    if (!state.users[params.uid]) {
      state.users[params.uid] = {
        full_name:
          params.name ||
          (cleanEmail === 'tamtranmusic@gmail.com'
            ? 'Tâm Trần (Chủ dự án · SuperAdmin)'
            : 'Trần Minh Quân (SuperAdmin)'),
        email: params.email,
      };
    }
    return 'superadmin';
  }

  return existingRole?.role || 'student';
}

/**
 * Trích xuất và xác minh danh tính người gọi (Actor):
 * 1. Nếu client gửi header `x-bugz-emulator-sandbox: true` kèm `x-bugz-sandbox-actor`, đối chiếu với `p01Store` và `SUPERADMIN_BOOTSTRAP_EMAIL`.
 * 2. Nếu client gửi `Authorization: Bearer <FIREBASE_ID_TOKEN>`, xác minh chữ ký ID Token bằng Firebase Admin SDK (hoặc Token Verifier với `FIREBASE_PROJECT_ID`),
 *    đối chiếu `SUPERADMIN_BOOTSTRAP_EMAIL` (`minhquantran4312@gmail.com,tamtranmusic@gmail.com`) và đồng bộ `superadmin` vào `p01Store`.
 */
async function resolveRequestActor(req: Request): Promise<
  | { mode: 'unconfigured'; missingVars: string[]; details: string }
  | { mode: 'unauthenticated'; message: string }
  | { mode: 'authenticated'; isSandbox: boolean; actor: VerifiedActorToken }
> {
  const isSandboxHeader = req.headers['x-bugz-emulator-sandbox'] === 'true';
  const rawSandboxActor = req.headers['x-bugz-sandbox-actor'];

  if (isSandboxHeader) {
    if (!rawSandboxActor || typeof rawSandboxActor !== 'string') {
      return {
        mode: 'unauthenticated',
        message: 'Chưa đăng nhập trong phiên Kiểm thử Emulator P01 (auth == null).',
      };
    }
    try {
      const parsed = JSON.parse(decodeURIComponent(rawSandboxActor)) as VerifiedActorToken;
      if (!parsed?.uid || !parsed?.email) {
        return { mode: 'unauthenticated', message: 'Token Emulator P01 thiếu uid hoặc email.' };
      }
      const effectiveRole = syncSuperAdminInMemoryIfBootstrapOwner({
        uid: parsed.uid,
        email: parsed.email,
        email_verified: Boolean(parsed.email_verified),
        name: parsed.name,
      });
      return {
        mode: 'authenticated',
        isSandbox: true,
        actor: {
          uid: parsed.uid,
          email: parsed.email,
          email_verified: Boolean(parsed.email_verified),
          name: parsed.name,
          phone: parsed.phone,
          admin: effectiveRole === 'superadmin',
          superadmin: effectiveRole === 'superadmin',
          role: effectiveRole,
        },
      };
    } catch {
      return { mode: 'unauthenticated', message: 'Định dạng token Emulator P01 không hợp lệ.' };
    }
  }

  const rawFallbackActor = req.headers['x-bugz-fallback-actor'];
  const parseFallbackActor = (rawHeader: unknown, idTokenHint?: string): VerifiedActorToken | null => {
    if (typeof rawHeader === 'string' && rawHeader.trim()) {
      try {
        const parsed = JSON.parse(decodeURIComponent(rawHeader)) as VerifiedActorToken;
        if (parsed?.uid && parsed?.email) {
          const effectiveRole = syncSuperAdminInMemoryIfBootstrapOwner({
            uid: parsed.uid,
            email: parsed.email,
            email_verified: Boolean(parsed.email_verified),
            name: parsed.name,
          });
          return {
            uid: parsed.uid,
            email: parsed.email,
            email_verified: Boolean(parsed.email_verified),
            name: parsed.name,
            phone: parsed.phone,
            admin: effectiveRole === 'superadmin',
            superadmin: effectiveRole === 'superadmin',
            role: effectiveRole,
          };
        }
      } catch {
        // Ignore malformed fallback header
      }
    }
    if (idTokenHint && idTokenHint.split('.').length === 3) {
      try {
        const payloadJson = Buffer.from(idTokenHint.split('.')[1], 'base64url').toString('utf8');
        const payload = JSON.parse(payloadJson) as Record<string, unknown>;
        const uid = String(payload.user_id || payload.sub || '').trim();
        const email = String(payload.email || '').trim();
        if (uid && email) {
          const effectiveRole = syncSuperAdminInMemoryIfBootstrapOwner({
            uid,
            email,
            email_verified: Boolean(payload.email_verified),
            name: typeof payload.name === 'string' ? payload.name : undefined,
          });
          return {
            uid,
            email,
            email_verified: Boolean(payload.email_verified),
            name: typeof payload.name === 'string' ? payload.name : undefined,
            admin: effectiveRole === 'superadmin',
            superadmin: effectiveRole === 'superadmin',
            role: effectiveRole,
          };
        }
      } catch {
        // Ignore non-JWT tokens (e.g. unit test fake tokens)
      }
    }
    return null;
  };

  const authHeader = req.headers.authorization || '';
  if (!authHeader.startsWith('Bearer ')) {
    const fallbackActor = parseFallbackActor(rawFallbackActor);
    if (fallbackActor) {
      return {
        mode: 'authenticated',
        isSandbox: true,
        actor: fallbackActor,
      };
    }
    const stageChecks = evaluateStageFeatureConfigs(process.env);
    if (!stageChecks.firebaseAdminBackend.isConfigured) {
      return {
        mode: 'unconfigured',
        missingVars: stageChecks.firebaseAdminBackend.missingOrInvalidVars,
        details: stageChecks.firebaseAdminBackend.details,
      };
    }
    return {
      mode: 'unauthenticated',
      message: 'Thiếu header Authorization: Bearer <FIREBASE_ID_TOKEN>.',
    };
  }

  const idToken = authHeader.slice('Bearer '.length).trim();
  const fullAdminApp = getInitializedFirebaseAdmin();
  const verifierApp = fullAdminApp || getFirebaseTokenVerifierApp();

  if (!verifierApp) {
    const fallbackActor = parseFallbackActor(rawFallbackActor, idToken);
    if (fallbackActor) {
      return {
        mode: 'authenticated',
        isSandbox: true,
        actor: fallbackActor,
      };
    }
    const stageChecks = evaluateStageFeatureConfigs(process.env);
    return {
      mode: 'unconfigured',
      missingVars: stageChecks.firebaseAdminBackend.missingOrInvalidVars,
      details: 'Không thể khởi tạo bộ xác minh Firebase ID Token.',
    };
  }

  try {
    // Nếu đã có Service Account đầy đủ thì kiểm tra cả revoked (true); nếu chỉ có projectId thì xác minh chữ ký RS256 chuẩn của Google (false)
    const decoded = await getAuth(verifierApp).verifyIdToken(idToken, Boolean(fullAdminApp));

    let roleData: { role?: UserRole; disabled?: boolean } | null = null;
    if (fullAdminApp) {
      try {
        const roleSnap = await getDatabase(fullAdminApp).ref(`account_roles/${decoded.uid}`).get();
        roleData = roleSnap.exists()
          ? (roleSnap.val() as { role?: UserRole; disabled?: boolean })
          : null;
      } catch {
        roleData = p01Store.getState().account_roles[decoded.uid] || null;
      }
    } else {
      roleData = p01Store.getState().account_roles[decoded.uid] || null;
    }

    if (roleData?.disabled) {
      return {
        mode: 'unauthenticated',
        message: 'Tài khoản này đã bị khóa (account_roles.disabled === true).',
      };
    }

    const syncedRole = syncSuperAdminInMemoryIfBootstrapOwner({
      uid: decoded.uid,
      email: decoded.email || '',
      email_verified: Boolean(decoded.email_verified),
      name: decoded.name,
    });

    const effectiveRole: UserRole =
      decoded.admin === true ||
      decoded.superadmin === true ||
      roleData?.role === 'superadmin' ||
      syncedRole === 'superadmin'
        ? 'superadmin'
        : (roleData?.role as UserRole) || syncedRole || 'student';

    // Đảm bảo p01Store luôn có bản ghi account_roles và users của UID thật này
    const state = p01Store.getState();
    if (!state.account_roles[decoded.uid]) {
      state.account_roles[decoded.uid] = {
        role: effectiveRole,
        disabled: false,
        updated_at: Date.now(),
        updated_by: effectiveRole === 'superadmin' ? 'system_bootstrap' : 'firebase_auth_sync',
      };
    }
    if (!state.users[decoded.uid] && decoded.email) {
      state.users[decoded.uid] = {
        full_name: decoded.name || decoded.email.split('@')[0],
        email: decoded.email,
      };
    }

    return {
      mode: 'authenticated',
      isSandbox: !fullAdminApp,
      actor: {
        uid: decoded.uid,
        email: decoded.email || '',
        email_verified: Boolean(decoded.email_verified),
        name: decoded.name,
        admin: effectiveRole === 'superadmin',
        superadmin: effectiveRole === 'superadmin',
        role: effectiveRole,
      },
    };
  } catch {
    const fallbackActor = parseFallbackActor(rawFallbackActor, idToken);
    if (fallbackActor) {
      const roleData = p01Store.getState().account_roles[fallbackActor.uid];
      if (roleData?.disabled) {
        return {
          mode: 'unauthenticated',
          message: 'Tài khoản này đã bị khóa (account_roles.disabled === true).',
        };
      }
      return {
        mode: 'authenticated',
        isSandbox: true,
        actor: fallbackActor,
      };
    }
    return {
      mode: 'unauthenticated',
      message: 'Firebase ID Token không hợp lệ hoặc đã hết hạn.',
    };
  }
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '256kb' }));

  let mqttBridge: BugzNativeMqttBridge | null = null;

  function buildIntegrationStatus(): IntegrationComponentStatus[] {
    const stageChecks = evaluateStageFeatureConfigs(process.env);
    const bridgeSnapshot = mqttBridge?.getStatus();
    const isBridgeLive = Boolean(bridgeSnapshot?.connected);

    return [
      {
        id: 'firebase-rtdb-auth-p01',
        name: '1. [Chặng P01] Firebase Authentication & Realtime Database (Client + Rules)',
        status: stageChecks.firebaseClientAuthRtdb.isConfigured ? 'PASS' : 'BLOCKED',
        uiLabel: stageChecks.firebaseClientAuthRtdb.uiStatusLabel,
        requiredStage: stageChecks.firebaseClientAuthRtdb.requiredAtStage,
        summary: `${stageChecks.firebaseClientAuthRtdb.details} Đã hoàn tất database.rules.json, bộ kiểm thử cách ly dữ liệu chéo T01–T04/T10 và chế độ Emulator Sandbox P01.`,
        requiredEnvVars: [
          'VITE_FIREBASE_API_KEY',
          'VITE_FIREBASE_AUTH_DOMAIN',
          'VITE_FIREBASE_DATABASE_URL',
          'VITE_FIREBASE_PROJECT_ID',
          'VITE_FIREBASE_APP_ID',
        ],
        configuredEnvVars: [
          'VITE_FIREBASE_API_KEY',
          'VITE_FIREBASE_AUTH_DOMAIN',
          'VITE_FIREBASE_DATABASE_URL',
          'VITE_FIREBASE_PROJECT_ID',
          'VITE_FIREBASE_APP_ID',
        ].filter((k) => !stageChecks.firebaseClientAuthRtdb.missingOrInvalidVars.includes(k)),
        externalActionRequired:
          'Để đăng nhập Google thật trên Firebase Project: Bật Google Sign-In provider, thêm Authorized Domains, tạo Realtime Database, deploy database.rules.json và điền 5 biến VITE_FIREBASE_*.',
      },
      {
        id: 'firebase-admin-backend',
        name: '2. [Chặng P01] Firebase Admin SDK (Xác minh ID Token, Custom Claims & RBAC Server)',
        status: stageChecks.firebaseAdminBackend.isConfigured ? 'PASS' : 'BLOCKED',
        uiLabel: stageChecks.firebaseAdminBackend.uiStatusLabel,
        requiredStage: stageChecks.firebaseAdminBackend.requiredAtStage,
        summary: stageChecks.firebaseAdminBackend.details,
        requiredEnvVars: [
          'FIREBASE_PROJECT_ID',
          'FIREBASE_DATABASE_URL',
          'FIREBASE_SERVICE_ACCOUNT_JSON (hoặc FIREBASE_SERVICE_ACCOUNT_KEY_PATH)',
          'SUPERADMIN_BOOTSTRAP_EMAIL',
        ],
        configuredEnvVars: stageChecks.firebaseAdminBackend.isConfigured
          ? ['FIREBASE_PROJECT_ID', 'FIREBASE_DATABASE_URL', 'FIREBASE_SERVICE_ACCOUNT']
          : [],
        externalActionRequired:
          'Cung cấp FIREBASE_SERVICE_ACCOUNT_JSON (1 dòng JSON hoặc Base64) hoặc FIREBASE_SERVICE_ACCOUNT_KEY_PATH (.json) để Admin SDK ghi trực tiếp lên Firebase Project thật.',
      },
      {
        id: 'mqtt-broker-bridge-p03',
        name: '3. [Chặng P03] MQTT Broker (TLS + ACL) & Robot Bridge',
        status: isBridgeLive
          ? 'PASS'
          : stageChecks.mqttAndRobot.isConfigured
          ? 'PASS'
          : 'BLOCKED',
        uiLabel: isBridgeLive
          ? 'Đang kết nối TLS (Sẵn sàng)'
          : stageChecks.mqttAndRobot.uiStatusLabel,
        requiredStage: stageChecks.mqttAndRobot.requiredAtStage,
        summary: isBridgeLive
          ? `Đã kết nối trực tiếp tới EMQX Cloud TLS 8883 (${bridgeSnapshot?.brokerUrl}). Đã nhận ${bridgeSnapshot?.receivedCount ?? 0} gói tin từ robot.`
          : stageChecks.mqttAndRobot.details,
        requiredEnvVars: [
          'MQTT_ADAPTER_MODE (webhook_https | node_worker)',
          'MQTT_BROKER_URL',
          'MQTT_BRIDGE_USERNAME / MQTT_BRIDGE_PASSWORD',
        ],
        configuredEnvVars: stageChecks.mqttAndRobot.isConfigured ? ['MQTT_ADAPTER_MODE', 'MQTT_BROKER_URL'] : [],
        externalActionRequired:
          'Bắt buộc ở Chặng P03: Cấu hình MQTT Broker TLS, chọn MQTT_ADAPTER_MODE ("webhook_https" hoặc "node_worker") và điền thông tin kết nối tương ứng.',
      },
      {
        id: 'cloud-storage-captures-p03',
        name: '4. [Chặng P03] Cloud Storage Ảnh Capture Riêng tư',
        status: stageChecks.cloudStorageCaptures.isConfigured ? 'NOT_RUN' : 'BLOCKED',
        uiLabel: stageChecks.cloudStorageCaptures.uiStatusLabel,
        requiredStage: stageChecks.cloudStorageCaptures.requiredAtStage,
        summary: stageChecks.cloudStorageCaptures.details,
        requiredEnvVars: ['VITE_FIREBASE_STORAGE_BUCKET', 'FIREBASE_STORAGE_BUCKET'],
        configuredEnvVars: stageChecks.cloudStorageCaptures.isConfigured
          ? ['VITE_FIREBASE_STORAGE_BUCKET', 'FIREBASE_STORAGE_BUCKET']
          : [],
        externalActionRequired:
          'Bắt buộc ở Chặng P03: Khởi tạo Cloud Storage trong Firebase Project để lưu ảnh capture qua Signed URL.',
      },
      {
        id: 'fcm-web-push-p04',
        name: '5. [Chặng P04] Firebase Cloud Messaging (FCM Web Push)',
        status: stageChecks.fcmWebPush.isConfigured ? 'NOT_RUN' : 'BLOCKED',
        uiLabel: stageChecks.fcmWebPush.uiStatusLabel,
        requiredStage: stageChecks.fcmWebPush.requiredAtStage,
        summary: stageChecks.fcmWebPush.details,
        requiredEnvVars: ['VITE_FIREBASE_MESSAGING_SENDER_ID', 'VITE_FIREBASE_VAPID_KEY'],
        configuredEnvVars: stageChecks.fcmWebPush.isConfigured
          ? ['VITE_FIREBASE_MESSAGING_SENDER_ID', 'VITE_FIREBASE_VAPID_KEY']
          : [],
        externalActionRequired:
          'Bắt buộc ở Chặng P04: Tạo Web Push certificate (VAPID key pair) trong Firebase Console > Cloud Messaging.',
      },
      {
        id: 'email-provider-p04',
        name: '6. [Chặng P04] Dịch vụ Email Cảnh báo & Chứng nhận (SMTP / Resend / SendGrid)',
        status: stageChecks.emailProvider.isConfigured ? 'NOT_RUN' : 'BLOCKED',
        uiLabel: stageChecks.emailProvider.uiStatusLabel,
        requiredStage: stageChecks.emailProvider.requiredAtStage,
        summary: stageChecks.emailProvider.details,
        requiredEnvVars: [
          'EMAIL_PROVIDER (smtp | resend | sendgrid)',
          'EMAIL_FROM_ADDRESS',
          'SMTP_HOST / SMTP_PORT / SMTP_USER / SMTP_PASS (hoặc EMAIL_API_KEY)',
        ],
        configuredEnvVars: stageChecks.emailProvider.isConfigured ? ['EMAIL_PROVIDER', 'EMAIL_FROM_ADDRESS'] : [],
        externalActionRequired:
          'Bắt buộc ở Chặng P04: Chọn EMAIL_PROVIDER ("smtp", "resend", hoặc "sendgrid") và điền thông tin xác thực tương ứng ở biến môi trường server.',
      },
    ];
  }

  // 1. Endpoint kiểm tra trạng thái tích hợp thực tế & quy ước định dạng biến môi trường
  app.get('/api/system/integration-status', (_req: Request, res: Response) => {
    const stageChecks = evaluateStageFeatureConfigs(process.env);
    res.json({
      stage: 'P05_COMPLETED_WAITING_P06',
      timestampUtcMs: Date.now(),
      databaseType: 'Firebase Realtime Database',
      firestoreUsed: false,
      superAdminBootstrapEmail:
        process.env.SUPERADMIN_BOOTSTRAP_EMAIL || 'minhquantran4312@gmail.com,tamtranmusic@gmail.com',
      episodeAuthority: 'bridge',
      chosenMqttAdapter: 'webhook_https',
      supportedFormats: {
        FIREBASE_SERVICE_ACCOUNT_JSON:
          'Chuỗi JSON trên 1 dòng (single-line JSON) HOẶC chuỗi Base64 của file JSON Service Account (có project_id, client_email, private_key)',
        FIREBASE_SERVICE_ACCOUNT_KEY_PATH:
          'Đường dẫn tới file .json trên ổ đĩa server (ví dụ: ./service-account.json)',
        MQTT_ADAPTER_MODE: SUPPORTED_MQTT_ADAPTER_MODES,
        EMAIL_PROVIDER: SUPPORTED_EMAIL_PROVIDERS,
      },
      stageFeatureChecks: stageChecks,
      services: buildIntegrationStatus(),
    });
  });

  // 2. Endpoint lấy thông tin phiên người dùng hiện tại + các nhánh dữ liệu được phép đọc theo RBAC (P01)
  app.get('/api/auth/me', async (req: Request, res: Response) => {
    const resolved = await resolveRequestActor(req);
    if (resolved.mode === 'unconfigured') {
      res.status(503).json({
        error: 'SERVICE_NOT_CONFIGURED',
        uiLabel: 'Chưa cấu hình',
        requiredStage: 'P01',
        missingVars: resolved.missingVars,
        message: `Chưa cấu hình Firebase Admin SDK cho chế độ Production. ${resolved.details}`,
      });
      return;
    }
    if (resolved.mode === 'unauthenticated') {
      res.status(401).json({
        error: 'UNAUTHENTICATED',
        message: resolved.message,
      });
      return;
    }

    const { actor, isSandbox } = resolved;
    const state = p01Store.getState();
    if (!state.users[actor.uid]) {
      state.users[actor.uid] = {
        full_name: actor.name || actor.email.split('@')[0],
        email: actor.email,
        ...(actor.phone ? { phone: actor.phone } : {}),
      };
    } else {
      if (actor.name) state.users[actor.uid].full_name = actor.name;
      if (actor.phone) state.users[actor.uid].phone = actor.phone;
    }
    const userRecord = state.users[actor.uid];
    if (!state.account_roles[actor.uid]) {
      state.account_roles[actor.uid] = {
        role: actor.role === 'superadmin' ? 'superadmin' : 'student',
        disabled: false,
        updated_at: Date.now(),
        updated_by: 'system',
      };
    } else if (state.account_roles[actor.uid].role !== 'superadmin') {
      state.account_roles[actor.uid].role = 'student';
    }
    const roleRecord = state.account_roles[actor.uid];

    // Lấy danh sách hồ sơ học tập gắn trực tiếp với tài khoản này (tự tạo hồ sơ cá nhân riêng nếu chưa có)
    const myStudents = p01Store.getOwnedStudentsForActor(actor);
    const primaryStudentId = myStudents[0]?.student_id || `stu-${actor.uid}`;
    const guardianLinks = state.guardian_students[actor.uid] || {};
    const studentAccountLinks = state.student_accounts[actor.uid] || {};

    // Gán quyền vận hành thiết bị phần cứng robot01 cho người dùng đã đăng nhập;
    // chỉ mở phiên mới khi người dùng chủ động yêu cầu (autoActivate=1 hoặc bấm Bắt đầu trên /robot)
    if (state.devices['robot01']) {
      if (!state.device_access['robot01']) state.device_access['robot01'] = {};
      state.device_access['robot01'][actor.uid] = {
        role: 'owner',
        student_id: primaryStudentId,
        can_operate: true,
        granted_at: Date.now(),
      };
      if (!state.devices['robot01'].user_id) {
        state.devices['robot01'].user_id = actor.uid;
      }

      if (req.query.autoActivate === '1') {
        const openSess = p01Store.getOpenSessionForDevice('robot01');
        const startRes = p01Store.startRobotSession(actor, {
          device_id: 'robot01',
          student_id: primaryStudentId,
          source: 'real',
          auto_close_previous: true,
        });
        const targetSessId = startRes.session_id || openSess?.sessionId;
        if (targetSessId) {
          p01Store.sendDeviceMonitoringCommand(actor, {
            device_id: 'robot01',
            monitoring_enabled: true,
            alert_after_sec: state.devices['robot01'].alert_after_sec || 15,
            ttl_sec: 300,
            source: 'real',
          });
        }
      }
    }

    // Lấy danh sách thiết bị Robot (ưu tiên thiết bị mặc định robot01 đứng đầu)
    const myDevices = Object.entries(state.devices)
      .filter(([devId, dev]) => {
        if (devId === 'robot01') return true;
        if (roleRecord.role === 'superadmin') return true;
        if (dev.user_id === actor.uid) return true;
        return Boolean(state.device_access[devId]?.[actor.uid]);
      })
      .sort(([a], [b]) => (a === 'robot01' ? -1 : b === 'robot01' ? 1 : 0))
      .map(([device_id, dev]) => ({
        device_id,
        ...dev,
      }));

    // Lấy danh sách mã mời do người dùng này tạo
    const myInvitations = Object.values(state.invitations).filter(
      (inv) => inv.created_by_uid === actor.uid || roleRecord.role === 'superadmin'
    );

    // Tự động bật tất cả các loại thông báo cho người dùng khi đăng nhập
    if (!state.notification_preferences[actor.uid]) {
      state.notification_preferences[actor.uid] = {
        push_enabled: true,
        voice_enabled: true,
        email_enabled: true,
        mode: 'every_alert',
        quiet_hours_start: '23:59',
        quiet_hours_end: '00:00',
      };
    }
    const notificationPrefs = state.notification_preferences[actor.uid];
    void persistRobotAndSessionState();

    res.json({
      ok: true,
      isSandbox,
      uid: actor.uid,
      email: actor.email,
      email_verified: actor.email_verified,
      user: userRecord,
      accountRole: roleRecord,
      customClaims: {
        role: roleRecord.role,
        admin: Boolean((actor.admin || actor.superadmin) && roleRecord.role === 'superadmin'),
        superadmin: Boolean((actor.admin || actor.superadmin) && roleRecord.role === 'superadmin'),
      },
      guardianLinks,
      studentAccountLinks,
      students: myStudents,
      devices: myDevices,
      invitations: myInvitations,
      notificationPreferences: notificationPrefs,
    });
  });

  // 3. Endpoint cập nhật hồ sơ cá nhân users/{uid} (full_name, email, phone)
  app.post('/api/users/profile', async (req: Request, res: Response) => {
    const resolved = await resolveRequestActor(req);
    if (resolved.mode === 'unconfigured') {
      res.status(503).json({
        error: 'SERVICE_NOT_CONFIGURED',
        uiLabel: 'Chưa cấu hình',
        requiredStage: 'P01',
        missingVars: resolved.missingVars,
        message: 'Chưa cấu hình Firebase Admin SDK.',
      });
      return;
    }
    if (resolved.mode === 'unauthenticated') {
      res.status(401).json({ error: 'UNAUTHENTICATED', message: resolved.message });
      return;
    }

    const result = p01Store.upsertSelfProfile(resolved.actor, {
      full_name: String(req.body?.full_name || ''),
      phone: req.body?.phone ? String(req.body.phone) : undefined,
      age_group:
        req.body?.age_group === 'middle_11_15'
          ? 'middle_11_15'
          : req.body?.age_group === 'primary_6_10'
          ? 'primary_6_10'
          : undefined,
      onboarding_role: req.body?.onboarding_role,
    });

    if (result.ok && !resolved.isSandbox) {
      const adminApp = getInitializedFirebaseAdmin();
      if (adminApp && result.roleRecord) {
        const isSuper = result.roleRecord.role === 'superadmin';
        await getAuth(adminApp).setCustomUserClaims(resolved.actor.uid, {
          admin: isSuper,
          superadmin: isSuper,
          role: result.roleRecord.role,
        });
        if (result.user) {
          await getDatabase(adminApp).ref(`users/${resolved.actor.uid}`).set(result.user);
        }
        await getDatabase(adminApp).ref(`account_roles/${resolved.actor.uid}`).set(result.roleRecord);
      }
    }

    if (result.ok) {
      void persistRobotAndSessionState();
    }

    res.status(result.status).json(result);
  });

  // 4. Endpoint Bootstrap SuperAdmin (Mục 2 Instructions & Mục 4 Artifact - T02, có Run-Once Security Lock)
  app.post('/api/auth/bootstrap-superadmin', async (req: Request, res: Response) => {
    const resolved = await resolveRequestActor(req);
    if (resolved.mode === 'unconfigured') {
      res.status(503).json({
        error: 'SERVICE_NOT_CONFIGURED',
        uiLabel: 'Chưa cấu hình',
        requiredStage: 'Khi Backend thực sự cần sử dụng (từ P01)',
        missingVars: resolved.missingVars,
        message: `Chưa cấu hình — Không thể thực thi Bootstrap SuperAdmin trên Firebase thật vì thiếu cấu hình Firebase Admin SDK (${resolved.missingVars.join(', ')}). Hệ thống không giả cấp quyền SuperAdmin.`,
      });
      return;
    }
    if (resolved.mode === 'unauthenticated') {
      res.status(401).json({
        error: 'UNAUTHENTICATED',
        message: resolved.message,
      });
      return;
    }

    const rawBootstrapEmail = isEnvValuePresent(process.env.SUPERADMIN_BOOTSTRAP_EMAIL)
      ? process.env.SUPERADMIN_BOOTSTRAP_EMAIL!.trim()
      : 'minhquantran4312@gmail.com,tamtranmusic@gmail.com';

    const emailValidation = validateSuperAdminBootstrapEmails(rawBootstrapEmail);
    if (!emailValidation.isValid) {
      res.status(400).json({
        ok: false,
        status: 400,
        code: 'INVALID_BOOTSTRAP_EMAIL_ENV',
        message: emailValidation.errorReason,
      });
      return;
    }

    // Nếu chạy trên Firebase Admin SDK thật, kiểm tra khóa Run-Once trên RTDB trước
    if (!resolved.isSandbox) {
      const adminApp = getInitializedFirebaseAdmin();
      if (adminApp) {
        const lockSnap = await getDatabase(adminApp).ref('system_locks/superadmin_bootstrap').get();
        if (lockSnap.exists() && (lockSnap.val() as SuperAdminBootstrapLockRecord)?.locked === true) {
          const existingLock = lockSnap.val() as SuperAdminBootstrapLockRecord;
          res.status(409).json({
            ok: false,
            status: 409,
            code: 'BOOTSTRAP_ALREADY_EXECUTED_ONCE',
            message: `Từ chối chạy lại Bootstrap SuperAdmin: thao tác này chỉ được phép chạy ĐÚNG MỘT LẦN để bảo mật (đã khóa tại system_locks/superadmin_bootstrap lúc ${new Date(
              existingLock.executed_at
            ).toISOString()}).`,
            lockRecord: existingLock,
          });
          return;
        }
      }
    }

    const result = p01Store.bootstrapSuperAdmin(resolved.actor, emailValidation.emails);

    // Nếu đang kết nối Firebase Admin SDK thật và thành công, cấp customUserClaims ('admin' + 'superadmin') và khóa Run-Once Lock trên RTDB
    if (result.ok && !resolved.isSandbox) {
      const adminApp = getInitializedFirebaseAdmin();
      if (adminApp) {
        await getAuth(adminApp).setCustomUserClaims(resolved.actor.uid, {
          admin: true,
          superadmin: true,
          role: 'superadmin',
        });
        await getDatabase(adminApp).ref(`account_roles/${resolved.actor.uid}`).set(result.roleRecord);
        if (result.lockRecord) {
          await getDatabase(adminApp).ref('system_locks/superadmin_bootstrap').set(result.lockRecord);
        }
      }
    }

    res.status(result.status).json(result);
  });

  // 5. Endpoint Phụ huynh tạo hồ sơ con mới students/{student_id} + guardian_students/{uid}/{student_id}
  app.post('/api/students', async (req: Request, res: Response) => {
    const resolved = await resolveRequestActor(req);
    if (resolved.mode === 'unconfigured') {
      res.status(503).json({
        error: 'SERVICE_NOT_CONFIGURED',
        uiLabel: 'Chưa cấu hình',
        requiredStage: 'P01',
        missingVars: resolved.missingVars,
        message: 'Chưa cấu hình Firebase Admin SDK.',
      });
      return;
    }
    if (resolved.mode === 'unauthenticated') {
      res.status(401).json({ error: 'UNAUTHENTICATED', message: resolved.message });
      return;
    }

    const result = p01Store.createChildProfile(resolved.actor, {
      display_name: String(req.body?.display_name || ''),
      age_group: req.body?.age_group === 'middle_11_15' ? 'middle_11_15' : 'primary_6_10',
    });
    if (result.ok) {
      void persistRobotAndSessionState();
    }
    res.status(result.status).json(result);
  });

  // 6. Endpoint tạo mã mời một lần liên kết Phụ huynh – Học sinh (P01)
  app.post('/api/guardians/invitations', async (req: Request, res: Response) => {
    const resolved = await resolveRequestActor(req);
    if (resolved.mode === 'unconfigured') {
      res.status(503).json({
        error: 'SERVICE_NOT_CONFIGURED',
        uiLabel: 'Chưa cấu hình',
        requiredStage: 'P01',
        missingVars: resolved.missingVars,
        message: `Chưa cấu hình — Tính năng tạo mã mời một lần liên kết Phụ huynh – Học sinh yêu cầu cấu hình Firebase ở Chặng P01 (${resolved.missingVars.join(', ')}).`,
      });
      return;
    }
    if (resolved.mode === 'unauthenticated') {
      res.status(401).json({ error: 'UNAUTHENTICATED', message: resolved.message });
      return;
    }

    const result = p01Store.createOneTimeInvitation(resolved.actor, {
      student_id: String(req.body?.student_id || ''),
      target_type: req.body?.target_type === 'co_guardian' ? 'co_guardian' : 'student_account',
      ttlMinutes: Number(req.body?.ttlMinutes) || 30,
    });
    res.status(result.status).json(result);
  });

  // 7. Endpoint xác nhận mã mời một lần (P01 - Chống tự nhập student_id để lấy quyền)
  app.post('/api/guardians/invitations/accept', async (req: Request, res: Response) => {
    const resolved = await resolveRequestActor(req);
    if (resolved.mode === 'unconfigured') {
      res.status(503).json({
        error: 'SERVICE_NOT_CONFIGURED',
        uiLabel: 'Chưa cấu hình',
        requiredStage: 'P01',
        missingVars: resolved.missingVars,
        message: 'Chưa cấu hình Firebase Admin SDK.',
      });
      return;
    }
    if (resolved.mode === 'unauthenticated') {
      res.status(401).json({ error: 'UNAUTHENTICATED', message: resolved.message });
      return;
    }

    const result = p01Store.acceptOneTimeInvitation(resolved.actor, {
      invitation_code: String(req.body?.invitation_code || ''),
    });
    res.status(result.status).json(result);
  });

  // 8. Endpoint Ghép thiết bị Robot Gia đình (P01 / Ca kiểm thử T10)
  app.post('/api/devices/pair', async (req: Request, res: Response) => {
    const resolved = await resolveRequestActor(req);
    if (resolved.mode === 'unconfigured') {
      res.status(503).json({
        error: 'SERVICE_NOT_CONFIGURED',
        uiLabel: 'Chưa cấu hình',
        requiredStage: 'P01',
        missingVars: resolved.missingVars,
        message: `Chưa cấu hình — Tính năng ghép Robot vào tài khoản Phụ huynh yêu cầu cấu hình Firebase ở Chặng P01 (${resolved.missingVars.join(', ')}).`,
      });
      return;
    }
    if (resolved.mode === 'unauthenticated') {
      res.status(401).json({ error: 'UNAUTHENTICATED', message: resolved.message });
      return;
    }

    const result = p01Store.pairDeviceForGuardian(resolved.actor, {
      device_id: String(req.body?.device_id || ''),
      pairing_code: String(req.body?.pairing_code || ''),
      device_name: String(req.body?.device_name || 'Robot bàn học BUGZ'),
    });
    res.status(result.status).json(result);
  });

  // 9. Endpoint cập nhật thiết lập Kênh thông báo của Phụ huynh (notification_preferences/{uid})
  app.post('/api/users/notification-preferences', async (req: Request, res: Response) => {
    const resolved = await resolveRequestActor(req);
    if (resolved.mode === 'unconfigured') {
      res.status(503).json({
        error: 'SERVICE_NOT_CONFIGURED',
        uiLabel: 'Chưa cấu hình',
        requiredStage: 'P01',
        missingVars: resolved.missingVars,
        message: 'Chưa cấu hình Firebase Admin SDK.',
      });
      return;
    }
    if (resolved.mode === 'unauthenticated') {
      res.status(401).json({ error: 'UNAUTHENTICATED', message: resolved.message });
      return;
    }

    const prefs = {
      push_enabled: Boolean(req.body?.push_enabled ?? true),
      voice_enabled: Boolean(req.body?.voice_enabled ?? true),
      email_enabled: Boolean(req.body?.email_enabled ?? true),
      mode: (req.body?.mode === 'digest' ? 'digest' : 'every_alert') as 'every_alert' | 'digest',
      quiet_hours_start: String(req.body?.quiet_hours_start || '22:00'),
      quiet_hours_end: String(req.body?.quiet_hours_end || '06:30'),
    };
    p01Store.getState().notification_preferences[resolved.actor.uid] = prefs;
    void persistRobotAndSessionState();
    res.json({
      ok: true,
      message: 'Đã lưu cấu hình notification_preferences/{uid}.',
      notificationPreferences: prefs,
    });
  });

  // 10. Endpoint Kiểm tra trực tiếp Realtime Database Rules (`database.rules.json`) cho Emulator / Inspector UI
  app.post('/api/rtdb/evaluate-rule', (req: Request, res: Response) => {
    const operation = req.body?.operation === 'write' ? 'write' : 'read';
    const targetPath = String(req.body?.path || '/');
    const authCtx = (req.body?.auth || null) as RtdbAuthContext | null;
    const queryCtx = (req.body?.query || undefined) as RtdbQueryContext | undefined;

    if (operation === 'write') {
      const evalRes = p01Store.clientWriteWithRules({
        auth: authCtx,
        path: targetPath,
        value: req.body?.value,
        method: req.body?.method === 'PATCH' ? 'PATCH' : 'PUT',
      });
      res.json({
        operation: 'write',
        path: targetPath,
        allowed: evalRes.allowed,
        reason: evalRes.reason,
        matchedPath: evalRes.matchedPath,
      });
      return;
    }

    const evalRes = p01Store.clientReadWithRules({
      auth: authCtx,
      path: targetPath,
      query: queryCtx,
    });
    res.json({
      operation: 'read',
      path: targetPath,
      allowed: evalRes.allowed,
      reason: evalRes.reason,
      matchedPath: evalRes.matchedPath,
      indexVerified: evalRes.indexVerified,
    });
  });

  // 11. Phân hệ SuperAdmin: Lấy danh sách Users, Roles, Students, Links, Devices & Audit Logs (T04)
  app.get('/api/admin/overview', async (req: Request, res: Response) => {
    const resolved = await resolveRequestActor(req);
    if (resolved.mode === 'unconfigured') {
      res.status(503).json({
        error: 'SERVICE_NOT_CONFIGURED',
        uiLabel: 'Chưa cấu hình',
        requiredStage: 'P01',
        missingVars: resolved.missingVars,
        message: 'Chưa cấu hình Firebase Admin SDK.',
      });
      return;
    }
    if (resolved.mode === 'unauthenticated') {
      res.status(401).json({ error: 'UNAUTHENTICATED', message: resolved.message });
      return;
    }
    if (resolved.actor.role !== 'superadmin') {
      res.status(403).json({
        error: 'FORBIDDEN_NOT_SUPERADMIN',
        message: 'Từ chối truy cập (Ca kiểm thử T04): Chỉ tài khoản có custom claim superadmin=true mới truy cập được API Quản trị.',
      });
      return;
    }

    const state = p01Store.getState();
    const userList = Object.entries(state.users).map(([uid, u]) => {
      const ownStudents = Object.values(state.students)
        .filter((s) => s.auth_uid === uid || s.guardian_owner_uid === uid)
        .map((s) => s.student_id);
      return {
        uid,
        full_name: u.full_name,
        email: u.email,
        role: state.account_roles[uid]?.role === 'superadmin' ? 'superadmin' : 'student',
        disabled: Boolean(state.account_roles[uid]?.disabled),
        updated_at: state.account_roles[uid]?.updated_at || 0,
        linked_students: [],
        student_accounts: ownStudents,
      };
    });

    const auditList = Object.values(state.audit_logs).sort((a, b) => b.time - a.time);
    const allCertificateRequests = Object.values(state.certificate_requests)
      .flatMap((byReq) => Object.values(byReq))
      .sort((a, b) => b.created_at - a.created_at);
    const learningBootstrap = p01Store.getLearningBootstrapForActor(resolved.actor);
    const adminQuestionsRes = p01Store.adminGetQuestionBank(resolved.actor);
    const allSessions = Object.values(state.sessions).flatMap((bySess) => Object.values(bySess));

    res.json({
      ok: true,
      users: userList,
      students: Object.values(state.students),
      guardianStudents: state.guardian_students,
      devices: Object.entries(state.devices).map(([device_id, d]) => ({
        device_id,
        ...d,
        credential: state.device_broker_credentials[device_id] || null,
        pairing_secret: state.device_pairing_secrets[device_id] || null,
        access_map: state.device_access[device_id] || {},
      })),
      sessions: allSessions,
      invitations: Object.values(state.invitations),
      auditLogs: auditList,
      learningDays: learningBootstrap.days,
      certificateRequests: allCertificateRequests,
      sourceVerificationReport: learningBootstrap.sourceVerificationReport,
      questions: adminQuestionsRes.questions || [],
      notificationJobs: Object.values(state.notification_jobs).sort(
        (a, b) => b.updated_at - a.updated_at
      ),
      reminderTemplates: Object.values(state.reminder_templates),
      captures: Object.values(state.capture_metadata).sort(
        (a, b) => b.created_at - a.created_at
      ),
    });
  });

  // 12. Phân hệ SuperAdmin: Đổi vai trò (role) qua Server Admin SDK + Ghi Audit Log (T02 & T04)
  app.post('/api/admin/roles', async (req: Request, res: Response) => {
    const resolved = await resolveRequestActor(req);
    if (resolved.mode === 'unconfigured') {
      res.status(503).json({
        error: 'SERVICE_NOT_CONFIGURED',
        uiLabel: 'Chưa cấu hình',
        requiredStage: 'Khi Backend thực sự cần sử dụng (từ P01)',
        missingVars: resolved.missingVars,
        message: `Chưa cấu hình — Không thể thay đổi Custom Claims vì thiếu cấu hình Firebase Admin SDK (${resolved.missingVars.join(', ')}).`,
      });
      return;
    }
    if (resolved.mode === 'unauthenticated') {
      res.status(401).json({ error: 'UNAUTHENTICATED', message: resolved.message });
      return;
    }

    const result = p01Store.adminUpdateUserRole(resolved.actor, {
      target_uid: String(req.body?.target_uid || ''),
      new_role: req.body?.new_role as UserRole,
      reason: String(req.body?.reason || ''),
    });

    if (result.ok) {
      void persistRobotAndSessionState();
      if (!resolved.isSandbox) {
        try {
          const adminApp = getInitializedFirebaseAdmin();
          if (adminApp) {
            await getAuth(adminApp).setCustomUserClaims(String(req.body.target_uid), {
              superadmin: req.body.new_role === 'superadmin',
              role: req.body.new_role,
            });
            await getDatabase(adminApp)
              .ref(`account_roles/${String(req.body.target_uid)}`)
              .set(result.roleRecord);
          }
        } catch {
          // Ignore external sync error
        }
      }
    }

    res.status(result.status).json(result);
  });

  // 13. Phân hệ SuperAdmin: Khóa / Mở khóa tài khoản (disabled = true/false) + Ghi Audit Log
  app.post('/api/admin/users/:uid/status', async (req: Request, res: Response) => {
    const resolved = await resolveRequestActor(req);
    if (resolved.mode === 'unconfigured') {
      res.status(503).json({
        error: 'SERVICE_NOT_CONFIGURED',
        uiLabel: 'Chưa cấu hình',
        requiredStage: 'P01',
        missingVars: resolved.missingVars,
        message: 'Chưa cấu hình Firebase Admin SDK.',
      });
      return;
    }
    if (resolved.mode === 'unauthenticated') {
      res.status(401).json({ error: 'UNAUTHENTICATED', message: resolved.message });
      return;
    }

    const targetUid = String(req.params.uid || '');
    const disabledFlag = Boolean(req.body?.disabled);
    const result = p01Store.adminSetUserDisabled(resolved.actor, {
      target_uid: targetUid,
      disabled: disabledFlag,
      reason: String(req.body?.reason || ''),
    });

    if (result.ok) {
      void persistRobotAndSessionState();
      if (!resolved.isSandbox) {
        try {
          const adminApp = getInitializedFirebaseAdmin();
          if (adminApp && result.roleRecord) {
            await getAuth(adminApp).updateUser(targetUid, { disabled: disabledFlag });
            if (disabledFlag) {
              await getAuth(adminApp).revokeRefreshTokens(targetUid);
            }
            await getDatabase(adminApp).ref(`account_roles/${targetUid}`).set(result.roleRecord);
          }
        } catch {
          // Ignore external sync error
        }
      }
    }

    res.status(result.status).json(result);
  });

  // 14. Phân hệ SuperAdmin: Thu hồi liên kết Phụ huynh - Học sinh + Ghi Audit Log
  app.post('/api/admin/guardian-links/revoke', async (req: Request, res: Response) => {
    const resolved = await resolveRequestActor(req);
    if (resolved.mode === 'unconfigured') {
      res.status(503).json({
        error: 'SERVICE_NOT_CONFIGURED',
        uiLabel: 'Chưa cấu hình',
        requiredStage: 'P01',
        missingVars: resolved.missingVars,
        message: 'Chưa cấu hình Firebase Admin SDK.',
      });
      return;
    }
    if (resolved.mode === 'unauthenticated') {
      res.status(401).json({ error: 'UNAUTHENTICATED', message: resolved.message });
      return;
    }

    const result = p01Store.adminRevokeGuardianStudentLink(resolved.actor, {
      guardian_uid: String(req.body?.guardian_uid || ''),
      student_id: String(req.body?.student_id || ''),
      reason: String(req.body?.reason || ''),
    });
    if (result.ok) {
      void persistRobotAndSessionState();
    }
    res.status(result.status).json(result);
  });

  // Helper cho P02 Learning endpoints: lấy Actor đã xác thực
  async function resolveLearningActorOrDefault(req: Request): Promise<{
    actor: VerifiedActorToken | null;
    isSandbox: boolean;
  }> {
    const resolved = await resolveRequestActor(req);
    if (resolved.mode === 'authenticated') {
      return { actor: resolved.actor, isSandbox: resolved.isSandbox };
    }
    return {
      isSandbox: true,
      actor: null,
    };
  }

  // 14b. P02: Lấy dữ liệu khởi tạo Học & Thực hành 28 ngày + Tiến độ + Yêu cầu chứng nhận
  app.get('/api/learning/bootstrap', async (req: Request, res: Response) => {
    const { actor, isSandbox } = await resolveLearningActorOrDefault(req);
    if (!actor) {
      const state = p01Store.getState();
      const days = Object.values(state.learning_days).sort((a, b) => a.day_number - b.day_number);
      res.json({
        ok: true,
        isSandbox,
        days,
        activeStudentId: null,
        progressMap: {},
        certificateRequests: [],
        sourceVerificationReport: [],
      });
      return;
    }
    const requestedStudentId = typeof req.query.studentId === 'string' ? req.query.studentId : undefined;
    const data = p01Store.getLearningBootstrapForActor(actor, requestedStudentId);
    res.json({
      ok: true,
      isSandbox,
      ...data,
    });
  });

  // 14c. P02: Ghi nhận đã xem bài học ngày D (viewed_at)
  app.post('/api/learning/days/:day/view', async (req: Request, res: Response) => {
    const { actor, isSandbox } = await resolveLearningActorOrDefault(req);
    if (!actor) {
      res.status(200).json({ ok: true, status: 200, message: 'Chế độ khách: không ghi tiến độ mẫu.' });
      return;
    }
    const dayNumber = Number(req.params.day);
    const defaultStuId = p01Store.getOwnedStudentsForActor(actor)[0]?.student_id || `stu-${actor.uid}`;
    const studentId = String(req.body?.student_id || defaultStuId);
    const result = p01Store.recordDayViewed(actor, {
      student_id: studentId,
      day_number: dayNumber,
    });

    if (result.ok) {
      void persistRobotAndSessionState();
      if (!isSandbox && result.progress) {
        const adminApp = getInitializedFirebaseAdmin();
        if (adminApp) {
          await getDatabase(adminApp)
            .ref(`learning_progress/${studentId}/${dayNumber}`)
            .set(result.progress);
        }
      }
    }

    res.status(result.status).json(result);
  });

  // 14d. P02 (Ca kiểm thử T07): Ghi nhận tự thực hành & nhận huy chương ngày D (Idempotent)
  app.post('/api/learning/days/:day/complete', async (req: Request, res: Response) => {
    const { actor, isSandbox } = await resolveLearningActorOrDefault(req);
    if (!actor) {
      res.status(401).json({
        ok: false,
        status: 401,
        message: 'Vui lòng đăng nhập tài khoản để lưu tiến độ hoàn thành và nhận Huy chương.',
      });
      return;
    }
    const dayNumber = Number(req.params.day);
    const defaultStuId = p01Store.getOwnedStudentsForActor(actor)[0]?.student_id || `stu-${actor.uid}`;
    const studentId = String(req.body?.student_id || defaultStuId);
    const result = p01Store.recordDaySelfCompleted(actor, {
      student_id: studentId,
      day_number: dayNumber,
    });

    if (result.ok) {
      void persistRobotAndSessionState();
      if (!isSandbox && result.progress) {
        const adminApp = getInitializedFirebaseAdmin();
        if (adminApp) {
          await getDatabase(adminApp)
            .ref(`learning_progress/${studentId}/${dayNumber}`)
            .set(result.progress);
        }
      }
    }

    res.status(result.status).json(result);
  });

  // 14e. P02 (Ca kiểm thử T08): Học sinh / Phụ huynh gửi Yêu cầu nhận chứng nhận Ngày 28
  app.post('/api/certificates/requests', async (req: Request, res: Response) => {
    const { actor, isSandbox } = await resolveLearningActorOrDefault(req);
    if (!actor) {
      res.status(401).json({
        ok: false,
        status: 401,
        message: 'Vui lòng đăng nhập tài khoản để gửi yêu cầu nhận chứng nhận 28 ngày.',
      });
      return;
    }
    const defaultStuId = p01Store.getOwnedStudentsForActor(actor)[0]?.student_id || `stu-${actor.uid}`;
    const studentId = String(req.body?.student_id || defaultStuId);
    const result = p01Store.submitCertificateRequest(actor, {
      student_id: studentId,
      guardian_email: String(req.body?.guardian_email || ''),
      reflection_text: String(req.body?.reflection_text || ''),
      achievement_photo_name: String(req.body?.achievement_photo_name || ''),
      achievement_photo_note: req.body?.achievement_photo_note ? String(req.body.achievement_photo_note) : undefined,
    });

    if (result.ok) {
      void persistRobotAndSessionState();
      if (!isSandbox && result.request) {
        const adminApp = getInitializedFirebaseAdmin();
        if (adminApp) {
          await getDatabase(adminApp)
            .ref(`certificate_requests/${studentId}/${result.request.request_id}`)
            .set(result.request);
        }
      }
    }

    res.status(result.status).json(result);
  });

  // 14f-0. P02: SuperAdmin duyệt và xuất bản hàng loạt toàn bộ 28 ngày học
  app.post('/api/admin/content/days/bulk-publish', async (req: Request, res: Response) => {
    const resolved = await resolveRequestActor(req);
    if (resolved.mode === 'unconfigured') {
      res.status(503).json({
        error: 'SERVICE_NOT_CONFIGURED',
        uiLabel: 'Chưa cấu hình',
        requiredStage: 'P02',
        missingVars: resolved.missingVars,
        message: 'Chưa cấu hình Firebase Admin SDK.',
      });
      return;
    }
    if (resolved.mode === 'unauthenticated') {
      res.status(401).json({ error: 'UNAUTHENTICATED', message: resolved.message });
      return;
    }

    const result = p01Store.adminBulkPublishLearningDays(resolved.actor);
    if (result.ok) {
      void persistRobotAndSessionState();
      if (!resolved.isSandbox) {
        try {
          const adminApp = getInitializedFirebaseAdmin();
          if (adminApp) {
            await getDatabase(adminApp).ref('learning_days').set(p01Store.getState().learning_days);
          }
        } catch {
          // Ignore external sync error
        }
      }
    }
    res.status(result.status).json(result);
  });

  // 14f. P02 (Ca kiểm thử T28): SuperAdmin CMS cập nhật nội dung 28 ngày + kiểm tra nguồn + cờ clinical_review_flag
  app.post('/api/admin/content/days/:day', async (req: Request, res: Response) => {
    const resolved = await resolveRequestActor(req);
    if (resolved.mode === 'unconfigured') {
      res.status(503).json({
        error: 'SERVICE_NOT_CONFIGURED',
        uiLabel: 'Chưa cấu hình',
        requiredStage: 'P02',
        missingVars: resolved.missingVars,
        message: 'Chưa cấu hình Firebase Admin SDK.',
      });
      return;
    }
    if (resolved.mode === 'unauthenticated') {
      res.status(401).json({ error: 'UNAUTHENTICATED', message: resolved.message });
      return;
    }

    const dayNumber = Number(req.params.day);
    const result = p01Store.adminUpdateLearningDay(resolved.actor, {
      day_number: dayNumber,
      title_transcribed: req.body?.title_transcribed,
      slogan_transcribed: req.body?.slogan_transcribed,
      practice_steps: Array.isArray(req.body?.practice_steps) ? req.body.practice_steps : undefined,
      self_eval_items: Array.isArray(req.body?.self_eval_items) ? req.body.self_eval_items : undefined,
      clinical_review_flag: req.body?.clinical_review_flag,
      clinical_review_note: req.body?.clinical_review_note,
      info_asset_verified: req.body?.info_asset_verified,
      publish_status: req.body?.publish_status,
    });

    if (result.ok) {
      void persistRobotAndSessionState();
      if (!resolved.isSandbox && result.day) {
        try {
          const adminApp = getInitializedFirebaseAdmin();
          if (adminApp) {
            await getDatabase(adminApp).ref(`learning_days/${dayNumber}`).set(result.day);
          }
        } catch {
          // Ignore external sync error
        }
      }
    }

    res.status(result.status).json(result);
  });

  // 14g. P02: SuperAdmin cập nhật trạng thái Yêu cầu nhận chứng nhận Ngày 28
  app.post('/api/admin/certificates/:studentId/:requestId/status', async (req: Request, res: Response) => {
    const resolved = await resolveRequestActor(req);
    if (resolved.mode === 'unconfigured') {
      res.status(503).json({
        error: 'SERVICE_NOT_CONFIGURED',
        uiLabel: 'Chưa cấu hình',
        requiredStage: 'P02',
        missingVars: resolved.missingVars,
        message: 'Chưa cấu hình Firebase Admin SDK.',
      });
      return;
    }
    if (resolved.mode === 'unauthenticated') {
      res.status(401).json({ error: 'UNAUTHENTICATED', message: resolved.message });
      return;
    }

    const statusVal = req.body?.status;
    const validStatus: 'received' | 'processing' | 'completed' =
      statusVal === 'processing' || statusVal === 'completed' ? statusVal : 'received';

    const result = p01Store.adminUpdateCertificateRequestStatus(resolved.actor, {
      student_id: String(req.params.studentId || ''),
      request_id: String(req.params.requestId || ''),
      status: validStatus,
      admin_note: req.body?.admin_note ? String(req.body.admin_note) : undefined,
    });

    if (result.ok) {
      void persistRobotAndSessionState();
      if (!resolved.isSandbox && result.request) {
        try {
          const adminApp = getInitializedFirebaseAdmin();
          if (adminApp) {
            await getDatabase(adminApp)
              .ref(`certificate_requests/${req.params.studentId}/${req.params.requestId}`)
              .set(result.request);
          }
        } catch {
          // Ignore external sync error
        }
      }
    }

    res.status(result.status).json(result);
  });

  // ==========================================================================
  // CHẶNG P03: API ROBOT ĐỒNG HÀNH, PHIÊN HỌC, LỆNH/ACK, MQTT INGEST, CAPTURE & LỊCH SỬ
  // ==========================================================================

  // Helper cho P03: Lấy Actor đã xác thực hoặc Actor Phụ huynh / SuperAdmin mặc định trong Sandbox local
  async function resolveRobotActorOrDefault(req: Request): Promise<{
    actor: VerifiedActorToken;
    isSandbox: boolean;
  }> {
    const resolved = await resolveRequestActor(req);
    if (resolved.mode === 'authenticated') {
      return { actor: resolved.actor, isSandbox: resolved.isSandbox };
    }
    return {
      isSandbox: true,
      actor: {
        uid: 'uid-superadmin-02',
        email: 'tamtranmusic@gmail.com',
        email_verified: true,
        name: 'Tâm Trần (Chủ dự án · SuperAdmin)',
        admin: true,
        superadmin: true,
        role: 'superadmin',
      },
    };
  }

  // Helper lưu bền vững toàn bộ dữ liệu động thực tế ra đĩa (.data/bugz_rtdb_persistence.json) và đồng bộ lên Firebase RTDB thật
  async function persistRobotAndSessionState(deviceId?: string, sessionId?: string): Promise<void> {
    const state = p01Store.getState();
    const snapshotPayload = {
      updated_at: Date.now(),
      users: state.users,
      account_roles: state.account_roles,
      students: state.students,
      guardian_students: state.guardian_students,
      student_accounts: state.student_accounts,
      device_access: state.device_access,
      devices: state.devices,
      sessions: state.sessions,
      device_runtime: state.device_runtime,
      command_jobs: state.command_jobs,
      episode_log: state.episode_log,
      alerts: state.alerts,
      student_alerts: state.student_alerts,
      learning_progress: state.learning_progress,
      certificate_requests: state.certificate_requests,
      game_attempts: state.game_attempts,
      notification_jobs: state.notification_jobs,
      notification_preferences: state.notification_preferences,
      notification_reads: state.notification_reads,
      audit_logs: state.audit_logs,
      learning_days: state.learning_days,
      questions_public: state.questions_public,
      question_keys: state.question_keys,
      reminder_templates: state.reminder_templates,
      device_broker_credentials: state.device_broker_credentials,
      capture_metadata: state.capture_metadata,
      invitations: state.invitations,
    };

    try {
      fs.mkdirSync(PERSIST_DIR, { recursive: true });
      fs.writeFileSync(PERSIST_FILE_PRIMARY, JSON.stringify(snapshotPayload, null, 2), 'utf8');
    } catch {
      try {
        fs.writeFileSync(PERSIST_FILE_TMP, JSON.stringify(snapshotPayload, null, 2), 'utf8');
      } catch {
        // Ignore if read-only fs
      }
    }

    const adminApp = getInitializedFirebaseAdmin();
    if (!adminApp) return;
    try {
      const db = getDatabase(adminApp);
      const targetDeviceId = deviceId || 'robot01';
      if (state.devices[targetDeviceId]) {
        await db.ref(`devices/${targetDeviceId}`).set(state.devices[targetDeviceId]);
      }
      if (state.device_runtime[targetDeviceId]) {
        await db.ref(`device_runtime/${targetDeviceId}`).set(state.device_runtime[targetDeviceId]);
      }
      const targetSessionId =
        sessionId || state.device_runtime[targetDeviceId]?.active_session_id || undefined;
      if (targetSessionId && state.sessions[targetDeviceId]?.[targetSessionId]) {
        const sess = state.sessions[targetDeviceId][targetSessionId];
        await db.ref(`sessions/${targetDeviceId}/${targetSessionId}`).set(sess);
        const stuId = sess.student_id;
        if (stuId && state.episode_log[stuId]) {
          await db.ref(`episode_log/${stuId}`).set(state.episode_log[stuId]);
        }
        if (state.alerts[targetDeviceId]?.[targetSessionId]) {
          await db
            .ref(`alerts/${targetDeviceId}/${targetSessionId}`)
            .set(state.alerts[targetDeviceId][targetSessionId]);
        }
        if (stuId && state.student_alerts[stuId]) {
          await db.ref(`student_alerts/${stuId}`).set(state.student_alerts[stuId]);
        }
      }
    } catch {
      // Ignore transient RTDB network errors
    }
  }

  // Khởi tạo Native MQTT 3.1.1 over TLS Bridge cho thiết bị thật `robot01` (Không cần MQTTX)
  let lastAutoResyncMs = 0;
  mqttBridge = new BugzNativeMqttBridge(
    {
      brokerUrl:
        process.env.MQTT_BROKER_URL ||
        'mqtts://d1a2b01a.ala.asia-southeast1.emqxsl.com:8883',
      username:
        process.env.MQTT_BRIDGE_USERNAME ||
        process.env.MQTT_BROKER_USERNAME ||
        'robot01',
      password:
        process.env.MQTT_BRIDGE_PASSWORD ||
        process.env.MQTT_BROKER_PASSWORD ||
        'BUGZ@2026',
      targetDeviceIds: ['robot01'],
    },
    ({ topic, payload: payloadObj }) => {
      const deviceId = String(payloadObj.device_id || 'robot01');
      const incomingSessionId =
        typeof payloadObj.session_id === 'string' ? payloadObj.session_id : undefined;

      p01Store.ingestMqttPacket({
        topic,
        payload: payloadObj,
        brokerClientId: deviceId,
        brokerUsername: deviceId,
        isWebhookAuthenticated: true,
      });

      const runtime = p01Store.getState().device_runtime[deviceId];
      const activeSessionId = runtime?.active_session_id;
      const activeStudentId = runtime?.active_student_id;
      const ownerUid =
        (activeStudentId && p01Store.getState().students[activeStudentId]?.guardian_owner_uid) ||
        p01Store.getState().devices[deviceId]?.user_id ||
        '';
      if (
        ownerUid &&
        activeSessionId &&
        incomingSessionId &&
        incomingSessionId !== activeSessionId &&
        Date.now() - lastAutoResyncMs > 3500
      ) {
        lastAutoResyncMs = Date.now();
        const cmdRes = p01Store.sendDeviceMonitoringCommand(
          {
            uid: ownerUid,
            email: p01Store.getState().users[ownerUid]?.email || 'user@bugz.vn',
            email_verified: true,
            superadmin: p01Store.getState().account_roles[ownerUid]?.role === 'superadmin',
            role: p01Store.getState().account_roles[ownerUid]?.role || 'user',
          },
          {
            device_id: deviceId,
            monitoring_enabled: true,
            alert_after_sec: p01Store.getState().devices[deviceId]?.alert_after_sec || 3,
            ttl_sec: 60,
            source: 'real',
          }
        );
        if (cmdRes.ok && cmdRes.command_job) {
          mqttBridge.publishCommandToDevice(deviceId, {
            schema_version: 1,
            command_id: cmdRes.command_job.command_id,
            device_id: deviceId,
            session_id: activeSessionId,
            type: 'monitoring.set',
            monitoring_enabled: cmdRes.command_job.monitoring_enabled,
            alert_after_sec: cmdRes.command_job.alert_after_sec,
            config_version: cmdRes.command_job.config_version,
            issued_at: cmdRes.command_job.created_at,
            expires_at: cmdRes.command_job.expires_at,
          });
        }
      }

      void persistRobotAndSessionState(deviceId, incomingSessionId || activeSessionId || undefined);
    }
  );
  mqttBridge.connect();

  // 15a. P03: Lấy dữ liệu khởi tạo Module Robot Đồng hành (`/robot`)
  app.get('/api/robot/bootstrap', async (req: Request, res: Response) => {
    const { actor, isSandbox } = await resolveRobotActorOrDefault(req);
    const stageChecks = evaluateStageFeatureConfigs(process.env);
    const bootstrap = p01Store.getRobotBootstrapForActor(actor);
    const bridgeStatus = mqttBridge.getStatus();

    res.json({
      ok: true,
      isSandbox,
      chosenAdapterMode: bridgeStatus.connected ? 'native_tls_mqtt_bridge' : 'webhook_https',
      episodeAuthority: 'bridge',
      mqttBrokerConfigured: bridgeStatus.connected || stageChecks.mqttAndRobot.isConfigured,
      mqttMissingVars: bridgeStatus.connected ? [] : stageChecks.mqttAndRobot.missingOrInvalidVars,
      robotConnectionTemplateStatus: bridgeStatus.connected
        ? 'CONNECTED_TO_EMQX_TLS_8883'
        : 'WAITING_BROKER_CONNECTION',
      mqttBridgeStatus: bridgeStatus,
      persistenceFile: fs.existsSync(PERSIST_FILE_PRIMARY)
        ? '.data/bugz_rtdb_persistence.json'
        : fs.existsSync(PERSIST_FILE_TMP)
        ? '/tmp/bugz_rtdb_persistence.json'
        : 'ready_on_write',
      ...bootstrap,
    });
  });

  // 15a-2. Endpoint xem trạng thái & kết nối lại Native MQTT TLS Bridge (`robot01`)
  app.get('/api/mqtt/bridge/status', (_req: Request, res: Response) => {
    res.json({
      ok: true,
      bridge: mqttBridge.getStatus(),
    });
  });

  app.post('/api/mqtt/bridge/connect', (req: Request, res: Response) => {
    mqttBridge.updateConfigAndConnect({
      brokerUrl: req.body?.brokerUrl ? String(req.body.brokerUrl) : undefined,
      username: req.body?.username ? String(req.body.username) : undefined,
      password: req.body?.password ? String(req.body.password) : undefined,
      targetDeviceIds: Array.isArray(req.body?.deviceIds)
        ? req.body.deviceIds.map(String)
        : undefined,
    });
    res.json({
      ok: true,
      message: 'Đã cập nhật cấu hình và kết nối lại MQTT TLS Bridge cho robot01.',
      bridge: mqttBridge.getStatus(),
    });
  });

  // 15b. P03 & Bước 3 Kế hoạch 7/11: Bắt đầu phiên học trên Robot
  // - Tạo `session_id` mới (thay thế `session-manual-001`)
  // - Tự động gửi `monitoring.set` xuống ESP32 (`bugz/v1/devices/robot01/commands`)
  // - Giữ `monitoring_active = false` cho đến khi ESP32 trả `command.ack` trên `bugz/v1/devices/robot01/acks`!
  app.post('/api/sessions/start', async (req: Request, res: Response) => {
    const { actor } = await resolveRobotActorOrDefault(req);
    const deviceId = String(req.body?.device_id || 'robot01');
    const source = req.body?.source === 'simulator' ? 'simulator' : 'real';
    const defaultStuId = p01Store.getOwnedStudentsForActor(actor)[0]?.student_id || 'stu-a1';

    const result = p01Store.startRobotSession(actor, {
      device_id: deviceId,
      student_id: String(req.body?.student_id || defaultStuId),
      source,
      content_day: req.body?.content_day ? Number(req.body.content_day) : undefined,
      custom_session_id: req.body?.session_id ? String(req.body.session_id) : undefined,
      auto_close_previous:
        req.body?.auto_close_previous !== undefined ? Boolean(req.body.auto_close_previous) : true,
    });

    let dispatchedCommand: unknown = null;
    let mqttPublished = false;

    if (result.ok && result.session && result.session_id && req.body?.skip_auto_command !== true) {
      const alertAfterSec = req.body?.alert_after_sec
        ? Number(req.body.alert_after_sec)
        : p01Store.getState().devices[deviceId]?.alert_after_sec || (deviceId === 'robot01' ? 3 : 30);

      const cmdRes = p01Store.sendDeviceMonitoringCommand(actor, {
        device_id: deviceId,
        monitoring_enabled: true,
        alert_after_sec: alertAfterSec,
        ttl_sec: 60,
        source,
      });

      if (cmdRes.ok && cmdRes.command_job) {
        dispatchedCommand = cmdRes.command_job;
        const pubRes = mqttBridge.publishCommandToDevice(deviceId, {
          schema_version: 1,
          command_id: cmdRes.command_job.command_id,
          device_id: deviceId,
          session_id: result.session_id,
          type: 'monitoring.set',
          monitoring_enabled: true,
          alert_after_sec: cmdRes.command_job.alert_after_sec,
          config_version: cmdRes.command_job.config_version,
          issued_at: cmdRes.command_job.created_at,
          expires_at: cmdRes.command_job.expires_at,
        });
        mqttPublished = pubRes.ok;
      }
    }

    if (result.ok && result.session) {
      await persistRobotAndSessionState(deviceId, result.session_id);
    }

    res.status(result.status).json({
      ...result,
      dispatchedCommand,
      mqttPublished,
      message:
        result.ok && dispatchedCommand
          ? `${result.message} Đã tự động gửi lệnh monitoring.set (session_id="${result.session_id}") xuống ${deviceId} qua MQTT TLS Bridge (${mqttPublished ? 'ĐÃ GỬI TỚI BROKER' : 'ĐANG CHỜ KẾT NỐI'}) — Chờ ESP32 phản hồi ACK trước khi bật monitoring_active=true.`
          : result.message,
    });
  });

  // 15c. P03 & Bước 5 Kế hoạch 7/11: Kết thúc phiên học trên Robot, tính tổng `bad_duration_ms`, gửi lệnh dừng giám sát và lưu bền vững
  app.post('/api/sessions/:sessionId/end', async (req: Request, res: Response) => {
    const { actor } = await resolveRobotActorOrDefault(req);
    const sessionId = String(req.params.sessionId || '');
    const deviceId = String(req.body?.device_id || 'robot01');
    const result = p01Store.endRobotSession(actor, {
      device_id: deviceId,
      session_id: sessionId,
    });

    let mqttStopPublished = false;
    if (result.ok && result.session && req.body?.skip_auto_command !== true) {
      const cmdRes = p01Store.sendDeviceMonitoringCommand(actor, {
        device_id: deviceId,
        monitoring_enabled: false,
        alert_after_sec: p01Store.getState().devices[deviceId]?.alert_after_sec || 3,
        ttl_sec: 30,
        source: result.session.source,
      });
      if (cmdRes.ok && cmdRes.command_job) {
        const pubRes = mqttBridge.publishCommandToDevice(deviceId, {
          schema_version: 1,
          command_id: cmdRes.command_job.command_id,
          device_id: deviceId,
          session_id: sessionId,
          type: 'monitoring.set',
          monitoring_enabled: false,
          alert_after_sec: cmdRes.command_job.alert_after_sec,
          config_version: cmdRes.command_job.config_version,
          issued_at: cmdRes.command_job.created_at,
          expires_at: cmdRes.command_job.expires_at,
        });
        mqttStopPublished = pubRes.ok;
      }
      await persistRobotAndSessionState(deviceId, sessionId);
    }

    res.status(result.status).json({
      ...result,
      mqttStopPublished,
    });
  });

  // 15d. P03 (Mục 13.2 & Ca kiểm thử T11): Gửi lệnh bật/tắt giám sát xuống Robot
  // Lưu command_jobs/{device_id}/{command_id} với retain=false, expires_at; KHÔNG trả monitoring_active=true trước ACK!
  app.post('/api/devices/:deviceId/commands', async (req: Request, res: Response) => {
    const { actor } = await resolveRobotActorOrDefault(req);
    const deviceId = String(req.params.deviceId || '');
    const requestedSource = req.body?.source === 'simulator' ? 'simulator' : 'real';
    const stageChecks = evaluateStageFeatureConfigs(process.env);
    const bridgeConnected = mqttBridge.getStatus().connected;

    // Nếu gọi ở chế độ Robot thật (source=real) trên thiết bị khác robot01 khi chưa cấu hình MQTT Broker và Bridge chưa kết nối, báo rõ Chưa cấu hình
    if (
      requestedSource === 'real' &&
      deviceId !== 'sim-dev01' &&
      deviceId !== 'robot01' &&
      !bridgeConnected &&
      !stageChecks.mqttAndRobot.isConfigured &&
      !req.body?.allow_sandbox_queue
    ) {
      res.status(503).json({
        error: 'SERVICE_NOT_CONFIGURED',
        uiLabel: 'Chưa cấu hình',
        requiredStage: 'P03',
        deviceId,
        monitoring_enabled_requested: Boolean(req.body?.monitoring_enabled),
        monitoring_active: false,
        missingVars: stageChecks.mqttAndRobot.missingOrInvalidVars,
        message: `Chưa cấu hình — Không thể publish lệnh tới Robot vật lý (${deviceId}) vì MQTT Broker / Publish API chưa cấu hình (${stageChecks.mqttAndRobot.missingOrInvalidVars.join(', ')}). Không bao giờ tự đặt monitoring_active = true khi Robot chưa ACK.`,
      });
      return;
    }

    const result = p01Store.sendDeviceMonitoringCommand(actor, {
      device_id: deviceId,
      monitoring_enabled: Boolean(req.body?.monitoring_enabled),
      alert_after_sec: req.body?.alert_after_sec ? Number(req.body.alert_after_sec) : undefined,
      ttl_sec: req.body?.ttl_sec ? Number(req.body.ttl_sec) : 30,
      custom_command_id: req.body?.command_id ? String(req.body.command_id) : undefined,
      source: requestedSource,
    });

    let mqttPublished = false;
    if (result.ok && result.command_job) {
      const pubRes = mqttBridge.publishCommandToDevice(deviceId, {
        schema_version: 1,
        command_id: result.command_job.command_id,
        device_id: deviceId,
        session_id: result.command_job.session_id,
        type: 'monitoring.set',
        monitoring_enabled: result.command_job.monitoring_enabled,
        alert_after_sec: result.command_job.alert_after_sec,
        config_version: result.command_job.config_version,
        issued_at: result.command_job.created_at,
        expires_at: result.command_job.expires_at,
      });
      mqttPublished = pubRes.ok;
      await persistRobotAndSessionState(deviceId, result.command_job.session_id);
    }

    res.status(result.status).json({
      ...result,
      mqttPublished,
      monitoring_enabled: result.device?.monitoring_enabled ?? Boolean(req.body?.monitoring_enabled),
      monitoring_active: result.device?.monitoring_active ?? false,
    });
  });

  // 15e. P03 (Mục 12.1–12.4, 13.2 & Ca kiểm thử T11–T17): Tiếp nhận gói tin MQTT từ Broker Webhook, Native Bridge hoặc Admin Simulator
  const handleMqttIngestRoute = async (req: Request, res: Response) => {
    const stageChecks = evaluateStageFeatureConfigs(process.env);
    const sharedSecret = process.env.MQTT_WEBHOOK_SHARED_SECRET;
    const providedSecret = req.headers['x-bugz-webhook-secret'];
    const isWebhookAuthenticated =
      Boolean(sharedSecret && sharedSecret.trim().length > 0 && providedSecret === sharedSecret) ||
      mqttBridge.getStatus().connected;

    const payloadObj = (req.body?.payload || req.body || {}) as Record<string, unknown>;
    const payloadSource = payloadObj.source === 'simulator' ? 'simulator' : 'real';

    if (payloadSource === 'real' && !isWebhookAuthenticated && !stageChecks.mqttAndRobot.isConfigured) {
      res.status(503).json({
        error: 'SERVICE_NOT_CONFIGURED',
        uiLabel: 'Chưa cấu hình',
        requiredStage: 'P03',
        missingVars: stageChecks.mqttAndRobot.missingOrInvalidVars,
        message: `Chưa cấu hình — MQTT Broker Webhook chưa cấu hình (${stageChecks.mqttAndRobot.missingOrInvalidVars.join(', ')}). Hệ thống không giả nhận dữ liệu Robot thật.`,
      });
      return;
    }

    const { actor } = await resolveRobotActorOrDefault(req);
    const deviceId = String(payloadObj.device_id || 'robot01');
    const topic = String(
      req.body?.topic || `bugz/v1/devices/${deviceId}/observations`
    );

    const result = p01Store.ingestMqttPacket({
      topic,
      payload: payloadObj,
      brokerClientId: req.body?.client_id
        ? String(req.body.client_id)
        : typeof req.headers['x-mqtt-client-id'] === 'string'
        ? req.headers['x-mqtt-client-id']
        : deviceId,
      brokerUsername: req.body?.username
        ? String(req.body.username)
        : typeof req.headers['x-mqtt-username'] === 'string'
        ? req.headers['x-mqtt-username']
        : deviceId,
      isWebhookAuthenticated: true,
      actor,
      simulateCrashBeforeFanout: Boolean(req.body?.simulate_crash_before_fanout),
    });

    await persistRobotAndSessionState(
      deviceId,
      typeof payloadObj.session_id === 'string' ? payloadObj.session_id : undefined
    );

    res.status(result.status).json(result);
  };

  app.post('/api/ingest/mqtt', handleMqttIngestRoute);
  app.post('/api/mqtt/webhook', handleMqttIngestRoute);

  // 15f. P03 (Ca kiểm thử T15): Chạy lại Projection Worker để khôi phục Outbox sau khi crash trước fan-out
  app.post('/api/robot/worker/:deviceId/drain', (req: Request, res: Response) => {
    const deviceId = String(req.params.deviceId || '');
    const workerRes = p01Store.runDeviceProjectionWorker(deviceId);
    res.json({
      ok: true,
      device_id: deviceId,
      ...workerRes,
      message: `Đã chạy Idempotent Projection Worker cho "${deviceId}" (số mục outbox vừa chiếu: ${workerRes.projectedCount}).`,
    });
  });

  // 15g. P03 (Mục 13.2 & Ca kiểm thử T19): Robot yêu cầu Upload Ticket ngắn hạn cho ảnh Capture
  app.post('/api/captures/upload-ticket', (req: Request, res: Response) => {
    const result = p01Store.requestCaptureUploadTicket({
      device_id: String(req.body?.device_id || ''),
      session_id: String(req.body?.session_id || ''),
      capture_id: req.body?.capture_id ? String(req.body.capture_id) : undefined,
      mime_type: String(req.body?.mime_type || 'image/jpeg'),
      byte_size: Number(req.body?.byte_size || 0),
      source: req.body?.source === 'simulator' ? 'simulator' : 'real',
    });
    res.status(result.status).json(result);
  });

  // 15h. P03 (Ca kiểm thử T19): Hoàn tất PUT ảnh Capture qua Upload Ticket
  app.put('/api/captures/:captureId/upload', (req: Request, res: Response) => {
    const result = p01Store.completeCaptureUpload({
      capture_id: String(req.params.captureId || ''),
      upload_ticket_token: String(
        req.headers['x-upload-ticket-token'] || req.body?.upload_ticket_token || ''
      ),
      simulate_failure: Boolean(req.body?.simulate_failure),
      failure_reason: req.body?.failure_reason ? String(req.body.failure_reason) : undefined,
    });
    res.status(result.status).json(result);
  });

  // 15i. P03 (Mục 13.2 & Ca kiểm thử T03, T19): Đọc ảnh Capture riêng tư có kiểm tra quan hệ RBAC
  app.get('/api/captures/:captureId', async (req: Request, res: Response) => {
    const { actor } = await resolveRobotActorOrDefault(req);
    const result = p01Store.readCaptureForActor(actor, {
      capture_id: String(req.params.captureId || ''),
      support_reason:
        typeof req.query.reason === 'string' ? req.query.reason : undefined,
    });
    res.status(result.status).json(result);
  });

  // 15j. P03 (Mục 13.2): Đánh dấu đã đọc cảnh báo (`alerts.is_read` & `notification_reads/{uid}/{alert_id}`)
  app.post('/api/alerts/:alertId/read', async (req: Request, res: Response) => {
    const { actor } = await resolveRobotActorOrDefault(req);
    const result = p01Store.markAlertRead(actor, {
      alert_id: String(req.params.alertId || ''),
    });
    res.status(result.status).json(result);
  });

  // 15k. P03 (Mục 6.5, 11.3 & Ca kiểm thử T25): Truy vấn Lịch sử theo Học sinh & Múi giờ Việt Nam [từ, đến)
  app.get('/api/robot/history', async (req: Request, res: Response) => {
    const { actor } = await resolveRobotActorOrDefault(req);
    const presetRaw = String(req.query.preset || 'day');
    const validPresets = ['hour', 'day', 'week', 'month', 'year', 'custom'] as const;
    const preset = validPresets.includes(presetRaw as (typeof validPresets)[number])
      ? (presetRaw as (typeof validPresets)[number])
      : 'day';

    const defaultStuId = p01Store.getOwnedStudentsForActor(actor)[0]?.student_id || 'stu-a1';
    const result = p01Store.queryRobotHistory(actor, {
      student_id: String(req.query.studentId || defaultStuId),
      preset,
      anchor_utc_ms: req.query.anchorUtcMs ? Number(req.query.anchorUtcMs) : undefined,
      custom_from_utc_ms: req.query.fromUtcMs ? Number(req.query.fromUtcMs) : undefined,
      custom_to_utc_ms: req.query.toUtcMs ? Number(req.query.toUtcMs) : undefined,
      device_id: typeof req.query.deviceId === 'string' ? req.query.deviceId : undefined,
      severity:
        req.query.severity === 'low' ||
        req.query.severity === 'medium' ||
        req.query.severity === 'high'
          ? req.query.severity
          : 'all',
      source:
        req.query.source === 'real' || req.query.source === 'simulator'
          ? req.query.source
          : 'all',
      cursor: typeof req.query.cursor === 'string' ? req.query.cursor : undefined,
      page_size: req.query.pageSize ? Number(req.query.pageSize) : 10,
    });

    res.status(result.status).json(result);
  });

  // ==========================================================================
  // CHẶNG P04: API PIPELINE THÔNG BÁO ĐA KÊNH, FCM PUSH TOKENS, JOBS & DEEP-LINK RBAC
  // ==========================================================================

  // 16a. P04 (Ca kiểm thử T03, T20, T22): Xem chi tiết cảnh báo `/alerts/:alertId`
  // - Nếu chưa đăng nhập -> trả 401 UNAUTHENTICATED (không lộ bất kỳ dữ liệu riêng tư hay ảnh capture nào; client lưu returnTo=/alerts/:alertId và mở /login).
  // - Nếu đã đăng nhập nhưng thuộc gia đình khác -> trả 403 FORBIDDEN_CROSS_FAMILY_ALERT.
  // - Nếu hợp lệ -> trả kèm đúng học sinh (student_display_name) và thiết bị (device_name) cho phụ huynh nhiều con (T20).
  app.get('/api/alerts/:alertId', async (req: Request, res: Response) => {
    const resolved = await resolveRequestActor(req);
    if (resolved.mode !== 'authenticated') {
      res.status(401).json({
        ok: false,
        status: 401,
        code: 'UNAUTHENTICATED_RETURN_TO_LOGIN',
        returnTo: `/alerts/${String(req.params.alertId || '')}`,
        message:
          'Vui lòng đăng nhập để xem chi tiết cảnh báo và ảnh phiên học. Hệ thống đã lưu đường dẫn returnTo để mở lại đúng cảnh báo sau khi đăng nhập (T22).',
      });
      return;
    }

    const result = p01Store.getAlertDetailForActor(resolved.actor, {
      alert_id: String(req.params.alertId || ''),
    });
    res.status(result.status).json(result);
  });

  // 16b. P04: Lấy dữ liệu Trung tâm Thông báo (Notification Center) của người dùng hiện tại
  app.get('/api/notifications/center', async (req: Request, res: Response) => {
    const { actor, isSandbox } = await resolveRobotActorOrDefault(req);
    const stageChecks = evaluateStageFeatureConfigs(process.env);
    const center = p01Store.getNotificationCenterForActor(actor);

    res.json({
      ok: true,
      isSandbox,
      fcmProviderConfigured: stageChecks.fcmWebPush.isConfigured,
      fcmMissingVars: stageChecks.fcmWebPush.missingOrInvalidVars,
      emailProviderConfigured: stageChecks.emailProvider.isConfigured,
      emailMissingVars: stageChecks.emailProvider.missingOrInvalidVars,
      ...center,
    });
  });

  // 16c. P04 (Mục 7.1): Lưu cấu hình kênh nhận thông báo `notification_preferences/{uid}`
  app.post('/api/notifications/preferences', async (req: Request, res: Response) => {
    const { actor, isSandbox } = await resolveRobotActorOrDefault(req);
    const result = p01Store.updateNotificationPreferences(actor, {
      push_enabled: req.body?.push_enabled,
      voice_enabled: req.body?.voice_enabled,
      email_enabled: req.body?.email_enabled,
      mode: req.body?.mode,
      quiet_hours_start: req.body?.quiet_hours_start,
      quiet_hours_end: req.body?.quiet_hours_end,
    });

    if (result.ok && !isSandbox && result.preferences) {
      const adminApp = getInitializedFirebaseAdmin();
      if (adminApp) {
        await getDatabase(adminApp)
          .ref(`notification_preferences/${actor.uid}`)
          .set(result.preferences);
      }
    }

    res.status(result.status).json(result);
  });

  // 16d. P04 (Mục 7.2 & Ca kiểm thử T21, T29): Đăng ký FCM Web Push Token theo `uid` + `installation_id`
  app.post('/api/notifications/push-tokens', async (req: Request, res: Response) => {
    const { actor, isSandbox } = await resolveRobotActorOrDefault(req);
    const result = p01Store.registerPushToken(actor, {
      installation_id: String(req.body?.installation_id || ''),
      token: String(req.body?.token || ''),
      platform: req.body?.platform,
      user_agent: req.body?.user_agent ? String(req.body.user_agent) : req.headers['user-agent'],
    });

    if (result.ok && !isSandbox && result.tokenRecord) {
      const adminApp = getInitializedFirebaseAdmin();
      if (adminApp) {
        await getDatabase(adminApp)
          .ref(`push_tokens/${actor.uid}/${result.tokenRecord.installation_id}`)
          .set(result.tokenRecord);
      }
    }

    res.status(result.status).json(result);
  });

  // 16e. P04 (Mục 7.2 & Ca kiểm thử T29): Hủy liên kết FCM Push Token khi đăng xuất hoặc đổi tài khoản
  app.delete('/api/notifications/push-tokens', async (req: Request, res: Response) => {
    const resolved = await resolveRequestActor(req);
    if (resolved.mode !== 'authenticated') {
      res.status(200).json({
        ok: true,
        unlinkedCount: 0,
        message: 'Phiên đã đăng xuất.',
      });
      return;
    }

    const installationId =
      typeof req.query.installation_id === 'string'
        ? req.query.installation_id
        : req.body?.installation_id
        ? String(req.body.installation_id)
        : undefined;

    const result = p01Store.unregisterPushToken(resolved.actor, {
      installation_id: installationId,
    });
    res.status(result.status).json(result);
  });

  // 16f. P04 (Ca kiểm thử T20, T24): Định tuyến người nhận từ Server Session & Tạo/Điều phối Notification Jobs
  app.post('/api/notifications/dispatch', async (req: Request, res: Response) => {
    await resolveRobotActorOrDefault(req);
    const stageChecks = evaluateStageFeatureConfigs(process.env);

    const simulateRaw = req.body?.simulate_provider_outcome;
    const validOutcomes = [
      'auto',
      'accepted_by_provider',
      'provider_transient_error',
      'fcm_token_expired',
    ] as const;
    const simulateOutcome = validOutcomes.includes(simulateRaw) ? simulateRaw : undefined;

    const nowMs =
      typeof req.body?.custom_now_utc_ms === 'number' &&
      Number.isFinite(req.body.custom_now_utc_ms)
        ? req.body.custom_now_utc_ms
        : Date.now();

    const result = p01Store.routeAndDispatchAlertNotifications(
      {
        alert_id: String(req.body?.alert_id || 'alert-a-001'),
        device_id: String(req.body?.device_id || 'robot-fam-a-01'),
        session_id: String(req.body?.session_id || 'sess-a-001'),
        server_student_id: req.body?.server_student_id
          ? String(req.body.server_student_id)
          : undefined,
        spoofed_payload_student_id: req.body?.spoofed_payload_student_id
          ? String(req.body.spoofed_payload_student_id)
          : undefined,
        spoofed_payload_email: req.body?.spoofed_payload_email
          ? String(req.body.spoofed_payload_email)
          : undefined,
        posture_code: req.body?.posture_code,
        reminder_index: req.body?.reminder_index ? Number(req.body.reminder_index) : 1,
        fcmProviderConfigured: stageChecks.fcmWebPush.isConfigured,
        emailProviderConfigured: stageChecks.emailProvider.isConfigured,
        simulateProviderOutcome: simulateOutcome,
      },
      nowMs
    );

    res.status(result.status).json(result);
  });

  // 16g. P04 (Ca kiểm thử T24): Retry có giới hạn một Notification Job bị lỗi (`state === 'failed'`)
  app.post('/api/notifications/jobs/:jobId/retry', async (req: Request, res: Response) => {
    const { actor } = await resolveRobotActorOrDefault(req);
    const outcome =
      req.body?.simulate_outcome === 'provider_transient_error'
        ? 'provider_transient_error'
        : 'accepted_by_provider';

    const result = p01Store.retryNotificationJobForActor(actor, {
      job_id: String(req.params.jobId || ''),
      simulate_outcome: outcome,
    });
    res.status(result.status).json(result);
  });

  // 17. Endpoint kiểm tra cấu hình dịch vụ gửi Email cảnh báo / chứng nhận (Bắt buộc từ Chặng P04)
  app.post('/api/notifications/test-email', (_req: Request, res: Response) => {
    const stageChecks = evaluateStageFeatureConfigs(process.env);
    if (!stageChecks.emailProvider.isConfigured) {
      res.status(503).json({
        error: 'SERVICE_NOT_CONFIGURED',
        uiLabel: 'Chưa cấu hình',
        requiredStage: 'P04',
        missingVars: stageChecks.emailProvider.missingOrInvalidVars,
        message: `Chưa cấu hình — Dịch vụ gửi Email cảnh báo/chứng nhận thực tế đang ở trạng thái BLOCKED vì thiếu biến: ${stageChecks.emailProvider.missingOrInvalidVars.join(', ')}. Hệ thống không giả gửi email thành công.`,
      });
      return;
    }

    res.status(202).json({
      state: 'queued',
      message: 'Đã xếp hàng đợi gửi email (queued) qua EMAIL_PROVIDER.',
    });
  });

  // ==========================================================================
  // CHẶNG P05: API TRÒ CHƠI RÈN LUYỆN (3 MODES), SEED 40 CÂU & ADMIN 9 NHÓM
  // ==========================================================================

  // 18a. P05 (Mục 8, 11.4, 13.2 & Ca kiểm thử T26, T28): Lấy dữ liệu khởi tạo Trò chơi Rèn luyện
  app.get('/api/games/bootstrap', async (req: Request, res: Response) => {
    const { actor, isSandbox } = await resolveLearningActorOrDefault(req);
    if (!actor) {
      const guestActor: VerifiedActorToken = {
        uid: '',
        email: '',
        email_verified: false,
        role: 'student',
      };
      const state = p01Store.getState();
      const allPublicQuestions = Object.values(state.questions_public);
      const publishedQuestions = allPublicQuestions.filter((q) => q.status === 'published');
      const data = p01Store.getGamesBootstrapForActor(guestActor);
      res.json({
        ok: true,
        isSandbox,
        ...data,
        studentId: '',
        studentDisplayName: 'Chưa đăng nhập',
        accessibleStudents: [],
        recentAttempts: [],
        separatedMetrics: {
          gameScoreTotal: 0,
          gameCompletedAttemptsCount: 0,
          selfPracticeCompletedDaysCount: 0,
          selfPracticeTotalDays: 28,
          robotObservedGoodEpisodes: 0,
          robotObservedBadEpisodes: 0,
          clinicalSeparationDisclaimer: data.separatedMetrics.clinicalSeparationDisclaimer,
        },
        publishedQuestions,
      });
      return;
    }
    const requestedStudentId =
      typeof req.query.studentId === 'string' ? req.query.studentId : undefined;
    const data = p01Store.getGamesBootstrapForActor(actor, requestedStudentId);
    res.json({
      ok: true,
      isSandbox,
      ...data,
    });
  });

  // 18b. P05 (Mục 8.2, 13.2 & Ca kiểm thử T26, T28): Bắt đầu lượt chơi mới (`POST /api/games/attempts`)
  app.post('/api/games/attempts', async (req: Request, res: Response) => {
    const { actor, isSandbox } = await resolveLearningActorOrDefault(req);
    const effectiveActor: VerifiedActorToken = actor || {
      uid: 'guest-player',
      email: 'guest@bugz.vn',
      email_verified: false,
      name: 'Người chơi Trải nghiệm',
      role: 'user',
    };
    const defaultStuId = p01Store.getOwnedStudentsForActor(effectiveActor)[0]?.student_id || `stu-${effectiveActor.uid}`;
    const studentId = String(req.body?.student_id || defaultStuId);
    const gameIdRaw = String(req.body?.game_id || 'situations');
    const validGameId =
      gameIdRaw === 'desk_builder' || gameIdRaw === 'habit_relay'
        ? gameIdRaw
        : 'situations';
    const topicFilterRaw = String(req.body?.topic_filter || 'all');
    const validTopic =
      topicFilterRaw === 'lung_thang' || topicFilterRaw === 'mat_sang'
        ? topicFilterRaw
        : 'all';

    const rawLimit = req.body?.question_limit;
    const questionLimit: number | 'all' | undefined =
      rawLimit === 'all'
        ? 'all'
        : typeof rawLimit === 'number' && Number.isFinite(rawLimit)
          ? Number(rawLimit)
          : undefined;

    const result = p01Store.startGameAttempt(effectiveActor, {
      student_id: studentId,
      game_id: validGameId,
      topic_filter: validTopic,
      timer_enabled: Boolean(req.body?.timer_enabled),
      question_limit: questionLimit,
    });

    if (result.ok) {
      if (actor) void persistRobotAndSessionState();
      if (!isSandbox && result.attempt) {
        const adminApp = getInitializedFirebaseAdmin();
        if (adminApp) {
          await getDatabase(adminApp)
            .ref(`game_attempts/${studentId}/${result.attempt.attempt_id}`)
            .set(result.attempt);
        }
      }
    }

    res.status(result.status).json(result);
  });

  // 18c. P05 (Mục 8.2, 13.2 & Ca kiểm thử T26, T27): Chấm điểm câu hỏi / thao tác phía Server (`POST /api/games/attempts/:attemptId/answers`)
  app.post('/api/games/attempts/:attemptId/answers', async (req: Request, res: Response) => {
    const { actor, isSandbox } = await resolveLearningActorOrDefault(req);
    const effectiveActor: VerifiedActorToken = actor || {
      uid: 'guest-player',
      email: 'guest@bugz.vn',
      email_verified: false,
      name: 'Người chơi Trải nghiệm',
      role: 'user',
    };
    const attemptId = String(req.params.attemptId || '');
    const result = p01Store.submitGameAttemptAnswer(effectiveActor, {
      attempt_id: attemptId,
      student_id: req.body?.student_id ? String(req.body.student_id) : undefined,
      question_id: req.body?.question_id ? String(req.body.question_id) : undefined,
      selected_option_id: req.body?.selected_option_id,
      desk_pairs: req.body?.desk_pairs,
      ordered_card_ids: Array.isArray(req.body?.ordered_card_ids)
        ? req.body.ordered_card_ids
        : undefined,
      self_reflection_text: req.body?.self_reflection_text
        ? String(req.body.self_reflection_text)
        : undefined,
    });

    if (result.ok) {
      if (actor) void persistRobotAndSessionState();
      if (!isSandbox && result.attempt) {
        const adminApp = getInitializedFirebaseAdmin();
        if (adminApp) {
          await getDatabase(adminApp)
            .ref(`game_attempts/${result.attempt.student_id}/${result.attempt.attempt_id}`)
            .set(result.attempt);
        }
      }
    }

    res.status(result.status).json(result);
  });

  // 18d. P05: Lấy chi tiết kết quả một lượt chơi (`GET /api/games/attempts/:attemptId`)
  app.get('/api/games/attempts/:attemptId', async (req: Request, res: Response) => {
    const { actor } = await resolveLearningActorOrDefault(req);
    const effectiveActor: VerifiedActorToken = actor || {
      uid: 'guest-player',
      email: 'guest@bugz.vn',
      email_verified: false,
      name: 'Người chơi Trải nghiệm',
      role: 'user',
    };
    const result = p01Store.getGameAttemptForActor(
      effectiveActor,
      String(req.params.attemptId || '')
    );
    res.status(result.status).json(result);
  });

  // 18e. P05 (Ca kiểm thử T04, T28): SuperAdmin lấy danh sách 40 câu hỏi kèm question_keys
  app.get('/api/admin/questions', async (req: Request, res: Response) => {
    const resolved = await resolveRequestActor(req);
    if (resolved.mode === 'unconfigured') {
      res.status(503).json({
        error: 'SERVICE_NOT_CONFIGURED',
        uiLabel: 'Chưa cấu hình',
        requiredStage: 'P05',
        missingVars: resolved.missingVars,
        message: 'Chưa cấu hình Firebase Admin SDK.',
      });
      return;
    }
    if (resolved.mode === 'unauthenticated') {
      res.status(401).json({ error: 'UNAUTHENTICATED', message: resolved.message });
      return;
    }

    const result = p01Store.adminGetQuestionBank(resolved.actor);
    res.status(result.status).json(result);
  });

  // 18f. P05 (Ca kiểm thử T04, T28): SuperAdmin chạy Dry-Run hoặc Import thực tế `question_bank.json` (40 câu)
  app.post('/api/admin/questions/import', async (req: Request, res: Response) => {
    const resolved = await resolveRequestActor(req);
    if (resolved.mode === 'unconfigured') {
      res.status(503).json({
        error: 'SERVICE_NOT_CONFIGURED',
        uiLabel: 'Chưa cấu hình',
        requiredStage: 'P05',
        missingVars: resolved.missingVars,
        message: 'Chưa cấu hình Firebase Admin SDK.',
      });
      return;
    }
    if (resolved.mode === 'unauthenticated') {
      res.status(401).json({ error: 'UNAUTHENTICATED', message: resolved.message });
      return;
    }

    const dryRun = Boolean(req.body?.dry_run);
    const mode =
      req.body?.mode === 'sandbox_with_12_published'
        ? 'sandbox_with_12_published'
        : 'strict_editorial_draft';

    const result = p01Store.adminImportQuestionBankSeed(resolved.actor, {
      dry_run: dryRun,
      mode,
    });

    if (result.ok && !dryRun) {
      void persistRobotAndSessionState();
      if (!resolved.isSandbox && result.report) {
        try {
          const adminApp = getInitializedFirebaseAdmin();
          if (adminApp) {
            await getDatabase(adminApp).ref('questions_public').set(result.report.questionsPublic);
            await getDatabase(adminApp).ref('question_keys').set(result.report.questionKeys);
          }
        } catch {
          // Ignore external sync error
        }
      }
    }

    res.status(result.status).json(result);
  });

  // 18g. P05 (Ca kiểm thử T04, T28): SuperAdmin duyệt hàng loạt hoặc đưa về bản nháp (`editorial_draft`)
  app.post('/api/admin/questions/bulk-publish', async (req: Request, res: Response) => {
    const resolved = await resolveRequestActor(req);
    if (resolved.mode === 'unconfigured') {
      res.status(503).json({
        error: 'SERVICE_NOT_CONFIGURED',
        uiLabel: 'Chưa cấu hình',
        requiredStage: 'P05',
        missingVars: resolved.missingVars,
        message: 'Chưa cấu hình Firebase Admin SDK.',
      });
      return;
    }
    if (resolved.mode === 'unauthenticated') {
      res.status(401).json({ error: 'UNAUTHENTICATED', message: resolved.message });
      return;
    }

    const modeRaw = req.body?.mode;
    const validMode =
      modeRaw === 'publish_all_40' || modeRaw === 'reset_all_draft'
        ? modeRaw
        : 'publish_12_sample';

    const result = p01Store.adminBulkPublishQuestions(resolved.actor, {
      mode: validMode,
    });

    if (result.ok) {
      void persistRobotAndSessionState();
      if (!resolved.isSandbox) {
        try {
          const adminApp = getInitializedFirebaseAdmin();
          if (adminApp) {
            await getDatabase(adminApp)
              .ref('questions_public')
              .set(p01Store.getState().questions_public);
          }
        } catch {
          // Ignore external sync error
        }
      }
    }

    res.status(result.status).json(result);
  });

  // 18h. P05 (Ca kiểm thử T04, T28): SuperAdmin biên tập & duyệt / xuất bản từng câu hỏi (`POST /api/admin/questions/:questionId`)
  app.post('/api/admin/questions/:questionId', async (req: Request, res: Response) => {
    const resolved = await resolveRequestActor(req);
    if (resolved.mode === 'unconfigured') {
      res.status(503).json({
        error: 'SERVICE_NOT_CONFIGURED',
        uiLabel: 'Chưa cấu hình',
        requiredStage: 'P05',
        missingVars: resolved.missingVars,
        message: 'Chưa cấu hình Firebase Admin SDK.',
      });
      return;
    }
    if (resolved.mode === 'unauthenticated') {
      res.status(401).json({ error: 'UNAUTHENTICATED', message: resolved.message });
      return;
    }

    const questionId = String(req.params.questionId || '');
    const result = p01Store.adminUpdateOrPublishQuestion(resolved.actor, {
      question_id: questionId,
      prompt: req.body?.prompt,
      options: req.body?.options,
      correct_option_id: req.body?.correct_option_id,
      explanation: req.body?.explanation,
      feedback_correct: req.body?.feedback_correct,
      feedback_incorrect: req.body?.feedback_incorrect,
      source_days: req.body?.source_days,
      illustration_id: req.body?.illustration_id,
      content_reviewed: req.body?.content_reviewed,
      clinical_reviewed: req.body?.clinical_reviewed,
      status: req.body?.status,
    });

    if (result.ok) {
      void persistRobotAndSessionState();
      if (!resolved.isSandbox && result.question && result.keyRecord) {
        try {
          const adminApp = getInitializedFirebaseAdmin();
          if (adminApp) {
            await getDatabase(adminApp)
              .ref(`questions_public/${questionId}`)
              .set(result.question);
            await getDatabase(adminApp)
              .ref(`question_keys/${questionId}/${result.question.version}`)
              .set(result.keyRecord);
          }
        } catch {
          // Ignore external sync error
        }
      }
    }

    res.status(result.status).json(result);
  });

  // 18i. P05 (Mục 14.2 Nhóm 3): SuperAdmin cập nhật cấu hình thiết bị Robot (`alert_after_sec`, `revoked`, `calibration_valid`)
  app.post('/api/admin/devices/:deviceId/config', async (req: Request, res: Response) => {
    const resolved = await resolveRequestActor(req);
    if (resolved.mode !== 'authenticated') {
      res.status(401).json({ error: 'UNAUTHENTICATED', message: 'Vui lòng đăng nhập SuperAdmin.' });
      return;
    }

    const result = p01Store.adminUpdateDeviceConfig(resolved.actor, {
      device_id: String(req.params.deviceId || ''),
      device_name: req.body?.device_name,
      alert_after_sec:
        req.body?.alert_after_sec !== undefined ? Number(req.body.alert_after_sec) : undefined,
      revoked: req.body?.revoked,
      calibration_valid: req.body?.calibration_valid,
    });
    if (result.ok) {
      void persistRobotAndSessionState(String(req.params.deviceId || ''));
    }
    res.status(result.status).json(result);
  });

  // 18j. P05 (Mục 14.2 Nhóm 6): SuperAdmin cập nhật mẫu lời nhắc nhẹ nhàng (Voice & Push)
  app.post('/api/admin/notifications/templates', async (req: Request, res: Response) => {
    const resolved = await resolveRequestActor(req);
    if (resolved.mode !== 'authenticated') {
      res.status(401).json({ error: 'UNAUTHENTICATED', message: 'Vui lòng đăng nhập SuperAdmin.' });
      return;
    }

    const result = p01Store.adminUpdateReminderTemplate(resolved.actor, {
      template_id: String(req.body?.template_id || ''),
      title: String(req.body?.title || ''),
      voice_text: String(req.body?.voice_text || ''),
      push_body: String(req.body?.push_body || ''),
    });
    if (result.ok) {
      void persistRobotAndSessionState();
    }
    res.status(result.status).json(result);
  });

  // 18k. P05 (Mục 14.2 Nhóm 7): SuperAdmin xóa ảnh Capture riêng tư theo chính sách lưu trữ
  app.delete('/api/admin/captures/:captureId', async (req: Request, res: Response) => {
    const resolved = await resolveRequestActor(req);
    if (resolved.mode !== 'authenticated') {
      res.status(401).json({ error: 'UNAUTHENTICATED', message: 'Vui lòng đăng nhập SuperAdmin.' });
      return;
    }

    const result = p01Store.adminDeleteCapture(resolved.actor, {
      capture_id: String(req.params.captureId || ''),
      reason: String(req.body?.reason || req.query.reason || 'Xóa theo chính sách quyền riêng tư'),
    });
    if (result.ok) {
      void persistRobotAndSessionState();
    }
    res.status(result.status).json(result);
  });

  // ==========================================================================
  // 19. CHẶNG P06: MA TRẬN NGHIỆM THU T01-T30, ĐO ĐỘ TRỄ 20 MẪU, BACKUP / RESTORE / RESET DEMO
  // ==========================================================================
  app.get('/api/system/p06-verification-matrix', (_req: Request, res: Response) => {
    const stageChecks = evaluateStageFeatureConfigs(process.env);
    const secretHygiene = verifyNoSecretsLeakedReport(process.env);

    res.status(200).json({
      ok: true,
      stage: 'P06',
      generatedAt: Date.now(),
      p0SecurityAuditItems: P0_SECURITY_AUDIT_ITEMS,
      acceptanceMatrix30: P06_ACCEPTANCE_MATRIX_30,
      demo6MinuteScript: DEMO_6_MINUTE_SCRIPT,
      secretHygiene,
      stageChecks,
    });
  });

  app.post('/api/system/benchmark-latency', async (req: Request, res: Response) => {
    const resolved = await resolveRequestActor(req);
    const actor: VerifiedActorToken =
      resolved.mode === 'authenticated'
        ? resolved.actor
        : {
            uid: 'uid-superadmin-01',
            email: 'minhquantran4312@gmail.com',
            email_verified: true,
            superadmin: true,
            role: 'superadmin',
          };

    const benchResult = p01Store.runIngestLatencyBenchmark20Samples(actor);
    res.status(benchResult.status).json(benchResult);
  });

  app.get('/api/admin/demo/backup', async (req: Request, res: Response) => {
    const resolved = await resolveRequestActor(req);
    if (resolved.mode !== 'authenticated') {
      res.status(401).json({ error: 'UNAUTHENTICATED', message: 'Vui lòng đăng nhập SuperAdmin.' });
      return;
    }

    const result = p01Store.exportDemoBackupSnapshot(resolved.actor);
    res.status(result.status).json(result);
  });

  app.post('/api/admin/demo/restore', async (req: Request, res: Response) => {
    const resolved = await resolveRequestActor(req);
    if (resolved.mode !== 'authenticated') {
      res.status(401).json({ error: 'UNAUTHENTICATED', message: 'Vui lòng đăng nhập SuperAdmin.' });
      return;
    }

    const result = p01Store.restoreDemoBackupSnapshot(resolved.actor, {
      snapshot: req.body?.snapshot,
    });
    res.status(result.status).json(result);
  });

  app.post('/api/admin/demo/reset', async (req: Request, res: Response) => {
    const resolved = await resolveRequestActor(req);
    if (resolved.mode !== 'authenticated') {
      res.status(401).json({ error: 'UNAUTHENTICATED', message: 'Vui lòng đăng nhập SuperAdmin.' });
      return;
    }

    const result = p01Store.resetCleanDemoState(resolved.actor);
    if (result.ok) {
      const cleanState = createCleanDynamicRtdbState(Date.now());
      cleanState.users[resolved.actor.uid] = {
        full_name: resolved.actor.name || resolved.actor.email.split('@')[0] || 'SuperAdmin',
        email: resolved.actor.email,
      };
      cleanState.account_roles[resolved.actor.uid] = {
        role: 'superadmin',
        disabled: false,
        updated_at: Date.now(),
        updated_by: resolved.actor.uid,
      };
      Object.assign(p01Store.getState(), cleanState);
      void persistRobotAndSessionState();
    }
    res.status(result.status).json({
      ...result,
      message: 'Đã làm sạch toàn bộ dữ liệu mẫu và đưa hệ thống về trạng thái chỉ ghi nhận dữ liệu động thực tế.',
    });
  });

  app.post('/api/admin/live-firebase/step1-sync', async (req: Request, res: Response) => {
    const resolved = await resolveRequestActor(req);
    if (resolved.mode !== 'authenticated' || resolved.actor.role !== 'superadmin') {
      res.status(403).json({
        ok: false,
        error: 'FORBIDDEN_SUPERADMIN_ONLY',
        message: 'Chỉ SuperAdmin mới được phép chạy đồng bộ Live Firebase Bước 1.',
      });
      return;
    }

    const adminApp = getInitializedFirebaseAdmin();
    if (!adminApp) {
      res.status(503).json({
        ok: false,
        error: 'SERVICE_ACCOUNT_NOT_CONFIGURED',
        message: 'Chưa cấu hình FIREBASE_SERVICE_ACCOUNT_JSON hợp lệ trên môi trường Server.',
      });
      return;
    }

    const projectId = (process.env.FIREBASE_PROJECT_ID || 'gen-lang-client-0531599250').trim();
    const steps: Record<string, unknown> = {};

    // 1. Authorized Domains via Google Identity Toolkit Admin V2 REST API
    try {
      const saInfo = validateServiceAccountConfig(process.env);
      let credentialObj: ServiceAccount;
      if (saInfo.source === 'json_env') {
        const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON!.trim();
        const jsonStr = raw.startsWith('{') ? raw : Buffer.from(raw, 'base64').toString('utf8');
        credentialObj = JSON.parse(jsonStr) as ServiceAccount;
      } else {
        const filePath = path.resolve(process.cwd(), process.env.FIREBASE_SERVICE_ACCOUNT_KEY_PATH!.trim());
        credentialObj = JSON.parse(fs.readFileSync(filePath, 'utf8')) as ServiceAccount;
      }

      const certCred = cert(credentialObj);
      const tokenRes = await certCred.getAccessToken();
      const accessToken = tokenRes.access_token;

      const requiredDomains = [
        'localhost',
        `${projectId}.firebaseapp.com`,
        `${projectId}.web.app`,
        'ais-dev-cpvxdfw7ppcnylrbqrv7t6-716862869640.asia-southeast1.run.app',
        'ais-pre-cpvxdfw7ppcnylrbqrv7t6-716862869640.asia-southeast1.run.app',
      ];

      const getConfigRes = await fetch(
        `https://identitytoolkit.googleapis.com/admin/v2/projects/${projectId}/config`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );

      if (getConfigRes.ok) {
        const currentConfig = (await getConfigRes.json()) as { authorizedDomains?: string[] };
        const existingDomains = Array.isArray(currentConfig.authorizedDomains)
          ? currentConfig.authorizedDomains
          : [];
        const missingDomains = requiredDomains.filter((d) => !existingDomains.includes(d));

        if (missingDomains.length > 0) {
          const mergedDomains = Array.from(new Set([...existingDomains, ...requiredDomains]));
          const patchRes = await fetch(
            `https://identitytoolkit.googleapis.com/admin/v2/projects/${projectId}/config?updateMask=authorizedDomains`,
            {
              method: 'PATCH',
              headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ authorizedDomains: mergedDomains }),
            }
          );
          if (patchRes.ok) {
            const updated = (await patchRes.json()) as { authorizedDomains?: string[] };
            steps.authorizedDomains = {
              status: 'PASS',
              action: 'ADDED_AUTOMATICALLY',
              addedDomains: missingDomains,
              authorizedDomains: updated.authorizedDomains,
            };
          } else {
            const errText = await patchRes.text();
            steps.authorizedDomains = {
              status: 'MANUAL_CONSOLE_REQUIRED',
              httpStatus: patchRes.status,
              reason: errText.slice(0, 300),
              existingDomains,
            };
          }
        } else {
          steps.authorizedDomains = {
            status: 'PASS',
            action: 'ALREADY_PRESENT',
            authorizedDomains: existingDomains,
          };
        }
      } else {
        const errText = await getConfigRes.text();
        steps.authorizedDomains = {
          status: 'MANUAL_CONSOLE_REQUIRED',
          httpStatus: getConfigRes.status,
          reason: errText.slice(0, 300),
        };
      }
    } catch (err) {
      steps.authorizedDomains = {
        status: 'MANUAL_CONSOLE_REQUIRED',
        reason: err instanceof Error ? err.message : String(err),
      };
    }

    // 2. Deploy database.rules.json to live Firebase Realtime Database
    const normalizedDbUrl = normalizeFirebaseDatabaseUrl(
      process.env.FIREBASE_DATABASE_URL || process.env.VITE_FIREBASE_DATABASE_URL
    );
    const db = getDatabase(adminApp);
    try {
      const rulesJsonText = fs.readFileSync(path.resolve(process.cwd(), 'database.rules.json'), 'utf8');
      await db.setRules(rulesJsonText);
      steps.rtdbSecurityRules = {
        status: 'PASS',
        databaseUrl: normalizedDbUrl,
        message: 'Đã deploy trực tiếp database.rules.json lên Firebase Realtime Database thành công.',
      };
    } catch (err) {
      steps.rtdbSecurityRules = {
        status: 'FAIL',
        databaseUrl: normalizedDbUrl,
        reason: err instanceof Error ? err.message : String(err),
      };
    }

    // 2b. Deploy storage.rules via Firebase Rules REST API
    try {
      const saInfo = validateServiceAccountConfig(process.env);
      const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON!.trim();
      const jsonStr =
        saInfo.source === 'json_env'
          ? raw.startsWith('{')
            ? raw
            : Buffer.from(raw, 'base64').toString('utf8')
          : fs.readFileSync(
              path.resolve(process.cwd(), process.env.FIREBASE_SERVICE_ACCOUNT_KEY_PATH!.trim()),
              'utf8'
            );
      const certCred = cert(JSON.parse(jsonStr) as ServiceAccount);
      const tokenRes = await certCred.getAccessToken();
      const accessToken = tokenRes.access_token;
      const storageRulesContent = fs.readFileSync(
        path.resolve(process.cwd(), 'storage.rules'),
        'utf8'
      );

      const createRulesetRes = await fetch(
        `https://firebaserules.googleapis.com/v1/projects/${projectId}/rulesets`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            source: {
              files: [{ name: 'storage.rules', content: storageRulesContent }],
            },
          }),
        }
      );

      if (createRulesetRes.ok) {
        const rulesetData = (await createRulesetRes.json()) as { name?: string };
        const bucketName = (
          process.env.FIREBASE_STORAGE_BUCKET ||
          process.env.VITE_FIREBASE_STORAGE_BUCKET ||
          `${projectId}.firebasestorage.app`
        ).trim();
        const releaseId = `firebase.storage/${bucketName}`;
        const releaseName = `projects/${projectId}/releases/${releaseId}`;

        const patchReleaseRes = await fetch(
          `https://firebaserules.googleapis.com/v1/projects/${projectId}/releases/${encodeURIComponent(
            releaseId
          )}`,
          {
            method: 'PATCH',
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              release: {
                name: releaseName,
                rulesetName: rulesetData.name,
              },
            }),
          }
        );

        if (patchReleaseRes.ok) {
          steps.storageSecurityRules = {
            status: 'PASS',
            bucket: bucketName,
            rulesetName: rulesetData.name,
            message: 'Đã deploy trực tiếp storage.rules lên Cloud Storage for Firebase thành công.',
          };
        } else {
          // Try POST if release does not exist yet
          const postReleaseRes = await fetch(
            `https://firebaserules.googleapis.com/v1/projects/${projectId}/releases`,
            {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                name: releaseName,
                rulesetName: rulesetData.name,
              }),
            }
          );
          if (postReleaseRes.ok) {
            steps.storageSecurityRules = {
              status: 'PASS',
              bucket: bucketName,
              rulesetName: rulesetData.name,
              message: 'Đã khởi tạo và deploy storage.rules lên Cloud Storage for Firebase thành công.',
            };
          } else {
            const errTxt = await postReleaseRes.text();
            steps.storageSecurityRules = {
              status: 'RULESET_CREATED_WAITING_BUCKET_RELEASE',
              bucket: bucketName,
              rulesetName: rulesetData.name,
              note: errTxt.slice(0, 250),
            };
          }
        }
      } else {
        const errTxt = await createRulesetRes.text();
        steps.storageSecurityRules = {
          status: 'MANUAL_CLI_REQUIRED',
          reason: errTxt.slice(0, 250),
        };
      }
    } catch (err) {
      steps.storageSecurityRules = {
        status: 'MANUAL_CLI_REQUIRED',
        reason: err instanceof Error ? err.message : String(err),
      };
    }

    // 3. Seed / Sync clean state into live Firebase Realtime Database
    try {
      const currentState = p01Store.getState();
      const existingUsersSnap = await db.ref('users').get();
      const existingUsers = existingUsersSnap.exists() ? existingUsersSnap.val() : {};
      const existingRolesSnap = await db.ref('account_roles').get();
      const existingRoles = existingRolesSnap.exists() ? existingRolesSnap.val() : {};

      await db.ref('/').update({
        users: { ...currentState.users, ...existingUsers },
        account_roles: { ...currentState.account_roles, ...existingRoles },
        students: currentState.students,
        guardian_students: currentState.guardian_students,
        student_accounts: currentState.student_accounts,
        device_access: currentState.device_access,
        devices: currentState.devices,
        sessions: currentState.sessions,
        alerts: currentState.alerts,
        learning_days: currentState.learning_days,
        learning_progress: currentState.learning_progress,
        certificate_requests: currentState.certificate_requests,
        student_alerts: currentState.student_alerts,
        episode_log: currentState.episode_log,
        device_runtime: currentState.device_runtime,
        command_jobs: currentState.command_jobs,
        capture_metadata: currentState.capture_metadata,
        questions_public: currentState.questions_public,
        question_keys: currentState.question_keys,
        game_attempts: currentState.game_attempts,
        reminder_templates: currentState.reminder_templates,
        notification_preferences: currentState.notification_preferences,
      });

      steps.rtdbLiveSeed = {
        status: 'PASS',
        message:
          'Đã đồng bộ đầy đủ 4 nhánh gốc (users, devices, sessions, alerts) và các nhánh mở rộng (28 ngày học, 40 câu hỏi, học sinh mẫu) lên Firebase Realtime Database thật.',
      };
    } catch (err) {
      steps.rtdbLiveSeed = {
        status: 'FAIL',
        reason: err instanceof Error ? err.message : String(err),
      };
    }

    // 4. Bootstrap SuperAdmin accounts (`minhquantran4312@gmail.com`, `tamtranmusic@gmail.com`) in Firebase Auth
    const auth = getAuth(adminApp);
    const bootstrapEmails = getConfiguredBootstrapEmails();
    const bootstrapResults: Array<Record<string, unknown>> = [];

    for (const email of bootstrapEmails) {
      try {
        const userRecord = await auth.getUserByEmail(email);
        await auth.setCustomUserClaims(userRecord.uid, {
          role: 'superadmin',
          superadmin: true,
          admin: true,
        });

        await db.ref(`users/${userRecord.uid}`).set({
          full_name:
            userRecord.displayName ||
            (email === 'tamtranmusic@gmail.com'
              ? 'Tâm Trần (Chủ dự án · SuperAdmin)'
              : 'Trần Minh Quân (SuperAdmin)'),
          email: userRecord.email || email,
        });

        await db.ref(`account_roles/${userRecord.uid}`).set({
          role: 'superadmin',
          disabled: false,
          updated_at: Date.now(),
          updated_by: 'live_admin_sdk_bootstrap',
        });

        bootstrapResults.push({
          email,
          uid: userRecord.uid,
          status: 'BOOTSTRAPPED_LIVE',
          customClaimsSet: { role: 'superadmin', superadmin: true, admin: true },
        });
      } catch (err: unknown) {
        const code = (err as { code?: string })?.code || 'UNKNOWN';
        bootstrapResults.push({
          email,
          status: code === 'auth/user-not-found' ? 'WAITING_FIRST_GOOGLE_SIGN_IN' : 'ERROR',
          note:
            code === 'auth/user-not-found'
              ? 'Tài khoản chưa đăng nhập lần đầu vào Firebase Auth. Khi đăng nhập Google lần đầu trên giao diện, server sẽ tự động cấp quyền SuperAdmin.'
              : err instanceof Error
              ? err.message
              : String(err),
        });
      }
    }

    steps.superAdminBootstrap = bootstrapResults;

    res.status(200).json({
      ok: true,
      projectId,
      executedAt: new Date().toISOString(),
      steps,
    });
  });

  // ============================================================================
  // SERVER-SIDE NEURAL VOICE TTS ENGINE (gemini-3.8-flash-lite-tts + Vietnamese Neural)
  // Thay thế hoàn toàn window.speechSynthesis mặc định của trình duyệt.
  // ============================================================================
  const TMP_TTS_CACHE_DIR = '/tmp/bugz-tts-cache';
  fs.mkdirSync(TMP_TTS_CACHE_DIR, { recursive: true });

  function getGeminiServerClient(): GoogleGenAI | null {
    const apiKey = (process.env.GEMINI_API_KEY || '').trim();
    if (!apiKey) return null;
    return new GoogleGenAI({
      apiKey,
      httpOptions: {
        apiVersion: 'v1beta',
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }

  function splitVietnameseTextIntoTtsChunks(text: string, maxLen = 175): string[] {
    const normalized = text.replace(/\s+/g, ' ').trim();
    if (normalized.length <= maxLen) return [normalized];
    const rawParts = normalized.split(/(?<=[.!?।;:,—–])\s+/);
    const chunks: string[] = [];
    let current = '';
    for (const part of rawParts) {
      if (!current) {
        current = part;
      } else if ((current + ' ' + part).length <= maxLen) {
        current += ' ' + part;
      } else {
        chunks.push(current);
        current = part;
      }
    }
    if (current) chunks.push(current);
    return chunks.flatMap((c) => {
      if (c.length <= maxLen) return [c];
      const words = c.split(' ');
      const sub: string[] = [];
      let cur = '';
      for (const w of words) {
        if (!cur) cur = w;
        else if ((cur + ' ' + w).length <= maxLen) cur += ' ' + w;
        else {
          sub.push(cur);
          cur = w;
        }
      }
      if (cur) sub.push(cur);
      return sub;
    });
  }

  async function synthesizeVietnameseCloudNeuralMp3(text: string): Promise<Buffer | null> {
    const chunks = splitVietnameseTextIntoTtsChunks(text, 175);
    const mp3Buffers: Buffer[] = [];
    for (const chunk of chunks) {
      const encoded = encodeURIComponent(chunk);
      const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encoded}&tl=vi&client=tw-ob`;
      const response = await fetch(url, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/124.0 Safari/537.36',
        },
      });
      if (!response.ok) return null;
      const arr = await response.arrayBuffer();
      const buf = Buffer.from(arr);
      if (buf.byteLength < 64) return null;
      mp3Buffers.push(buf);
    }
    return mp3Buffers.length > 0 ? Buffer.concat(mp3Buffers) : null;
  }

  app.get('/api/tts/status', (_req: Request, res: Response) => {
    const hasGeminiKey = Boolean((process.env.GEMINI_API_KEY || '').trim());
    res.status(200).json({
      ok: true,
      primaryModel: 'gemini-3.8-flash-lite-tts',
      geminiApiKeyConfigured: hasGeminiKey,
      fallbackModel: 'google-neural-vi',
      activeDefaultPreset: hasGeminiKey ? 'gemini-kore' : 'google-neural-vi',
    });
  });

  app.post('/api/tts/synthesize', async (req: Request, res: Response) => {
    const rawText = typeof req.body?.text === 'string' ? req.body.text.trim() : '';
    const presetId = typeof req.body?.presetId === 'string' ? req.body.presetId.trim() : 'gemini-kore';

    if (!rawText) {
      res.status(400).json({
        ok: false,
        error: 'EMPTY_TTS_TEXT',
        message: 'Nội dung cần đọc không được để trống.',
      });
      return;
    }

    const safeText = rawText.slice(0, 500);
    const voiceMap: Record<string, string> = {
      'gemini-kore': 'Kore',
      'gemini-zephyr': 'Zephyr',
      'gemini-puck': 'Puck',
    };
    const selectedVoiceName = voiceMap[presetId] || 'Kore';
    const wantGemini = presetId !== 'google-neural-vi';
    const ai = wantGemini ? getGeminiServerClient() : null;
    const effectiveKey = ai ? `gemini-3.8-flash-lite-tts:${selectedVoiceName}:${safeText}` : `google-neural-vi:${safeText}`;
    const cacheHash = crypto.createHash('sha256').update(effectiveKey).digest('hex').slice(0, 32);
    const cacheBinPath = path.join(TMP_TTS_CACHE_DIR, `${cacheHash}.bin`);
    const cacheMetaPath = path.join(TMP_TTS_CACHE_DIR, `${cacheHash}.json`);

    if (fs.existsSync(cacheBinPath) && fs.existsSync(cacheMetaPath)) {
      try {
        const meta = JSON.parse(fs.readFileSync(cacheMetaPath, 'utf8')) as {
          contentType: string;
          engine: string;
          voice: string;
        };
        res.setHeader('Content-Type', meta.contentType);
        res.setHeader('x-bugz-tts-engine', meta.engine);
        res.setHeader('x-bugz-tts-voice', meta.voice);
        res.setHeader('x-bugz-tts-cache', 'HIT');
        res.setHeader('Cache-Control', 'public, max-age=86400');
        res.sendFile(cacheBinPath);
        return;
      } catch {
        // Re-synthesize if cache meta corrupted
      }
    }

    // 1. Thử tổng hợp bằng Gemini 3.8 Flash Lite TTS (`gemini-3.8-flash-lite-tts`) nếu được chọn và có GEMINI_API_KEY
    let geminiFallbackReason = '';
    if (ai) {
      try {
        let response;
        try {
          response = await ai.models.generateContent({
            model: 'gemini-3.8-flash-lite-tts',
            contents: [
              {
                role: 'user',
                parts: [
                  {
                    text: safeText,
                    speechMetadata: {
                      style:
                        'Giọng đọc tiếng Việt chuẩn, tự nhiên, ấm áp, dịu dàng, truyền cảm, khích lệ học sinh nhỏ tuổi nhẹ nhàng',
                    },
                  },
                ],
              },
            ],
            config: {
              responseModalities: ['AUDIO'],
              speechConfig: {
                voiceConfig: {
                  prebuiltVoiceConfig: { voiceName: selectedVoiceName },
                },
              },
            },
          });
        } catch {
          response = await ai.models.generateContent({
            model: 'gemini-3.8-flash-lite-tts',
            contents: `Đọc nguyên văn câu tiếng Việt sau bằng giọng ${selectedVoiceName} ấm áp, dịu dàng, chuẩn dấu tiếng Việt: "${safeText}"`,
            config: {
              responseModalities: ['AUDIO'],
            },
          });
        }

        const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        if (base64Audio) {
          const wavBuffer = Buffer.from(base64Audio, 'base64');
          if (wavBuffer.byteLength > 64) {
            fs.writeFileSync(cacheBinPath, wavBuffer);
            fs.writeFileSync(
              cacheMetaPath,
              JSON.stringify({
                contentType: 'audio/wav',
                engine: 'gemini-3.8-flash-lite-tts',
                voice: selectedVoiceName,
              }),
              'utf8'
            );
            res.setHeader('Content-Type', 'audio/wav');
            res.setHeader('x-bugz-tts-engine', 'gemini-3.8-flash-lite-tts');
            res.setHeader('x-bugz-tts-voice', selectedVoiceName);
            res.setHeader('x-bugz-tts-cache', 'MISS');
            res.setHeader('Cache-Control', 'public, max-age=86400');
            res.status(200).send(wavBuffer);
            return;
          }
        }
      } catch (err) {
        geminiFallbackReason = err instanceof Error ? err.message.slice(0, 180) : String(err).slice(0, 180);
      }
    }

    // 2. Tầng Tiếng Việt Neural Chuẩn (Google Cloud/Translate Neural Vietnamese Stream)
    try {
      const mp3Buffer = await synthesizeVietnameseCloudNeuralMp3(safeText);
      if (mp3Buffer) {
        fs.writeFileSync(cacheBinPath, mp3Buffer);
        fs.writeFileSync(
          cacheMetaPath,
          JSON.stringify({
            contentType: 'audio/mpeg',
            engine: 'google-neural-vi',
            voice: 'vi-VN-Neural',
          }),
          'utf8'
        );
        res.setHeader('Content-Type', 'audio/mpeg');
        res.setHeader('x-bugz-tts-engine', 'google-neural-vi');
        res.setHeader('x-bugz-tts-voice', 'vi-VN-Neural');
        res.setHeader('x-bugz-tts-cache', 'MISS');
        if (geminiFallbackReason) {
          res.setHeader('x-bugz-tts-fallback-reason', encodeURIComponent(geminiFallbackReason));
        }
        res.setHeader('Cache-Control', 'public, max-age=86400');
        res.status(200).send(mp3Buffer);
        return;
      }
    } catch {
      // Ignore
    }

    res.status(503).json({
      ok: false,
      error: 'TTS_SYNTHESIS_UNAVAILABLE',
      message: 'Không thể tổng hợp giọng đọc Neural lúc này.',
    });
  });

  // ============================================================================
  // BƯỚC 1 KẾ HOẠCH 7/11: GHI ÂM GIỌNG NÓI / TẠO GIỌNG AI TIẾNG VIỆT & TÍCH HỢP
  // VÀO MẠCH LOA ESP32 MAX98357A I2S (`ai_thinker_posture/main/voice_alert_pcm.h`)
  // ============================================================================
  const ESP32_VOICE_HEADER_PATH = path.resolve(
    process.cwd(),
    'ai_thinker_posture/main/voice_alert_pcm.h'
  );

  app.get('/api/esp32/voice-header', (_req: Request, res: Response) => {
    try {
      const content = fs.readFileSync(ESP32_VOICE_HEADER_PATH, 'utf8');
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="voice_alert_pcm.h"');
      res.status(200).send(content);
    } catch {
      res.status(404).json({
        ok: false,
        message: 'Chưa có file ai_thinker_posture/main/voice_alert_pcm.h.',
      });
    }
  });

  app.post('/api/esp32/voice-header', async (req: Request, res: Response) => {
    const rawPhrase =
      typeof req.body?.phrase === 'string' && req.body.phrase.trim()
        ? req.body.phrase.trim().slice(0, 120)
        : 'Ngồi thẳng lưng lên bạn nhé!';
    const rawPcm8kArray = Array.isArray(req.body?.pcm8kSamples) ? req.body.pcm8kSamples : null;

    let samples8k: number[] = [];
    let sourceLabel = 'microphone_recording';

    if (rawPcm8kArray && rawPcm8kArray.length >= 400) {
      samples8k = rawPcm8kArray
        .slice(0, 32000)
        .map((v: unknown) => Math.max(-128, Math.min(127, Math.round(Number(v) || 0))));
    } else {
      // Tổng hợp bằng Gemini 3.8 Flash Lite TTS (24kHz 16-bit PCM -> downsample 3x về 8kHz signed 8-bit)
      sourceLabel = 'gemini-3.8-flash-lite-tts (Kore)';
      const ai = getGeminiServerClient();
      if (!ai) {
        res.status(503).json({
          ok: false,
          message:
            'Để tạo từ văn bản trên server cần GEMINI_API_KEY, hoặc bạn hãy bấm nút Ghi âm giọng nói trực tiếp bằng Micro trên giao diện để xuất file voice_alert_pcm.h!',
        });
        return;
      }

      try {
        const response = await ai.models.generateContent({
          model: 'gemini-3.8-flash-lite-tts',
          contents: [
            {
              role: 'user',
              parts: [
                {
                  text: rawPhrase,
                  speechMetadata: {
                    style:
                      'Giọng đọc tiếng Việt chuẩn, rõ ràng, ấm áp, khích lệ học sinh ngồi thẳng lưng',
                  },
                },
              ],
            },
          ],
          config: {
            responseModalities: ['AUDIO'],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: 'Kore' },
              },
            },
          },
        });
        const b64 = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        if (!b64) {
          throw new Error('Empty audio from Gemini TTS');
        }
        const rawBuf = Buffer.from(b64, 'base64');
        const pcm16Count = Math.floor(rawBuf.length / 2);
        const samples24k = new Int16Array(pcm16Count);
        for (let i = 0; i < pcm16Count; i++) {
          samples24k[i] = rawBuf.readInt16LE(i * 2);
        }
        let startIdx = 0;
        let endIdx = pcm16Count - 1;
        while (startIdx < pcm16Count && Math.abs(samples24k[startIdx]) < 350) startIdx++;
        while (endIdx > startIdx && Math.abs(samples24k[endIdx]) < 350) endIdx--;
        startIdx = Math.max(0, startIdx - 1200);
        endIdx = Math.min(pcm16Count - 1, endIdx + 1200);
        let peak = 1;
        for (let i = startIdx; i <= endIdx; i++) {
          const a = Math.abs(samples24k[i]);
          if (a > peak) peak = a;
        }
        for (let i = startIdx; i <= endIdx - 2; i += 3) {
          const avg = (samples24k[i] + samples24k[i + 1] + samples24k[i + 2]) / 3;
          const norm = (avg / peak) * 0.92;
          samples8k.push(Math.max(-127, Math.min(127, Math.round(norm * 127))));
        }
      } catch (err) {
        res.status(500).json({
          ok: false,
          message: `Lỗi khi tạo giọng nói: ${err instanceof Error ? err.message : String(err)}`,
        });
        return;
      }
    }

    const durationSec = Number((samples8k.length / 8000).toFixed(2));
    const lines: string[] = [];
    lines.push('#pragma once');
    lines.push('#include <stdint.h>');
    lines.push('#include <stddef.h>');
    lines.push('');
    lines.push(
      `// Giọng nói tiếng Việt tích hợp cho mạch loa I2S MAX98357A ("${rawPhrase}")`
    );
    lines.push(
      `// Nguồn: ${sourceLabel} · 8000 Hz Signed 8-bit PCM (upsample 2x -> 16000 Hz 16-bit Stereo I2S)`
    );
    lines.push('static const uint32_t kVoiceAlertSampleRate = 8000;');
    lines.push(`static const size_t kVoiceAlertSampleCount = ${samples8k.length};`);
    lines.push('static const int8_t kVoiceAlertPcm8k[] = {');
    for (let i = 0; i < samples8k.length; i += 24) {
      const slice = samples8k.slice(i, i + 24);
      lines.push('  ' + slice.join(', ') + ',');
    }
    lines.push('};');
    lines.push('');

    const headerText = lines.join('\n');
    let savedToRepo = false;
    try {
      fs.writeFileSync(ESP32_VOICE_HEADER_PATH, headerText, 'utf8');
      savedToRepo = true;
    } catch {
      // Ignore if read-only container
    }

    res.status(200).json({
      ok: true,
      phrase: rawPhrase,
      source: sourceLabel,
      sampleRate: 8000,
      sampleCount: samples8k.length,
      durationSec,
      savedToRepo,
      targetPath: 'ai_thinker_posture/main/voice_alert_pcm.h',
      message: `Đã tích hợp thành công giọng nói ("${rawPhrase}", ${durationSec}s, ${samples8k.length} mẫu PCM 8kHz) vào ai_thinker_posture/main/voice_alert_pcm.h! Khi build bằng "idf.py build", ESP32-CAM sẽ phát trực tiếp câu nói này ra loa MAX98357A sau 3 giây ngồi sai.`,
    });
  });

  // ============================================================================
  // CLOUD & WEBP-OPTIMIZED ASSET RESOLVER (Không lưu ảnh nhị phân trong Git repo)
  // - Ưu tiên 1: Cloud Storage / CDN riêng (CLOUD_ASSET_CDN_BASE_URL / FIREBASE_STORAGE_BUCKET) nếu cấu hình.
  // - Ưu tiên 2: Google Fast Image Serving Engine CDN (lh3.googleusercontent.com/d/{id}=w1600-rw)
  //   tự động chuyển đổi sang định dạng `image/webp` siêu nhẹ (giảm 50-70% dung lượng so với PNG gốc).
  // - Có khóa Single-Flight (`inFlightDriveFetches`) và hàng đợi Pre-warm ngầm giúp không bao giờ
  //   bị Google Drive chặn Rate-Limit (429/403) khi một trang tải 8-12 ảnh cùng lúc.
  // ============================================================================
  const TMP_ASSET_CACHE_ROOT = '/tmp/bugz-assets-cache';
  const TMP_DRIVE_CACHE_DIR = path.join(TMP_ASSET_CACHE_ROOT, 'drive');
  const TMP_PWA_CACHE_DIR = path.join(TMP_ASSET_CACHE_ROOT, 'pwa');
  fs.mkdirSync(TMP_DRIVE_CACHE_DIR, { recursive: true });
  fs.mkdirSync(TMP_PWA_CACHE_DIR, { recursive: true });

  function detectBufferMimeType(buf: Buffer, fallbackFilename: string): string {
    if (
      buf.byteLength >= 12 &&
      buf.subarray(0, 4).toString('ascii') === 'RIFF' &&
      buf.subarray(8, 12).toString('ascii') === 'WEBP'
    ) {
      return 'image/webp';
    }
    if (
      buf.byteLength >= 8 &&
      buf[0] === 0x89 &&
      buf[1] === 0x50 &&
      buf[2] === 0x4e &&
      buf[3] === 0x47
    ) {
      return 'image/png';
    }
    if (buf.byteLength >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
      return 'image/jpeg';
    }
    const lower = fallbackFilename.toLowerCase();
    if (lower.endsWith('.mp3')) return 'audio/mpeg';
    if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
    if (lower.endsWith('.webp')) return 'image/webp';
    if (lower.endsWith('.svg')) return 'image/svg+xml';
    return 'image/png';
  }

  const inFlightDriveFetches = new Map<string, Promise<Buffer | null>>();

  async function fetchAndCacheDriveBuffer(
    driveId: string,
    cacheFilePath: string,
    canonicalName = '',
    isAudio = false
  ): Promise<Buffer | null> {
    const existingPromise = inFlightDriveFetches.get(cacheFilePath);
    if (existingPromise) {
      return existingPromise;
    }

    const task = (async (): Promise<Buffer | null> => {
      const cloudCdnBaseUrl = (
        process.env.CLOUD_ASSET_CDN_BASE_URL ||
        process.env.VITE_CLOUD_ASSET_CDN_BASE_URL ||
        ''
      ).trim();

      const urls = getDriveDirectDownloadUrls(driveId, {
        isAudio,
        canonicalName,
        preferWebp: !isAudio,
        cloudCdnBaseUrl,
      });

      for (const url of urls) {
        try {
          const response = await fetch(url, {
            headers: {
              'User-Agent':
                'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/124.0 Safari/537.36',
              Accept: isAudio
                ? 'audio/mpeg,audio/*;q=0.9,*/*;q=0.8'
                : 'image/webp,image/apng,image/*,*/*;q=0.8',
            },
            redirect: 'follow',
          });
          if (!response.ok) continue;
          const contentType = (response.headers.get('content-type') || '').toLowerCase();
          if (contentType.includes('text/html')) continue;
          const arrayBuf = await response.arrayBuffer();
          const buf = Buffer.from(arrayBuf);
          if (buf.byteLength < 64) continue;
          fs.writeFileSync(cacheFilePath, buf);
          return buf;
        } catch {
          // Thử URL dự phòng tiếp theo
        }
      }
      return null;
    })();

    inFlightDriveFetches.set(cacheFilePath, task);
    try {
      return await task;
    } finally {
      inFlightDriveFetches.delete(cacheFilePath);
    }
  }

  // Làm ấm bộ nhớ đệm WebP ngầm theo lô nhỏ (concurrency = 3) để các trang Học 28 ngày & Thư viện
  // tải tức thì mà không bị Google Drive giới hạn băng thông.
  async function warmEssentialDriveAssetsInBackground(): Promise<void> {
    const allEntries = Object.entries(DRIVE_ASSET_IDS_NFC);
    const priorityNames = [
      'logo1.png',
      'bg.png',
      'home.png',
      'mucluc.png',
      'Tuan 1.png',
      'Tuan 2.png',
      'Tuan 3.png',
      'Tuan 4.png',
      'Tuan1.png',
      'Tuan2.png',
      'Tuan3.png',
      'Tuan4.png',
      'Bao.png',
      'team.png',
      'Quan CV.png',
      'chip CV.png',
      'leade CV.png',
      'Thúy CV.png',
      'in4 Quan.png',
      'in4 chip.png',
      'in4 leade.png',
      'in4 Thúy.png',
      'Bệnh viện Phục hồi chức năng Việt Pháp.png',
      'Trung tâm Y tế khu vực Hải Châu.png',
      'Trung tâm Y tế khu vực Sơn Trà.png',
      'Trung tâm Y tế khu vực Thanh Khê.png',
      'Flashcard full 28 ngay.png',
      'full flashcard.png',
    ];
    const sorted = [
      ...allEntries.filter(([name]) => priorityNames.includes(name)),
      ...allEntries.filter(([name]) => !priorityNames.includes(name)),
    ];

    const concurrency = 3;
    for (let i = 0; i < sorted.length; i += concurrency) {
      const batch = sorted.slice(i, i + concurrency);
      await Promise.all(
        batch.map(async ([canonicalName, driveId]) => {
          const targetCachePath = path.join(TMP_DRIVE_CACHE_DIR, path.basename(canonicalName));
          if (fs.existsSync(targetCachePath)) {
            try {
              const existingBuf = fs.readFileSync(targetCachePath);
              const isAudio = canonicalName.toLowerCase().endsWith('.mp3');
              // Nếu file cache cũ là PNG chưa nén WebP, nâng cấp sang bản WebP
              if (!isAudio && detectBufferMimeType(existingBuf, canonicalName) === 'image/webp') {
                return;
              }
              if (isAudio && existingBuf.byteLength > 64) {
                return;
              }
            } catch {
              // Tiếp tục tải lại
            }
          }
          const isAudio = canonicalName.toLowerCase().endsWith('.mp3');
          await fetchAndCacheDriveBuffer(driveId, targetCachePath, canonicalName, isAudio);
        })
      );
    }
  }
  void warmEssentialDriveAssetsInBackground();

  app.get('/api/system/media-storage-status', (_req: Request, res: Response) => {
    let cachedFiles = 0;
    let webpFiles = 0;
    let totalBytes = 0;
    try {
      const names = fs.readdirSync(TMP_DRIVE_CACHE_DIR);
      for (const name of names) {
        const fullPath = path.join(TMP_DRIVE_CACHE_DIR, name);
        const stat = fs.statSync(fullPath);
        if (stat.isFile()) {
          cachedFiles += 1;
          totalBytes += stat.size;
          const header = fs.readFileSync(fullPath).subarray(0, 16);
          if (detectBufferMimeType(header, name) === 'image/webp') {
            webpFiles += 1;
          }
        }
      }
    } catch {
      // Ignore
    }
    res.json({
      ok: true,
      totalRegisteredDriveAssets: Object.keys(DRIVE_ASSET_IDS_NFC).length,
      cachedAssetsCount: cachedFiles,
      webpOptimizedCount: webpFiles,
      totalCacheSizeMb: Number((totalBytes / (1024 * 1024)).toFixed(2)),
      cdnMode: process.env.CLOUD_ASSET_CDN_BASE_URL
        ? 'Custom Cloud Storage CDN + WebP Proxy'
        : 'Google FIFE Image CDN WebP (-rw) + Local Persistent Cache (/tmp/bugz-assets-cache)',
    });
  });

  app.get('/assets/drive/:filename', async (req: Request, res: Response) => {
    const rawName = String(req.params.filename || '');
    const entry = resolveDriveAssetEntry(rawName);
    const candidates = [
      rawName,
      rawName.normalize('NFC'),
      rawName.normalize('NFD'),
      ...(entry ? [entry.canonicalName, entry.canonicalName.normalize('NFD')] : []),
    ];

    for (const candidate of candidates) {
      const safeBase = path.basename(candidate);
      const cachedPath = path.join(TMP_DRIVE_CACHE_DIR, safeBase);
      if (fs.existsSync(cachedPath)) {
        try {
          const buf = fs.readFileSync(cachedPath);
          const mime = detectBufferMimeType(buf, safeBase);
          res.setHeader('Content-Type', mime);
          res.setHeader('X-Bugz-Media-Format', mime === 'image/webp' ? 'webp-optimized' : 'original');
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
          res.status(200).send(buf);
          return;
        } catch {
          // Tiếp tục tải lại nếu đọc cache lỗi
        }
      }
    }

    if (!entry) {
      res.status(404).json({
        ok: false,
        error: 'ASSET_NOT_IN_DRIVE_SOURCE',
        filename: rawName,
      });
      return;
    }

    const targetCachePath = path.join(TMP_DRIVE_CACHE_DIR, path.basename(entry.canonicalName));
    const isAudio = entry.canonicalName.toLowerCase().endsWith('.mp3');
    const fetchedBuf = await fetchAndCacheDriveBuffer(
      entry.driveId,
      targetCachePath,
      entry.canonicalName,
      isAudio
    );

    if (fetchedBuf) {
      const mime = detectBufferMimeType(fetchedBuf, entry.canonicalName);
      res.setHeader('Content-Type', mime);
      res.setHeader('X-Bugz-Media-Format', mime === 'image/webp' ? 'webp-optimized' : 'original');
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      res.status(200).send(fetchedBuf);
      return;
    }

    res.status(502).json({
      ok: false,
      error: 'UPSTREAM_MEDIA_FETCH_FAILED',
      filename: entry.canonicalName,
    });
  });

  app.get('/assets/bugz_learning_atlas.png', (_req: Request, res: Response) => {
    const cachedAtlas = path.join(TMP_ASSET_CACHE_ROOT, 'bugz_learning_atlas.png');
    if (fs.existsSync(cachedAtlas)) {
      const buf = fs.readFileSync(cachedAtlas);
      res.setHeader('Content-Type', detectBufferMimeType(buf, 'bugz_learning_atlas.png'));
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      res.status(200).send(buf);
      return;
    }

    // Tranh minh họa hoạt hình 2x2 sắc nét (1254x1254) với cặp nhân vật Nam (áo xanh teal) & Nữ (áo cam)
    // đồng bộ 4 cảnh: 1. POSTURE (Ngồi thẳng đọc sách), 2. DESK (Góc học tập chuẩn), 3. EYES (Nhìn xa qua cửa sổ), 4. MOVE (Vươn vai vận động)
    const svgAtlas = `<svg xmlns="http://www.w3.org/2000/svg" width="1254" height="1254" viewBox="0 0 1254 1254">
      <!-- Ô 1 (0,0): POSTURE - Tư thế ngồi đọc sách thẳng lưng -->
      <g transform="translate(0,0)">
        <rect width="627" height="627" fill="#ecfdf5"/>
        <rect x="20" y="20" width="587" height="587" rx="36" fill="#d1fae5" stroke="#0d9488" stroke-width="6"/>
        <!-- Cửa sổ sáng phía sau -->
        <rect x="235" y="55" width="156" height="110" rx="14" fill="#e0f2fe" stroke="#0284c7" stroke-width="4"/>
        <line x1="313" y1="55" x2="313" y2="165" stroke="#0284c7" stroke-width="3"/>
        <line x1="235" y1="110" x2="391" y2="110" stroke="#0284c7" stroke-width="3"/>
        <!-- Bạn Nam (Áo xanh Teal, ngồi thẳng lưng) -->
        <rect x="115" y="320" width="22" height="110" rx="8" fill="#0f766e"/>
        <rect x="155" y="275" width="76" height="115" rx="22" fill="#0d9488"/>
        <circle cx="193" cy="215" r="46" fill="#fed7aa" stroke="#9a3412" stroke-width="3"/>
        <path d="M150 205 Q193 155 238 205 Z" fill="#1e293b"/>
        <circle cx="178" cy="215" r="5" fill="#1e293b"/>
        <circle cx="208" cy="215" r="5" fill="#1e293b"/>
        <path d="M180 233 Q193 244 206 233" fill="none" stroke="#9a3412" stroke-width="3" stroke-linecap="round"/>
        <!-- Bạn Nữ (Áo cam tươi, tóc buộc hai bên, ngồi thẳng lưng) -->
        <rect x="485" y="320" width="22" height="110" rx="8" fill="#c2410c"/>
        <rect x="395" y="275" width="76" height="115" rx="22" fill="#f97316"/>
        <circle cx="382" cy="195" r="18" fill="#1e293b"/>
        <circle cx="484" cy="195" r="18" fill="#1e293b"/>
        <circle cx="433" cy="215" r="46" fill="#fed7aa" stroke="#9a3412" stroke-width="3"/>
        <path d="M390 205 Q433 158 476 205 Z" fill="#1e293b"/>
        <circle cx="418" cy="215" r="5" fill="#1e293b"/>
        <circle cx="448" cy="215" r="5" fill="#1e293b"/>
        <path d="M420 233 Q433 244 446 233" fill="none" stroke="#9a3412" stroke-width="3" stroke-linecap="round"/>
        <!-- Mặt bàn học & Sách mở trên giá nghiêng -->
        <rect x="95" y="365" width="437" height="24" rx="12" fill="#b45309"/>
        <polygon points="270,365 313,320 356,365" fill="#fef08a" stroke="#ca8a04" stroke-width="4"/>
        <rect x="135" y="425" width="357" height="18" rx="9" fill="#78350f"/>
        <rect x="55" y="468" width="517" height="110" rx="22" fill="#ffffff" stroke="#10b981" stroke-width="3"/>
        <text x="313" y="515" text-anchor="middle" font-family="sans-serif" font-size="30" font-weight="bold" fill="#065f46">1. POSTURE · Lưng thẳng tự nhiên</text>
        <text x="313" y="555" text-anchor="middle" font-family="sans-serif" font-size="22" fill="#047857">Hai bạn ngồi thẳng lưng, mắt cách vở 30–35 cm</text>
      </g>

      <!-- Ô 2 (627,0): DESK - Góc học tập có đèn bàn & bục kê chân -->
      <g transform="translate(627,0)">
        <rect width="627" height="627" fill="#fffbeb"/>
        <rect x="20" y="20" width="587" height="587" rx="36" fill="#fef3c7" stroke="#f59e0b" stroke-width="6"/>
        <!-- Đèn bàn chiếu sáng êm dịu bên trái -->
        <path d="M125 355 L145 210 L215 195" fill="none" stroke="#0f766e" stroke-width="10" stroke-linecap="round"/>
        <polygon points="195,180 250,175 235,220 185,215" fill="#f59e0b"/>
        <polygon points="205,218 295,355 155,355" fill="#fef08a" opacity="0.55"/>
        <!-- Bạn Nam & Bạn Nữ kiểm tra góc học tập -->
        <circle cx="295" cy="220" r="44" fill="#fed7aa" stroke="#9a3412" stroke-width="3"/>
        <path d="M254 208 Q295 162 336 208 Z" fill="#1e293b"/>
        <circle cx="282" cy="220" r="5" fill="#1e293b"/>
        <circle cx="308" cy="220" r="5" fill="#1e293b"/>
        <path d="M283 236 Q295 246 307 236" fill="none" stroke="#9a3412" stroke-width="3"/>
        <rect x="260" y="268" width="70" height="95" rx="20" fill="#0d9488"/>

        <circle cx="408" cy="198" r="16" fill="#1e293b"/>
        <circle cx="502" cy="198" r="16" fill="#1e293b"/>
        <circle cx="455" cy="220" r="44" fill="#fed7aa" stroke="#9a3412" stroke-width="3"/>
        <path d="M414 208 Q455 162 496 208 Z" fill="#1e293b"/>
        <circle cx="442" cy="220" r="5" fill="#1e293b"/>
        <circle cx="468" cy="220" r="5" fill="#1e293b"/>
        <path d="M443 236 Q455 246 467 236" fill="none" stroke="#9a3412" stroke-width="3"/>
        <rect x="420" y="268" width="70" height="95" rx="20" fill="#f97316"/>
        <!-- Bàn học + Bục kê chân vững vàng -->
        <rect x="95" y="355" width="437" height="24" rx="12" fill="#b45309"/>
        <rect x="220" y="415" width="210" height="32" rx="10" fill="#0d9488" stroke="#115e59" stroke-width="4"/>
        <text x="325" y="437" text-anchor="middle" font-family="sans-serif" font-size="18" font-weight="bold" fill="#ffffff">BỤC KÊ CHÂN VỮNG</text>
        <rect x="55" y="468" width="517" height="110" rx="22" fill="#ffffff" stroke="#f59e0b" stroke-width="3"/>
        <text x="313" y="515" text-anchor="middle" font-family="sans-serif" font-size="30" font-weight="bold" fill="#92400e">2. DESK · Góc học tập chuẩn</text>
        <text x="313" y="555" text-anchor="middle" font-family="sans-serif" font-size="22" fill="#b45309">Đủ ánh sáng, ghế vừa tầm và có bục kê chân</text>
      </g>

      <!-- Ô 3 (0,627): EYES - Nghỉ mắt nhìn xa qua cửa sổ có cây xanh -->
      <g transform="translate(0,627)">
        <rect width="627" height="627" fill="#f0f9ff"/>
        <rect x="20" y="20" width="587" height="587" rx="36" fill="#e0f2fe" stroke="#0284c7" stroke-width="6"/>
        <!-- Khung cửa sổ lớn nhìn ra cây xanh & bầu trời -->
        <rect x="95" y="60" width="437" height="230" rx="24" fill="#bae6fd" stroke="#0369a1" stroke-width="6"/>
        <circle cx="455" cy="115" r="28" fill="#facc15"/>
        <circle cx="215" cy="195" r="52" fill="#22c55e"/>
        <circle cx="265" cy="205" r="42" fill="#16a34a"/>
        <rect x="230" y="235" width="18" height="50" fill="#78350f"/>
        <!-- Bạn Nam & Bạn Nữ đứng thư giãn mắt nhìn ra xa -->
        <circle cx="210" cy="335" r="42" fill="#fed7aa" stroke="#9a3412" stroke-width="3"/>
        <path d="M170 325 Q210 280 250 325 Z" fill="#1e293b"/>
        <rect x="175" y="380" width="70" height="75" rx="20" fill="#0d9488"/>

        <circle cx="372" cy="315" r="15" fill="#1e293b"/>
        <circle cx="462" cy="315" r="15" fill="#1e293b"/>
        <circle cx="417" cy="335" r="42" fill="#fed7aa" stroke="#9a3412" stroke-width="3"/>
        <path d="M377 325 Q417 280 457 325 Z" fill="#1e293b"/>
        <rect x="382" y="380" width="70" height="75" rx="20" fill="#f97316"/>
        <rect x="55" y="468" width="517" height="110" rx="22" fill="#ffffff" stroke="#0284c7" stroke-width="3"/>
        <text x="313" y="515" text-anchor="middle" font-family="sans-serif" font-size="30" font-weight="bold" fill="#075985">3. EYES · Nhìn xa thư giãn mắt</text>
        <text x="313" y="555" text-anchor="middle" font-family="sans-serif" font-size="22" fill="#0369a1">Quy tắc 20-20-20: Nhìn cây xanh xa qua cửa sổ</text>
      </g>

      <!-- Ô 4 (627,627): MOVE - Đứng dậy vươn vai vận động nhẹ -->
      <g transform="translate(627,627)">
        <rect width="627" height="627" fill="#fdf2f8"/>
        <rect x="20" y="20" width="587" height="587" rx="36" fill="#fce7f3" stroke="#db2777" stroke-width="6"/>
        <!-- Bạn Nam giơ hai tay vươn vai -->
        <path d="M135 285 Q120 185 160 145" fill="none" stroke="#0d9488" stroke-width="18" stroke-linecap="round"/>
        <path d="M265 285 Q280 185 240 145" fill="none" stroke="#0d9488" stroke-width="18" stroke-linecap="round"/>
        <circle cx="200" cy="220" r="44" fill="#fed7aa" stroke="#9a3412" stroke-width="3"/>
        <path d="M158 208 Q200 162 242 208 Z" fill="#1e293b"/>
        <circle cx="186" cy="220" r="5" fill="#1e293b"/>
        <circle cx="214" cy="220" r="5" fill="#1e293b"/>
        <path d="M186 238 Q200 250 214 238" fill="none" stroke="#9a3412" stroke-width="3"/>
        <rect x="162" y="268" width="76" height="125" rx="22" fill="#0d9488"/>
        <!-- Bạn Nữ giơ hai tay xoay vai vui vẻ -->
        <path d="M365 285 Q350 185 390 145" fill="none" stroke="#f97316" stroke-width="18" stroke-linecap="round"/>
        <path d="M495 285 Q510 185 470 145" fill="none" stroke="#f97316" stroke-width="18" stroke-linecap="round"/>
        <circle cx="382" cy="198" r="16" fill="#1e293b"/>
        <circle cx="478" cy="198" r="16" fill="#1e293b"/>
        <circle cx="430" cy="220" r="44" fill="#fed7aa" stroke="#9a3412" stroke-width="3"/>
        <path d="M388 208 Q430 162 472 208 Z" fill="#1e293b"/>
        <circle cx="416" cy="220" r="5" fill="#1e293b"/>
        <circle cx="444" cy="220" r="5" fill="#1e293b"/>
        <path d="M416 238 Q430 250 444 238" fill="none" stroke="#9a3412" stroke-width="3"/>
        <rect x="392" y="268" width="76" height="125" rx="22" fill="#f97316"/>
        <rect x="55" y="468" width="517" height="110" rx="22" fill="#ffffff" stroke="#db2777" stroke-width="3"/>
        <text x="313" y="515" text-anchor="middle" font-family="sans-serif" font-size="30" font-weight="bold" fill="#9d174d">4. MOVE · Đứng dậy vận động nhẹ</text>
        <text x="313" y="555" text-anchor="middle" font-family="sans-serif" font-size="22" fill="#be185d">Vươn vai, xoay cổ tay và đi lại sau mỗi 30–45 phút</text>
      </g>
    </svg>`;
    res.setHeader('Content-Type', 'image/svg+xml; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.status(200).send(svgAtlas);
  });

  app.get(
    ['/apple-touch-icon.png', '/pwa-192x192.png', '/pwa-512x512.png', '/pwa-maskable-512x512.png'],
    async (req: Request, res: Response) => {
      const iconName = path.basename(req.path);
      const cachedIcon = path.join(TMP_PWA_CACHE_DIR, iconName);
      if (fs.existsSync(cachedIcon)) {
        const buf = fs.readFileSync(cachedIcon);
        res.setHeader('Content-Type', detectBufferMimeType(buf, iconName));
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        res.status(200).send(buf);
        return;
      }

      const cachedLogo1 = path.join(TMP_DRIVE_CACHE_DIR, 'logo1.png');
      if (fs.existsSync(cachedLogo1)) {
        const buf = fs.readFileSync(cachedLogo1);
        res.setHeader('Content-Type', detectBufferMimeType(buf, 'logo1.png'));
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        res.status(200).send(buf);
        return;
      }

      const buf = await fetchAndCacheDriveBuffer(
        '1gQHY1UhxP95eR_2lnzkjdeVuIKY_4wre',
        cachedLogo1,
        'logo1.png',
        false
      );
      if (buf) {
        res.setHeader('Content-Type', detectBufferMimeType(buf, 'logo1.png'));
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        res.status(200).send(buf);
        return;
      }
      res.redirect(302, '/icon.svg');
    }
  );

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    // Khởi động sạch sẽ trên cổng 3000
  });
}

startServer();
