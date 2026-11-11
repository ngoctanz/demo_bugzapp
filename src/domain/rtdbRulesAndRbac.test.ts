import test from 'node:test';
import assert from 'node:assert/strict';
import { P01RbacDomainService } from './p01RbacStore';
import type { RtdbAuthContext } from './rtdbRulesEngine';
import {
  executeOneTimeSuperAdminBootstrap,
  validateSuperAdminBootstrapEmails,
} from './superAdminBootstrapScript';
import {
  createInitialAlertDeduplicatorState,
  ingestAlertIntoClientDeduplicator,
  isWithinVietnamQuietHours,
  sanitizeReturnToPath,
} from './p04NotificationEngine';
import {
  GAME_BLUEPRINTS,
  ILLUSTRATION_MANIFEST,
  validateAndSplitQuestionBankSeed,
} from './p05GameEngine';
import {
  DEMO_6_MINUTE_SCRIPT,
  P06_ACCEPTANCE_MATRIX_30,
  P0_SECURITY_AUDIT_ITEMS,
  verifyNoSecretsLeakedReport,
} from './p06AcceptanceMatrix';

const guardianAAuth: RtdbAuthContext = {
  uid: 'uid-guardian-a',
  token: {
    email: 'phuhuynh.a@example.com',
    email_verified: true,
    role: 'guardian',
  },
};

const guardianBAuth: RtdbAuthContext = {
  uid: 'uid-guardian-b',
  token: {
    email: 'phuhuynh.b@example.com',
    email_verified: true,
    role: 'guardian',
  },
};

const studentA1Auth: RtdbAuthContext = {
  uid: 'uid-student-a1',
  token: {
    email: 'hocsinh.minh.a1@example.com',
    email_verified: true,
    role: 'student',
  },
};

const superAdminAuth: RtdbAuthContext = {
  uid: 'uid-superadmin-01',
  token: {
    email: 'minhquantran4312@gmail.com',
    email_verified: true,
    superadmin: true,
    role: 'superadmin',
  },
};

test('P01 RTDB Rules #1: Unauthenticated requests (auth == null) are strictly denied across all branches', () => {
  const store = new P01RbacDomainService();

  assert.equal(store.clientReadWithRules({ auth: null, path: '/users/uid-guardian-a' }).allowed, false);
  assert.equal(store.clientReadWithRules({ auth: null, path: '/students/stu-a1' }).allowed, false);
  assert.equal(store.clientReadWithRules({ auth: null, path: '/devices/robot-fam-a-01' }).allowed, false);
  assert.equal(store.clientReadWithRules({ auth: null, path: '/sessions/robot-fam-a-01/sess-a-001' }).allowed, false);
  assert.equal(store.clientReadWithRules({ auth: null, path: '/learning_days' }).allowed, false);
  assert.equal(
    store.clientWriteWithRules({
      auth: null,
      path: '/users/uid-guardian-a',
      value: { full_name: 'Hacker', email: 'h@example.com' },
    }).allowed,
    false
  );
});

test('P01 RTDB Rules #2 (T03): Family A cannot read Family B child profile, progress, alerts, devices, or sessions', () => {
  const store = new P01RbacDomainService();

  // Family A reads own children (with and without Google Account) -> ALLOWED
  assert.equal(store.clientReadWithRules({ auth: guardianAAuth, path: '/students/stu-a1' }).allowed, true);
  assert.equal(store.clientReadWithRules({ auth: guardianAAuth, path: '/students/stu-a2-no-google' }).allowed, true);
  assert.equal(store.clientReadWithRules({ auth: guardianAAuth, path: '/learning_progress/stu-a1' }).allowed, true);
  assert.equal(store.clientReadWithRules({ auth: guardianAAuth, path: '/student_alerts/stu-a1' }).allowed, true);
  assert.equal(store.clientReadWithRules({ auth: guardianAAuth, path: '/devices/robot-fam-a-01' }).allowed, true);

  // Family A attempts to read Family B child (`stu-b1`) or device (`robot-fam-b-01`) -> DENIED
  assert.equal(store.clientReadWithRules({ auth: guardianAAuth, path: '/students/stu-b1' }).allowed, false);
  assert.equal(store.clientReadWithRules({ auth: guardianAAuth, path: '/learning_progress/stu-b1' }).allowed, false);
  assert.equal(store.clientReadWithRules({ auth: guardianAAuth, path: '/student_alerts/stu-b1' }).allowed, false);
  assert.equal(store.clientReadWithRules({ auth: guardianAAuth, path: '/episode_log/stu-b1' }).allowed, false);
  assert.equal(store.clientReadWithRules({ auth: guardianAAuth, path: '/game_attempts/stu-b1' }).allowed, false);
  assert.equal(store.clientReadWithRules({ auth: guardianAAuth, path: '/devices/robot-fam-b-01' }).allowed, false);
  assert.equal(
    store.clientReadWithRules({ auth: guardianAAuth, path: '/sessions/robot-fam-b-01/sess-b-001' }).allowed,
    false
  );
  assert.equal(
    store.clientReadWithRules({ auth: guardianAAuth, path: '/alerts/robot-fam-b-01/sess-b-001/alert-b-001' }).allowed,
    false
  );

  // Student A1 reads own profile & progress -> ALLOWED, reads sibling or Family B -> DENIED
  assert.equal(store.clientReadWithRules({ auth: studentA1Auth, path: '/students/stu-a1' }).allowed, true);
  assert.equal(store.clientReadWithRules({ auth: studentA1Auth, path: '/learning_progress/stu-a1' }).allowed, true);
  assert.equal(store.clientReadWithRules({ auth: studentA1Auth, path: '/students/stu-b1' }).allowed, false);
  assert.equal(store.clientReadWithRules({ auth: studentA1Auth, path: '/students/stu-a2-no-google' }).allowed, false);
});

test('P01 RTDB Rules #3 (T02): Student and Guardian cannot modify role, disabled, device owner, robot state, session counters, or game scores', () => {
  const store = new P01RbacDomainService();

  // 1. User can update own full_name + email in users/{uid}
  const selfProfileWrite = store.clientWriteWithRules({
    auth: studentA1Auth,
    path: '/users/uid-student-a1',
    method: 'PUT',
    value: {
      full_name: 'Học sinh Minh (Đã đổi tên)',
      email: 'hocsinh.minh.a1@example.com',
    },
  });
  assert.equal(selfProfileWrite.allowed, true);

  // 2. User attempting to inject `role: 'superadmin'` or `disabled: false` into users/{uid} -> DENIED
  const injectRoleInUsers = store.clientWriteWithRules({
    auth: studentA1Auth,
    path: '/users/uid-student-a1',
    method: 'PUT',
    value: {
      full_name: 'Học sinh Minh',
      email: 'hocsinh.minh.a1@example.com',
      role: 'superadmin',
    },
  });
  assert.equal(injectRoleInUsers.allowed, false);

  // 3. Direct write to server-only account_roles/{uid} -> DENIED even for SuperAdmin client (must use Admin SDK)
  assert.equal(
    store.clientWriteWithRules({
      auth: studentA1Auth,
      path: '/account_roles/uid-student-a1',
      value: { role: 'superadmin', disabled: false },
    }).allowed,
    false
  );

  // 4. Attempting to hijack device owner `devices/{id}/user_id` or robot posture/ACK -> DENIED
  assert.equal(
    store.clientWriteWithRules({
      auth: guardianBAuth,
      path: '/devices/robot-fam-a-01',
      method: 'PATCH',
      value: { user_id: 'uid-guardian-b' },
    }).allowed,
    false
  );
  assert.equal(
    store.clientWriteWithRules({
      auth: guardianAAuth,
      path: '/devices/robot-fam-a-01',
      method: 'PATCH',
      value: { current_posture: 'good', monitoring_active: true },
    }).allowed,
    false
  );

  // 5. Guardian owner CAN patch allowed control fields (`device_name`, `monitoring_enabled`, `alert_after_sec`)
  const validDevicePatch = store.clientWriteWithRules({
    auth: guardianAAuth,
    path: '/devices/robot-fam-a-01',
    method: 'PATCH',
    value: { device_name: 'Robot Bàn Học Bé Minh', monitoring_enabled: true, alert_after_sec: 45 },
  });
  assert.equal(validDevicePatch.allowed, true);

  // 6. Client attempting to tamper with session counters (`good_count`, `bad_count`) or game scores -> DENIED
  assert.equal(
    store.clientWriteWithRules({
      auth: studentA1Auth,
      path: '/sessions/robot-fam-a-01/sess-a-001',
      method: 'PATCH',
      value: { good_count: 999, bad_count: 0 },
    }).allowed,
    false
  );
  assert.equal(
    store.clientWriteWithRules({
      auth: studentA1Auth,
      path: '/game_attempts/stu-a1/att-a-001',
      method: 'PATCH',
      value: { score: 1000 },
    }).allowed,
    false
  );

  // 7. Student cannot read question_keys (server-only answer keys), SuperAdmin can read
  assert.equal(store.clientReadWithRules({ auth: studentA1Auth, path: '/question_keys' }).allowed, false);
  assert.equal(store.clientReadWithRules({ auth: superAdminAuth, path: '/question_keys' }).allowed, true);

  // 8. Guardian owner can mark alert `is_read: true` via PATCH, but cannot overwrite alert `message`
  assert.equal(
    store.clientWriteWithRules({
      auth: guardianAAuth,
      path: '/alerts/robot-fam-a-01/sess-a-001/alert-a-001',
      method: 'PATCH',
      value: { is_read: true },
    }).allowed,
    true
  );
  assert.equal(
    store.clientWriteWithRules({
      auth: guardianAAuth,
      path: '/alerts/robot-fam-a-01/sess-a-001/alert-a-001',
      method: 'PATCH',
      value: { message: 'Sửa nội dung cảnh báo trái phép' },
    }).allowed,
    false
  );
});

test('P01 RTDB Rules #4: Query constraints and .indexOn verification for devices, sessions, alerts, and history', () => {
  const store = new P01RbacDomainService();

  // Excel API #4: GET /devices.json?orderBy="user_id"&equalTo="{uid}"
  const ownDevicesQuery = store.clientReadWithRules({
    auth: guardianAAuth,
    path: '/devices',
    query: { orderByChild: 'user_id', equalTo: 'uid-guardian-a' },
  });
  assert.equal(ownDevicesQuery.allowed, true);
  assert.equal(ownDevicesQuery.indexVerified, true);

  // Guardian A querying Guardian B's devices -> DENIED
  const otherDevicesQuery = store.clientReadWithRules({
    auth: guardianAAuth,
    path: '/devices',
    query: { orderByChild: 'user_id', equalTo: 'uid-guardian-b' },
  });
  assert.equal(otherDevicesQuery.allowed, false);

  // Unbounded read of entire /devices root by non-admin -> DENIED
  const unboundedDevices = store.clientReadWithRules({
    auth: guardianAAuth,
    path: '/devices',
  });
  assert.equal(unboundedDevices.allowed, false);

  // Excel Sessions API #6: GET /sessions/{device_id}.json?orderBy="started_at"&limitToLast=10
  const validSessionsQuery = store.clientReadWithRules({
    auth: guardianAAuth,
    path: '/sessions/robot-fam-a-01',
    query: { orderByChild: 'started_at', limitToLast: 10 },
  });
  assert.equal(validSessionsQuery.allowed, true);
  assert.equal(validSessionsQuery.indexVerified, true);

  // Sessions query exceeding limitToLast > 50 -> DENIED
  const excessiveSessionsQuery = store.clientReadWithRules({
    auth: guardianAAuth,
    path: '/sessions/robot-fam-a-01',
    query: { orderByChild: 'started_at', limitToLast: 500 },
  });
  assert.equal(excessiveSessionsQuery.allowed, false);

  // Querying on an unindexed field -> DENIED by .indexOn verification
  const unindexedQuery = store.clientReadWithRules({
    auth: guardianAAuth,
    path: '/sessions/robot-fam-a-01',
    query: { orderByChild: 'unindexed_field', limitToLast: 10 },
  });
  assert.equal(unindexedQuery.allowed, false);
  assert.equal(unindexedQuery.indexVerified, false);

  // Excel Alerts API #2: GET /alerts/{device_id}/{session_id}.json?orderBy="is_read"&equalTo=false
  const unreadAlertsQuery = store.clientReadWithRules({
    auth: guardianAAuth,
    path: '/alerts/robot-fam-a-01/sess-a-001',
    query: { orderByChild: 'is_read', equalTo: false },
  });
  assert.equal(unreadAlertsQuery.allowed, true);
  assert.equal(unreadAlertsQuery.indexVerified, true);
});

test('P01 Backend RBAC #5 (T02, T04, T10): One-time invitation lifecycle, anti-ID-guessing, device pairing hijack prevention, and Admin CRUD with audit logs', () => {
  const store = new P01RbacDomainService();
  const now = 1793505000000;

  // 1. Rejects raw student_id guessing when accepting invitation
  const guessAttempt = store.acceptOneTimeInvitation(
    { uid: 'uid-stranger', email: 'stranger@example.com', email_verified: true, role: 'student' },
    { invitation_code: 'stu-b1' },
    now
  );
  assert.equal(guessAttempt.ok, false);
  assert.equal(guessAttempt.status, 400);

  // 2. Guardian A creates one-time invitation for child stu-a2-no-google
  const createInv = store.createOneTimeInvitation(
    { uid: 'uid-guardian-a', email: 'phuhuynh.a@example.com', email_verified: true, role: 'guardian' },
    { student_id: 'stu-a2-no-google', target_type: 'student_account', ttlMinutes: 15 },
    now
  );
  assert.equal(createInv.ok, true);
  const code = createInv.invitation!.code;

  // 3. New student account accepts invitation before expiry -> SUCCESS
  const accept1 = store.acceptOneTimeInvitation(
    { uid: 'uid-student-a2', email: 'bena@example.com', email_verified: true, role: 'student' },
    { invitation_code: code },
    now + 60_000
  );
  assert.equal(accept1.ok, true);

  //Now uid-student-a2 can read `/students/stu-a2-no-google` via RTDB Rules!
  assert.equal(
    store.clientReadWithRules({
      auth: { uid: 'uid-student-a2', token: { role: 'student' } },
      path: '/students/stu-a2-no-google',
    }).allowed,
    true
  );

  // 4. Reusing the exact same one-time invitation code -> REJECTED (409)
  const acceptReuse = store.acceptOneTimeInvitation(
    { uid: 'uid-another', email: 'other@example.com', email_verified: true, role: 'student' },
    { invitation_code: code },
    now + 120_000
  );
  assert.equal(acceptReuse.ok, false);
  assert.equal(acceptReuse.status, 409);

  // 5. Device Hijack Prevention (T10): Guardian B tries to pair Guardian A's robot `robot-fam-a-01`
  const hijackAttempt = store.pairDeviceForGuardian(
    { uid: 'uid-guardian-b', email: 'phuhuynh.b@example.com', email_verified: true, role: 'guardian' },
    { device_id: 'robot-fam-a-01', pairing_code: 'PAIR-FAM-A-9911', device_name: 'Chiếm Robot A' },
    now
  );
  assert.equal(hijackAttempt.ok, false);
  assert.equal(hijackAttempt.status, 409);

  // 6. Pairing an unclaimed robot (`robot-unclaimed-03`) with valid pairing code -> SUCCESS
  const validPair = store.pairDeviceForGuardian(
    { uid: 'uid-guardian-a', email: 'phuhuynh.a@example.com', email_verified: true, role: 'guardian' },
    { device_id: 'robot-unclaimed-03', pairing_code: 'BUGZ-PAIR-2026', device_name: 'Robot Phòng Học 2' },
    now
  );
  assert.equal(validPair.ok, true);

  // 7. Student trying to call Admin role change API (T04) -> DENIED (403) + Audit Log
  const studentAdminAttempt = store.adminUpdateUserRole(
    { uid: 'uid-student-a1', email: 'hocsinh.minh.a1@example.com', email_verified: true, role: 'student' },
    { target_uid: 'uid-student-a1', new_role: 'superadmin' },
    now
  );
  assert.equal(studentAdminAttempt.ok, false);
  assert.equal(studentAdminAttempt.status, 403);

  // 8. SuperAdmin changing role and locking/unlocking account -> SUCCESS (200) + Audit Log
  const adminRoleChange = store.adminUpdateUserRole(
    {
      uid: 'uid-superadmin-01',
      email: 'minhquantran4312@gmail.com',
      email_verified: true,
      superadmin: true,
      role: 'superadmin',
    },
    { target_uid: 'uid-student-a1', new_role: 'guardian', reason: 'Nâng cấp thử nghiệm P01' },
    now
  );
  assert.equal(adminRoleChange.ok, true);
  assert.equal(store.getState().account_roles['uid-student-a1'].role, 'guardian');
});

test('P01 Backend RBAC #6: Server-side SuperAdmin Bootstrap script validates SUPERADMIN_BOOTSTRAP_EMAIL, sets "admin" custom claim, and strictly runs only once', async () => {
  // 1. Validate SUPERADMIN_BOOTSTRAP_EMAIL env var parsing & rejection of invalid/empty values
  assert.equal(validateSuperAdminBootstrapEmails('').isValid, false);
  assert.equal(validateSuperAdminBootstrapEmails('YOUR_EMAIL_HERE').isValid, false);
  assert.equal(validateSuperAdminBootstrapEmails('minhquantran4312@gmail.com, not-an-email').isValid, false);

  const validEnv = validateSuperAdminBootstrapEmails(
    'minhquantran4312@gmail.com, tamtranmusic@gmail.com'
  );
  assert.equal(validEnv.isValid, true);
  assert.deepEqual(validEnv.emails, ['minhquantran4312@gmail.com', 'tamtranmusic@gmail.com']);

  // 2. First execution of executeOneTimeSuperAdminBootstrap succeeds and sets 'admin: true' custom claim
  const store = new P01RbacDomainService();
  const { adapter, customClaimsRegistry } = store.createInMemoryAdminBootstrapAdapter();

  const firstRun = await executeOneTimeSuperAdminBootstrap({
    rawBootstrapEmailEnv: 'minhquantran4312@gmail.com,tamtranmusic@gmail.com',
    adapter,
    nowMs: 1793509000000,
    actorLabel: 'test_bootstrap_cli',
  });

  assert.equal(firstRun.ok, true);
  assert.equal(firstRun.status, 200);
  assert.equal(firstRun.code, 'BOOTSTRAP_COMPLETED_ONCE');
  assert.equal(firstRun.bootstrappedUsers.length, 2);

  // Verify 'admin' custom claim was set for both bootstrap users
  assert.deepEqual(customClaimsRegistry['uid-superadmin-01'], {
    admin: true,
    superadmin: true,
    role: 'superadmin',
  });
  assert.deepEqual(customClaimsRegistry['uid-superadmin-02'], {
    admin: true,
    superadmin: true,
    role: 'superadmin',
  });

  // Verify persistent lock was written to system_locks/superadmin_bootstrap
  const lockState = store.getState().system_locks?.superadmin_bootstrap;
  assert.equal(lockState?.locked, true);
  assert.deepEqual(lockState?.bootstrapped_emails, [
    'minhquantran4312@gmail.com',
    'tamtranmusic@gmail.com',
  ]);

  // 3. Second execution of executeOneTimeSuperAdminBootstrap is strictly rejected (Run-Once security measure)
  const secondRun = await executeOneTimeSuperAdminBootstrap({
    rawBootstrapEmailEnv: 'minhquantran4312@gmail.com,tamtranmusic@gmail.com',
    adapter,
    nowMs: 1793509060000,
    actorLabel: 'test_bootstrap_cli_retry',
  });

  assert.equal(secondRun.ok, false);
  assert.equal(secondRun.status, 409);
  assert.equal(secondRun.code, 'BOOTSTRAP_ALREADY_EXECUTED_ONCE');

  // 4. Subsequent HTTP endpoint call to store.bootstrapSuperAdmin is also rejected by the same Run-Once lock
  const apiRetry = store.bootstrapSuperAdmin(
    {
      uid: 'uid-superadmin-02',
      email: 'tamtranmusic@gmail.com',
      email_verified: true,
    },
    'minhquantran4312@gmail.com,tamtranmusic@gmail.com',
    1793509090000
  );
  assert.equal(apiRetry.ok, false);
  assert.equal(apiRetry.status, 409);
  assert.equal(apiRetry.code, 'BOOTSTRAP_ALREADY_EXECUTED_ONCE');

  // 5. Verify RTDB Rules grant access to token with `admin: true` and block client writes to `/system_locks`
  const adminClaimOnlyAuth: RtdbAuthContext = {
    uid: 'uid-superadmin-02',
    token: {
      email: 'tamtranmusic@gmail.com',
      email_verified: true,
      admin: true,
      role: 'superadmin',
    },
  };
  assert.equal(
    store.clientReadWithRules({ auth: adminClaimOnlyAuth, path: '/system_locks/superadmin_bootstrap' }).allowed,
    true
  );
  assert.equal(
    store.clientWriteWithRules({
      auth: adminClaimOnlyAuth,
      path: '/system_locks/superadmin_bootstrap',
      value: null,
    }).allowed,
    false
  );
});

test('P02 #7 (T05, T06, T07, T08, T09, T28): 28-day manifest integrity, idempotent progress, Day 28 certificate request queue, and Admin CMS source/clinical publish guard', async () => {
  const {
    ASSET_NAME_NORMALIZATION,
    EXTERNAL_LINKS,
    LEARNING_DAYS_28,
    PRESS_LINKS,
    PROFESSIONAL_CERTIFICATES,
    TEAM_MEMBERS,
  } = await import('../data/sourceMapping');

  // T05 & T06: 28 days across 4 weeks, each day uses standalone /assets/drive/day{1..28}.png (not sliced from full_flashcard.png)
  assert.equal(LEARNING_DAYS_28.length, 28);
  assert.equal(LEARNING_DAYS_28.filter((d) => d.week_number === 1).length, 7);
  assert.equal(LEARNING_DAYS_28.filter((d) => d.week_number === 2).length, 7);
  assert.equal(LEARNING_DAYS_28.filter((d) => d.week_number === 3).length, 7);
  assert.equal(LEARNING_DAYS_28.filter((d) => d.week_number === 4).length, 7);

  for (const d of LEARNING_DAYS_28) {
    assert.equal(d.primary_asset.runtime_url, `/assets/drive/day${d.day_number}.png`);
    assert.equal(d.primary_asset.original_bytes_downloaded, true);
  }

  const day25 = LEARNING_DAYS_28.find((d) => d.day_number === 25)!;
  assert.equal(day25.title_transcribed, 'Sáng tạo flashcard riêng');
  assert.equal(day25.primary_asset.runtime_url, '/assets/drive/day25.png');
  assert.equal(day25.info_asset.name, 'in4 d25.png');
  assert.equal(day25.info_asset.runtime_url, '/assets/drive/in4%20d25.png');
  assert.equal(day25.medal_asset.name, 'HC d25.png');
  assert.equal(day25.medal_asset.runtime_url, '/assets/drive/HC%20d25.png');
  assert.equal(day25.next_day, 26);

  const day27 = LEARNING_DAYS_28.find((d) => d.day_number === 27)!;
  assert.equal(day27.info_asset.status, 'not_yet_verified');

  const day28 = LEARNING_DAYS_28.find((d) => d.day_number === 28)!;
  assert.equal(day28.next_day, null);
  assert.equal(day28.medal_asset.status, 'special_day28_certificate_flow');

  // T09: Menu & Asset normalization mapping (exact 6 URLs from YEU_CAU_GOC_TRICH_VAN_BAN.md)
  assert.equal(PRESS_LINKS.length, 6);
  assert.equal(PRESS_LINKS[0].url, 'https://rajournals.in/index.php/rajar/article/view/1797');
  assert.equal(
    PRESS_LINKS[5].url,
    'https://baodanang.vn/de-y-tuong-khoi-nghiep-tu-cuoc-thi-buoc-vao-thuc-te-3346332.html'
  );
  assert.equal(TEAM_MEMBERS.length, 4);
  assert.equal(PROFESSIONAL_CERTIFICATES.length, 4);
  assert.equal(ASSET_NAME_NORMALIZATION['Baochi.png'].actualDriveName, 'Bao.png');
  assert.equal(ASSET_NAME_NORMALIZATION['Chip CV.png'].actualDriveName, 'chip CV.png');
  assert.equal(ASSET_NAME_NORMALIZATION['in4 Leade.png'].actualDriveName, 'in4 leade.png');
  assert.ok(EXTERNAL_LINKS.botAiGpt.includes('brightupgenz'));
  assert.ok(EXTERNAL_LINKS.facebookCommunity.includes('61591629700255'));

  // T07: Idempotent self-completion on learning_progress/{student_id}/{day}
  const store = new P01RbacDomainService();
  const studentActor = {
    uid: 'uid-student-a1',
    email: 'hocsinh.minh.a1@example.com',
    email_verified: true,
    role: 'student' as const,
  };

  // stu-a1 starts with Day 1 already completed in fixture
  const firstComplete25 = store.recordDaySelfCompleted(
    studentActor,
    { student_id: 'stu-a1', day_number: 25 },
    1793600000000
  );
  assert.equal(firstComplete25.ok, true);
  assert.equal(firstComplete25.alreadyCompleted, false);
  assert.equal(firstComplete25.completedCount, 2); // Day 1 + Day 25

  // Reload / click medal again on Day 25 -> idempotent, completedCount stays 2 and self_completed_at is unchanged
  const secondComplete25 = store.recordDaySelfCompleted(
    studentActor,
    { student_id: 'stu-a1', day_number: 25 },
    1793600099999
  );
  assert.equal(secondComplete25.ok, true);
  assert.equal(secondComplete25.alreadyCompleted, true);
  assert.equal(secondComplete25.completedCount, 2);
  assert.equal(secondComplete25.progress?.self_completed_at, 1793600000000);

  // Reject Day 29
  const day29Attempt = store.recordDaySelfCompleted(
    studentActor,
    { student_id: 'stu-a1', day_number: 29 },
    1793600100000
  );
  assert.equal(day29Attempt.ok, false);
  assert.equal(day29Attempt.status, 400);

  // T08: Day 28 Certificate Request submission & base64 rejection
  const base64Attempt = store.submitCertificateRequest(
    studentActor,
    {
      student_id: 'stu-a1',
      guardian_email: 'phuhuynh.a@example.com',
      reflection_text: 'Sau 28 ngày em ngồi thẳng lưng hơn rất nhiều!',
      achievement_photo_name: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA',
    },
    1793600200000
  );
  assert.equal(base64Attempt.ok, false);
  assert.equal(base64Attempt.status, 400);

  const validCertReq = store.submitCertificateRequest(
    studentActor,
    {
      student_id: 'stu-a1',
      guardian_email: 'phuhuynh.a@example.com',
      reflection_text: 'Sau 28 ngày em đã tạo được thói quen giữ mắt cách vở 30cm và bàn học gọn gàng!',
      achievement_photo_name: 'goc-hoc-tap-minh-ngay28.jpg',
    },
    1793600300000
  );
  assert.equal(validCertReq.ok, true);
  assert.equal(validCertReq.status, 201);
  assert.equal(validCertReq.request?.status, 'received');

  // Verify RTDB Rules isolate certificate_requests/{student_id} between Family A and Family B
  assert.equal(
    store.clientReadWithRules({
      auth: guardianAAuth,
      path: '/certificate_requests/stu-a1',
    }).allowed,
    true
  );
  assert.equal(
    store.clientReadWithRules({
      auth: guardianBAuth,
      path: '/certificate_requests/stu-a1',
    }).allowed,
    false
  );

  // T28: Admin CMS publish guard blocks unverified info_asset (Day 27) or active clinical_review_flag (Day 1, Day 11)
  const superAdminActor = {
    uid: 'uid-superadmin-01',
    email: 'minhquantran4312@gmail.com',
    email_verified: true,
    superadmin: true,
    role: 'superadmin' as const,
  };

  // Day 27 has info_asset.status = 'not_yet_verified' -> publish must be blocked (422)
  const blockedUnverifiedDay27 = store.adminUpdateLearningDay(
    superAdminActor,
    {
      day_number: 27,
      publish_status: 'published',
    },
    1793600400000
  );
  assert.equal(blockedUnverifiedDay27.ok, false);
  assert.equal(blockedUnverifiedDay27.status, 422);

  // Day 11 has clinical_review_flag=true -> blocked until clinical flag cleared
  const blockedClinicalDay11 = store.adminUpdateLearningDay(
    superAdminActor,
    {
      day_number: 11,
      publish_status: 'published',
    },
    1793600450000
  );
  assert.equal(blockedClinicalDay11.ok, false);
  assert.equal(blockedClinicalDay11.status, 422);

  // Clear clinical_review_flag on Day 11 and publish -> succeeds (200), bumps version, and writes audit log
  const validPublishDay11 = store.adminUpdateLearningDay(
    superAdminActor,
    {
      day_number: 11,
      clinical_review_flag: false,
      publish_status: 'published',
    },
    1793600500000
  );
  assert.equal(validPublishDay11.ok, true);
  assert.equal(validPublishDay11.status, 200);
  assert.equal(validPublishDay11.day?.publish_status, 'published');
  assert.equal(validPublishDay11.day?.source_version, 'v1.4-p02-drive-covers-webp.r1');
});

test('P03 T11 & T18: Monitoring command ACK contract, expired command rejection, LWT presence, and student session switch isolation', () => {
  const store = new P01RbacDomainService();
  const guardianActor = {
    uid: 'uid-guardian-a',
    email: 'phuhuynh.a@example.com',
    email_verified: true,
    superadmin: false,
    role: 'guardian' as const,
  };

  // Start a fresh session for stu-a1 (closes any open session first)
  const startA1 = store.startRobotSession(
    guardianActor,
    {
      device_id: 'robot-fam-a-01',
      student_id: 'stu-a1',
      source: 'real',
      auto_close_previous: true,
    },
    1793501000000
  );
  assert.equal(startA1.ok, true);
  const sessionA1Id = startA1.session_id!;

  // Before ACK: monitoring_enabled=true, monitoring_active=false
  const cmdRes = store.sendDeviceMonitoringCommand(
    guardianActor,
    {
      device_id: 'robot-fam-a-01',
      monitoring_enabled: true,
      ttl_sec: 30,
    },
    1793501001000
  );
  assert.equal(cmdRes.ok, true);
  assert.equal(cmdRes.command_job?.retain, false);
  const devBeforeAck = store.getState().devices['robot-fam-a-01'];
  assert.equal(devBeforeAck.monitoring_enabled, true);
  assert.equal(devBeforeAck.monitoring_active, false);

  // Robot ACK after expiry must be rejected (410 COMMAND_EXPIRED)
  const expiredAck = store.ingestMqttPacket(
    {
      topic: 'bugz/v1/devices/robot-fam-a-01/acks',
      isWebhookAuthenticated: true,
      brokerClientId: 'robot-fam-a-01',
      payload: {
        schema_version: 1,
        event_id: 'evt-ack-expired',
        device_id: 'robot-fam-a-01',
        command_id: cmdRes.command_job!.command_id,
        applied_config_version: cmdRes.command_job!.config_version,
        monitoring_active: true,
        observed_at: 1793501050000, // > expires_at (1793501031000)
      },
    },
    1793501050000
  );
  assert.equal(expiredAck.ok, false);
  assert.equal(expiredAck.status, 410);
  assert.equal(store.getState().devices['robot-fam-a-01'].monitoring_active, false);

  // Issue a new command and send valid Robot ACK within TTL -> sets monitoring_active=true
  const cmdRes2 = store.sendDeviceMonitoringCommand(
    guardianActor,
    {
      device_id: 'robot-fam-a-01',
      monitoring_enabled: true,
      ttl_sec: 30,
    },
    1793501002000
  );
  assert.equal(cmdRes2.ok, true);

  const validAck = store.ingestMqttPacket(
    {
      topic: 'bugz/v1/devices/robot-fam-a-01/acks',
      isWebhookAuthenticated: true,
      brokerClientId: 'robot-fam-a-01',
      payload: {
        schema_version: 1,
        event_id: 'evt-ack-valid',
        device_id: 'robot-fam-a-01',
        command_id: cmdRes2.command_job!.command_id,
        applied_config_version: cmdRes2.command_job!.config_version,
        monitoring_active: true,
        observed_at: 1793501005000,
      },
    },
    1793501005000
  );
  assert.equal(validAck.ok, true);
  assert.equal(store.getState().devices['robot-fam-a-01'].monitoring_active, true);

  // LWT / Offline presence turns monitoring_active=false and runtime presence_status='offline'
  const lwtPresence = store.ingestMqttPacket(
    {
      topic: 'bugz/v1/devices/robot-fam-a-01/presence',
      isWebhookAuthenticated: true,
      brokerClientId: 'robot-fam-a-01',
      payload: {
        schema_version: 1,
        device_id: 'robot-fam-a-01',
        status: 'offline',
        observed_at: 1793501010000,
      },
    },
    1793501010000
  );
  assert.equal(lwtPresence.ok, true);
  assert.equal(store.getState().device_runtime['robot-fam-a-01'].presence_status, 'offline');
  assert.equal(store.getState().devices['robot-fam-a-01'].monitoring_active, false);

  // T18: Create second child stu-a2 in Family A so Guardian A can switch the Robot between two children
  store.getState().students['stu-a2'] = {
    student_id: 'stu-a2',
    display_name: 'Bé An (Con thứ 2 Gia đình A)',
    age_group: 'middle_11_15',
    guardian_owner_uid: 'uid-guardian-a',
    created_at: 1793501015000,
    timezone: 'Asia/Ho_Chi_Minh',
  };
  store.getState().guardian_students['uid-guardian-a']['stu-a2'] = {
    relationship: 'parent_owner',
    verified_at: 1793501015000,
    can_manage: true,
  };

  // T18: Starting a session for stu-a2 without auto_close_previous when stu-a1 is open -> 409 conflict
  const conflictSwitch = store.startRobotSession(
    guardianActor,
    {
      device_id: 'robot-fam-a-01',
      student_id: 'stu-a2',
      source: 'real',
      auto_close_previous: false,
    },
    1793501020000
  );
  assert.equal(conflictSwitch.ok, false);
  assert.equal(conflictSwitch.status, 409);

  // T18: Switching to stu-a2 with auto_close_previous=true closes stu-a1's session first and opens a clean session for stu-a2
  const cleanSwitch = store.startRobotSession(
    guardianActor,
    {
      device_id: 'robot-fam-a-01',
      student_id: 'stu-a2',
      source: 'real',
      auto_close_previous: true,
    },
    1793501025000
  );
  assert.equal(cleanSwitch.ok, true);
  assert.equal(cleanSwitch.closed_previous_session_id, sessionA1Id);
  const closedSessionA1 = store.getState().sessions['robot-fam-a-01'][sessionA1Id];
  assert.equal(typeof closedSessionA1.ended_at, 'number');
  assert.equal(closedSessionA1.student_id, 'stu-a1');
  assert.equal(cleanSwitch.session?.student_id, 'stu-a2');
  assert.notEqual(cleanSwitch.session_id, sessionA1Id);
});

test('P03 T12: Exact mqtt_examples.json 81-message trace produces good -> bad -> good -> bad = 2 / 2 and alert at 1793502035000', async () => {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const rawJson = fs.readFileSync(path.resolve(process.cwd(), 'mqtt_examples.json'), 'utf8');
  const examples = JSON.parse(rawJson);

  const store = new P01RbacDomainService();
  const superAdminActor = {
    uid: 'uid-superadmin-01',
    email: 'minhquantran4312@gmail.com',
    email_verified: true,
    superadmin: true,
    role: 'superadmin' as const,
  };

  // Start session-demo-001 on sim-dev01 for stu-a1
  const startedSim = store.startRobotSession(
    superAdminActor,
    {
      device_id: 'sim-dev01',
      student_id: 'stu-a1',
      source: 'simulator',
      custom_session_id: 'session-demo-001',
      auto_close_previous: true,
    },
    1793501999000
  );
  assert.equal(startedSim.ok, true);

  const traceMessages: Array<Record<string, unknown>> = examples.trace_good_bad_good_bad.messages;
  assert.equal(traceMessages.length, 81);

  for (const msg of traceMessages) {
    const res = store.ingestMqttPacket(
      {
        topic: 'bugz/v1/devices/sim-dev01/observations',
        actor: superAdminActor,
        payload: msg,
      },
      Number(msg.observed_at)
    );
    assert.equal(res.ok, true);
  }

  const snapshot = store.getState();
  const demoSession = snapshot.sessions['sim-dev01']['session-demo-001'];
  assert.equal(demoSession.good_count, 2);
  assert.equal(demoSession.bad_count, 2);
  assert.equal(demoSession.alert_count, 2);

  // Verify first alert timestamp matches mqtt_examples.json alert_projection_example.created_at (1793502035000)
  const alertsMap = snapshot.alerts['sim-dev01']['session-demo-001'];
  const alertList = Object.values(alertsMap).sort((a, b) => a.created_at - b.created_at);
  assert.equal(alertList.length, 2);
  assert.equal(alertList[0].created_at, examples.alert_projection_example.created_at);
  assert.equal(alertList[0].student_id, 'stu-a1');
  assert.equal(alertList[0].source, 'simulator');
});

test('P03 T13, T14, T15, T16, T17, T20: 1 bad episode with 2 reminders, QoS1 dedupe, crash-before-fanout recovery, out-of-order/closed-session drop, moving/absent/uncalibrated normalization, and malformed/ACL guards', () => {
  const store = new P01RbacDomainService();
  const guardianActor = {
    uid: 'uid-guardian-a',
    email: 'phuhuynh.a@example.com',
    email_verified: true,
    superadmin: false,
    role: 'guardian' as const,
  };

  // Start clean session on robot-fam-a-01 for stu-a1
  const started = store.startRobotSession(
    guardianActor,
    {
      device_id: 'robot-fam-a-01',
      student_id: 'stu-a1',
      source: 'real',
      auto_close_previous: true,
    },
    1793600000000
  );
  assert.equal(started.ok, true);
  const sessionId = started.session_id!;

  // T20: Spoofed device ACL mismatch must be rejected with 403
  const spoofedRes = store.ingestMqttPacket(
    {
      topic: 'bugz/v1/devices/robot-fam-a-01/observations',
      isWebhookAuthenticated: true,
      brokerClientId: 'robot-fam-b-01',
      payload: {
        schema_version: 1,
        event_id: 'evt-spoof-1',
        device_id: 'robot-fam-a-01',
        session_id: sessionId,
        boot_id: 'boot-test-1',
        sequence: 1,
        observed_at: 1793600001000,
        posture: 'good',
        confidence: 0.95,
        person_present: true,
        robot_moving: false,
        calibration_valid: true,
        source: 'real',
      },
    },
    1793600001000
  );
  assert.equal(spoofedRes.ok, false);
  assert.equal(spoofedRes.status, 403);

  // T20: Non-superadmin attempting to inject source='simulator' without webhook auth is rejected with 403
  const unauthorizedSimRes = store.ingestMqttPacket(
    {
      topic: 'bugz/v1/devices/robot-fam-a-01/observations',
      isWebhookAuthenticated: false,
      actor: guardianActor,
      payload: {
        schema_version: 1,
        event_id: 'evt-unauth-sim',
        device_id: 'robot-fam-a-01',
        session_id: sessionId,
        boot_id: 'boot-test-1',
        sequence: 1,
        observed_at: 1793600001000,
        posture: 'good',
        confidence: 0.95,
        person_present: true,
        robot_moving: false,
        calibration_valid: true,
        source: 'simulator',
      },
    },
    1793600001000
  );
  assert.equal(unauthorizedSimRes.ok, false);
  assert.equal(unauthorizedSimRes.status, 403);

  // T20: Malformed payload with base64 image is rejected with 413 PAYLOAD_TOO_LARGE_OR_BASE64_FORBIDDEN
  const base64Res = store.ingestMqttPacket(
    {
      topic: 'bugz/v1/devices/robot-fam-a-01/observations',
      isWebhookAuthenticated: true,
      brokerClientId: 'robot-fam-a-01',
      payload: {
        schema_version: 1,
        event_id: 'evt-base64',
        device_id: 'robot-fam-a-01',
        session_id: sessionId,
        boot_id: 'boot-test-1',
        sequence: 1,
        observed_at: 1793600001000,
        posture: 'bad',
        confidence: 0.95,
        person_present: true,
        robot_moving: false,
        calibration_valid: true,
        image_base64: 'data:image/jpeg;base64,/9j/4AAQSkZJRg==',
        source: 'real',
      },
    },
    1793600001000
  );
  assert.equal(base64Res.ok, false);
  assert.equal(base64Res.status, 413);

  // T17: Send 2 seconds of 'bad', then interrupt with robot_moving=true, calibration_valid=false, low confidence, and absent
  // None of these should count as a bad episode!
  let seq = 1;
  let ts = 1793600000000;
  const sendObs = (overrides: Record<string, unknown>, crashBeforeFanout = false) => {
    const currentSeq = (overrides.sequence as number) ?? seq++;
    const currentTs = (overrides.observed_at as number) ?? (ts += 1000);
    return store.ingestMqttPacket(
      {
        topic: 'bugz/v1/devices/robot-fam-a-01/observations',
        isWebhookAuthenticated: true,
        brokerClientId: 'robot-fam-a-01',
        simulateCrashBeforeFanout: crashBeforeFanout,
        payload: {
          schema_version: 1,
          event_id: `evt-test-${currentSeq}`,
          device_id: 'robot-fam-a-01',
          session_id: sessionId,
          boot_id: 'boot-test-1',
          sequence: currentSeq,
          observed_at: currentTs,
          posture: 'bad',
          confidence: 0.91,
          person_present: true,
          robot_moving: false,
          calibration_valid: true,
          source: 'real',
          ...overrides,
        },
      },
      currentTs
    );
  };

  // 2s of bad (less than 3s stability threshold)
  sendObs({ posture: 'bad' }); // t=1000
  sendObs({ posture: 'bad' }); // t=2000
  // Interrupted by robot_moving=true -> normalized to 'unknown', resets bad candidate!
  sendObs({ posture: 'bad', robot_moving: true }); // t=3000
  assert.equal(store.getState().devices['robot-fam-a-01'].current_posture, 'unknown');
  // Interrupted by calibration_valid=false -> normalized to 'unknown'
  sendObs({ posture: 'bad', calibration_valid: false }); // t=4000
  assert.equal(store.getState().devices['robot-fam-a-01'].current_posture, 'unknown');
  // Interrupted by low confidence (0.40 < 0.70) -> normalized to 'unknown'
  sendObs({ posture: 'bad', confidence: 0.4 }); // t=5000
  assert.equal(store.getState().devices['robot-fam-a-01'].current_posture, 'unknown');
  // Interrupted by person_present=false -> normalized to 'absent'
  sendObs({ posture: 'bad', person_present: false }); // t=6000
  assert.equal(store.getState().devices['robot-fam-a-01'].current_posture, 'absent');

  assert.equal(store.getState().sessions['robot-fam-a-01'][sessionId].bad_count, 0);

  // T13: Now sustain 1 continuous bad episode for 96 seconds (from t=7000 to t=103000)
  // Stability at +3s -> bad_count becomes 1 (and stays 1 for the entire continuous episode!)
  // Alert #1 at +30s from bad episode start; Reminder Alert #2 at +60s cooldown after Alert #1 (+90s total)
  for (let i = 0; i < 96; i++) {
    // At i === 30 (when first alert triggers), test T15 crash-before-fanout!
    const shouldCrash = i === 30;
    const res = sendObs({ posture: 'bad' }, shouldCrash);
    assert.equal(res.ok, true);
    if (shouldCrash) {
      assert.equal(res.status, 202);
      assert.equal(res.code, 'COMMITTED_RUNTIME_CRASHED_BEFORE_FANOUT');
      // Outbox has uncommitted item not yet projected to alerts
      const pendingBefore = Object.values(
        store.getState().device_runtime['robot-fam-a-01'].outbox
      ).filter((item) => !item.committed_at);
      assert.equal(pendingBefore.length > 0, true);
      // Worker drain recovers and projects idempotently
      const drainRes = store.runDeviceProjectionWorker('robot-fam-a-01', ts + 50);
      assert.equal(drainRes.projectedCount > 0, true);
      // Draining a second time is a no-op (projectedCount === 0)
      const secondDrain = store.runDeviceProjectionWorker('robot-fam-a-01', ts + 100);
      assert.equal(secondDrain.projectedCount, 0);
    }
  }

  const sessAfterLongBad = store.getState().sessions['robot-fam-a-01'][sessionId];
  assert.equal(sessAfterLongBad.bad_count, 1);
  assert.equal(sessAfterLongBad.alert_count, 2);

  // Verify missing posture_code produced general polite message without fake cm
  const sessionAlerts = Object.values(store.getState().alerts['robot-fam-a-01'][sessionId]);
  assert.equal(sessionAlerts.length, 2);
  assert.equal(sessionAlerts[0].posture_code, undefined);
  assert.equal(sessionAlerts[0].message.includes('Tư thế chưa phù hợp'), true);
  assert.equal(sessionAlerts[0].message.includes('cm'), false);

  // T14: Send the exact same event_id 3 times -> processed once, 2nd & 3rd return duplicate_event
  const lastSeq = seq - 1;
  const lastTs = ts;
  const dup1 = sendObs({ event_id: `evt-test-${lastSeq}`, sequence: lastSeq, observed_at: lastTs });
  const dup2 = sendObs({ event_id: `evt-test-${lastSeq}`, sequence: lastSeq, observed_at: lastTs });
  assert.equal(dup1.ignoredReason, 'duplicate_event');
  assert.equal(dup2.ignoredReason, 'duplicate_event');
  assert.equal(store.getState().sessions['robot-fam-a-01'][sessionId].bad_count, 1);
  assert.equal(store.getState().sessions['robot-fam-a-01'][sessionId].alert_count, 2);

  // T16: Out-of-order / stale sequence within same boot_id is rejected (409 STALE_SEQUENCE_REJECTED)
  const staleRes = sendObs({ event_id: 'evt-stale-seq', sequence: 2, observed_at: ts + 1000 });
  assert.equal(staleRes.ok, false);
  assert.equal(staleRes.status, 409);
  assert.equal(staleRes.ignoredReason, 'stale_sequence');

  // T16: Close session, then send a late packet -> rejected with 409 SESSION_CLOSED
  const endRes = store.endRobotSession(
    guardianActor,
    { device_id: 'robot-fam-a-01', session_id: sessionId },
    ts + 2000
  );
  assert.equal(endRes.ok, true);
  const lateRes = sendObs({ event_id: 'evt-after-close', sequence: seq + 10, observed_at: ts + 3000 });
  assert.equal(lateRes.ok, false);
  assert.equal(lateRes.status, 409);
  assert.equal(lateRes.ignoredReason, 'session_closed');
});

test('P03 T19 & T25: Private capture upload ticket/complete/failure/RBAC and Vietnam timezone history with cross-midnight episode & pagination', () => {
  const store = new P01RbacDomainService();
  const guardianAActor = {
    uid: 'uid-guardian-a',
    email: 'phuhuynh.a@example.com',
    email_verified: true,
    superadmin: false,
    role: 'guardian' as const,
  };
  const guardianBActor = {
    uid: 'uid-guardian-b',
    email: 'phuhuynh.b@example.com',
    email_verified: true,
    superadmin: false,
    role: 'guardian' as const,
  };
  const superAdminActor = {
    uid: 'uid-superadmin-01',
    email: 'minhquantran4312@gmail.com',
    email_verified: true,
    superadmin: true,
    role: 'superadmin' as const,
  };

  // Start an open session on robot-fam-a-01 for stu-a1 so we can issue capture upload tickets
  const started = store.startRobotSession(
    guardianAActor,
    {
      device_id: 'robot-fam-a-01',
      student_id: 'stu-a1',
      source: 'real',
      auto_close_previous: true,
    },
    1793503000000
  );
  assert.equal(started.ok, true);
  const openSessId = started.session_id!;

  // Create an alert referencing capture-a-001-uploaded
  if (!store.getState().alerts['robot-fam-a-01'][openSessId]) {
    store.getState().alerts['robot-fam-a-01'][openSessId] = {};
  }
  store.getState().alerts['robot-fam-a-01'][openSessId]['alert-cap-test'] = {
    alert_id: 'alert-cap-test',
    device_id: 'robot-fam-a-01',
    session_id: openSessId,
    student_id: 'stu-a1',
    message: 'Tư thế chưa phù hợp — Mình thả lỏng vai rồi chỉnh chỗ ngồi ngay ngắn nhé!',
    created_at: 1793503005000,
    is_read: false,
    image_id: 'capture-a-001-uploaded',
    capture_status: 'pending',
    source: 'real',
  };

  // T19: Request upload ticket and complete upload
  const ticketOk = store.requestCaptureUploadTicket(
    {
      device_id: 'robot-fam-a-01',
      session_id: openSessId,
      capture_id: 'capture-a-001-uploaded',
      mime_type: 'image/jpeg',
      byte_size: 48200,
    },
    1793503006000
  );
  assert.equal(ticketOk.ok, true);
  assert.equal(Boolean(ticketOk.ticket?.upload_ticket_token), true);

  const uploadComplete = store.completeCaptureUpload(
    {
      capture_id: 'capture-a-001-uploaded',
      upload_ticket_token: ticketOk.ticket!.upload_ticket_token,
    },
    1793503010000
  );
  assert.equal(uploadComplete.ok, true);
  assert.equal(uploadComplete.metadata?.status, 'uploaded');

  // Verify RTDB alerts node does NOT store base64
  const alertNode = store.getState().alerts['robot-fam-a-01'][openSessId]['alert-cap-test'];
  assert.equal(JSON.stringify(alertNode).includes('data:image/'), false);
  assert.equal(alertNode.capture_status, 'uploaded');

  // Guardian A can read capture
  const readByOwner = store.readCaptureForActor(
    guardianAActor,
    { capture_id: 'capture-a-001-uploaded' },
    1793503020000
  );
  assert.equal(readByOwner.ok, true);
  assert.equal(Boolean(readByOwner.signedViewDescriptor?.preview_svg_data_uri), true);

  // Guardian B (other family) is strictly denied (403)
  const readByOtherFamily = store.readCaptureForActor(
    guardianBActor,
    { capture_id: 'capture-a-001-uploaded' },
    1793503020000
  );
  assert.equal(readByOtherFamily.ok, false);
  assert.equal(readByOtherFamily.status, 403);

  // SuperAdmin can read for technical support and generates an audit log
  const auditCountBefore = Object.keys(store.getState().audit_logs).length;
  const readByAdmin = store.readCaptureForActor(
    superAdminActor,
    { capture_id: 'capture-a-001-uploaded', support_reason: 'Kiểm tra kỹ thuật T19' },
    1793503025000
  );
  assert.equal(readByAdmin.ok, true);
  const auditCountAfter = Object.keys(store.getState().audit_logs).length;
  assert.equal(auditCountAfter, auditCountBefore + 1);

  // T19: Simulate a failed upload on a second ticket -> alert remains intact with capture_status='failed'
  store.getState().alerts['robot-fam-a-01'][openSessId]['alert-cap-test'].image_id =
    'capture-a-001-failed';
  const ticketFail = store.requestCaptureUploadTicket(
    {
      device_id: 'robot-fam-a-01',
      session_id: openSessId,
      capture_id: 'capture-a-001-failed',
      mime_type: 'image/jpeg',
      byte_size: 32000,
    },
    1793503030000
  );
  assert.equal(ticketFail.ok, true);
  const failedUpload = store.completeCaptureUpload(
    {
      capture_id: 'capture-a-001-failed',
      upload_ticket_token: ticketFail.ticket!.upload_ticket_token,
      simulate_failure: true,
      failure_reason: 'Network timeout while uploading to Cloud Storage',
    },
    1793503035000
  );
  assert.equal(failedUpload.ok, false);
  assert.equal(failedUpload.status, 502);
  assert.equal(failedUpload.metadata?.status, 'failed');
  assert.equal(
    store.getState().alerts['robot-fam-a-01'][openSessId]['alert-cap-test'].capture_status,
    'failed'
  );

  // T25: Cross-midnight episode in Asia/Ho_Chi_Minh (UTC+7)
  // 2026-11-02 23:59:00 ICT = 2026-11-02T16:59:00.000Z (1793638740000)
  // 2026-11-03 00:02:00 ICT = 2026-11-02T17:02:00.000Z (1793638920000)
  const crossMidnightStartMs = Date.parse('2026-11-02T16:59:00.000Z');
  const crossMidnightEndMs = Date.parse('2026-11-02T17:02:00.000Z');
  store.getState().episode_log['stu-a1']['ep-cross-midnight'] = {
    episode_id: 'ep-cross-midnight',
    device_id: 'robot-fam-a-01',
    session_id: openSessId,
    student_id: 'stu-a1',
    state: 'bad',
    started_at: crossMidnightStartMs,
    ended_at: crossMidnightEndMs,
    stable_duration_ms: 180000,
    source: 'real',
    revision: 99,
  };

  // Querying 2026-11-02 ICT [2026-11-01T17:00:00Z, 2026-11-02T17:00:00Z) includes the episode (started_at is in 2026-11-02 ICT)
  const histNov02 = store.queryRobotHistory(guardianAActor, {
    student_id: 'stu-a1',
    preset: 'custom',
    custom_from_utc_ms: Date.parse('2026-11-01T17:00:00.000Z'),
    custom_to_utc_ms: Date.parse('2026-11-02T17:00:00.000Z'),
    page_size: 1,
  });
  assert.equal(histNov02.ok, true);
  assert.equal(
    histNov02.episodesInRange?.some((ep) => ep.episode_id === 'ep-cross-midnight'),
    true
  );

  // Querying 2026-11-03 ICT [2026-11-02T17:00:00Z, 2026-11-03T17:00:00Z) does NOT count the episode again (counted once by started_at!)
  const histNov03 = store.queryRobotHistory(guardianAActor, {
    student_id: 'stu-a1',
    preset: 'custom',
    custom_from_utc_ms: Date.parse('2026-11-02T17:00:00.000Z'),
    custom_to_utc_ms: Date.parse('2026-11-03T17:00:00.000Z'),
  });
  assert.equal(histNov03.ok, true);
  assert.equal(
    histNov03.episodesInRange?.some((ep) => ep.episode_id === 'ep-cross-midnight'),
    false
  );
});

test('P04 T20: Server-side recipient routing ignores spoofed student_id/email in MQTT payload and distinguishes multiple children in a family', () => {
  const store = new P01RbacDomainService();
  const guardianAActor = {
    uid: 'uid-guardian-a',
    email: 'phuhuynh.a@example.com',
    email_verified: true,
    superadmin: false,
    role: 'guardian' as const,
  };
  const guardianBActor = {
    uid: 'uid-guardian-b',
    email: 'phuhuynh.b@example.com',
    email_verified: true,
    superadmin: false,
    role: 'guardian' as const,
  };

  // Start session for second child stu-a2-no-google on robot-fam-a-01
  const startedA2 = store.startRobotSession(
    guardianAActor,
    {
      device_id: 'robot-fam-a-01',
      student_id: 'stu-a2-no-google',
      source: 'real',
      auto_close_previous: true,
    },
    1793700000000
  );
  assert.equal(startedA2.ok, true);
  const sessA2 = startedA2.session_id!;

  // Send 31s of bad posture with SPOOFED student_id='stu-b1' and SPOOFED email='phuhuynh.b@example.com' in MQTT payload
  for (let i = 1; i <= 31; i++) {
    const obsRes = store.ingestMqttPacket(
      {
        topic: 'bugz/v1/devices/robot-fam-a-01/observations',
        isWebhookAuthenticated: true,
        brokerClientId: 'robot-fam-a-01',
        payload: {
          schema_version: 1,
          event_id: `evt-p04-spoof-${i}`,
          device_id: 'robot-fam-a-01',
          session_id: sessA2,
          boot_id: 'boot-p04-1',
          sequence: i,
          observed_at: 1793700000000 + i * 1000,
          posture: 'bad',
          posture_code: 'head_too_close',
          confidence: 0.94,
          person_present: true,
          robot_moving: false,
          calibration_valid: true,
          source: 'real',
          // Malicious spoofed fields in MQTT payload:
          student_id: 'stu-b1',
          email: 'phuhuynh.b@example.com',
          recipient_uid: 'uid-guardian-b',
        },
      },
      1793700000000 + i * 1000
    );
    assert.equal(obsRes.ok, true);
  }

  const sessAlerts = Object.values(store.getState().alerts['robot-fam-a-01'][sessA2] || {});
  assert.equal(sessAlerts.length, 1);
  const newAlert = sessAlerts[0];

  // Server strictly bound the alert to session.student_id ('stu-a2-no-google'), NOT spoofed 'stu-b1'
  assert.equal(newAlert.student_id, 'stu-a2-no-google');

  // Verify notification jobs created for this alert: ONLY uid-guardian-a received jobs; uid-guardian-b received ZERO
  const jobsForAlert = Object.values(store.getState().notification_jobs).filter(
    (j) => j.alert_id === newAlert.alert_id
  );
  assert.equal(jobsForAlert.length > 0, true);
  assert.equal(
    jobsForAlert.every((j) => j.uid === 'uid-guardian-a'),
    true
  );
  assert.equal(
    jobsForAlert.some((j) => j.uid === 'uid-guardian-b' || j.recipient_email === 'phuhuynh.b@example.com'),
    false
  );

  // Verify multi-child differentiation: Guardian A inspecting newAlert sees 'Bé Na (Hồ sơ con thứ 2)'
  // while inspecting alert-a-001 sees 'Trần Minh Quân (Học sinh A1)'
  const detailA2 = store.getAlertDetailForActor(guardianAActor, { alert_id: newAlert.alert_id! });
  assert.equal(detailA2.ok, true);
  assert.equal(detailA2.alert?.student_id, 'stu-a2-no-google');
  assert.equal(detailA2.alert?.student_display_name.includes('Bé Na'), true);
  assert.equal(detailA2.alert?.device_id, 'robot-fam-a-01');

  const detailA1 = store.getAlertDetailForActor(guardianAActor, { alert_id: 'alert-a-001' });
  assert.equal(detailA1.ok, true);
  assert.equal(detailA1.alert?.student_id, 'stu-a1');
  assert.equal(detailA1.alert?.student_display_name.includes('Bé Minh'), true);

  // Guardian B is blocked from reading Family A's alert (403)
  const crossRead = store.getAlertDetailForActor(guardianBActor, { alert_id: newAlert.alert_id! });
  assert.equal(crossRead.ok, false);
  assert.equal(crossRead.status, 403);
});

test('P04 T21 & T23: Client deduplicator merges RTDB listener + FCM push by alert_id and Active-Page Voice controller enforces visibility, toggle, autoplay, and 15s cooldown', () => {
  let dedupState = createInitialAlertDeduplicatorState();

  // 1. Alert arrives first via RTDB listener while page is visible, voice enabled, and browser audio permitted -> speaks once!
  const step1 = ingestAlertIntoClientDeduplicator({
    state: dedupState,
    incoming: {
      alert_id: 'alert-dedup-001',
      student_id: 'stu-a1',
      student_display_name: 'Trần Minh Quân (Học sinh A1)',
      device_id: 'robot-fam-a-01',
      device_name: 'BUGZ Robot Bàn Học Gia đình A',
      session_id: 'sess-a-001',
      message: 'Mình nâng đầu lên một chút để mắt dễ chịu hơn nhé!',
      created_at: 1793701000000,
      arrival_source: 'rtdb_listener',
    },
    voiceContext: {
      pageVisible: true,
      voiceEnabled: true,
      audioPermittedByBrowser: true,
      nowMs: 1793701000100,
      cooldownMs: 15_000,
    },
  });
  dedupState = step1.nextState;
  assert.equal(step1.isNewAlert, true);
  assert.equal(step1.wasDeduplicated, false);
  assert.equal(step1.shouldAutoSpeakVoice, true);
  assert.equal(dedupState.orderedAlertIds.length, 1);

  // 2. Exact same alert_id arrives 200ms later via FCM foreground onMessage -> deduplicated! Still 1 card, does NOT speak twice!
  const step2 = ingestAlertIntoClientDeduplicator({
    state: dedupState,
    incoming: {
      alert_id: 'alert-dedup-001',
      student_id: 'stu-a1',
      device_id: 'robot-fam-a-01',
      session_id: 'sess-a-001',
      message: 'Mình nâng đầu lên một chút để mắt dễ chịu hơn nhé!',
      created_at: 1793701000000,
      arrival_source: 'fcm_foreground',
    },
    voiceContext: {
      pageVisible: true,
      voiceEnabled: true,
      audioPermittedByBrowser: true,
      nowMs: 1793701000300,
      cooldownMs: 15_000,
    },
  });
  dedupState = step2.nextState;
  assert.equal(step2.isNewAlert, false);
  assert.equal(step2.wasDeduplicated, true);
  assert.equal(step2.shouldAutoSpeakVoice, false);
  assert.equal(step2.voiceBlockedReason, 'duplicate_alert_already_seen');
  assert.equal(dedupState.orderedAlertIds.length, 1);
  assert.deepEqual(dedupState.byAlertId['alert-dedup-001'].sources_seen, [
    'rtdb_listener',
    'fcm_foreground',
  ]);
  assert.equal(dedupState.byAlertId['alert-dedup-001'].voice_spoken_count, 1);

  // 3. Second distinct alert arrives 5 seconds later (within 15s cooldown) -> card added, but voice blocked by cooldown!
  const step3 = ingestAlertIntoClientDeduplicator({
    state: dedupState,
    incoming: {
      alert_id: 'alert-dedup-002',
      student_id: 'stu-a1',
      device_id: 'robot-fam-a-01',
      session_id: 'sess-a-001',
      message: 'Ngồi thẳng lưng giúp mình học thoải mái hơn đấy!',
      created_at: 1793701005000,
      arrival_source: 'rtdb_listener',
    },
    voiceContext: {
      pageVisible: true,
      voiceEnabled: true,
      audioPermittedByBrowser: true,
      nowMs: 1793701005000,
      cooldownMs: 15_000,
    },
  });
  dedupState = step3.nextState;
  assert.equal(step3.isNewAlert, true);
  assert.equal(step3.shouldAutoSpeakVoice, false);
  assert.equal(step3.voiceBlockedReason, 'voice_cooldown_active');
  assert.equal(dedupState.orderedAlertIds.length, 2);

  // 4. Third alert arrives after 20s when page is hidden/closed (pageVisible=false) -> voice strictly blocked ('page_not_visible_or_closed')
  const step4 = ingestAlertIntoClientDeduplicator({
    state: dedupState,
    incoming: {
      alert_id: 'alert-dedup-003',
      student_id: 'stu-a1',
      device_id: 'robot-fam-a-01',
      session_id: 'sess-a-001',
      message: 'Tư thế chưa phù hợp — Mình thả lỏng vai nhé!',
      created_at: 1793701025000,
      arrival_source: 'fcm_service_worker',
    },
    voiceContext: {
      pageVisible: false,
      voiceEnabled: true,
      audioPermittedByBrowser: true,
      nowMs: 1793701025000,
      cooldownMs: 15_000,
    },
  });
  assert.equal(step4.shouldAutoSpeakVoice, false);
  assert.equal(step4.voiceBlockedReason, 'page_not_visible_or_closed');
});

test('P04 T22, T24, T29: Deep-link returnTo sanitization, Notification Job state machine (quiet hours, digest, retry, expired token), separation of accepted_by_provider vs is_read, and push token logout cleanup', () => {
  // T22: returnTo path sanitization prevents open redirects and preserves /alerts/:alertId
  assert.equal(sanitizeReturnToPath('/alerts/alert-a-001'), '/alerts/alert-a-001');
  assert.equal(sanitizeReturnToPath('https://evil.example.com/phish'), null);
  assert.equal(sanitizeReturnToPath('//evil.example.com'), null);
  assert.equal(sanitizeReturnToPath('/login?returnTo=/alerts/alert-a-001'), null);

  // T24: Quiet hours check in Asia/Ho_Chi_Minh (UTC+7)
  // 2026-11-02T16:30:00Z = 2026-11-02 23:30:00 ICT (inside 22:00 -> 06:30 quiet hours)
  assert.equal(
    isWithinVietnamQuietHours(Date.parse('2026-11-02T16:30:00.000Z'), '22:00', '06:30'),
    true
  );
  // 2026-11-02T03:00:00Z = 2026-11-02 10:00:00 ICT (outside 22:00 -> 06:30 quiet hours)
  assert.equal(
    isWithinVietnamQuietHours(Date.parse('2026-11-02T03:00:00.000Z'), '22:00', '06:30'),
    false
  );

  const store = new P01RbacDomainService();
  const guardianAActor = {
    uid: 'uid-guardian-a',
    email: 'phuhuynh.a@example.com',
    email_verified: true,
    superadmin: false,
    role: 'guardian' as const,
  };
  const studentA1Actor = {
    uid: 'uid-student-a1',
    email: 'hocsinh.minh.a1@example.com',
    email_verified: true,
    superadmin: false,
    role: 'student' as const,
  };

  // T29: Register push token for Guardian A on installation 'inst-shared-browser-01'
  const regA = store.registerPushToken(
    guardianAActor,
    {
      installation_id: 'inst-shared-browser-01',
      token: 'fcm-token-shared-browser-01-valid-token',
      platform: 'web_desktop',
    },
    1793702000000
  );
  assert.equal(regA.ok, true);
  assert.equal(
    store.getState().push_tokens['uid-guardian-a']['inst-shared-browser-01'].status,
    'active'
  );

  // T29: Now Student A1 logs in on the SAME browser installation ('inst-shared-browser-01') -> Guardian A's token on that installation is automatically unlinked!
  const regStu = store.registerPushToken(
    studentA1Actor,
    {
      installation_id: 'inst-shared-browser-01',
      token: 'fcm-token-shared-browser-01-student-token',
      platform: 'web_desktop',
    },
    1793702005000
  );
  assert.equal(regStu.ok, true);
  assert.equal(regStu.unlinkedPreviousUids?.includes('uid-guardian-a'), true);
  assert.equal(
    store.getState().push_tokens['uid-guardian-a']['inst-shared-browser-01'].status,
    'unlinked_on_logout'
  );
  assert.equal(
    store.getState().push_tokens['uid-student-a1']['inst-shared-browser-01'].status,
    'active'
  );

  // T29: Student A1 logs out -> unregisterPushToken marks status='unlinked_on_logout'
  const unregStu = store.unregisterPushToken(
    studentA1Actor,
    { installation_id: 'inst-shared-browser-01' },
    1793702010000
  );
  assert.equal(unregStu.ok, true);
  assert.equal(
    store.getState().push_tokens['uid-student-a1']['inst-shared-browser-01'].status,
    'unlinked_on_logout'
  );

  // T24: Test transient provider failure -> state='failed', then bounded retry succeeds -> state='accepted_by_provider'
  // Use daytime timestamp 2026-11-02T03:00:00Z (10:00 ICT)
  const daytimeMs = Date.parse('2026-11-02T03:00:00.000Z');
  const dispatchTransient = store.routeAndDispatchAlertNotifications(
    {
      alert_id: 'alert-a-001',
      device_id: 'robot-fam-a-01',
      session_id: 'sess-a-001',
      simulateProviderOutcome: 'provider_transient_error',
    },
    daytimeMs
  );
  assert.equal(dispatchTransient.ok, true);
  const emailJobId = 'alert-a-001_uid-guardian-a_email';
  const failedEmailJob = store.getState().notification_jobs[emailJobId];
  assert.equal(failedEmailJob.state, 'failed');
  assert.equal(failedEmailJob.attempts, 1);
  assert.equal(failedEmailJob.external_payload.contains_capture_image, false);
  assert.equal(failedEmailJob.external_payload.contains_medical_diagnosis, false);
  assert.equal(failedEmailJob.delivery_guarantee, 'at_least_once_with_dedupe');

  // Retry 1 fails again (attempts=2)
  const retry1 = store.retryNotificationJobForActor(
    guardianAActor,
    { job_id: emailJobId, simulate_outcome: 'provider_transient_error' },
    daytimeMs + 30_000
  );
  assert.equal(retry1.ok, false);
  assert.equal(retry1.job?.attempts, 2);
  assert.equal(retry1.job?.state, 'failed');

  // Retry 2 succeeds (attempts=3 -> accepted_by_provider)
  const retry2 = store.retryNotificationJobForActor(
    guardianAActor,
    { job_id: emailJobId, simulate_outcome: 'accepted_by_provider' },
    daytimeMs + 60_000
  );
  assert.equal(retry2.ok, true);
  assert.equal(retry2.job?.attempts, 3);
  assert.equal(retry2.job?.state, 'accepted_by_provider');

  // CRITICAL T24 invariant: accepted_by_provider does NOT set alerts.is_read=true or notification_reads!
  assert.equal(store.getState().alerts['robot-fam-a-01']['sess-a-001']['alert-a-001'].is_read, false);
  assert.equal(
    Boolean(store.getState().notification_reads['uid-guardian-a']?.['alert-a-001']),
    false
  );

  // Only when Guardian A explicitly marks the alert read in-app does alerts.is_read become true
  const markRes = store.markAlertRead(guardianAActor, {
    alert_id: 'alert-a-001',
  });
  assert.equal(markRes.ok, true);
  assert.equal(store.getState().alerts['robot-fam-a-01']['sess-a-001']['alert-a-001'].is_read, true);
  assert.equal(
    Boolean(store.getState().notification_reads['uid-guardian-a']?.['alert-a-001']?.read_at),
    true
  );

  // T24: Test FCM expired token cleanup when FCM returns registration-token-not-registered
  const dispatchExpiredToken = store.routeAndDispatchAlertNotifications(
    {
      alert_id: 'alert-a-001',
      device_id: 'robot-fam-a-01',
      session_id: 'sess-a-001',
      simulateProviderOutcome: 'fcm_token_expired',
    },
    daytimeMs + 120_000
  );
  assert.equal(dispatchExpiredToken.ok, true);
  assert.equal(dispatchExpiredToken.expiredTokensCleanedCount > 0, true);
  assert.equal(
    store.getState().push_tokens['uid-guardian-a']['inst-guardian-a-web-01'].status,
    'expired'
  );

  // Verify RTDB Rules for notification_reads, push_tokens, and notification_jobs
  // Guardian A can read their own notification_reads and push_tokens, but cannot write notification_jobs directly
  assert.equal(
    store.clientReadWithRules({
      auth: guardianAAuth,
      path: '/notification_reads/uid-guardian-a/alert-a-001',
    }).allowed,
    true
  );
  assert.equal(
    store.clientReadWithRules({
      auth: guardianBAuth,
      path: '/notification_reads/uid-guardian-a/alert-a-001',
    }).allowed,
    false
  );
  assert.equal(
    store.clientWriteWithRules({
      auth: guardianAAuth,
      path: `/notification_jobs/${emailJobId}`,
      value: { state: 'accepted_by_provider' },
    }).allowed,
    false
  );
});

test('P05 T28 & T04: 40-question seed dry-run & import, zero answer-key leak in questions_public, draft question hiding, clinical/review publish guards, and non-admin 403 rejection', () => {
  // 1. Validate seed split in strict_editorial_draft mode
  const splitDraft = validateAndSplitQuestionBankSeed({
    dryRun: true,
    mode: 'strict_editorial_draft',
  });
  assert.equal(splitDraft.ok, true);
  assert.equal(splitDraft.dryRun, true);
  assert.equal(splitDraft.totalQuestions, 40);
  assert.equal(splitDraft.lungThangCount, 20);
  assert.equal(splitDraft.matSangCount, 20);
  assert.equal(splitDraft.publishedCount, 0);
  assert.equal(splitDraft.editorialDraftCount, 40);
  assert.equal(splitDraft.publicLeakCheckPassed, true);
  assert.equal(splitDraft.clinicalSafetyCheckPassed, true);

  // Verify no public question record contains correct_option_id, feedback_correct, or feedback_incorrect
  for (const pubQ of Object.values(splitDraft.questionsPublic)) {
    const rawJson = JSON.stringify(pubQ);
    assert.equal(rawJson.includes('correct_option_id'), false);
    assert.equal(rawJson.includes('feedback_correct'), false);
    assert.equal(rawJson.includes('feedback_incorrect'), false);
    assert.equal(pubQ.status, 'editorial_draft');
  }

  // Verify 2x2 illustration manifest & blueprints
  assert.equal(ILLUSTRATION_MANIFEST.atlas_file, 'assets/bugz_learning_atlas.png');
  assert.equal(Object.keys(ILLUSTRATION_MANIFEST.illustrations).length, 4);
  assert.equal(GAME_BLUEPRINTS.games.length, 3);

  const store = new P01RbacDomainService();
  const studentActor = {
    uid: 'uid-student-a1',
    email: 'hocsinh.minh.a1@example.com',
    email_verified: true,
    superadmin: false,
    role: 'student' as const,
  };
  const superAdminActor = {
    uid: 'uid-superadmin-01',
    email: 'minhquantran4312@gmail.com',
    email_verified: true,
    superadmin: true,
    role: 'superadmin' as const,
  };

  // T04: Student attempting to import seed or publish a question is rejected with 403 and logged in audit_logs
  const unauthImport = store.adminImportQuestionBankSeed(studentActor, {
    dry_run: false,
    mode: 'strict_editorial_draft',
  });
  assert.equal(unauthImport.ok, false);
  assert.equal(unauthImport.status, 403);

  const unauthPublish = store.adminUpdateOrPublishQuestion(studentActor, {
    question_id: 'BUGZ-Q007',
    status: 'published',
  });
  assert.equal(unauthPublish.ok, false);
  assert.equal(unauthPublish.status, 403);

  // T28: By default in sandbox, 12 questions are published and 28 are editorial_draft.
  // Student querying games bootstrap ONLY receives the 12 published questions (never the 28 draft questions)
  const boot = store.getGamesBootstrapForActor(studentActor, 'stu-a1');
  assert.equal(boot.counts.publishedTotal, 12);
  assert.equal(boot.counts.draftHiddenCount, 28);
  assert.equal(
    boot.publishedQuestions.every((q) => q.status === 'published'),
    true
  );
  assert.equal(
    boot.publishedQuestions.some((q) => q.id === 'BUGZ-Q007'),
    false
  );

  // Verify RTDB Rules allow student to read published question BUGZ-Q001, but DENY reading draft question BUGZ-Q007 and DENY reading question_keys!
  assert.equal(
    store.clientReadWithRules({
      auth: studentA1Auth,
      path: '/questions_public/BUGZ-Q001',
    }).allowed,
    true
  );
  assert.equal(
    store.clientReadWithRules({
      auth: studentA1Auth,
      path: '/questions_public/BUGZ-Q007',
    }).allowed,
    false
  );
  assert.equal(
    store.clientReadWithRules({
      auth: studentA1Auth,
      path: '/question_keys/BUGZ-Q001/1',
    }).allowed,
    false
  );

  // T28: SuperAdmin attempting to publish draft question BUGZ-Q007 without checking content_reviewed & clinical_reviewed -> rejected 422!
  const blockedPubQ007 = store.adminUpdateOrPublishQuestion(superAdminActor, {
    question_id: 'BUGZ-Q007',
    content_reviewed: true,
    clinical_reviewed: false,
    status: 'published',
  });
  assert.equal(blockedPubQ007.ok, false);
  assert.equal(blockedPubQ007.status, 422);

  // T28: SuperAdmin attempting to insert medical cure promise ("chữa khỏi cận thị") -> rejected 422!
  const blockedCureClaim = store.adminUpdateOrPublishQuestion(superAdminActor, {
    question_id: 'BUGZ-Q007',
    prompt: 'Bài tập này cam kết chữa khỏi cận thị 100% cho học sinh.',
    content_reviewed: true,
    clinical_reviewed: true,
    status: 'published',
  });
  assert.equal(blockedCureClaim.ok, false);
  assert.equal(blockedCureClaim.status, 422);

  // T28: SuperAdmin checks both content_reviewed=true and clinical_reviewed=true on BUGZ-Q007 -> publishes cleanly and bumps version to v2
  const validPubQ007 = store.adminUpdateOrPublishQuestion(superAdminActor, {
    question_id: 'BUGZ-Q007',
    content_reviewed: true,
    clinical_reviewed: true,
    status: 'published',
  });
  assert.equal(validPubQ007.ok, true);
  assert.equal(validPubQ007.question?.status, 'published');
  assert.equal(validPubQ007.question?.version, 2);

  // Now student sees 13 published questions (including BUGZ-Q007)
  const bootAfterPub = store.getGamesBootstrapForActor(studentActor, 'stu-a1');
  assert.equal(bootAfterPub.counts.publishedTotal, 13);
  assert.equal(
    bootAfterPub.publishedQuestions.some((q) => q.id === 'BUGZ-Q007'),
    true
  );
});

test('P05 T26 & T27: Server-side scoring anti-duplicate (first try +10, retry/repeat +0), locked question version across Admin edits, Desk Builder + Habit Relay grading, and strict 3-metric separation', () => {
  const store = new P01RbacDomainService();
  const studentActor = {
    uid: 'uid-student-a1',
    email: 'hocsinh.minh.a1@example.com',
    email_verified: true,
    superadmin: false,
    role: 'student' as const,
  };
  const superAdminActor = {
    uid: 'uid-superadmin-01',
    email: 'minhquantran4312@gmail.com',
    email_verified: true,
    superadmin: true,
    role: 'superadmin' as const,
  };

  // Record initial game score, self-practice, and Robot episode metrics before playing games
  const bootBefore = store.getGamesBootstrapForActor(studentActor, 'stu-a1');
  const initialGameScore = bootBefore.separatedMetrics.gameScoreTotal;
  const initialSelfPractice = bootBefore.separatedMetrics.selfPracticeCompletedDaysCount;
  const initialRobotGood = bootBefore.separatedMetrics.robotObservedGoodEpisodes;

  // 1. Start a 'situations' game attempt for stu-a1 (locks question versions at v1)
  const startRes = store.startGameAttempt(
    studentActor,
    {
      student_id: 'stu-a1',
      game_id: 'situations',
      topic_filter: 'lung_thang',
      timer_enabled: false,
    },
    1793800000000
  );
  assert.equal(startRes.ok, true);
  const attemptId = startRes.attempt!.attempt_id;
  assert.equal(startRes.questions?.length, 5);
  assert.equal(startRes.attempt?.question_versions['BUGZ-Q001'], 1);

  // 2. While the attempt is in progress, SuperAdmin edits BUGZ-Q001 to v2 and changes correct_option_id from 'A' to 'C'
  const adminEditQ1 = store.adminUpdateOrPublishQuestion(
    superAdminActor,
    {
      question_id: 'BUGZ-Q001',
      correct_option_id: 'C',
      content_reviewed: true,
      clinical_reviewed: true,
      status: 'published',
    },
    1793800001000
  );
  assert.equal(adminEditQ1.ok, true);
  assert.equal(adminEditQ1.question?.version, 2);
  assert.equal(store.getState().question_keys['BUGZ-Q001']['1'].correct_option_id, 'A');
  assert.equal(store.getState().question_keys['BUGZ-Q001']['2'].correct_option_id, 'C');

  // 3. Student answers BUGZ-Q001 in their existing attempt with 'A' (which was correct in locked v1!)
  // Must be graded against v1 -> is_correct=true, +10 points!
  const ansQ1First = store.submitGameAttemptAnswer(
    studentActor,
    {
      attempt_id: attemptId,
      student_id: 'stu-a1',
      question_id: 'BUGZ-Q001',
      selected_option_id: 'A',
    },
    1793800002000
  );
  assert.equal(ansQ1First.ok, true);
  assert.equal(ansQ1First.questionResult?.locked_version, 1);
  assert.equal(ansQ1First.questionResult?.is_correct, true);
  assert.equal(ansQ1First.questionResult?.points_awarded, 10);
  assert.equal(ansQ1First.attempt?.score, 10);

  // 4. T26: Student re-submits BUGZ-Q001 with 'A' a second time -> +0 points, total score stays 10!
  const ansQ1Duplicate = store.submitGameAttemptAnswer(
    studentActor,
    {
      attempt_id: attemptId,
      student_id: 'stu-a1',
      question_id: 'BUGZ-Q001',
      selected_option_id: 'A',
    },
    1793800003000
  );
  assert.equal(ansQ1Duplicate.ok, true);
  assert.equal(ansQ1Duplicate.questionResult?.points_awarded, 0);
  assert.equal(ansQ1Duplicate.questionResult?.attempt_count_for_question, 2);
  assert.equal(ansQ1Duplicate.attempt?.score, 10);

  // 5. T26: On BUGZ-Q002, student picks wrong answer 'A' first (+0 points), then retries with correct answer 'B' -> learning feedback is_correct=true, but points_awarded=0!
  const ansQ2Wrong = store.submitGameAttemptAnswer(
    studentActor,
    {
      attempt_id: attemptId,
      student_id: 'stu-a1',
      question_id: 'BUGZ-Q002',
      selected_option_id: 'A',
    },
    1793800004000
  );
  assert.equal(ansQ2Wrong.ok, true);
  assert.equal(ansQ2Wrong.questionResult?.is_correct, false);
  assert.equal(ansQ2Wrong.questionResult?.points_awarded, 0);
  assert.equal(ansQ2Wrong.attempt?.score, 10);

  const ansQ2RetryCorrect = store.submitGameAttemptAnswer(
    studentActor,
    {
      attempt_id: attemptId,
      student_id: 'stu-a1',
      question_id: 'BUGZ-Q002',
      selected_option_id: 'B',
    },
    1793800005000
  );
  assert.equal(ansQ2RetryCorrect.ok, true);
  assert.equal(ansQ2RetryCorrect.questionResult?.is_correct, true);
  assert.equal(ansQ2RetryCorrect.questionResult?.points_awarded, 0);
  assert.equal(ansQ2RetryCorrect.attempt?.score, 10);

  // 6. T27: Test Mode 2 ('desk_builder') grading (+30 first time, +0 repeat)
  const startDesk = store.startGameAttempt(
    studentActor,
    {
      student_id: 'stu-a1',
      game_id: 'desk_builder',
    },
    1793800010000
  );
  assert.equal(startDesk.ok, true);
  const deskAttemptId = startDesk.attempt!.attempt_id;

  const deskSubmit1 = store.submitGameAttemptAnswer(
    studentActor,
    {
      attempt_id: deskAttemptId,
      student_id: 'stu-a1',
      desk_pairs: {
        foot_support: 'feet',
        adjust_lamp: 'work_area',
        clear_desk: 'desk',
      },
    },
    1793800011000
  );
  assert.equal(deskSubmit1.ok, true);
  assert.equal(deskSubmit1.deskResult?.is_all_correct, true);
  assert.equal(deskSubmit1.deskResult?.points_awarded, 30);
  assert.equal(deskSubmit1.attempt?.score, 30);

  const deskSubmit2 = store.submitGameAttemptAnswer(
    studentActor,
    {
      attempt_id: deskAttemptId,
      student_id: 'stu-a1',
      desk_pairs: {
        foot_support: 'feet',
        adjust_lamp: 'work_area',
        clear_desk: 'desk',
      },
    },
    1793800012000
  );
  assert.equal(deskSubmit2.ok, true);
  assert.equal(deskSubmit2.deskResult?.points_awarded, 0);
  assert.equal(deskSubmit2.attempt?.score, 30);

  // 7. T27: Test Mode 3 ('habit_relay') grading (+20 first time, +0 repeat)
  const startHabit = store.startGameAttempt(
    studentActor,
    {
      student_id: 'stu-a1',
      game_id: 'habit_relay',
    },
    1793800020000
  );
  assert.equal(startHabit.ok, true);
  const habitAttemptId = startHabit.attempt!.attempt_id;

  const habitSubmit1 = store.submitGameAttemptAnswer(
    studentActor,
    {
      attempt_id: habitAttemptId,
      student_id: 'stu-a1',
      ordered_card_ids: ['prepare', 'study', 'pause', 'return'],
      self_reflection_text: 'Em đã chỉnh bàn ghế và nghỉ mắt đúng giờ.',
    },
    1793800021000
  );
  assert.equal(habitSubmit1.ok, true);
  assert.equal(habitSubmit1.relayResult?.is_correct, true);
  assert.equal(habitSubmit1.relayResult?.points_awarded, 20);
  assert.equal(habitSubmit1.attempt?.score, 20);

  // 8. Verify strict separation of the 3 metrics: gameScoreTotal increased by 60 (10 + 30 + 20),
  // while selfPracticeCompletedDaysCount and robotObservedGoodEpisodes remained completely unchanged!
  const bootAfter = store.getGamesBootstrapForActor(studentActor, 'stu-a1');
  assert.equal(bootAfter.separatedMetrics.gameScoreTotal, initialGameScore + 60);
  assert.equal(bootAfter.separatedMetrics.selfPracticeCompletedDaysCount, initialSelfPractice);
  assert.equal(bootAfter.separatedMetrics.robotObservedGoodEpisodes, initialRobotGood);
});

test('P06 Acceptance Matrix & P0 Guardrails: 30 test cases (T01..T30), 10 P0 security guardrails, 6-minute demo script, and T30 secret hygiene scanner', () => {
  // 1. Exactly 30 acceptance test cases T01..T30
  assert.equal(P06_ACCEPTANCE_MATRIX_30.length, 30);
  for (let i = 1; i <= 30; i += 1) {
    const expectedCode = `T${String(i).padStart(2, '0')}`;
    assert.equal(P06_ACCEPTANCE_MATRIX_30[i - 1].code, expectedCode);
    assert.ok(P06_ACCEPTANCE_MATRIX_30[i - 1].requirement.length > 10);
    assert.ok(P06_ACCEPTANCE_MATRIX_30[i - 1].filesAndRoutes.length >= 1);
    assert.ok(P06_ACCEPTANCE_MATRIX_30[i - 1].automatedTestRef.length > 5);
    assert.ok(P06_ACCEPTANCE_MATRIX_30[i - 1].evidence.length > 5);
    assert.equal(P06_ACCEPTANCE_MATRIX_30[i - 1].codeAndSandboxStatus, 'PASS');
  }

  // 2. Verify honest separation between code-level PASS and live external credential BLOCKED
  const blockedItems = P06_ACCEPTANCE_MATRIX_30.filter((item) => item.liveExternalStatus === 'BLOCKED');
  assert.ok(blockedItems.length >= 2);
  assert.ok(blockedItems.some((item) => item.code === 'T21'));
  assert.ok(blockedItems.some((item) => item.code === 'T24'));

  // 3. Verify 10 P0 Guardrail Audit items
  assert.equal(P0_SECURITY_AUDIT_ITEMS.length, 10);
  assert.ok(P0_SECURITY_AUDIT_ITEMS.every((item) => item.status === 'PASS'));

  // 4. Verify 6-Minute Competition Demo Script (5 segments, explicit sourceBadge labels)
  assert.equal(DEMO_6_MINUTE_SCRIPT.length, 5);
  assert.ok(
    DEMO_6_MINUTE_SCRIPT.every(
      (step) =>
        step.sourceBadge === 'REAL_CONTENT' ||
        step.sourceBadge === 'SIMULATOR_LABELED' ||
        step.sourceBadge === 'REAL_OR_SIMULATOR' ||
        step.sourceBadge === 'SERVER_RBAC'
    )
  );

  // 5. Verify T30 Secret Hygiene Report
  const secretReport = verifyNoSecretsLeakedReport(process.env);
  assert.equal(secretReport.passed, true);
  assert.equal(secretReport.ExposedSecretVarsCount, 0);
});

test('P06 Latency Benchmark (p95 <= 5000ms over 20 samples) & Demo Backup / Restore / Reset with SuperAdmin RBAC (T04)', () => {
  const store = new P01RbacDomainService();
  const guardianActor = {
    uid: 'uid-guardian-a',
    email: 'phuhuynh.a@example.com',
    email_verified: true,
    superadmin: false,
    role: 'guardian' as const,
  };
  const superAdminActor = {
    uid: 'uid-superadmin-01',
    email: 'minhquantran4312@gmail.com',
    email_verified: true,
    superadmin: true,
    role: 'superadmin' as const,
  };

  // 1. Run 20-sample ingest latency benchmark (Section 17 Artifact target: p95 <= 5000ms)
  const bench = store.runIngestLatencyBenchmark20Samples(superAdminActor);
  assert.equal(bench.ok, true);
  assert.equal(bench.samplesCount, 20);
  assert.equal(bench.samplesMs.length, 20);
  assert.equal(bench.targetSlaP95Ms, 5000);
  assert.equal(bench.withinTargetSla, true);
  assert.ok(bench.p95Ms <= 5000, `Expected p95 <= 5000ms, got ${bench.p95Ms}ms`);

  // 2. Non-SuperAdmin is strictly blocked (403) from Demo Backup / Restore / Reset
  const deniedBackup = store.exportDemoBackupSnapshot(guardianActor);
  assert.equal(deniedBackup.ok, false);
  assert.equal(deniedBackup.status, 403);

  const deniedReset = store.resetCleanDemoState(guardianActor);
  assert.equal(deniedReset.ok, false);
  assert.equal(deniedReset.status, 403);

  // 3. SuperAdmin exports Demo Backup Snapshot and device secrets are redacted
  const backupRes = store.exportDemoBackupSnapshot(superAdminActor);
  assert.equal(backupRes.ok, true);
  assert.equal(backupRes.status, 200);
  assert.ok(backupRes.backup);
  assert.equal(backupRes.backup.schema_version, 'v1.6-p06-rtdb-contract');
  assert.equal(backupRes.backup.contains_secrets, false);
  assert.equal(
    backupRes.backup.snapshot.device_broker_credentials['sim-dev01'].secret_hash,
    'REDACTED_FOR_DEMO_BACKUP'
  );

  // 4. Reset clean demo state and restore snapshot
  const resetRes = store.resetCleanDemoState(superAdminActor);
  assert.equal(resetRes.ok, true);
  assert.equal(resetRes.status, 200);

  const restoreRes = store.restoreDemoBackupSnapshot(superAdminActor, {
    snapshot: backupRes.backup.snapshot,
  });
  assert.equal(restoreRes.ok, true);
  assert.equal(restoreRes.status, 200);
});

test('Admin Save & Approve: Bulk publish all 40 questions opens full 40-question mode in startGameAttempt and bulk publish 28 learning days succeeds', () => {
  const store = new P01RbacDomainService();
  const superAdminActor = {
    uid: 'uid-superadmin-02',
    email: 'tamtranmusic@gmail.com',
    email_verified: true,
    superadmin: true,
    role: 'superadmin' as const,
  };

  // 1. Bulk publish all 40 questions
  const bulkQ = store.adminBulkPublishQuestions(superAdminActor, { mode: 'publish_all_40' });
  assert.equal(bulkQ.ok, true);
  assert.equal(bulkQ.publishedCount, 40);

  // 2. Starting a game attempt when all 40 questions are published opens all 40 questions (and 20 per topic)
  const attemptAll = store.startGameAttempt(superAdminActor, {
    student_id: 'stu-uid-superadmin-02',
    game_id: 'situations',
    topic_filter: 'all',
  });
  assert.equal(attemptAll.ok, true);
  assert.equal(attemptAll.questions?.length, 40);
  assert.equal(attemptAll.attempt?.max_possible_score, 400);

  const attemptLungThang = store.startGameAttempt(superAdminActor, {
    student_id: 'stu-uid-superadmin-02',
    game_id: 'situations',
    topic_filter: 'lung_thang',
  });
  assert.equal(attemptLungThang.ok, true);
  assert.equal(attemptLungThang.questions?.length, 20);
  assert.equal(attemptLungThang.attempt?.max_possible_score, 200);

  // 3. Explicit 5-question quick mode still works when requested
  const attemptQuick5 = store.startGameAttempt(superAdminActor, {
    student_id: 'stu-uid-superadmin-02',
    game_id: 'situations',
    topic_filter: 'all',
    question_limit: 5,
  });
  assert.equal(attemptQuick5.ok, true);
  assert.equal(attemptQuick5.questions?.length, 5);
  assert.equal(attemptQuick5.attempt?.max_possible_score, 50);

  // 4. Bulk publish all 28 learning days
  const bulkDays = store.adminBulkPublishLearningDays(superAdminActor);
  assert.equal(bulkDays.ok, true);
  assert.equal(bulkDays.publishedCount, 28);
});






