/* ============================================================
   خَيال · 03-store · الحالة والمظهر والصوت والإشعارات
   الأجزاء: 31 (حالة) · 33 (مظهر) · 34 (صوت) · 35 (إشعارات)
   مصدر واحد للحقيقة · لا كتابة مباشرة من أي جزء آخر
   ============================================================ */

'use strict';

(function () {
  const K = window.K;
  if (!K) { console.error('[store] النواة غير محمّلة'); return; }

  /* ═══════════════════════════════════════════════════════════
     الجزء 31 · الحالة المركزية
     ═══════════════════════════════════════════════════════════ */

  const STORAGE_KEY = 'khayal.state.v1';

  /** الشكل الابتدائي الكامل للحالة */
  const INITIAL_STATE = Object.freeze({
    // المستخدم
    user: null,                    // {id, handle, displayName, avatar, verified} | null
    authStatus: 'loading',         // 'loading' | 'guest' | 'authenticated'

    // الموقع النشط
    activeSection: 'home',         // 'home' | 'explore' | 'notifications' | 'messages' | 'profile'

    // الفلاتر والترتيب
    filters: {
      sort: 'recent',              // 'recent' | 'trending' | 'top'
      tags: [],
      models: [],
      period: 'all',               // 'today' | 'week' | 'month' | 'all'
    },

    // البحث
    search: {
      query: '',
      type: 'all',                 // 'all' | 'posts' | 'users' | 'tags'
      history: [],                 // آخر 10 عمليات
    },

    // قوائم المحتوى المحمّلة (معرّفات فقط لتخفيف التخزين)
    feeds: {
      home:      { items: [], cursor: null, hasMore: true, loadedAt: 0 },
      explore:   { items: [], cursor: null, hasMore: true, loadedAt: 0 },
      likes:     { items: [], cursor: null, hasMore: true, loadedAt: 0 },
      saved:     { items: [], cursor: null, hasMore: true, loadedAt: 0 },
    },

    // النوافذ المفتوحة
    overlays: {
      modal: null,                 // معرّف النافذة أو null
      drawer: null,
      menu: null,
      toast: [],                   // [{id, type, title, message, action}]
    },

    // التفضيلات
    prefs: {
      theme: 'system',             // 'light' | 'dark' | 'system'
      soundEnabled: true,
      soundVolume: 0.6,            // 0..1
      hapticEnabled: true,
      autoplayVideos: false,
    },

    // الإشعارات
    notifications: {
      unread: 0,
      items: [],
      lastFetchedAt: 0,
    },

    // الشبكة
    network: {
      online: true,
      slow: false,
      lastChangeAt: 0,
    },

    // PWA
    pwa: {
      installable: false,
      installed: false,
      dismissedAt: 0,
    },
  });

  /** إنشاء نسخة عميقة من الحالة الابتدائية */
  const clone = (obj) => {
    if (typeof structuredClone === 'function') return structuredClone(obj);
    return JSON.parse(JSON.stringify(obj));
  };

  /* ---- مخزن مركزي مع اشتراكات مسارات ---- */

  const listeners = new Set();     // [{path, fn, id}] مبسّطة
  let state = clone(INITIAL_STATE);
  let hydrationDone = false;
  let persistScheduled = false;
  const history = [];              // آخر 20 تغيير (تشخيص)
  const MAX_HISTORY = 20;

  /** قراءة قيمة بعمق (a.b.c) */
  const get = (path, def) => {
    if (!path) return state;
    const parts = path.split('.');
    let cur = state;
    for (const p of parts) {
      if (cur == null) return def;
      cur = cur[p];
    }
    return cur === undefined ? def : cur;
  };

  /** استخراج القيم التي تغيّرت فعلياً عبر مقارنة ضحلة */
  const diffPaths = (path, prev, next) => {
    const changes = new Set();
    if (prev === next) return changes;
    if (
      prev == null || next == null ||
      typeof prev !== 'object' || typeof next !== 'object' ||
      Array.isArray(prev) !== Array.isArray(next)
    ) {
      changes.add(path);
      return changes;
    }
    const keys = new Set([...Object.keys(prev), ...Object.keys(next)]);
    for (const k of keys) {
      const sub = path ? `${path}.${k}` : k;
      const c = diffPaths(sub, prev[k], next[k]);
      for (const p of c) changes.add(p);
    }
    return changes;
  };

  /** مطابقة مسار المشترك مع مسار التغيير */
  const pathMatches = (listenerPath, changedPath) => {
    if (listenerPath === '*') return true;
    if (listenerPath === changedPath) return true;
    // مطابقة بادئة (a.b يسمع لـ a.b.c و a)
    if (changedPath.startsWith(listenerPath + '.')) return true;
    if (listenerPath.startsWith(changedPath + '.')) return true;
    return false;
  };

  /** إبلاغ المشتركين */
  const notify = (changedPaths) => {
    for (const sub of listeners) {
      let matched = false;
      for (const p of changedPaths) {
        if (pathMatches(sub.path, p)) { matched = true; break; }
      }
      if (!matched) continue;
      try {
        sub.fn(get(sub.path), sub.path);
      } catch (err) {
        console.error('[store.listener]', sub.path, err);
      }
    }
  };

  /** تعيين قيمة بعمق (immutable) */
  const set = (path, value, opts = {}) => {
    if (!path) return;
    const parts = path.split('.');
    const prevValue = get(path);

    // لا تغيير فعلي
    if (prevValue === value && !opts.force) return;

    // بناء نسخة جديدة (immer-like بسيط)
    const next = { ...state };
    let cur = next;
    for (let i = 0; i < parts.length - 1; i++) {
      const p = parts[i];
      cur[p] = Array.isArray(cur[p]) ? cur[p].slice() : { ...cur[p] };
      cur = cur[p];
    }
    cur[parts[parts.length - 1]] = value;

    const changed = diffPaths('', state, next);
    if (changed.size === 0 && !opts.force) return;

    state = next;

    // سجل مختصر للتشخيص
    history.unshift({ path, ts: Date.now() });
    if (history.length > MAX_HISTORY) history.length = MAX_HISTORY;

    // إبلاغ
    notify(changed);

    // حفظ مع تأجيل
    if (!opts.noPersist) schedulePersist();

    return changed;
  };

  /** تحديث عدة مسارات دفعة واحدة */
  const patch = (partial, opts = {}) => {
    if (!partial || typeof partial !== 'object') return;
    const allChanged = new Set();

    // دمج شجري بسيط
    const next = clone(state);
    const merge = (target, source) => {
      for (const k in source) {
        const v = source[k];
        if (v && typeof v === 'object' && !Array.isArray(v) && !(v instanceof Date)) {
          if (!target[k] || typeof target[k] !== 'object') target[k] = {};
          merge(target[k], v);
        } else {
          target[k] = v;
        }
      }
    };
    merge(next, partial);

    const changed = diffPaths('', state, next);
    if (changed.size === 0 && !opts.force) return;

    state = next;
    for (const p of changed) allChanged.add(p);

    history.unshift({ path: '[patch]', ts: Date.now() });
    if (history.length > MAX_HISTORY) history.length = MAX_HISTORY;

    notify(allChanged);
    if (!opts.noPersist) schedulePersist();

    return allChanged;
  };

  /** اشتراك في مسار */
  const subscribe = (path, fn, opts = {}) => {
    const sub = { path, fn, id: K.utils.uid('sub') };
    listeners.add(sub);
    // إطلاق فوري إن طُلب
    if (opts.immediate) {
      try { fn(get(path), path); } catch (e) { console.error('[store.subscribe.immediate]', e); }
    }
    return () => listeners.delete(sub);
  };

  /** اشتراك لمرة واحدة (يُلغى بعد أول تغيير) */
  const subscribeOnce = (path, fn) => {
    const off = subscribe(path, (val, p) => { off(); fn(val, p); });
    return off;
  };

  /** انتظار قيمة تحقق شرطاً */
  const waitFor = (path, predicate, timeout = 10000) => new Promise((resolve, reject) => {
    if (predicate(get(path))) return resolve(get(path));
    const timer = setTimeout(() => { off(); reject(new Error('waitFor timeout')); }, timeout);
    const off = subscribe(path, (val) => {
      if (predicate(val)) {
        clearTimeout(timer);
        off();
        resolve(val);
      }
    });
  });

  /* ---- الحفظ والاسترجاع ---- */

  const serializableSnapshot = () => {
    // لا نخزّن قوائم المحتوى كاملة — نحفظ مفاتيح أساسية فقط
    return {
      user: state.user,
      authStatus: state.authStatus,
      prefs: state.prefs,
      search: {
        history: state.search.history.slice(0, 10),
        type: state.search.type,
      },
      pwa: {
        dismissedAt: state.pwa.dismissedAt,
      },
    };
  };

  const schedulePersist = () => {
    if (persistScheduled) return;
    persistScheduled = true;
    K.idle(() => {
      persistScheduled = false;
      persistNow();
    }, 1500);
  };

  const persistNow = () => {
    try {
      const snap = serializableSnapshot();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(snap));
    } catch (err) {
      console.warn('[store.persist]', err);
    }
  };

  const hydrate = () => {
    if (hydrationDone) return;
    hydrationDone = true;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        const merged = clone(state);
        // دمج آمن مع التخطي عن القيم المتعارضة
        if (parsed.user) merged.user = parsed.user;
        if (parsed.authStatus) merged.authStatus = parsed.authStatus;
        if (parsed.prefs) merged.prefs = { ...merged.prefs, ...parsed.prefs };
        if (parsed.search) merged.search = { ...merged.search, ...parsed.search };
        if (parsed.pwa) merged.pwa = { ...merged.pwa, ...parsed.pwa };
        state = merged;
        notify(new Set(['*']));
      }
    } catch (err) {
      console.warn('[store.hydrate]', err);
    }
  };

  /** إعادة تعيين كامل */
  const reset = (opts = {}) => {
    const keep = opts.keep || [];
    const preserved = {};
    for (const p of keep) preserved[p] = get(p);
    state = clone(INITIAL_STATE);
    for (const p of keep) set(p, preserved[p], { noPersist: true });
    notify(new Set(['*']));
    if (!opts.noPersist) persistNow();
  };

  /* ---- واجهة مركزية ---- */
  const store = {
    get, set, patch, reset,
    subscribe, subscribeOnce, waitFor,
    hydrate, persistNow,
    get state() { return state; },
    get history() { return history.slice(); },
    snapshot: serializableSnapshot,
    // أدوات تشخيصية
    dump() {
      return {
        state: clone(state),
        listeners: listeners.size,
        history: history.slice(),
      };
    },
  };

  K.store = store;

  /* ═══════════════════════════════════════════════════════════
     الجزء 33 · إدارة المظهر
     ═══════════════════════════════════════════════════════════ */

  const theme = (() => {
    const mq = matchMedia('(prefers-color-scheme: dark)');
    let current = 'light';       // القيمة الفعلية المطبَّقة
    let userChoice = 'system';   // اختيار المستخدم

    const apply = (actual) => {
      current = actual;
      document.documentElement.dataset.theme = actual;
      // تحديث meta theme-color
      const meta = document.querySelector('meta[name="theme-color"]');
      if (meta) {
        meta.setAttribute('content', actual === 'dark' ? '#0e0d10' : '#faf8f4');
      }
      // إبلاغ الجسر (لتلوين شريط الحالة في WebView)
      K.utils.tryCatch(() => {
        window.KhayalBridge?.postMessage?.(JSON.stringify({
          type: 'theme-changed',
          theme: actual,
        }));
      });
    };

    const resolve = (choice) => {
      if (choice === 'system') return mq.matches ? 'dark' : 'light';
      return choice;
    };

    const set = (choice, opts = {}) => {
      userChoice = choice;
      const actual = resolve(choice);
      apply(actual);
      if (!opts.noPersist) {
        K.store.set('prefs.theme', choice);
      }
    };

    const toggle = () => {
      const next = current === 'dark' ? 'light' : 'dark';
      set(next);
    };

    const onSystemChange = () => {
      if (userChoice === 'system') {
        apply(resolve('system'));
      }
    };

    const init = () => {
      // اقرأ من الحالة المحفوظة
      const stored = K.store.get('prefs.theme', 'system');
      userChoice = stored;
      apply(resolve(stored));
      // راقب تغيّر تفضيل النظام
      if (mq.addEventListener) mq.addEventListener('change', onSystemChange);
      else if (mq.addListener) mq.addListener(onSystemChange);
      // اشترك في تغيّر التفضيل من الحالة
      K.store.subscribe('prefs.theme', (val) => {
        if (val && val !== userChoice) {
          userChoice = val;
          apply(resolve(val));
        }
      });
    };

    return {
      init, set, toggle, apply,
      get current() { return current; },
      get choice() { return userChoice; },
      get isDark() { return current === 'dark'; },
    };
  })();

  K.theme = theme;

  /* ═══════════════════════════════════════════════════════════
     الجزء 34 · إدارة الأصوات
     ═══════════════════════════════════════════════════════════ */

  const sound = (() => {
    const AUDIO_BASE = '/assets/sounds/';
    const pool = new Map();       // {url: HTMLAudioElement}
    let ctx = null;
    let unlocked = false;
    let lastPlayedAt = new Map(); // كتم التكرار السريع

    /** تحميل مقطع صوتي (مخبأ) */
    const load = (name) => {
      if (pool.has(name)) return pool.get(name);
      const el = new Audio(`${AUDIO_BASE}${name}.mp3`);
      el.preload = 'auto';
      el.crossOrigin = 'anonymous';
      pool.set(name, el);
      return el;
    };

    /** فك قفل الصوت (iOS يتطلب تفاعل مستخدم) */
    const unlock = () => {
      if (unlocked) return;
      try {
        // استئناف AudioContext إن وُجد
        if (!ctx) {
          const AC = window.AudioContext || window.webkitAudioContext;
          if (AC) ctx = new AC();
        }
        if (ctx && ctx.state === 'suspended') ctx.resume();
        // تشغيل صامت لفتح القناة
        const a = load('tap-soft');
        a.volume = 0;
        a.play().then(() => { a.pause(); a.currentTime = 0; }).catch(() => {});
        unlocked = true;
      } catch (err) {
        console.warn('[sound.unlock]', err);
      }
    };

    /**
     * تشغيل نبرة.
     * @param {string} name  'tap-soft' | 'success' | 'error'
     * @param {object} [opts]
     * @param {number} [opts.volume]  يتجاوز إعداد المستخدم
     * @param {number} [opts.throttleMs=80]  لا تُشغّل نفس النبرة قبل انقضاء المدة
     */
    const play = (name, opts = {}) => {
      if (!K.store.get('prefs.soundEnabled', true)) return;
      if (K.support.reducedMotion && name === 'tap-soft') {
        // لا نصدر نبرة النقر في وضع تقليل الحركة (سلوك متحفظ)
      }

      // كتم التكرار السريع
      const throttleMs = opts.throttleMs ?? 80;
      const last = lastPlayedAt.get(name) || 0;
      const now = performance.now();
      if (now - last < throttleMs) return;
      lastPlayedAt.set(name, now);

      const userVol = K.store.get('prefs.soundVolume', 0.6);
      const vol = K.utils.clamp(opts.volume ?? userVol, 0, 1);

      K.utils.tryCatch(() => {
        const base = load(name);
        const clone = base.cloneNode(true);
        clone.volume = vol;
        clone.play().catch(() => { /* فشل هادئ */ });
        // إزالة العقدة عند الانتهاء
        clone.addEventListener('ended', () => { clone.src = ''; }, { once: true });
      });
    };

    /** تشغيل النبرة بصيغة «أزرار» */
    const tap = () => play('tap-soft');

    /** نجاح (حفظ · نشر · متابعة) */
    const success = () => play('success');

    /** خطأ (فشل شبكي · رفض) */
    const error = () => play('error', { throttleMs: 200 });

    /** اهتزاز خفيف */
    const haptic = (pattern = 8) => {
      if (!K.store.get('prefs.hapticEnabled', true)) return;
      if (navigator.vibrate) navigator.vibrate(pattern);
    };

    const init = () => {
      // تحميل مسبق للمقاطع الصغيرة (idle)
      K.idle(() => {
        load('tap-soft');
        load('success');
        load('error');
      });
      // فك القفل عند أول تفاعل
      const onFirst = () => {
        unlock();
        document.removeEventListener('touchstart', onFirst);
        document.removeEventListener('click', onFirst);
        document.removeEventListener('keydown', onFirst);
      };
      document.addEventListener('touchstart', onFirst, { once: true, passive: true });
      document.addEventListener('click', onFirst, { once: true, passive: true });
      document.addEventListener('keydown', onFirst, { once: true, passive: true });
    };

    return { init, play, tap, success, error, haptic, unlock };
  })();

  K.sound = sound;

  /* ═══════════════════════════════════════════════════════════
     الجزء 35 · إدارة الإشعارات
     ═══════════════════════════════════════════════════════════ */

  const notifications = (() => {
    /** شكل الإشعار الواحد */
    const normalize = (raw) => ({
      id: raw.id,
      type: raw.type,                 // 'like' | 'comment' | 'follow' | 'save' | 'mention'
      actor: raw.actor || null,       // {id, handle, displayName, avatar}
      targetId: raw.targetId || null,
      targetThumb: raw.targetThumb || null,
      text: raw.text || '',
      unread: !!raw.unread,
      createdAt: raw.createdAt || Date.now(),
    });

    /** تحميل القائمة من الـ API */
    const load = async (opts = {}) => {
      try {
        const api = K.api?.notifications;
        if (!api?.list) return [];
        const res = await api.list({
          cursor: opts.cursor || null,
          limit: opts.limit || 30,
        });
        const items = (res?.items || []).map(normalize);
        if (opts.append) {
          const existing = K.store.get('notifications.items', []);
          K.store.set('notifications.items', [...existing, ...items]);
        } else {
          K.store.set('notifications.items', items);
        }
        K.store.set('notifications.lastFetchedAt', Date.now());
        return items;
      } catch (err) {
        console.warn('[notifications.load]', err);
        return [];
      }
    };

    /** تعيين العدّاد (يُستدعى من الـ API أو البث) */
    const setUnread = (n) => {
      K.store.set('notifications.unread', Math.max(0, Number(n) || 0));
    };

    /** زيادة بمقدار */
    const incrementUnread = (delta = 1) => {
      const cur = K.store.get('notifications.unread', 0);
      setUnread(cur + delta);
    };

    /** وسم واحد كمقروء */
    const markRead = (id) => {
      const items = K.store.get('notifications.items', []);
      let changed = false;
      const next = items.map(n => {
        if (n.id === id && n.unread) { changed = true; return { ...n, unread: false }; }
        return n;
      });
      if (!changed) return;
      K.store.set('notifications.items', next);
      const remaining = next.filter(n => n.unread).length;
      setUnread(remaining);
      // مزامنة مع الخادم
      K.utils.tryCatch(() => K.api?.notifications?.markRead?.(id));
    };

    /** وسم الكل كمقروء */
    const markAllRead = () => {
      const items = K.store.get('notifications.items', []);
      const next = items.map(n => ({ ...n, unread: false }));
      K.store.set('notifications.items', next);
      setUnread(0);
      K.utils.tryCatch(() => K.api?.notifications?.markAllRead?.());
    };

    /** إضافة إشعار محلي (Push arrives via WebSocket أو JSBridge) */
    const push = (raw) => {
      const item = normalize(raw);
      const items = K.store.get('notifications.items', []);
      // منع التكرار
      if (items.some(n => n.id === item.id)) return;
      K.store.set('notifications.items', [item, ...items]);
      if (item.unread) incrementUnread(1);
      // إشعار طائر
      K.utils.tryCatch(() => {
        K.overlays?.toast?.({
          type: item.type === 'like' ? 'info' : item.type === 'follow' ? 'success' : 'info',
          title: labelForType(item.type),
          message: item.text || `${item.actor?.displayName || 'مبدع'} تفاعل مع محتواك`,
          actionLabel: 'عرض',
          onAction: () => K.router.go(`/post/${item.targetId}`),
          duration: 4000,
        });
      });
    };

    const labelForType = (type) => ({
      like:    'إعجاب جديد',
      comment: 'تعليق جديد',
      follow:  'متابع جديد',
      save:    'حفظ منشورك',
      mention: 'إشارة إليك',
    }[type] || 'إشعار');

    /** مسح الكل */
    const clear = () => {
      K.store.set('notifications.items', []);
      setUnread(0);
    };

    const init = () => {
      // اشترك في العدّاد لتحديث شارة tabbar
      K.store.subscribe('notifications.unread', (n) => {
        K.utils.tryCatch(() => K.overlays?.setTabbarBadge?.('notifications', n));
      }, { immediate: true });
    };

    return {
      init, load, push, setUnread, incrementUnread,
      markRead, markAllRead, clear,
      get unread() { return K.store.get('notifications.unread', 0); },
      get items() { return K.store.get('notifications.items', []); },
    };
  })();

  K.notifications = notifications;

  /* ═══════════════════════════════════════════════════════════
     الشبكة (تكملة 31 · تُدار مع الحالة)
     ═══════════════════════════════════════════════════════════ */

  const network = (() => {
    const update = () => {
      const online = navigator.onLine !== false;
      const conn = navigator.connection;
      const slow = conn && (conn.saveData || conn.effectiveType === 'slow-2g' || conn.effectiveType === '2g');
      K.store.patch({
        network: {
          online,
          slow: !!slow,
          lastChangeAt: Date.now(),
        },
      }, { noPersist: true });
    };

    const init = () => {
      window.addEventListener('online', update, { passive: true });
      window.addEventListener('offline', update, { passive: true });
      const conn = navigator.connection;
      if (conn && conn.addEventListener) {
        conn.addEventListener('change', update);
      }
      update();
    };

    return { init, refresh: update };
  })();

  K.network = network;

  /* ═══════════════════════════════════════════════════════════
     التهيئة الموحّدة
     ═══════════════════════════════════════════════════════════ */

  const init = async () => {
    store.hydrate();
    theme.init();
    sound.init();
    notifications.init();
    network.init();

    // إفراغ الحالة عند إغلاق الصفحة (احتياطي)
    window.addEventListener('beforeunload', () => {
      K.utils.tryCatch(() => persistNow());
    }, { passive: true });

    // إفراغ دوري كل 30 ثانية
    setInterval(() => {
      K.utils.tryCatch(() => persistNow());
    }, 30000);
  };

  K.store.init = init;

  /* نهاية 03-store.js */
})();