/**
 * Hợp đồng Biến Môi Trường Theo Từng Chặng (P00 -> P06)
 * Đảm bảo:
 * - P00 build và chạy khung ứng dụng hoàn chỉnh khi chưa có cấu hình ngoài.
 * - Chỉ yêu cầu cấu hình khi chạy tính năng của chặng tương ứng (P01, P03, P04, hoặc khi Backend gọi Admin SDK).
 * - Xác định rõ định dạng FIREBASE_SERVICE_ACCOUNT_JSON / FIREBASE_SERVICE_ACCOUNT_KEY_PATH,
 *   các giá trị hợp lệ của MQTT_ADAPTER_MODE và EMAIL_PROVIDER.
 */

export const SUPPORTED_MQTT_ADAPTER_MODES = ['webhook_https', 'node_worker'] as const;
export type MqttAdapterMode = (typeof SUPPORTED_MQTT_ADAPTER_MODES)[number];

export const SUPPORTED_EMAIL_PROVIDERS = ['smtp', 'resend', 'sendgrid'] as const;
export type EmailProviderType = (typeof SUPPORTED_EMAIL_PROVIDERS)[number];

export type ProjectStageCode = 'P00' | 'P01' | 'P02' | 'P03' | 'P04' | 'P05' | 'P06';

export interface ParsedServiceAccountInfo {
  isValid: boolean;
  source: 'json_env' | 'file_path' | 'none';
  projectId?: string;
  clientEmail?: string;
  errorReason?: string;
}

/**
 * Kiểm tra giá trị biến môi trường có thực sự được điền (không rỗng và không phải placeholder mẫu)
 */
export function isEnvValuePresent(val: string | undefined | null): boolean {
  if (!val) return false;
  const trimmed = val.trim();
  if (!trimmed) return false;
  if (
    trimmed === 'MY_GEMINI_API_KEY' ||
    trimmed === 'MY_APP_URL' ||
    trimmed.startsWith('YOUR_') ||
    trimmed.startsWith('<')
  ) {
    return false;
  }
  return true;
}

/**
 * Phân tích và kiểm tra định dạng của FIREBASE_SERVICE_ACCOUNT_JSON hoặc FIREBASE_SERVICE_ACCOUNT_KEY_PATH
 * Hỗ trợ:
 * 1) FIREBASE_SERVICE_ACCOUNT_JSON: Chuỗi JSON nguyên bản trên 1 dòng HOẶC chuỗi Base64 của JSON Service Account
 *    (bắt buộc có "project_id", "client_email", "private_key" chứa "-----BEGIN PRIVATE KEY-----").
 * 2) FIREBASE_SERVICE_ACCOUNT_KEY_PATH: Đường dẫn tới file .json trên ổ đĩa server (ví dụ: ./service-account.json).
 */
export function validateServiceAccountConfig(env: Record<string, string | undefined>): ParsedServiceAccountInfo {
  const rawJsonOrB64 = env.FIREBASE_SERVICE_ACCOUNT_JSON;
  const keyPath = env.FIREBASE_SERVICE_ACCOUNT_KEY_PATH;

  if (isEnvValuePresent(rawJsonOrB64)) {
    const trimmed = rawJsonOrB64!.trim();
    try {
      const jsonText = trimmed.startsWith('{')
        ? trimmed
        : Buffer.from(trimmed, 'base64').toString('utf8');
      const parsed = JSON.parse(jsonText) as Record<string, unknown>;
      const projectId = typeof parsed.project_id === 'string' ? parsed.project_id : '';
      const clientEmail = typeof parsed.client_email === 'string' ? parsed.client_email : '';
      const privateKey = typeof parsed.private_key === 'string' ? parsed.private_key : '';

      if (!projectId || !clientEmail || !privateKey.includes('PRIVATE KEY')) {
        return {
          isValid: false,
          source: 'json_env',
          errorReason:
            'FIREBASE_SERVICE_ACCOUNT_JSON thiếu trường bắt buộc (project_id, client_email, hoặc private_key hợp lệ).',
        };
      }

      return {
        isValid: true,
        source: 'json_env',
        projectId,
        clientEmail,
      };
    } catch {
      return {
        isValid: false,
        source: 'json_env',
        errorReason:
          'FIREBASE_SERVICE_ACCOUNT_JSON không phải chuỗi JSON hợp lệ hoặc Base64-encoded JSON hợp lệ.',
      };
    }
  }

  if (isEnvValuePresent(keyPath)) {
    const trimmedPath = keyPath!.trim();
    if (!trimmedPath.endsWith('.json')) {
      return {
        isValid: false,
        source: 'file_path',
        errorReason:
          'FIREBASE_SERVICE_ACCOUNT_KEY_PATH phải là đường dẫn trỏ tới tệp định dạng .json (ví dụ: ./service-account.json).',
      };
    }
    return {
      isValid: true,
      source: 'file_path',
    };
  }

  return {
    isValid: false,
    source: 'none',
    errorReason:
      'Chưa cấu hình FIREBASE_SERVICE_ACCOUNT_JSON hoặc FIREBASE_SERVICE_ACCOUNT_KEY_PATH.',
  };
}

/**
 * Kiểm tra giá trị MQTT_ADAPTER_MODE
 * Chỉ chấp nhận: "webhook_https" | "node_worker"
 */
export function validateMqttAdapterMode(rawMode: string | undefined): {
  isValid: boolean;
  mode: MqttAdapterMode;
  errorReason?: string;
} {
  const modeStr = (rawMode || 'webhook_https').trim();
  if ((SUPPORTED_MQTT_ADAPTER_MODES as readonly string[]).includes(modeStr)) {
    return {
      isValid: true,
      mode: modeStr as MqttAdapterMode,
    };
  }
  return {
    isValid: false,
    mode: 'webhook_https',
    errorReason: `MQTT_ADAPTER_MODE="${modeStr}" không được hỗ trợ. Chỉ chấp nhận: ${SUPPORTED_MQTT_ADAPTER_MODES.join(' | ')}.`,
  };
}

/**
 * Kiểm tra giá trị EMAIL_PROVIDER
 * Chỉ chấp nhận: "smtp" | "resend" | "sendgrid"
 */
export function validateEmailProvider(rawProvider: string | undefined): {
  isValid: boolean;
  provider: EmailProviderType;
  errorReason?: string;
} {
  const providerStr = (rawProvider || 'smtp').trim();
  if ((SUPPORTED_EMAIL_PROVIDERS as readonly string[]).includes(providerStr)) {
    return {
      isValid: true,
      provider: providerStr as EmailProviderType,
    };
  }
  return {
    isValid: false,
    provider: 'smtp',
    errorReason: `EMAIL_PROVIDER="${providerStr}" không được hỗ trợ. Chỉ chấp nhận: ${SUPPORTED_EMAIL_PROVIDERS.join(' | ')}.`,
  };
}

/**
 * Kiểm tra cấu hình theo từng tính năng & chặng bắt buộc sử dụng
 */
export interface FeatureStageConfigCheck {
  featureId: string;
  featureName: string;
  requiredAtStage: string;
  isConfigured: boolean;
  uiStatusLabel: 'Đã cấu hình (Chờ kiểm thử)' | 'Chưa cấu hình';
  missingOrInvalidVars: string[];
  details: string;
}

export function evaluateStageFeatureConfigs(
  env: Record<string, string | undefined>
): Record<
  'firebaseClientAuthRtdb' | 'firebaseAdminBackend' | 'mqttAndRobot' | 'cloudStorageCaptures' | 'fcmWebPush' | 'emailProvider',
  FeatureStageConfigCheck
> {
  // 1. P01: Firebase Auth & Realtime Database (Client)
  const p01ClientVars = [
    'VITE_FIREBASE_API_KEY',
    'VITE_FIREBASE_AUTH_DOMAIN',
    'VITE_FIREBASE_DATABASE_URL',
    'VITE_FIREBASE_PROJECT_ID',
    'VITE_FIREBASE_APP_ID',
  ];
  const missingP01Client = p01ClientVars.filter((k) => !isEnvValuePresent(env[k]));

  // 2. Khi Backend thực sự cần sử dụng: Firebase Admin SDK
  const saValidation = validateServiceAccountConfig(env);
  const missingAdminVars: string[] = [];
  if (!isEnvValuePresent(env.FIREBASE_PROJECT_ID)) missingAdminVars.push('FIREBASE_PROJECT_ID');
  if (!isEnvValuePresent(env.FIREBASE_DATABASE_URL)) missingAdminVars.push('FIREBASE_DATABASE_URL');
  if (!saValidation.isValid) {
    missingAdminVars.push('FIREBASE_SERVICE_ACCOUNT_JSON (hoặc FIREBASE_SERVICE_ACCOUNT_KEY_PATH)');
  }

  // 3. P03: MQTT & Robot (Hỗ trợ cả Native TLS Bridge mqtts://d1a2b01a.ala.asia-southeast1.emqxsl.com:8883 và Webhook HTTPS)
  const mqttModeValidation = validateMqttAdapterMode(env.MQTT_ADAPTER_MODE);
  const hasNativeTlsBridge =
    isEnvValuePresent(env.MQTT_BROKER_URL) &&
    env.MQTT_NATIVE_TLS_ENABLED !== 'false';
  const missingMqttVars: string[] = [];
  if (!hasNativeTlsBridge) {
    if (!mqttModeValidation.isValid) {
      missingMqttVars.push('MQTT_ADAPTER_MODE (chỉ nhận webhook_https | node_worker)');
    }
    if (!isEnvValuePresent(env.MQTT_BROKER_URL)) missingMqttVars.push('MQTT_BROKER_URL');

    if (mqttModeValidation.mode === 'webhook_https') {
      if (!isEnvValuePresent(env.MQTT_WEBHOOK_SHARED_SECRET)) {
        missingMqttVars.push('MQTT_WEBHOOK_SHARED_SECRET');
      }
      if (!isEnvValuePresent(env.MQTT_PUBLISH_API_URL)) {
        missingMqttVars.push('MQTT_PUBLISH_API_URL');
      }
      if (!isEnvValuePresent(env.MQTT_PUBLISH_API_TOKEN)) {
        missingMqttVars.push('MQTT_PUBLISH_API_TOKEN');
      }
    } else {
      if (!isEnvValuePresent(env.MQTT_BRIDGE_USERNAME) && !isEnvValuePresent(env.MQTT_BROKER_USERNAME)) {
        missingMqttVars.push('MQTT_BRIDGE_USERNAME (hoặc MQTT_BROKER_USERNAME)');
      }
      if (!isEnvValuePresent(env.MQTT_BRIDGE_PASSWORD) && !isEnvValuePresent(env.MQTT_BROKER_PASSWORD)) {
        missingMqttVars.push('MQTT_BRIDGE_PASSWORD (hoặc MQTT_BROKER_PASSWORD)');
      }
    }
  }

  // 4. P03: Cloud Storage cho ảnh Capture
  const storageVars = ['VITE_FIREBASE_STORAGE_BUCKET', 'FIREBASE_STORAGE_BUCKET'];
  const missingStorageVars = storageVars.filter((k) => !isEnvValuePresent(env[k]));

  // 5. P04: FCM Web Push
  const fcmVars = ['VITE_FIREBASE_MESSAGING_SENDER_ID', 'VITE_FIREBASE_VAPID_KEY'];
  const missingFcmVars = fcmVars.filter((k) => !isEnvValuePresent(env[k]));

  // 6. P04: Email
  const emailProviderValidation = validateEmailProvider(env.EMAIL_PROVIDER);
  const missingEmailVars: string[] = [];
  if (!emailProviderValidation.isValid) {
    missingEmailVars.push('EMAIL_PROVIDER (chỉ nhận smtp | resend | sendgrid)');
  }
  if (!isEnvValuePresent(env.EMAIL_FROM_ADDRESS)) {
    missingEmailVars.push('EMAIL_FROM_ADDRESS');
  }
  if (emailProviderValidation.provider === 'smtp') {
    if (!isEnvValuePresent(env.SMTP_HOST)) missingEmailVars.push('SMTP_HOST');
    if (!isEnvValuePresent(env.SMTP_PORT)) missingEmailVars.push('SMTP_PORT');
    if (!isEnvValuePresent(env.SMTP_USER)) missingEmailVars.push('SMTP_USER');
    if (!isEnvValuePresent(env.SMTP_PASS)) missingEmailVars.push('SMTP_PASS');
  } else {
    if (!isEnvValuePresent(env.EMAIL_API_KEY)) missingEmailVars.push('EMAIL_API_KEY');
  }

  return {
    firebaseClientAuthRtdb: {
      featureId: 'firebase-client-auth-rtdb',
      featureName: 'Firebase Authentication & Realtime Database (Client)',
      requiredAtStage: 'P01',
      isConfigured: missingP01Client.length === 0,
      uiStatusLabel: missingP01Client.length === 0 ? 'Đã cấu hình (Chờ kiểm thử)' : 'Chưa cấu hình',
      missingOrInvalidVars: missingP01Client,
      details:
        missingP01Client.length === 0
          ? 'Đã có cấu hình Web Config cho Auth & Realtime Database.'
          : `Chưa cấu hình (Yêu cầu từ P01). Thiếu: ${missingP01Client.join(', ')}.`,
    },
    firebaseAdminBackend: {
      featureId: 'firebase-admin-backend',
      featureName: 'Firebase Admin SDK (Xác minh Token, RBAC & Ghi RTDB phía Server)',
      requiredAtStage: 'Khi Backend thực sự cần sử dụng (từ P01)',
      isConfigured: missingAdminVars.length === 0,
      uiStatusLabel: missingAdminVars.length === 0 ? 'Đã cấu hình (Chờ kiểm thử)' : 'Chưa cấu hình',
      missingOrInvalidVars: missingAdminVars,
      details:
        missingAdminVars.length === 0
          ? `Đã cấu hình Service Account hợp lệ (nguồn: ${saValidation.source}).`
          : `Chưa cấu hình (Chỉ yêu cầu khi gọi API Backend cần Admin SDK). ${saValidation.errorReason || ''}`,
    },
    mqttAndRobot: {
      featureId: 'mqtt-and-robot',
      featureName: `MQTT Broker & Robot Bridge (EMQX TLS 8883 + ${mqttModeValidation.mode})`,
      requiredAtStage: 'P03',
      isConfigured: missingMqttVars.length === 0,
      uiStatusLabel: missingMqttVars.length === 0 ? 'Đã cấu hình (Chờ kiểm thử)' : 'Chưa cấu hình',
      missingOrInvalidVars: missingMqttVars,
      details:
        missingMqttVars.length === 0
          ? 'Đã kết nối trực tiếp tới EMQX Cloud TLS 8883 (mqtts://d1a2b01a.ala.asia-southeast1.emqxsl.com:8883, thiết bị robot01) và hỗ trợ endpoint ingest MQTT.'
          : `Chưa cấu hình (Yêu cầu từ P03). Thiếu: ${missingMqttVars.join(', ')}.`,
    },
    cloudStorageCaptures: {
      featureId: 'cloud-storage-captures',
      featureName: 'Cloud Storage Ảnh Capture Riêng tư',
      requiredAtStage: 'P03',
      isConfigured: missingStorageVars.length === 0,
      uiStatusLabel: missingStorageVars.length === 0 ? 'Đã cấu hình (Chờ kiểm thử)' : 'Chưa cấu hình',
      missingOrInvalidVars: missingStorageVars,
      details:
        missingStorageVars.length === 0
          ? 'Đã cấu hình tên Bucket lưu trữ ảnh capture.'
          : `Chưa cấu hình (Yêu cầu từ P03). Thiếu: ${missingStorageVars.join(', ')}.`,
    },
    fcmWebPush: {
      featureId: 'fcm-web-push',
      featureName: 'FCM Web Push Notifications',
      requiredAtStage: 'P04',
      isConfigured: missingFcmVars.length === 0 && missingP01Client.length === 0,
      uiStatusLabel:
        missingFcmVars.length === 0 && missingP01Client.length === 0
          ? 'Đã cấu hình (Chờ kiểm thử)'
          : 'Chưa cấu hình',
      missingOrInvalidVars: [...missingFcmVars],
      details:
        missingFcmVars.length === 0
          ? 'Đã cấu hình Sender ID và VAPID Public Key cho Web Push.'
          : `Chưa cấu hình (Yêu cầu từ P04). Thiếu: ${missingFcmVars.join(', ')}.`,
    },
    emailProvider: {
      featureId: 'email-provider',
      featureName: `Dịch vụ Email Cảnh báo & Chứng nhận (provider=${emailProviderValidation.provider})`,
      requiredAtStage: 'P04',
      isConfigured: missingEmailVars.length === 0,
      uiStatusLabel: missingEmailVars.length === 0 ? 'Đã cấu hình (Chờ kiểm thử)' : 'Chưa cấu hình',
      missingOrInvalidVars: missingEmailVars,
      details:
        missingEmailVars.length === 0
          ? `Đã cấu hình nhà cung cấp email (${emailProviderValidation.provider}).`
          : `Chưa cấu hình (Yêu cầu từ P04). Thiếu: ${missingEmailVars.join(', ')}.`,
    },
  };
}
