import { initializeApp, getApps, getApp, type FirebaseApp } from '@firebase/app';
import { getAuth, GoogleAuthProvider, type Auth } from '@firebase/auth';
import { getDatabase, type Database } from '@firebase/database';
import { getStorage, type FirebaseStorage } from '@firebase/storage';
import {
  getMessaging,
  getToken,
  deleteToken,
  onMessage,
  isSupported as isMessagingSupported,
  type Messaging,
  type MessagePayload,
} from '@firebase/messaging';
import { isEnvValuePresent } from '../domain/envContract';

/**
 * Cấu hình Firebase Client SDK theo từng chặng (Phiên bản SDK: firebase ^13.1.0 Modular API)
 * QUY TẮC BẮT BUỘC:
 * - P00: Không khởi tạo SDK khi các biến môi trường chưa cấu hình để ứng dụng không bao giờ lỗi lúc khởi động.
 * - P01: Chỉ kiểm tra nhóm biến Auth & Realtime Database (VITE_FIREBASE_API_KEY, AUTH_DOMAIN, DATABASE_URL, PROJECT_ID, APP_ID).
 * - P03: Chỉ kiểm tra VITE_FIREBASE_STORAGE_BUCKET khi dùng tới tính năng ảnh Capture.
 * - P04: Chỉ kiểm tra VITE_FIREBASE_MESSAGING_SENDER_ID và VITE_FIREBASE_VAPID_KEY khi dùng tới FCM Web Push.
 * - Database là Firebase Realtime Database (firebase/database). TUYỆT ĐỐI KHÔNG dùng Firestore.
 */

const rawClientEnv = {
  VITE_FIREBASE_API_KEY: import.meta.env.VITE_FIREBASE_API_KEY || '',
  VITE_FIREBASE_AUTH_DOMAIN: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '',
  VITE_FIREBASE_DATABASE_URL: import.meta.env.VITE_FIREBASE_DATABASE_URL || '',
  VITE_FIREBASE_PROJECT_ID: import.meta.env.VITE_FIREBASE_PROJECT_ID || '',
  VITE_FIREBASE_STORAGE_BUCKET: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '',
  VITE_FIREBASE_MESSAGING_SENDER_ID: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
  VITE_FIREBASE_APP_ID: import.meta.env.VITE_FIREBASE_APP_ID || '',
  VITE_FIREBASE_VAPID_KEY: import.meta.env.VITE_FIREBASE_VAPID_KEY || '',
};

export interface StagedClientConfigReport {
  /** Chặng P01: Auth & Realtime Database */
  p01AuthRtdbConfigured: boolean;
  p01StatusLabel: 'Đã cấu hình' | 'Chưa cấu hình';
  missingP01Vars: string[];
  /** Chặng P03: Cloud Storage */
  p03StorageConfigured: boolean;
  p03StatusLabel: 'Đã cấu hình' | 'Chưa cấu hình';
  missingP03Vars: string[];
  /** Chặng P04: FCM Web Push */
  p04FcmConfigured: boolean;
  p04StatusLabel: 'Đã cấu hình' | 'Chưa cấu hình';
  missingP04Vars: string[];
  projectId: string | null;
  databaseURL: string | null;
}

export function getFirebaseClientConfigReport(): StagedClientConfigReport {
  const p01Keys: Array<keyof typeof rawClientEnv> = [
    'VITE_FIREBASE_API_KEY',
    'VITE_FIREBASE_AUTH_DOMAIN',
    'VITE_FIREBASE_DATABASE_URL',
    'VITE_FIREBASE_PROJECT_ID',
    'VITE_FIREBASE_APP_ID',
  ];
  const p03Keys: Array<keyof typeof rawClientEnv> = ['VITE_FIREBASE_STORAGE_BUCKET'];
  const p04Keys: Array<keyof typeof rawClientEnv> = [
    'VITE_FIREBASE_MESSAGING_SENDER_ID',
    'VITE_FIREBASE_VAPID_KEY',
  ];

  const missingP01Vars = p01Keys.filter((k) => !isEnvValuePresent(rawClientEnv[k]));
  const missingP03Vars = p03Keys.filter((k) => !isEnvValuePresent(rawClientEnv[k]));
  const missingP04Vars = p04Keys.filter((k) => !isEnvValuePresent(rawClientEnv[k]));

  const p01AuthRtdbConfigured = missingP01Vars.length === 0;
  const p03StorageConfigured = p01AuthRtdbConfigured && missingP03Vars.length === 0;
  const p04FcmConfigured = p01AuthRtdbConfigured && missingP04Vars.length === 0;

  return {
    p01AuthRtdbConfigured,
    p01StatusLabel: p01AuthRtdbConfigured ? 'Đã cấu hình' : 'Chưa cấu hình',
    missingP01Vars,
    p03StorageConfigured,
    p03StatusLabel: p03StorageConfigured ? 'Đã cấu hình' : 'Chưa cấu hình',
    missingP03Vars,
    p04FcmConfigured,
    p04StatusLabel: p04FcmConfigured ? 'Đã cấu hình' : 'Chưa cấu hình',
    missingP04Vars,
    projectId: isEnvValuePresent(rawClientEnv.VITE_FIREBASE_PROJECT_ID)
      ? rawClientEnv.VITE_FIREBASE_PROJECT_ID
      : null,
    databaseURL: isEnvValuePresent(rawClientEnv.VITE_FIREBASE_DATABASE_URL)
      ? rawClientEnv.VITE_FIREBASE_DATABASE_URL
      : null,
  };
}

let appInstance: FirebaseApp | null = null;
let authInstance: Auth | null = null;
let rtdbInstance: Database | null = null;
let storageInstance: FirebaseStorage | null = null;
let googleProviderInstance: GoogleAuthProvider | null = null;

/**
 * Chỉ khởi tạo Firebase Auth & Realtime Database khi cấu hình P01 đã đầy đủ
 * và khi người dùng thực sự gọi tính năng liên quan (Lazy Initialization).
 */
export function getFirebaseAuthAndRtdb(): {
  isConfigured: boolean;
  statusLabel: 'Đã cấu hình' | 'Chưa cấu hình';
  missingVars: string[];
  app: FirebaseApp | null;
  auth: Auth | null;
  rtdb: Database | null;
  googleProvider: GoogleAuthProvider | null;
} {
  const report = getFirebaseClientConfigReport();

  if (!report.p01AuthRtdbConfigured) {
    return {
      isConfigured: false,
      statusLabel: 'Chưa cấu hình',
      missingVars: report.missingP01Vars,
      app: null,
      auth: null,
      rtdb: null,
      googleProvider: null,
    };
  }

  if (!appInstance) {
    appInstance =
      getApps().length > 0
        ? getApp()
        : initializeApp({
            apiKey: rawClientEnv.VITE_FIREBASE_API_KEY,
            authDomain: rawClientEnv.VITE_FIREBASE_AUTH_DOMAIN,
            databaseURL: rawClientEnv.VITE_FIREBASE_DATABASE_URL,
            projectId: rawClientEnv.VITE_FIREBASE_PROJECT_ID,
            storageBucket: rawClientEnv.VITE_FIREBASE_STORAGE_BUCKET || undefined,
            messagingSenderId: rawClientEnv.VITE_FIREBASE_MESSAGING_SENDER_ID || undefined,
            appId: rawClientEnv.VITE_FIREBASE_APP_ID,
          });
    authInstance = getAuth(appInstance);
    rtdbInstance = getDatabase(appInstance);
    googleProviderInstance = new GoogleAuthProvider();
  }

  return {
    isConfigured: true,
    statusLabel: 'Đã cấu hình',
    missingVars: [],
    app: appInstance,
    auth: authInstance,
    rtdb: rtdbInstance,
    googleProvider: googleProviderInstance,
  };
}

/**
 * Chỉ khởi tạo Cloud Storage khi cấu hình P03 đã đầy đủ.
 */
export function getFirebaseStorageForCaptures(): {
  isConfigured: boolean;
  statusLabel: 'Đã cấu hình' | 'Chưa cấu hình';
  missingVars: string[];
  storage: FirebaseStorage | null;
} {
  const report = getFirebaseClientConfigReport();
  if (!report.p03StorageConfigured) {
    return {
      isConfigured: false,
      statusLabel: 'Chưa cấu hình',
      missingVars: [...report.missingP01Vars, ...report.missingP03Vars],
      storage: null,
    };
  }

  const { app } = getFirebaseAuthAndRtdb();
  if (!app) {
    return {
      isConfigured: false,
      statusLabel: 'Chưa cấu hình',
      missingVars: report.missingP01Vars,
      storage: null,
    };
  }

  if (!storageInstance) {
    storageInstance = getStorage(app);
  }

  return {
    isConfigured: true,
    statusLabel: 'Đã cấu hình',
    missingVars: [],
    storage: storageInstance,
  };
}

/**
 * Chỉ khởi tạo FCM Messaging khi cấu hình P04 đã đầy đủ.
 */
export async function getFirebaseMessagingForPush(): Promise<{
  isConfigured: boolean;
  statusLabel: 'Đã cấu hình' | 'Chưa cấu hình';
  missingVars: string[];
  messaging: Messaging | null;
}> {
  const report = getFirebaseClientConfigReport();
  if (!report.p04FcmConfigured) {
    return {
      isConfigured: false,
      statusLabel: 'Chưa cấu hình',
      missingVars: [...report.missingP01Vars, ...report.missingP04Vars],
      messaging: null,
    };
  }

  const { app } = getFirebaseAuthAndRtdb();
  if (!app) {
    return {
      isConfigured: false,
      statusLabel: 'Chưa cấu hình',
      missingVars: report.missingP01Vars,
      messaging: null,
    };
  }

  const supported = await isMessagingSupported().catch(() => false);
  if (!supported) {
    return {
      isConfigured: true,
      statusLabel: 'Đã cấu hình',
      missingVars: [],
      messaging: null,
    };
  }

  return {
    isConfigured: true,
    statusLabel: 'Đã cấu hình',
    missingVars: [],
    messaging: getMessaging(app),
  };
}

const INSTALLATION_ID_STORAGE_KEY = 'bugz_fcm_installation_id_v1';

/**
 * Lấy hoặc khởi tạo mã định danh cài đặt trình duyệt (`installation_id`) ổn định trên thiết bị hiện tại
 */
export function getOrCreateClientInstallationId(): string {
  if (typeof window === 'undefined') return 'server-env-inst';
  try {
    const existing = window.localStorage.getItem(INSTALLATION_ID_STORAGE_KEY);
    if (existing && existing.trim().length >= 6) {
      return existing.trim();
    }
    const created = `inst-web-${Math.random().toString(36).slice(2, 10)}-${Date.now().toString(36)}`;
    window.localStorage.setItem(INSTALLATION_ID_STORAGE_KEY, created);
    return created;
  } catch {
    return 'inst-ephemeral-session';
  }
}

export interface BrowserPushCapabilityReport {
  notificationApiSupported: boolean;
  serviceWorkerSupported: boolean;
  permissionState: NotificationPermission | 'unsupported';
  isIosOrIpadOs: boolean;
  isStandaloneHomeScreenPwa: boolean;
  platformType: 'web_desktop' | 'web_android' | 'ios_homescreen_pwa' | 'web_mobile_browser';
  iosRequiresAddToHomeScreen: boolean;
}

/**
 * Kiểm tra trung thực năng lực Web Push của trình duyệt & iOS/iPadOS Home Screen PWA (Mục 7.2 & 9.2 Artifact)
 */
export function detectPushPlatformCapability(): BrowserPushCapabilityReport {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return {
      notificationApiSupported: false,
      serviceWorkerSupported: false,
      permissionState: 'unsupported',
      isIosOrIpadOs: false,
      isStandaloneHomeScreenPwa: false,
      platformType: 'web_desktop',
      iosRequiresAddToHomeScreen: false,
    };
  }

  const ua = navigator.userAgent || '';
  const isIosOrIpadOs =
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

  const isStandalone =
    window.matchMedia?.('(display-mode: standalone)')?.matches === true ||
    (navigator as unknown as { standalone?: boolean }).standalone === true;

  const notificationApiSupported = 'Notification' in window;
  const serviceWorkerSupported = 'serviceWorker' in navigator;
  const permissionState: NotificationPermission | 'unsupported' = notificationApiSupported
    ? Notification.permission
    : 'unsupported';

  let platformType: BrowserPushCapabilityReport['platformType'] = 'web_desktop';
  if (isIosOrIpadOs) {
    platformType = isStandalone ? 'ios_homescreen_pwa' : 'web_mobile_browser';
  } else if (/Android/i.test(ua)) {
    platformType = 'web_android';
  }

  return {
    notificationApiSupported,
    serviceWorkerSupported,
    permissionState,
    isIosOrIpadOs,
    isStandaloneHomeScreenPwa: isStandalone,
    platformType,
    iosRequiresAddToHomeScreen: isIosOrIpadOs && !isStandalone,
  };
}

/**
 * P04 (Mục 7.2 & T21): Đăng ký FCM Web Push Token bằng Modular SDK (`firebase/messaging` ^13.1.0)
 * gắn trực tiếp vào PWA Service Worker đang chạy (`/sw.js`) để không tạo 2 Service Worker xung đột scope.
 */
export async function obtainFcmWebPushTokenModular(): Promise<{
  ok: boolean;
  mode: 'real_fcm' | 'blocked_config' | 'permission_denied' | 'ios_needs_homescreen' | 'error';
  token?: string;
  installationId: string;
  platform: BrowserPushCapabilityReport['platformType'];
  message: string;
  missingVars?: string[];
}> {
  const installationId = getOrCreateClientInstallationId();
  const cap = detectPushPlatformCapability();

  if (cap.iosRequiresAddToHomeScreen) {
    return {
      ok: false,
      mode: 'ios_needs_homescreen',
      installationId,
      platform: cap.platformType,
      message:
        'Trên iOS/iPadOS, chuẩn Web Push chỉ hoạt động sau khi bạn bấm Share -> "Thêm vào Màn hình chính" (Add to Home Screen) và mở ứng dụng từ biểu tượng ngoài màn hình chính.',
    };
  }

  if (cap.notificationApiSupported && Notification.permission === 'denied') {
    return {
      ok: false,
      mode: 'permission_denied',
      installationId,
      platform: cap.platformType,
      message:
        'Quyền thông báo trình duyệt đang bị từ chối (denied). Hệ thống tự động chuyển sang nhắc trong ứng dụng (In-App), giọng nói khi mở trang và Email.',
    };
  }

  const fcmSetup = await getFirebaseMessagingForPush();
  if (!fcmSetup.isConfigured || !fcmSetup.messaging) {
    return {
      ok: false,
      mode: 'blocked_config',
      installationId,
      platform: cap.platformType,
      missingVars: fcmSetup.missingVars,
      message: `Chưa cấu hình biến môi trường FCM Web Push (${fcmSetup.missingVars.join(', ')}). Trạng thái FCM thật: BLOCKED.`,
    };
  }

  try {
    if (Notification.permission === 'default') {
      const granted = await Notification.requestPermission();
      if (granted !== 'granted') {
        return {
          ok: false,
          mode: 'permission_denied',
          installationId,
          platform: cap.platformType,
          message: 'Người dùng chưa cấp quyền hiển thị thông báo trên trình duyệt.',
        };
      }
    }

    // Lấy đúng ServiceWorkerRegistration của /sw.js đang hoạt động
    const swRegistration =
      (await navigator.serviceWorker.getRegistration('/')) ||
      (await navigator.serviceWorker.register('/sw.js', { scope: '/' }));

    const token = await getToken(fcmSetup.messaging, {
      vapidKey: rawClientEnv.VITE_FIREBASE_VAPID_KEY,
      serviceWorkerRegistration: swRegistration,
    });

    if (!token) {
      return {
        ok: false,
        mode: 'error',
        installationId,
        platform: cap.platformType,
        message: 'Không nhận được FCM registration token từ trình duyệt.',
      };
    }

    return {
      ok: true,
      mode: 'real_fcm',
      token,
      installationId,
      platform: cap.platformType,
      message: 'Đã lấy FCM Web Push token thành công qua Modular SDK v13 và PWA Service Worker (/sw.js).',
    };
  } catch (err) {
    return {
      ok: false,
      mode: 'error',
      installationId,
      platform: cap.platformType,
      message: err instanceof Error ? err.message : 'Lỗi khi gọi getToken(messaging).',
    };
  }
}

/**
 * P04 (Ca kiểm thử T29): Xóa FCM token phía trình duyệt bằng `deleteToken(messaging)` khi đăng xuất
 */
export async function deleteClientFcmWebPushTokenModular(): Promise<void> {
  try {
    const fcmSetup = await getFirebaseMessagingForPush();
    if (fcmSetup.isConfigured && fcmSetup.messaging) {
      await deleteToken(fcmSetup.messaging);
    }
  } catch {
    // Bỏ qua nếu chưa khởi tạo hoặc trình duyệt chặn
  }
}

/**
 * P04 (Mục 7.2 & T21): Lắng nghe gói tin FCM ở Foreground (`onMessage`) và hợp nhất với Deduplicator
 */
export async function subscribeForegroundFcmMessages(
  onForegroundPayload: (payload: MessagePayload) => void
): Promise<(() => void) | null> {
  const fcmSetup = await getFirebaseMessagingForPush();
  if (!fcmSetup.isConfigured || !fcmSetup.messaging) {
    return null;
  }
  const unsubscribe = onMessage(fcmSetup.messaging, (payload) => {
    onForegroundPayload(payload);
  });
  return unsubscribe;
}

