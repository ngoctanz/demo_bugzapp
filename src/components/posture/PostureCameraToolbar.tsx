import React from 'react';
import {
  Activity,
  Camera,
  Eye,
  EyeOff,
  FlipHorizontal,
  PowerOff,
  Sliders,
} from 'lucide-react';
import {
  stopGlobalHardwareCamera,
  toggleMirrorMode,
  toggleSkeletonHud,
  startCalibrationCountdown,
} from './postureMonitorRuntime';

export interface PostureCameraToolbarProps {
  monitoringActive: boolean;
  viewVisible: boolean;
  showSkeletonHud: boolean;
  isCalibrated: boolean;
  isStartingCamera: boolean;
  selectedCameraId: string;
  cameraDevices: MediaDeviceInfo[];
  onSelectCamera: (deviceId: string) => void;
  onToggleCameraView: () => void;
}

export const PostureCameraToolbar: React.FC<PostureCameraToolbarProps> = ({
  monitoringActive,
  viewVisible,
  showSkeletonHud,
  isCalibrated,
  isStartingCamera,
  selectedCameraId,
  cameraDevices,
  onSelectCamera,
  onToggleCameraView,
}) => {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-700">
          <Camera className="h-5 w-5" />
        </div>
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-bold text-slate-900">
              Camera Giám sát Tư thế
            </h2>
            <span
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${
                monitoringActive
                  ? 'border-slate-200 bg-slate-100 text-slate-700'
                  : 'border-slate-200 bg-slate-50 text-slate-500'
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  monitoringActive ? 'bg-emerald-500' : 'bg-slate-400'
                }`}
              />
              {monitoringActive
                ? viewVisible
                  ? 'Đang hoạt động'
                  : 'Đang chạy ngầm'
                : 'Chưa bật'}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Tự động duy trì giám sát nền khi chuyển sang các trang khác
          </p>
        </div>
      </div>

      {/* Cụm nút công cụ basic, đồng bộ màu trung tính */}
      <div className="flex flex-wrap items-center gap-2">
        {monitoringActive && cameraDevices.length > 1 && (
          <select
            aria-label="Chọn Camera"
            value={selectedCameraId}
            onChange={(e) => {
              onSelectCamera(e.target.value);
            }}
            className="min-h-[38px] rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
          >
            <option value="user">Camera trước</option>
            {cameraDevices.map((cam, idx) => (
              <option key={cam.deviceId || idx} value={cam.deviceId}>
                {cam.label || `Camera ${idx + 1}`}
              </option>
            ))}
          </select>
        )}

        {monitoringActive && viewVisible && (
          <button
            type="button"
            onClick={toggleSkeletonHud}
            className={`inline-flex min-h-[38px] items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition-colors ${
              showSkeletonHud
                ? 'border-slate-300 bg-slate-100 text-slate-900'
                : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            <Activity className="h-3.5 w-3.5" />
            <span>{showSkeletonHud ? 'Khung xương: Bật' : 'Khung xương: Ẩn'}</span>
          </button>
        )}

        {monitoringActive && (
          <button
            type="button"
            onClick={startCalibrationCountdown}
            className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors whitespace-nowrap"
          >
            <Sliders className="h-3.5 w-3.5" />
            <span>{isCalibrated ? 'Lấy lại chuẩn' : 'Đặt chuẩn ngồi'}</span>
          </button>
        )}

        {monitoringActive && viewVisible && (
          <button
            type="button"
            onClick={toggleMirrorMode}
            title="Lật gương khung hình"
            className="inline-flex min-h-[38px] w-[38px] items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition-colors"
          >
            <FlipHorizontal className="h-4 w-4" />
          </button>
        )}

        <button
          type="button"
          disabled={!monitoringActive && isStartingCamera}
          onClick={onToggleCameraView}
          className={`inline-flex min-h-[38px] items-center gap-2 rounded-xl px-3.5 py-1.5 text-xs font-semibold whitespace-nowrap transition-colors disabled:opacity-60 ${
            !monitoringActive
              ? 'bg-slate-900 text-white hover:bg-slate-800'
              : viewVisible
                ? 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                : 'bg-slate-900 text-white hover:bg-slate-800'
          }`}
        >
          {!monitoringActive ? (
            <>
              <Camera className="h-3.5 w-3.5" />
              <span>{isStartingCamera ? 'Đang mở Camera...' : 'Bật Camera'}</span>
            </>
          ) : viewVisible ? (
            <>
              <EyeOff className="h-3.5 w-3.5" />
              <span>Ẩn khung hình</span>
            </>
          ) : (
            <>
              <Eye className="h-3.5 w-3.5" />
              <span>Hiện lại Camera</span>
            </>
          )}
        </button>

        {(monitoringActive || isStartingCamera) && (
          <button
            type="button"
            onClick={stopGlobalHardwareCamera}
            title="Tắt hoàn toàn phần cứng Camera và đèn báo"
            className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-1.5 text-xs font-bold text-rose-700 hover:border-rose-300 hover:bg-rose-100 active:scale-[0.98] transition-all whitespace-nowrap"
          >
            <PowerOff className="h-3.5 w-3.5" />
            <span>Tắt hẳn Camera</span>
          </button>
        )}
      </div>
    </div>
  );
};
