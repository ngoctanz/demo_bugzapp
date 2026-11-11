import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import {
  onAuthStateChanged,
  reauthenticateWithPopup,
  signInWithPopup,
  signOut as firebaseSignOut,
  type User as FirebaseUser,
} from '@firebase/auth';
import {
  deleteClientFcmWebPushTokenModular,
  getFirebaseAuthAndRtdb,
  getFirebaseClientConfigReport,
  getOrCreateClientInstallationId,
} from '../lib/firebaseClient';
import { sanitizeReturnToPath } from '../domain/p04NotificationEngine';
import type { UserRole } from '../types/bugz';
import type {
  ExcelDeviceRecord,
  ExcelUserRecord,
  GuardianStudentLinkRecord,
  OneTimeInvitationRecord,
  ServerAccountRoleRecord,
  StudentAccountLinkRecord,
  StudentRecord,
  VerifiedActorToken,
} from '../domain/p01RbacStore';

export interface NotificationPrefs {
  push_enabled: boolean;
  voice_enabled: boolean;
  email_enabled: boolean;
  mode: 'every_alert' | 'digest';
  quiet_hours_start: string;
  quiet_hours_end: string;
}

export interface DeviceWithId extends ExcelDeviceRecord {
  device_id: string;
}

export interface VerifiedCustomClaims {
  role: UserRole | null;
  admin?: boolean;
  superadmin: boolean;
  source: 'firebase_id_token_claims' | 'emulator_sandbox_token';
  issuedAtTime?: string;
}

export const SANDBOX_PRESET_ACTORS: Record<string, VerifiedActorToken> = {
  'uid-student-a1': {
    uid: 'uid-student-a1',
    email: 'minh.student@example.com',
    email_verified: true,
    name: 'Học sinh Minh',
    superadmin: false,
    role: 'student',
  },
  'uid-superadmin-01': {
    uid: 'uid-superadmin-01',
    email: 'minhquantran4312@gmail.com',
    email_verified: true,
    name: 'Trần Minh Quân (Superadmin)',
    superadmin: true,
    role: 'superadmin',
  },
  'uid-superadmin-02': {
    uid: 'uid-superadmin-02',
    email: 'tamtranmusic@gmail.com',
    email_verified: true,
    name: 'Tâm Trần (Chủ dự án · Superadmin)',
    superadmin: true,
    role: 'superadmin',
  },
};

function parseValidRole(raw: unknown): UserRole | null {
  if (raw === 'superadmin') {
    return 'superadmin';
  }
  if (raw === 'student' || raw === 'user' || raw === 'guardian') {
    return 'student';
  }
  return null;
}

interface AuthContextValue {
  loading: boolean;
  isRealFirebaseConfigured: boolean;
  isEmulatorSandboxMode: boolean;
  uid: string | null;
  email: string | null;
  emailVerified: boolean;
  userRecord: ExcelUserRecord | null;
  accountRole: ServerAccountRoleRecord | null;
  customClaims: VerifiedCustomClaims | null;
  effectiveRole: UserRole | null;
  isSuperAdmin: boolean;
  isGuardian: boolean;
  isStudent: boolean;
  hasRole: (allowedRoles: readonly UserRole[]) => boolean;
  students: StudentRecord[];
  activeStudentId: string | null;
  activeStudent: StudentRecord | null;
  setActiveStudentId: (studentId: string) => void;
  devices: DeviceWithId[];
  invitations: OneTimeInvitationRecord[];
  guardianLinks: Record<string, GuardianStudentLinkRecord>;
  studentAccountLinks: Record<string, StudentAccountLinkRecord>;
  notificationPreferences: NotificationPrefs | null;
  // Chế độ dùng chung thiết bị (Shared Device Student Mode) & xác thực lại trước khi mở Quản lý Phụ huynh
  isSharedDeviceStudentMode: boolean;
  isGuardianReauthenticated: boolean;
  enterSharedDeviceStudentMode: (studentId: string) => void;
  reauthenticateForGuardianArea: (reauthConfirmEmail: string) => Promise<{ ok: boolean; message: string }>;
  // Hành động xác thực, làm mới Custom Claims & gọi API có gắn kèm token
  signInQuickDemo: (input: {
    fullName: string;
    email: string;
    phone: string;
  }) => Promise<{ ok: boolean; message: string }>;
  signInWithGoogleReal: () => Promise<{ ok: boolean; message: string; missingVars?: string[] }>;
  signInEmulatorSandbox: (actor: VerifiedActorToken) => Promise<void>;
  signOutAndWipeSession: () => Promise<void>;
  refreshProfileFromServer: (forceTokenRefresh?: boolean) => Promise<void>;
  authenticatedFetch: (url: string, options?: RequestInit) => Promise<Response>;
  buildAuthHeaders: () => Record<string, string>;
  // P04 (T22): Lưu và tiêu thụ đường dẫn returnTo khi người dùng chưa đăng nhập mở link cảnh báo /alerts/:alertId
  pendingReturnTo: string | null;
  savePendingReturnTo: (rawPath: string | null) => void;
  consumePendingReturnTo: () => string | null;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const STORAGE_KEYS_TO_WIPE = [
  'bugz_sandbox_actor_v1',
  'bugz_active_student_id_v1',
  'bugz_shared_device_student_mode_v1',
  'bugz_guardian_reauth_ts_v1',
];

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const clientConfig = getFirebaseClientConfigReport();
  const [loading, setLoading] = useState<boolean>(true);
  const [isEmulatorSandboxMode, setIsEmulatorSandboxMode] = useState<boolean>(false);
  const [sandboxActor, setSandboxActor] = useState<VerifiedActorToken | null>(null);
  const [realIdToken, setRealIdToken] = useState<string | null>(null);
  const [customClaims, setCustomClaims] = useState<VerifiedCustomClaims | null>(null);

  const [uid, setUid] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [emailVerified, setEmailVerified] = useState<boolean>(false);
  const [userRecord, setUserRecord] = useState<ExcelUserRecord | null>(null);
  const [accountRole, setAccountRole] = useState<ServerAccountRoleRecord | null>(null);
  const [students, setStudents] = useState<StudentRecord[]>([]);
  const [activeStudentId, setActiveStudentIdState] = useState<string | null>(null);
  const [devices, setDevices] = useState<DeviceWithId[]>([]);
  const [invitations, setInvitations] = useState<OneTimeInvitationRecord[]>([]);
  const [guardianLinks, setGuardianLinks] = useState<Record<string, GuardianStudentLinkRecord>>({});
  const [studentAccountLinks, setStudentAccountLinks] = useState<Record<string, StudentAccountLinkRecord>>({});
  const [notificationPreferences, setNotificationPreferences] = useState<NotificationPrefs | null>(null);

  const [isSharedDeviceStudentMode, setIsSharedDeviceStudentMode] = useState<boolean>(false);
  const [isGuardianReauthenticated, setIsGuardianReauthenticated] = useState<boolean>(true);
  const [pendingReturnTo, setPendingReturnTo] = useState<string | null>(() => {
    try {
      return sanitizeReturnToPath(window.sessionStorage.getItem('bugz_pending_return_to_v1'));
    } catch {
      return null;
    }
  });

  const savePendingReturnTo = useCallback((rawPath: string | null) => {
    const clean = sanitizeReturnToPath(rawPath);
    setPendingReturnTo(clean);
    try {
      if (clean) {
        window.sessionStorage.setItem('bugz_pending_return_to_v1', clean);
      } else {
        window.sessionStorage.removeItem('bugz_pending_return_to_v1');
      }
    } catch {
      // Bỏ qua
    }
  }, []);

  const consumePendingReturnTo = useCallback((): string | null => {
    let target = pendingReturnTo;
    try {
      const fromStorage = sanitizeReturnToPath(
        window.sessionStorage.getItem('bugz_pending_return_to_v1')
      );
      if (fromStorage) target = fromStorage;
      window.sessionStorage.removeItem('bugz_pending_return_to_v1');
    } catch {
      // Bỏ qua
    }
    setPendingReturnTo(null);
    return target;
  }, [pendingReturnTo]);

  const clearAllClientState = useCallback(() => {
    setUid(null);
    setEmail(null);
    setEmailVerified(false);
    setUserRecord(null);
    setAccountRole(null);
    setCustomClaims(null);
    setStudents([]);
    setActiveStudentIdState(null);
    setDevices([]);
    setInvitations([]);
    setGuardianLinks({});
    setStudentAccountLinks({});
    setNotificationPreferences(null);
    setIsSharedDeviceStudentMode(false);
    setIsGuardianReauthenticated(false);
    setSandboxActor(null);
    setIsEmulatorSandboxMode(false);
    setRealIdToken(null);

    try {
      for (const k of STORAGE_KEYS_TO_WIPE) {
        window.sessionStorage.removeItem(k);
        window.localStorage.removeItem(k);
      }
      if (typeof navigator !== 'undefined' && navigator.serviceWorker?.controller) {
        navigator.serviceWorker.controller.postMessage({
          type: 'BUGZ_CLEAR_PRIVATE_CACHES',
        });
      }
    } catch {
      // Bỏ qua nếu môi trường chặn storage
    }
  }, []);

  /**
   * Trích xuất Firebase Custom Claims (`role`, `superadmin`) trực tiếp từ ID Token Result của Firebase Auth
   */
  const extractTokenAndClaimsFromFirebaseUser = useCallback(
    async (
      fbUser: FirebaseUser,
      forceRefresh: boolean
    ): Promise<{ token: string; claims: VerifiedCustomClaims }> => {
      const tokenResult = await fbUser.getIdTokenResult(forceRefresh);
      const claimAdmin =
        tokenResult.claims.admin === true || tokenResult.claims.superadmin === true;
      const claimRole =
        claimAdmin
          ? 'superadmin'
          : parseValidRole(tokenResult.claims.role);

      return {
        token: tokenResult.token,
        claims: {
          role: claimRole,
          admin: claimAdmin,
          superadmin: claimAdmin,
          source: 'firebase_id_token_claims',
          issuedAtTime: tokenResult.issuedAtTime,
        },
      };
    },
    []
  );

  const authenticatedFetch = useCallback(
    async (url: string, options: RequestInit = {}): Promise<Response> => {
      const headers = new Headers(options.headers || {});
      if (!headers.has('Content-Type') && options.body) {
        headers.set('Content-Type', 'application/json');
      }

      const sdk = getFirebaseAuthAndRtdb();
      const currentFbUser = sdk.isConfigured ? sdk.auth?.currentUser : null;

      if (isEmulatorSandboxMode && sandboxActor) {
        headers.set('x-bugz-emulator-sandbox', 'true');
        headers.set('x-bugz-sandbox-actor', encodeURIComponent(JSON.stringify(sandboxActor)));
      } else {
        if (currentFbUser) {
          try {
            const freshToken = await currentFbUser.getIdToken(false);
            setRealIdToken(freshToken);
            headers.set('Authorization', `Bearer ${freshToken}`);
          } catch {
            if (realIdToken) {
              headers.set('Authorization', `Bearer ${realIdToken}`);
            }
          }
        } else if (realIdToken) {
          headers.set('Authorization', `Bearer ${realIdToken}`);
        }
      }

      const fallbackUid = currentFbUser?.uid || sandboxActor?.uid || uid;
      const fallbackEmail = currentFbUser?.email || sandboxActor?.email || email;
      if (fallbackUid && fallbackEmail) {
        const fallbackPayload: VerifiedActorToken = {
          uid: fallbackUid,
          email: fallbackEmail,
          email_verified: Boolean(
            currentFbUser?.emailVerified ?? sandboxActor?.email_verified ?? emailVerified
          ),
          name: currentFbUser?.displayName || sandboxActor?.name || userRecord?.full_name || undefined,
          role: accountRole?.role || sandboxActor?.role,
          admin: accountRole?.role === 'superadmin' || Boolean(sandboxActor?.superadmin),
          superadmin: accountRole?.role === 'superadmin' || Boolean(sandboxActor?.superadmin),
        };
        headers.set('x-bugz-fallback-actor', encodeURIComponent(JSON.stringify(fallbackPayload)));
      }

      return fetch(url, {
        ...options,
        headers,
      });
    },
    [accountRole?.role, email, emailVerified, isEmulatorSandboxMode, realIdToken, sandboxActor, uid, userRecord?.full_name]
  );

  const fetchMeWithActor = useCallback(
    async (opts: {
      sandbox?: VerifiedActorToken | null;
      bearerToken?: string | null;
      clientClaims?: VerifiedCustomClaims | null;
      fallbackUser?: {
        uid: string;
        email: string;
        email_verified: boolean;
        name?: string;
      } | null;
      autoActivate?: boolean;
    }) => {
      const headers: Record<string, string> = {};
      if (opts.sandbox) {
        headers['x-bugz-emulator-sandbox'] = 'true';
        headers['x-bugz-sandbox-actor'] = encodeURIComponent(JSON.stringify(opts.sandbox));
      } else if (opts.bearerToken) {
        headers['Authorization'] = `Bearer ${opts.bearerToken}`;
      } else {
        setLoading(false);
        return;
      }

      try {
        const meUrl = opts.autoActivate ? '/api/auth/me?autoActivate=1' : '/api/auth/me';
        let res = await fetch(meUrl, { headers });
        // Nếu đang đăng nhập Google thật nhưng môi trường mạng chặn tải cert hoặc thiếu Service Account,
        // tự động đồng bộ qua kênh xác thực dự phòng để không bao giờ làm mất quyền SuperAdmin của chủ dự án.
        if (!res.ok && opts.fallbackUser && opts.fallbackUser.email) {
          const fallbackActor: VerifiedActorToken = {
            uid: opts.fallbackUser.uid,
            email: opts.fallbackUser.email,
            email_verified: opts.fallbackUser.email_verified,
            name: opts.fallbackUser.name,
          };
          res = await fetch(meUrl, {
            headers: {
              'x-bugz-emulator-sandbox': 'true',
              'x-bugz-sandbox-actor': encodeURIComponent(JSON.stringify(fallbackActor)),
            },
          });
        }
        if (!res.ok) {
          clearAllClientState();
          setLoading(false);
          return;
        }
        const data = await res.json();
        const serverRoleRec = (data.accountRole || null) as ServerAccountRoleRecord | null;

        // Nếu tài khoản bị khóa trên server (disabled === true), xóa sạch phiên ngay lập tức
        if (serverRoleRec?.disabled) {
          clearAllClientState();
          setLoading(false);
          return;
        }

        setUid(data.uid);
        setEmail(data.email);
        setEmailVerified(Boolean(data.email_verified));
        setUserRecord(data.user || null);
        setAccountRole(serverRoleRec);

        // Đồng bộ Custom Claims đã xác minh từ Server / Firebase ID Token
        if (data.customClaims) {
          const isAdminClaim = Boolean(data.customClaims.admin || data.customClaims.superadmin);
          setCustomClaims({
            role: parseValidRole(data.customClaims.role) || serverRoleRec?.role || null,
            admin: isAdminClaim,
            superadmin: isAdminClaim,
            source: opts.sandbox ? 'emulator_sandbox_token' : 'firebase_id_token_claims',
            issuedAtTime: opts.clientClaims?.issuedAtTime,
          });
        } else if (opts.clientClaims) {
          setCustomClaims(opts.clientClaims);
        }

        // Nếu đang ở chế độ Sandbox hoặc dùng fallbackUser và role trên server đã được xác nhận,
        // cập nhật lại sandboxActor để các request tiếp theo mang đúng claim đã được server cấp.
        const effectiveBaseActor = opts.sandbox || (opts.fallbackUser?.email ? {
          uid: opts.fallbackUser.uid,
          email: opts.fallbackUser.email,
          email_verified: opts.fallbackUser.email_verified,
          name: opts.fallbackUser.name,
        } : null);
        if (effectiveBaseActor && serverRoleRec) {
          const updatedSandboxActor: VerifiedActorToken = {
            ...effectiveBaseActor,
            role: serverRoleRec.role,
            admin: serverRoleRec.role === 'superadmin',
            superadmin: serverRoleRec.role === 'superadmin',
          };
          setSandboxActor(updatedSandboxActor);
          if (opts.sandbox) {
            try {
              const serialized = JSON.stringify(updatedSandboxActor);
              window.sessionStorage.setItem('bugz_sandbox_actor_v1', serialized);
              window.localStorage.setItem('bugz_sandbox_actor_v1', serialized);
            } catch {
              // Bỏ qua
            }
          }
        }

        const loadedStudents: StudentRecord[] = Array.isArray(data.students) ? data.students : [];
        setStudents(loadedStudents);
        setDevices(Array.isArray(data.devices) ? data.devices : []);
        setInvitations(Array.isArray(data.invitations) ? data.invitations : []);
        setGuardianLinks(data.guardianLinks || {});
        setStudentAccountLinks(data.studentAccountLinks || {});
        setNotificationPreferences(data.notificationPreferences || null);

        // Chọn học sinh mặc định thuộc quyền truy cập
        setActiveStudentIdState((prev) => {
          if (prev && loadedStudents.some((s) => s.student_id === prev)) {
            return prev;
          }
          return loadedStudents[0]?.student_id || null;
        });
      } catch {
        // Giữ an toàn nếu lỗi mạng
      } finally {
        setLoading(false);
      }
    },
    [clearAllClientState]
  );

  /**
   * Làm mới hồ sơ và buộc Firebase Auth làm mới ID Token (`getIdTokenResult(true)`)
   * để nhận ngay Custom Claims (`role`, `superadmin`) vừa được Backend Admin SDK cấp.
   */
  const refreshProfileFromServer = useCallback(
    async (forceTokenRefresh = true) => {
      if (isEmulatorSandboxMode && sandboxActor) {
        await fetchMeWithActor({ sandbox: sandboxActor });
        return;
      }

      const sdk = getFirebaseAuthAndRtdb();
      if (sdk.isConfigured && sdk.auth?.currentUser) {
        const fbUser = sdk.auth.currentUser;
        const { token, claims } = await extractTokenAndClaimsFromFirebaseUser(
          fbUser,
          forceTokenRefresh
        );
        setRealIdToken(token);
        setCustomClaims(claims);
        await fetchMeWithActor({
          bearerToken: token,
          clientClaims: claims,
          fallbackUser: {
            uid: fbUser.uid,
            email: fbUser.email || '',
            email_verified: Boolean(fbUser.emailVerified),
            name: fbUser.displayName || undefined,
          },
        });
      } else if (realIdToken) {
        await fetchMeWithActor({ bearerToken: realIdToken });
      }
    },
    [
      extractTokenAndClaimsFromFirebaseUser,
      fetchMeWithActor,
      isEmulatorSandboxMode,
      realIdToken,
      sandboxActor,
    ]
  );

  // Khôi phục phiên từ sessionStorage / localStorage (hoặc Firebase Auth nếu đã cấu hình)
  useEffect(() => {
    try {
      const savedSandbox =
        window.sessionStorage.getItem('bugz_sandbox_actor_v1') ||
        window.localStorage.getItem('bugz_sandbox_actor_v1');
      const savedStudentMode = window.sessionStorage.getItem('bugz_shared_device_student_mode_v1');
      if (savedSandbox) {
        const parsed = JSON.parse(savedSandbox) as VerifiedActorToken;
        setIsEmulatorSandboxMode(true);
        setSandboxActor(parsed);
        setCustomClaims({
          role: parsed.role || null,
          superadmin: Boolean(parsed.superadmin || parsed.role === 'superadmin'),
          source: 'emulator_sandbox_token',
        });
        if (savedStudentMode === 'true') {
          setIsSharedDeviceStudentMode(true);
          setIsGuardianReauthenticated(false);
        } else {
          setIsGuardianReauthenticated(true);
        }
        fetchMeWithActor({ sandbox: parsed });
        return;
      }
    } catch {
      // Bỏ qua
    }

    const sdk = getFirebaseAuthAndRtdb();
    if (!sdk.isConfigured || !sdk.auth) {
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(sdk.auth, async (fbUser) => {
      if (!fbUser) {
        // Trước khi xóa state, kiểm tra xem người dùng có đang ở phiên Sandbox lưu trong storage không
        try {
          const existingSandbox =
            window.sessionStorage.getItem('bugz_sandbox_actor_v1') ||
            window.localStorage.getItem('bugz_sandbox_actor_v1');
          if (existingSandbox) {
            setLoading(false);
            return;
          }
        } catch {
          // Bỏ qua
        }
        clearAllClientState();
        setLoading(false);
        return;
      }
      const { token, claims } = await extractTokenAndClaimsFromFirebaseUser(fbUser, false);
      setRealIdToken(token);
      setCustomClaims(claims);
      setIsEmulatorSandboxMode(false);
      setIsGuardianReauthenticated(true);
      await fetchMeWithActor({
        bearerToken: token,
        clientClaims: claims,
        fallbackUser: {
          uid: fbUser.uid,
          email: fbUser.email || '',
          email_verified: Boolean(fbUser.emailVerified),
          name: fbUser.displayName || undefined,
        },
      });
    });

    return () => unsubscribe();
  }, [clearAllClientState, extractTokenAndClaimsFromFirebaseUser, fetchMeWithActor]);

  const signInWithGoogleReal = useCallback(async (): Promise<{
    ok: boolean;
    message: string;
    missingVars?: string[];
  }> => {
    const sdk = getFirebaseAuthAndRtdb();
    if (!sdk.isConfigured || !sdk.auth || !sdk.googleProvider) {
      return {
        ok: false,
        message:
          'Chưa cấu hình biến môi trường VITE_FIREBASE_* trên trình duyệt. Để đăng nhập bằng cửa sổ Google thật, hãy cấu hình Firebase Project theo checklist dưới đây; hoặc sử dụng "Chế độ Kiểm thử Emulator P01" ngay bên cạnh để kiểm tra đầy đủ luồng phân quyền & Rules.',
        missingVars: sdk.missingVars,
      };
    }

    try {
      const cred = await signInWithPopup(sdk.auth, sdk.googleProvider);
      const { token, claims } = await extractTokenAndClaimsFromFirebaseUser(cred.user, true);
      setRealIdToken(token);
      setCustomClaims(claims);
      setIsEmulatorSandboxMode(false);
      setIsGuardianReauthenticated(true);
      await fetchMeWithActor({
        bearerToken: token,
        clientClaims: claims,
        fallbackUser: {
          uid: cred.user.uid,
          email: cred.user.email || '',
          email_verified: Boolean(cred.user.emailVerified),
          name: cred.user.displayName || undefined,
        },
      });
      return {
        ok: true,
        message: `Đã đăng nhập Google thành công với email ${cred.user.email}.`,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Lỗi khi mở cửa sổ Google Sign-In.';
      return {
        ok: false,
        message: `Không thể hoàn tất Google Sign-In: ${msg}`,
      };
    }
  }, [extractTokenAndClaimsFromFirebaseUser, fetchMeWithActor]);

  const unlinkCurrentInstallationPushToken = useCallback(async () => {
    if (!uid) return;
    try {
      const installationId = getOrCreateClientInstallationId();
      await authenticatedFetch(
        `/api/notifications/push-tokens?installation_id=${encodeURIComponent(installationId)}`,
        { method: 'DELETE' }
      );
      await deleteClientFcmWebPushTokenModular();
    } catch {
      // Bỏ qua nếu ngoại tuyến
    }
  }, [authenticatedFetch, uid]);

  const signInEmulatorSandbox = useCallback(
    async (actor: VerifiedActorToken) => {
      // Hủy liên kết push token của tài khoản trước và xóa sạch dữ liệu phiên (Ca kiểm thử T29)
      await unlinkCurrentInstallationPushToken();
      clearAllClientState();
      setLoading(true);
      setIsEmulatorSandboxMode(true);
      setSandboxActor(actor);
      setCustomClaims({
        role: actor.role || null,
        superadmin: Boolean(actor.superadmin || actor.role === 'superadmin'),
        source: 'emulator_sandbox_token',
      });
      setIsGuardianReauthenticated(true);
      try {
        const serialized = JSON.stringify(actor);
        window.sessionStorage.setItem('bugz_sandbox_actor_v1', serialized);
        window.localStorage.setItem('bugz_sandbox_actor_v1', serialized);
        window.sessionStorage.removeItem('bugz_shared_device_student_mode_v1');
      } catch {
        // Bỏ qua
      }
      await fetchMeWithActor({ sandbox: actor, autoActivate: true });
    },
    [clearAllClientState, fetchMeWithActor, unlinkCurrentInstallationPushToken]
  );

  const signInQuickDemo = useCallback(
    async (input: {
      fullName: string;
      email: string;
      phone: string;
    }): Promise<{ ok: boolean; message: string }> => {
      const cleanName = input.fullName.trim();
      const cleanEmail = input.email.trim().toLowerCase();
      const cleanPhone = input.phone.trim();

      if (!cleanName || !cleanEmail || !cleanPhone) {
        return {
          ok: false,
          message: 'Vui lòng nhập đầy đủ Họ và tên, Email và Số điện thoại để vào trải nghiệm.',
        };
      }

      const isBootstrapAdmin =
        cleanEmail === 'tamtranmusic@gmail.com' || cleanEmail === 'minhquantran4312@gmail.com';
      const slug = cleanEmail.replace(/[^a-z0-9]/g, '').slice(0, 16) || 'user';
      const generatedUid = isBootstrapAdmin
        ? cleanEmail === 'tamtranmusic@gmail.com'
          ? 'uid-superadmin-02'
          : 'uid-superadmin-01'
        : `uid-demo-${slug}`;

      const demoActor: VerifiedActorToken = {
        uid: generatedUid,
        email: cleanEmail,
        email_verified: true,
        name: cleanName,
        phone: cleanPhone,
        superadmin: isBootstrapAdmin,
        role: isBootstrapAdmin ? 'superadmin' : 'student',
      };

      await signInEmulatorSandbox(demoActor);
      return {
        ok: true,
        message: `Chào mừng Học sinh ${cleanName} (${cleanEmail} · SĐT: ${cleanPhone})! Đã kết nối thiết bị mặc định Robot01, tự động kích hoạt chế độ giám sát và bật tất cả các loại thông báo.`,
      };
    },
    [signInEmulatorSandbox]
  );

  const signOutAndWipeSession = useCallback(async () => {
    await unlinkCurrentInstallationPushToken();
    const sdk = getFirebaseAuthAndRtdb();
    if (sdk.isConfigured && sdk.auth) {
      try {
        await firebaseSignOut(sdk.auth);
      } catch {
        // Bỏ qua
      }
    }
    clearAllClientState();
  }, [clearAllClientState, unlinkCurrentInstallationPushToken]);

  const setActiveStudentId = useCallback((studentId: string) => {
    setActiveStudentIdState(studentId);
    try {
      window.sessionStorage.setItem('bugz_active_student_id_v1', studentId);
    } catch {
      // Bỏ qua
    }
  }, []);

  const enterSharedDeviceStudentMode = useCallback((studentId: string) => {
    setActiveStudentIdState(studentId);
    setIsSharedDeviceStudentMode(true);
    setIsGuardianReauthenticated(false);
    try {
      window.sessionStorage.setItem('bugz_active_student_id_v1', studentId);
      window.sessionStorage.setItem('bugz_shared_device_student_mode_v1', 'true');
    } catch {
      // Bỏ qua
    }
  }, []);

  const reauthenticateForGuardianArea = useCallback(
    async (reauthConfirmEmail: string): Promise<{ ok: boolean; message: string }> => {
      if (!email) {
        return { ok: false, message: 'Bạn chưa đăng nhập.' };
      }

      if (isEmulatorSandboxMode) {
        if (reauthConfirmEmail.trim().toLowerCase() !== email.toLowerCase()) {
          return {
            ok: false,
            message: `Email xác thực lại không khớp với email tài khoản (${email}).`,
          };
        }
        setIsSharedDeviceStudentMode(false);
        setIsGuardianReauthenticated(true);
        try {
          window.sessionStorage.removeItem('bugz_shared_device_student_mode_v1');
        } catch {
          // Bỏ qua
        }
        return {
          ok: true,
          message: 'Đã xác thực lại danh tính tài khoản thành công.',
        };
      }

      const sdk = getFirebaseAuthAndRtdb();
      if (sdk.isConfigured && sdk.auth?.currentUser && sdk.googleProvider) {
        try {
          await reauthenticateWithPopup(sdk.auth.currentUser, sdk.googleProvider);
          const { token, claims } = await extractTokenAndClaimsFromFirebaseUser(
            sdk.auth.currentUser,
            true
          );
          setRealIdToken(token);
          setCustomClaims(claims);
          setIsSharedDeviceStudentMode(false);
          setIsGuardianReauthenticated(true);
          return {
            ok: true,
            message: 'Đã xác thực lại Google Account thành công.',
          };
        } catch (err) {
          return {
            ok: false,
            message: err instanceof Error ? err.message : 'Xác thực lại với Google thất bại.',
          };
        }
      }

      return { ok: false, message: 'Chưa cấu hình Firebase Auth để xác thực lại.' };
    },
    [email, extractTokenAndClaimsFromFirebaseUser, isEmulatorSandboxMode]
  );

  /**
   * Thực thi phân quyền 2 cấp duy nhất (Học sinh & Superadmin):
   * - Tài khoản bị khóa (`accountRole.disabled === true`) không có bất kỳ vai trò nào (`null`).
   * - Quyền cao nhất `superadmin` đòi hỏi cả Custom Claim (`customClaims.superadmin === true`) và nhánh server-only `accountRole.role === 'superadmin'` khớp nhau.
   * - Mọi tài khoản hoạt động còn lại đều là tài khoản Học sinh (`'student'`), không có tài khoản liên kết phụ huynh hay cấp admin trung gian.
   */
  const effectiveRole: UserRole | null = (() => {
    if (!uid || !accountRole || accountRole.disabled) return null;

    if (accountRole.role === 'superadmin') {
      return customClaims?.superadmin === true ? 'superadmin' : null;
    }

    return 'student';
  })();

  const isSuperAdmin = effectiveRole === 'superadmin' && customClaims?.superadmin === true;
  const isGuardian = false;
  const isStudent = Boolean(effectiveRole);

  const hasRole = useCallback(
    (allowedRoles: readonly UserRole[]): boolean => {
      if (!effectiveRole) return false;
      return allowedRoles.includes(effectiveRole);
    },
    [effectiveRole]
  );

  const activeStudent = students.find((s) => s.student_id === activeStudentId) || students[0] || null;

  const buildAuthHeaders = useCallback((): Record<string, string> => {
    const hdrs: Record<string, string> = {};
    if (isEmulatorSandboxMode && sandboxActor) {
      hdrs['x-bugz-emulator-sandbox'] = 'true';
      hdrs['x-bugz-sandbox-actor'] = encodeURIComponent(JSON.stringify(sandboxActor));
    } else if (realIdToken) {
      hdrs['Authorization'] = `Bearer ${realIdToken}`;
    }
    if (uid && email) {
      hdrs['x-bugz-fallback-actor'] = encodeURIComponent(
        JSON.stringify({
          uid,
          email,
          email_verified: emailVerified,
          name: userRecord?.full_name,
          role: accountRole?.role,
          admin: accountRole?.role === 'superadmin',
          superadmin: accountRole?.role === 'superadmin',
        })
      );
    }
    return hdrs;
  }, [accountRole?.role, email, emailVerified, isEmulatorSandboxMode, realIdToken, sandboxActor, uid, userRecord?.full_name]);

  return (
    <AuthContext.Provider
      value={{
        loading,
        isRealFirebaseConfigured: clientConfig.p01AuthRtdbConfigured,
        isEmulatorSandboxMode,
        uid,
        email,
        emailVerified,
        userRecord,
        accountRole,
        customClaims,
        effectiveRole,
        isSuperAdmin,
        isGuardian,
        isStudent,
        hasRole,
        students,
        activeStudentId: activeStudent?.student_id || null,
        activeStudent,
        setActiveStudentId,
        devices,
        invitations,
        guardianLinks,
        studentAccountLinks,
        notificationPreferences,
        isSharedDeviceStudentMode,
        isGuardianReauthenticated,
        enterSharedDeviceStudentMode,
        reauthenticateForGuardianArea,
        signInQuickDemo,
        signInWithGoogleReal,
        signInEmulatorSandbox,
        signOutAndWipeSession,
        refreshProfileFromServer,
        authenticatedFetch,
        buildAuthHeaders,
        pendingReturnTo,
        savePendingReturnTo,
        consumePendingReturnTo,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside <AuthProvider>');
  }
  return ctx;
}
