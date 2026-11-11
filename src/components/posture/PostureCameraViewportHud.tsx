import React from 'react';
import {
  AlertCircle,
  AlertTriangle,
  Camera,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';
import type { ThreeTierPostureOutput } from '../../lib/frontPostureEngine';
import { toggleSkeletonHud } from './postureMonitorRuntime';

export interface PostureCameraViewportHudProps {
  monitoringActive: boolean;
  viewVisible: boolean;
  aiReady: boolean;
  personDetected: boolean;
  showSkeletonHud: boolean;
  calibratingCountdown: number | null;
  output: ThreeTierPostureOutput;
}

export const PostureCameraViewportHud: React.FC<PostureCameraViewportHudProps> = ({
  monitoringActive,
  viewVisible,
  aiReady,
  personDetected,
  showSkeletonHud,
  calibratingCountdown,
  output,
}) => {
  if (!monitoringActive || !viewVisible) {
    return null;
  }

  const shRollAbs = Math.abs(output.angles.shoulder_roll_deg);
  const headRollAbs = Math.abs(output.angles.head_roll_deg);
  const neckBendAbs = Math.abs(output.angles.neck_lateral_bend_deg);

  return (
    <>
      {/* TOP HUD BAR: Trái ("Giám sát tư thế" + "Ngồi đúng ✓") | Phải ("AI Pose | 3D") */}
      <div className="absolute top-4 left-5 right-5 z-10 flex items-center justify-between gap-2 pointer-events-none">
        {/* Viên nang góc trên trái: màu tối dịu mắt, bỏ backdrop-blur để siêu mượt trên máy yếu */}
        <div className="inline-flex items-center gap-2.5 rounded-full border border-white/10 bg-slate-900/90 pl-3.5 pr-1.5 py-1 text-white">
          <div className="flex items-center gap-2">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              className="h-4 w-4 text-slate-200 shrink-0"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="5" r="2" />
              <path d="M10 9h4l1 6h4" />
              <path d="M7 11v8h6" />
              <path d="M15 15v5" />
            </svg>
            <span className="text-xs font-medium text-slate-100 whitespace-nowrap">
              Giám sát tư thế
            </span>
          </div>

          <span
            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold whitespace-nowrap transition-colors duration-300 ${
              !aiReady || !personDetected
                ? 'bg-slate-700 text-slate-200'
                : output.status === 'GOOD'
                  ? 'bg-emerald-600/90 text-white'
                  : output.status === 'WARNING'
                    ? 'bg-amber-500/90 text-slate-950'
                    : 'bg-rose-600/90 text-white'
            }`}
          >
            <span>
              {!aiReady
                ? 'Đang nạp AI'
                : !personDetected
                  ? 'Đang quét'
                  : output.status === 'GOOD'
                    ? 'Ngồi đúng'
                    : output.status === 'WARNING'
                      ? 'Lưu ý nhẹ'
                      : 'Ngồi lệch'}
            </span>
            {personDetected && output.status === 'GOOD' ? (
              <CheckCircle2 className="h-3.5 w-3.5 text-white" />
            ) : (
              <AlertTriangle className="h-3.5 w-3.5" />
            )}
          </span>
        </div>

        {/* Viên nang góc trên phải: [AI Pose | 3D] */}
        <button
          type="button"
          onClick={toggleSkeletonHud}
          title="Bật/Tắt khung xương"
          className="pointer-events-auto inline-flex items-center gap-2.5 rounded-full border border-white/10 bg-slate-900/90 px-3.5 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-900 transition-colors"
        >
          <span className="inline-flex items-center gap-1.5">
            <Camera className="h-3.5 w-3.5 text-slate-300" />
            <span className={showSkeletonHud ? 'text-white' : 'text-slate-400'}>
              AI Pose
            </span>
          </span>
          <span className="h-3 w-px bg-white/15" />
          <span className="inline-flex items-center gap-1 text-slate-300">
            <span>3D</span>
          </span>
        </button>
      </div>

      {/* THẺ CHỈ SỐ BÊN PHẢI: Dịu mắt, bỏ backdrop-blur để chống lag GPU trên máy yếu */}
      {personDetected && (
        <div className="absolute right-5 top-1/2 -translate-y-1/2 z-10 w-[160px] sm:w-[176px] rounded-2xl border border-white/10 bg-slate-900/88 p-3.5 text-white pointer-events-none">
          {/* Vòng tròn điểm tư thế */}
          <div className="relative mx-auto flex h-[96px] w-[96px] items-center justify-center">
            <svg className="h-full w-full -rotate-90" viewBox="0 0 100 100">
              <circle
                cx="50"
                cy="50"
                r="40"
                fill="none"
                stroke="rgba(255,255,255,0.12)"
                strokeWidth="6.5"
              />
              <circle
                cx="50"
                cy="50"
                r="40"
                fill="none"
                stroke={
                  output.status === 'GOOD'
                    ? '#34d399'
                    : output.status === 'WARNING'
                      ? '#fbbf24'
                      : '#f87171'
                }
                strokeWidth="6.5"
                strokeLinecap="round"
                strokeDasharray={251.3}
                strokeDashoffset={
                  251.3 * (1 - Math.max(0.05, Math.min(1, output.posture_score / 100)))
                }
                className="transition-all duration-500 ease-out"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
              <span className="text-xl font-bold tracking-tight text-white tabular-nums">
                {output.posture_score}%
              </span>
              <span className="text-[11px] text-slate-300">
                {output.status === 'GOOD'
                  ? 'Tư thế tốt'
                  : output.status === 'WARNING'
                    ? 'Lưu ý nhẹ'
                    : 'Cần chỉnh'}
              </span>
            </div>
          </div>

          <div className="my-3 h-px bg-white/10" />

          {/* 3 dòng thông số góc: Lưng, Vai, Đầu (chữ trắng dịu mắt, không loạn màu) */}
          <div className="space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-slate-300">
                <span className="flex h-5 w-5 items-center justify-center rounded-md bg-white/10 text-[10px] font-semibold text-slate-200">
                  ∠
                </span>
                <span>Lưng</span>
              </div>
              <span className="font-semibold text-slate-100 tabular-nums">
                {neckBendAbs.toFixed(1)}°
              </span>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-slate-300">
                <span className="flex h-5 w-5 items-center justify-center rounded-md bg-white/10 text-slate-200">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    className="h-3 w-3"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M12 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
                    <path d="M5 19c1.5-2.5 4-4 7-4s5.5 1.5 7 4" />
                  </svg>
                </span>
                <span>Vai</span>
              </div>
              <span className="font-semibold text-slate-100 tabular-nums">
                {shRollAbs.toFixed(1)}°
              </span>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-slate-300">
                <span className="flex h-5 w-5 items-center justify-center rounded-md bg-white/10 text-slate-200">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    className="h-3 w-3"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <circle cx="12" cy="12" r="7" />
                    <path d="M5 11v2" />
                    <path d="M19 11v2" />
                  </svg>
                </span>
                <span>Đầu</span>
              </div>
              <span className="font-semibold text-slate-100 tabular-nums">
                {headRollAbs.toFixed(1)}°
              </span>
            </div>
          </div>
        </div>
      )}

      {/* THANH VIÊN NANG THÔNG BÁO DƯỚI ĐÁY (Dịu mắt, gọn gàng, nhẹ GPU) */}
      {personDetected && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 w-[86%] max-w-[520px] pointer-events-none">
          <div className="flex items-center justify-center gap-2 rounded-full border border-white/10 bg-slate-900/90 px-5 py-2 text-white transition-colors duration-300">
            {output.status === 'GOOD' ? (
              <span className="flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  className="h-3 w-3"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </span>
            ) : output.status === 'WARNING' ? (
              <span className="flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-full bg-amber-400 text-slate-950">
                <AlertTriangle className="h-3 w-3" />
              </span>
            ) : (
              <span className="flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-full bg-rose-500 text-white">
                <AlertCircle className="h-3 w-3" />
              </span>
            )}
            <span className="text-xs sm:text-[13px] font-medium text-slate-100 truncate">
              {output.status === 'GOOD'
                ? 'Tư thế ngồi chuẩn. Hãy duy trì!'
                : output.advice_vi}
            </span>
          </div>
        </div>
      )}

      {/* Màn hình đếm ngược khi Đặt chuẩn ngồi (Calibration) */}
      {calibratingCountdown !== null && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-slate-950/75 text-white backdrop-blur-sm p-6 text-center">
          <Sparkles className="h-6 w-6 text-slate-200 animate-spin mb-2" />
          <div className="text-sm font-bold">
            Giữ lưng thẳng tự nhiên &amp; nhìn vào màn hình...
          </div>
          <div className="mt-2 text-3xl font-bold text-white tabular-nums">
            {calibratingCountdown.toFixed(1)}s
          </div>
        </div>
      )}
    </>
  );
};
