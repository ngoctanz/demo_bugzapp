import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import {
  cert,
  getApps,
  getAuth,
  getDatabase,
  initializeApp,
  type App as FirebaseAdminApp,
  type ServiceAccount,
} from '../src/lib/firebaseAdminLite.ts';
import {
  evaluateStageFeatureConfigs,
  validateServiceAccountConfig,
} from '../src/domain/envContract.ts';
import {
  executeOneTimeSuperAdminBootstrap,
  validateSuperAdminBootstrapEmails,
  type AdminBootstrapAdapter,
  type FirebaseAuthUserLookupRecord,
  type SuperAdminBootstrapLockRecord,
  type SuperAdminCustomClaims,
} from '../src/domain/superAdminBootstrapScript.ts';
import type { AuditLogRecord, ServerAccountRoleRecord } from '../src/domain/p01RbacStore.ts';

/**
 * Initializes the Firebase Admin SDK app using server environment variables.
 * Never fabricates credentials if FIREBASE_SERVICE_ACCOUNT_JSON / KEY_PATH is missing.
 */
export function initializeFirebaseAdminForBootstrap(
  env: Record<string, string | undefined> = process.env
): {
  adminApp: FirebaseAdminApp | null;
  errorReason?: string;
  missingVars?: string[];
} {
  const stageChecks = evaluateStageFeatureConfigs(env);
  if (!stageChecks.firebaseAdminBackend.isConfigured) {
    return {
      adminApp: null,
      errorReason: stageChecks.firebaseAdminBackend.details,
      missingVars: stageChecks.firebaseAdminBackend.missingOrInvalidVars,
    };
  }

  const existing = getApps().find((app) => app.name === 'bugz-superadmin-bootstrap-cli') || getApps()[0];
  if (existing) {
    return { adminApp: existing };
  }

  try {
    const saInfo = validateServiceAccountConfig(env);
    if (!saInfo.isValid) {
      return {
        adminApp: null,
        errorReason: saInfo.errorReason || 'Không thể đọc thông tin Service Account hợp lệ từ biến môi trường.',
      };
    }

    let credentialObj: ServiceAccount;
    if (saInfo.source === 'json_env') {
      const raw = env.FIREBASE_SERVICE_ACCOUNT_JSON!.trim();
      const jsonStr = raw.startsWith('{') ? raw : Buffer.from(raw, 'base64').toString('utf8');
      credentialObj = JSON.parse(jsonStr) as ServiceAccount;
    } else {
      const resolved = path.resolve(process.cwd(), env.FIREBASE_SERVICE_ACCOUNT_KEY_PATH!.trim());
      credentialObj = JSON.parse(fs.readFileSync(resolved, 'utf8')) as ServiceAccount;
    }

    const adminApp = initializeApp(
      {
        credential: cert(credentialObj),
        databaseURL: env.FIREBASE_DATABASE_URL || env.VITE_FIREBASE_DATABASE_URL,
        projectId: env.FIREBASE_PROJECT_ID || env.VITE_FIREBASE_PROJECT_ID,
      },
      'bugz-superadmin-bootstrap-cli'
    );
    return { adminApp };
  } catch (err) {
    return {
      adminApp: null,
      errorReason: err instanceof Error ? err.message : 'Lỗi không xác định khi khởi tạo Firebase Admin SDK.',
    };
  }
}

/**
 * Creates a real Firebase Admin SDK adapter (`firebase-admin/auth` + `firebase-admin/database`)
 * with an atomic RTDB transaction on `system_locks/superadmin_bootstrap` to guarantee run-once execution.
 */
export function createFirebaseAdminBootstrapAdapter(adminApp: FirebaseAdminApp): AdminBootstrapAdapter {
  const auth = getAuth(adminApp);
  const db = getDatabase(adminApp);
  const lockRef = db.ref('system_locks/superadmin_bootstrap');

  return {
    async getBootstrapLock(): Promise<SuperAdminBootstrapLockRecord | null> {
      const snap = await lockRef.get();
      if (!snap.exists()) {
        return null;
      }
      return snap.val() as SuperAdminBootstrapLockRecord;
    },

    async acquireBootstrapLockAtomically(lockRecord: SuperAdminBootstrapLockRecord): Promise<boolean> {
      const txResult = await lockRef.transaction((currentData: SuperAdminBootstrapLockRecord | null) => {
        if (currentData && currentData.locked === true) {
          // Abort transaction: lock already exists
          return;
        }
        return lockRecord;
      });
      return Boolean(txResult.committed && txResult.snapshot.exists());
    },

    async getUserByEmail(email: string): Promise<FirebaseAuthUserLookupRecord | null> {
      try {
        const userRecord = await auth.getUserByEmail(email);
        return {
          uid: userRecord.uid,
          email: userRecord.email,
          emailVerified: Boolean(userRecord.emailVerified),
          disabled: Boolean(userRecord.disabled),
          displayName: userRecord.displayName,
        };
      } catch (err: unknown) {
        const code = (err as { code?: string })?.code;
        if (code === 'auth/user-not-found') {
          return null;
        }
        throw err;
      }
    },

    async setCustomUserClaims(uid: string, claims: SuperAdminCustomClaims): Promise<void> {
      await auth.setCustomUserClaims(uid, claims);
    },

    async writeAccountRole(uid: string, roleRecord: ServerAccountRoleRecord): Promise<void> {
      await db.ref(`account_roles/${uid}`).set(roleRecord);
    },

    async appendAuditLog(entry: Omit<AuditLogRecord, 'log_id'>): Promise<void> {
      const logRef = db.ref('audit_logs').push();
      const log_id = logRef.key || `audit-${Date.now()}`;
      await logRef.set({
        log_id,
        ...entry,
      });
    },
  };
}

/**
 * CLI Entrypoint: `npm run bootstrap:superadmin`
 */
async function main() {
  console.log('====================================================================');
  console.log('[BUGZ P01] Server-Side SuperAdmin Bootstrap Script (Run-Once Locked)');
  console.log('====================================================================');

  const rawBootstrapEnv = process.env.SUPERADMIN_BOOTSTRAP_EMAIL;
  const emailValidation = validateSuperAdminBootstrapEmails(rawBootstrapEnv);

  if (!emailValidation.isValid) {
    console.error(`[FAIL] Lỗi cấu hình SUPERADMIN_BOOTSTRAP_EMAIL: ${emailValidation.errorReason}`);
    process.exitCode = 1;
    return;
  }

  console.log(
    `[OK] Đã xác minh biến môi trường SUPERADMIN_BOOTSTRAP_EMAIL (${emailValidation.emails.length} email): ${emailValidation.emails.join(', ')}`
  );

  const adminInit = initializeFirebaseAdminForBootstrap(process.env);
  if (!adminInit.adminApp) {
    console.error(
      `[BLOCKED - Chưa cấu hình Firebase Admin SDK] ${adminInit.errorReason || ''}`
    );
    if (adminInit.missingVars && adminInit.missingVars.length > 0) {
      console.error(`Biến môi trường còn thiếu/chưa hợp lệ: ${adminInit.missingVars.join(', ')}`);
    }
    console.error(
      'Hướng dẫn: Cung cấp FIREBASE_SERVICE_ACCOUNT_JSON hoặc FIREBASE_SERVICE_ACCOUNT_KEY_PATH trong .env trên server rồi chạy lại `npm run bootstrap:superadmin`.'
    );
    process.exitCode = 2;
    return;
  }

  const adapter = createFirebaseAdminBootstrapAdapter(adminInit.adminApp);
  const result = await executeOneTimeSuperAdminBootstrap({
    rawBootstrapEmailEnv: rawBootstrapEnv,
    adapter,
    actorLabel: 'cli_bootstrap_script',
  });

  if (!result.ok) {
    console.error(`[${result.code}] (HTTP ${result.status}): ${result.message}`);
    if (result.skippedEmails.length > 0) {
      for (const skipped of result.skippedEmails) {
        console.error(`  - Bỏ qua ${skipped.email}: ${skipped.reason}`);
      }
    }
    process.exitCode = result.code === 'BOOTSTRAP_ALREADY_EXECUTED_ONCE' ? 3 : 1;
    return;
  }

  console.log(`[SUCCESS - ${result.code}] ${result.message}`);
  for (const u of result.bootstrappedUsers) {
    console.log(
      `  + Đã gán Custom Claims ${JSON.stringify(u.claims)} cho ${u.email} (UID: ${u.uid})`
    );
  }
  if (result.skippedEmails.length > 0) {
    console.warn('[WARN] Một số email trong danh sách bị bỏ qua:');
    for (const skipped of result.skippedEmails) {
      console.warn(`  - ${skipped.email}: ${skipped.reason}`);
    }
  }
  process.exit(0);
}

const isDirectExecution =
  process.argv[1] &&
  (process.argv[1].endsWith('bootstrapSuperAdmin.ts') ||
    process.argv[1].endsWith('bootstrapSuperAdmin.js'));

if (isDirectExecution) {
  main().catch((err) => {
    console.error('[FATAL] Lỗi thực thi script bootstrap SuperAdmin:', err);
    process.exit(1);
  });
}
