import React, { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  AlertCircle,
  ArrowLeft,
  Bot,
  Camera,
  CheckCircle2,
  History,
  Lock,
  Play,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Square,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { resolveRobotMonitoringStatus } from '../domain/bugzRules';
import { GENTLE_VOICE_REMINDERS } from '../data/sourceMapping';
import { useAuth } from '../context/AuthContext';
import type { DataSourceType, PostureState } from '../types/bugz';
import type {
  CommandJobRecord,
  DeviceRuntimeBranch,
  EpisodeLogRecord,
  ExtendedAlertRecord,
  ExtendedSessionRecord,
  HistoryRangePreset,
} from '../domain/p03RobotEngine';
import type { NotificationJobRecord } from '../domain/p04NotificationEngine';
import { NotificationCenterPanel } from '../components/NotificationCenterPanel';
import { LivePostureCameraPanel } from '../components/LivePostureCameraPanel';
import {
  BUGZ_VOICE_PRESETS,
  getSavedVoicePreset,
  setSavedVoicePreset,
  speakVietnameseNeuralVoice,
  type BugzVoicePresetId,
} from '../lib/voiceTtsClient';

interface RobotDeviceView {
  device_id: string;
  user_id: string;
  device_name: string;
  monitoring_enabled: boolean;
  current_posture: PostureState;
  monitoring_active: boolean;
  alert_after_sec: number;
  last_seen_at?: number;
  open_session: ExtendedSessionRecord | null;
  runtime: DeviceRuntimeBranch | null;
  latest_command: CommandJobRecord | null;
}

interface StudentView {
  student_id: string;
  display_name: string;
  age_group: string;
  guardian_owner_uid: string;
  timezone: string;
}

const OWNED_STUDY_SESSION_KEY = 'bugz_owned_study_session_v1';

export interface MqttBridgeStatusView {
  connected: boolean;
  connecting: boolean;
  brokerUrl: string;
  clientId: string;
  username: string;
  subscribedTopics: string[];
  grantedTopics?: string[];
  aclDeniedTopics?: string[];
  aclWarning?: string;
  connectedSince?: number;
  lastPacketAt?: number;
  lastError?: string;
  receivedCount: number;
  publishedCount: number;
  recentPackets: Array<{
    id: string;
    direction: 'INCOMING' | 'OUTGOING';
    timestamp: number;
    topic: string;
    summary: string;
    payloadPreview: string;
  }>;
}

function formatDurationVi(durationMs?: number): string {
  const safeMs = Math.max(0, Math.round(Number(durationMs) || 0));
  const totalSec = Math.floor(safeMs / 1000);
  const hours = Math.floor(totalSec / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;
  if (hours > 0) {
    return `${hours} giờ ${minutes} phút ${seconds} giây`;
  }
  if (minutes > 0) {
    return `${minutes} phút ${seconds} giây`;
  }
  return `${seconds} giây`;
}

function formatPostureLabelVi(posture?: PostureState): {
  label: string;
  badgeClass: string;
  sublabel: string;
} {
  switch (posture) {
    case 'good':
      return {
        label: 'Ngồi thẳng đẹp',
        badgeClass: 'text-emerald-800',
        sublabel: 'Lưng thẳng, khoảng cách mắt tốt',
      };
    case 'bad':
      return {
        label: 'Cần chỉnh tư thế',
        badgeClass: 'text-amber-800',
        sublabel: 'Hơi cúi đầu hoặc nghiêng vai',
      };
    case 'absent':
      return {
        label: 'Tạm rời bàn học',
        badgeClass: 'text-slate-700',
        sublabel: 'Đang giải lao hoặc vắng mặt',
      };
    default:
      return {
        label: 'Đang quan sát',
        badgeClass: 'text-teal-800',
        sublabel: 'Robot đang theo dõi tư thế',
      };
  }
}

export const RobotLandingPage: React.FC<{ returnTo?: string }> = ({ returnTo = '/robot' }) => {
  return (
    <div className="space-y-8">
      {/* Hero Banner */}
      <section className="rounded-3xl border border-teal-200 bg-gradient-to-br from-teal-900 via-teal-800 to-slate-900 p-8 text-white shadow-sm md:p-10">
        <div className="grid grid-cols-1 items-center gap-8 lg:grid-cols-12">
          <div className="space-y-5 lg:col-span-7">
            <div className="inline-flex items-center gap-2 rounded-full border border-teal-400/30 bg-teal-500/20 px-3.5 py-1.5 text-xs font-semibold text-teal-100">
              <Bot className="h-4 w-4 text-teal-300" />
              <span>Robot Đồng Hành BUGZ BrightUpGenZ · Giữ Lưng Thẳng – Mắt Sáng</span>
            </div>

            <h1 className="text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">
              Người bạn đồng hành nhắc tư thế ngồi học nhẹ nhàng mỗi ngày
            </h1>

            <p className="max-w-2xl text-sm leading-relaxed text-teal-100/90 sm:text-base">
              Robot Đồng Hành BUGZ quan sát tư thế ngồi học theo thời gian thực, phát lời nhắc khích lệ bằng giọng nói AI tiếng Việt thân thiện khi cúi đầu quá gần vở và lưu lại trọn bộ nhật ký phiên học cá nhân hóa cho riêng bạn.
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <Link
                to={`/login?returnTo=${encodeURIComponent(returnTo)}`}
                className="inline-flex min-h-[48px] items-center gap-2 rounded-2xl bg-amber-400 px-6 py-3 text-sm font-bold text-slate-950 shadow-xs transition hover:bg-amber-300"
              >
                <Play className="h-4 w-4 fill-slate-950" />
                <span>Đăng nhập để Sử dụng Robot ngay</span>
              </Link>
              <Link
                to="/learn"
                className="inline-flex min-h-[48px] items-center gap-2 rounded-2xl border border-teal-300/40 bg-white/10 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/20"
              >
                <span>Khám phá Lộ trình 28 ngày</span>
              </Link>
            </div>

            <p className="text-xs text-teal-200/90">
              Chỉ cần nhập Họ tên, Email và Số điện thoại để đăng nhập trải nghiệm ngay. Dữ liệu phiên học, lời nhắc và nhật ký học tập được bảo mật tách biệt cho từng tài khoản.
            </p>
          </div>

          {/* Minh họa trực quan các chỉ số Robot */}
          <div className="lg:col-span-5">
            <div className="rounded-2xl border border-white/15 bg-white/10 p-5 backdrop-blur-xs space-y-4">
              <div className="flex items-center justify-between border-b border-white/15 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-400/20 text-teal-200">
                    <Bot className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-teal-200">Thiết bị Đồng hành</div>
                    <div className="text-sm font-bold text-white">Robot01 · Tự động kích hoạt</div>
                  </div>
                </div>
                <span className="rounded-full bg-emerald-400/20 px-3 py-1 text-xs font-semibold text-emerald-200">
                  Sẵn sàng kết nối
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="rounded-xl bg-white/10 p-3.5">
                  <div className="text-teal-200">Theo dõi tư thế</div>
                  <div className="mt-1 text-base font-bold text-white">Thời gian thực</div>
                  <div className="mt-0.5 text-[11px] text-teal-200/80">Đếm đợt ngồi thẳng ổn định</div>
                </div>
                <div className="rounded-xl bg-white/10 p-3.5">
                  <div className="text-teal-200">Giọng đọc nhắc nhở</div>
                  <div className="mt-1 text-base font-bold text-white">AI Tiếng Việt</div>
                  <div className="mt-0.5 text-[11px] text-teal-200/80">Nhẹ nhàng, hóm hỉnh, khích lệ</div>
                </div>
              </div>

              <div className="rounded-xl border border-teal-300/25 bg-teal-950/50 p-3.5 text-xs">
                <div className="font-semibold text-amber-300">Lời nhắc mẫu từ Robot Đồng Hành:</div>
                <p className="mt-1 italic text-teal-50">
                  “Mình ngồi thẳng lưng và giữ mắt cách vở khoảng 30 cm để đôi mắt luôn sáng khỏe nhé!”
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 4 Giá trị cốt lõi của Robot Đồng Hành */}
      <section className="space-y-4">
        <div>
          <div className="text-xs font-bold uppercase tracking-wider text-teal-800">
            Tính năng nổi bật
          </div>
          <h2 className="mt-1 text-xl font-bold text-slate-900">
            Robot Đồng Hành giúp ích gì trong mỗi giờ ngồi học?
          </h2>
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-2.5 shadow-2xs">
            <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-teal-50 text-teal-700">
              <Bot className="h-5 w-5" />
            </div>
            <h3 className="text-base font-bold text-slate-900">
              1. Quan sát tư thế tự động
            </h3>
            <p className="text-xs leading-relaxed text-slate-600">
              Tự động kích hoạt chế độ giám sát trên Robot01 ngay khi bạn đăng nhập, ghi nhận các đợt ngồi thẳng đẹp và thời gian cần chỉnh tư thế.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-2.5 shadow-2xs">
            <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-700">
              <Volume2 className="h-5 w-5" />
            </div>
            <h3 className="text-base font-bold text-slate-900">
              2. Giọng nói AI thân thiện
            </h3>
            <p className="text-xs leading-relaxed text-slate-600">
              Nhắc nhở bằng giọng đọc tiếng Việt truyền cảm, nhẹ nhàng hướng dẫn động tác thả lỏng vai và ngồi thẳng lưng mà không gây áp lực.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-2.5 shadow-2xs">
            <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
              <History className="h-5 w-5" />
            </div>
            <h3 className="text-base font-bold text-slate-900">
              3. Nhật ký học tập riêng biệt
            </h3>
            <p className="text-xs leading-relaxed text-slate-600">
              Mỗi người dùng có nhật ký phiên học, thống kê theo ngày/tuần/tháng và lịch sử lời nhắc riêng, hoàn toàn bảo mật và không trộn lẫn.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-2.5 shadow-2xs">
            <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-sky-50 text-sky-700">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <h3 className="text-base font-bold text-slate-900">
              4. Thông báo
            </h3>
            <p className="text-xs leading-relaxed text-slate-600">
              Nhận thông báo kèm nhắc nhở học tập để phụ huynh và học sinh dễ dàng điều chỉnh tư thế ngồi, chiều cao bàn ghế, ánh sáng.
            </p>
          </div>
        </div>
      </section>

      {/* Quy trình 3 bước bắt đầu */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 space-y-5">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-teal-800">
              Bắt đầu dễ dàng trong 30 giây
            </div>
            <h2 className="mt-1 text-xl font-bold text-slate-900">
              3 bước trải nghiệm Robot Đồng Hành dành riêng cho bạn
            </h2>
          </div>
          <Link
            to={`/login?returnTo=${encodeURIComponent(returnTo)}`}
            className="inline-flex min-h-[44px] shrink-0 items-center gap-2 rounded-xl bg-teal-700 px-5 py-2.5 text-xs font-bold text-white hover:bg-teal-800"
          >
            <Lock className="h-4 w-4" />
            <span>Đăng nhập để Bắt đầu Phiên học</span>
          </Link>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-1.5">
            <div className="text-xs font-bold text-teal-800">Bước 1 · Đăng nhập nhanh</div>
            <div className="text-sm font-bold text-slate-900">
              Nhập Họ tên, Email &amp; Số điện thoại
            </div>
            <p className="text-xs text-slate-600">
              Hệ thống tự động khởi tạo hồ sơ học tập cá nhân cho riêng bạn ngay lập tức.
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-1.5">
            <div className="text-xs font-bold text-teal-800">Bước 2 · Tự động kết nối Robot01</div>
            <div className="text-sm font-bold text-slate-900">
              Kích hoạt phiên học &amp; bật thông báo
            </div>
            <p className="text-xs text-slate-600">
              Robot01 tự động mở phiên giám sát gắn với hồ sơ của bạn và bật sẵn lời nhắc giọng nói AI.
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-1.5">
            <div className="text-xs font-bold text-teal-800">Bước 3 · Theo dõi tiến bộ</div>
            <div className="text-sm font-bold text-slate-900">
              Xem chỉ số, lời nhắc &amp; lịch sử riêng
            </div>
            <p className="text-xs text-slate-600">
              Toàn bộ phiên học, số đợt ngồi thẳng và lời nhắc của bạn được lưu trữ riêng biệt theo thời gian thực.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
};

export const RobotCompanionPage: React.FC = () => {
  const {
    uid,
    loading: authLoading,
    activeStudentId,
    setActiveStudentId,
    buildAuthHeaders,
  } = useAuth();

  const [loading, setLoading] = useState<boolean>(true);
  const [devices, setDevices] = useState<RobotDeviceView[]>([]);
  const [students, setStudents] = useState<StudentView[]>([]);
  const [recentAlerts, setRecentAlerts] = useState<ExtendedAlertRecord[]>([]);
  const [recentSessions, setRecentSessions] = useState<ExtendedSessionRecord[]>([]);

  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('robot01');
  const [selectedStudentId, setSelectedStudentId] = useState<string>(activeStudentId || '');
  const lastAutoSpokenAlertIdRef = React.useRef<string>('');
  const hasInitializedAlertsRef = React.useRef<boolean>(false);
  const exitSaveTargetRef = React.useRef<{ sessionId: string; deviceId: string } | null>(null);
  const exitSaveSentRef = React.useRef<string | null>(null);

  const [simClockMs, setSimClockMs] = useState<number>(1793502000000);
  const [simSeq, setSimSeq] = useState<number>(0);
  const [actionBanner, setActionBanner] = useState<{
    type: 'success' | 'warning' | 'error';
    text: string;
  } | null>(null);

  const [voiceEnabled, setVoiceEnabled] = useState<boolean>(true);
  const [voicePreset, setVoicePreset] = useState<BugzVoicePresetId>(() => getSavedVoicePreset());
  const [voiceSpeaking, setVoiceSpeaking] = useState<boolean>(false);
  const [lastSpokenText, setLastSpokenText] = useState<string>(
    GENTLE_VOICE_REMINDERS[0].text
  );

  useEffect(() => {
    if (activeStudentId && activeStudentId !== selectedStudentId) {
      setSelectedStudentId(activeStudentId);
    }
  }, [activeStudentId, selectedStudentId]);

  const speakReminder = useCallback(
    async (text: string, forceManual = false) => {
      setLastSpokenText(text);
      if (!forceManual && !voiceEnabled) {
        return;
      }
      setVoiceSpeaking(true);
      await speakVietnameseNeuralVoice({
        text,
        presetId: voicePreset,
        playChime: true,
        isAutoTrigger: !forceManual,
      });
      setVoiceSpeaking(false);
    },
    [voiceEnabled, voicePreset]
  );

  const fetchBootstrap = useCallback(async () => {
    if (!uid) {
      setLoading(false);
      return;
    }
    try {
      const headers = await buildAuthHeaders();
      const res = await fetch('/api/robot/bootstrap', { headers });
      const data = await res.json();
      if (data.ok) {
        setDevices(data.devices || []);
        setStudents(data.students || []);
        const alertsList: ExtendedAlertRecord[] = data.recentAlerts || [];
        setRecentAlerts(alertsList);
        setRecentSessions(data.recentSessions || []);

        if (alertsList.length > 0) {
          const newest = alertsList[0];
          if (!hasInitializedAlertsRef.current) {
            hasInitializedAlertsRef.current = true;
            lastAutoSpokenAlertIdRef.current = newest.alert_id || '';
          } else if (newest.alert_id && newest.alert_id !== lastAutoSpokenAlertIdRef.current) {
            lastAutoSpokenAlertIdRef.current = newest.alert_id;
            const isFromWebcam = String(newest.event_id || '').startsWith('webcam-');
            if (!isFromWebcam) {
              void speakReminder(newest.message || '', false);
            }
          }
        } else {
          hasInitializedAlertsRef.current = true;
        }

        if (
          data.devices?.length > 0 &&
          !data.devices.some((d: RobotDeviceView) => d.device_id === selectedDeviceId)
        ) {
          const robot01Dev = data.devices.find((d: RobotDeviceView) => d.device_id === 'robot01');
          setSelectedDeviceId(robot01Dev ? 'robot01' : data.devices[0].device_id);
        }
        if (
          data.students?.length > 0 &&
          !data.students.some((s: StudentView) => s.student_id === selectedStudentId)
        ) {
          const firstStuId = data.students[0].student_id;
          setSelectedStudentId(firstStuId);
          setActiveStudentId(firstStuId);
        }
      }
    } catch {
      // Ignore network error during initial load
    } finally {
      setLoading(false);
    }
  }, [buildAuthHeaders, selectedDeviceId, selectedStudentId, setActiveStudentId, speakReminder, uid]);

  useEffect(() => {
    if (!uid) return;
    void fetchBootstrap();
    const timer = window.setInterval(() => {
      void fetchBootstrap();
    }, 2500);
    return () => window.clearInterval(timer);
  }, [fetchBootstrap, uid]);

  const currentDevice =
    devices.find((d) => d.device_id === selectedDeviceId) || devices[0] || null;
  const openSession = currentDevice?.open_session || null;

  useEffect(() => {
    const ownedSessionId = window.sessionStorage.getItem(OWNED_STUDY_SESSION_KEY);
    if (currentDevice && openSession?.session_id === ownedSessionId) {
      exitSaveTargetRef.current = {
        sessionId: openSession.session_id,
        deviceId: currentDevice.device_id,
      };
      return;
    }
    exitSaveTargetRef.current = null;
    if (!openSession && ownedSessionId) {
      window.sessionStorage.removeItem(OWNED_STUDY_SESSION_KEY);
    }
  }, [currentDevice, openSession?.session_id]);

  useEffect(() => {
    if (!uid) return;

    const saveBeforeExit = () => {
      const target = exitSaveTargetRef.current;
      if (!target || exitSaveSentRef.current === target.sessionId) return;
      exitSaveSentRef.current = target.sessionId;
      void fetch(`/api/sessions/${encodeURIComponent(target.sessionId)}/end`, {
        method: 'POST',
        headers: { ...buildAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ device_id: target.deviceId }),
        keepalive: true,
      }).catch(() => {
        // Nếu trình duyệt bị đóng cưỡng bức trước khi gửi xong, lần mở phiên kế tiếp
        // sẽ tự đóng và ghi log phiên cũ nhờ auto_close_previous phía server.
      });
    };

    window.addEventListener('pagehide', saveBeforeExit);
    window.addEventListener('beforeunload', saveBeforeExit);
    return () => {
      window.removeEventListener('pagehide', saveBeforeExit);
      window.removeEventListener('beforeunload', saveBeforeExit);
    };
  }, [buildAuthHeaders, uid]);

  if (!authLoading && !uid) {
    return <RobotLandingPage returnTo="/robot" />;
  }

  const latestCommand = currentDevice?.latest_command || null;
  const isCommandExpired = Boolean(
    latestCommand && latestCommand.ack_status === 'expired'
  );

  const monitoringStatus = resolveRobotMonitoringStatus(
    Boolean(currentDevice?.monitoring_enabled),
    Boolean(currentDevice?.monitoring_active),
    isCommandExpired
  );

  const postureDisplay = formatPostureLabelVi(currentDevice?.current_posture);

  const handleStartSession = async () => {
    if (!currentDevice) return;
    try {
      const headers = await buildAuthHeaders();
      const res = await fetch('/api/sessions/start', {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          device_id: currentDevice.device_id,
          student_id: selectedStudentId,
          source: 'real',
          auto_close_previous: true,
        }),
      });
      const data = await res.json();
      setActionBanner({
        type: res.ok ? 'success' : 'error',
        text: res.ok
          ? 'Đã bắt đầu phiên học mới và kích hoạt chế độ giám sát tư thế.'
          : data.message,
      });
      if (res.ok) {
        if (data.session_id) {
          const startedSessionId = String(data.session_id);
          window.sessionStorage.setItem(OWNED_STUDY_SESSION_KEY, startedSessionId);
          exitSaveTargetRef.current = {
            sessionId: startedSessionId,
            deviceId: currentDevice.device_id,
          };
          exitSaveSentRef.current = null;
        }
        setSimClockMs(1793502000000);
        setSimSeq(0);
        await fetchBootstrap();
      }
    } catch {
      setActionBanner({ type: 'error', text: 'Không thể bắt đầu phiên học mới.' });
    }
  };

  const handleEndSession = async () => {
    if (!currentDevice || !openSession) return;
    try {
      const headers = await buildAuthHeaders();
      const res = await fetch(`/api/sessions/${openSession.session_id}/end`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          device_id: currentDevice.device_id,
        }),
      });
      const data = await res.json();
      setActionBanner({
        type: res.ok ? 'success' : 'error',
        text: res.ok ? 'Đã kết thúc phiên học và lưu kết quả thống kê.' : data.message,
      });
      if (res.ok) {
        window.sessionStorage.removeItem(OWNED_STUDY_SESSION_KEY);
        exitSaveTargetRef.current = null;
        exitSaveSentRef.current = openSession.session_id;
      }
      await fetchBootstrap();
    } catch {
      setActionBanner({ type: 'error', text: 'Không thể kết thúc phiên học.' });
    }
  };

  const handleSendCommand = async (desiredMonitoring: boolean) => {
    if (!currentDevice) return;
    try {
      const headers = await buildAuthHeaders();
      const res = await fetch(`/api/devices/${currentDevice.device_id}/commands`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          monitoring_enabled: desiredMonitoring,
          alert_after_sec: currentDevice.alert_after_sec || 30,
          ttl_sec: 30,
          source: 'real',
        }),
      });
      const data = await res.json();
      setActionBanner({
        type: res.ok ? 'success' : 'error',
        text: res.ok
          ? desiredMonitoring
            ? 'Đã bật chế độ giám sát tư thế trên Robot.'
            : 'Đã tạm dừng chế độ giám sát tư thế.'
          : data.message,
      });
      await fetchBootstrap();
    } catch {
      setActionBanner({ type: 'error', text: 'Không thể gửi yêu cầu điều khiển tới Robot.' });
    }
  };

  const handleQuickExperiencePosture = async (params: {
    posture: PostureState;
    advanceSec: number;
    withCaptureUpload?: 'success';
  }) => {
    if (!currentDevice || !openSession) {
      setActionBanner({
        type: 'warning',
        text: 'Hãy bấm "Bắt đầu phiên học mới" trước khi thử trải nghiệm tư thế.',
      });
      return;
    }

    try {
      const headers = await buildAuthHeaders();
      let captureId: string | undefined;

      if (params.withCaptureUpload) {
        const ticketRes = await fetch('/api/captures/upload-ticket', {
          method: 'POST',
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            device_id: currentDevice.device_id,
            session_id: openSession.session_id,
            mime_type: 'image/jpeg',
            byte_size: 86400,
            source: 'simulator',
          }),
        });
        const ticketData = await ticketRes.json();
        if (ticketRes.ok && ticketData.ticket) {
          captureId = ticketData.ticket.capture_id;
          await fetch(`/api/captures/${captureId}/upload`, {
            method: 'PUT',
            headers: {
              ...headers,
              'Content-Type': 'application/json',
              'x-upload-ticket-token': ticketData.ticket.upload_ticket_token,
            },
            body: JSON.stringify({
              upload_ticket_token: ticketData.ticket.upload_ticket_token,
              simulate_failure: false,
            }),
          });
        }
      }

      let baseClock = simClockMs;
      let baseSeq = simSeq;

      const needsPrimePacket =
        params.advanceSec >= 4 &&
        (params.posture === 'good' || params.posture === 'bad') &&
        currentDevice.current_posture !== params.posture;

      if (needsPrimePacket) {
        const primeTime = baseClock + 1000;
        const primeSeq = baseSeq + 1;
        const primeEventId = `sim-${currentDevice.device_id}-boot01-${String(primeSeq).padStart(4, '0')}`;
        const primeRes = await fetch('/api/ingest/mqtt', {
          method: 'POST',
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            topic: `bugz/v1/devices/${currentDevice.device_id}/observations`,
            client_id: currentDevice.device_id,
            username: currentDevice.device_id,
            payload: {
              schema_version: 1,
              event_id: primeEventId,
              device_id: currentDevice.device_id,
              session_id: openSession.session_id,
              boot_id: 'boot01',
              sequence: primeSeq,
              type: 'posture.observed',
              observed_at: primeTime,
              posture: params.posture,
              ...(params.posture === 'bad' ? { posture_code: 'HEAD_FORWARD' } : {}),
              confidence: 0.94,
              robot_moving: false,
              source: 'simulator',
            },
          }),
        });
        if (primeRes.ok) {
          baseClock = primeTime;
          baseSeq = primeSeq;
        }
      }

      const nextTime = baseClock + params.advanceSec * 1000;
      const nextSequence = baseSeq + 1;
      const eventId = `sim-${currentDevice.device_id}-boot01-${String(nextSequence).padStart(4, '0')}`;

      const res = await fetch('/api/ingest/mqtt', {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: `bugz/v1/devices/${currentDevice.device_id}/observations`,
          client_id: currentDevice.device_id,
          username: currentDevice.device_id,
          payload: {
            schema_version: 1,
            event_id: eventId,
            device_id: currentDevice.device_id,
            session_id: openSession.session_id,
            boot_id: 'boot01',
            sequence: nextSequence,
            type: 'posture.observed',
            observed_at: nextTime,
            posture: params.posture,
            ...(params.posture === 'bad' ? { posture_code: 'HEAD_FORWARD' } : {}),
            confidence: 0.94,
            robot_moving: false,
            ...(captureId ? { capture_id: captureId } : {}),
            source: 'simulator',
          },
        }),
      });
      await res.json();

      if (res.ok) {
        setSimClockMs(nextTime);
        setSimSeq(nextSequence);
        setActionBanner({
          type: 'success',
          text:
            params.posture === 'good'
              ? 'Đã ghi nhận thêm 1 đợt ngồi thẳng đẹp!'
              : params.advanceSec >= 30
              ? 'Đã phát lời nhắc chỉnh tư thế kèm giọng nói AI và lưu ảnh minh họa!'
              : 'Đã ghi nhận 1 đợt cần chỉnh tư thế.',
        });
      }

      await fetchBootstrap();
    } catch {
      setActionBanner({ type: 'error', text: 'Không thể gửi tín hiệu mô phỏng tư thế.' });
    }
  };

  return (
    <div className="space-y-8">
      {/* Header & Trạng thái Robot Đồng Hành */}
      <section className="rounded-3xl border border-teal-200 bg-gradient-to-br from-teal-900 via-teal-800 to-slate-900 p-6 sm:p-8 text-white shadow-sm">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-teal-400/30 bg-teal-500/20 px-3 py-1 text-xs font-semibold text-teal-100">
              <Bot className="h-4 w-4 text-amber-300" />
              <span>Người bạn đồng hành giữ gìn tư thế học tập</span>
            </div>
            <h1 className="mt-2.5 text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
              Robot Đồng Hành: Giám sát Tư thế &amp; Nhắc nhở Nhẹ nhàng
            </h1>
            <p className="mt-1.5 max-w-3xl text-sm leading-relaxed text-teal-50/90">
              Robot tự động quan sát tư thế ngồi học và nhắc nhở nhẹ nhàng bằng giọng đọc thân thiện khi em cúi đầu quá gần vở hoặc ngồi cong lưng lâu.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => void fetchBootstrap()}
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-teal-300/40 bg-white/10 px-3.5 py-2 text-xs font-semibold text-white hover:bg-white/20 transition-colors"
            >
              <RefreshCw className="h-4 w-4 text-amber-300" />
              <span>Làm mới</span>
            </button>
            <Link
              to="/robot/history"
              className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-amber-400 px-4 py-2 text-xs font-bold text-slate-950 hover:bg-amber-300 transition-colors shadow-xs"
            >
              <History className="h-4 w-4" />
              <span>Xem Lịch sử Học tập</span>
            </Link>
          </div>
        </div>

        {actionBanner && (
          <div
            role="status"
            className={`mt-4 rounded-xl border p-3.5 text-xs font-medium flex items-center justify-between gap-3 ${
              actionBanner.type === 'success'
                ? 'border-emerald-300 bg-emerald-50 text-emerald-950'
                : actionBanner.type === 'warning'
                ? 'border-amber-300 bg-amber-50 text-amber-950'
                : 'border-rose-300 bg-rose-50 text-rose-950'
            }`}
          >
            <span>{actionBanner.text}</span>
            <button
              type="button"
              onClick={() => setActionBanner(null)}
              className="text-xs underline font-semibold shrink-0"
            >
              Đóng
            </button>
          </div>
        )}
      </section>

      {/* Khung Camera Nhận diện Tư thế (Rộng toàn chiều ngang, thoáng mắt) */}
      <LivePostureCameraPanel
        deviceId={currentDevice?.device_id || 'robot01'}
        openSessionId={openSession?.session_id || null}
        buildAuthHeaders={buildAuthHeaders}
        onObservationSynced={() => void fetchBootstrap()}
        onSpeakReminder={(text) => void speakReminder(text, false)}
      />

      {/* Thanh Cài đặt Nhanh Giọng đọc AI & Phiên học (Gọn trên 1 hàng ngang) */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => setVoiceEnabled((v) => !v)}
            className={`inline-flex min-h-[40px] items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold whitespace-nowrap ${
              voiceEnabled
                ? 'bg-teal-700 text-white'
                : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
            }`}
          >
            {voiceEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
            <span>{voiceEnabled ? 'Đang bật giọng nhắc' : 'Đã tắt giọng nhắc'}</span>
          </button>

          <select
            aria-label="Chọn giọng đọc đồng hành"
            value={voicePreset}
            onChange={(e) => {
              const next = e.target.value as BugzVoicePresetId;
              setVoicePreset(next);
              setSavedVoicePreset(next);
            }}
            className="min-h-[40px] rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-900 focus:border-teal-600 focus:outline-none"
          >
            {BUGZ_VOICE_PRESETS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>

          <button
            type="button"
            disabled={voiceSpeaking}
            onClick={() => void speakReminder(lastSpokenText, true)}
            className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-800 whitespace-nowrap hover:bg-slate-50 disabled:opacity-60"
          >
            <Volume2 className="h-4 w-4 text-teal-700" />
            <span>{voiceSpeaking ? 'Đang phát...' : 'Nghe thử giọng đọc'}</span>
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleStartSession}
            className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-teal-700 bg-teal-50 px-3.5 py-2 text-xs font-bold text-teal-900 whitespace-nowrap hover:bg-teal-100"
          >
            <Play className="h-3.5 w-3.5" />
            <span>{openSession ? 'Làm mới phiên' : 'Bắt đầu phiên'}</span>
          </button>

          {openSession && (
            <button
              type="button"
              onClick={handleEndSession}
              className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-rose-300 bg-rose-50 px-3.5 py-2 text-xs font-semibold text-rose-900 whitespace-nowrap hover:bg-rose-100"
            >
              <Square className="h-3.5 w-3.5" />
              <span>Kết thúc phiên</span>
            </button>
          )}
        </div>
      </section>

      {/* Hàng 2: 5 Chỉ số Tư thế Ngồi học Hiện tại (Gọn gàng, bỏ hộp giả lập Demo thừa) */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 space-y-4">
        <div>
          <div className="text-xs font-semibold text-teal-800">Theo dõi thời gian thực</div>
          <h2 className="mt-0.5 text-lg font-bold text-slate-900">
            Chỉ số Tư thế trong Phiên học
          </h2>
        </div>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="text-xs font-medium text-slate-500">Tư thế hiện tại</div>
            <div className={`mt-1 text-lg font-bold ${postureDisplay.badgeClass}`}>
              {postureDisplay.label}
            </div>
            <div className="mt-0.5 text-[11px] text-slate-500">
              {postureDisplay.sublabel}
            </div>
          </div>

          <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4">
            <div className="text-xs font-medium text-emerald-900">Số đợt ngồi đúng</div>
            <div className="mt-1 text-2xl font-bold tabular-nums text-emerald-800">
              {openSession?.good_count ?? 0}
            </div>
            <div className="mt-0.5 text-[11px] text-emerald-700">
              Giữ thẳng lưng ổn định
            </div>
          </div>

          <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4">
            <div className="text-xs font-medium text-amber-900">Số đợt cần chỉnh</div>
            <div className="mt-1 text-2xl font-bold tabular-nums text-amber-800">
              {openSession?.bad_count ?? 0}
            </div>
            <div className="mt-0.5 text-[11px] text-amber-800">
              Ngồi cúi hoặc nghiêng người
            </div>
          </div>

          <div className="rounded-xl border border-rose-200 bg-rose-50/60 p-4">
            <div className="text-xs font-semibold text-rose-900">
              Thời gian ngồi chưa đúng
            </div>
            <div className="mt-1 text-lg font-bold tabular-nums text-rose-950">
              {formatDurationVi(openSession?.bad_duration_ms)}
            </div>
            <div className="mt-0.5 text-[11px] text-rose-800">
              Cộng dồn trong phiên học
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="text-xs font-medium text-slate-500">Số lần nhắc nhở</div>
            <div className="mt-1 text-2xl font-bold tabular-nums text-slate-900">
              {openSession?.alert_count ?? 0}
            </div>
            <div className="mt-0.5 text-[11px] text-slate-500">
              Lời nhắc nhẹ nhàng từ Robot
            </div>
          </div>
        </div>
      </section>

      {/* Bảng Thống Kê Các Phiên Học Gần Đây */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs font-semibold text-teal-800">
              Nhật ký học tập
            </div>
            <h2 className="mt-0.5 text-lg font-bold text-slate-900">
              Thống kê Các Phiên Học Gần Đây
            </h2>
          </div>
          <Link
            to="/robot/history"
            className="text-xs font-semibold text-teal-800 underline"
          >
            Xem báo cáo chi tiết theo tuần / tháng &rarr;
          </Link>
        </div>

        {recentSessions.length === 0 ? (
          <p className="text-xs text-slate-500">Chưa có phiên học nào được ghi nhận.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
              <thead className="bg-slate-50 font-semibold text-slate-700">
                <tr>
                  <th className="px-3.5 py-2.5">Thời gian bắt đầu</th>
                  <th className="px-3.5 py-2.5">Trạng thái</th>
                  <th className="px-3.5 py-2.5">Số đợt ngồi đúng</th>
                  <th className="px-3.5 py-2.5">Số đợt cần chỉnh</th>
                  <th className="px-3.5 py-2.5 text-rose-900">Thời gian ngồi chưa đúng</th>
                  <th className="px-3.5 py-2.5">Số lần nhắc nhở</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {recentSessions.slice(0, 8).map((sess) => (
                  <tr key={`${sess.device_id}-${sess.session_id}`}>
                    <td className="px-3.5 py-2.5 font-medium text-slate-900">
                      {new Date(sess.started_at).toLocaleString('vi-VN', {
                        timeZone: 'Asia/Ho_Chi_Minh',
                      })}
                    </td>
                    <td className="px-3.5 py-2.5">
                      {sess.ended_at ? (
                        <span className="rounded bg-slate-100 px-2 py-0.5 font-semibold text-slate-700">
                          Đã hoàn thành
                        </span>
                      ) : (
                        <span className="rounded bg-emerald-100 px-2 py-0.5 font-semibold text-emerald-900">
                          Đang diễn ra
                        </span>
                      )}
                    </td>
                    <td className="px-3.5 py-2.5 font-bold tabular-nums text-emerald-800">
                      {sess.good_count ?? 0} đợt
                    </td>
                    <td className="px-3.5 py-2.5 font-bold tabular-nums text-amber-800">
                      {sess.bad_count ?? 0} đợt
                    </td>
                    <td className="px-3.5 py-2.5 font-bold tabular-nums text-rose-800">
                      {formatDurationVi(sess.bad_duration_ms)}
                    </td>
                    <td className="px-3.5 py-2.5 font-bold tabular-nums text-slate-800">
                      {sess.alert_count ?? 0} lần nhắc
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Danh sách Lời nhắc Tư thế & Ảnh Minh họa Gần Nhất */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold text-teal-800">
              Lời nhắc gần đây
            </div>
            <h2 className="mt-0.5 text-lg font-bold text-slate-900">
              Nhật ký Nhắc nhở Tư thế
            </h2>
          </div>
          <Link
            to="/robot/history"
            className="text-xs font-semibold text-teal-800 underline"
          >
            Xem toàn bộ lịch sử &rarr;
          </Link>
        </div>

        {loading ? (
          <p className="text-xs text-slate-500">Đang tải danh sách lời nhắc...</p>
        ) : recentAlerts.length === 0 ? (
          <p className="text-xs text-slate-500">Chưa có lời nhắc tư thế nào trong phiên học này.</p>
        ) : (
          <div className="divide-y divide-slate-100 rounded-xl border border-slate-200">
            {recentAlerts.slice(0, 6).map((alertItem) => (
              <div
                key={alertItem.alert_id}
                className="flex flex-col justify-between gap-3 p-4 sm:flex-row sm:items-center"
              >
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="font-semibold text-teal-900">
                      {new Date(alertItem.created_at).toLocaleString('vi-VN', {
                        timeZone: 'Asia/Ho_Chi_Minh',
                      })}
                    </span>
                    {alertItem.image_id && (
                      <span className="rounded-md bg-teal-50 px-2 py-0.5 text-[11px] font-medium text-teal-800">
                        Có ảnh góc học tập
                      </span>
                    )}
                  </div>
                  <p className="text-sm font-medium text-slate-900">“{alertItem.message}”</p>
                </div>

                <Link
                  to={`/alerts/${alertItem.alert_id}`}
                  className="inline-flex min-h-[40px] shrink-0 items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-50"
                >
                  <Camera className="h-3.5 w-3.5 text-teal-700" />
                  <span>Xem chi tiết</span>
                </Link>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Cài đặt Thông báo & Giọng đọc */}
      <NotificationCenterPanel />
    </div>
  );
};

/**
 * Bảng Công cụ Kỹ thuật Robot & Chẩn đoán MQTT/ESP32
 * Chỉ hiển thị trong trang Quản trị (/admin) khi Admin bật "Chế độ Kỹ thuật (Technical Mode)".
 */
export const RobotAdminTechnicalPanel: React.FC = () => {
  const { buildAuthHeaders } = useAuth();
  const [mqttBridgeStatus, setMqttBridgeStatus] = useState<MqttBridgeStatusView | null>(null);
  const [devices, setDevices] = useState<RobotDeviceView[]>([]);
  const [espVoicePhrase, setEspVoicePhrase] = useState<string>('Ngồi thẳng lưng lên bạn nhé!');
  const [espVoiceStatus, setEspVoiceStatus] = useState<string | null>(null);
  const [espVoiceBusy, setEspVoiceBusy] = useState<boolean>(false);
  const [micRecording, setMicRecording] = useState<boolean>(false);
  const mediaRecorderRef = React.useRef<MediaRecorder | null>(null);
  const [simClockMs, setSimClockMs] = useState<number>(1793502000000);
  const [simSeq, setSimSeq] = useState<number>(0);
  const [techBanner, setTechBanner] = useState<string | null>(null);

  const loadTechStatus = useCallback(async () => {
    try {
      const headers = await buildAuthHeaders();
      const res = await fetch('/api/robot/bootstrap', { headers });
      const data = await res.json();
      if (data.ok) {
        setMqttBridgeStatus(data.mqttBridgeStatus || null);
        setDevices(data.devices || []);
      }
    } catch {
      // ignore
    }
  }, [buildAuthHeaders]);

  useEffect(() => {
    void loadTechStatus();
  }, [loadTechStatus]);

  const currentDevice = devices.find((d) => d.device_id === 'robot01') || devices[0] || null;
  const openSession = currentDevice?.open_session || null;

  const handleSynthesizeEsp32VoiceHeader = async () => {
    setEspVoiceBusy(true);
    setEspVoiceStatus('Đang tạo mảng âm thanh PCM 8kHz tiếng Việt cho mạch loa MAX98357A...');
    try {
      const res = await fetch('/api/esp32/voice-header', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phrase: espVoicePhrase }),
      });
      const data = await res.json();
      setEspVoiceStatus(data.message || 'Đã cập nhật voice_alert_pcm.h.');
    } catch {
      setEspVoiceStatus('Không thể kết nối /api/esp32/voice-header.');
    } finally {
      setEspVoiceBusy(false);
    }
  };

  const handleToggleMicRecordForEsp32 = async () => {
    if (micRecording && mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      setMicRecording(false);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const chunks: BlobPart[] = [];
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      recorder.ondataavailable = (ev) => {
        if (ev.data.size > 0) chunks.push(ev.data);
      };
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        setEspVoiceBusy(true);
        setEspVoiceStatus('Đang xử lý bản ghi âm Micro sang PCM 8000 Hz 8-bit cho ESP32...');
        try {
          const blob = new Blob(chunks);
          const arrayBuf = await blob.arrayBuffer();
          const audioCtx = new AudioContext({ sampleRate: 8000 });
          const decoded = await audioCtx.decodeAudioData(arrayBuf);
          const channel = decoded.getChannelData(0);
          let peak = 0.01;
          for (let i = 0; i < channel.length; i++) {
            const a = Math.abs(channel[i]);
            if (a > peak) peak = a;
          }
          const pcm8kSamples: number[] = [];
          const maxSamples = Math.min(channel.length, 24000);
          for (let i = 0; i < maxSamples; i++) {
            const norm = (channel[i] / peak) * 0.92;
            pcm8kSamples.push(Math.max(-127, Math.min(127, Math.round(norm * 127))));
          }
          await audioCtx.close();

          const res = await fetch('/api/esp32/voice-header', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              phrase: `${espVoicePhrase} (Ghi âm Micro)`,
              pcm8kSamples,
            }),
          });
          const data = await res.json();
          setEspVoiceStatus(data.message || 'Đã lưu giọng thu âm vào voice_alert_pcm.h!');
        } catch {
          setEspVoiceStatus('Không thể giải mã âm thanh từ Micro trên trình duyệt này.');
        } finally {
          setEspVoiceBusy(false);
        }
      };
      recorder.start();
      setMicRecording(true);
      setEspVoiceStatus('Đang thu âm từ Micro (tối đa 3 giây)...');
      window.setTimeout(() => {
        if (recorder.state === 'recording') {
          recorder.stop();
          setMicRecording(false);
        }
      }, 3000);
    } catch {
      setEspVoiceStatus('Vui lòng cấp quyền Micro trên trình duyệt.');
    }
  };

  const handleFaultInjectionPacket = async (params: {
    posture: PostureState;
    advanceSec: number;
    robotMoving?: boolean;
    duplicateLast?: boolean;
    staleSequence?: boolean;
    simulateCrashBeforeFanout?: boolean;
  }) => {
    if (!currentDevice || !openSession) {
      setTechBanner('Chưa có phiên mở trên thiết bị robot01.');
      return;
    }
    const headers = await buildAuthHeaders();
    const nextTime = params.duplicateLast ? simClockMs : simClockMs + params.advanceSec * 1000;
    const nextSequence = params.duplicateLast
      ? simSeq
      : params.staleSequence
      ? Math.max(0, simSeq - 1)
      : simSeq + 1;
    const eventId = params.duplicateLast
      ? `sim-${currentDevice.device_id}-boot01-${String(simSeq).padStart(4, '0')}`
      : `sim-${currentDevice.device_id}-boot01-${String(nextSequence).padStart(4, '0')}`;

    const res = await fetch('/api/ingest/mqtt', {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        topic: `bugz/v1/devices/${currentDevice.device_id}/observations`,
        client_id: currentDevice.device_id,
        username: currentDevice.device_id,
        simulate_crash_before_fanout: Boolean(params.simulateCrashBeforeFanout),
        payload: {
          schema_version: 1,
          event_id: eventId,
          device_id: currentDevice.device_id,
          session_id: openSession.session_id,
          boot_id: 'boot01',
          sequence: nextSequence,
          type: 'posture.observed',
          observed_at: nextTime,
          posture: params.posture,
          ...(params.posture === 'bad' ? { posture_code: 'HEAD_FORWARD' } : {}),
          confidence: 0.94,
          robot_moving: Boolean(params.robotMoving),
          source: 'simulator',
        },
      }),
    });
    const data = await res.json();
    if (!params.duplicateLast && !params.staleSequence && res.ok) {
      setSimClockMs(nextTime);
      setSimSeq(nextSequence);
    }
    setTechBanner(`[${data.code || res.status}] ${data.message}`);
    await loadTechStatus();
  };

  const handleDrainWorker = async () => {
    if (!currentDevice) return;
    const headers = await buildAuthHeaders();
    const res = await fetch(`/api/robot/worker/${currentDevice.device_id}/drain`, {
      method: 'POST',
      headers,
    });
    const data = await res.json();
    setTechBanner(data.message);
    await loadTechStatus();
  };

  return (
    <div className="space-y-6">
      {/* 1. Chẩn đoán MQTT TLS Bridge & Quyền ACL SUBACK */}
      <div
        className={`rounded-xl border p-4 text-xs ${
          mqttBridgeStatus?.connected
            ? 'border-emerald-300 bg-emerald-50 text-emerald-950'
            : 'border-amber-300 bg-amber-50 text-amber-950'
        }`}
      >
        <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-start">
          <div className="flex items-start gap-2.5">
            {mqttBridgeStatus?.connected ? (
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-700 mt-0.5" />
            ) : (
              <AlertCircle className="h-4 w-4 shrink-0 text-amber-800 mt-0.5" />
            )}
            <div>
              <div className="font-bold">
                Trạng thái Kết nối MQTT TLS 8883 (`robot01` @{' '}
                {mqttBridgeStatus?.brokerUrl ||
                  'mqtts://d1a2b01a.ala.asia-southeast1.emqxsl.com:8883'}
                ):{' '}
                {mqttBridgeStatus?.connected ? 'ĐANG KẾT NỐI' : 'Đang kết nối lại...'}
              </div>
              {mqttBridgeStatus && (
                <div className="mt-2 flex flex-wrap gap-2 font-mono text-[11px]">
                  <span className="rounded bg-white/80 px-2 py-0.5 border border-emerald-200">
                    Client: {mqttBridgeStatus.clientId}
                  </span>
                  <span className="rounded bg-white/80 px-2 py-0.5 border border-emerald-200">
                    Gói nhận từ ESP32: {mqttBridgeStatus.receivedCount}
                  </span>
                  <span className="rounded bg-white/80 px-2 py-0.5 border border-emerald-200">
                    Lệnh gửi xuống ESP32: {mqttBridgeStatus.publishedCount}
                  </span>
                </div>
              )}

              {mqttBridgeStatus?.aclDeniedTopics && mqttBridgeStatus.aclDeniedTopics.length > 0 && (
                <div className="mt-3 rounded-xl border border-rose-300 bg-rose-50 p-3.5 text-rose-950 space-y-2">
                  <div className="font-bold text-rose-900">
                    Cảnh báo Kỹ thuật: EMQX Cloud đang chặn quyền SUBSCRIBE (SUBACK = 0x80) của tài khoản &quot;{mqttBridgeStatus.username}&quot;
                  </div>
                  <p className="text-[11px] leading-relaxed">
                    Các kênh bị từ chối quyền lắng nghe:{' '}
                    <code className="font-mono font-bold">
                      {mqttBridgeStatus.aclDeniedTopics.join(', ')}
                    </code>
                    . Hãy vào <strong>EMQX Cloud Console &rarr; Access Control &rarr; Authorization (ACL)</strong>, chỉnh quyền của user <code className="font-mono font-bold">robot01</code> trên topic <code className="font-mono font-bold">bugz/v1/devices/robot01/#</code> thành <strong>Pub/Sub (All)</strong>.
                  </p>
                  <button
                    type="button"
                    onClick={async () => {
                      await fetch('/api/mqtt/bridge/connect', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({}),
                      });
                      setTimeout(() => void loadTechStatus(), 800);
                    }}
                    className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg bg-rose-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-800"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    <span>Kết nối lại MQTT Bridge &amp; Kiểm tra lại SUBACK</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {mqttBridgeStatus && mqttBridgeStatus.recentPackets.length > 0 && (
          <div className="mt-3 rounded-lg border border-emerald-200 bg-white p-3 font-mono text-[11px] space-y-1">
            <div className="font-bold text-slate-800">
              Nhật ký Gói tin MQTT Thật Vừa Nhận / Gửi trên Broker (`robot01`):
            </div>
            {mqttBridgeStatus.recentPackets.slice(0, 5).map((pkt) => (
              <div
                key={pkt.id}
                className="flex flex-wrap items-center justify-between gap-2 text-slate-700 border-t border-slate-100 pt-1"
              >
                <span className="text-teal-800 font-semibold">
                  [{pkt.direction}] {pkt.topic}
                </span>
                <span className="truncate max-w-xl text-slate-600">{pkt.payloadPreview}</span>
                <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold">
                  {pkt.summary}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 2. Công cụ tạo file âm thanh C Header cho mạch loa ESP32 MAX98357A */}
      <div className="rounded-xl border border-teal-200 bg-teal-50/50 p-4 text-xs space-y-3">
        <div className="flex flex-col justify-between gap-2 lg:flex-row lg:items-center">
          <div>
            <div className="font-bold text-teal-950">
              Công cụ Xuất Mảng Âm thanh C Header (`voice_alert_pcm.h`) cho Mạch Loa ESP32 MAX98357A
            </div>
            <p className="mt-0.5 text-slate-600">
              Dành cho kỹ thuật viên nạp Firmware ESP-IDF: ghi âm giọng nói hoặc tạo giọng AI tiếng Việt sang chuẩn PCM 8kHz để nhúng vào vi điều khiển.
            </p>
          </div>
          <a
            href="/api/esp32/voice-header"
            download="voice_alert_pcm.h"
            className="inline-flex min-h-[38px] shrink-0 items-center gap-1.5 rounded-xl border border-teal-700 bg-white px-3 py-1.5 text-xs font-semibold text-teal-900 hover:bg-teal-50"
          >
            <span>Tải file voice_alert_pcm.h</span>
          </a>
        </div>

        <div className="grid grid-cols-1 gap-3 lg:grid-cols-12 items-center">
          <div className="lg:col-span-5">
            <input
              type="text"
              value={espVoicePhrase}
              onChange={(e) => setEspVoicePhrase(e.target.value)}
              placeholder="Nhập câu nhắc tiếng Việt cho loa ESP32..."
              className="w-full min-h-[40px] rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-900"
            />
          </div>
          <div className="lg:col-span-7 flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={espVoiceBusy}
              onClick={() => void handleToggleMicRecordForEsp32()}
              className={`inline-flex min-h-[40px] items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-semibold text-white ${
                micRecording ? 'bg-rose-600 hover:bg-rose-700' : 'bg-amber-600 hover:bg-amber-700'
              } disabled:opacity-60`}
            >
              <Volume2 className="h-4 w-4" />
              <span>
                {micRecording ? 'Đang thu âm... Bấm để lưu' : 'Ghi âm Micro -> Lưu voice_alert_pcm.h'}
              </span>
            </button>

            <button
              type="button"
              disabled={espVoiceBusy}
              onClick={() => void handleSynthesizeEsp32VoiceHeader()}
              className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl bg-teal-700 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-teal-800 disabled:opacity-60"
            >
              <Bot className="h-4 w-4" />
              <span>Tạo Giọng AI -&gt; Lưu voice_alert_pcm.h</span>
            </button>
          </div>
        </div>

        {espVoiceStatus && (
          <div className="rounded-lg border border-teal-300 bg-white p-2.5 font-medium text-teal-950">
            {espVoiceStatus}
          </div>
        )}
      </div>

      {/* 3. Bộ Kiểm thử Chống lỗi Giao thức MQTT (Fault-Injection Simulator) */}
      <div className="rounded-xl border border-amber-300 bg-amber-50/70 p-4 space-y-3 text-xs">
        <div className="font-bold text-amber-950">
          Bộ Giả lập Kiểm lỗi Giao thức MQTT (QoS1 Dedupe · Stale Sequence · Robot Moving · Crash Recovery)
        </div>
        {techBanner && (
          <div className="rounded-lg border border-amber-300 bg-white p-2.5 font-mono text-amber-950">
            {techBanner}
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() =>
              void handleFaultInjectionPacket({
                posture: 'bad',
                advanceSec: 4,
                robotMoving: true,
              })
            }
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 font-semibold text-slate-800 hover:bg-slate-100"
          >
            Giả lập Robot đang di chuyển (robot_moving=true)
          </button>
          <button
            type="button"
            onClick={() =>
              void handleFaultInjectionPacket({
                posture: 'bad',
                advanceSec: 0,
                duplicateLast: true,
              })
            }
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 font-semibold text-slate-800 hover:bg-slate-100"
          >
            Giả lập Gửi trùng gói QoS1 (Dedupe)
          </button>
          <button
            type="button"
            onClick={() =>
              void handleFaultInjectionPacket({
                posture: 'bad',
                advanceSec: 1,
                staleSequence: true,
              })
            }
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 font-semibold text-slate-800 hover:bg-slate-100"
          >
            Giả lập Gói cũ sai thứ tự (Stale Sequence)
          </button>
          <button
            type="button"
            onClick={() =>
              void handleFaultInjectionPacket({
                posture: 'good',
                advanceSec: 4,
                simulateCrashBeforeFanout: true,
              })
            }
            className="rounded-lg border border-amber-400 bg-white px-3 py-1.5 font-semibold text-amber-950 hover:bg-amber-100"
          >
            Giả lập Ngắt kết nối trước Fan-out
          </button>
          <button
            type="button"
            onClick={() => void handleDrainWorker()}
            className="rounded-lg bg-slate-800 px-3 py-1.5 font-semibold text-white hover:bg-slate-900"
          >
            Chạy Worker khôi phục hàng đợi
          </button>
        </div>
      </div>
    </div>
  );
};

export const RobotHistoryPage: React.FC = () => {
  const {
    uid,
    loading: authLoading,
    activeStudentId,
    setActiveStudentId,
    buildAuthHeaders,
  } = useAuth();

  const [studentId, setStudentId] = useState<string>(activeStudentId || '');
  const [students, setStudents] = useState<StudentView[]>([]);
  const [preset, setPreset] = useState<HistoryRangePreset>('year');
  const [severityFilter, setSeverityFilter] = useState<'all' | 'low' | 'medium' | 'high'>('all');
  const [sourceFilter, setSourceFilter] = useState<'all' | 'real' | 'simulator'>('all');
  const [customFromIso, setCustomFromIso] = useState<string>('2026-11-01T00:00');
  const [customToIso, setCustomToIso] = useState<string>('2026-11-05T23:59');

  const [windowLabel, setWindowLabel] = useState<string>('');
  const [summary, setSummary] = useState<{
    good_episode_count: number;
    bad_episode_count: number;
    bad_duration_ms?: number;
    good_duration_ms?: number;
    alert_count: number;
    session_count: number;
    completed_days_count: number;
  } | null>(null);
  const [sessionsInRange, setSessionsInRange] = useState<ExtendedSessionRecord[]>([]);
  const [episodes, setEpisodes] = useState<EpisodeLogRecord[]>([]);
  const [alertsPage, setAlertsPage] = useState<ExtendedAlertRecord[]>([]);
  const [cursorHistory, setCursorHistory] = useState<string[]>([]);
  const [currentCursor, setCurrentCursor] = useState<string>('');
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (activeStudentId && !studentId) {
      setStudentId(activeStudentId);
    }
  }, [activeStudentId, studentId]);

  const loadHistory = useCallback(
    async (cursorVal = '') => {
      if (!uid) return;
      try {
        setErrorMsg(null);
        const headers = await buildAuthHeaders();

        let targetStuId = studentId || activeStudentId;
        if (students.length === 0) {
          const bootRes = await fetch('/api/robot/bootstrap', { headers });
          const bootData = await bootRes.json();
          if (bootData.ok && bootData.students?.length > 0) {
            setStudents(bootData.students);
            if (
              !targetStuId ||
              !bootData.students.some((s: StudentView) => s.student_id === targetStuId)
            ) {
              targetStuId = bootData.students[0].student_id;
              setStudentId(targetStuId);
              setActiveStudentId(targetStuId);
            }
          }
        }

        const params = new URLSearchParams({
          ...(targetStuId ? { studentId: targetStuId } : {}),
          preset,
          severity: severityFilter,
          source: sourceFilter,
          pageSize: '5',
        });
        if (cursorVal) {
          params.set('cursor', cursorVal);
        }
        if (preset === 'custom') {
          const fromMs = Date.parse(`${customFromIso}:00+07:00`);
          const toMs = Date.parse(`${customToIso}:00+07:00`);
          if (Number.isFinite(fromMs)) params.set('fromUtcMs', String(fromMs));
          if (Number.isFinite(toMs)) params.set('toUtcMs', String(toMs));
        }

        const res = await fetch(`/api/robot/history?${params.toString()}`, { headers });
        const data = await res.json();
        if (!res.ok) {
          setErrorMsg(data.message || 'Không có quyền truy cập lịch sử của hồ sơ này.');
          setSummary(null);
          setSessionsInRange([]);
          setAlertsPage([]);
          setEpisodes([]);
          return;
        }

        setWindowLabel(data.window?.labelVi || '');
        setSummary(data.fullRangeSummary || null);
        setSessionsInRange(data.sessionsInRange || []);
        setEpisodes(data.episodesInRange || []);
        setAlertsPage(data.alertsPage || []);
        setNextCursor(data.nextCursor || null);
      } catch {
        setErrorMsg('Không thể kết nối máy chủ để tải lịch sử.');
      }
    },
    [
      activeStudentId,
      buildAuthHeaders,
      customFromIso,
      customToIso,
      preset,
      setActiveStudentId,
      severityFilter,
      sourceFilter,
      studentId,
      students.length,
      uid,
    ]
  );

  useEffect(() => {
    if (!uid) return;
    setCursorHistory([]);
    setCurrentCursor('');
    void loadHistory('');
  }, [loadHistory, uid]);

  if (!authLoading && !uid) {
    return <RobotLandingPage returnTo="/robot/history" />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <Link
          to="/robot"
          className="inline-flex min-h-[44px] items-center gap-2 text-sm font-semibold text-slate-700 hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Quay lại Robot đồng hành</span>
        </Link>
        <span className="text-xs text-slate-500">
          Hiển thị theo giờ Việt Nam
        </span>
      </div>

      <section className="rounded-3xl border border-teal-200 bg-gradient-to-br from-teal-900 via-teal-800 to-slate-900 p-6 sm:p-8 text-white shadow-sm">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-teal-400/30 bg-teal-500/20 px-3 py-1 text-xs font-semibold text-teal-100">
              <span>Báo cáo &amp; Nhật ký Học tập Cá nhân</span>
            </div>
            <h1 className="mt-2 text-2xl sm:text-3xl font-extrabold text-white">
              Lịch sử Phiên học, Đợt tư thế &amp; Lời nhắc của bạn
            </h1>
            {windowLabel && (
              <p className="mt-1 text-xs text-teal-100/90">
                Khoảng thời gian đang xem: <strong className="text-amber-300">{windowLabel}</strong>
              </p>
            )}
          </div>

          {students.length > 0 && (
            <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-white/15 bg-white/10 px-4 py-2.5 backdrop-blur-xs">
              <label htmlFor="history-student-select" className="text-xs font-semibold text-teal-100">
                Hồ sơ người học:
              </label>
              <select
                id="history-student-select"
                value={studentId}
                onChange={(e) => {
                  setStudentId(e.target.value);
                  setActiveStudentId(e.target.value);
                }}
                className="min-h-[40px] rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-900"
              >
                {students.map((s) => (
                  <option key={s.student_id} value={s.student_id}>
                    {s.display_name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 space-y-5 shadow-2xs">

        {/* Time Range Filter Controls */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div
            role="group"
            aria-label="Phạm vi thời gian"
            className="inline-flex flex-wrap items-center gap-1 rounded-xl bg-slate-100 p-1"
          >
            {[
              { id: 'hour', label: '60 phút qua' },
              { id: 'day', label: 'Hôm nay' },
              { id: 'week', label: 'Tuần này' },
              { id: 'month', label: 'Tháng này' },
              { id: 'year', label: 'Năm nay' },
              { id: 'custom', label: 'Tùy chọn ngày' },
            ].map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => setPreset(r.id as HistoryRangePreset)}
                className={`min-h-[38px] rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap ${
                  preset === r.id
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              aria-label="Lọc mức nhắc"
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value as typeof severityFilter)}
              className="min-h-[38px] rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-800"
            >
              <option value="all">Tất cả mức nhắc</option>
              <option value="low">Nhắc nhẹ</option>
              <option value="medium">Nhắc lưu ý</option>
              <option value="high">Nhắc cần chỉnh ngay</option>
            </select>

            <select
              aria-label="Lọc nguồn dữ liệu"
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value as typeof sourceFilter)}
              className="min-h-[38px] rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-800"
            >
              <option value="all">Tất cả dữ liệu</option>
              <option value="real">Từ thiết bị Robot</option>
              <option value="simulator">Từ chế độ mô phỏng</option>
            </select>
          </div>
        </div>

        {preset === 'custom' && (
          <div className="grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3.5 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-slate-700">
                Từ thời điểm
              </label>
              <input
                type="datetime-local"
                value={customFromIso}
                onChange={(e) => setCustomFromIso(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700">
                Đến thời điểm
              </label>
              <input
                type="datetime-local"
                value={customToIso}
                onChange={(e) => setCustomToIso(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs"
              />
            </div>
          </div>
        )}

        {errorMsg ? (
          <div className="rounded-xl border border-rose-300 bg-rose-50 p-4 text-xs font-medium text-rose-950">
            {errorMsg}
          </div>
        ) : summary ? (
          <>
            {/* Full-range summary counters */}
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-6">
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4">
                <div className="text-xs text-emerald-900">Tổng đợt ngồi đúng</div>
                <div className="mt-1 text-2xl font-bold tabular-nums text-emerald-800">
                  {summary.good_episode_count}
                </div>
                <div className="mt-0.5 text-[11px] text-emerald-700">Đợt ngồi thẳng ổn định</div>
              </div>

              <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4">
                <div className="text-xs text-amber-900">Tổng đợt cần chỉnh</div>
                <div className="mt-1 text-2xl font-bold tabular-nums text-amber-800">
                  {summary.bad_episode_count}
                </div>
                <div className="mt-0.5 text-[11px] text-amber-800">Đợt ngồi chưa đúng</div>
              </div>

              <div className="rounded-xl border border-rose-200 bg-rose-50/70 p-4">
                <div className="text-xs font-semibold text-rose-900">Thời gian ngồi chưa đúng</div>
                <div className="mt-1 text-base font-bold tabular-nums text-rose-950">
                  {formatDurationVi(summary.bad_duration_ms)}
                </div>
                <div className="mt-0.5 text-[11px] text-rose-800">
                  Tổng thời gian lưu ý
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs text-slate-500">Tổng số lời nhắc</div>
                <div className="mt-1 text-2xl font-bold tabular-nums text-rose-800">
                  {summary.alert_count}
                </div>
                <div className="mt-0.5 text-[11px] text-slate-500">Lần nhắc tư thế</div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs text-slate-500">Số phiên học</div>
                <div className="mt-1 text-2xl font-bold tabular-nums text-slate-900">
                  {summary.session_count}
                </div>
                <div className="mt-0.5 text-[11px] text-slate-500">Phiên học của bạn</div>
              </div>

              <div className="rounded-xl border border-teal-200 bg-teal-50/50 p-4">
                <div className="text-xs text-teal-900">Thực hành 28 ngày</div>
                <div className="mt-1 text-2xl font-bold tabular-nums text-teal-800">
                  {summary.completed_days_count} / 28
                </div>
                <div className="mt-0.5 text-[11px] text-teal-700">Ngày đã nhận huy chương</div>
              </div>
            </div>

            {/* Danh sách Phiên học của riêng user trong khoảng thời gian đã chọn */}
            <div className="space-y-3 pt-2">
              <h2 className="text-sm font-bold text-slate-900">
                Danh sách Phiên học của bạn trong khoảng thời gian đã chọn
              </h2>
              {sessionsInRange.length === 0 ? (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-600">
                  Chưa có phiên học nào trong khoảng thời gian này.
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-slate-200">
                  <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
                    <thead className="bg-slate-50 font-semibold text-slate-700">
                      <tr>
                        <th className="px-3.5 py-2.5">Thời gian bắt đầu</th>
                        <th className="px-3.5 py-2.5">Trạng thái</th>
                        <th className="px-3.5 py-2.5">Số đợt ngồi đúng</th>
                        <th className="px-3.5 py-2.5">Số đợt cần chỉnh</th>
                        <th className="px-3.5 py-2.5 text-rose-900">Thời gian ngồi chưa đúng</th>
                        <th className="px-3.5 py-2.5">Số lần nhắc nhở</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {sessionsInRange.slice(0, 10).map((sess) => (
                        <tr key={`${sess.device_id}-${sess.session_id}`}>
                          <td className="px-3.5 py-2.5 font-medium text-slate-900">
                            {new Date(sess.started_at).toLocaleString('vi-VN', {
                              timeZone: 'Asia/Ho_Chi_Minh',
                            })}
                          </td>
                          <td className="px-3.5 py-2.5">
                            {sess.ended_at ? (
                              <span className="rounded bg-slate-100 px-2 py-0.5 font-semibold text-slate-700">
                                Đã hoàn thành
                              </span>
                            ) : (
                              <span className="rounded bg-emerald-100 px-2 py-0.5 font-semibold text-emerald-900">
                                Đang diễn ra
                              </span>
                            )}
                          </td>
                          <td className="px-3.5 py-2.5 font-bold tabular-nums text-emerald-800">
                            {sess.good_count ?? 0} đợt
                          </td>
                          <td className="px-3.5 py-2.5 font-bold tabular-nums text-amber-800">
                            {sess.bad_count ?? 0} đợt
                          </td>
                          <td className="px-3.5 py-2.5 font-bold tabular-nums text-rose-800">
                            {formatDurationVi(sess.bad_duration_ms)}
                          </td>
                          <td className="px-3.5 py-2.5 font-bold tabular-nums text-slate-800">
                            {sess.alert_count ?? 0} lần nhắc
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Paginated Alerts List */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-slate-900">
                  Danh sách Lời nhắc Tư thế của bạn trong khoảng thời gian đã chọn
                </h2>
              </div>

              {alertsPage.length === 0 ? (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-center text-xs text-slate-600">
                  <Bot className="mx-auto h-7 w-7 text-slate-400 mb-1.5" />
                  Không có lời nhắc nào trong khoảng thời gian đang chọn.
                </div>
              ) : (
                <div className="divide-y divide-slate-100 rounded-xl border border-slate-200">
                  {alertsPage.map((a) => (
                    <div
                      key={a.alert_id}
                      className="flex flex-col justify-between gap-2 p-4 sm:flex-row sm:items-center"
                    >
                      <div>
                        <div className="flex flex-wrap items-center gap-2 text-xs">
                          <span className="font-semibold text-teal-900">
                            {new Date(a.created_at).toLocaleString('vi-VN', {
                              timeZone: 'Asia/Ho_Chi_Minh',
                            })}
                          </span>
                          <span className="rounded bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-900">
                            {a.severity === 'high'
                              ? 'Cần chỉnh ngay'
                              : a.severity === 'medium'
                              ? 'Nhắc lưu ý'
                              : 'Nhắc nhẹ'}
                          </span>
                        </div>
                        <p className="mt-1 text-sm font-medium text-slate-900">“{a.message}”</p>
                      </div>
                      <Link
                        to={`/alerts/${a.alert_id}`}
                        className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-50"
                      >
                        <span>Xem chi tiết</span>
                      </Link>
                    </div>
                  ))}
                </div>
              )}

              {/* Pagination Controls */}
              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  disabled={cursorHistory.length === 0}
                  onClick={() => {
                    const prevList = [...cursorHistory];
                    const prevCursor = prevList.pop() || '';
                    setCursorHistory(prevList);
                    setCurrentCursor(prevCursor);
                    void loadHistory(prevCursor);
                  }}
                  className="min-h-[38px] rounded-lg border border-slate-300 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 disabled:opacity-40"
                >
                  &larr; Trang trước
                </button>

                <button
                  type="button"
                  disabled={!nextCursor}
                  onClick={() => {
                    if (!nextCursor) return;
                    setCursorHistory((prev) => [...prev, currentCursor]);
                    setCurrentCursor(nextCursor);
                    void loadHistory(nextCursor);
                  }}
                  className="min-h-[38px] rounded-lg border border-slate-300 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 disabled:opacity-40"
                >
                  Trang tiếp theo &rarr;
                </button>
              </div>
            </div>

            {/* Episodes Log in Range */}
            {episodes.length > 0 && (
              <div className="space-y-2 pt-3 border-t border-slate-100">
                <h3 className="text-xs font-bold text-slate-900">
                  Các đợt tư thế được ghi nhận gần đây:
                </h3>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {episodes.slice(0, 6).map((ep) => (
                    <div
                      key={ep.episode_id}
                      className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs flex items-center justify-between"
                    >
                      <div>
                        <span className="font-semibold text-slate-900">
                          {new Date(ep.started_at).toLocaleString('vi-VN', {
                            timeZone: 'Asia/Ho_Chi_Minh',
                          })}
                        </span>
                      </div>
                      <span
                        className={`rounded-md px-2.5 py-0.5 font-bold ${
                          ep.state === 'good'
                            ? 'bg-emerald-100 text-emerald-900'
                            : 'bg-amber-100 text-amber-900'
                        }`}
                      >
                        {ep.state === 'good' ? 'Ngồi thẳng đẹp' : 'Cần chỉnh tư thế'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : null}
      </section>
    </div>
  );
};

export const AlertDetailPage: React.FC = () => {
  const { alertId } = useParams<{ alertId: string }>();
  const { uid, email, buildAuthHeaders, savePendingReturnTo } = useAuth();

  const [authStatus, setAuthStatus] = useState<
    'loading' | 'unauthenticated_return_to' | 'forbidden_cross_family' | 'not_found' | 'authorized'
  >('loading');
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [alertRecord, setAlertRecord] = useState<
    | (ExtendedAlertRecord & {
        student_display_name: string;
        device_name: string;
        is_read_by_guardian: boolean;
        is_read_by_me: boolean;
      })
    | null
  >(null);
  const [, setAlertJobs] = useState<NotificationJobRecord[]>([]);
  const [captureView, setCaptureView] = useState<{
    ok: boolean;
    status: number;
    message: string;
    previewUri?: string;
    storagePath?: string;
    expiresAt?: number;
  } | null>(null);
  const [readStatusNotice, setReadStatusNotice] = useState<string | null>(null);

  const loadAlertAndCapture = useCallback(async () => {
    if (!alertId) return;
    const targetReturnPath = `/alerts/${alertId}`;

    if (!uid) {
      savePendingReturnTo(targetReturnPath);
      setAuthStatus('unauthenticated_return_to');
      setStatusMessage(
        'Vui lòng đăng nhập tài khoản để xem chi tiết lời nhắc tư thế và hình ảnh góc học tập.'
      );
      setAlertRecord(null);
      setCaptureView(null);
      return;
    }

    try {
      setAuthStatus('loading');
      const headers = buildAuthHeaders();
      const res = await fetch(`/api/alerts/${encodeURIComponent(alertId)}`, { headers });
      const data = await res.json();

      if (res.status === 401) {
        savePendingReturnTo(targetReturnPath);
        setAuthStatus('unauthenticated_return_to');
        setStatusMessage(data.message || 'Vui lòng đăng nhập để xem chi tiết lời nhắc.');
        return;
      }

      if (res.status === 403) {
        setAuthStatus('forbidden_cross_family');
        setStatusMessage(
          'Tài khoản hiện tại không có quyền xem lời nhắc của hồ sơ học sinh khác.'
        );
        setAlertRecord(null);
        setCaptureView(null);
        return;
      }

      if (!res.ok || !data.alert) {
        setAuthStatus('not_found');
        setStatusMessage(data.message || 'Không tìm thấy bản ghi lời nhắc này.');
        return;
      }

      setAuthStatus('authorized');
      setAlertRecord(data.alert);
      setAlertJobs(Array.isArray(data.jobs) ? data.jobs : []);

      if (data.alert.image_id) {
        const capRes = await fetch(
          `/api/captures/${encodeURIComponent(data.alert.image_id)}?reason=${encodeURIComponent(
            'Xem chi tiết lời nhắc tư thế'
          )}`,
          { headers }
        );
        const capData = await capRes.json();
        setCaptureView({
          ok: capRes.ok,
          status: capRes.status,
          message: capData.message,
          previewUri: capData.signedViewDescriptor?.preview_svg_data_uri,
          storagePath: capData.signedViewDescriptor?.storage_path,
          expiresAt: capData.signedViewDescriptor?.expires_at,
        });
      } else {
        setCaptureView(null);
      }
    } catch {
      setAuthStatus('not_found');
      setStatusMessage('Không thể kết nối máy chủ để tải chi tiết lời nhắc.');
    }
  }, [alertId, buildAuthHeaders, savePendingReturnTo, uid]);

  useEffect(() => {
    void loadAlertAndCapture();
  }, [loadAlertAndCapture]);

  const handleMarkRead = async () => {
    if (!alertId) return;
    const headers = buildAuthHeaders();
    const res = await fetch(`/api/alerts/${encodeURIComponent(alertId)}/read`, {
      method: 'POST',
      headers,
    });
    const data = await res.json();
    setReadStatusNotice(res.ok ? 'Đã đánh dấu đã xem lời nhắc này.' : data.message);
    await loadAlertAndCapture();
  };

  const handleReplayAlertVoice = async () => {
    const text =
      alertRecord?.message ||
      'Tư thế chưa phù hợp — Mình thả lỏng vai rồi chỉnh chỗ ngồi ngay ngắn nhé!';
    setReadStatusNotice('Đang phát lại lời nhắc bằng giọng đọc AI...');
    const res = await speakVietnameseNeuralVoice({
      text,
      playChime: true,
    });
    if (res.ok) {
      setReadStatusNotice(`Đã phát lại lời nhắc: “${text}”`);
    } else {
      setReadStatusNotice(`Lời nhắc: “${text}”`);
    }
  };

  if (authStatus === 'unauthenticated_return_to') {
    const returnToPath = `/alerts/${alertId || 'alert-a-001'}`;
    return (
      <div className="space-y-6">
        <section className="rounded-2xl border border-amber-300 bg-amber-50 p-6 space-y-4 text-amber-950">
          <div className="text-xs font-bold uppercase tracking-wider text-amber-900">
            Bảo mật thông tin người học
          </div>
          <h1 className="text-2xl font-bold">
            Vui lòng Đăng nhập để Xem Chi tiết Lời nhắc
          </h1>
          <p className="text-sm leading-relaxed">{statusMessage}</p>
          <div className="flex flex-wrap gap-3 pt-1">
            <Link
              to={`/login?returnTo=${encodeURIComponent(returnToPath)}`}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-teal-800 px-5 py-2.5 text-xs font-semibold text-white hover:bg-teal-900"
            >
              <Lock className="h-4 w-4" />
              <span>Đăng nhập ngay</span>
            </Link>
            <Link
              to="/robot"
              className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-amber-400 bg-white px-4 py-2.5 text-xs font-semibold text-amber-950 hover:bg-amber-100"
            >
              <span>Quay lại trang Robot</span>
            </Link>
          </div>
        </section>
      </div>
    );
  }

  if (authStatus === 'forbidden_cross_family') {
    return (
      <div className="space-y-6">
        <section className="rounded-2xl border border-rose-300 bg-rose-50 p-6 space-y-4 text-rose-950">
          <div className="text-xs font-bold uppercase tracking-wider text-rose-900">
            Không có quyền truy cập
          </div>
          <h1 className="text-2xl font-bold">
            Tài khoản ({email}) không có quyền xem lời nhắc này
          </h1>
          <p className="text-sm leading-relaxed">{statusMessage}</p>
          <div className="flex flex-wrap gap-3 pt-1">
            <Link
              to={`/login?returnTo=${encodeURIComponent(`/alerts/${alertId || 'alert-a-001'}`)}`}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-rose-800 px-4 py-2 text-xs font-semibold text-white hover:bg-rose-900"
            >
              <span>Đổi tài khoản đăng nhập</span>
            </Link>
            <Link
              to="/robot"
              className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-rose-300 bg-white px-4 py-2 text-xs font-semibold text-rose-900 hover:bg-rose-100"
            >
              <span>Quay lại Robot đồng hành</span>
            </Link>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Link
        to="/robot"
        className="inline-flex min-h-[44px] items-center gap-2 text-sm font-semibold text-slate-700 hover:text-slate-900"
      >
        <ArrowLeft className="h-4 w-4" />
        <span>Quay lại Robot đồng hành</span>
      </Link>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs font-semibold text-teal-800">
              Chi tiết lời nhắc tư thế
            </div>
            <h1 className="mt-1 text-2xl font-bold text-slate-900">
              Lời nhắc Chỉnh Tư thế &amp; Hình ảnh Góc học tập
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleReplayAlertVoice}
              className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50"
            >
              <Volume2 className="h-4 w-4 text-teal-700" />
              <span>Nghe lại lời nhắc</span>
            </button>

            <button
              type="button"
              onClick={() => void handleMarkRead()}
              className="inline-flex min-h-[40px] items-center gap-2 rounded-xl bg-teal-700 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-800"
            >
              <CheckCircle2 className="h-4 w-4" />
              <span>
                {alertRecord?.is_read_by_guardian ? 'Đã xem' : 'Đánh dấu đã xem'}
              </span>
            </button>
          </div>
        </div>

        {readStatusNotice && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-medium text-emerald-950">
            {readStatusNotice}
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-slate-200 p-4 space-y-2.5 text-xs">
            <div className="font-bold text-slate-900">
              Thông tin Lời nhắc
            </div>
            <div className="text-slate-600">
              Hồ sơ người học:{' '}
              <strong className="text-teal-900">
                {alertRecord?.student_display_name || 'Bé Minh'}
              </strong>
            </div>
            <div className="text-slate-600">
              Thiết bị đồng hành:{' '}
              <strong className="text-slate-900">
                {alertRecord?.device_name || 'Robot Đồng Hành 01'}
              </strong>
            </div>
            {alertRecord?.created_at && (
              <div className="text-slate-600">
                Thời gian nhắc:{' '}
                <strong className="text-slate-900">
                  {new Date(alertRecord.created_at).toLocaleString('vi-VN', {
                    timeZone: 'Asia/Ho_Chi_Minh',
                  })}
                </strong>
              </div>
            )}
            <div className="rounded-lg bg-teal-50/70 border border-teal-200 p-3 text-slate-800">
              <div className="text-[11px] font-semibold text-teal-800">Nội dung lời nhắc:</div>
              <div className="mt-1 text-sm font-bold text-teal-950">
                “{alertRecord?.message || 'Tư thế chưa phù hợp — Mình thả lỏng vai rồi chỉnh chỗ ngồi ngay ngắn nhé!'}”
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 p-4 space-y-2 text-xs">
            <div className="font-bold text-slate-900">
              Hình ảnh Góc học tập
            </div>
            {alertRecord?.image_id ? (
              captureView ? (
                <div className="space-y-2">
                  {captureView.previewUri && (
                    <img
                      src={captureView.previewUri}
                      alt="Hình ảnh góc học tập"
                      className="w-full rounded-xl border border-slate-200"
                    />
                  )}
                </div>
              ) : (
                <div className="text-slate-500">Đang tải hình ảnh góc học tập...</div>
              )
            ) : (
              <div className="text-slate-600">
                Lời nhắc này không kèm ảnh chụp góc học tập.
              </div>
            )}
          </div>
        </div>

        <div className="border-t border-slate-100 pt-4">
          <Link
            to="/learn/days/1"
            className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-teal-700 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-800"
          >
            Xem bài học gợi ý (Ngày 1: Ngồi thẳng nào)
          </Link>
        </div>
      </section>
    </div>
  );
};
