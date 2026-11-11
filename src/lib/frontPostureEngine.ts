/**
 * Front-View Sitting Posture Recognition Engine V6 for BUGZ BrightUpGenZ.
 * - Extracts 36 frontal biomechanical features (29 Instant 3D + 7 Personal Calibration Deltas)
 * - Runs ExtraTrees + MLP Ensemble in pure Float64Array (< 0.2ms per frame)
 * - Produces 3-Tier Output (Status + 5 Frontal Classes + Active Anatomical Faults + 0-100 Score + Vietnamese Advice)
 * - Maps seamlessly to BUGZ P03 contract (PostureState & PostureReasonCode)
 */

import type { PostureReasonCode, PostureState } from '../types/bugz';

export type FrontalPostureClass =
  | 'upright'
  | 'leaning_forward'
  | 'leaning_backward'
  | 'leaning_left'
  | 'leaning_right';

export type FrontalFaultCode =
  | 'shoulder_imbalance'
  | 'head_tilt_left'
  | 'head_tilt_right'
  | 'text_neck'
  | 'too_close_forward'
  | 'slouch_backward'
  | 'chin_rest';

export const CLASS_NAMES: FrontalPostureClass[] = [
  'upright',
  'leaning_forward',
  'leaning_backward',
  'leaning_left',
  'leaning_right',
];

export const CLASS_LABELS_VI: Record<FrontalPostureClass, string> = {
  upright: 'Ngồi thẳng chuẩn',
  leaning_forward: 'Nhoài người / Cúi về trước',
  leaning_backward: 'Ngả người ra sau',
  leaning_left: 'Nghiêng người sang trái',
  leaning_right: 'Nghiêng người sang phải',
};

export const FAULT_LABELS_VI: Record<FrontalFaultCode, string> = {
  shoulder_imbalance: 'Lệch hai vai',
  head_tilt_left: 'Nghiêng đầu sang trái',
  head_tilt_right: 'Nghiêng đầu sang phải',
  text_neck: 'Cúi gằm / Rụt cổ',
  too_close_forward: 'Mắt quá gần màn hình',
  slouch_backward: 'Ngả trượt lưng ghế',
  chin_rest: 'Chống cằm / Tỳ tay',
};

// Ngưỡng góc cho camera chính diện (độ). Mốc bắt đầu cảnh báo được nới đủ rộng
// để các dao động tự nhiên 3–7° không bị xem là sai tư thế.
export const FRONTAL_ANGLE_LIMITS = {
  warning: {
    shoulder: 9.0,
    shoulderDelta: 8.0,
    head: 14.0,
    neck: 12.0,
  },
  recovery: {
    shoulder: 6.0,
    shoulderDelta: 5.5,
    head: 10.0,
    neck: 8.5,
  },
} as const;

export interface InstantPostureFeatures {
  shoulder_roll_deg: number;
  ear_roll_deg: number;
  eye_roll_deg: number;
  neck_lateral_bend_deg: number;
  nose_offset_x_norm: number;
  ear_mid_offset_x_norm: number;
  ear_shoulder_dist_asym: number;
  torso_coronal_lean_norm: number;
  neck_height_ear_norm: number;
  neck_height_nose_norm: number;
  neck_height_mouth_norm: number;
  head_pitch_nose_ear: number;
  head_pitch_eye_ear: number;
  chin_to_chest_ratio: number;
  left_neck_shoulder_angle_deg: number;
  right_neck_shoulder_angle_deg: number;
  head_to_shoulder_width_ratio: number;
  eye_to_shoulder_width_ratio: number;
  shoulder_span_3d_2d_ratio: number;
  nose_rel_z_norm: number;
  ear_rel_z_norm: number;
  shoulder_depth_z_norm: number;
  neck_sagittal_pitch_deg: number;
  torso_sagittal_pitch_deg: number;
  head_yaw_asymmetry: number;
  left_wrist_to_head_norm: number;
  right_wrist_to_head_norm: number;
  min_wrist_to_face_norm: number;
  shoulder_ear_triangle_area_norm: number;
}

export interface DeltaPostureFeatures {
  delta_neck_height_ear: number;
  delta_neck_height_nose: number;
  delta_head_pitch_nose_ear: number;
  delta_head_to_shoulder_ratio: number;
  delta_nose_offset_x: number;
  delta_shoulder_roll_deg: number;
  delta_nose_rel_z: number;
}

export type FullPostureFeatures = InstantPostureFeatures & DeltaPostureFeatures;

export interface ExportedTreeNode {
  left: number[];
  right: number[];
  feature: number[];
  threshold: number[];
  prob: number[][];
}

export interface ExportedModelHead {
  feature_cols: Array<keyof FullPostureFeatures>;
  imputer_medians: number[];
  scaler_mean: number[];
  scaler_scale: number[];
  mlp: {
    coefs: number[][][];
    intercepts: number[][];
  };
  trees: ExportedTreeNode[];
  ensemble_weights: [number, number];
}

export interface FrontPostureModelBundle {
  classes: FrontalPostureClass[];
  class_labels_vi: Record<FrontalPostureClass, string>;
  default_baseline: Partial<InstantPostureFeatures>;
  heads: {
    upper_instant: ExportedModelHead;
    upper_calibrated: ExportedModelHead;
    full_calibrated: ExportedModelHead;
  };
}

export interface ThreeTierPostureOutput {
  status: 'GOOD' | 'WARNING' | 'BAD';
  primary_class: FrontalPostureClass;
  primary_label_vi: string;
  confidence: number;
  posture_score: number;
  calibrated: boolean;
  active_faults: FrontalFaultCode[];
  probabilities: Record<FrontalPostureClass, number>;
  angles: {
    shoulder_roll_deg: number;
    head_roll_deg: number;
    neck_lateral_bend_deg: number;
    neck_pitch_deg: number;
    head_offset_x_pct: number;
    neck_height_change_pct: number;
    screen_proximity_change_pct: number;
  };
  duration_bad_sec: number;
  advice_vi: string;
  /** Mapped directly for BUGZ P03 MQTT/HTTP observation contract */
  bugz_posture: 'good' | 'bad' | 'absent';
  bugz_posture_code?: PostureReasonCode;
}

function norm3d(a: number[], b: number[]): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

function norm2d(a: number[], b: number[]): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1]);
}

function angle3ptDeg(a: number[], b: number[], c: number[]): number {
  const ux = a[0] - b[0],
    uy = a[1] - b[1],
    uz = a[2] - b[2];
  const vx = c[0] - b[0],
    vy = c[1] - b[1],
    vz = c[2] - b[2];
  const den = Math.hypot(ux, uy, uz) * Math.hypot(vx, vy, vz);
  if (den < 1e-6) return 90.0;
  const dot = (ux * vx + uy * vy + uz * vz) / den;
  const clamped = Math.max(-1.0, Math.min(1.0, dot));
  return (Math.acos(clamped) * 180.0) / Math.PI;
}

export function extractInstantFeatures(pts33: number[][]): InstantPostureFeatures {
  const nose = pts33[0];
  const l_eye_in = pts33[1] || pts33[2];
  const r_eye_in = pts33[4] || pts33[5];
  const l_eye = [
    0.38 * l_eye_in[0] + 0.62 * pts33[2][0],
    0.38 * l_eye_in[1] + 0.62 * pts33[2][1],
    0.38 * l_eye_in[2] + 0.62 * pts33[2][2],
  ];
  const r_eye = [
    0.38 * r_eye_in[0] + 0.62 * pts33[5][0],
    0.38 * r_eye_in[1] + 0.62 * pts33[5][1],
    0.38 * r_eye_in[2] + 0.62 * pts33[5][2],
  ];
  const l_ear = pts33[7];
  const r_ear = pts33[8];
  const l_mouth = pts33[9];
  const r_mouth = pts33[10];
  const l_sh = pts33[11];
  const r_sh = pts33[12];
  const l_wrist = pts33[15];
  const r_wrist = pts33[16];
  const l_hip = pts33[23];
  const r_hip = pts33[24];

  const mid_eye = [
    0.5 * (l_eye[0] + r_eye[0]),
    0.5 * (l_eye[1] + r_eye[1]),
    0.5 * (l_eye[2] + r_eye[2]),
  ];
  const mid_ear = [
    0.5 * (l_ear[0] + r_ear[0]),
    0.5 * (l_ear[1] + r_ear[1]),
    0.5 * (l_ear[2] + r_ear[2]),
  ];
  const mid_mouth = [
    0.5 * (l_mouth[0] + r_mouth[0]),
    0.5 * (l_mouth[1] + r_mouth[1]),
    0.5 * (l_mouth[2] + r_mouth[2]),
  ];
  const mid_sh = [
    0.5 * (l_sh[0] + r_sh[0]),
    0.5 * (l_sh[1] + r_sh[1]),
    0.5 * (l_sh[2] + r_sh[2]),
  ];
  const mid_hip = [
    0.5 * (l_hip[0] + r_hip[0]),
    0.5 * (l_hip[1] + r_hip[1]),
    0.5 * (l_hip[2] + r_hip[2]),
  ];

  const w_sh_3d = Math.max(norm3d(l_sh, r_sh), 1e-4);
  const w_sh_xy = Math.max(norm2d(l_sh, r_sh), 1e-4);
  const d_ear_xy = Math.max(norm2d(l_ear, r_ear), 1e-4);
  const d_eye_xy = Math.max(norm2d(l_eye, r_eye), 1e-4);

  const horiz_sign = l_sh[0] - r_sh[0] >= 0 ? 1.0 : -1.0;
  const sh_dx = Math.max(Math.abs(l_sh[0] - r_sh[0]), 1e-4);
  const ear_dx = Math.max(Math.abs(l_ear[0] - r_ear[0]), 1e-4);
  const eye_dx = Math.max(Math.abs(l_eye[0] - r_eye[0]), 1e-4);

  // Group 1: Coronal Balance & Lateral Lean
  const shoulder_roll_deg = (Math.atan2(l_sh[1] - r_sh[1], sh_dx) * 180.0) / Math.PI;
  const raw_ear_roll_deg = (Math.atan2(l_ear[1] - r_ear[1], ear_dx) * 180.0) / Math.PI;
  const eye_roll_deg = (Math.atan2(l_eye[1] - r_eye[1], eye_dx) * 180.0) / Math.PI;
  // Kết hợp trục 2 con ngươi mắt với trục 2 tai và khử nhiễu bóng tối nhẹ (< 6.0°) của BlazePose
  // để góc Đầu và Lưng luôn cân chuẩn khi ngồi thẳng, nhưng vẫn bắt nhạy khi nghiêng đầu thật (>= 11°)
  const blended_head_roll = 0.68 * eye_roll_deg + 0.32 * raw_ear_roll_deg;
  const rollAbs = Math.abs(blended_head_roll);
  const rollGain =
    rollAbs < 6.0 ? 0.32 : Math.min(1.0, 0.32 + ((rollAbs - 6.0) / 5.0) * 0.68);
  const ear_roll_deg = blended_head_roll * rollGain;
  const neck_lateral_bend_deg = ear_roll_deg - shoulder_roll_deg;

  const nose_offset_x_norm = ((nose[0] - mid_sh[0]) * horiz_sign) / w_sh_3d;
  const ear_mid_offset_x_norm = ((mid_ear[0] - mid_sh[0]) * horiz_sign) / w_sh_3d;

  const dist_l_ear_sh = norm2d(l_ear, l_sh);
  const dist_r_ear_sh = norm2d(r_ear, r_sh);
  const ear_shoulder_dist_asym = (dist_l_ear_sh - dist_r_ear_sh) / w_sh_3d;

  const torso_vec = [
    mid_sh[0] - mid_hip[0],
    mid_sh[1] - mid_hip[1],
    mid_sh[2] - mid_hip[2],
  ];
  const torso_coronal_lean_norm = (torso_vec[0] * horiz_sign) / w_sh_3d;

  // Group 2: Vertical Neck Extension, Head Pitch & Slouch
  const neck_height_ear_norm = (mid_sh[1] - mid_ear[1]) / w_sh_3d;
  const neck_height_nose_norm = (mid_sh[1] - nose[1]) / w_sh_3d;
  const neck_height_mouth_norm = (mid_sh[1] - mid_mouth[1]) / w_sh_3d;

  const head_pitch_nose_ear = (nose[1] - mid_ear[1]) / d_eye_xy;
  const head_pitch_eye_ear = (mid_eye[1] - mid_ear[1]) / d_eye_xy;

  const face_lower_h = Math.max(mid_mouth[1] - mid_eye[1], 1e-4);
  const chin_to_chest_ratio = (mid_sh[1] - mid_mouth[1]) / face_lower_h;

  const left_neck_shoulder_angle_deg = angle3ptDeg(l_ear, l_sh, r_sh);
  const right_neck_shoulder_angle_deg = angle3ptDeg(r_ear, r_sh, l_sh);

  // Group 3: Depth Z & Perspective Scale
  const head_to_shoulder_width_ratio = d_ear_xy / w_sh_xy;
  const eye_to_shoulder_width_ratio = d_eye_xy / w_sh_xy;
  const shoulder_span_3d_2d_ratio = w_sh_xy / w_sh_3d;

  const nose_rel_z_norm = (nose[2] - mid_sh[2]) / w_sh_3d;
  const ear_rel_z_norm = (mid_ear[2] - mid_sh[2]) / w_sh_3d;
  const shoulder_depth_z_norm = torso_vec[2] / w_sh_3d;

  const neck_vert_dy = Math.max(mid_sh[1] - mid_ear[1], 1e-4);
  const neck_sagittal_pitch_deg =
    (Math.atan2(-(mid_ear[2] - mid_sh[2]), neck_vert_dy) * 180.0) / Math.PI;

  const torso_vert_dy = Math.max(mid_hip[1] - mid_sh[1], 1e-4);
  const torso_sagittal_pitch_deg =
    (Math.atan2(-torso_vec[2], torso_vert_dy) * 180.0) / Math.PI;

  // Group 4: Face Yaw, Hand-to-Face Interaction & Geometry
  const d_nose_l_ear = norm2d(nose, l_ear);
  const d_nose_r_ear = norm2d(nose, r_ear);
  const head_yaw_asymmetry = (d_nose_l_ear - d_nose_r_ear) / d_ear_xy;

  const l_wrist_head =
    Math.min(norm2d(l_wrist, l_ear), norm2d(l_wrist, mid_mouth)) / w_sh_3d;
  const r_wrist_head =
    Math.min(norm2d(r_wrist, r_ear), norm2d(r_wrist, mid_mouth)) / w_sh_3d;
  const min_wrist_to_face_norm = Math.min(l_wrist_head, r_wrist_head);

  const cross_2d =
    (r_sh[0] - l_sh[0]) * (mid_ear[1] - l_sh[1]) -
    (r_sh[1] - l_sh[1]) * (mid_ear[0] - l_sh[0]);
  const shoulder_ear_triangle_area_norm = Math.abs(cross_2d) / (w_sh_3d * w_sh_3d);

  return {
    shoulder_roll_deg,
    ear_roll_deg,
    eye_roll_deg,
    neck_lateral_bend_deg,
    nose_offset_x_norm,
    ear_mid_offset_x_norm,
    ear_shoulder_dist_asym,
    torso_coronal_lean_norm,
    neck_height_ear_norm,
    neck_height_nose_norm,
    neck_height_mouth_norm,
    head_pitch_nose_ear,
    head_pitch_eye_ear,
    chin_to_chest_ratio,
    left_neck_shoulder_angle_deg,
    right_neck_shoulder_angle_deg,
    head_to_shoulder_width_ratio,
    eye_to_shoulder_width_ratio,
    shoulder_span_3d_2d_ratio,
    nose_rel_z_norm,
    ear_rel_z_norm,
    shoulder_depth_z_norm,
    neck_sagittal_pitch_deg,
    torso_sagittal_pitch_deg,
    head_yaw_asymmetry,
    left_wrist_to_head_norm: l_wrist_head,
    right_wrist_to_head_norm: r_wrist_head,
    min_wrist_to_face_norm,
    shoulder_ear_triangle_area_norm,
  };
}

export function computeDeltaFeatures(
  inst: InstantPostureFeatures,
  baseline: Partial<InstantPostureFeatures> | null
): DeltaPostureFeatures {
  if (!baseline) {
    return {
      delta_neck_height_ear: 0.0,
      delta_neck_height_nose: 0.0,
      delta_head_pitch_nose_ear: 0.0,
      delta_head_to_shoulder_ratio: 0.0,
      delta_nose_offset_x: 0.0,
      delta_shoulder_roll_deg: 0.0,
      delta_nose_rel_z: 0.0,
    };
  }
  const base_ear_h = Math.max(Math.abs(baseline.neck_height_ear_norm ?? 0.45), 0.1);
  const base_nose_h = Math.max(Math.abs(baseline.neck_height_nose_norm ?? 0.35), 0.1);
  const base_hs_ratio = Math.max(Math.abs(baseline.head_to_shoulder_width_ratio ?? 0.42), 0.1);

  return {
    delta_neck_height_ear:
      (inst.neck_height_ear_norm - (baseline.neck_height_ear_norm ?? inst.neck_height_ear_norm)) /
      base_ear_h,
    delta_neck_height_nose:
      (inst.neck_height_nose_norm - (baseline.neck_height_nose_norm ?? inst.neck_height_nose_norm)) /
      base_nose_h,
    delta_head_pitch_nose_ear:
      inst.head_pitch_nose_ear - (baseline.head_pitch_nose_ear ?? inst.head_pitch_nose_ear),
    delta_head_to_shoulder_ratio:
      (inst.head_to_shoulder_width_ratio -
        (baseline.head_to_shoulder_width_ratio ?? inst.head_to_shoulder_width_ratio)) /
      base_hs_ratio,
    delta_nose_offset_x: inst.nose_offset_x_norm - (baseline.nose_offset_x_norm ?? 0.0),
    delta_shoulder_roll_deg: inst.shoulder_roll_deg - (baseline.shoulder_roll_deg ?? 0.0),
    delta_nose_rel_z: inst.nose_rel_z_norm - (baseline.nose_rel_z_norm ?? inst.nose_rel_z_norm),
  };
}

function evalMLP(xScaled: Float64Array, mlp: ExportedModelHead['mlp']): Float64Array {
  let act = xScaled;
  const numLayers = mlp.coefs.length;
  for (let l = 0; l < numLayers; l++) {
    const W = mlp.coefs[l];
    const b = mlp.intercepts[l];
    const outDim = b.length;
    const next = new Float64Array(outDim);
    for (let j = 0; j < outDim; j++) {
      let s = b[j];
      for (let i = 0; i < act.length; i++) {
        s += act[i] * W[i][j];
      }
      next[j] = l < numLayers - 1 ? (s > 0 ? s : 0) : s;
    }
    act = next;
  }
  let maxLogit = -Infinity;
  for (let i = 0; i < act.length; i++) {
    if (act[i] > maxLogit) maxLogit = act[i];
  }
  let sumExp = 0.0;
  const probs = new Float64Array(act.length);
  for (let i = 0; i < act.length; i++) {
    probs[i] = Math.exp(act[i] - maxLogit);
    sumExp += probs[i];
  }
  for (let i = 0; i < act.length; i++) {
    probs[i] /= sumExp || 1.0;
  }
  return probs;
}

function evalTrees(
  xScaled: Float64Array,
  trees: ExportedTreeNode[],
  numClasses: number
): Float64Array {
  const probs = new Float64Array(numClasses);
  if (!trees || trees.length === 0) return probs;
  for (let t = 0; t < trees.length; t++) {
    const tree = trees[t];
    let node = 0;
    while (tree.left[node] !== -1) {
      const fIdx = tree.feature[node];
      const thresh = tree.threshold[node];
      node = xScaled[fIdx] <= thresh ? tree.left[node] : tree.right[node];
    }
    const leafProb = tree.prob[node];
    for (let c = 0; c < numClasses; c++) {
      probs[c] += leafProb[c];
    }
  }
  for (let c = 0; c < numClasses; c++) {
    probs[c] /= trees.length;
  }
  return probs;
}

export function predictHeadProbabilities(
  features: FullPostureFeatures,
  modelBundle: FrontPostureModelBundle,
  headName: keyof FrontPostureModelBundle['heads']
): Float64Array {
  const head = modelBundle.heads[headName];
  const cols = head.feature_cols;
  const xScaled = new Float64Array(cols.length);
  for (let i = 0; i < cols.length; i++) {
    const raw = features[cols[i]];
    const val = Number.isFinite(raw) ? raw : head.imputer_medians[i];
    const scale = head.scaler_scale[i] || 1.0;
    xScaled[i] = (val - head.scaler_mean[i]) / scale;
  }

  const pTrees = evalTrees(xScaled, head.trees, CLASS_NAMES.length);
  const pMlp = evalMLP(xScaled, head.mlp);
  const [wTree, wMlp] = head.ensemble_weights || [0.55, 0.45];

  const combined = new Float64Array(CLASS_NAMES.length);
  let sum = 0.0;
  for (let c = 0; c < CLASS_NAMES.length; c++) {
    combined[c] = wTree * pTrees[c] + wMlp * pMlp[c];
    sum += combined[c];
  }
  for (let c = 0; c < CLASS_NAMES.length; c++) {
    combined[c] /= sum || 1.0;
  }
  return combined;
}

export function refineWithBiomechanicalCalibration(
  rawProbs: Float64Array,
  features: FullPostureFeatures,
  isCalibrated: boolean
): Float64Array {
  const probs = new Float64Array(rawProbs);
  const sh_roll = features.shoulder_roll_deg;
  const ear_roll = features.ear_roll_deg;
  const neck_bend = features.neck_lateral_bend_deg;
  const nose_off_x = features.nose_offset_x_norm;
  const delta_off_x = isCalibrated ? features.delta_nose_offset_x : nose_off_x;
  const delta_sh_roll = isCalibrated ? features.delta_shoulder_roll_deg : sh_roll;
  const delta_nose_h = features.delta_neck_height_nose;
  const delta_scale = features.delta_head_to_shoulder_ratio;
  const delta_pitch = features.delta_head_pitch_nose_ear;

  // Khi không có dấu hiệu ngả người ra sau, dập tắt nhiễu leaning_backward từ cây quyết định gốc
  const isBackwardSignal =
    delta_scale <= -0.068 ||
    delta_pitch <= -0.095 ||
    (delta_scale <= -0.042 && (delta_pitch <= -0.055 || delta_nose_h >= 0.09));
  if (!isBackwardSignal) {
    probs[2] *= 0.12;
  }

  // Khi không có dấu hiệu cúi/nhoài người về trước, dập tắt nhiễu leaning_forward từ model gốc
  const isForwardSignal =
    delta_nose_h <= -0.24 ||
    delta_scale >= 0.165 ||
    (delta_scale >= 0.11 && delta_nose_h <= -0.15) ||
    (delta_pitch >= 0.36 && delta_nose_h <= -0.11);
  if (!isForwardSignal) {
    probs[1] *= 0.12;
  }

  // Khi không có dấu hiệu lệch vai / nghiêng đầu / lệch trục thân ngang, dập tắt nhiễu leaning_left/right từ model gốc
  const isLateralLeftSignal =
    delta_off_x >= 0.08 ||
    delta_sh_roll >= FRONTAL_ANGLE_LIMITS.warning.shoulderDelta ||
    sh_roll >= FRONTAL_ANGLE_LIMITS.warning.shoulder ||
    ear_roll >= FRONTAL_ANGLE_LIMITS.warning.head ||
    neck_bend >= FRONTAL_ANGLE_LIMITS.warning.neck;
  const isLateralRightSignal =
    delta_off_x <= -0.08 ||
    delta_sh_roll <= -FRONTAL_ANGLE_LIMITS.warning.shoulderDelta ||
    sh_roll <= -FRONTAL_ANGLE_LIMITS.warning.shoulder ||
    ear_roll <= -FRONTAL_ANGLE_LIMITS.warning.head ||
    neck_bend <= -FRONTAL_ANGLE_LIMITS.warning.neck;
  if (!isLateralLeftSignal) {
    probs[3] *= 0.12;
  }
  if (!isLateralRightSignal) {
    probs[4] *= 0.12;
  }

  // Cộng xác suất cho hướng lệch thực sự phát hiện được
  if (isLateralLeftSignal) {
    probs[3] +=
      0.55 * Math.min(1.0, Math.max(delta_off_x / 0.12, delta_sh_roll / 8.0, ear_roll / 16.0));
  } else if (isLateralRightSignal) {
    probs[4] +=
      0.55 * Math.min(1.0, Math.max(-delta_off_x / 0.12, -delta_sh_roll / 8.0, -ear_roll / 16.0));
  }

  if (isForwardSignal) {
    probs[1] +=
      0.55 *
      Math.min(
        1.0,
        Math.max(-delta_nose_h / 0.32, delta_scale / 0.24, delta_pitch / 0.55)
      );
  }

  if (isBackwardSignal) {
    probs[2] +=
      0.60 *
      Math.min(
        1.0,
        Math.max(-delta_scale / 0.11, -delta_pitch / 0.16, delta_nose_h / 0.16)
      );
  }

  // Vùng an toàn tự nhiên: khi không vi phạm bất kỳ ngưỡng sinh cơ học nào,
  // đảm bảo upright chiếm ưu thế tuyệt đối để điểm tư thế đạt 90%–98% ổn định
  if (!isBackwardSignal && !isForwardSignal && !isLateralLeftSignal && !isLateralRightSignal) {
    probs[0] += 1.65;
  }

  let sum = 0.0;
  for (let i = 0; i < probs.length; i++) sum += probs[i];
  for (let i = 0; i < probs.length; i++) probs[i] /= sum || 1.0;
  return probs;
}

/**
 * Chỉ cho phép nhãn ML kích hoạt cảnh báo khi landmark cũng cho thấy đúng kiểu lệch đó.
 * Model được dùng để phân loại hướng; hình học là "cổng an toàn" chống báo giả do
 * ánh sáng, góc webcam hoặc các điểm hông/cổ bị MediaPipe ước lượng sai.
 */
export function hasGeometryForPostureClass(
  postureClass: FrontalPostureClass,
  features: FullPostureFeatures,
  isCalibrated: boolean,
  inDeviationHold = false
): boolean {
  if (postureClass === 'upright') return false;

  const deltaShRoll = isCalibrated
    ? features.delta_shoulder_roll_deg
    : features.shoulder_roll_deg;
  const deltaOffset = isCalibrated
    ? features.delta_nose_offset_x
    : features.nose_offset_x_norm;
  const deltaNoseH = features.delta_neck_height_nose;
  const deltaScale = features.delta_head_to_shoulder_ratio;
  const deltaPitch = features.delta_head_pitch_nose_ear;
  const torsoPitch = features.torso_sagittal_pitch_deg ?? 10.0;

  if (postureClass === 'leaning_forward') {
    return inDeviationHold
      ? deltaNoseH <= -0.19 ||
          deltaScale >= 0.16 ||
          (deltaPitch >= 0.30 && deltaNoseH <= -0.10)
      : deltaNoseH <= -0.25 ||
          deltaScale >= 0.21 ||
          (deltaPitch >= 0.38 && deltaNoseH <= -0.12);
  }

  if (postureClass === 'leaning_backward') {
    // Chiều sâu của webcam đơn thường nhiễu hơn trục X/Y. Một giá trị scale/pitch/torso
    // hơi âm không đủ kết luận ngả sau; cần 2 tín hiệu đồng thuận hoặc 1 tín hiệu rất mạnh.
    const scaleModerate = deltaScale <= (inDeviationHold ? -0.065 : -0.082);
    const pitchModerate = deltaPitch <= (inDeviationHold ? -0.095 : -0.12);
    const torsoModerate = torsoPitch <= (inDeviationHold ? -3.0 : -3.8);
    const evidenceCount = Number(scaleModerate) + Number(pitchModerate) + Number(torsoModerate);
    const oneStrongSignal = inDeviationHold
      ? deltaScale <= -0.11 || deltaPitch <= -0.16 || torsoPitch <= -6.5
      : deltaScale <= -0.14 || deltaPitch <= -0.20 || torsoPitch <= -8.0;
    return oneStrongSignal || evidenceCount >= 2;
  }

  const sign = postureClass === 'leaning_left' ? 1 : -1;
  const limits = inDeviationHold
    ? FRONTAL_ANGLE_LIMITS.recovery
    : FRONTAL_ANGLE_LIMITS.warning;
  const offsetThreshold = inDeviationHold ? 0.06 : 0.08;
  const shoulderThreshold = limits.shoulder;
  const deltaShoulderThreshold = isCalibrated ? limits.shoulderDelta : limits.shoulder;
  const headThreshold = limits.head;
  const neckThreshold = limits.neck;

  return (
    sign * deltaOffset >= offsetThreshold ||
    sign * features.shoulder_roll_deg >= shoulderThreshold ||
    sign * deltaShRoll >= deltaShoulderThreshold ||
    sign * features.ear_roll_deg >= headThreshold ||
    sign * features.neck_lateral_bend_deg >= neckThreshold
  );
}

/**
 * Vùng an toàn dành cho camera chính diện. Khi đầu–vai–cổ đều đang cân như ảnh HUD,
 * chỉ một dao động chiều sâu vừa phải không được phép giữ WARNING/BAD. Các ngưỡng
 * chiều sâu rất mạnh vẫn đi xuyên qua vùng này để không bỏ sót cúi/ngả rõ ràng.
 */
export function isNaturalFrontalSafeZone(
  features: FullPostureFeatures,
  isCalibrated: boolean
): boolean {
  const deltaShRoll = isCalibrated
    ? features.delta_shoulder_roll_deg
    : features.shoulder_roll_deg;
  const deltaOffset = isCalibrated
    ? features.delta_nose_offset_x
    : features.nose_offset_x_norm;
  const visiblyCentered =
    Math.abs(features.shoulder_roll_deg) < FRONTAL_ANGLE_LIMITS.recovery.shoulder &&
    Math.abs(deltaShRoll) < FRONTAL_ANGLE_LIMITS.recovery.shoulderDelta &&
    Math.abs(features.ear_roll_deg) < FRONTAL_ANGLE_LIMITS.recovery.head &&
    Math.abs(features.neck_lateral_bend_deg) < FRONTAL_ANGLE_LIMITS.recovery.neck &&
    Math.abs(deltaOffset) < 0.06 &&
    features.min_wrist_to_face_norm > 0.42;
  const severeDepthDeviation =
    features.delta_neck_height_nose <= -0.34 ||
    features.delta_head_to_shoulder_ratio >= 0.30 ||
    features.delta_head_to_shoulder_ratio <= -0.18 ||
    features.delta_head_pitch_nose_ear >= 0.52 ||
    features.delta_head_pitch_nose_ear <= -0.24;

  return visiblyCentered && !severeDepthDeviation;
}

export function buildThreeTierOutput(
  probsArray: Float64Array,
  features: FullPostureFeatures,
  durationBadSec: number,
  isCalibrated: boolean,
  inDeviationEpisode?: boolean
): ThreeTierPostureOutput {
  let bestIdx = 0;
  for (let i = 1; i < probsArray.length; i++) {
    if (probsArray[i] > probsArray[bestIdx]) bestIdx = i;
  }
  const primary_class = CLASS_NAMES[bestIdx];
  const confidence = probsArray[bestIdx];
  const probabilities = {} as Record<FrontalPostureClass, number>;
  CLASS_NAMES.forEach((c, idx) => {
    probabilities[c] = Number(probsArray[idx].toFixed(4));
  });

  const sh_roll = features.shoulder_roll_deg;
  const delta_sh_roll = isCalibrated ? features.delta_shoulder_roll_deg : sh_roll;
  const ear_roll = features.ear_roll_deg;
  const neck_bend = features.neck_lateral_bend_deg;
  const nose_off_x = isCalibrated ? features.delta_nose_offset_x : features.nose_offset_x_norm;
  const delta_nose_h = features.delta_neck_height_nose;
  const delta_scale = features.delta_head_to_shoulder_ratio;
  const delta_pitch = features.delta_head_pitch_nose_ear;
  const min_wrist = features.min_wrist_to_face_norm;
  const primaryHasGeometry = hasGeometryForPostureClass(
    primary_class,
    features,
    isCalibrated,
    durationBadSec > 0
  );

  const active_faults: FrontalFaultCode[] = [];
  const advice_parts: string[] = [];

  // Hysteresis (Schmitt Trigger):
  // - Khi đang ở trạng thái GOOD (durationBadSec === 0): dùng ngưỡng vừa phải (6.0° vai, 11.0° đầu)
  // - Khi đã ở trạng thái WARNING / BAD (durationBadSec > 0): hạ nhẹ ngưỡng thoát (4.2° vai, 8.5° đầu)
  //   để không bị nhấp nháy Xanh <-> Vàng liên tục khi người dùng ngồi ngay sát ranh giới ngưỡng.
  const inDeviationHold = durationBadSec > 0;
  const angleLimits = inDeviationHold
    ? FRONTAL_ANGLE_LIMITS.recovery
    : FRONTAL_ANGLE_LIMITS.warning;
  const shRollThresh = angleLimits.shoulder;
  const deltaShRollThresh = isCalibrated ? angleLimits.shoulderDelta : angleLimits.shoulder;
  const earRollThresh = angleLimits.head;
  const neckBendThresh = angleLimits.neck;
  const noseHThresh = inDeviationHold ? -0.19 : -0.25;
  const scaleThresh = inDeviationHold ? 0.16 : 0.21;
  const pitchThresh = inDeviationHold ? 0.30 : 0.38;
  const isSlouchBackwardGeom = hasGeometryForPostureClass(
    'leaning_backward',
    features,
    isCalibrated,
    inDeviationHold
  );

  if (Math.abs(sh_roll) >= shRollThresh || Math.abs(delta_sh_roll) >= deltaShRollThresh) {
    active_faults.push('shoulder_imbalance');
    const eff_roll = Math.abs(delta_sh_roll) >= Math.abs(sh_roll) ? delta_sh_roll : sh_roll;
    const side = eff_roll > 0 ? 'trái' : 'phải';
    advice_parts.push(`cân bằng lại hai vai (vai ${side} lệch ~${Math.max(6, Math.round(Math.abs(eff_roll)))}°)`);
  }

  if (Math.abs(ear_roll) >= earRollThresh || Math.abs(neck_bend) >= neckBendThresh) {
    active_faults.push(ear_roll > 0 ? 'head_tilt_left' : 'head_tilt_right');
    const side = ear_roll > 0 ? 'trái' : 'phải';
    advice_parts.push(
      `giữ đầu thẳng (nghiêng ${side} ~${Math.max(10, Math.round(Math.abs(ear_roll)))}°)`
    );
  }

  if (
    delta_nose_h <= noseHThresh ||
    features.neck_height_nose_norm <= 0.11 ||
    (delta_pitch >= pitchThresh && delta_nose_h <= -0.12)
  ) {
    active_faults.push('text_neck');
    advice_parts.push('nâng cằm và vươn thẳng cổ (đang cúi gằm / rụt cổ)');
  }

  if (
    (primary_class === 'leaning_forward' && primaryHasGeometry) ||
    delta_scale >= scaleThresh
  ) {
    active_faults.push('too_close_forward');
    advice_parts.push('lùi lưng tựa vào ghế, giữ khoảng cách mắt với màn hình');
  } else if (
    (primary_class === 'leaning_backward' && primaryHasGeometry) ||
    isSlouchBackwardGeom
  ) {
    active_faults.push('slouch_backward');
    advice_parts.push('đẩy hông sát vào tựa ghế, dựng thẳng lưng trên');
  }

  if (
    (primary_class === 'leaning_left' || primary_class === 'leaning_right') &&
    primaryHasGeometry &&
    Math.abs(nose_off_x) >= (inDeviationHold ? 0.042 : 0.055)
  ) {
    const side = primary_class === 'leaning_left' ? 'trái' : 'phải';
    if (!advice_parts.some((a) => a.includes('vai'))) {
      advice_parts.push(`đưa trọng tâm thân trên về giữa (đang nghiêng sang ${side})`);
    }
  }

  if (min_wrist <= (inDeviationHold ? 0.46 : 0.42)) {
    active_faults.push('chin_rest');
    advice_parts.push('hạ tay chống cằm xuống bàn');
  }

  let status: 'GOOD' | 'WARNING' | 'BAD' = 'GOOD';
  let advice_vi = 'Tư thế ngồi chuẩn! Hãy duy trì và thả lỏng hai vai.';
  let display_class: FrontalPostureClass = primaryHasGeometry ? primary_class : 'upright';

  // Khi phát hiện lệch nhưng primary_class vẫn là upright (ví dụ chỉ nhích lệch vai hoặc nghiêng đầu nhẹ),
  // tự động gán nhãn hiển thị tương ứng để người dùng thấy rõ ngay ở trạng thái Vàng (WARNING)
  if (display_class === 'upright' && active_faults.length > 0) {
    if (active_faults.includes('slouch_backward')) {
      display_class = 'leaning_backward';
    } else if (active_faults.includes('too_close_forward') || active_faults.includes('text_neck')) {
      display_class = 'leaning_forward';
    } else if (active_faults.includes('head_tilt_left')) {
      display_class = 'leaning_left';
    } else if (active_faults.includes('head_tilt_right')) {
      display_class = 'leaning_right';
    } else if (active_faults.includes('shoulder_imbalance')) {
      display_class = delta_sh_roll >= 0 ? 'leaning_left' : 'leaning_right';
    }
  }

  // Cơ chế chuyển trạng thái êm ái:
  // - Xanh (GOOD) -> Vàng (WARNING): Phản hồi ngay khi phát hiện nhích vai, nghiêng đầu, cúi người
  // - Vàng (WARNING) -> Đỏ (BAD): Debounce 10.0 giây (giữ lệch liên tục 10s mới chuyển sang Đỏ và cộng lượt cảnh báo)
  // - Vàng/Đỏ -> Xanh (GOOD): Duy trì ổn định nhờ durationBadSec (chống nhấp nháy ở ngưỡng biên)
  // Nếu runtime truyền cờ inDeviationEpisode thì dùng làm nguồn quyết định duy nhất
  // (đã qua lọc nhiễu 300ms + hysteresis), tránh lệch ngưỡng giữa runtime và engine.
  const hasRawDeviation =
    inDeviationEpisode !== undefined
      ? inDeviationEpisode
      : primary_class !== 'upright' || active_faults.length > 0 || durationBadSec > 0;
  if (!hasRawDeviation) {
    status = 'GOOD';
    display_class = 'upright';
    advice_vi = 'Tư thế ngồi chuẩn! Hãy duy trì và thả lỏng hai vai.';
  } else if (durationBadSec < 10.0) {
    status = 'WARNING';
    const labelVi = CLASS_LABELS_VI[display_class] || display_class;
    advice_vi =
      advice_parts.length > 0
        ? `Lưu ý: Hãy ${advice_parts.join(', ')}.`
        : display_class === 'upright'
        ? 'Lưu ý: Tư thế đang hơi lệch — hãy ngồi thẳng lưng, cân hai vai nhé.'
        : `Lưu ý: Phát hiện ${labelVi.toLowerCase()} — hãy ngồi thẳng lại nhé.`;
  } else {
    status = 'BAD';
    const labelVi = CLASS_LABELS_VI[display_class] || display_class;
    advice_vi =
      advice_parts.length > 0
        ? `${labelVi}: Hãy ${advice_parts.join(', ')}.`
        : display_class === 'upright'
        ? 'Tư thế chưa phù hợp đã lâu — hãy ngồi thẳng lưng, cân hai vai nhé.'
        : `Phát hiện ${labelVi.toLowerCase()} — hãy điều chỉnh về tư thế ngồi thẳng.`;
  }

  // Điểm phải đồng nhất với trạng thái. Xác suất ML thô chỉ được trừ điểm khi đã có
  // một episode lệch thật; nếu hình học vẫn trong vùng an toàn thì không để một nhãn
  // ML nhiễu kéo tư thế thẳng từ ~95 xuống 60–70 điểm.
  const p_upright = probsArray[0];
  let penalty = hasRawDeviation ? (1.0 - p_upright) * 34.0 : 0.0;
  penalty += Math.min(15.0, Math.max(0.0, Math.abs(delta_sh_roll) - 2.0) * 1.6);
  penalty += Math.min(15.0, Math.max(0.0, Math.abs(ear_roll) - 5.5) * 0.85);
  penalty += Math.min(18.0, Math.max(0.0, -delta_nose_h * 45.0));
  if (hasRawDeviation) penalty += Math.min(16.0, 4.0 + durationBadSec * 1.2);
  let posture_score = Math.round(Math.max(5, Math.min(100, 100.0 - penalty)));
  if (status === 'GOOD') posture_score = Math.max(88, posture_score);
  else if (status === 'WARNING') posture_score = Math.max(65, Math.min(89, posture_score));
  else posture_score = Math.max(40, Math.min(84, posture_score));

  // Map to BUGZ P03 contract (chỉ ghi nhận 'bad' khi đã chuyển sang Đỏ >= 10.0s)
  const isEffectiveBad = status === 'BAD';

  const bugz_posture: 'good' | 'bad' | 'absent' = isEffectiveBad ? 'bad' : 'good';
  let bugz_posture_code: PostureReasonCode | undefined;
  if (isEffectiveBad) {
    if (active_faults.includes('too_close_forward') && delta_scale >= 0.12) {
      bugz_posture_code = 'EYES_TOO_CLOSE';
    } else if (display_class === 'leaning_forward' || active_faults.includes('text_neck')) {
      bugz_posture_code = 'HEAD_FORWARD';
    } else if (
      display_class === 'leaning_left' ||
      display_class === 'leaning_right' ||
      display_class === 'leaning_backward' ||
      active_faults.includes('shoulder_imbalance')
    ) {
      bugz_posture_code = 'TRUNK_LEAN';
    } else {
      bugz_posture_code = 'UNSPECIFIED_BAD_POSTURE';
    }
  }

  return {
    status,
    primary_class: display_class,
    primary_label_vi: CLASS_LABELS_VI[display_class] || display_class,
    confidence: Number(confidence.toFixed(4)),
    posture_score,
    calibrated: isCalibrated,
    active_faults,
    probabilities,
    angles: {
      shoulder_roll_deg: Number(sh_roll.toFixed(1)),
      head_roll_deg: Number(ear_roll.toFixed(1)),
      neck_lateral_bend_deg: Number(neck_bend.toFixed(1)),
      neck_pitch_deg: Number(features.neck_sagittal_pitch_deg.toFixed(1)),
      head_offset_x_pct: Number((nose_off_x * 100.0).toFixed(1)),
      neck_height_change_pct: Number((delta_nose_h * 100.0).toFixed(1)),
      screen_proximity_change_pct: Number((delta_scale * 100.0).toFixed(1)),
    },
    duration_bad_sec: Number(durationBadSec.toFixed(1)),
    advice_vi,
    bugz_posture,
    bugz_posture_code,
  };
}
