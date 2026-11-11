const CACHE_NAME = 'bugz-shell-v1.6.0';
const APP_SHELL_URLS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon.svg',
  '/apple-touch-icon.png',
  '/pwa-192x192.png',
  '/pwa-512x512.png',
  '/pwa-maskable-512x512.png',
];

/**
 * Kiểm tra một URL có phải là endpoint/miền dữ liệu riêng tư tuyệt đối KHÔNG ĐƯỢC CACHE
 * trong Service Worker theo Mục 14.1 Artifact và Ca kiểm thử T19 / T29 hay không.
 */
function isPrivateOrApiUrl(url, request) {
  if (
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/captures/') ||
    url.hostname.includes('firebaseio.com') ||
    url.hostname.includes('firebasedatabase.app') ||
    url.hostname.includes('firebasestorage.app') ||
    url.hostname.includes('firebasestorage.googleapis.com') ||
    url.hostname.includes('googleapis.com') ||
    url.hostname.includes('identitytoolkit') ||
    url.hostname.includes('securetoken')
  ) {
    return true;
  }
  if (
    request &&
    request.headers &&
    (request.headers.get('authorization') ||
      request.headers.get('x-bugz-emulator-sandbox') ||
      request.headers.get('x-bugz-sandbox-actor'))
  ) {
    return true;
  }
  return false;
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.map((key) => {
            if (key !== CACHE_NAME) {
              return caches.delete(key);
            }
            return Promise.resolve();
          })
        )
      )
      .then(() => self.clients.claim())
  );
});

// QUY TẮC AN TOÀN (Mục 14.1 Artifact & Ca kiểm thử T19, T29):
// 1. TUYỆT ĐỐI KHÔNG cache ảnh capture riêng tư (/api/captures/*, *.firebasestorage.app)
//    hoặc dữ liệu người dùng (/api/*, *.firebasedatabase.app, *.firebaseio.com).
// 2. Hỗ trợ reload mọi route SPA (/learn/days/25, /robot/history, /alerts/:id, /games, /admin)
//    bằng Network-First cho navigation request và fallback về /index.html khi mất mạng.
self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (isPrivateOrApiUrl(url, request)) {
    return;
  }

  // SPA Navigation route reload support (Network-First -> fallback /index.html)
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() =>
        caches.match('/index.html').then((cached) => cached || Response.error())
      )
    );
    return;
  }

  // Chỉ xử lý tài nguyên cùng origin
  if (url.origin !== self.location.origin) {
    return;
  }

  // Tối ưu Cache-First + Stale-While-Revalidate cho bộ ảnh học liệu công khai (/assets/drive/*, /assets/bugz_learning_atlas.png) và gói AI Model Offline (/models/*)
  // Tuyệt đối KHÔNG áp dụng cho /api/captures/* (đã chặn ở isPrivateOrApiUrl phía trên)
  if (
    url.pathname.startsWith('/assets/drive/') ||
    url.pathname === '/assets/bugz_learning_atlas.png' ||
    url.pathname.startsWith('/models/')
  ) {
    event.respondWith(
      caches.open('bugz-public-media-webp-v1').then(async (mediaCache) => {
        const cached = await mediaCache.match(request);
        if (cached) {
          return cached;
        }
        try {
          const networkRes = await fetch(request);
          const ct = (networkRes.headers.get('content-type') || '').toLowerCase();
          if (
            networkRes.ok &&
            (ct.startsWith('image/') ||
              ct.startsWith('audio/') ||
              url.pathname.startsWith('/models/'))
          ) {
            mediaCache.put(request, networkRes.clone());
          }
          return networkRes;
        } catch {
          return cached || Response.error();
        }
      })
    );
    return;
  }

  event.respondWith(
    fetch(request).catch(() =>
      caches.match(request).then((cached) => {
        if (cached) return cached;
        if (request.destination === 'document') {
          return caches.match('/index.html');
        }
        return Response.error();
      })
    )
  );
});

// T29: Khi người dùng đăng xuất hoặc đổi tài khoản trên thiết bị dùng chung,
// xóa toàn bộ cache không thuộc APP_SHELL_URLS và đóng mọi thông báo OS của tài khoản trước.
self.addEventListener('message', (event) => {
  const data = event.data || {};
  if (data.type === 'BUGZ_CLEAR_PRIVATE_CACHES') {
    event.waitUntil(
      Promise.all([
        caches.keys().then((keys) =>
          Promise.all(
            keys.map(async (key) => {
              if (key !== CACHE_NAME) {
                return caches.delete(key);
              }
              const cache = await caches.open(CACHE_NAME);
              const cachedRequests = await cache.keys();
              await Promise.all(
                cachedRequests.map((req) => {
                  const reqUrl = new URL(req.url);
                  if (!APP_SHELL_URLS.includes(reqUrl.pathname)) {
                    return cache.delete(req);
                  }
                  return Promise.resolve(false);
                })
              );
              return true;
            })
          )
        ),
        self.registration.getNotifications
          ? self.registration
              .getNotifications()
              .then((notifs) => notifs.forEach((n) => n.close()))
          : Promise.resolve(),
      ])
    );
  }
});

// ============================================================================
// CHẶNG P04 & P06: TÍCH HỢP FCM WEB PUSH BACKGROUND & DEDUPE TRONG CÙNG PWA SERVICE WORKER
// - Phân biệt rõ Foreground (client đang visible -> gửi postMessage sang client deduplicator)
//   và Background (hiển thị 1 thông báo duy nhất với tag: bugz-alert-{alert_id}).
// - Không vừa để payload `notification` tự hiện vừa gọi `showNotification` lần 2 (T21).
// - Không bao giờ đính kèm ảnh trẻ em (capture) lên màn hình khóa (T24).
// ============================================================================
self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = {};
  }

  const data = payload.data || payload;
  const alertId = String(data.alert_id || 'alert-a-001');
  const deepLinkPath = String(data.deep_link_path || `/alerts/${alertId}`);
  const title = String(data.title || payload.notification?.title || 'BUGZ Đồng hành Tư thế Học tập');
  const body = String(
    data.body ||
      payload.notification?.body ||
      'Tư thế chưa phù hợp — Mình thả lỏng vai rồi chỉnh chỗ ngồi ngay ngắn nhé!'
  );

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((windowClients) => {
        let hasVisibleForegroundClient = false;
        for (const client of windowClients) {
          if (client.visibilityState === 'visible') {
            hasVisibleForegroundClient = true;
          }
          client.postMessage({
            type: 'BUGZ_FCM_PUSH_ARRIVED',
            alert_id: alertId,
            student_id: data.student_id || 'stu-a1',
            device_id: data.device_id || 'robot-fam-a-01',
            session_id: data.session_id || 'sess-a-001',
            message: body,
            deep_link_path: deepLinkPath,
            created_at: Number(data.created_at) || Date.now(),
          });
        }

        if (hasVisibleForegroundClient) {
          return Promise.resolve();
        }

        if (payload.notification && !data.force_sw_display) {
          return Promise.resolve();
        }

        return self.registration.showNotification(title, {
          body,
          icon: '/pwa-192x192.png',
          badge: '/pwa-192x192.png',
          tag: `bugz-alert-${alertId}`,
          renotify: false,
          data: {
            alert_id: alertId,
            deep_link_path: deepLinkPath,
          },
        });
      })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const notifData = event.notification.data || {};
  const alertId = String(notifData.alert_id || 'alert-a-001');
  const rawPath = String(notifData.deep_link_path || `/alerts/${alertId}`);
  const targetPath = rawPath.startsWith('/') && !rawPath.startsWith('//') ? rawPath : `/alerts/${alertId}`;

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((windowClients) => {
        for (const client of windowClients) {
          if ('focus' in client) {
            client.postMessage({
              type: 'BUGZ_NAVIGATE_DEEP_LINK',
              path: targetPath,
              alert_id: alertId,
            });
            return client.focus();
          }
        }
        if (self.clients.openWindow) {
          return self.clients.openWindow(targetPath);
        }
        return Promise.resolve();
      })
  );
});
