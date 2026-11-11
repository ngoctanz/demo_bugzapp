import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AlertCircle, Camera, Eye, EyeOff, PowerOff } from 'lucide-react';
import type { ThreeTierPostureOutput } from '../lib/frontPostureEngine';
import {
  ensurePersistentVideoDom,
  ensurePoseLandmarkerReady,
  globalRt,
  notifyUiListeners,
  startGlobalLoops,
  stopGlobalHardwareCamera,
  stopMediaStreamTracks,
  subscribePostureMonitor,
  syncVideoDomPlacement,
} from './posture/postureMonitorRuntime';
import { PostureCameraToolbar } from './posture/PostureCameraToolbar';
import { PostureCameraViewportHud } from './posture/PostureCameraViewportHud';
import { PostureDynamicIsland } from './posture/PostureDynamicIsland';

export { PostureDynamicIsland };

export interface LivePostureCameraPanelProps {
  deviceId: string;
  openSessionId: string | null;
  buildAuthHeaders: () => Promise<Record<string, string>> | Record<string, string>;
  onObservationSynced?: () => void;
  onSpeakReminder?: (text: string) => void;
  onLiveStatusChange?: (info: {
    monitoringActive: boolean;
    personDetected: boolean;
    output: ThreeTierPostureOutput;
  }) => void;
}

export const LivePostureCameraPanel: React.FC<LivePostureCameraPanelProps> = ({
  deviceId,
  openSessionId,
  buildAuthHeaders,
  onObservationSynced,
  onSpeakReminder,
  onLiveStatusChange,
}) => {
  const videoHostRef = useRef<HTMLDivElement | null>(null);
  const [, setTick] = useState(0);
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [cameraDevices, setCameraDevices] = useState<MediaDeviceInfo[]>([]);

  // Cập nhật context cho bộ giám sát toàn cục
  useEffect(() => {
    globalRt.deviceId = deviceId;
    globalRt.openSessionId = openSessionId;
    globalRt.buildAuthHeaders = buildAuthHeaders;
    globalRt.onObservationSynced = onObservationSynced;
    globalRt.onSpeakReminder = onSpeakReminder;
    globalRt.onLiveStatusChange = onLiveStatusChange;

    return () => {
      // Khi chuyển sang trang khác (/learn, /games...), giải phóng callback của trang cũ
      // nhưng VẪN GIỮ NGUYÊN luồng Camera và vòng lặp AI chạy nền!
      if (globalRt.onSpeakReminder === onSpeakReminder) {
        globalRt.onSpeakReminder = undefined;
      }
      if (globalRt.onLiveStatusChange === onLiveStatusChange) {
        globalRt.onLiveStatusChange = undefined;
      }
    };
  }, [
    buildAuthHeaders,
    deviceId,
    onLiveStatusChange,
    onObservationSynced,
    onSpeakReminder,
    openSessionId,
  ]);

  const enumerateCameras = useCallback(async () => {
    try {
      if (!navigator.mediaDevices?.enumerateDevices) return;
      const list = await navigator.mediaDevices.enumerateDevices();
      setCameraDevices(list.filter((d) => d.kind === 'videoinput'));
    } catch {
      // ignore
    }
  }, []);

  // Dùng useLayoutEffect để di chuyển <video> về parkingEl TRƯỚC KHI React tháo DOM trang /robot,
  // ngăn trình duyệt tự động pause <video> khi chuyển sang các trang khác (/learn, /games...)
  useLayoutEffect(() => {
    globalRt.activeHostEl = videoHostRef.current;
    syncVideoDomPlacement();

    return () => {
      if (globalRt.activeHostEl === videoHostRef.current) {
        globalRt.activeHostEl = null;
        syncVideoDomPlacement();
      }
    };
  }, []);

  // Đăng ký nhận cập nhật UI
  useEffect(() => {
    const unsubscribe = subscribePostureMonitor(() => setTick((t) => t + 1));
    void ensurePoseLandmarkerReady();
    if (globalRt.monitoringActive) {
      void enumerateCameras();
    }
    return unsubscribe;
  }, [enumerateCameras]);

  const startCameraAndMonitoring = useCallback(
    async (preferredDeviceId?: string) => {
      setPermissionError(null);
      const targetCamId = preferredDeviceId ?? globalRt.selectedCameraId;
      globalRt.selectedCameraId = targetCamId;

      globalRt.cameraSessionSeq += 1;
      const mySeq = globalRt.cameraSessionSeq;
      globalRt.isStartingCamera = true;
      notifyUiListeners();

      try {
        const constraints: MediaStreamConstraints = {
          video:
            targetCamId && targetCamId !== 'user'
              ? {
                  deviceId: { exact: targetCamId },
                  width: { ideal: 640 },
                  height: { ideal: 360 },
                  frameRate: { ideal: 30 },
                }
              : {
                  facingMode: 'user',
                  width: { ideal: 640 },
                  height: { ideal: 360 },
                  frameRate: { ideal: 30 },
                },
          audio: false,
        };

        // Giải phóng mọi luồng cũ trước khi yêu cầu phần cứng Camera mới
        globalRt.activeStreams.forEach((s) => stopMediaStreamTracks(s));
        globalRt.activeStreams.clear();
        if (globalRt.stream) {
          stopMediaStreamTracks(globalRt.stream);
          globalRt.stream = null;
        }

        const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
        globalRt.activeStreams.add(mediaStream);

        // Nếu người dùng đã bấm "Tắt hẳn Camera" hoặc gọi phiên mới trong lúc đang mở phần cứng
        if (mySeq !== globalRt.cameraSessionSeq) {
          stopMediaStreamTracks(mediaStream);
          globalRt.activeStreams.delete(mediaStream);
          return;
        }

        // Dọn dẹp mọi stream khác ngoài mediaStream hiện tại
        globalRt.activeStreams.forEach((s) => {
          if (s !== mediaStream) {
            stopMediaStreamTracks(s);
            globalRt.activeStreams.delete(s);
          }
        });

        globalRt.stream = mediaStream;

        const vid = ensurePersistentVideoDom();
        vid.srcObject = mediaStream;
        await vid.play();

        if (mySeq !== globalRt.cameraSessionSeq) {
          stopMediaStreamTracks(mediaStream);
          globalRt.activeStreams.delete(mediaStream);
          return;
        }

        globalRt.isStartingCamera = false;
        globalRt.monitoringActive = true;
        globalRt.viewVisible = true;
        globalRt.smoothedWorldPts = null;
        globalRt.targetImgPts = null;
        globalRt.smoothedImgPts = null;
        globalRt.badStartMs = null;
        globalRt.goodRecoveryStartMs = null;
        globalRt.badAccumulatedSec = 0;
        globalRt.lastFrameEvalMs = 0;
        globalRt.lastAiInferMs = 0;
        globalRt.lastCanvasDrawMs = 0;
        globalRt.lastVideoCurrentTime = -1;
        globalRt.prevRawSeverity = 0;
        globalRt.peakRawSeverity = 0;

        syncVideoDomPlacement();
        startGlobalLoops();
        notifyUiListeners();
        void enumerateCameras();
        void ensurePoseLandmarkerReady();
      } catch {
        if (mySeq === globalRt.cameraSessionSeq) {
          globalRt.isStartingCamera = false;
          notifyUiListeners();
        }
        setPermissionError(
          'Vui lòng cấp quyền Camera trên trình duyệt để bắt đầu giám sát tư thế ngồi học.'
        );
      }
    },
    [enumerateCameras]
  );

  const handleToggleCameraView = () => {
    if (!globalRt.monitoringActive) {
      void startCameraAndMonitoring();
      return;
    }
    globalRt.viewVisible = !globalRt.viewVisible;
    syncVideoDomPlacement();
    notifyUiListeners();
  };

  const {
    monitoringActive,
    viewVisible,
    showSkeletonHud,
    aiReady,
    selectedCameraId,
    isCalibrated,
    isStartingCamera,
    calibratingCountdown,
    personDetected,
    output,
  } = globalRt;

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-6 shadow-xs space-y-4">
      <PostureCameraToolbar
        monitoringActive={monitoringActive}
        viewVisible={viewVisible}
        showSkeletonHud={showSkeletonHud}
        isCalibrated={isCalibrated}
        isStartingCamera={isStartingCamera}
        selectedCameraId={selectedCameraId}
        cameraDevices={cameraDevices}
        onSelectCamera={(id) => void startCameraAndMonitoring(id)}
        onToggleCameraView={handleToggleCameraView}
      />

      {permissionError && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-3.5 text-xs font-medium text-amber-950 flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0 text-amber-800" />
          <span>{permissionError}</span>
        </div>
      )}

      {/* KHUNG VIEWPORT CAMERA BASIC, DỊU MẮT THEO ẢNH MẪU */}
      <div
        ref={videoHostRef}
        className={
          monitoringActive && viewVisible
            ? 'relative mx-auto w-full max-w-4xl overflow-hidden rounded-[24px] border-4 border-slate-200/90 bg-slate-950 aspect-video flex items-center justify-center shadow-lg'
            : 'hidden'
        }
      >
        <PostureCameraViewportHud
          monitoringActive={monitoringActive}
          viewVisible={viewVisible}
          aiReady={aiReady}
          personDetected={personDetected}
          showSkeletonHud={showSkeletonHud}
          calibratingCountdown={calibratingCountdown}
          output={output}
        />
      </div>

      {/* Khung chờ khi chưa bật Camera */}
      {!monitoringActive && (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 py-12 px-6 text-center space-y-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
            <Camera className="h-5 w-5" />
          </div>
          <div className="space-y-1 max-w-md">
            <div className="text-sm font-bold text-slate-900">
              Bấm “Bật Camera” để bắt đầu giám sát tư thế ngồi học
            </div>
            <p className="text-xs leading-relaxed text-slate-500">
              Khi đã bật, bạn có thể chuyển sang các mục khác mà Camera vẫn tiếp tục chạy nền cùng thông báo Dynamic Island.
            </p>
          </div>
          <button
            type="button"
            disabled={isStartingCamera}
            onClick={() => void startCameraAndMonitoring()}
            className="inline-flex min-h-[40px] items-center gap-2 rounded-xl bg-slate-900 px-5 py-2 text-xs font-semibold text-white hover:bg-slate-800 transition-colors disabled:opacity-60"
          >
            <Camera className="h-4 w-4" />
            <span>{isStartingCamera ? 'Đang mở Camera...' : 'Bật Camera'}</span>
          </button>
        </div>
      )}

      {/* Khung thông báo gọn khi đã ẩn khung hình (Giám sát ngầm) */}
      {monitoringActive && !viewVisible && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white border border-slate-200 text-slate-700">
              <EyeOff className="h-4 w-4" />
            </div>
            <div>
              <div className="text-xs font-bold text-slate-900">
                Đang giám sát ngầm · {personDetected ? output.primary_label_vi : 'Đang theo dõi'}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {personDetected
                  ? output.advice_vi
                  : 'Camera vẫn đang theo dõi tư thế trong nền.'}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleToggleCameraView}
              className="inline-flex min-h-[36px] items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-100 transition-colors"
            >
              <Eye className="h-3.5 w-3.5" />
              <span>Hiện lại Camera</span>
            </button>
            <button
              type="button"
              onClick={stopGlobalHardwareCamera}
              className="inline-flex min-h-[36px] items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-1.5 text-xs font-bold text-rose-700 hover:border-rose-300 hover:bg-rose-100 transition-colors"
            >
              <PowerOff className="h-3.5 w-3.5" />
              <span>Tắt hẳn Camera</span>
            </button>
          </div>
        </div>
      )}
    </section>
  );
};
