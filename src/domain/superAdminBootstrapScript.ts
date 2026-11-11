import { isEnvValuePresent } from './envContract.ts';
import type { AuditLogRecord, ServerAccountRoleRecord } from './p01RbacStore.ts';

export interface SuperAdminCustomClaims {
  admin: true;
  superadmin: true;
  role: 'superadmin';
}

export interface SuperAdminBootstrapLockRecord {
  locked: true;
  executed_at: number;
  executed_by: string;
  bootstrapped_uids: string[];
  bootstrapped_emails: string[];
  claims_applied: SuperAdminCustomClaims;
}

export interface BootstrapEmailValidationResult {
  isValid: boolean;
  emails: string[];
  invalidEntries: string[];
  errorReason?: string;
}

const STRICT_EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * Validates SUPERADMIN_BOOTSTRAP_EMAIL from environment variables.
 * Rejects empty values, placeholders, or malformed email addresses.
 */
export function validateSuperAdminBootstrapEmails(
  rawEnv: string | undefined
): BootstrapEmailValidationResult {
  if (!isEnvValuePresent(rawEnv)) {
    return {
      isValid: false,
      emails: [],
      invalidEntries: [],
      errorReason:
        'Biến môi trường SUPERADMIN_BOOTSTRAP_EMAIL chưa được cấu hình hoặc đang chứa giá trị rỗng/placeholder.',
    };
  }

  const parts = String(rawEnv)
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);

  if (parts.length === 0) {
    return {
      isValid: false,
      emails: [],
      invalidEntries: [],
      errorReason: 'SUPERADMIN_BOOTSTRAP_EMAIL không chứa địa chỉ email nào hợp lệ.',
    };
  }

  const validEmails: string[] = [];
  const invalidEntries: string[] = [];

  for (const part of parts) {
    if (!STRICT_EMAIL_REGEX.test(part) || !isEnvValuePresent(part)) {
      invalidEntries.push(part);
    } else if (!validEmails.includes(part)) {
      validEmails.push(part);
    }
  }

  if (invalidEntries.length > 0) {
    return {
      isValid: false,
      emails: validEmails,
      invalidEntries,
      errorReason: `SUPERADMIN_BOOTSTRAP_EMAIL chứa định dạng email không hợp lệ: ${invalidEntries.join(', ')}`,
    };
  }

  return {
    isValid: true,
    emails: validEmails,
    invalidEntries: [],
  };
}

export interface FirebaseAuthUserLookupRecord {
  uid: string;
  email?: string;
  emailVerified: boolean;
  disabled: boolean;
  displayName?: string;
}

export interface AdminBootstrapAdapter {
  /**
   * Reads `system_locks/superadmin_bootstrap` from Realtime Database.
   */
  getBootstrapLock(): Promise<SuperAdminBootstrapLockRecord | null>;

  /**
   * Atomically acquires the `system_locks/superadmin_bootstrap` lock in Realtime Database.
   * Returns false if the lock was already acquired by a prior execution.
   */
  acquireBootstrapLockAtomically(lockRecord: SuperAdminBootstrapLockRecord): Promise<boolean>;

  /**
   * Looks up a user by email in Firebase Auth (`getAuth().getUserByEmail(email)`).
   * Returns null if user does not exist yet in Firebase Auth.
   */
  getUserByEmail(email: string): Promise<FirebaseAuthUserLookupRecord | null>;

  /**
   * Sets Firebase Auth Custom Claims (`getAuth().setCustomUserClaims(uid, claims)`).
   */
  setCustomUserClaims(uid: string, claims: SuperAdminCustomClaims): Promise<void>;

  /**
   * Persists the server-only role record at `account_roles/{uid}` in Realtime Database.
   */
  writeAccountRole(uid: string, roleRecord: ServerAccountRoleRecord): Promise<void>;

  /**
   * Appends a security audit log entry to `audit_logs/{log_id}` in Realtime Database.
   */
  appendAuditLog(entry: Omit<AuditLogRecord, 'log_id'>): Promise<void>;
}

export interface OneTimeSuperAdminBootstrapResult {
  ok: boolean;
  status: number;
  code:
    | 'BOOTSTRAP_COMPLETED_ONCE'
    | 'BOOTSTRAP_ALREADY_EXECUTED_ONCE'
    | 'INVALID_BOOTSTRAP_EMAIL_ENV'
    | 'NO_VERIFIED_AUTH_USERS_FOUND';
  message: string;
  bootstrappedUsers: Array<{
    uid: string;
    email: string;
    claims: SuperAdminCustomClaims;
  }>;
  skippedEmails: Array<{
    email: string;
    reason: string;
  }>;
  lockRecord?: SuperAdminBootstrapLockRecord;
}

/**
 * Executes the SuperAdmin bootstrap using Firebase Admin SDK adapters,
 * validating SUPERADMIN_BOOTSTRAP_EMAIL, setting the `'admin'` (and `'superadmin'`) custom claim,
 * and enforcing a strict run-once security lock (`system_locks/superadmin_bootstrap`).
 */
export async function executeOneTimeSuperAdminBootstrap(options: {
  rawBootstrapEmailEnv: string | undefined;
  adapter: AdminBootstrapAdapter;
  nowMs?: number;
  actorLabel?: string;
}): Promise<OneTimeSuperAdminBootstrapResult> {
  const nowMs = options.nowMs ?? Date.now();
  const actorLabel = options.actorLabel || 'server_cli_bootstrap';

  // 1. Validate SUPERADMIN_BOOTSTRAP_EMAIL from env vars
  const emailValidation = validateSuperAdminBootstrapEmails(options.rawBootstrapEmailEnv);
  if (!emailValidation.isValid) {
    await options.adapter.appendAuditLog({
      actor_uid: actorLabel,
      actor_email: 'system@bugz.local',
      action: 'BOOTSTRAP_SUPERADMIN',
      target: 'system_locks/superadmin_bootstrap',
      details: `Từ chối chạy script bootstrap: ${emailValidation.errorReason}`,
      time: nowMs,
      result: 'DENIED',
    });

    return {
      ok: false,
      status: 400,
      code: 'INVALID_BOOTSTRAP_EMAIL_ENV',
      message: emailValidation.errorReason!,
      bootstrappedUsers: [],
      skippedEmails: [],
    };
  }

  // 2. Check Run-Once security lock before inspecting or modifying any users
  const existingLock = await options.adapter.getBootstrapLock();
  if (existingLock && existingLock.locked === true) {
    const lockMsg = `Lệnh Bootstrap SuperAdmin chỉ được phép chạy ĐÚNG MỘT LẦN (đã khóa tại system_locks/superadmin_bootstrap lúc ${new Date(
      existingLock.executed_at
    ).toISOString()} cho [${existingLock.bootstrapped_emails.join(', ')}]). Mọi lần chạy lại đều bị từ chối để bảo mật.`;

    await options.adapter.appendAuditLog({
      actor_uid: actorLabel,
      actor_email: 'system@bugz.local',
      action: 'BOOTSTRAP_SUPERADMIN',
      target: 'system_locks/superadmin_bootstrap',
      details: `Chặn chạy lại Bootstrap SuperAdmin (Run-Once Lock): ${lockMsg}`,
      time: nowMs,
      result: 'DENIED',
    });

    return {
      ok: false,
      status: 409,
      code: 'BOOTSTRAP_ALREADY_EXECUTED_ONCE',
      message: lockMsg,
      bootstrappedUsers: [],
      skippedEmails: [],
      lockRecord: existingLock,
    };
  }

  // 3. Resolve and verify candidate users in Firebase Auth
  const verifiedCandidates: FirebaseAuthUserLookupRecord[] = [];
  const skippedEmails: Array<{ email: string; reason: string }> = [];

  for (const email of emailValidation.emails) {
    const user = await options.adapter.getUserByEmail(email);
    if (!user) {
      skippedEmails.push({
        email,
        reason: 'Chưa tìm thấy người dùng với email này trong Firebase Authentication.',
      });
      continue;
    }
    if (user.disabled) {
      skippedEmails.push({
        email,
        reason: `Tài khoản UID=${user.uid} đang bị vô hiệu hóa (disabled=true) trong Firebase Auth.`,
      });
      continue;
    }
    if (!user.emailVerified) {
      skippedEmails.push({
        email,
        reason: `Tài khoản UID=${user.uid} chưa xác minh email (emailVerified=false).`,
      });
      continue;
    }
    verifiedCandidates.push(user);
  }

  if (verifiedCandidates.length === 0) {
    const noUsersMsg = `Không tìm thấy tài khoản Firebase Auth nào đã xác minh email trong danh sách SUPERADMIN_BOOTSTRAP_EMAIL (${emailValidation.emails.join(
      ', '
    )}). Chưa khóa Run-Once Lock để chờ chủ tài khoản đăng nhập Google lần đầu.`;

    await options.adapter.appendAuditLog({
      actor_uid: actorLabel,
      actor_email: 'system@bugz.local',
      action: 'BOOTSTRAP_SUPERADMIN',
      target: 'system_locks/superadmin_bootstrap',
      details: noUsersMsg,
      time: nowMs,
      result: 'DENIED',
    });

    return {
      ok: false,
      status: 404,
      code: 'NO_VERIFIED_AUTH_USERS_FOUND',
      message: noUsersMsg,
      bootstrappedUsers: [],
      skippedEmails,
    };
  }

  const claimsToSet: SuperAdminCustomClaims = {
    admin: true,
    superadmin: true,
    role: 'superadmin',
  };

  const lockRecord: SuperAdminBootstrapLockRecord = {
    locked: true,
    executed_at: nowMs,
    executed_by: actorLabel,
    bootstrapped_uids: verifiedCandidates.map((u) => u.uid),
    bootstrapped_emails: verifiedCandidates.map((u) => (u.email || '').trim().toLowerCase()),
    claims_applied: claimsToSet,
  };

  // 4. Acquire the Run-Once lock atomically BEFORE setting custom claims
  const lockAcquired = await options.adapter.acquireBootstrapLockAtomically(lockRecord);
  if (!lockAcquired) {
    const currentLock = await options.adapter.getBootstrapLock();
    const raceMsg =
      'Phát hiện một tiến trình khác vừa hoàn tất Bootstrap SuperAdmin. Đã hủy thao tác lặp lại theo cơ chế Run-Once Lock.';
    await options.adapter.appendAuditLog({
      actor_uid: actorLabel,
      actor_email: 'system@bugz.local',
      action: 'BOOTSTRAP_SUPERADMIN',
      target: 'system_locks/superadmin_bootstrap',
      details: raceMsg,
      time: nowMs,
      result: 'DENIED',
    });

    return {
      ok: false,
      status: 409,
      code: 'BOOTSTRAP_ALREADY_EXECUTED_ONCE',
      message: raceMsg,
      bootstrappedUsers: [],
      skippedEmails,
      lockRecord: currentLock || lockRecord,
    };
  }

  // 5. Apply 'admin' custom claim (and superadmin/role) in Firebase Auth + write account_roles/{uid}
  const bootstrappedUsers: Array<{ uid: string; email: string; claims: SuperAdminCustomClaims }> = [];

  for (const user of verifiedCandidates) {
    const normalizedEmail = (user.email || '').trim().toLowerCase();
    await options.adapter.setCustomUserClaims(user.uid, claimsToSet);

    const roleRecord: ServerAccountRoleRecord = {
      role: 'superadmin',
      disabled: false,
      updated_at: nowMs,
      updated_by: actorLabel,
    };
    await options.adapter.writeAccountRole(user.uid, roleRecord);

    bootstrappedUsers.push({
      uid: user.uid,
      email: normalizedEmail,
      claims: claimsToSet,
    });
  }

  await options.adapter.appendAuditLog({
    actor_uid: actorLabel,
    actor_email: bootstrappedUsers.map((u) => u.email).join(','),
    action: 'BOOTSTRAP_SUPERADMIN',
    target: 'system_locks/superadmin_bootstrap',
    details: `Hoàn tất Bootstrap SuperAdmin (Run-Once) cho ${bootstrappedUsers
      .map((u) => `${u.email} (${u.uid})`)
      .join(', ')} với custom claims { admin: true, superadmin: true, role: 'superadmin' }.`,
    time: nowMs,
    result: 'SUCCESS',
  });

  return {
    ok: true,
    status: 200,
    code: 'BOOTSTRAP_COMPLETED_ONCE',
    message: `Đã cấp custom claim 'admin' (và 'superadmin') cho ${bootstrappedUsers.length} tài khoản và khóa vĩnh viễn Run-Once Lock (system_locks/superadmin_bootstrap).`,
    bootstrappedUsers,
    skippedEmails,
    lockRecord,
  };
}
