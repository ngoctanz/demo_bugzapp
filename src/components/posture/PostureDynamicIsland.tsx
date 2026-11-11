import React, { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AlertCircle, AlertTriangle, Camera } from 'lucide-react';
import { FAULT_LABELS_VI } from '../../lib/frontPostureEngine';
import {
  globalRt,
  notifyUiListeners,
  subscribePostureMonitor,
  syncVideoDomPlacement,
} from './postureMonitorRuntime';

type IslandMode = 'NO_PERSON' | 'GOOD' | 'WARNING' | 'BAD';

interface StabilizedIslandSnapshot {
  mode: IslandMode;
  primaryLabel: string;
  advice: string;
  score: number;
  durationSec: number;
  activeFaults: string[];
}

export const PostureDynamicIsland: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [, setTick] = useState(0);
  const [showGoodPillBriefly, setShowGoodPillBriefly] = useState(false);

  const modeCommitMsRef = useRef<number>(0);
  const textCommitMsRef = useRef<number>(0);
  const snapshotRef = useRef<StabilizedIslandSnapshot>({
    mode: 'GOOD',
    primaryLabel: 'Ngồi thẳng chuẩn',
    advice: 'Tư thế ngồi chuẩn! Hãy duy trì và thả lỏng hai vai.',
    score: 100,
    durationSec: 0,
    activeFaults: [],
  });

  useEffect(() => {
    return subscribePostureMonitor(() => setTick((t) => t + 1));
  }, []);

  const { monitoringActive, viewVisible, personDetected, output } = globalRt;

  const rawMode: IslandMode = !personDetected ? 'NO_PERSON' : output.status;
  const nowMs = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const curSnap = snapshotRef.current;

  // Quy tắc chuyển trạng thái mượt mà (chống nhảy nhấp nháy):
  // - Tăng cấp cảnh báo (GOOD -> WARNING, WARNING -> BAD): chuyển ngay để phản hồi kịp thời
  // - Giảm cấp cảnh báo (BAD -> WARNING, WARNING -> GOOD) hoặc đổi qua lại: giữ tối thiểu 1150ms
  const severityRank: Record<IslandMode, number> = {
    GOOD: 0,
    NO_PERSON: 1,
    WARNING: 2,
    BAD: 3,
  };
  const isEscalating = severityRank[rawMode] > severityRank[curSnap.mode];
  const modeElapsedMs = nowMs - modeCommitMsRef.current;
  const canSwitchMode =
    rawMode !== curSnap.mode && (isEscalating || modeElapsedMs >= 1150);

  let nextMode = curSnap.mode;
  if (canSwitchMode) {
    nextMode = rawMode;
    modeCommitMsRef.current = nowMs;
    textCommitMsRef.current = nowMs;
  }

  // Chống nhảy chữ liên tục trong cùng trạng thái WARNING / BAD (giữ chữ tối thiểu 950ms)
  const textElapsedMs = nowMs - textCommitMsRef.current;
  const shouldUpdateText =
    canSwitchMode ||
    textElapsedMs >= 950 ||
    curSnap.primaryLabel === 'Ngồi thẳng chuẩn';

  snapshotRef.current = {
    mode: nextMode,
    primaryLabel: shouldUpdateText ? output.primary_label_vi : curSnap.primaryLabel,
    advice: shouldUpdateText ? output.advice_vi : curSnap.advice,
    score: output.posture_score,
    durationSec: output.duration_bad_sec,
    activeFaults: shouldUpdateText ? output.active_faults : curSnap.activeFaults,
  };
  if (
    shouldUpdateText &&
    (output.primary_label_vi !== curSnap.primaryLabel || output.advice_vi !== curSnap.advice)
  ) {
    textCommitMsRef.current = nowMs;
  }

  const snap = snapshotRef.current;
  const prevModeRef = useRef<IslandMode>(snap.mode);

  // Khi vừa chuyển sang trang khác hoặc vừa chỉnh lại tư thế từ Vàng/Đỏ về Xanh (GOOD),
  // hiện viên nang xanh "Ngồi thẳng chuẩn" trong 3.2 giây rồi thu nhỏ êm ái
  useEffect(() => {
    if (!monitoringActive) return;
    if (location.pathname !== '/robot' || !viewVisible) {
      setShowGoodPillBriefly(true);
      const timer = window.setTimeout(() => {
        setShowGoodPillBriefly(false);
      }, 3200);
      return () => window.clearTimeout(timer);
    }
  }, [location.pathname, monitoringActive, viewVisible]);

  useEffect(() => {
    if (prevModeRef.current !== 'GOOD' && snap.mode === 'GOOD') {
      setShowGoodPillBriefly(true);
      const timer = window.setTimeout(() => {
        setShowGoodPillBriefly(false);
      }, 3200);
      prevModeRef.current = snap.mode;
      return () => window.clearTimeout(timer);
    }
    prevModeRef.current = snap.mode;
  }, [snap.mode]);

  const isOnRobotPageWithVisibleCam =
    location.pathname === '/robot' && viewVisible;
  if (!monitoringActive || isOnRobotPageWithVisibleCam) {
    return null;
  }

  const handleOpenCameraView = () => {
    globalRt.viewVisible = true;
    syncVideoDomPlacement();
    notifyUiListeners();
    if (location.pathname !== '/robot') {
      navigate('/robot');
    }
  };

  const isCollapsedGood = snap.mode === 'GOOD' && !showGoodPillBriefly;

  const shellStyleClass =
    snap.mode === 'BAD'
      ? 'w-[94vw] max-w-[540px] rounded-[30px] border border-rose-400/40 bg-slate-950/95 px-5 py-3.5 shadow-lg'
      : snap.mode === 'WARNING'
        ? 'w-[92vw] max-w-[480px] rounded-[26px] border border-amber-400/35 bg-slate-950/95 px-4 py-3 shadow-lg'
        : snap.mode === 'NO_PERSON'
          ? 'w-auto max-w-[370px] rounded-full border border-white/12 bg-slate-950/92 px-4 py-2 shadow-md'
          : 'w-auto max-w-[390px] rounded-full border border-white/15 bg-slate-950/92 px-4 py-2 shadow-md';

  return (
    <div
      className={`fixed top-[72px] left-1/2 -translate-x-1/2 z-50 transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
        isCollapsedGood
          ? 'opacity-0 scale-90 -translate-y-2 pointer-events-none'
          : 'opacity-100 scale-100 translate-y-0 pointer-events-auto'
      }`}
    >
      <div
        className={`text-white overflow-hidden transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${shellStyleClass}`}
      >
        {/* 1. Chưa thấy người ngồi học */}
        {snap.mode === 'NO_PERSON' && (
          <button
            type="button"
            onClick={handleOpenCameraView}
            className="flex items-center gap-2.5 text-left transition-opacity duration-300"
          >
            <span className="h-2 w-2 shrink-0 rounded-full bg-amber-400 animate-pulse" />
            <span className="text-xs font-semibold text-slate-200 whitespace-nowrap">
              Đang giám sát ngầm · Chưa thấy người ngồi học
            </span>
          </button>
        )}

        {/* 2. Tư thế ngồi chuẩn (GOOD) */}
        {snap.mode === 'GOOD' && (
          <button
            type="button"
            onClick={handleOpenCameraView}
            title="Bấm để mở khung hình Camera"
            className="flex items-center gap-2.5 text-left transition-opacity duration-300"
          >
            <span className="relative flex h-2.5 w-2.5 shrink-0">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400" />
            </span>
            <Camera className="h-3.5 w-3.5 shrink-0 text-emerald-300" />
            <span className="text-xs font-bold tracking-tight text-white whitespace-nowrap">
              Tư thế ngồi chuẩn · Đang giám sát nền
            </span>
            <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[11px] font-extrabold tabular-nums text-emerald-300">
              {snap.score}đ
            </span>
          </button>
        )}

        {/* 3. Chớm ngồi lệch (WARNING) */}
        {snap.mode === 'WARNING' && (
          <div className="flex items-center justify-between gap-3.5 transition-opacity duration-300">
            <div className="flex items-center gap-3 min-w-0">
              <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-amber-400/20 border border-amber-400/40 text-amber-300 transition-transform duration-500">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-amber-400/25 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-amber-300">
                    Lưu ý nhẹ
                  </span>
                  <span className="text-xs font-extrabold text-white truncate">
                    {snap.primaryLabel}
                  </span>
                  <span className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-bold tabular-nums text-amber-200">
                    {snap.durationSec.toFixed(0)}s
                  </span>
                </div>
                <p className="text-xs text-slate-300 truncate mt-0.5">
                  {snap.advice}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleOpenCameraView}
              className="shrink-0 rounded-full bg-amber-400 px-3.5 py-1.5 text-xs font-extrabold text-slate-950 hover:bg-amber-300 transition-colors whitespace-nowrap"
            >
              Xem Cam
            </button>
          </div>
        )}

        {/* 4. Ngồi sai liên tục (BAD >= 3.5s) */}
        {snap.mode === 'BAD' && (
          <div className="flex flex-col gap-2.5 transition-opacity duration-300">
            <div className="flex items-center justify-between gap-3.5">
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-rose-500/25 border border-rose-400/45 text-rose-300 transition-transform duration-500">
                  <span className="absolute inset-0 rounded-2xl bg-rose-500/30 animate-ping" />
                  <AlertCircle className="relative h-5 w-5 text-rose-300" />
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-rose-500 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-white">
                      Cần chỉnh tư thế
                    </span>
                    <span className="text-xs font-extrabold text-rose-200 truncate">
                      {snap.primaryLabel}
                    </span>
                    <span className="rounded-full bg-rose-500/25 px-2 py-0.5 text-[11px] font-bold tabular-nums text-rose-200">
                      {snap.durationSec.toFixed(0)}s
                    </span>
                  </div>
                  <p className="text-xs font-medium text-white mt-1 leading-snug">
                    {snap.advice}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleOpenCameraView}
                className="shrink-0 rounded-full bg-white/15 px-3.5 py-2 text-xs font-bold text-white hover:bg-white/25 transition-colors whitespace-nowrap"
              >
                Mở Camera
              </button>
            </div>

            {snap.activeFaults.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 pl-14">
                {snap.activeFaults.map((f) => (
                  <span
                    key={f}
                    className="rounded-full border border-rose-400/35 bg-rose-500/15 px-2.5 py-0.5 text-[11px] font-semibold text-rose-200"
                  >
                    {FAULT_LABELS_VI[f] || f}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
