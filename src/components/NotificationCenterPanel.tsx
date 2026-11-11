import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Bell,
  CheckCircle2,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Smartphone,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  detectPushPlatformCapability,
  getOrCreateClientInstallationId,
  obtainFcmWebPushTokenModular,
  subscribeForegroundFcmMessages,
} from '../lib/firebaseClient';
import {
  createInitialAlertDeduplicatorState,
  ingestAlertIntoClientDeduplicator,
  type ClientAlertDeduplicatorState,
  type NotificationJobRecord,
  type PushTokenRecord,
  type UserNotificationPreferences,
} from '../domain/p04NotificationEngine';
import {
  BUGZ_VOICE_PRESETS,
  getSavedVoicePreset,
  setSavedVoicePreset,
  speakVietnameseNeuralVoice,
  type BugzVoicePresetId,
} from '../lib/voiceTtsClient';

interface RoutedAlertItem {
  alert_id: string;
  student_id: string;
  student_display_name: string;
  device_id: string;
  device_name: string;
  session_id: string;
  message: string;
  created_at: number;
  severity: 'low' | 'medium' | 'high';
  source: 'real' | 'simulator';
  image_id?: string;
  capture_status?: string;
  is_read_by_guardian: boolean;
  is_read_by_me: boolean;
}

export const NotificationCenterPanel: React.FC<{
  compact?: boolean;
  showTechnicalTools?: boolean;
}> = ({ compact = false, showTechnicalTools = false }) => {
  const { uid, authenticatedFetch } = useAuth();

  const [loading, setLoading] = useState<boolean>(true);
  const [fcmProviderConfigured, setFcmProviderConfigured] = useState<boolean>(false);
  const [emailProviderConfigured, setEmailProviderConfigured] = useState<boolean>(false);
  const [fcmMissingVars, setFcmMissingVars] = useState<string[]>([]);
  const [emailMissingVars, setEmailMissingVars] = useState<string[]>([]);

  const [prefs, setPrefs] = useState<UserNotificationPreferences>({
    push_enabled: true,
    voice_enabled: true,
    email_enabled: true,
    mode: 'every_alert',
    quiet_hours_start: '22:00',
    quiet_hours_end: '06:30',
  });
  const [pushTokens, setPushTokens] = useState<PushTokenRecord[]>([]);
  const [jobs, setJobs] = useState<NotificationJobRecord[]>([]);

  const [dedupState, setDedupState] = useState<ClientAlertDeduplicatorState>(() =>
    createInitialAlertDeduplicatorState()
  );
  const dedupStateRef = useRef<ClientAlertDeduplicatorState>(dedupState);
  dedupStateRef.current = dedupState;

  const [audioUnlockedByGesture, setAudioUnlockedByGesture] = useState<boolean>(false);
  const [voicePreset, setVoicePreset] = useState<BugzVoicePresetId>(() => getSavedVoicePreset());
  const [voiceSpeaking, setVoiceSpeaking] = useState<boolean>(false);
  const [lastSpokenMessage, setLastSpokenMessage] = useState<string>(
    'Hươu cao cổ gửi tín hiệu: đầu mình hơi chúi về trước rồi, nâng nhẹ đầu lên nhé!'
  );
  const [voiceStatusLog, setVoiceStatusLog] = useState<string>(
    'Sẵn sàng phát lời nhắc bằng giọng đọc AI tiếng Việt tự nhiên.'
  );
  const [dedupProofLog, setDedupProofLog] = useState<string | null>(null);
  const [actionBanner, setActionBanner] = useState<{
    ok: boolean;
    text: string;
  } | null>(null);

  const pushCap = detectPushPlatformCapability();
  const installationId = getOrCreateClientInstallationId();

  const playGentleVoiceAudio = useCallback(
    async (textToSpeak: string, isManualReplay = false, overridePreset?: BugzVoicePresetId) => {
      const targetPreset = overridePreset || voicePreset;
      setLastSpokenMessage(textToSpeak);
      setAudioUnlockedByGesture(true);
      setVoiceSpeaking(true);
      setVoiceStatusLog('Đang chuẩn bị giọng đọc nhắc nhở...');

      const res = await speakVietnameseNeuralVoice({
        text: textToSpeak,
        presetId: targetPreset,
        playChime: true,
        isAutoTrigger: !isManualReplay,
      });
      setVoiceSpeaking(false);

      if (res.engineUsed === 'cancelled' || res.engineUsed === 'deduped-single-flight') {
        return;
      }

      if (res.ok) {
        setVoiceStatusLog(
          `Đã phát lời nhắc lúc ${new Date().toLocaleTimeString('vi-VN')}: “${textToSpeak}”`
        );
      } else {
        setVoiceStatusLog(
          'Hãy bấm nút "Nghe thử giọng đọc" hoặc "Nghe lại" để bật âm thanh trên trình duyệt.'
        );
      }
    },
    [voicePreset]
  );

  const handleIncomingAlertEvent = useCallback(
    (
      alertItem: {
        alert_id: string;
        student_id: string;
        student_display_name?: string;
        device_id: string;
        device_name?: string;
        session_id: string;
        message: string;
        created_at: number;
        severity?: 'low' | 'medium' | 'high';
        is_read_by_guardian?: boolean;
        is_read_by_me?: boolean;
      },
      arrivalSource: 'rtdb_listener' | 'fcm_foreground' | 'fcm_service_worker',
      silentBootstrap = false
    ) => {
      const pageVisible =
        typeof document !== 'undefined' ? document.visibilityState === 'visible' : true;

      const res = ingestAlertIntoClientDeduplicator({
        state: dedupStateRef.current,
        incoming: {
          ...alertItem,
          arrival_source: arrivalSource,
        },
        voiceContext: {
          pageVisible: silentBootstrap ? false : pageVisible,
          voiceEnabled: prefs.voice_enabled,
          audioPermittedByBrowser: audioUnlockedByGesture,
          nowMs: Date.now(),
          cooldownMs: 15_000,
        },
      });

      dedupStateRef.current = res.nextState;
      setDedupState(res.nextState);

      if (!silentBootstrap) {
        if (res.shouldAutoSpeakVoice) {
          void playGentleVoiceAudio(alertItem.message, false);
        } else if (res.wasDeduplicated && showTechnicalTools) {
          setDedupProofLog(
            `Đã hợp nhất bản ghi cảnh báo trùng "${alertItem.alert_id}" (${res.nextState.byAlertId[
              alertItem.alert_id
            ]?.sources_seen.join(' + ')}).`
          );
        }
      }
    },
    [audioUnlockedByGesture, playGentleVoiceAudio, prefs.voice_enabled, showTechnicalTools]
  );

  const loadNotificationCenter = useCallback(async () => {
    try {
      setLoading(true);
      const res = await authenticatedFetch('/api/notifications/center');
      if (!res.ok) return;
      const data = await res.json();

      setFcmProviderConfigured(Boolean(data.fcmProviderConfigured));
      setEmailProviderConfigured(Boolean(data.emailProviderConfigured));
      setFcmMissingVars(Array.isArray(data.fcmMissingVars) ? data.fcmMissingVars : []);
      setEmailMissingVars(Array.isArray(data.emailMissingVars) ? data.emailMissingVars : []);

      if (data.preferences) {
        setPrefs(data.preferences);
      }
      if (Array.isArray(data.pushTokens)) {
        setPushTokens(data.pushTokens);
      }
      if (Array.isArray(data.jobs)) {
        setJobs(data.jobs);
      }

      const routed: RoutedAlertItem[] = Array.isArray(data.routedAlerts) ? data.routedAlerts : [];
      for (const item of routed) {
        handleIncomingAlertEvent(item, 'rtdb_listener', true);
      }
      if (routed[0]?.message) {
        setLastSpokenMessage(routed[0].message);
      }
    } catch {
      // Ignore transient network errors
    } finally {
      setLoading(false);
    }
  }, [authenticatedFetch, handleIncomingAlertEvent]);

  useEffect(() => {
    dedupStateRef.current = createInitialAlertDeduplicatorState();
    setDedupState(createInitialAlertDeduplicatorState());
    void loadNotificationCenter();
  }, [uid, loadNotificationCenter]);

  useEffect(() => {
    let unsubFcm: (() => void) | null = null;
    void subscribeForegroundFcmMessages((payload) => {
      const d = payload.data || {};
      const alertId = String(d.alert_id || 'alert-a-001');
      handleIncomingAlertEvent(
        {
          alert_id: alertId,
          student_id: String(d.student_id || 'stu-a1'),
          device_id: String(d.device_id || 'robot01'),
          session_id: String(d.session_id || 'sess-a-001'),
          message:
            payload.notification?.body ||
            String(
              d.body ||
                'Tư thế chưa phù hợp — Mình thả lỏng vai rồi chỉnh chỗ ngồi ngay ngắn nhé!'
            ),
          created_at: Number(d.created_at) || Date.now(),
        },
        'fcm_foreground',
        false
      );
    }).then((fn) => {
      unsubFcm = fn;
    });

    const onSwMessage = (ev: MessageEvent) => {
      if (ev.data?.type === 'BUGZ_FCM_PUSH_ARRIVED') {
        handleIncomingAlertEvent(
          {
            alert_id: String(ev.data.alert_id || 'alert-a-001'),
            student_id: String(ev.data.student_id || 'stu-a1'),
            device_id: String(ev.data.device_id || 'robot01'),
            session_id: String(ev.data.session_id || 'sess-a-001'),
            message: String(ev.data.message || ''),
            created_at: Number(ev.data.created_at) || Date.now(),
          },
          'fcm_service_worker',
          false
        );
      }
    };

    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', onSwMessage);
    }

    return () => {
      if (unsubFcm) unsubFcm();
      if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
        navigator.serviceWorker.removeEventListener('message', onSwMessage);
      }
    };
  }, [handleIncomingAlertEvent]);

  const handleSavePreferences = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionBanner(null);
    const res = await authenticatedFetch('/api/notifications/preferences', {
      method: 'POST',
      body: JSON.stringify(prefs),
    });
    const data = await res.json();
    setActionBanner({
      ok: res.ok,
      text: res.ok ? 'Đã lưu cài đặt thông báo của bạn.' : data.message,
    });
    if (res.ok) {
      await loadNotificationCenter();
    }
  };

  const handleRegisterWebPushToken = async () => {
    setActionBanner(null);
    const tokenRes = await obtainFcmWebPushTokenModular();
    const tokenToSave =
      tokenRes.ok && tokenRes.token
        ? tokenRes.token
        : `fcm-sandbox-${uid || 'anon'}-${installationId}`;

    const res = await authenticatedFetch('/api/notifications/push-tokens', {
      method: 'POST',
      body: JSON.stringify({
        installation_id: installationId,
        token: tokenToSave,
        platform: tokenRes.platform,
        user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : 'Browser',
      }),
    });
    await res.json();
    setActionBanner({
      ok: res.ok,
      text: 'Đã bật nhận thông báo trên thiết bị này.',
    });
    await loadNotificationCenter();
  };

  const handleSimulateSimultaneousRtdbAndFcm = () => {
    const testAlertId = 'alert-a-001';
    const sampleMsg =
      'Hươu cao cổ gửi tín hiệu: đầu mình hơi chúi về trước rồi, nâng nhẹ đầu lên nhé!';

    handleIncomingAlertEvent(
      {
        alert_id: testAlertId,
        student_id: 'stu-a1',
        student_display_name: 'Bé Minh (Lớp 4)',
        device_id: 'robot01',
        device_name: 'Robot Đồng Hành 01',
        session_id: 'sess-a-001',
        message: sampleMsg,
        created_at: Date.now(),
        severity: 'low',
      },
      'rtdb_listener',
      false
    );

    handleIncomingAlertEvent(
      {
        alert_id: testAlertId,
        student_id: 'stu-a1',
        student_display_name: 'Bé Minh (Lớp 4)',
        device_id: 'robot01',
        device_name: 'Robot Đồng Hành 01',
        session_id: 'sess-a-001',
        message: sampleMsg,
        created_at: Date.now(),
        severity: 'low',
      },
      'fcm_foreground',
      false
    );
  };

  const handleDispatchScenario = async (
    outcome: 'accepted_by_provider' | 'provider_transient_error' | 'fcm_token_expired',
    testSpoofedPayload = false
  ) => {
    setActionBanner(null);
    const res = await authenticatedFetch('/api/notifications/dispatch', {
      method: 'POST',
      body: JSON.stringify({
        alert_id: outcome === 'provider_transient_error' ? 'alert-retry-test-01' : 'alert-a-001',
        device_id: 'robot-fam-a-01',
        session_id: 'sess-a-001',
        posture_code: 'HEAD_FORWARD',
        reminder_index: 1,
        simulate_provider_outcome: outcome,
        ...(testSpoofedPayload
          ? {
              spoofed_payload_student_id: 'stu-b1',
              spoofed_payload_email: 'spoofed.attacker@example.com',
            }
          : {}),
      }),
    });
    const data = await res.json();
    setActionBanner({
      ok: res.ok,
      text: data.message,
    });
    await loadNotificationCenter();
  };

  const deduplicatedFeed = dedupState.orderedAlertIds
    .map((id) => dedupState.byAlertId[id])
    .filter(Boolean);

  return (
    <section
      aria-label="Trung tâm Thông báo & Giọng đọc"
      className="rounded-2xl border border-slate-200 bg-white p-6 space-y-6"
    >
      <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-center">
        <div>
          <div className="inline-flex items-center gap-2 text-xs font-semibold text-teal-800">
            <Bell className="h-4 w-4" />
            <span>Lời nhắc Tư thế &amp; Cài đặt Thông báo</span>
          </div>
          <h2 className="mt-1 text-xl font-bold text-slate-900">
            Giọng đọc AI Đồng hành &amp; Tùy chọn Nhận Lời nhắc
          </h2>
          <p className="mt-1 text-xs leading-relaxed text-slate-600">
            Tùy chỉnh giọng đọc nhắc nhở tư thế nhẹ nhàng khi đang mở ứng dụng, nhận thông báo trên trình duyệt hoặc nhận email tổng hợp theo khung giờ phù hợp.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void loadNotificationCenter()}
            className="inline-flex min-h-[40px] shrink-0 items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Làm mới</span>
          </button>
        </div>
      </div>

      {actionBanner && (
        <div
          role="status"
          className={`rounded-xl border p-3.5 text-xs font-medium ${
            actionBanner.ok
              ? 'border-emerald-300 bg-emerald-50 text-emerald-950'
              : 'border-rose-300 bg-rose-50 text-rose-950'
          }`}
        >
          {actionBanner.text}
        </div>
      )}

      {/* Khối 1: Điều khiển Giọng đọc AI & Cài đặt Kênh Thông báo */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* Cột 1: Giọng đọc AI Đồng hành */}
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-xs font-bold text-teal-900">
              Giọng đọc AI Nhắc nhở Tư thế
            </div>
            <span className="rounded bg-teal-100 px-2 py-0.5 text-[11px] font-semibold text-teal-900">
              {prefs.voice_enabled ? 'Đang bật âm thanh' : 'Đang tắt âm thanh'}
            </span>
          </div>

          <div className="rounded-lg border border-teal-200 bg-white p-3 space-y-2">
            <label className="block text-xs font-semibold text-slate-800">
              Chọn giọng đọc yêu thích
            </label>
            <select
              value={voicePreset}
              onChange={(e) => {
                const next = e.target.value as BugzVoicePresetId;
                setVoicePreset(next);
                setSavedVoicePreset(next);
              }}
              className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-900 focus:border-teal-600 focus:outline-none"
            >
              {BUGZ_VOICE_PRESETS.map((preset) => (
                <option key={preset.id} value={preset.id}>
                  {preset.label}
                </option>
              ))}
            </select>
            <div className="text-[11px] text-slate-500">
              {BUGZ_VOICE_PRESETS.find((p) => p.id === voicePreset)?.description}
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-3 text-xs space-y-1">
            <div className="text-slate-500">Lời nhắc gần nhất:</div>
            <div className="font-bold text-slate-900">“{lastSpokenMessage}”</div>
            <div className="text-[11px] text-teal-800">{voiceStatusLog}</div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                setPrefs((p) => ({ ...p, voice_enabled: !p.voice_enabled }));
              }}
              className={`inline-flex min-h-[40px] items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-semibold ${
                prefs.voice_enabled
                  ? 'bg-teal-700 text-white'
                  : 'border border-slate-300 bg-white text-slate-700'
              }`}
            >
              {prefs.voice_enabled ? (
                <Volume2 className="h-4 w-4" />
              ) : (
                <VolumeX className="h-4 w-4" />
              )}
              <span>
                {prefs.voice_enabled ? 'Đang bật giọng đọc' : 'Bật giọng đọc'}
              </span>
            </button>

            <button
              type="button"
              disabled={voiceSpeaking}
              onClick={() =>
                void playGentleVoiceAudio(
                  'Chào bạn nhỏ! Mình cùng thả lỏng hai vai, giữ lưng thẳng và mắt cách vở vừa phải để học thật vui nhé!',
                  true
                )
              }
              className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-teal-700 bg-teal-50 px-3.5 py-1.5 text-xs font-semibold text-teal-950 hover:bg-teal-100 disabled:opacity-60"
            >
              <Volume2 className="h-4 w-4 text-teal-800" />
              <span>{voiceSpeaking ? 'Đang đọc...' : 'Nghe thử giọng đọc'}</span>
            </button>

            <button
              type="button"
              disabled={voiceSpeaking}
              onClick={() => void playGentleVoiceAudio(lastSpokenMessage, true)}
              className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-100 disabled:opacity-60"
            >
              <RotateCcw className="h-3.5 w-3.5 text-teal-700" />
              <span>Nghe lại</span>
            </button>
          </div>
        </div>

        {/* Cột 2: Cài đặt Kênh Nhận Thông báo & Giờ nghỉ ngơi */}
        <form
          onSubmit={handleSavePreferences}
          className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-4 flex flex-col justify-between"
        >
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-xs font-bold text-slate-900">
                Tùy chọn Kênh Thông báo &amp; Giờ Nghỉ ngơi
              </div>
              <button
                type="button"
                onClick={() => void handleRegisterWebPushToken()}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-100"
              >
                <Smartphone className="h-3 w-3 text-teal-700" />
                <span>Bật thông báo trình duyệt</span>
              </button>
            </div>

            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3 pt-1">
              <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white p-2.5 text-xs font-medium text-slate-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={prefs.push_enabled}
                  onChange={(e) => setPrefs((p) => ({ ...p, push_enabled: e.target.checked }))}
                  className="h-4 w-4 rounded border-slate-300 text-teal-700"
                />
                <span>Thông báo trình duyệt</span>
              </label>

              <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white p-2.5 text-xs font-medium text-slate-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={prefs.voice_enabled}
                  onChange={(e) => setPrefs((p) => ({ ...p, voice_enabled: e.target.checked }))}
                  className="h-4 w-4 rounded border-slate-300 text-teal-700"
                />
                <span>Giọng đọc nhắc nhở</span>
              </label>

              <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white p-2.5 text-xs font-medium text-slate-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={prefs.email_enabled}
                  onChange={(e) => setPrefs((p) => ({ ...p, email_enabled: e.target.checked }))}
                  className="h-4 w-4 rounded border-slate-300 text-teal-700"
                />
                <span>Email thông báo</span>
              </label>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 pt-1">
              <div>
                <label htmlFor="notif-mode-select" className="block text-xs font-semibold text-slate-700">
                  Tần suất gửi Email
                </label>
                <select
                  id="notif-mode-select"
                  value={prefs.mode}
                  onChange={(e) =>
                    setPrefs((p) => ({
                      ...p,
                      mode: e.target.value === 'digest' ? 'digest' : 'every_alert',
                    }))
                  }
                  className="mt-1 w-full min-h-[38px] rounded-xl border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-900"
                >
                  <option value="every_alert">Gửi ngay từng lời nhắc</option>
                  <option value="digest">Gửi bản tổng hợp cuối ngày</option>
                </select>
              </div>

              <div>
                <label htmlFor="quiet-start-input" className="block text-xs font-semibold text-slate-700">
                  Giờ nghỉ ngơi (Từ)
                </label>
                <input
                  id="quiet-start-input"
                  type="text"
                  value={prefs.quiet_hours_start}
                  onChange={(e) => setPrefs((p) => ({ ...p, quiet_hours_start: e.target.value }))}
                  className="mt-1 w-full min-h-[38px] rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs"
                />
              </div>

              <div>
                <label htmlFor="quiet-end-input" className="block text-xs font-semibold text-slate-700">
                  Giờ nghỉ ngơi (Đến)
                </label>
                <input
                  id="quiet-end-input"
                  type="text"
                  value={prefs.quiet_hours_end}
                  onChange={(e) => setPrefs((p) => ({ ...p, quiet_hours_end: e.target.value }))}
                  className="mt-1 w-full min-h-[38px] rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs"
                />
              </div>
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl bg-teal-700 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-800"
            >
              <CheckCircle2 className="h-4 w-4" />
              <span>Lưu cài đặt thông báo</span>
            </button>
          </div>
        </form>
      </div>

      {/* Khối 2: Danh sách Lời nhắc Tư thế Gần đây */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-bold text-slate-900">
            Danh sách Lời nhắc Tư thế Gần đây ({deduplicatedFeed.length})
          </h3>
        </div>

        {loading && deduplicatedFeed.length === 0 ? (
          <p className="text-xs text-slate-500">Đang tải danh sách lời nhắc...</p>
        ) : deduplicatedFeed.length === 0 ? (
          <p className="text-xs text-slate-500">Hiện chưa có lời nhắc tư thế nào mới.</p>
        ) : (
          <div className="divide-y divide-slate-100 rounded-xl border border-slate-200">
            {deduplicatedFeed.slice(0, compact ? 4 : 6).map((item) => (
              <div
                key={item.alert_id}
                className="flex flex-col justify-between gap-3 p-4 sm:flex-row sm:items-center"
              >
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="rounded bg-teal-100 px-2 py-0.5 font-semibold text-teal-950">
                      {item.student_display_name}
                    </span>
                    <span className="text-slate-500">
                      {new Date(item.created_at).toLocaleString('vi-VN', {
                        timeZone: 'Asia/Ho_Chi_Minh',
                      })}
                    </span>
                    {item.is_read_by_me && (
                      <span className="rounded bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-800">
                        Đã xem
                      </span>
                    )}
                  </div>
                  <p className="text-sm font-medium text-slate-900">“{item.message}”</p>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => void playGentleVoiceAudio(item.message, true)}
                    className="inline-flex min-h-[38px] items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    <Volume2 className="h-3.5 w-3.5 text-teal-700" />
                    <span>Nghe lại</span>
                  </button>
                  <Link
                    to={`/alerts/${item.alert_id}`}
                    className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg bg-teal-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-800"
                  >
                    <span>Xem chi tiết</span>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Công cụ Chẩn đoán Kỹ thuật Thông báo (Chỉ hiển thị khi Admin bật Chế độ Kỹ thuật) */}
      {showTechnicalTools && (
        <div className="space-y-4 rounded-xl border border-amber-300 bg-amber-50/50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold text-amber-950">
                Chẩn đoán Kỹ thuật Đa kênh (Push Token · Dedupe · Notification Jobs)
              </h3>
              <p className="text-xs text-amber-900">
                FCM: {fcmProviderConfigured ? 'Đã cấu hình' : `Thiếu ${fcmMissingVars.join(', ') || 'VAPID'}`} · Email/SMTP: {emailProviderConfigured ? 'Đã cấu hình' : `Thiếu ${emailMissingVars.join(', ') || 'SMTP'}`} · Platform: {pushCap.platformType} ({pushTokens.length} token)
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleSimulateSimultaneousRtdbAndFcm}
                className="inline-flex items-center gap-1 rounded-lg border border-teal-700 bg-white px-3 py-1.5 text-xs font-semibold text-teal-900 hover:bg-teal-50"
              >
                <ShieldCheck className="h-3.5 w-3.5" />
                <span>Kiểm tra Chống trùng Listener + Push (T21)</span>
              </button>
              <button
                type="button"
                onClick={() => void handleDispatchScenario('accepted_by_provider', true)}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-50"
              >
                Kiểm tra Chống giả mạo Payload (T20)
              </button>
              <button
                type="button"
                onClick={() => void handleDispatchScenario('provider_transient_error', false)}
                className="rounded-lg border border-amber-400 bg-white px-3 py-1.5 text-xs font-semibold text-amber-950 hover:bg-amber-100"
              >
                Giả lập Lỗi Provider (T24)
              </button>
            </div>
          </div>

          {dedupProofLog && (
            <div className="rounded-lg border border-teal-300 bg-white p-2.5 text-xs font-medium text-teal-950">
              {dedupProofLog}
            </div>
          )}

          {jobs.length > 0 && (
            <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold text-slate-600">
                  <tr>
                    <th className="px-3 py-2">Mã Job</th>
                    <th className="px-3 py-2">Kênh</th>
                    <th className="px-3 py-2">Trạng thái</th>
                    <th className="px-3 py-2">Số lần thử</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                  {jobs.slice(0, 6).map((job) => (
                    <tr key={job.job_id}>
                      <td className="px-3 py-2 font-bold text-slate-900">{job.job_id}</td>
                      <td className="px-3 py-2 uppercase text-teal-900">{job.channel}</td>
                      <td className="px-3 py-2">{job.state}</td>
                      <td className="px-3 py-2">
                        {job.attempts}/{job.max_attempts}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </section>
  );
};
