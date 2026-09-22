/* ============================================================
   خَيال · 08-session · الجلسة والشبكة و PWA
   الأجزاء: 27 (جلسة) · 32 (شبكة) · 36 (تثبيت وتخزين مؤقت)
   يستكمل K.api.account و K.network من الملفات السابقة
   ============================================================ */

'use strict';

(function () {
  const K = window.K;
  if (!K) { console.error('[session] النواة غير محمّلة'); return; }


  /* ═══════════════════════════════════════════════════════════
     الجزء 27 · إدارة الجلسة
     الواجهة العليا: boot · login · logout · signup · refresh
     ═══════════════════════════════════════════════════════════ */

  const session = (() => {
    const SESSION_KEY = 'khayal.session.v1';
    let booted = false;
    let refreshTimer = null;
    const listeners = new Set();

    /* ---- حالة موحّدة ---- */
    const state = () => ({
      status: K.store.get('authStatus', 'loading'),
      user: K.store.get('user', null),
      isAuthenticated: K.store.get('authStatus') === 'authenticated',
      isGuest: K.store.get('authStatus') === 'guest',
      isLoading: K.store.get('authStatus') === 'loading',
    });

    const notify = () => {
      const s = state();
      for (const fn of listeners) {
        K.utils.tryCatch(() => fn(s));
      }
    };

    K.store.subscribe('authStatus', notify);

    /* ---- تخزين آخر مستخدم (للتسريع فقط) ---- */
    const saveLastUser = (user) => {
      try {
        if (!user) {
          localStorage.removeItem(SESSION_KEY);
          return;
        }
        const minimal = {
          id: user.id,
          handle: user.handle,
          displayName: user.displayName,
          avatar: user.avatar,
          savedAt: Date.now(),
        };
        localStorage.setItem(SESSION_KEY, JSON.stringify(minimal));
      } catch (err) {
        console.warn('[session.save]', err);
      }
    };

    const readLastUser = () => {
      try {
        const raw = localStorage.getItem(SESSION_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        // نتجاهل ما تجاوز أسبوعين
        if (Date.now() - parsed.savedAt > 14 * 24 * 60 * 60 * 1000) {
          localStorage.removeItem(SESSION_KEY);
          return null;
        }
        return parsed;
      } catch {
        return null;
      }
    };

    /* ---- تمهيد الجلسة (يُستدعى عند إقلاع التطبيق) ---- */
    const boot = async (opts = {}) => {
      if (booted) return state();
      booted = true;

      K.store.set('authStatus', 'loading');

      // 1) نظرة سريعة على آخر مستخدم (لعرض فوري)
      const last = readLastUser();
      if (last && !opts.forceRemote) {
        // لا نضع المستخدم في الحالة — فقط نُخبر المهتمين أن هناك احتمالية
        K.utils.tryCatch(() => K.events.emit(document, 'khayal:session-hinted', { last }));
      }

      // 2) انتظر النواة إن كانت تسبق الجاهزية
      await K.ready();

      // 3) إن لم تكن الحالة راجعة من persist → اسأل الخادم
      const current = K.store.get('authStatus');
      if (current === 'authenticated' && K.store.get('user')?.id && !opts.forceRemote) {
        // جلسة موجودة في التخزين — تحقق بصمت
        K.utils.tryCatch(() => verifyInBackground());
        return state();
      }

      // 4) اطلب من الخادم
      try {
        const user = await K.api.account.me({ timeout: 8000 });
        if (user) {
          K.store.set('authStatus', 'authenticated');
          saveLastUser(user);
          scheduleRefresh();
        } else {
          K.store.set('authStatus', 'guest');
          K.store.set('user', null);
          saveLastUser(null);
        }
      } catch (err) {
        // فشل شبكي — لا نعلن زائراً، نُبقي حالة "loading" قصيرة ثم زائر
        console.warn('[session.boot]', err);
        K.store.set('authStatus', 'guest');
      }

      // إبلاغ إضافي للحالات الشاذة
      if (K.store.get('authStatus') === 'guest' && last) {
        // كان مسجّلاً والآن لا — قد تكون الجلسة انتهت
        K.store.set('session.expiredAt', Date.now(), { noPersist: true });
        saveLastUser(null);
      }

      return state();
    };

    /* ---- تحقق خلفي بلا إزعاج ---- */
    const verifyInBackground = async () => {
      try {
        const user = await K.api.account.me({ timeout: 6000 });
        if (!user) {
          // انتهت الجلسة أثناء وجودها محلياً
          await handleExpiry('verify-failed');
        } else {
          saveLastUser(user);
        }
      } catch (err) {
        // صامت — لا نزعج
        if (err instanceof K.errors.Auth) {
          await handleExpiry('auth-error');
        }
      }
    };

    /* ---- إنشاء حساب ---- */
    const signup = async (payload) => {
      K.store.set('authStatus', 'loading');
      try {
        const user = await K.api.account.signup(payload);
        saveLastUser(user);
        K.store.set('authStatus', 'authenticated');
        scheduleRefresh();
        K.utils.tryCatch(() => K.analytics?.track?.('signup-success'));
        return user;
      } catch (err) {
        K.store.set('authStatus', 'guest');
        K.sound.error();
        throw err;
      }
    };

    /* ---- تسجيل الدخول ---- */
    const login = async (payload) => {
      K.store.set('authStatus', 'loading');
      // rate limit محلي — 5 محاولات / 5 دقائق
      const rl = K.security.canDo('session:login', { max: 5, window: 5 * 60 * 1000 });
      if (!rl.allowed) {
        K.store.set('authStatus', 'guest');
        throw new K.errors.RateLimit('محاولات كثيرة — انتظر 5 دقائق قبل المحاولة مجدداً');
      }

      try {
        const user = await K.api.account.login(payload);
        saveLastUser(user);
        K.store.set('authStatus', 'authenticated');
        // أعد تعيين مكدس التنقل عند الدخول
        K.router.home();
        scheduleRefresh();
        K.security.resetRateLimit('session:login');
        K.utils.tryCatch(() => K.analytics?.track?.('login-success'));
        return user;
      } catch (err) {
        K.store.set('authStatus', 'guest');
        K.sound.error();
        throw err;
      }
    };

    /* ---- تسجيل الخروج ---- */
    const logout = async (opts = {}) => {
      const silent = opts.silent === true;
      K.store.set('authStatus', 'loading');

      try {
        await K.api.account.logout({ silent });
      } catch (err) {
        // حتى لو فشل الخادم، نُخرج المستخدم محلياً
        console.warn('[session.logout]', err);
      }

      // مسح شامل
      clearRefreshTimer();
      saveLastUser(null);

      // إعادة تعيين الحالة
      K.store.reset({
        keep: ['prefs'],
        noPersist: false,
      });
      K.store.set('authStatus', 'guest');

      // فرّغ مخازن محتوى
      K.utils.tryCatch(() => K.content?.resetAll?.());
      K.utils.tryCatch(() => K.actions?.cleanup?.());
      K.utils.tryCatch(() => K.messages?.reset?.());
      K.utils.tryCatch(() => K.notifications?.clear?.());

      // أعد للرئيسية
      K.router.home();

      if (!silent) K.sound.tap();
      return true;
    };

    /* ---- استجابة لانتهاء الجلسة ---- */
    const handleExpiry = async (reason = 'expired') => {
      if (K.store.get('authStatus') === 'guest') return;

      // أبلغ مرة واحدة فقط
      if (K.store.get('session.expiredAt')) return;
      K.store.set('session.expiredAt', Date.now(), { noPersist: true });

      // امسح الحالة لكن لا تفقد المفضّلات
      clearRefreshTimer();
      saveLastUser(null);
      K.store.set('user', null);
      K.store.set('authStatus', 'guest');
      K.utils.tryCatch(() => K.content?.resetAll?.());
      K.utils.tryCatch(() => K.actions?.cleanup?.());
      K.utils.tryCatch(() => K.messages?.reset?.());

      // إشعار المستخدم
      K.utils.tryCatch(() => K.overlays?.toast?.({
        type: 'warning',
        title: 'انتهت الجلسة',
        message: 'سجّل الدخول مجدداً للمتابعة',
        actionLabel: 'دخول',
        onAction: () => K.router.go('/welcome'),
        duration: 6000,
      }));

      K.utils.tryCatch(() => K.analytics?.track?.('session-expired', { reason }));
    };

    /* ---- تجديد دوري ---- */
    const scheduleRefresh = () => {
      clearRefreshTimer();
      // كل 40 دقيقة — داخل نافذة صلاحية CSRF عادة
      refreshTimer = setInterval(async () => {
        if (K.store.get('authStatus') !== 'authenticated') return;
        if (document.hidden) return;
        try {
          const user = await K.api.account.me({ timeout: 8000 });
          if (user) saveLastUser(user);
        } catch (err) {
          if (err instanceof K.errors.Auth) await handleExpiry('refresh-auth-failed');
        }
      }, 40 * 60 * 1000);
    };

    const clearRefreshTimer = () => {
      if (refreshTimer) {
        clearInterval(refreshTimer);
        refreshTimer = null;
      }
    };

    /* ---- مساعدة: هل يحتاج تسجيل دخول؟ ---- */
    const requireLogin = (reason = '') => {
      if (state().isAuthenticated) return true;
      K.utils.tryCatch(() => K.overlays?.toast?.({
        type: 'info',
        title: 'تحتاج تسجيل الدخول',
        message: reason || 'سجّل الدخول للمتابعة',
        actionLabel: 'دخول',
        onAction: () => K.router.go('/welcome'),
        duration: 4500,
      }));
      return false;
    };

    /* ---- الاشتراك في تغييرات الجلسة ---- */
    const subscribe = (fn, opts = {}) => {
      listeners.add(fn);
      if (opts.immediate) K.utils.tryCatch(() => fn(state()));
      return () => listeners.delete(fn);
    };

    /* ---- إعادة تحميل الحالة يدوياً ---- */
    const refresh = async () => {
      if (K.store.get('authStatus') !== 'authenticated') {
        return boot({ forceRemote: true });
      }
      try {
        const user = await K.api.account.me({ timeout: 8000 });
        if (user) saveLastUser(user);
        return state();
      } catch (err) {
        if (err instanceof K.errors.Auth) await handleExpiry('manual-refresh');
        throw err;
      }
    };

    return {
      boot, refresh,
      signup, login, logout,
      handleExpiry, requireLogin,
      subscribe, state,
      get isAuthenticated() { return state().isAuthenticated; },
      get user() { return state().user; },
    };
  })();

  K.session = session;


  /* ═══════════════════════════════════════════════════════════
     الجزء 32 · إدارة الشبكة
     مراقبة الاتصال · إشعار المستخدم · إعادة المحاولة
     ═══════════════════════════════════════════════════════════ */

  const networkManager = (() => {
    let banner = null;
    let bannerTimer = null;
    let lastOnlineAt = Date.now();

    /* ---- شريط الحالة ---- */

    const createBanner = () => {
      if (banner) return banner;
      const el = K.dom.el('div', {
        cls: 'k-network-banner',
        attrs: { role: 'status', 'aria-live': 'polite' },
      });
      el.style.cssText = `
        position: fixed;
        inset-inline: 0;
        inset-block-start: 0;
        z-index: 550;
        padding: 8px 16px;
        padding-block-start: calc(8px + env(safe-area-inset-top, 0px));
        font-family: var(--k-font-display);
        font-size: var(--k-fs-xs);
        font-weight: var(--k-fw-medium);
        text-align: center;
        background: var(--k-warning-500);
        color: #ffffff;
        transform: translateY(-100%);
        transition: transform 260ms cubic-bezier(0.4, 0, 0.2, 1);
        will-change: transform;
      `;
      document.body.appendChild(el);
      banner = el;
      return el;
    };

    const showBanner = (message, kind = 'warning') => {
      const el = createBanner();
      el.textContent = message;
      if (kind === 'error') {
        el.style.background = 'var(--k-error-500)';
      } else if (kind === 'success') {
        el.style.background = 'var(--k-success-500)';
      } else {
        el.style.background = 'var(--k-warning-500)';
      }
      el.style.transform = 'translateY(0)';
    };

    const hideBanner = (delay = 0) => {
      if (bannerTimer) clearTimeout(bannerTimer);
      const doHide = () => {
        if (banner) banner.style.transform = 'translateY(-100%)';
      };
      if (delay > 0) bannerTimer = setTimeout(doHide, delay);
      else doHide();
    };

    /* ---- استجابة للحالة ---- */

    const update = () => {
      const online = navigator.onLine !== false;
      const conn = navigator.connection;
      const type = conn?.effectiveType || 'unknown';
      const slow = type === '2g' || type === 'slow-2g';

      K.store.patch({
        network: {
          online,
          slow,
          effectiveType: type,
          lastChangeAt: Date.now(),
        },
      }, { noPersist: true });

      if (!online) {
        showBanner('لا يوجد اتصال — نعرض آخر محتوى محفوظ', 'warning');
      } else {
        const wasOffline = Date.now() - lastOnlineAt > 3000;
        lastOnlineAt = Date.now();
        if (wasOffline) {
          showBanner('عاد الاتصال', 'success');
          hideBanner(2400);
          // حاول إعادة تحميل ما فشل
          K.utils.tryCatch(() => retryFailedRequests());
        } else if (slow) {
          showBanner('اتصال بطيء — جودة أقل', 'warning');
          hideBanner(3000);
        } else {
          hideBanner();
        }
      }
    };

    /* ---- إعادة المحاولة للنماذج الفاشلة ---- */
    const retryQueue = [];

    /**
     * أضف عملية للطابور (تُنفّذ عند عودة الاتصال).
     * @param {Function} fn  يعيد Promise
     * @param {object} [opts]
     * @param {string} [opts.label]
     * @param {number} [opts.maxAttempts=3]
     */
    const queueRetry = (fn, opts = {}) => {
      const item = {
        fn,
        label: opts.label || 'عملية',
        attempts: 0,
        maxAttempts: opts.maxAttempts ?? 3,
      };
      retryQueue.push(item);
      if (navigator.onLine !== false) flushRetryQueue();
      return item;
    };

    const flushRetryQueue = async () => {
      if (!retryQueue.length) return;
      if (navigator.onLine === false) return;

      const items = retryQueue.splice(0, retryQueue.length);
      for (const item of items) {
        item.attempts += 1;
        try {
          await item.fn();
        } catch (err) {
          if (item.attempts < item.maxAttempts) {
            retryQueue.push(item);
          } else {
            console.warn('[network.retry-giveup]', item.label, err);
          }
        }
      }
      if (retryQueue.length) {
        setTimeout(flushRetryQueue, 5000);
      }
    };

    const retryFailedRequests = () => {
      flushRetryQueue();
    };

    /* ---- اختبار جودة الاتصال ---- */
    let probeTimer = null;
    const probe = async () => {
      if (navigator.onLine === false) return null;
      try {
        const started = performance.now();
        const res = await fetch('/api/health/ping', {
          method: 'HEAD',
          cache: 'no-store',
          credentials: 'same-origin',
        });
        const ms = performance.now() - started;
        return { ok: res.ok, latency: ms };
      } catch {
        return { ok: false, latency: null };
      }
    };

    const startProbe = (intervalMs = 90000) => {
      if (probeTimer) clearInterval(probeTimer);
      probeTimer = setInterval(async () => {
        if (document.hidden) return;
        const r = await probe();
        if (r && !r.ok && navigator.onLine !== false) {
          // الخادم لا يستجيب لكن الشبكة موجودة
          showBanner('الخادم بطيء الاستجابة…', 'warning');
          hideBanner(4000);
        }
      }, intervalMs);
    };

    /* ---- التهيئة ---- */

    const init = () => {
      window.addEventListener('online', update, { passive: true });
      window.addEventListener('offline', update, { passive: true });

      const conn = navigator.connection;
      if (conn && conn.addEventListener) {
        conn.addEventListener('change', update);
      }

      update();
      startProbe();

      // أعد المحاولة عند كل عودة من الخلفية
      document.addEventListener('visibilitychange', () => {
        if (!document.hidden && navigator.onLine !== false && retryQueue.length) {
          flushRetryQueue();
        }
      }, { passive: true });
    };

    return {
      init, update, queueRetry, flushRetryQueue,
      showBanner, hideBanner,
      get online() { return navigator.onLine !== false; },
      get queueSize() { return retryQueue.length; },
    };
  })();

  K.net = networkManager;


  /* ═══════════════════════════════════════════════════════════
     الجزء 36 · التثبيت والتخزين المؤقت (PWA)
     ═══════════════════════════════════════════════════════════ */

  const pwa = (() => {
    let installPromptEvent = null;
    let swRegistration = null;
    let updateAvailable = false;

    /* ---- تسجيل Service Worker ---- */

    const registerSW = async () => {
      if (!('serviceWorker' in navigator)) return null;
      if (location.protocol !== 'https:' && location.hostname !== 'localhost') {
        console.info('[pwa] SW يتطلب HTTPS');
        return null;
      }
      try {
        const reg = await navigator.serviceWorker.register('/sw.js', {
          scope: '/',
          updateViaCache: 'imports',
        });
        swRegistration = reg;

        // فحص تحديثات
        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing;
          if (!newWorker) return;
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              updateAvailable = true;
              K.store.set('pwa.updateAvailable', true, { noPersist: true });
              showUpdateToast();
            }
          });
        });

        // مراقبة تغييرات الـ SW الحالي
        navigator.serviceWorker.addEventListener('controllerchange', () => {
          // SW جديد تولّى — أعد التحميل مرة واحدة
          if (updateAvailable && !window.__reloaded__) {
            window.__reloaded__ = true;
            location.reload();
          }
        });

        // تحقق دوري (كل ساعة)
        setInterval(() => reg.update().catch(() => {}), 60 * 60 * 1000);

        return reg;
      } catch (err) {
        console.warn('[pwa.register]', err);
        return null;
      }
    };

    const showUpdateToast = () => {
      K.utils.tryCatch(() => K.overlays?.toast?.({
        type: 'info',
        title: 'تحديث جاهز',
        message: 'إصدار أحدث من خَيال متاح',
        actionLabel: 'تحديث',
        onAction: () => applyUpdate(),
        duration: 8000,
      }));
    };

    const applyUpdate = async () => {
      if (swRegistration?.waiting) {
        swRegistration.waiting.postMessage({ type: 'SKIP_WAITING' });
      } else {
        location.reload();
      }
    };

    /* ---- قبل التثبيت ---- */

    const initInstallFlow = () => {
      window.addEventListener('beforeinstallprompt', (evt) => {
        evt.preventDefault();
        installPromptEvent = evt;
        K.store.set('pwa.installable', true, { noPersist: true });
        // اقترح التثبيت بعد استخدام معيّن
        maybeSuggestInstall();
      }, { passive: false });

      window.addEventListener('appinstalled', () => {
        installPromptEvent = null;
        K.store.set('pwa.installed', true, { noPersist: true });
        K.store.set('pwa.installable', false, { noPersist: true });
        K.utils.tryCatch(() => K.overlays?.toast?.({
          type: 'success',
          title: 'شكراً لتثبيت خَيال',
          message: 'تجد التطبيق في شاشتك الرئيسية',
          duration: 3500,
        }));
      }, { passive: true });
    };

    /* ---- اقتراح تثبيت ذكي ---- */
    const maybeSuggestInstall = () => {
      const dismissedAt = K.store.get('pwa.dismissedAt', 0);
      const sessionCount = K.store.get('pwa.sessionCount', 0) + 1;
      K.store.set('pwa.sessionCount', sessionCount, { noPersist: true });

      // لا تقترح إن كان مثبتاً أو تم التجاهل مؤخراً
      if (K.store.get('pwa.installed')) return;
      if (Date.now() - dismissedAt < 3 * 24 * 60 * 60 * 1000) return;
      // لا تقترح في أول زيارتين
      if (sessionCount < 3) return;
      if (!installPromptEvent) return;

      // اقترح بعد 15 ثانية من الاستخدام
      setTimeout(() => {
        if (!installPromptEvent) return;
        showInstallPrompt();
      }, 15000);
    };

    const showInstallPrompt = async () => {
      if (!installPromptEvent) return false;

      // استخدم toast مع زر
      K.utils.tryCatch(() => K.overlays?.toast?.({
        type: 'info',
        title: 'ثبّت خَيال على جهازك',
        message: 'وصول أسرع · تصفّح بلا اتصال',
        actionLabel: 'تثبيت',
        onAction: async () => {
          try {
            installPromptEvent.prompt();
            const result = await installPromptEvent.userChoice;
            if (result.outcome === 'dismissed') {
              K.store.set('pwa.dismissedAt', Date.now());
            }
            installPromptEvent = null;
            K.store.set('pwa.installable', false, { noPersist: true });
          } catch (err) {
            console.warn('[pwa.prompt]', err);
          }
        },
        duration: 10000,
      }));
      return true;
    };

    /* ---- التخزين المؤقت ---- */

    /**
     * فحص استخدام التخزين.
     */
    const storageEstimate = async () => {
      if (!navigator.storage?.estimate) return null;
      try {
        const { usage = 0, quota = 0 } = await navigator.storage.estimate();
        return {
          usage,
          quota,
          percent: quota ? (usage / quota) * 100 : 0,
          usageLabel: K.format.fileSize(usage),
          quotaLabel: K.format.fileSize(quota),
        };
      } catch {
        return null;
      }
    };

    /** طلب تخزين دائم */
    const requestPersistentStorage = async () => {
      if (!navigator.storage?.persist) return false;
      try {
        const already = await navigator.storage.persisted();
        if (already) return true;
        const granted = await navigator.storage.persist();
        return granted;
      } catch {
        return false;
      }
    };

    /** مسح كل الكاش (لكن ليس الحساب) */
    const clearCache = async () => {
      try {
        // اطلب من SW مسح الكاش
        const reg = swRegistration || (await navigator.serviceWorker?.getRegistration());
        if (reg?.active) {
          reg.active.postMessage({ type: 'CLEAR_CACHE' });
        }
        // مسح يدوي لكل الكاش إن أمكن
        if ('caches' in window) {
          const names = await caches.keys();
          await Promise.all(names.map(n => caches.delete(n)));
        }
        K.utils.tryCatch(() => K.content?.resetAll?.());
        K.utils.tryCatch(() => K.overlays?.toast?.({
          type: 'success',
          title: 'مُسح الكاش',
          message: 'سيُعاد تحميل المحتوى عند الحاجة',
          duration: 2500,
        }));
        return true;
      } catch (err) {
        console.warn('[pwa.clearCache]', err);
        return false;
      }
    };

    /** حجم الكاش الحقيقي */
    const cacheSize = async () => {
      if (!('caches' in window)) return 0;
      try {
        let total = 0;
        const names = await caches.keys();
        for (const name of names) {
          const cache = await caches.open(name);
          const reqs = await cache.keys();
          for (const req of reqs) {
            const resp = await cache.match(req);
            if (resp) {
              const blob = await resp.clone().blob();
              total += blob.size;
            }
          }
        }
        return total;
      } catch {
        return 0;
      }
    };

    /* ---- حالة التثبيت ---- */

    const isStandalone = () => {
      if (window.matchMedia('(display-mode: standalone)').matches) return true;
      if (window.navigator.standalone === true) return true;
      return false;
    };

    const getInstallState = () => ({
      installable: !!installPromptEvent,
      installed: K.store.get('pwa.installed') || isStandalone(),
      standalone: isStandalone(),
      updateAvailable,
      sessionCount: K.store.get('pwa.sessionCount', 0),
    });

    /* ---- التهيئة ---- */

    const init = async () => {
      initInstallFlow();
      await registerSW();
      // اطلب تخزين دائم بهدوء
      K.idle(() => {
        requestPersistentStorage().catch(() => {});
      });
    };

    return {
      init,
      showInstallPrompt,
      applyUpdate,
      storageEstimate,
      requestPersistentStorage,
      clearCache,
      cacheSize,
      getInstallState,
      isStandalone,
      get installable() { return !!installPromptEvent; },
      get updateAvailable() { return updateAvailable; },
    };
  })();

  K.pwa = pwa;


  /* ═══════════════════════════════════════════════════════════
     التهيئة الموحّدة
     ═══════════════════════════════════════════════════════════ */

  const init = async () => {
    // 1) الشبكة أولاً (لتُعطي الحالة قبل أن نطلب)
    networkManager.init();

    // 2) PWA في الخلفية (لا تعطّل البدء)
    K.idle(() => pwa.init());

    // 3) الجلسة الآن — تربط كل شيء
    await session.boot();

    // 4) عند الخروج → نظّف
    window.addEventListener('pagehide', () => {
      networkManager.hideBanner();
    }, { passive: true });
  };


  /* ═══════════════════════════════════════════════════════════
     التصدير الموحّد
     ═══════════════════════════════════════════════════════════ */

  K.sessionFlow = {
    init,
    session,
    network: networkManager,
    pwa,
  };

  /* نهاية 08-session.js */
})();