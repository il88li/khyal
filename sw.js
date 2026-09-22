/* ============================================================
   خَيال · Service Worker
   استراتيجيات: Cache-first للأصول · Network-first للـ API
   يدعم: SKIP_WAITING · CLEAR_CACHE (رسائل من 08-session.js)
   ============================================================ */

'use strict';

const VERSION = 'v1.0.0';
const SHELL_CACHE = `khayal-shell-${VERSION}`;
const RUNTIME_CACHE = `khayal-runtime-${VERSION}`;
const IMAGE_CACHE = `khayal-images-${VERSION}`;
const FONT_CACHE = `khayal-fonts-${VERSION}`;
const API_CACHE = `khayal-api-${VERSION}`;

const MAX_RUNTIME_ENTRIES = 80;
const MAX_IMAGE_ENTRIES = 120;
const API_CACHE_TTL_MS = 5 * 60 * 1000;   // 5 دقائق

/* ---- قائمة الأصول الحرجة (App Shell) ---- */
const SHELL_ASSETS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/styles/app.css',
  '/styles/01-foundations.css',
  '/styles/02-atoms.css',
  '/styles/03-overlays.css',
  '/styles/04-cards.css',
  '/styles/05-screens-a.css',
  '/styles/06-screens-b.css',
  '/styles/07-screens-c.css',
  '/styles/08-layout.css',
  '/assets/fonts/fonts.css',
  '/js/01-core.js',
  '/js/02-perf.js',
  '/js/03-store.js',
  '/js/04-api.js',
  '/js/05-content.js',
  '/js/06-interactions.js',
  '/js/07-social.js',
  '/js/08-session.js',
  '/js/09-overlays.js',
  '/js/10-app.js',
];

/* ---- القوالب — تُخزَّن أيضاً ---- */
const TEMPLATE_ASSETS = [
  '/views/landing.html',
  '/views/main.html',
  '/views/detail.html',
  '/views/_partials.html',
];

/* ═══════════════════════════════════════════════════════════
   التثبيت
   ═══════════════════════════════════════════════════════════ */

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(SHELL_CACHE);
    // نجمع كل المسارات — بعضها قد يفشل، نتابع البقية
    const results = await Promise.allSettled(
      [...SHELL_ASSETS, ...TEMPLATE_ASSETS].map(url =>
        cache.add(new Request(url, { cache: 'reload' }))
          .catch(err => {
            console.warn('[sw] فشل تخزين', url, err);
          })
      )
    );
    const ok = results.filter(r => r.status === 'fulfilled').length;
    console.info(`[sw] خُزّن ${ok}/${results.length} من الأصول`);
  })());
});

/* ═══════════════════════════════════════════════════════════
   التنشيط — نظّف الكاش القديم
   ═══════════════════════════════════════════════════════════ */

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    const keep = new Set([SHELL_CACHE, RUNTIME_CACHE, IMAGE_CACHE, FONT_CACHE, API_CACHE]);
    await Promise.all(
      keys.filter(k => !keep.has(k)).map(k => caches.delete(k))
    );
    // تولَّ التحكم فوراً
    await self.clients.claim();
  })());
});

/* ═══════════════════════════════════════════════════════════
   الرسائل — SKIP_WAITING · CLEAR_CACHE
   ═══════════════════════════════════════════════════════════ */

self.addEventListener('message', (event) => {
  const data = event.data || {};

  if (data.type === 'SKIP_WAITING') {
    self.skipWaiting();
    return;
  }

  if (data.type === 'CLEAR_CACHE') {
    event.waitUntil((async () => {
      const keys = await caches.keys();
      await Promise.all(keys.map(k => caches.delete(k)));
      const clients = await self.clients.matchAll({ type: 'window' });
      for (const client of clients) {
        client.postMessage({ type: 'CACHE_CLEARED' });
      }
    })());
    return;
  }

  if (data.type === 'PING') {
    event.source?.postMessage({ type: 'PONG', version: VERSION });
  }
});

/* ═══════════════════════════════════════════════════════════
   أدوات مساعدة
   ═══════════════════════════════════════════════════════════ */

const isSameOrigin = (url) => {
  try {
    return new URL(url).origin === self.location.origin;
  } catch {
    return false;
  }
};

const isHtmlRequest = (req) => {
  const accept = req.headers.get('accept') || '';
  return req.mode === 'navigate' || accept.includes('text/html');
};

const isAPICall = (url) => {
  try {
    return new URL(url).pathname.startsWith('/api/');
  } catch {
    return false;
  }
};

const isStaticAsset = (url) => {
  try {
    const p = new URL(url).pathname;
    return /\.(css|js|woff2?|ttf|otf)$/i.test(p);
  } catch {
    return false;
  }
};

const isImageRequest = (req, url) => {
  if (req.destination === 'image') return true;
  try {
    const p = new URL(url).pathname;
    return /\.(png|jpe?g|webp|gif|svg|avif)$/i.test(p);
  } catch {
    return false;
  }
};

/** تقليم ذاكرة التخزين المؤقت إلى حجم أقصى */
const trimCache = async (cacheName, maxEntries) => {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length <= maxEntries) return;
  const toRemove = keys.slice(0, keys.length - maxEntries);
  await Promise.all(toRemove.map(k => cache.delete(k)));
};

/* ═══════════════════════════════════════════════════════════
   الاستراتيجيات
   ═══════════════════════════════════════════════════════════ */

/** Cache First — للأصول الثابتة (CSS · JS · خطوط) */
const cacheFirst = async (req, cacheName) => {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(req, { ignoreSearch: false });
  if (cached) return cached;

  try {
    const fresh = await fetch(req);
    if (fresh.ok && fresh.status === 200) {
      cache.put(req, fresh.clone()).catch(() => {});
      trimCache(cacheName, MAX_RUNTIME_ENTRIES);
    }
    return fresh;
  } catch (err) {
    // فشل — جرّب نفس المسار بلا استعلام
    const fallback = await cache.match(req.url, { ignoreSearch: true });
    if (fallback) return fallback;
    throw err;
  }
};

/** Network First مع تراجع للكاش — للأصول الأساسية و HTML */
const networkFirst = async (req, cacheName, timeoutMs = 4000) => {
  const cache = await caches.open(cacheName);

  const timeout = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('timeout')), timeoutMs)
  );

  try {
    const fresh = await Promise.race([fetch(req), timeout]);
    if (fresh.ok && fresh.status === 200) {
      cache.put(req, fresh.clone()).catch(() => {});
    }
    return fresh;
  } catch {
    const cached = await cache.match(req, { ignoreSearch: true });
    if (cached) return cached;
    // جرّب fetch عادي (إن كان الفشل بسبب timeout)
    try { return await fetch(req); }
    catch (err) {
      if (isHtmlRequest(req)) {
        const shell = await caches.match('/index.html');
        if (shell) return shell;
      }
      throw err;
    }
  }
};

/** Stale-While-Revalidate — للصور */
const staleWhileRevalidate = async (req, cacheName, maxEntries) => {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(req);

  const networkPromise = fetch(req)
    .then(res => {
      if (res.ok && res.status === 200) {
        cache.put(req, res.clone()).catch(() => {});
        trimCache(cacheName, maxEntries);
      }
      return res;
    })
    .catch(() => null);

  return cached || (await networkPromise) || Response.error();
};

/** Network Only مع تراجع اختياري — للـ API */
const networkOnly = async (req, opts = {}) => {
  if (opts.cacheGet && req.method === 'GET') {
    const cache = await caches.open(API_CACHE);
    try {
      const fresh = await fetch(req);
      if (fresh.ok && fresh.status === 200) {
        // نخزّن مع رأس زمني خاص
        const headers = new Headers(fresh.headers);
        headers.set('sw-cached-at', String(Date.now()));
        const body = await fresh.clone().blob();
        const cachedResp = new Response(body, {
          status: fresh.status,
          statusText: fresh.statusText,
          headers,
        });
        cache.put(req, cachedResp).catch(() => {});
      }
      return fresh;
    } catch {
      const cached = await cache.match(req, { ignoreSearch: true });
      if (cached) {
        const cachedAt = parseInt(cached.headers.get('sw-cached-at') || '0', 10);
        if (Date.now() - cachedAt < API_CACHE_TTL_MS) return cached;
      }
      // لا شيء — أعِد استجابة خطأ موحّدة
      return new Response(
        JSON.stringify({ error: 'offline', message: 'لا يوجد اتصال — حاول لاحقاً' }),
        { status: 503, headers: { 'Content-Type': 'application/json' } }
      );
    }
  }
  return fetch(req);
};

/* ═══════════════════════════════════════════════════════════
   المستمع الرئيسي
   ═══════════════════════════════════════════════════════════ */

self.addEventListener('fetch', (event) => {
  const req = event.request;

  // تجاهل ما ليس GET
  if (req.method !== 'GET') return;

  // تجاهل الطلبات خارج الأصل (ما عدا صور https)
  if (!isSameOrigin(req.url) && !isImageRequest(req, req.url)) return;

  // تجاهل chrome-extension وغيرها
  if (req.url.startsWith('chrome-extension://')) return;

  // ═══ HTML ═══
  if (isHtmlRequest(req)) {
    event.respondWith(networkFirst(req, SHELL_CACHE, 3500));
    return;
  }

  // ═══ API ═══
  if (isAPICall(req.url)) {
    event.respondWith(networkOnly(req, { cacheGet: true }));
    return;
  }

  // ═══ صور (بما فيها خارج الأصل) ═══
  if (isImageRequest(req, req.url)) {
    event.respondWith(staleWhileRevalidate(req, IMAGE_CACHE, MAX_IMAGE_ENTRIES));
    return;
  }

  // ═══ خطوط ═══
  if (/\.(woff2?|ttf|otf)$/i.test(req.url) || req.destination === 'font') {
    event.respondWith(cacheFirst(req, FONT_CACHE));
    return;
  }

  // ═══ أصول ثابتة (CSS · JS) ═══
  if (isStaticAsset(req.url)) {
    event.respondWith(cacheFirst(req, RUNTIME_CACHE));
    return;
  }

  // ═══ قوالب HTML ═══
  if (req.url.includes('/views/')) {
    event.respondWith(cacheFirst(req, RUNTIME_CACHE));
    return;
  }

  // ═══ أي شيء آخر — Network First ═══
  event.respondWith(networkFirst(req, RUNTIME_CACHE, 5000));
});

/* ═══════════════════════════════════════════════════════════
   تجاوز: مزامنة في الخلفية (اختياري — لمنشورات فاشلة)
   ═══════════════════════════════════════════════════════════ */

self.addEventListener('sync', (event) => {
  if (event.tag === 'khayal-retry-queue') {
    event.waitUntil((async () => {
      const clients = await self.clients.matchAll({ type: 'window' });
      for (const client of clients) {
        client.postMessage({ type: 'SYNC_RETRY' });
      }
    })());
  }
});

/* ═══════════════════════════════════════════════════════════
   إشعارات الدفع (اختياري — للمستقبل)
   ═══════════════════════════════════════════════════════════ */

self.addEventListener('push', (event) => {
  if (!event.data) return;
  let payload;
  try { payload = event.data.json(); }
  catch { payload = { title: 'خَيال', body: event.data.text() }; }

  event.waitUntil(self.registration.showNotification(payload.title || 'خَيال', {
    body: payload.body || '',
    icon: '/assets/icons/pwa/icon-192.png',
    badge: '/assets/icons/pwa/icon-192.png',
    dir: 'rtl',
    lang: 'ar',
    tag: payload.tag || 'khayal-notification',
    data: { url: payload.url || '/' },
  }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil((async () => {
    const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of clients) {
      if (client.url.includes(self.location.origin)) {
        client.focus();
        client.postMessage({ type: 'NOTIFICATION_CLICK', url });
        return;
      }
    }
    self.clients.openWindow(url);
  })());
});