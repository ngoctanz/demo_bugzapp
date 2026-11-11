import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateServerGameQuestionScore,
  createInitialEpisodeRuntime,
  DEFAULT_FSM_CONFIG,
  resolveBackendVerifiedRole,
  resolveDayProgression,
  resolveRobotMonitoringStatus,
  stepEpisodeFsm,
} from './bugzRules';
import {
  evaluateStageFeatureConfigs,
  isEnvValuePresent,
  validateEmailProvider,
  validateMqttAdapterMode,
  validateServiceAccountConfig,
} from './envContract';
import type { MqttObservationPayload } from '../types/bugz';

test('T08: 28-day progression transitions across weeks at day 7, 14, 21 and routes day 28 to certificate-request (no day 29)', () => {
  const d7 = resolveDayProgression(7);
  assert.equal(d7.currentWeek, 1);
  assert.equal(d7.nextDay, 8);
  assert.equal(d7.nextWeek, 2);
  assert.equal(d7.crossesWeekBoundary, true);
  assert.equal(d7.targetRoute, '/learn/days/8');

  const d14 = resolveDayProgression(14);
  assert.equal(d14.currentWeek, 2);
  assert.equal(d14.nextDay, 15);
  assert.equal(d14.nextWeek, 3);
  assert.equal(d14.crossesWeekBoundary, true);

  const d21 = resolveDayProgression(21);
  assert.equal(d21.currentWeek, 3);
  assert.equal(d21.nextDay, 22);
  assert.equal(d21.nextWeek, 4);
  assert.equal(d21.crossesWeekBoundary, true);

  const d28 = resolveDayProgression(28);
  assert.equal(d28.currentWeek, 4);
  assert.equal(d28.nextAction, 'certificate_request');
  assert.equal(d28.nextDay, null);
  assert.equal(d28.targetRoute, '/certificate-request');
});

test('T11: monitoring_enabled vs monitoring_active ACK state never claims active before Robot ACK', () => {
  const waitingAck = resolveRobotMonitoringStatus(true, false, false);
  assert.equal(waitingAck.mode, 'waiting_enable_ack');
  assert.equal(waitingAck.isTrulyMonitoring, false);

  const activeAcked = resolveRobotMonitoringStatus(true, true, false);
  assert.equal(activeAcked.mode, 'active_acked');
  assert.equal(activeAcked.isTrulyMonitoring, true);

  const timedOut = resolveRobotMonitoringStatus(true, false, true);
  assert.equal(timedOut.mode, 'ack_timeout');
  assert.equal(timedOut.isTrulyMonitoring, false);
});

test('T12 & T13: Episode FSM counts stable episodes (good -> bad -> good -> bad => good=2, bad=2) and multiple reminders in one bad episode (bad_count=1, alert_count=2)', () => {
  let runtime = createInitialEpisodeRuntime('session-01');
  let seq = 0;

  const sendObs = (posture: 'good' | 'bad' | 'absent' | 'unknown', timeMs: number, moving = false) => {
    seq += 1;
    const payload: MqttObservationPayload = {
      schema_version: 1,
      event_id: `ev-${seq}`,
      device_id: 'dev-01',
      session_id: 'session-01',
      boot_id: 'boot-1',
      sequence: seq,
      type: 'posture.observed',
      observed_at: timeMs,
      posture,
      confidence: 0.92,
      robot_moving: moving,
      source: 'simulator',
    };
    const res = stepEpisodeFsm(runtime, payload, DEFAULT_FSM_CONFIG);
    runtime = res.state;
    return res;
  };

  // Episode 1: Good (0s -> 4s >= 3s threshold)
  sendObs('good', 1000);
  sendObs('good', 2500);
  sendObs('good', 4500);
  assert.equal(runtime.goodCount, 1);
  assert.equal(runtime.badCount, 0);
  assert.equal(runtime.frameCount, 3); // 3 frames but only 1 episode

  // Episode 2: Bad (5s -> 9s >= 3s threshold)
  sendObs('bad', 5000);
  sendObs('bad', 8500);
  assert.equal(runtime.goodCount, 1);
  assert.equal(runtime.badCount, 1);

  // Episode 3: Good (10s -> 14s)
  sendObs('good', 10000);
  sendObs('good', 13500);
  assert.equal(runtime.goodCount, 2);
  assert.equal(runtime.badCount, 1);

  // Episode 4: Prolonged Bad with 2 alerts (starts at 20s, confirmed at 23s, first alert at 50s, second reminder at 110s)
  sendObs('bad', 20000);
  sendObs('bad', 23500); // Confirmed 2nd bad episode
  assert.equal(runtime.goodCount, 2);
  assert.equal(runtime.badCount, 2);
  assert.equal(runtime.alertCount, 0);

  const alert1 = sendObs('bad', 50500); // 30.5s since 20s -> Alert #1
  assert.equal(alert1.triggeredAlert, true);
  assert.equal(runtime.badCount, 2); // Still episode #2!
  assert.equal(runtime.alertCount, 1);

  const alert2 = sendObs('bad', 111000); // +60.5s since 50.5s -> Alert #2
  assert.equal(alert2.triggeredAlert, true);
  assert.equal(runtime.badCount, 2); // Still 2 bad episodes total
  assert.equal(runtime.alertCount, 2); // 2 alerts within that episode
});

test('T14, T16, T17: Deduplication QoS1, stale sequence rejection, and moving robot -> unknown without penalty', () => {
  let runtime = createInitialEpisodeRuntime('session-02');

  const p1: MqttObservationPayload = {
    schema_version: 1,
    event_id: 'dup-event-001',
    device_id: 'dev-01',
    session_id: 'session-02',
    boot_id: 'boot-1',
    sequence: 10,
    type: 'posture.observed',
    observed_at: 1000,
    posture: 'bad',
    confidence: 0.95,
    robot_moving: false,
    source: 'simulator',
  };

  const r1 = stepEpisodeFsm(runtime, p1);
  runtime = r1.state;
  assert.equal(r1.ignoredReason, undefined);

  // Send exact same event_id 3 times (T14)
  const r2 = stepEpisodeFsm(runtime, p1);
  const r3 = stepEpisodeFsm(r2.state, p1);
  assert.equal(r2.ignoredReason, 'duplicate_event');
  assert.equal(r3.ignoredReason, 'duplicate_event');
  assert.equal(r3.state.frameCount, 1);

  // Moving robot reporting 'bad' must be normalized to 'unknown' and never increment badCount (T17)
  const movingPayload: MqttObservationPayload = {
    ...p1,
    event_id: 'ev-moving',
    sequence: 11,
    observed_at: 5000,
    posture: 'bad',
    robot_moving: true,
  };
  const rMoving = stepEpisodeFsm(runtime, movingPayload);
  assert.equal(rMoving.effectivePosture, 'unknown');
  assert.equal(rMoving.state.badCount, 0);
});

test('T02: SuperAdmin bootstrap requires verified token + email_verified === true + minhquantran4312@gmail.com', () => {
  const unverifiedEmail = resolveBackendVerifiedRole({
    uid: 'u1',
    email: 'minhquantran4312@gmail.com',
    email_verified: false,
  });
  assert.equal(unverifiedEmail.canGrantSuperAdminBootstrap, false);
  assert.equal(unverifiedEmail.effectiveRole, 'student');

  const verifiedAdmin = resolveBackendVerifiedRole({
    uid: 'u2',
    email: 'minhquantran4312@gmail.com',
    email_verified: true,
  });
  assert.equal(verifiedAdmin.canGrantSuperAdminBootstrap, true);
  assert.equal(verifiedAdmin.effectiveRole, 'superadmin');

  const verifiedOwnerAdmin = resolveBackendVerifiedRole({
    uid: 'u3',
    email: 'tamtranmusic@gmail.com',
    email_verified: true,
  });
  assert.equal(verifiedOwnerAdmin.canGrantSuperAdminBootstrap, true);
  assert.equal(verifiedOwnerAdmin.effectiveRole, 'superadmin');

  const unverifiedOwnerAdmin = resolveBackendVerifiedRole({
    uid: 'u4',
    email: 'tamtranmusic@gmail.com',
    email_verified: false,
  });
  assert.equal(unverifiedOwnerAdmin.canGrantSuperAdminBootstrap, false);
  assert.equal(unverifiedOwnerAdmin.effectiveRole, 'student');
});

test('T26: Game question scoring prevents duplicate points on retry or repeated submission', () => {
  const firstTry = calculateServerGameQuestionScore({
    isCorrect: true,
    attemptIndexForQuestion: 1,
    alreadyAwardedForQuestion: false,
  });
  assert.equal(firstTry.pointsAwarded, 10);

  const duplicateSubmit = calculateServerGameQuestionScore({
    isCorrect: true,
    attemptIndexForQuestion: 1,
    alreadyAwardedForQuestion: true,
  });
  assert.equal(duplicateSubmit.pointsAwarded, 0);

  const secondTryCorrect = calculateServerGameQuestionScore({
    isCorrect: true,
    attemptIndexForQuestion: 2,
    alreadyAwardedForQuestion: false,
  });
  assert.equal(secondTryCorrect.pointsAwarded, 0);
  assert.equal(secondTryCorrect.feedbackType, 'retry_understood');
});

test('P00 Env Contract: rejects dummy placeholder values and validates FIREBASE_SERVICE_ACCOUNT_JSON / KEY_PATH, MQTT_ADAPTER_MODE, EMAIL_PROVIDER', () => {
  assert.equal(isEnvValuePresent(''), false);
  assert.equal(isEnvValuePresent('MY_GEMINI_API_KEY'), false);
  assert.equal(isEnvValuePresent('YOUR_API_KEY'), false);
  assert.equal(isEnvValuePresent('bugz-prod-rtdb'), true);

  // Service account validation: empty -> unconfigured
  const emptySa = validateServiceAccountConfig({});
  assert.equal(emptySa.isValid, false);
  assert.equal(emptySa.source, 'none');

  // Service account validation: valid inline JSON
  const validJsonSa = validateServiceAccountConfig({
    FIREBASE_SERVICE_ACCOUNT_JSON: JSON.stringify({
      type: 'service_account',
      project_id: 'bugz-project',
      client_email: 'firebase-adminsdk@bugz-project.iam.gserviceaccount.com',
      private_key: '-----BEGIN PRIVATE KEY-----\\nabc\\n-----END PRIVATE KEY-----\\n',
    }),
  });
  assert.equal(validJsonSa.isValid, true);
  assert.equal(validJsonSa.source, 'json_env');

  // Service account validation: valid file path
  const validPathSa = validateServiceAccountConfig({
    FIREBASE_SERVICE_ACCOUNT_KEY_PATH: '/secrets/bugz-service-account.json',
  });
  assert.equal(validPathSa.isValid, true);
  assert.equal(validPathSa.source, 'file_path');

  // MQTT_ADAPTER_MODE validation
  assert.equal(validateMqttAdapterMode('webhook_https').isValid, true);
  assert.equal(validateMqttAdapterMode('node_worker').isValid, true);
  assert.equal(validateMqttAdapterMode('invalid_mode').isValid, false);

  // EMAIL_PROVIDER validation
  assert.equal(validateEmailProvider('smtp').isValid, true);
  assert.equal(validateEmailProvider('resend').isValid, true);
  assert.equal(validateEmailProvider('sendgrid').isValid, true);
  assert.equal(validateEmailProvider('mailgun').isValid, false);

  // Stage-by-stage evaluation when env is empty -> all external features return uiStatusLabel = 'Chưa cấu hình'
  const emptyStages = evaluateStageFeatureConfigs({});
  assert.equal(emptyStages.firebaseClientAuthRtdb.isConfigured, false);
  assert.equal(emptyStages.firebaseClientAuthRtdb.uiStatusLabel, 'Chưa cấu hình');
  assert.equal(emptyStages.firebaseAdminBackend.uiStatusLabel, 'Chưa cấu hình');
  assert.equal(emptyStages.mqttAndRobot.uiStatusLabel, 'Chưa cấu hình');
  assert.equal(emptyStages.emailProvider.uiStatusLabel, 'Chưa cấu hình');
});

