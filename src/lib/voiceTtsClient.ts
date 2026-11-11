/**
 * BUGZ BrightUpGenZ — Neural Voice TTS Client (Chặng P04 / T23)
 *
 * Thay thế hoàn toàn `window.speechSynthesis` (giọng đọc máy tính mặc định rất thô/tệ)
 * bằng mô hình giọng nói AI Neural phía Server (`/api/tts/synthesize`):
 * - Ưu tiên 1: `gemini-3.8-flash-lite-tts` (`@google/genai` SDK phía Server) với các giọng
 *   biểu cảm `Kore` (Nữ ấm áp), `Zephyr` (Nữ tươi sáng), `Puck` (Nam thân thiện).
 * - Ưu tiên 2: `google-neural-vi` (Giọng Nữ Tiếng Việt Neural chuẩn tự nhiên, độ trễ cực thấp).
 * - Toàn bộ file âm thanh sinh ra được cache tại `/tmp/bugz-tts-cache` trên Server (ngoài Git repo).
 */

export type BugzVoicePresetId =
  | 'gemini-kore'
  | 'gemini-zephyr'
  | 'gemini-puck'
  | 'google-neural-vi';

export interface BugzVoicePresetOption {
  id: BugzVoicePresetId;
  label: string;
  modelName: string;
  voiceName: string;
  description: string;
}

export const BUGZ_VOICE_PRESETS: BugzVoicePresetOption[] = [
  {
    id: 'gemini-kore',
    label: 'Gemini 3.8 TTS · Kore (Nữ ấm áp, dịu dàng)',
    modelName: 'gemini-3.8-flash-lite-tts',
    voiceName: 'Kore',
    description: 'Giọng AI biểu cảm, nhẹ nhàng, khích lệ học sinh tự giác chỉnh tư thế.',
  },
  {
    id: 'gemini-zephyr',
    label: 'Gemini 3.8 TTS · Zephyr (Nữ tươi sáng, trong trẻo)',
    modelName: 'gemini-3.8-flash-lite-tts',
    voiceName: 'Zephyr',
    description: 'Giọng đọc trong sáng, nhịp điệu vui tươi phù hợp lứa tuổi học sinh.',
  },
  {
    id: 'gemini-puck',
    label: 'Gemini 3.8 TTS · Puck (Nam vui vẻ, năng động)',
    modelName: 'gemini-3.8-flash-lite-tts',
    voiceName: 'Puck',
    description: 'Giọng nam thân thiện như người bạn đồng hành nhắc nhở nhẹ nhàng.',
  },
  {
    id: 'google-neural-vi',
    label: 'Tiếng Việt Neural Chuẩn (Phản hồi tức thì)',
    modelName: 'google-neural-vi',
    voiceName: 'vi-VN-Neural',
    description: 'Giọng nữ tiếng Việt chuẩn phát âm rõ dấu, tốc độ tải cực nhanh.',
  },
];

const VOICE_PRESET_STORAGE_KEY = 'bugz_preferred_voice_preset_v1';

export function getSavedVoicePreset(): BugzVoicePresetId {
  if (typeof window === 'undefined') return 'gemini-kore';
  try {
    const saved = window.localStorage.getItem(VOICE_PRESET_STORAGE_KEY) as BugzVoicePresetId | null;
    if (saved && BUGZ_VOICE_PRESETS.some((p) => p.id === saved)) {
      return saved;
    }
  } catch {
    // Ignore storage errors
  }
  return 'gemini-kore';
}

export function setSavedVoicePreset(presetId: BugzVoicePresetId): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(VOICE_PRESET_STORAGE_KEY, presetId);
  } catch {
    // Ignore storage errors
  }
}

let activeAudioElement: HTMLAudioElement | null = null;
let activeObjectUrl: string | null = null;
let activeFetchController: AbortController | null = null;
let currentSpeechRequestId = 0;
let lastAutoSpeechAtMs = 0;

export function stopActiveNeuralVoice(): void {
  currentSpeechRequestId += 1;

  if (activeFetchController) {
    try {
      activeFetchController.abort();
    } catch {
      // Ignore abort errors
    }
    activeFetchController = null;
  }

  if (activeAudioElement) {
    try {
      activeAudioElement.pause();
      activeAudioElement.currentTime = 0;
      activeAudioElement.src = '';
    } catch {
      // Ignore pause errors
    }
    activeAudioElement = null;
  }

  if (activeObjectUrl) {
    try {
      URL.revokeObjectURL(activeObjectUrl);
    } catch {
      // Ignore revoke errors
    }
    activeObjectUrl = null;
  }

  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    try {
      window.speechSynthesis.cancel();
    } catch {
      // Ignore
    }
  }
}

export function playSoftNotificationChime(): void {
  if (typeof window === 'undefined') return;
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5 êm dịu
    gain.gain.setValueAtTime(0.04, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.3);
  } catch {
    // Ignore AudioContext errors
  }
}

export interface SpeakNeuralResult {
  ok: boolean;
  engineUsed: string;
  voiceUsed: string;
  cached: boolean;
  error?: string;
}

/**
 * Gọi endpoint `/api/tts/synthesize` phía Server để tổng hợp và phát giọng nói Neural tự nhiên.
 * Đảm bảo cơ chế Single-Flight (tối đa 1 giọng đọc phát tại 1 thời điểm, không bao giờ có 2 giọng đè nhau).
 */
export async function speakVietnameseNeuralVoice(params: {
  text: string;
  presetId?: BugzVoicePresetId;
  playChime?: boolean;
  isAutoTrigger?: boolean;
}): Promise<SpeakNeuralResult> {
  const cleanText = params.text.trim();
  if (!cleanText || typeof window === 'undefined') {
    return { ok: false, engineUsed: 'none', voiceUsed: 'none', cached: false };
  }

  const presetId = params.presetId || getSavedVoicePreset();
  const now = Date.now();

  // Nếu là tự động phát khi có cảnh báo mới mà chưa qua 2.5 giây từ lần tự động phát trước
  // (hoặc đang phát dở âm thanh), bỏ qua lời gọi tự động thứ 2 để không đè hoặc ngắt câu đang đọc.
  if (params.isAutoTrigger) {
    if (now - lastAutoSpeechAtMs < 2500 || activeAudioElement || activeFetchController) {
      return {
        ok: true,
        engineUsed: 'deduped-single-flight',
        voiceUsed: presetId,
        cached: true,
      };
    }
    lastAutoSpeechAtMs = now;
  }

  // Hủy ngay lập tức mọi request TTS đang chờ hoặc audio đang phát trước đó
  stopActiveNeuralVoice();
  const myRequestId = currentSpeechRequestId;
  const controller = new AbortController();
  activeFetchController = controller;

  if (params.playChime !== false) {
    playSoftNotificationChime();
  }

  try {
    const response = await fetch('/api/tts/synthesize', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: cleanText,
        presetId,
      }),
      signal: controller.signal,
    });

    if (myRequestId !== currentSpeechRequestId) {
      return {
        ok: false,
        engineUsed: 'cancelled',
        voiceUsed: presetId,
        cached: false,
      };
    }

    if (!response.ok) {
      throw new Error(`TTS HTTP ${response.status}`);
    }

    const engineUsed = response.headers.get('x-bugz-tts-engine') || 'gemini-3.8-flash-lite-tts';
    const voiceUsed = response.headers.get('x-bugz-tts-voice') || presetId;
    const cached = response.headers.get('x-bugz-tts-cache') === 'HIT';
    const contentType = response.headers.get('content-type') || 'audio/wav';

    const audioBlob = await response.blob();
    if (myRequestId !== currentSpeechRequestId) {
      return {
        ok: false,
        engineUsed: 'cancelled',
        voiceUsed: presetId,
        cached: false,
      };
    }

    if (activeFetchController === controller) {
      activeFetchController = null;
    }

    const typedBlob = new Blob([audioBlob], { type: contentType });
    const objectUrl = URL.createObjectURL(typedBlob);
    activeObjectUrl = objectUrl;

    const audio = new Audio(objectUrl);
    activeAudioElement = audio;

    audio.onended = () => {
      if (activeObjectUrl === objectUrl) {
        URL.revokeObjectURL(objectUrl);
        activeObjectUrl = null;
      }
      if (activeAudioElement === audio) {
        activeAudioElement = null;
      }
    };

    await audio.play();

    return {
      ok: true,
      engineUsed,
      voiceUsed,
      cached,
    };
  } catch (err) {
    if (activeFetchController === controller) {
      activeFetchController = null;
    }
    if (myRequestId !== currentSpeechRequestId) {
      return {
        ok: false,
        engineUsed: 'cancelled',
        voiceUsed: presetId,
        cached: false,
      };
    }
    return {
      ok: false,
      engineUsed: 'error',
      voiceUsed: presetId,
      cached: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
