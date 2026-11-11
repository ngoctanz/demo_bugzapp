import crypto from 'node:crypto';

export interface ServiceAccount {
  projectId?: string;
  project_id?: string;
  clientEmail?: string;
  client_email?: string;
  privateKey?: string;
  private_key?: string;
}

export interface Credential {
  getAccessToken(): Promise<{ access_token: string; expires_in: number }>;
  serviceAccount: ServiceAccount;
}

export interface AppOptions {
  credential?: Credential;
  databaseURL?: string;
  projectId?: string;
}

export interface App {
  name: string;
  options: AppOptions;
}

const ADMIN_SCOPES = [
  'https://www.googleapis.com/auth/firebase.database',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/identitytoolkit',
  'https://www.googleapis.com/auth/cloud-platform',
].join(' ');

function base64UrlEncode(input: Buffer | string): string {
  const buf = typeof input === 'string' ? Buffer.from(input, 'utf8') : input;
  return buf
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function base64UrlDecodeToBuffer(b64u: string): Buffer {
  const padded = b64u.replace(/-/g, '+').replace(/_/g, '/');
  const padLen = (4 - (padded.length % 4)) % 4;
  return Buffer.from(padded + '='.repeat(padLen), 'base64');
}

export function cert(serviceAccount: ServiceAccount): Credential {
  let cachedToken: { access_token: string; expiresAtMs: number } | null = null;

  return {
    serviceAccount,
    async getAccessToken(): Promise<{ access_token: string; expires_in: number }> {
      const nowMs = Date.now();
      if (cachedToken && cachedToken.expiresAtMs - nowMs > 60_000) {
        return {
          access_token: cachedToken.access_token,
          expires_in: Math.floor((cachedToken.expiresAtMs - nowMs) / 1000),
        };
      }

      const clientEmail = serviceAccount.client_email || serviceAccount.clientEmail || '';
      const rawPrivateKey = serviceAccount.private_key || serviceAccount.privateKey || '';
      const privateKey = rawPrivateKey.replace(/\\n/g, '\n');

      if (!clientEmail || !privateKey) {
        throw new Error('ServiceAccount thiếu client_email hoặc private_key.');
      }

      const iat = Math.floor(nowMs / 1000);
      const exp = iat + 3600;
      const header = base64UrlEncode(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
      const payload = base64UrlEncode(
        JSON.stringify({
          iss: clientEmail,
          sub: clientEmail,
          aud: 'https://oauth2.googleapis.com/token',
          iat,
          exp,
          scope: ADMIN_SCOPES,
        })
      );

      const unsignedJwt = `${header}.${payload}`;
      const signer = crypto.createSign('RSA-SHA256');
      signer.update(unsignedJwt);
      signer.end();
      const signature = base64UrlEncode(signer.sign(privateKey));
      const assertion = `${unsignedJwt}.${signature}`;

      const res = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
          assertion,
        }).toString(),
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`OAuth2 token exchange thất bại (${res.status}): ${errText}`);
      }

      const data = (await res.json()) as { access_token: string; expires_in?: number };
      const expiresIn = data.expires_in || 3600;
      cachedToken = {
        access_token: data.access_token,
        expiresAtMs: nowMs + expiresIn * 1000,
      };
      return { access_token: data.access_token, expires_in: expiresIn };
    },
  };
}

const appRegistry = new Map<string, App>();

export function getApps(): App[] {
  return Array.from(appRegistry.values());
}

export function getApp(name = '[DEFAULT]'): App {
  const existing = appRegistry.get(name);
  if (!existing) {
    throw new Error(`Firebase Admin App "${name}" chưa được khởi tạo.`);
  }
  return existing;
}

export function initializeApp(options: AppOptions = {}, name = '[DEFAULT]'): App {
  const existing = appRegistry.get(name);
  if (existing) return existing;
  const resolvedProjectId =
    options.projectId ||
    options.credential?.serviceAccount.project_id ||
    options.credential?.serviceAccount.projectId ||
    'gen-lang-client-0531599250';
  const app: App = {
    name,
    options: {
      ...options,
      projectId: resolvedProjectId,
    },
  };
  appRegistry.set(name, app);
  return app;
}

let cachedGooglePublicCerts: { certs: Record<string, string>; expiresAtMs: number } | null = null;

async function getFirebaseAuthPublicCerts(): Promise<Record<string, string>> {
  const nowMs = Date.now();
  if (cachedGooglePublicCerts && cachedGooglePublicCerts.expiresAtMs > nowMs) {
    return cachedGooglePublicCerts.certs;
  }
  const res = await fetch(
    'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com'
  );
  if (!res.ok) {
    throw new Error(`Không thể tải public certs của Firebase Auth (${res.status}).`);
  }
  const certs = (await res.json()) as Record<string, string>;
  cachedGooglePublicCerts = {
    certs,
    expiresAtMs: nowMs + 60 * 60 * 1000,
  };
  return certs;
}

export interface DecodedIdToken {
  uid: string;
  sub: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  admin?: boolean;
  superadmin?: boolean;
  role?: string;
  iat: number;
  exp: number;
  aud: string;
  iss: string;
  [key: string]: unknown;
}

export interface UserRecord {
  uid: string;
  email?: string;
  emailVerified: boolean;
  displayName?: string;
  disabled: boolean;
  customClaims?: Record<string, unknown>;
}

export function getAuth(app: App = getApp()) {
  const projectId =
    app.options.projectId ||
    app.options.credential?.serviceAccount.project_id ||
    'gen-lang-client-0531599250';

  async function requireAccessToken(): Promise<string> {
    if (!app.options.credential) {
      throw new Error('Firebase Admin App chưa có Service Account credential.');
    }
    const token = await app.options.credential.getAccessToken();
    return token.access_token;
  }

  return {
    async verifyIdToken(idToken: string, _checkRevoked = false): Promise<DecodedIdToken> {
      const parts = idToken.split('.');
      if (parts.length !== 3) {
        throw new Error('Định dạng Firebase ID Token không hợp lệ.');
      }
      const header = JSON.parse(base64UrlDecodeToBuffer(parts[0]).toString('utf8')) as {
        alg?: string;
        kid?: string;
      };
      const payload = JSON.parse(base64UrlDecodeToBuffer(parts[1]).toString('utf8')) as DecodedIdToken;

      const nowSec = Math.floor(Date.now() / 1000);
      if (payload.exp && payload.exp < nowSec - 30) {
        throw new Error('Firebase ID Token đã hết hạn.');
      }
      if (projectId && payload.aud && payload.aud !== projectId) {
        throw new Error(`Audience của token (${payload.aud}) không khớp projectId (${projectId}).`);
      }

      if (header.kid) {
        const certs = await getFirebaseAuthPublicCerts();
        const certPem = certs[header.kid];
        if (!certPem) {
          throw new Error('Không tìm thấy chứng chỉ khóa công khai khớp với kid của ID Token.');
        }
        const verifier = crypto.createVerify('RSA-SHA256');
        verifier.update(`${parts[0]}.${parts[1]}`);
        verifier.end();
        const sigValid = verifier.verify(certPem, base64UrlDecodeToBuffer(parts[2]));
        if (!sigValid) {
          throw new Error('Chữ ký RS256 của Firebase ID Token không hợp lệ.');
        }
      }

      return {
        ...payload,
        uid: payload.sub || payload.uid,
      };
    },

    async getUserByEmail(email: string): Promise<UserRecord> {
      const accessToken = await requireAccessToken();
      const res = await fetch(
        `https://identitytoolkit.googleapis.com/v1/projects/${projectId}/accounts:lookup`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ email: [email] }),
        }
      );
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`IdentityToolkit lookup thất bại (${res.status}): ${txt}`);
      }
      const data = (await res.json()) as {
        users?: Array<{
          localId: string;
          email?: string;
          emailVerified?: boolean;
          displayName?: string;
          disabled?: boolean;
          customAttributes?: string;
        }>;
      };
      const u = data.users?.[0];
      if (!u) {
        const notFoundErr = new Error(`Không tìm thấy user với email ${email}`) as Error & {
          code?: string;
        };
        notFoundErr.code = 'auth/user-not-found';
        throw notFoundErr;
      }
      let customClaims: Record<string, unknown> | undefined;
      if (u.customAttributes) {
        try {
          customClaims = JSON.parse(u.customAttributes) as Record<string, unknown>;
        } catch {
          customClaims = undefined;
        }
      }
      return {
        uid: u.localId,
        email: u.email,
        emailVerified: Boolean(u.emailVerified),
        displayName: u.displayName,
        disabled: Boolean(u.disabled),
        customClaims,
      };
    },

    async setCustomUserClaims(uid: string, claims: object | null): Promise<void> {
      const accessToken = await requireAccessToken();
      const res = await fetch(
        `https://identitytoolkit.googleapis.com/v1/projects/${projectId}/accounts:update`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            localId: uid,
            customAttributes: JSON.stringify(claims || {}),
          }),
        }
      );
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`setCustomUserClaims thất bại (${res.status}): ${txt}`);
      }
    },

    async updateUser(uid: string, properties: { disabled?: boolean }): Promise<void> {
      const accessToken = await requireAccessToken();
      const res = await fetch(
        `https://identitytoolkit.googleapis.com/v1/projects/${projectId}/accounts:update`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            localId: uid,
            disableUser: Boolean(properties.disabled),
          }),
        }
      );
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`updateUser thất bại (${res.status}): ${txt}`);
      }
    },

    async revokeRefreshTokens(uid: string): Promise<void> {
      const accessToken = await requireAccessToken();
      const res = await fetch(
        `https://identitytoolkit.googleapis.com/v1/projects/${projectId}/accounts:update`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            localId: uid,
            validSince: String(Math.floor(Date.now() / 1000)),
          }),
        }
      );
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`revokeRefreshTokens thất bại (${res.status}): ${txt}`);
      }
    },
  };
}

export interface DataSnapshot {
  exists(): boolean;
  val(): any;
}

export interface Reference {
  key: string | null;
  get(): Promise<DataSnapshot>;
  set(value: unknown): Promise<void>;
  update(values: Record<string, unknown>): Promise<void>;
  push(): Reference;
  transaction(
    transactionUpdate: (currentData: any) => any
  ): Promise<{ committed: boolean; snapshot: DataSnapshot }>;
}

export function getDatabase(app: App = getApp()) {
  const baseUrl = (
    app.options.databaseURL ||
    'https://gen-lang-client-0531599250-default-rtdb.asia-southeast1.firebasedatabase.app'
  ).replace(/\/+$/, '');

  async function requireAccessToken(): Promise<string> {
    if (!app.options.credential) {
      throw new Error('Firebase Admin App chưa có Service Account credential để truy cập RTDB.');
    }
    const token = await app.options.credential.getAccessToken();
    return token.access_token;
  }

  function buildRef(rawPath = '/'): Reference {
    const cleanPath = rawPath.replace(/^\/+|\/+$/g, '');
    const segments = cleanPath ? cleanPath.split('/') : [];
    const key = segments.length > 0 ? segments[segments.length - 1] : null;
    const jsonUrl = cleanPath ? `${baseUrl}/${cleanPath}.json` : `${baseUrl}/.json`;

    return {
      key,
      async get(): Promise<DataSnapshot> {
        const token = await requireAccessToken();
        const res = await fetch(jsonUrl, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) {
          const txt = await res.text();
          throw new Error(`RTDB GET ${cleanPath} thất bại (${res.status}): ${txt}`);
        }
        const data = await res.json();
        return {
          exists: () => data !== null && data !== undefined,
          val: () => data,
        };
      },

      async set(value: unknown): Promise<void> {
        const token = await requireAccessToken();
        const res = await fetch(jsonUrl, {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(value),
        });
        if (!res.ok) {
          const txt = await res.text();
          throw new Error(`RTDB SET ${cleanPath} thất bại (${res.status}): ${txt}`);
        }
      },

      async update(values: Record<string, unknown>): Promise<void> {
        const token = await requireAccessToken();
        const res = await fetch(jsonUrl, {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(values),
        });
        if (!res.ok) {
          const txt = await res.text();
          throw new Error(`RTDB UPDATE ${cleanPath} thất bại (${res.status}): ${txt}`);
        }
      },

      push(): Reference {
        const pushId = `-${Date.now().toString(36)}-${crypto.randomBytes(4).toString('hex')}`;
        const nextPath = cleanPath ? `${cleanPath}/${pushId}` : pushId;
        return buildRef(nextPath);
      },

      async transaction(
        transactionUpdate: (currentData: any) => any
      ): Promise<{ committed: boolean; snapshot: DataSnapshot }> {
        const token = await requireAccessToken();
        const getRes = await fetch(jsonUrl, {
          headers: {
            Authorization: `Bearer ${token}`,
            'X-Firebase-ETag': 'true',
          },
        });
        if (!getRes.ok) {
          const txt = await getRes.text();
          throw new Error(`RTDB transaction GET ${cleanPath} thất bại (${getRes.status}): ${txt}`);
        }
        const etag = getRes.headers.get('etag') || '';
        const currentVal = await getRes.json();
        const nextVal = transactionUpdate(currentVal);
        if (nextVal === undefined) {
          return {
            committed: false,
            snapshot: {
              exists: () => currentVal !== null && currentVal !== undefined,
              val: () => currentVal,
            },
          };
        }
        const putHeaders: Record<string, string> = {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        };
        if (etag) {
          putHeaders['if-match'] = etag;
        }
        const putRes = await fetch(jsonUrl, {
          method: 'PUT',
          headers: putHeaders,
          body: JSON.stringify(nextVal),
        });
        if (!putRes.ok) {
          return {
            committed: false,
            snapshot: {
              exists: () => false,
              val: () => null,
            },
          };
        }
        return {
          committed: true,
          snapshot: {
            exists: () => nextVal !== null && nextVal !== undefined,
            val: () => nextVal,
          },
        };
      },
    };
  }

  return {
    ref(path = '/'): Reference {
      return buildRef(path);
    },

    async setRules(rulesJsonText: string): Promise<void> {
      const token = await requireAccessToken();
      const res = await fetch(`${baseUrl}/.settings/rules.json`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: rulesJsonText,
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`RTDB setRules thất bại (${res.status}): ${txt}`);
      }
    },
  };
}
