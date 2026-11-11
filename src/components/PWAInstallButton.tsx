import React, { useEffect, useState } from 'react';
import { Download, Smartphone, WifiOff, X } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    setIsInstalled(isStandalone);

    const userAgent = window.navigator.userAgent.toLowerCase();
    setIsIOS(/iphone|ipad|ipod/.test(userAgent));

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const install = async () => {
    if (!deferredPrompt) return false;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setIsInstalled(true);
      setDeferredPrompt(null);
      return true;
    }
    return false;
  };

  return {
    isInstallable: Boolean(deferredPrompt),
    isInstalled,
    isIOS,
    install,
  };
}

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showGuide, setShowGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  return (
    <>
      {isInstallable ? (
        <button
          type="button"
          onClick={install}
          className="inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-teal-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 whitespace-nowrap shrink-0"
        >
          <Download className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>Cài đặt ứng dụng</span>
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setShowGuide(true)}
          className="inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 whitespace-nowrap shrink-0"
        >
          <Smartphone className="h-4 w-4 text-teal-700 shrink-0" aria-hidden="true" />
          <span>Hướng dẫn cài PWA</span>
        </button>
      )}

      {showGuide && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="pwa-guide-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs"
        >
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <h3 id="pwa-guide-title" className="text-lg font-bold text-slate-900">
                Cài đặt Webapp BUGZ lên Màn hình chính
              </h3>
              <button
                type="button"
                onClick={() => setShowGuide(false)}
                aria-label="Đóng hướng dẫn cài đặt"
                className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="mt-3 space-y-3 text-sm leading-relaxed text-slate-600">
              {isIOS ? (
                <p>
                  Trên iPhone / iPad (Safari): Nhấn nút <strong>Chia sẻ (Share)</strong> ở thanh công cụ trình duyệt, sau đó chọn <strong>Thêm vào Màn hình chính (Add to Home Screen)</strong> để cài đặt và nhận thông báo Web Push (iOS/iPadOS 16.4+).
                </p>
              ) : (
                <p>
                  Trên trình duyệt Chrome / Edge (Máy tính hoặc Android): Nhấn biểu tượng <strong>Cài đặt ứng dụng</strong> trên thanh địa chỉ (khi chạy trên HTTPS triển khai thật) hoặc mở menu trình duyệt và chọn <strong>Thêm vào màn hình chính</strong>.
                </p>
              )}
              <p className="text-xs text-slate-500">
                Lưu ý bảo mật (Mục 14.1 Artifact): Chế độ ngoại tuyến chỉ lưu vỏ ứng dụng (app shell), tuyệt đối không lưu cache ảnh chụp tư thế hay dữ liệu riêng tư giữa các tài khoản.
              </p>
            </div>
            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={() => setShowGuide(false)}
                className="min-h-[44px] rounded-lg bg-slate-900 px-5 py-2 text-sm font-semibold text-white hover:bg-slate-800"
              >
                Đã hiểu
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export const OfflineConnectivityBanner: React.FC = () => {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  if (isOnline) return null;

  return (
    <div
      role="status"
      className="fixed bottom-20 left-4 right-4 z-50 mx-auto flex max-w-md items-center gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-xs font-medium text-amber-950 shadow-md md:bottom-4"
    >
      <WifiOff className="h-4 w-4 shrink-0 text-amber-700" aria-hidden="true" />
      <span>Mất kết nối mạng — Đang hiển thị vỏ ứng dụng ngoại tuyến. Dữ liệu Robot và cảnh báo thời gian thực tạm dừng.</span>
    </div>
  );
};
