import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildThreeTierOutput,
  FRONTAL_ANGLE_LIMITS,
  hasGeometryForPostureClass,
  isNaturalFrontalSafeZone,
  type FullPostureFeatures,
} from './frontPostureEngine';

function mildFrontalFeatures(
  overrides: Partial<FullPostureFeatures> = {}
): FullPostureFeatures {
  return {
    shoulder_roll_deg: 2.2,
    ear_roll_deg: 6.1,
    neck_lateral_bend_deg: 3.9,
    nose_offset_x_norm: 0.02,
    delta_nose_offset_x: 0.02,
    delta_shoulder_roll_deg: 2.2,
    delta_neck_height_nose: 0,
    delta_head_to_shoulder_ratio: 0,
    delta_head_pitch_nose_ear: 0,
    neck_height_nose_norm: 0.31,
    min_wrist_to_face_norm: 1.2,
    torso_sagittal_pitch_deg: 8,
    neck_sagittal_pitch_deg: 12,
    ...overrides,
  } as FullPostureFeatures;
}

test('mild frontal angles do not validate a noisy lateral ML class', () => {
  const features = mildFrontalFeatures();

  assert.equal(
    hasGeometryForPostureClass('leaning_left', features, false, false),
    false
  );
  assert.equal(
    hasGeometryForPostureClass('leaning_right', features, false, false),
    false
  );
});

test('a noisy non-upright probability cannot lower a geometrically good posture to 65%', () => {
  const output = buildThreeTierOutput(
    new Float64Array([0.1, 0.02, 0.03, 0.8, 0.05]),
    mildFrontalFeatures(),
    0,
    false,
    false
  );

  assert.equal(output.status, 'GOOD');
  assert.equal(output.primary_class, 'upright');
  assert.equal(output.active_faults.length, 0);
  assert.ok(output.posture_score >= 88);
});

test('a persistent, clearly tilted shoulder still produces a bounded warning score', () => {
  const features = mildFrontalFeatures({
    shoulder_roll_deg: 8.2,
    delta_shoulder_roll_deg: 8.2,
  });
  const output = buildThreeTierOutput(
    new Float64Array([0.2, 0.02, 0.03, 0.7, 0.05]),
    features,
    1.5,
    false,
    true
  );

  assert.equal(output.status, 'WARNING');
  assert.equal(output.primary_class, 'leaning_left');
  assert.ok(output.active_faults.includes('shoulder_imbalance'));
  assert.ok(output.posture_score >= 65 && output.posture_score <= 84);
});

test('one mildly noisy depth signal cannot keep the posture in backward warning', () => {
  const oneNoisySignal = mildFrontalFeatures({
    delta_head_to_shoulder_ratio: -0.07,
    delta_head_pitch_nose_ear: -0.02,
    torso_sagittal_pitch_deg: 4,
  });

  assert.equal(
    hasGeometryForPostureClass('leaning_backward', oneNoisySignal, true, true),
    false
  );
});

test('two agreeing depth signals still detect a real backward posture', () => {
  const backward = mildFrontalFeatures({
    delta_head_to_shoulder_ratio: -0.1,
    delta_head_pitch_nose_ear: -0.14,
    torso_sagittal_pitch_deg: 2,
  });

  assert.equal(
    hasGeometryForPostureClass('leaning_backward', backward, true, false),
    true
  );
});

test('the straight 4.3° / 3.2° / 7.4° HUD sample is inside the frontal safe zone', () => {
  const screenshotSample = mildFrontalFeatures({
    neck_lateral_bend_deg: 4.3,
    shoulder_roll_deg: 3.2,
    delta_shoulder_roll_deg: 3.2,
    ear_roll_deg: 7.4,
    // Mô phỏng một chỉ số Z vừa phải đang dao động từ webcam.
    delta_head_to_shoulder_ratio: -0.1,
  });

  assert.equal(isNaturalFrontalSafeZone(screenshotSample, false), true);
});

test('a clearly severe forward movement is not hidden by the frontal safe zone', () => {
  const severeForward = mildFrontalFeatures({
    delta_neck_height_nose: -0.4,
  });

  assert.equal(isNaturalFrontalSafeZone(severeForward, false), false);
});

test('frontal warning angles start at 9° shoulder, 14° head and 12° neck', () => {
  assert.deepEqual(FRONTAL_ANGLE_LIMITS.warning, {
    shoulder: 9,
    shoulderDelta: 8,
    head: 14,
    neck: 12,
  });

  assert.equal(
    hasGeometryForPostureClass(
      'leaning_left',
      mildFrontalFeatures({ shoulder_roll_deg: 8.9, delta_shoulder_roll_deg: 7.9 }),
      false,
      false
    ),
    false
  );
  assert.equal(
    hasGeometryForPostureClass(
      'leaning_left',
      mildFrontalFeatures({ shoulder_roll_deg: 9.1, delta_shoulder_roll_deg: 9.1 }),
      false,
      false
    ),
    true
  );
});
