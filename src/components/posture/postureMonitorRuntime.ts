import {
  CLASS_NAMES,
  FRONTAL_ANGLE_LIMITS,
  buildThreeTierOutput,
  computeDeltaFeatures,
  extractInstantFeatures,
  hasGeometryForPostureClass,
  isNaturalFrontalSafeZone,
  predictHeadProbabilities,
  refineWithBiomechanicalCalibration,
  type FrontPostureModelBundle,
  type InstantPostureFeatures,
  type ThreeTierPostureOutput,
} from '../../lib/frontPostureEngine';
import { getSavedVoicePreset, speakVietnameseNeuralVoice } from '../../lib/voiceTtsClient';
import { drawBiomechanicalHudCanvas } from './postureSkeletonCanvas';

const LOCAL_MP_VISION_MJS = '/models/mediapipe/vision_bundle.mjs';
const LOCAL_MP_WASM_DIR = '/models/mediapipe/wasm';
const CDN_MP_VISION = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14';
const LOCAL_POSE_TASK_URL = '/models/pose_landmarker_full.task';
const CDN_POSE_TASK_URL =
  'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task';
const MODEL_BUNDLE_URL = '/models/front_posture_model.json';

interface NormalizedLandmark {
  x: number;
  y: number;
  z: number;
  visibility?: number;
}

interface PoseLandmarkerResult {
  landmarks?: NormalizedLandmark[][];
  worldLandmarks?: NormalizedLandmark[][];
}

interface PoseLandmarkerInstance {
  detectForVideo: (video: HTMLVideoElement, timestampMs: number) => PoseLandmarkerResult;
  close?: () => void;
}

export const DEFAULT_POSTURE_OUTPUT: ThreeTierPostureOutput = {
  status: 'GOOD',
  primary_class: 'upright',
  primary_label_vi: 'Ngồi thẳng chuẩn',
  confidence: 1.0,
  posture_score: 100,
  calibrated: false,
  active_faults: [],
  probabilities: {
    upright: 1,
    leaning_forward: 0,
    leaning_backward: 0,
    leaning_left: 0,
    leaning_right: 0,
  },
  angles: {
    shoulder_roll_deg: 0,
    head_roll_deg: 0,
    neck_lateral_bend_deg: 0,
    neck_pitch_deg: 17.0,
    head_offset_x_pct: 0,
    neck_height_change_pct: 0,
    screen_proximity_change_pct: 0,
  },
  duration_bad_sec: 0,
  advice_vi: 'Tư thế ngồi chuẩn! Hãy duy trì và thả lỏng hai vai.',
  bugz_posture: 'good',
};

let cachedModelBundle: FrontPostureModelBundle | null = null;
let cachedVisionModule: any = null;
let cachedFilesetResolver: any = null;
let cachedLandmarker: PoseLandmarkerInstance | null = null;
let warmupPromise: Promise<{
  bundle: FrontPostureModelBundle;
  vision: any;
  filesetResolver: any;
}> | null = null;

export interface GlobalMonitorRuntime {
  videoEl: HTMLVideoElement | null;
  canvasEl: HTMLCanvasElement | null;
  parkingEl: HTMLDivElement | null;
  activeHostEl: HTMLDivElement | null;
  stream: MediaStream | null;
  activeStreams: Set<MediaStream>;
  cameraSessionSeq: number;
  isStartingCamera: boolean;
  monitoringActive: boolean;
  viewVisible: boolean;
  showSkeletonHud: boolean;
  aiReady: boolean;
  mirrorMode: boolean;
  selectedCameraId: string;
  isCalibrated: boolean;
  calibrating: boolean;
  calibStartMs: number;
  calibBuffer: InstantPostureFeatures[];
  calibratingCountdown: number | null;
  personDetected: boolean;
  output: ThreeTierPostureOutput;
  smoothedWorldPts: number[][] | null;
  targetImgPts: Array<{ x: number; y: number; visibility: number }> | null;
  smoothedImgPts: Array<{ x: number; y: number; visibility: number }> | null;
  smoothedProbs: Float64Array;
  personalBaseline: InstantPostureFeatures | null;
  autoBaseline: InstantPostureFeatures | null;
  badStartMs: number | null;
  goodRecoveryStartMs: number | null;
  badAccumulatedSec: number;
  lastFrameEvalMs: number;
  lastAiInferMs: number;
  lastCanvasDrawMs: number;
  lastVideoCurrentTime: number;
  avgInferMs: number;
  prevRawSeverity: number;
  peakRawSeverity: number;
  lastDetectTimestampMs: number;
  lastUiCommitMs: number;
  lastVoiceCueMs: number;
  lastSyncMs: number;
  webBootId: string;
  webSeq: number;
  rafId: number | null;
  bgIntervalId: number | null;
  deviceId: string;
  openSessionId: string | null;
  buildAuthHeaders: (() => Promise<Record<string, string>> | Record<string, string>) | null;
  onObservationSynced?: () => void;
  onSpeakReminder?: (text: string) => void;
  onLiveStatusChange?: (info: {
    monitoringActive: boolean;
    personDetected: boolean;
    output: ThreeTierPostureOutput;
  }) => void;
}

export const globalRt: GlobalMonitorRuntime = {
  videoEl: null,
  canvasEl: null,
  parkingEl: null,
  activeHostEl: null,
  stream: null,
  activeStreams: new Set<MediaStream>(),
  cameraSessionSeq: 0,
  isStartingCamera: false,
  monitoringActive: false,
  viewVisible: true,
  showSkeletonHud: true,
  aiReady: false,
  mirrorMode: true,
  selectedCameraId: 'user',
  isCalibrated: false,
  calibrating: false,
  calibStartMs: 0,
  calibBuffer: [],
  calibratingCountdown: null,
  personDetected: false,
  output: DEFAULT_POSTURE_OUTPUT,
  smoothedWorldPts: null,
  targetImgPts: null,
  smoothedImgPts: null,
  smoothedProbs: new Float64Array([1, 0, 0, 0, 0]),
  personalBaseline: null,
  autoBaseline: null,
  badStartMs: null,
  goodRecoveryStartMs: null,
  badAccumulatedSec: 0,
  lastFrameEvalMs: 0,
  lastAiInferMs: 0,
  lastCanvasDrawMs: 0,
  lastVideoCurrentTime: -1,
  avgInferMs: 14,
  prevRawSeverity: 0,
  peakRawSeverity: 0,
  lastDetectTimestampMs: 0,
  lastUiCommitMs: 0,
  lastVoiceCueMs: 0,
  lastSyncMs: 0,
  webBootId: `webcam-${Math.random().toString(36).slice(2, 8)}`,
  webSeq: 0,
  rafId: null,
  bgIntervalId: null,
  deviceId: 'robot01',
  openSessionId: null,
  buildAuthHeaders: null,
};

const uiListeners = new Set<() => void>();

export function subscribePostureMonitor(listener: () => void): () => void {
  uiListeners.add(listener);
  return () => {
    uiListeners.delete(listener);
  };
}

export function notifyUiListeners() {
  for (const fn of uiListeners) {
    fn();
  }
}

export function ensurePersistentVideoDom(): HTMLVideoElement {
  if (typeof document === 'undefined') {
    throw new Error('DOM not available');
  }
  if (!globalRt.parkingEl) {
    const park = document.createElement('div');
    park.id = 'bugz-persistent-camera-parking';
    // Đặt kích thước nhỏ với opacity 0.01 nằm trong viewport để trình duyệt Chrome/Edge
    // KHÔNG đóng băng (throttle/freeze) bộ giải mã khung hình video khi chạy nền ở trang khác!
    park.className =
      'pointer-events-none fixed bottom-0 right-0 h-2 w-2 overflow-hidden opacity-[0.01] z-0';
    document.body.appendChild(park);
    globalRt.parkingEl = park;
  }
  if (!globalRt.videoEl) {
    const vid = document.createElement('video');
    vid.playsInline = true;
    vid.muted = true;
    vid.autoplay = true;
    vid.width = 640;
    vid.height = 360;
    vid.className = 'h-full w-full object-contain -scale-x-100';
    globalRt.parkingEl.appendChild(vid);
    globalRt.videoEl = vid;
  }
  if (!globalRt.canvasEl) {
    const cvs = document.createElement('canvas');
    cvs.className = 'pointer-events-none absolute inset-0 z-[5] h-full w-full';
    globalRt.parkingEl.appendChild(cvs);
    globalRt.canvasEl = cvs;
  }
  return globalRt.videoEl;
}

export function clearHudCanvas() {
  const cvs = globalRt.canvasEl;
  if (!cvs) return;
  const ctx = cvs.getContext('2d');
  if (ctx) {
    ctx.clearRect(0, 0, cvs.width, cvs.height);
  }
}

export function syncVideoDomPlacement() {
  if (typeof document === 'undefined') return;
  const vid = ensurePersistentVideoDom();
  const cvs = globalRt.canvasEl!;
  vid.className = `h-full w-full object-contain ${globalRt.mirrorMode ? '-scale-x-100' : ''}`;
  cvs.className = `pointer-events-none absolute inset-0 z-[5] h-full w-full transition-opacity duration-300 ${
    globalRt.showSkeletonHud ? 'opacity-100' : 'opacity-0'
  }`;

  if (globalRt.monitoringActive && globalRt.viewVisible && globalRt.activeHostEl) {
    if (vid.parentElement !== globalRt.activeHostEl) {
      globalRt.activeHostEl.insertBefore(vid, globalRt.activeHostEl.firstChild);
    }
    if (cvs.parentElement !== globalRt.activeHostEl) {
      globalRt.activeHostEl.insertBefore(cvs, vid.nextSibling);
    }
  } else if (globalRt.parkingEl) {
    if (vid.parentElement !== globalRt.parkingEl) {
      globalRt.parkingEl.appendChild(vid);
    }
    if (cvs.parentElement !== globalRt.parkingEl) {
      globalRt.parkingEl.appendChild(cvs);
    }
  }

  // Luôn đảm bảo thẻ <video> tiếp tục phát ngay sau khi chuyển vị trí DOM giữa các trang
  const ensurePlaying = () => {
    if (globalRt.monitoringActive && vid.srcObject && vid.paused) {
      void vid.play().catch(() => {});
    }
  };
  ensurePlaying();
  window.setTimeout(ensurePlaying, 40);
  window.setTimeout(ensurePlaying, 150);
}

async function warmupAiAssets(): Promise<{
  bundle: FrontPostureModelBundle;
  vision: any;
  filesetResolver: any;
}> {
  if (cachedModelBundle && cachedVisionModule && cachedFilesetResolver) {
    return {
      bundle: cachedModelBundle,
      vision: cachedVisionModule,
      filesetResolver: cachedFilesetResolver,
    };
  }
  if (warmupPromise) return warmupPromise;

  warmupPromise = (async () => {
    const bundlePromise = cachedModelBundle
      ? Promise.resolve(cachedModelBundle)
      : fetch(MODEL_BUNDLE_URL).then(async (res) => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const data = (await res.json()) as FrontPostureModelBundle;
          cachedModelBundle = data;
          return data;
        });

    const visionPromise = (async () => {
      const nativeImport = new Function('u', 'return import(u)') as (u: string) => Promise<any>;
      if (!cachedVisionModule) {
        try {
          cachedVisionModule = await nativeImport(LOCAL_MP_VISION_MJS);
        } catch {
          cachedVisionModule = await nativeImport(CDN_MP_VISION);
        }
      }
      if (!cachedFilesetResolver) {
        try {
          cachedFilesetResolver = await cachedVisionModule.FilesetResolver.forVisionTasks(
            LOCAL_MP_WASM_DIR
          );
        } catch {
          cachedFilesetResolver = await cachedVisionModule.FilesetResolver.forVisionTasks(
            `${CDN_MP_VISION}/wasm`
          );
        }
      }
      return { vision: cachedVisionModule, filesetResolver: cachedFilesetResolver };
    })();

    const [bundle, { vision, filesetResolver }] = await Promise.all([
      bundlePromise,
      visionPromise,
    ]);
    return { bundle, vision, filesetResolver };
  })().catch((err) => {
    warmupPromise = null;
    throw err;
  });

  return warmupPromise;
}

export async function ensurePoseLandmarkerReady(): Promise<void> {
  if (cachedLandmarker && cachedModelBundle) {
    if (!globalRt.aiReady) {
      globalRt.aiReady = true;
      notifyUiListeners();
    }
    return;
  }
  try {
    const { vision, filesetResolver } = await warmupAiAssets();
    if (!cachedLandmarker) {
      try {
        cachedLandmarker = await vision.PoseLandmarker.createFromOptions(filesetResolver, {
          baseOptions: {
            modelAssetPath: LOCAL_POSE_TASK_URL,
            delegate: 'GPU',
          },
          runningMode: 'VIDEO',
          numPoses: 1,
          minPoseDetectionConfidence: 0.35,
          minPosePresenceConfidence: 0.35,
          minTrackingConfidence: 0.5,
        });
      } catch {
        cachedLandmarker = await vision.PoseLandmarker.createFromOptions(filesetResolver, {
          baseOptions: {
            modelAssetPath: CDN_POSE_TASK_URL,
            delegate: 'CPU',
          },
          runningMode: 'VIDEO',
          numPoses: 1,
          minPoseDetectionConfidence: 0.35,
          minPosePresenceConfidence: 0.35,
          minTrackingConfidence: 0.5,
        });
      }
    }
    globalRt.aiReady = true;
    notifyUiListeners();
  } catch {
    // Sẽ thử lại khi camera bật
  }
}

function medianBaselineFromSamples(
  samples: InstantPostureFeatures[]
): InstantPostureFeatures | null {
  if (!samples.length) return null;
  const keys = Object.keys(samples[0]) as Array<keyof InstantPostureFeatures>;
  const out = {} as InstantPostureFeatures;
  for (const k of keys) {
    const vals = samples.map((s) => s[k]).sort((a, b) => a - b);
    const mid = Math.floor(vals.length / 2);
    out[k] = vals.length % 2 !== 0 ? vals[mid] : 0.5 * (vals[mid - 1] + vals[mid]);
  }
  return out;
}

async function syncObservationFromGlobal(
  posture: 'good' | 'bad' | 'absent',
  confidence: number,
  postureCode?: string,
  forceImmediate = false
) {
  if (!globalRt.buildAuthHeaders) return;
  if (typeof navigator !== 'undefined' && !navigator.onLine) return;

  const nowMs = Date.now();
  if (!forceImmediate && nowMs - globalRt.lastSyncMs < 2500) return;
  globalRt.lastSyncMs = nowMs;

  const sessId = globalRt.openSessionId || 'webcam-auto-session';
  const nextSeq = globalRt.webSeq + 1;
  globalRt.webSeq = nextSeq;
  const devId = globalRt.deviceId || 'robot01';
  const eventId = `webcam-${devId}-${globalRt.webBootId}-${String(nextSeq).padStart(4, '0')}`;
  const normalizedConfidence =
    posture === 'good' || posture === 'bad'
      ? Math.max(0.88, Number(confidence.toFixed(3)))
      : Number(confidence.toFixed(3));

  try {
    const headers = await globalRt.buildAuthHeaders();
    const res = await fetch('/api/ingest/mqtt', {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        topic: `bugz/v1/devices/${devId}/observations`,
        client_id: devId,
        username: devId,
        payload: {
          schema_version: 1,
          event_id: eventId,
          device_id: devId,
          session_id: sessId,
          boot_id: globalRt.webBootId,
          sequence: nextSeq,
          type: 'posture.observed',
          observed_at: nowMs,
          posture,
          ...(posture === 'bad' && postureCode ? { posture_code: postureCode } : {}),
          confidence: normalizedConfidence,
          robot_moving: false,
          source: 'real',
        },
      }),
    });
    if (res.ok) {
      globalRt.onObservationSynced?.();
    }
  } catch {
    // Offline safe
  }
}

// ============================================================================
// AUTO-BASELINE (khi chưa bấm "Đặt chuẩn ngồi")
// - Pha 1 (Seed): lấy trung vị ~1.5s khung hình ngồi cân đối đầu tiên.
// - Pha 2 (Drift): chỉ trôi RẤT CHẬM (~11s hằng số thời gian) khi đang Xanh và độ lệch
//   so với chuẩn hiện tại còn nhỏ -> KHÔNG bao giờ "học" theo tư thế cúi đầu / rụt cổ.
// - Mọi giá trị bị kẹp quanh chuẩn mặc định của model để không nhận nhầm tư thế sai làm chuẩn.
// ============================================================================
const AUTO_SEED_FRAMES = 8;
const AUTO_DRIFT_ALPHA = 0.004;
let autoSeedBuffer: InstantPostureFeatures[] = [];
let deviationOnsetMs: number | null = null;

// Chuẩn công thái học chính diện cho Webcam (thay cho default_baseline trong file model vốn bị lệch góc máy)
const ERGONOMIC_FRONTAL_PRIOR: Partial<InstantPostureFeatures> = {
  shoulder_roll_deg: 0,
  ear_roll_deg: 0,
  eye_roll_deg: 0,
  neck_lateral_bend_deg: 0,
  nose_offset_x_norm: 0,
  ear_mid_offset_x_norm: 0,
  neck_height_nose_norm: 0.31,
  neck_height_ear_norm: 0.33,
  head_to_shoulder_width_ratio: 0.43,
  head_pitch_nose_ear: 0.42,
};

type AutoKey =
  | 'neck_height_nose_norm'
  | 'neck_height_ear_norm'
  | 'head_to_shoulder_width_ratio'
  | 'head_pitch_nose_ear';

function clampAutoField(key: AutoKey, value: number): number {
  const p = ERGONOMIC_FRONTAL_PRIOR[key] as number;
  if (!Number.isFinite(value)) return p;
  switch (key) {
    case 'neck_height_nose_norm':
    case 'neck_height_ear_norm':
      // Chấp nhận tỷ lệ cổ tự nhiên theo bề rộng vai (0.21 .. 0.52), nhưng không cho hạ quá thấp như khi rụt cổ sâu
      return Math.min(0.52, Math.max(0.21, value));
    case 'head_to_shoulder_width_ratio':
      // Chấp nhận từ người có bờ vai rộng (0.29) đến người vai nhỏ/ngồi gần vừa phải (0.50)
      return Math.min(0.50, Math.max(0.29, value));
    case 'head_pitch_nose_ear':
      // Chấp nhận góc đặt webcam laptop thấp hoặc cao ngang tầm mắt (-0.15 .. +0.62)
      return Math.min(0.62, Math.max(-0.15, value));
  }
}

function isBalancedFrame(f: InstantPostureFeatures): boolean {
  return (
    Math.abs(f.shoulder_roll_deg) < 4.8 &&
    Math.abs(f.ear_roll_deg) < 8.5 &&
    Math.abs(f.neck_lateral_bend_deg) < 7.5 &&
    Math.abs(f.nose_offset_x_norm) < 0.065 &&
    f.min_wrist_to_face_norm > 0.52
  );
}

function updateAutoBaseline(f: InstantPostureFeatures) {
  if (!isBalancedFrame(f)) return;
  const keys: AutoKey[] = [
    'neck_height_nose_norm',
    'neck_height_ear_norm',
    'head_to_shoulder_width_ratio',
    'head_pitch_nose_ear',
  ];

  if (!globalRt.autoBaseline) {
    autoSeedBuffer.push(f);
    if (autoSeedBuffer.length < AUTO_SEED_FRAMES) return;
    const seed = medianBaselineFromSamples(autoSeedBuffer);
    autoSeedBuffer = [];
    for (const k of keys) seed[k] = clampAutoField(k, seed[k]);
    seed.shoulder_roll_deg = 0;
    seed.ear_roll_deg = 0;
    seed.eye_roll_deg = 0;
    seed.neck_lateral_bend_deg = 0;
    seed.nose_offset_x_norm = 0;
    globalRt.autoBaseline = seed;
    return;
  }

  // Chỉ trôi chậm khi đang Xanh và đang gần chuẩn hiện tại
  if (globalRt.badStartMs !== null) return;
  const b = globalRt.autoBaseline;
  const dNoseH = (f.neck_height_nose_norm - b.neck_height_nose_norm) / Math.max(b.neck_height_nose_norm, 0.1);
  const dScale =
    (f.head_to_shoulder_width_ratio - b.head_to_shoulder_width_ratio) /
    Math.max(b.head_to_shoulder_width_ratio, 0.1);
  const dPitch = f.head_pitch_nose_ear - b.head_pitch_nose_ear;
  if (Math.abs(dNoseH) > 0.10 || Math.abs(dScale) > 0.09 || Math.abs(dPitch) > 0.15) return;

  for (const k of keys) {
    b[k] = clampAutoField(k, AUTO_DRIFT_ALPHA * f[k] + (1 - AUTO_DRIFT_ALPHA) * b[k]);
  }
}

export function resetAutoBaseline() {
  globalRt.autoBaseline = null;
  autoSeedBuffer = [];
}

function drawSkeletonIfVisible(tierOut: ThreeTierPostureOutput) {
  if (
    globalRt.viewVisible &&
    globalRt.activeHostEl &&
    globalRt.showSkeletonHud &&
    globalRt.smoothedImgPts
  ) {
    drawBiomechanicalHudCanvas(globalRt, globalRt.smoothedImgPts, tierOut);
  }
}

export function evaluateGlobalVideoFrame() {
  if (!globalRt.monitoringActive) return;
  const videoEl = globalRt.videoEl;
  if (!videoEl) return;
  if (videoEl.paused && videoEl.srcObject) {
    void videoEl.play().catch(() => {});
  }
  if (videoEl.readyState < 2) return;
  if (!cachedLandmarker || !cachedModelBundle) return;

  const nowMs = performance.now();

  // Frame Pacing KHÔNG làm giảm chất lượng nhận diện:
  // - Chạy AI trên MỌI khung hình mới của Camera (~30 FPS, giữ nguyên độ nhạy như bản gốc).
  // - Chỉ bỏ qua khi khung hình webcam chưa đổi (requestAnimationFrame 60Hz > Camera 30Hz),
  //   tức là cắt bỏ ~50% lượt suy luận TRÙNG LẶP vô ích mà không mất bất kỳ dữ liệu nào.
  // - Chỉ khi máy thực sự quá yếu (1 lượt AI > 45ms, tức không thể kịp 30 FPS) mới chừa khoảng
  //   nghỉ ngắn bằng đúng thời gian suy luận để trình duyệt không bị đơ.
  const curVideoTime = videoEl.currentTime;
  if (curVideoTime === globalRt.lastVideoCurrentTime) {
    return;
  }
  if (globalRt.avgInferMs > 45 && nowMs - globalRt.lastAiInferMs < globalRt.avgInferMs) {
    return;
  }

  globalRt.lastAiInferMs = nowMs;
  globalRt.lastVideoCurrentTime = curVideoTime;

  const tInferStart = performance.now();
  const detectTs = Math.max(Math.round(nowMs), globalRt.lastDetectTimestampMs + 1);
  globalRt.lastDetectTimestampMs = detectTs;

  let result: PoseLandmarkerResult;
  try {
    result = cachedLandmarker.detectForVideo(videoEl, detectTs);
  } catch {
    return;
  }

  if (!result.worldLandmarks || result.worldLandmarks.length === 0 || !result.landmarks?.[0]) {
    globalRt.badStartMs = null;
    globalRt.badAccumulatedSec = 0;
    globalRt.peakRawSeverity = 0;
    globalRt.prevRawSeverity = 0;
    clearHudCanvas();
    if (globalRt.personDetected || nowMs - globalRt.lastUiCommitMs >= 300) {
      globalRt.lastUiCommitMs = nowMs;
      globalRt.personDetected = false;
      notifyUiListeners();
    }
    void syncObservationFromGlobal('absent', 0.99);
    return;
  }

  const imgLms = result.landmarks[0];
  const worldLms = result.worldLandmarks[0];
  const shVis = Math.min(imgLms[11]?.visibility ?? 1.0, imgLms[12]?.visibility ?? 1.0);
  if (shVis < 0.22) {
    clearHudCanvas();
    if (globalRt.personDetected || nowMs - globalRt.lastUiCommitMs >= 300) {
      globalRt.lastUiCommitMs = nowMs;
      globalRt.personDetected = false;
      notifyUiListeners();
    }
    return;
  }

  // Làm mượt toạ độ 2D khung xương tại chỗ (giữ nguyên hệ số 0.44 như bản gốc, không cấp phát mảng mới)
  if (!globalRt.smoothedImgPts || globalRt.smoothedImgPts.length !== imgLms.length) {
    globalRt.smoothedImgPts = imgLms.map((lm) => ({
      x: lm.x,
      y: lm.y,
      visibility: lm.visibility ?? 1.0,
    }));
  } else {
    const imgAlpha = 0.44;
    for (let i = 0; i < imgLms.length; i++) {
      const sp = globalRt.smoothedImgPts[i];
      sp.x = imgAlpha * imgLms[i].x + (1.0 - imgAlpha) * sp.x;
      sp.y = imgAlpha * imgLms[i].y + (1.0 - imgAlpha) * sp.y;
      sp.visibility = imgLms[i].visibility ?? 1.0;
    }
  }

  const rawPts = worldLms.map((lm) => [lm.x, lm.y, lm.z]);
  const hasPersonalCalib = Boolean(globalRt.personalBaseline);

  // Làm mượt EMA tại chỗ (hệ số gốc 0.35)
  if (!globalRt.smoothedWorldPts) {
    globalRt.smoothedWorldPts = rawPts;
  } else {
    const alpha = 0.35;
    const invAlpha = 1.0 - alpha;
    for (let i = 0; i < 33; i++) {
      const pt = globalRt.smoothedWorldPts[i];
      const w = rawPts[i];
      pt[0] = alpha * w[0] + invAlpha * pt[0];
      pt[1] = alpha * w[1] + invAlpha * pt[1];
      pt[2] = alpha * w[2] + invAlpha * pt[2];
    }
  }

  const instFeatures = extractInstantFeatures(globalRt.smoothedWorldPts);

  // BlazePose vẫn trả toạ độ cho khớp đã ra ngoài khung hình. Không được dùng các
  // toạ độ "đoán" đó để kết luận chống cằm hoặc ngả thân, vì đây là nguồn báo giả
  // phổ biến nhất khi webcam chỉ quay đầu–vai như giao diện hiện tại.
  const leftWristVisible = imgLms[15]?.visibility ?? 0;
  const rightWristVisible = imgLms[16]?.visibility ?? 0;
  if (leftWristVisible < 0.55) instFeatures.left_wrist_to_head_norm = Number.POSITIVE_INFINITY;
  if (rightWristVisible < 0.55) instFeatures.right_wrist_to_head_norm = Number.POSITIVE_INFINITY;
  instFeatures.min_wrist_to_face_norm = Math.min(
    instFeatures.left_wrist_to_head_norm,
    instFeatures.right_wrist_to_head_norm
  );

  const hipsVisible = Math.min(
    imgLms[23]?.visibility ?? 0,
    imgLms[24]?.visibility ?? 0
  );
  if (hipsVisible < 0.42) {
    instFeatures.torso_sagittal_pitch_deg = 10.0;
    instFeatures.torso_coronal_lean_norm = 0.0;
    instFeatures.shoulder_depth_z_norm = 0.0;
  }

  // Tự động thích nghi tỷ lệ cơ thể tự nhiên (bờ vai rộng / khoảng cách ngồi) khi người dùng đang ngồi thẳng
  // giúp không bị báo lệch giả ngay cả khi chưa bấm nút "Đặt chuẩn ngồi"
  if (!hasPersonalCalib) {
    updateAutoBaseline(instFeatures);
  }

  const activeBaseline =
    globalRt.personalBaseline ||
    globalRt.autoBaseline ||
    ERGONOMIC_FRONTAL_PRIOR;

  if (globalRt.calibrating) {
    globalRt.calibBuffer.push(instFeatures);
    const elapsedSec = (nowMs - globalRt.calibStartMs) / 1000.0;
    const remainSec = Math.max(0.0, 3.0 - elapsedSec);
    globalRt.calibratingCountdown = Number(remainSec.toFixed(1));
    if (elapsedSec >= 3.0) {
      globalRt.calibrating = false;
      globalRt.calibratingCountdown = null;
      globalRt.personalBaseline = medianBaselineFromSamples(globalRt.calibBuffer);
      globalRt.calibBuffer = [];
      globalRt.isCalibrated = true;
    }
    notifyUiListeners();
  }

  const deltaFeatures = computeDeltaFeatures(instFeatures, activeBaseline);
  const fullFeatures = { ...instFeatures, ...deltaFeatures };

  const headName = hasPersonalCalib ? 'full_calibrated' : 'upper_instant';
  let rawProbs = predictHeadProbabilities(fullFeatures, cachedModelBundle, headName);
  rawProbs = refineWithBiomechanicalCalibration(rawProbs, fullFeatures, hasPersonalCalib);

  const probAlpha = 0.28;
  let s = 0.0;
  for (let i = 0; i < CLASS_NAMES.length; i++) {
    globalRt.smoothedProbs[i] =
      probAlpha * rawProbs[i] + (1.0 - probAlpha) * globalRt.smoothedProbs[i];
    s += globalRt.smoothedProbs[i];
  }
  for (let i = 0; i < CLASS_NAMES.length; i++) {
    globalRt.smoothedProbs[i] /= s || 1.0;
  }

  let bestIdx = 0;
  for (let i = 1; i < globalRt.smoothedProbs.length; i++) {
    if (globalRt.smoothedProbs[i] > globalRt.smoothedProbs[bestIdx]) bestIdx = i;
  }
  const predClass = CLASS_NAMES[bestIdx];

  const deltaShRoll = hasPersonalCalib
    ? fullFeatures.delta_shoulder_roll_deg
    : fullFeatures.shoulder_roll_deg;
  const deltaNoseH = fullFeatures.delta_neck_height_nose;
  const deltaScale = fullFeatures.delta_head_to_shoulder_ratio;
  const deltaPitch = fullFeatures.delta_head_pitch_nose_ear;
  const recoveryDeltaShoulderLimit = hasPersonalCalib
    ? FRONTAL_ANGLE_LIMITS.recovery.shoulderDelta
    : FRONTAL_ANGLE_LIMITS.recovery.shoulder;
  const warningDeltaShoulderLimit = hasPersonalCalib
    ? FRONTAL_ANGLE_LIMITS.warning.shoulderDelta
    : FRONTAL_ANGLE_LIMITS.warning.shoulder;

  // Hysteresis (Schmitt Trigger) để chống nhấp nháy ở vùng biên:
  const alreadyInDeviation = globalRt.badStartMs !== null;
  const isBackwardNow = hasGeometryForPostureClass(
    'leaning_backward',
    fullFeatures,
    hasPersonalCalib,
    alreadyInDeviation
  );
  const mlDeviation = hasGeometryForPostureClass(
    predClass,
    fullFeatures,
    hasPersonalCalib,
    alreadyInDeviation
  );

  let isDeviatedNow = alreadyInDeviation
    ? mlDeviation ||
      isBackwardNow ||
      Math.abs(fullFeatures.shoulder_roll_deg) >= FRONTAL_ANGLE_LIMITS.recovery.shoulder ||
      Math.abs(deltaShRoll) >= recoveryDeltaShoulderLimit ||
      Math.abs(fullFeatures.ear_roll_deg) >= FRONTAL_ANGLE_LIMITS.recovery.head ||
      Math.abs(fullFeatures.neck_lateral_bend_deg) >= FRONTAL_ANGLE_LIMITS.recovery.neck ||
      deltaNoseH <= -0.19 ||
      deltaScale >= 0.16 ||
      (deltaPitch >= 0.30 && deltaNoseH <= -0.10) ||
      fullFeatures.min_wrist_to_face_norm <= 0.44
    : mlDeviation ||
      isBackwardNow ||
      Math.abs(fullFeatures.shoulder_roll_deg) >= FRONTAL_ANGLE_LIMITS.warning.shoulder ||
      Math.abs(deltaShRoll) >= warningDeltaShoulderLimit ||
      Math.abs(fullFeatures.ear_roll_deg) >= FRONTAL_ANGLE_LIMITS.warning.head ||
      Math.abs(fullFeatures.neck_lateral_bend_deg) >= FRONTAL_ANGLE_LIMITS.warning.neck ||
      deltaNoseH <= -0.25 ||
      deltaScale >= 0.21 ||
      (deltaPitch >= 0.38 && deltaNoseH <= -0.12) ||
      fullFeatures.min_wrist_to_face_norm <= 0.38;

  // Ưu tiên hình học đầu–vai–cổ nhìn thấy trực tiếp. Điều này xử lý trường hợp HUD
  // chỉ 3–7° nhưng một giá trị Z ẩn dao động làm trạng thái bị kẹt Vàng/Đỏ.
  if (isNaturalFrontalSafeZone(fullFeatures, hasPersonalCalib)) {
    isDeviatedNow = false;
  }

  let durationBadSec = 0.0;
  if (isDeviatedNow) {
    globalRt.goodRecoveryStartMs = null;
    if (globalRt.badStartMs === null) {
      // Lọc nhiễu ngắn (tay lướt qua mặt, landmark giật): lệch phải kéo dài >= 600ms
      // mới bật Vàng. Mốc đếm 10s vẫn tính từ khung hình lệch đầu tiên nên không bị trễ thêm.
      if (deviationOnsetMs === null) deviationOnsetMs = nowMs;
      if (nowMs - deviationOnsetMs >= 600) {
        globalRt.badStartMs = deviationOnsetMs;
        deviationOnsetMs = null;
      }
    }
    if (globalRt.badStartMs !== null) {
      durationBadSec = (nowMs - globalRt.badStartMs) / 1000.0;
    }
  } else if (globalRt.badStartMs !== null) {
    deviationOnsetMs = null;
    if (globalRt.goodRecoveryStartMs === null) {
      globalRt.goodRecoveryStartMs = nowMs;
    }
    // Khi hình học đã trở lại vùng an toàn, trả về Xanh nhanh. 350ms vẫn đủ lọc
    // một khung landmark chập chờn nhưng không tạo cảm giác bị "kẹt Vàng" vài giây.
    if (nowMs - globalRt.goodRecoveryStartMs >= 350) {
      globalRt.badStartMs = null;
      globalRt.goodRecoveryStartMs = null;
      durationBadSec = 0.0;
    } else {
      durationBadSec = (globalRt.goodRecoveryStartMs - globalRt.badStartMs) / 1000.0;
    }
  } else {
    deviationOnsetMs = null;
  }

  const tierOut = buildThreeTierOutput(
    globalRt.smoothedProbs,
    fullFeatures,
    durationBadSec,
    hasPersonalCalib,
    globalRt.badStartMs !== null
  );

  // Đo thời gian thực thi AI thực tế (chỉ dùng để chống đơ trên máy cực yếu)
  const inferElapsedMs = performance.now() - tInferStart;
  globalRt.avgInferMs = 0.25 * inferElapsedMs + 0.75 * globalRt.avgInferMs;

  // Vẽ khung xương sinh cơ học ngay trên khung hình vừa suy luận (đồng bộ 100% với video)
  drawSkeletonIfVisible(tierOut);

  const prevOut = globalRt.output;
  const statusChanged =
    !globalRt.personDetected ||
    prevOut.status !== tierOut.status ||
    prevOut.primary_class !== tierOut.primary_class;
  const bugzPostureTransitioned = prevOut.bugz_posture !== tierOut.bugz_posture;

  void syncObservationFromGlobal(
    tierOut.bugz_posture,
    tierOut.confidence,
    tierOut.bugz_posture_code,
    bugzPostureTransitioned
  );

  // Phát giọng nói nhắc nhở ngay khi đã chuyển sang Đỏ (BAD >= 10.0s)
  if (
    tierOut.status === 'BAD' &&
    durationBadSec >= 10.0 &&
    (prevOut.status !== 'BAD' || nowMs - globalRt.lastVoiceCueMs > 22000)
  ) {
    globalRt.lastVoiceCueMs = nowMs;
    if (globalRt.onSpeakReminder) {
      globalRt.onSpeakReminder(tierOut.advice_vi);
    } else {
      void speakVietnameseNeuralVoice({
        text: tierOut.advice_vi,
        presetId: getSavedVoicePreset(),
        playChime: true,
        isAutoTrigger: true,
      });
    }
  }

  globalRt.personDetected = true;
  globalRt.output = tierOut;

  if (statusChanged || nowMs - globalRt.lastUiCommitMs >= 150) {
    globalRt.lastUiCommitMs = nowMs;
    globalRt.onLiveStatusChange?.({
      monitoringActive: true,
      personDetected: true,
      output: tierOut,
    });
    notifyUiListeners();
  }
}

export function startGlobalLoops() {
  if (globalRt.rafId !== null) cancelAnimationFrame(globalRt.rafId);
  if (globalRt.bgIntervalId !== null) window.clearInterval(globalRt.bgIntervalId);

  const isDirectlyVisibleOnScreen = () =>
    globalRt.monitoringActive &&
    globalRt.viewVisible &&
    Boolean(globalRt.activeHostEl) &&
    document.visibilityState === 'visible';

  const rafLoop = () => {
    if (!globalRt.monitoringActive) return;
    if (isDirectlyVisibleOnScreen()) {
      evaluateGlobalVideoFrame();
    }
    globalRt.rafId = requestAnimationFrame(rafLoop);
  };
  globalRt.rafId = requestAnimationFrame(rafLoop);

  // Khi chuyển sang mục khác (/learn, /games...), ẩn khung hình hoặc ẩn tab,
  // bộ nhịp 120ms (~8.5 FPS) tiếp tục đọc Camera và giám sát tư thế ngầm cực nhạy (như bản gốc)
  globalRt.bgIntervalId = window.setInterval(() => {
    if (!globalRt.monitoringActive) return;
    if (!isDirectlyVisibleOnScreen()) {
      evaluateGlobalVideoFrame();
    }
  }, 120);
}

export function stopMediaStreamTracks(stream: MediaStream | null | undefined) {
  if (!stream) return;
  try {
    stream.getTracks().forEach((track) => {
      try {
        track.enabled = false;
        track.stop();
      } catch {
        // ignore
      }
    });
  } catch {
    // ignore
  }
}

export function stopGlobalHardwareCamera() {
  // Hủy ngay lập tức mọi tiến trình getUserMedia / vid.play() đang chờ xử lý
  globalRt.cameraSessionSeq += 1;
  globalRt.isStartingCamera = false;
  globalRt.monitoringActive = false;
  globalRt.personDetected = false;
  globalRt.calibrating = false;
  globalRt.calibratingCountdown = null;
  resetAutoBaseline();
  globalRt.badStartMs = null;
  globalRt.goodRecoveryStartMs = null;

  if (globalRt.rafId !== null) {
    cancelAnimationFrame(globalRt.rafId);
    globalRt.rafId = null;
  }
  if (globalRt.bgIntervalId !== null) {
    window.clearInterval(globalRt.bgIntervalId);
    globalRt.bgIntervalId = null;
  }

  // Dừng tất cả MediaStream từng được mở (kể cả khi bấm đúp hoặc chuyển đổi camera nhanh)
  globalRt.activeStreams.forEach((s) => stopMediaStreamTracks(s));
  globalRt.activeStreams.clear();

  if (globalRt.stream) {
    stopMediaStreamTracks(globalRt.stream);
    globalRt.stream = null;
  }

  if (globalRt.videoEl) {
    const attachedStream = globalRt.videoEl.srcObject as MediaStream | null;
    stopMediaStreamTracks(attachedStream);
    try {
      globalRt.videoEl.pause();
      globalRt.videoEl.srcObject = null;
      globalRt.videoEl.removeAttribute('src');
      globalRt.videoEl.load();
    } catch {
      // ignore
    }
  }

  // Quét an toàn toàn bộ thẻ <video> trong DOM để đảm bảo không còn luồng webcam nào giữ đèn phần cứng
  if (typeof document !== 'undefined') {
    document.querySelectorAll('video').forEach((v) => {
      const s = v.srcObject as MediaStream | null;
      if (s) {
        stopMediaStreamTracks(s);
        try {
          v.pause();
          v.srcObject = null;
          v.removeAttribute('src');
          v.load();
        } catch {
          // ignore
        }
      }
    });
  }

  clearHudCanvas();
  syncVideoDomPlacement();
  globalRt.onLiveStatusChange?.({
    monitoringActive: false,
    personDetected: false,
    output: globalRt.output,
  });
  notifyUiListeners();
}

export function toggleSkeletonHud() {
  globalRt.showSkeletonHud = !globalRt.showSkeletonHud;
  if (!globalRt.showSkeletonHud) {
    clearHudCanvas();
  }
  syncVideoDomPlacement();
  notifyUiListeners();
}

export function toggleMirrorMode() {
  globalRt.mirrorMode = !globalRt.mirrorMode;
  syncVideoDomPlacement();
  notifyUiListeners();
}

export function startCalibrationCountdown() {
  if (!globalRt.monitoringActive) return;
  globalRt.calibrating = true;
  globalRt.calibStartMs = performance.now();
  globalRt.calibBuffer = [];
  globalRt.calibratingCountdown = 3.0;
  notifyUiListeners();
}

// Chỉ tắt hẳn phần cứng Camera khi người dùng đóng tab hoặc đóng trình duyệt Chrome
if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', stopGlobalHardwareCamera);
  window.addEventListener('beforeunload', stopGlobalHardwareCamera);
}
