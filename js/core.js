/* ============================================================
   خَيال · 01-core · النواة
   الأدوات الداخلية المشتركة · تُحمَّل أولاً قبل أي جزء آخر
   لا innerHTML · لا innerText مُدمّر · لا استماع سلبي مفقود
   ============================================================ */

'use strict';

/* ═══════════════════════════════════════════════════════════
   الفراغ الآمن · كشف القدرات
   ═══════════════════════════════════════════════════════════ */

const K = (window.K = window.K || {});

K.support = {
  idleCallback:   typeof window.requestIdleCallback === 'function',
  intersection:   typeof window.IntersectionObserver === 'function',
  resizeObserver: typeof window.ResizeObserver === 'function',
  visualViewport: !!window.visualViewport,
  webgl:          (() => {
    try {
      const c = document.createElement('canvas');
      return !!(c.getContext('webgl') || c.getContext('experimental-webgl'));
    } catch { return false; }
  })(),
  reducedMotion:  matchMedia('(prefers-reduced-motion: reduce)').matches,
  saveData:       !!navigator.connection?.saveData,
  isWebView:      /(wv|WebView)/.test(navigator.userAgent),
};


/* ═══════════════════════════════════════════════════════════
   RAF Batching — تُجمَّع قراءات/كتابات DOM في إطار واحد
   ═══════════════════════════════════════════════════════════ */

K.raf = (() => {
  const reads = [];
  const writes = [];
  let scheduled = false;

  const flush = () => {
    scheduled = false;
    const r = reads.splice(0, reads.length);
    const w = writes.splice(0, writes.length);
    for (let i = 0; i < r.length; i++) {
      try { r[i](); } catch (e) { console.error('[raf.read]', e); }
    }
    for (let i = 0; i < w.length; i++) {
      try { w[i](); } catch (e) { console.error('[raf.write]', e); }
    }
  };

  const schedule = () => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(flush);
  };

  return {
    read(fn)  { reads.push(fn);  schedule(); },
    write(fn) { writes.push(fn); schedule(); },
    both(readFn, writeFn) { this.read(readFn); this.write(writeFn); },
    flush() { if (scheduled) { cancelAnimationFrame(scheduled); flush(); } },
  };
})();


/* ═══════════════════════════════════════════════════════════
   Idle Callback مع تراجع آمن
   ═══════════════════════════════════════════════════════════ */

K.idle = (fn, timeout = 2000) => {
  if (K.support.idleCallback) {
    return requestIdleCallback(fn, { timeout });
  }
  // WKWebView القديم وبعض WebViews لا تدعم requestIdleCallback
  const t = setTimeout(() => fn({
    didTimeout: true,
    timeRemaining: () => 0,
  }), 0);
  return { cancel: () => clearTimeout(t), __fallback__: true };
};

K.idle.cancel = (handle) => {
  if (!handle) return;
  if (handle.__fallback__) handle.cancel();
  else if (typeof cancelIdleCallback === 'function') cancelIdleCallback(handle);
};


/* ═══════════════════════════════════════════════════════════
   DOM — بناء آمن بلا innerHTML
   ═══════════════════════════════════════════════════════════ */

K.dom = {
  /**
   * إنشاء عنصر واحد.
   * @param {string} tag
   * @param {object} [opts]
   * @param {string} [opts.cls]       أصناف مفصولة بمسافة
   * @param {string} [opts.text]      نص خالص (يُحقن عبر textContent)
   * @param {object} [opts.attrs]     خصائص
   * @param {object} [opts.data]      خصائص data-*
   * @param {object} [opts.style]     أنماط مباشرة
   * @param {Node[]} [opts.children]  أبناء
   * @param {object} [opts.on]        مستمعو أحداث
   */
  el(tag, opts = {}) {
    const node = document.createElement(tag);
    if (opts.cls) node.className = opts.cls;
    if (opts.text != null) node.textContent = String(opts.text);
    if (opts.attrs) {
      for (const k in opts.attrs) {
        const v = opts.attrs[k];
        if (v == null || v === false) continue;
        if (v === true) node.setAttribute(k, '');
        else node.setAttribute(k, String(v));
      }
    }
    if (opts.data) {
      for (const k in opts.data) {
        const v = opts.data[k];
        if (v == null) continue;
        node.dataset[k] = String(v);
      }
    }
    if (opts.style) {
      for (const k in opts.style) node.style.setProperty(k, String(opts.style[k]));
    }
    if (opts.on) {
      for (const k in opts.on) node.addEventListener(k, opts.on[k]);
    }
    if (opts.children) {
      for (const child of opts.children) {
        if (child) node.appendChild(child);
      }
    }
    return node;
  },

  /** نص كعقدة نصية */
  text(str) {
    return document.createTextNode(String(str));
  },

  /** تفريغ عنصر بأمان */
  clear(node) {
    while (node.firstChild) node.removeChild(node.firstChild);
    return node;
  },

  /** استبدال المحتوى بمصفوفة عقد */
  replace(node, children) {
    K.dom.clear(node);
    const frag = document.createDocumentFragment();
    for (const c of children) if (c) frag.appendChild(c);
    node.appendChild(frag);
    return node;
  },

  /**
   * دمج دفعي للنص داخل عنصر — يستخدم textContent لا innerHTML.
   * إن أضفت سطراً جديداً يُفرَّغ فوراً.
   */
  appendText(node, chunk) {
    if (!node || !chunk) return;
    node.appendChild(document.createTextNode(chunk));
  },

  /** تعيين نص خالص */
  setText(node, text) {
    if (node) node.textContent = text == null ? '' : String(text);
    return node;
  },

  /** استعلام مختصر */
  qs(sel, root = document)  { return root.querySelector(sel); },
  qsa(sel, root = document) { return Array.from(root.querySelectorAll(sel)); },

  /** إزالة عنصر بأمان */
  remove(node) {
    if (node && node.parentNode) node.parentNode.removeChild(node);
  },

  /** إدراج عنصر بعد آخر */
  insertAfter(newNode, refNode) {
    if (!refNode || !refNode.parentNode) return;
    refNode.parentNode.insertBefore(newNode, refNode.nextSibling);
  },

  /** فتح/إغلاق صنف */
  toggleClass(node, cls, force) {
    if (!node) return;
    if (force === undefined) node.classList.toggle(cls);
    else node.classList.toggle(cls, !!force);
  },

  /** هل العنصر مرئي داخل نافذة العرض؟ */
  isVisible(node) {
    if (!node) return false;
    const rect = node.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.top < innerHeight;
  },

  /** تفعيل حاوية أثناء الانتقال عبر data-* */
  setState(node, key, value) {
    if (node && node.dataset) node.dataset[key] = String(value);
  },
};


/* ═══════════════════════════════════════════════════════════
   الأحداث — تفويض + مستمعون سلبيون افتراضياً للتمرير
   ═══════════════════════════════════════════════════════════ */

K.events = {
  /**
   * تفويض حدث على حاوية.
   * @param {Element} root
   * @param {string} type
   * @param {string} selector  (CSS)
   * @param {Function} handler
   * @param {object} [opts]    يُمرَّر إلى addEventListener
   */
  delegate(root, type, selector, handler, opts = {}) {
    const wrapped = (evt) => {
      const target = evt.target.closest(selector);
      if (target && root.contains(target)) handler.call(target, evt, target);
    };
    // wheel/touchmove/scroll سلبية افتراضياً لتفادي تقطيع التمرير
    const passive = opts.passive !== undefined ? opts.passive
      : (type === 'wheel' || type === 'touchmove' || type === 'touchstart' || type === 'scroll');
    root.addEventListener(type, wrapped, { ...opts, passive });
    return () => root.removeEventListener(type, wrapped, opts);
  },

  /** مستمع واحد */
  on(target, type, handler, opts = {}) {
    const passive = opts.passive !== undefined ? opts.passive
      : (type === 'wheel' || type === 'touchmove' || type === 'touchstart' || type === 'scroll');
    target.addEventListener(type, handler, { ...opts, passive });
    return () => target.removeEventListener(type, handler, opts);
  },

  /** مرة واحدة */
  once(target, type, handler, opts = {}) {
    target.addEventListener(type, handler, { ...opts, once: true });
  },

  /** إرسال حدث مخصص */
  emit(target, type, detail) {
    target.dispatchEvent(new CustomEvent(type, { detail, bubbles: true, cancelable: true }));
  },

  /** كتم حدث (تستخدمه الأزرار الداخلية) */
  stop(evt) {
    evt.stopPropagation();
    if (evt.cancelable) evt.preventDefault();
  },

  /** إيقاف الانتشار فقط */
  stopProp(evt) { evt.stopPropagation(); },

  /** كتم الحلقة الافتراضية فقط */
  prevent(evt) { if (evt.cancelable) evt.preventDefault(); },

  /** أحداث متعددة على عقدة */
  onMany(target, map) {
    const offs = [];
    for (const type in map) offs.push(K.events.on(target, type, map[type]));
    return () => offs.forEach(off => off());
  },
};


/* ═══════════════════════════════════════════════════════════
   format — تنسيق عربي أصيل
   ═══════════════════════════════════════════════════════════ */

K.format = (() => {
  const AR = new Intl.NumberFormat('ar-SA', { useGrouping: true });
  const AR_COMPACT = new Intl.NumberFormat('ar-SA', {
    notation: 'compact', compactDisplay: 'short', maximumFractionDigits: 1,
  });
  const AR_TIME = new Intl.DateTimeFormat('ar-SA', {
    hour: 'numeric', minute: '2-digit', hour12: true,
  });
  const AR_DATE = new Intl.DateTimeFormat('ar-SA', {
    day: 'numeric', month: 'short',
  });
  const AR_DATE_FULL = new Intl.DateTimeFormat('ar-SA', {
    weekday: 'long', day: 'numeric', month: 'long',
  });
  const AR_DATE_SHORT = new Intl.DateTimeFormat('ar-SA', {
    weekday: 'short', day: 'numeric', month: 'short',
  });

  const REL = new Intl.RelativeTimeFormat('ar-SA', { numeric: 'auto' });

  /**
   * جمع عربي ثلاثي (مفرد · مثنى · جمع).
   * @param {number} n
   * @param {string} singular   مثال: "منشور"
   * @param {string} dual       مثال: "منشوران"
   * @param {string} plural     مثال: "منشورات"
   * @param {string} [many]     مثال: "منشوراً" (11+)
   */
  const pluralize = (n, singular, dual, plural, many) => {
    if (n === 0) return `لا ${plural}`;
    if (n === 1) return singular;
    if (n === 2) return dual;
    if (n >= 3 && n <= 10) return `${AR.format(n)} ${plural}`;
    return `${AR.format(n)} ${many || singular}`;
  };

  /**
   * تنسيق نسبي منذ وقت مضى (بالعربية).
   * @param {number|Date} ts
   */
  const since = (ts) => {
    const then = ts instanceof Date ? ts.getTime() : ts;
    const diff = (Date.now() - then) / 1000;
    const abs = Math.abs(diff);

    if (abs < 60) return 'الآن';
    if (abs < 60 * 60) {
      const m = Math.floor(diff / 60);
      return m === 1 ? 'قبل دقيقة' : m === 2 ? 'قبل دقيقتين'
        : abs < 60 * 60 ? `قبل ${AR.format(m)} دقائق` : `قبل ${AR.format(m)} دقيقة`;
    }
    if (abs < 60 * 60 * 24) {
      const h = Math.floor(diff / 3600);
      return h === 1 ? 'قبل ساعة' : h === 2 ? 'قبل ساعتين'
        : h <= 10 ? `قبل ${AR.format(h)} ساعات` : `قبل ${AR.format(h)} ساعة`;
    }
    if (abs < 60 * 60 * 24 * 30) {
      const d = Math.floor(diff / 86400);
      return d === 1 ? 'قبل يوم' : d === 2 ? 'قبل يومين'
        : d <= 10 ? `قبل ${AR.format(d)} أيام` : `قبل ${AR.format(d)} يوماً`;
    }
    if (abs < 60 * 60 * 24 * 365) {
      const mo = Math.floor(diff / 2592000);
      return mo === 1 ? 'قبل شهر' : mo === 2 ? 'قبل شهرين'
        : mo <= 10 ? `قبل ${AR.format(mo)} أشهر` : `قبل ${AR.format(mo)} شهراً`;
    }
    const y = Math.floor(diff / 31536000);
    return y === 1 ? 'قبل سنة' : y === 2 ? 'قبل سنتين'
      : y <= 10 ? `قبل ${AR.format(y)} سنوات` : `قبل ${AR.format(y)} سنة`;
  };

  /** وقت (ساعة:دقيقة) */
  const time = (ts) => AR_TIME.format(ts instanceof Date ? ts : new Date(ts));

  /** تاريخ قصير */
  const date = (ts) => AR_DATE.format(ts instanceof Date ? ts : new Date(ts));

  /** تاريخ كامل مع اليوم */
  const dateFull = (ts) => AR_DATE_FULL.format(ts instanceof Date ? ts : new Date(ts));

  /** تاريخ مختصر (يوم الأسبوع + رقم + شهر) */
  const dateShort = (ts) => AR_DATE_SHORT.format(ts instanceof Date ? ts : new Date(ts));

  /** رقم بفواصل */
  const num = (n) => AR.format(Number(n) || 0);

  /** رقم مضغوط (1.2 ألف) */
  const compact = (n) => {
    const v = Number(n) || 0;
    if (v < 1000) return AR.format(v);
    return AR_COMPACT.format(v);
  };

  /** نسبة مئوية */
  const percent = (n, digits = 0) =>
    new Intl.NumberFormat('ar-SA', {
      style: 'percent', maximumFractionDigits: digits,
    }).format(n);

  /**
   * تسمية يوم ذكية: اليوم · أمس · اسم اليوم · تاريخ.
   */
  const dayLabel = (ts) => {
    const d = ts instanceof Date ? ts : new Date(ts);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const target = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const diffDays = Math.round((today - target) / 86400000);

    if (diffDays === 0) return 'اليوم';
    if (diffDays === 1) return 'أمس';
    if (diffDays < 7) {
      return new Intl.DateTimeFormat('ar-SA', { weekday: 'long' }).format(d);
    }
    return AR_DATE.format(d);
  };

  /**
   * وقت رسالة دردشة ذكي: اليوم → ساعة · أمس → "أمس" · أقدم → تاريخ.
   */
  const messageTime = (ts) => {
    const d = ts instanceof Date ? ts : new Date(ts);
    const now = new Date();
    const sameDay =
      d.getFullYear() === now.getFullYear() &&
      d.getMonth() === now.getMonth() &&
      d.getDate() === now.getDate();
    if (sameDay) return AR_TIME.format(d);
    const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
    if (d >= yesterday && d < now) return 'أمس';
    const withinWeek = (now - d) < 7 * 86400000;
    if (withinWeek) return new Intl.DateTimeFormat('ar-SA', { weekday: 'short' }).format(d);
    return AR_DATE.format(d);
  };

  /** تحويل رقم إلى أرقام عربية-هندية (اختياري) */
  const toArabicDigits = (str) => {
    const map = ['٠','١','٢','٣','٤','٥','٦','٧','٨','٩'];
    return String(str).replace(/\d/g, d => map[+d]);
  };

  /** تقليص نص طويل عند حدّ كلمات */
  const truncate = (str, max = 80, suffix = '…') => {
    const s = String(str || '').trim();
    if (s.length <= max) return s;
    return s.slice(0, s.lastIndexOf(' ', max - suffix.length)) + suffix;
  };

  /** تنسيق حجم ملف */
  const fileSize = (bytes) => {
    const b = Number(bytes) || 0;
    if (b < 1024) return `${AR.format(b)} بايت`;
    if (b < 1024 * 1024) return `${AR.format((b / 1024).toFixed(1))} ك.ب`;
    if (b < 1024 * 1024 * 1024) return `${AR.format((b / 1048576).toFixed(1))} م.ب`;
    return `${AR.format((b / 1073741824).toFixed(2))} ج.ب`;
  };

  return {
    since, time, date, dateFull, dateShort, dayLabel, messageTime,
    num, compact, percent, pluralize, toArabicDigits, truncate, fileSize,
    relative: (value, unit) => REL.format(value, unit),
  };
})();


/* ═══════════════════════════════════════════════════════════
   icons — محمّل sprite.svg مع تخزين مؤقت
   ═══════════════════════════════════════════════════════════ */

K.icons = (() => {
  let spriteLoaded = null;
  const SVG_NS = 'http://www.w3.org/2000/svg';
  const XLINK = 'http://www.w3.org/1999/xlink';
  const cache = new Map();

  /** تحميل sprite.svg مرة واحدة وحقنها في الصفحة */
  const loadSprite = (url = '/assets/icons/sprite.svg') => {
    if (spriteLoaded) return spriteLoaded;
    spriteLoaded = fetch(url, { cache: 'force-cache' })
      .then(r => {
        if (!r.ok) throw new Error('sprite fetch failed');
        return r.text();
      })
      .then(text => {
        const parser = new DOMParser();
        const doc = parser.parseFromString(text, 'image/svg+xml');
        const svg = doc.documentElement;
        svg.setAttribute('aria-hidden', 'true');
        svg.style.position = 'absolute';
        svg.style.width = '0';
        svg.style.height = '0';
        svg.style.overflow = 'hidden';
        svg.style.pointerEvents = 'none';
        document.body.insertBefore(svg, document.body.firstChild);
        return true;
      })
      .catch(err => {
        console.warn('[icons] تعذّر تحميل sprite', err);
        spriteLoaded = null;
        return false;
      });
    return spriteLoaded;
  };

  /**
   * إنشاء أيقونة — تُرجع <svg><use href="#id"></svg>.
   * @param {string} id       معرّف الرمز في sprite (بلا #)
   * @param {object} [opts]
   * @param {string} [opts.cls]
   * @param {number} [opts.size]      حجم بالبكسل (افتراضي 24)
   * @param {number} [opts.stroke]    سُمك الخط (افتراضي 1.5)
   * @param {string} [opts.label]     وصف للقارئ (إن غاب → aria-hidden)
   * @param {string} [opts.color]
   */
  const get = (id, opts = {}) => {
    const svg = document.createElementNS(SVG_NS, 'svg');
    if (opts.cls) svg.setAttribute('class', opts.cls);
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', String(opts.stroke ?? 1.5));
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');

    const size = opts.size ?? 24;
    svg.setAttribute('width', String(size));
    svg.setAttribute('height', String(size));

    if (opts.label) {
      svg.setAttribute('role', 'img');
      svg.setAttribute('aria-label', opts.label);
    } else {
      svg.setAttribute('aria-hidden', 'true');
      svg.setAttribute('focusable', 'false');
    }
    if (opts.color) svg.style.color = opts.color;

    const use = document.createElementNS(SVG_NS, 'use');
    use.setAttribute('href', `#${id}`);
    // WKWebView قديم يحتاج xlink:href
    use.setAttributeNS(XLINK, 'xlink:href', `#${id}`);
    svg.appendChild(use);

    cache.set(id, svg);
    return svg;
  };

  /** نسخة مستنسخة (لأن نفس العقدة لا تُركَّب في مكانين) */
  const clone = (id, opts) => get(id, opts);

  /** التحقق من وجود الرمز في sprite المحمّل */
  const has = (id) => {
    const sprite = document.getElementById(`${id}`);
    return !!sprite;
  };

  /** حشو عنصر بأيقونة (يفرّغه أولاً) */
  const fill = (node, id, opts) => {
    if (!node) return;
    K.dom.clear(node);
    node.appendChild(get(id, opts));
    return node;
  };

  /** استبدال *نص الرمز* داخل عنصر موجود بـ <use> */
  const mount = async (root = document) => {
    await loadSprite();
    K.dom.qsa('[data-icon]', root).forEach(node => {
      const id = node.dataset.icon;
      const size = parseInt(node.dataset.iconSize, 10) || 24;
      const stroke = parseFloat(node.dataset.iconStroke) || 1.5;
      const label = node.dataset.iconLabel || '';
      const cls = node.className;
      const opts = { cls, size, stroke, label };
      const icon = get(id, opts);
      node.replaceWith(icon);
    });
  };

  return { loadSprite, get, clone, has, fill, mount };
})();


/* ═══════════════════════════════════════════════════════════
   Router — hash-based · back stack · مسارات ديناميكية
   ═══════════════════════════════════════════════════════════ */

K.router = (() => {
  const routes = [];
  const stack = [];              // [{path, params, ts}]
  let current = null;
  let listeners = new Set();
  let renderInFlight = false;
  let scrollPositions = new Map();   // path → scrollTop

  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  /**
   * تسجيل مسار.
   * @param {string} pattern  مثل: '/post/:id' · '/' · '/profile/:handle'
   * @param {Function} handler  ({params, query, path}) => void | Promise<void>
   * @param {object} [opts]
   * @param {string} [opts.title]  عنوان الصفحة
   */
  const register = (pattern, handler, opts = {}) => {
    const keys = [];
    const regex = new RegExp('^' + pattern
      .replace(/:([A-Za-z0-9_]+)/g, (_, k) => { keys.push(k); return '([^/]+)'; })
      .replace(/\*/g, '.*')
      .split('/').map(esc).join('/')
      .replace(/\\\.\\\*/g, '.*') + '$');
    routes.push({ pattern, regex, keys, handler, opts });
  };

  const parseHash = () => {
    const raw = location.hash.replace(/^#/, '') || '/';
    const [path, queryStr] = raw.split('?');
    const query = Object.fromEntries(new URLSearchParams(queryStr || ''));
    return { path: path || '/', query };
  };

  const match = (path) => {
    for (const r of routes) {
      const m = path.match(r.regex);
      if (!m) continue;
      const params = {};
      r.keys.forEach((k, i) => { params[k] = decodeURIComponent(m[i + 1] || ''); });
      return { route: r, params };
    }
    return null;
  };

  /** حفظ موضع التمرير للشاشة الحالية */
  const saveScroll = () => {
    if (!current) return;
    const viewport = document.querySelector('.k-app__viewport');
    const screen = viewport && viewport.querySelector('.k-screen:not([data-state="exiting"])');
    if (screen) scrollPositions.set(current.path, screen.scrollTop);
  };

  /** استرجاع موضع التمرير */
  const restoreScroll = (path) => {
    const viewport = document.querySelector('.k-app__viewport');
    if (!viewport) return;
    const screen = viewport.querySelector('.k-screen:not([data-state="exiting"])');
    if (!screen) return;
    const y = scrollPositions.get(path) || 0;
    K.raf.write(() => { screen.scrollTop = y; });
  };

  const notify = (payload) => {
    for (const fn of listeners) {
      try { fn(payload); } catch (e) { console.error('[router.listener]', e); }
    }
  };

  /** تنفيذ الراوت المطابق */
  const render = async (type = 'default') => {
    if (renderInFlight) return;
    renderInFlight = true;
    try {
      const { path, query } = parseHash();
      const found = match(path);

      if (!found) {
        console.warn('[router] لا مطابقة للمسار:', path);
        renderInFlight = false;
        return;
      }

      saveScroll();

      const previous = current;
      const next = {
        path,
        params: found.params,
        query,
        title: found.route.opts.title || '',
        ts: Date.now(),
      };

      current = next;

      // إدارة المكدس
      if (type === 'push' && previous) stack.push(previous);
      if (type === 'pop' && stack.length) stack.pop();

      await Promise.resolve(found.route.handler({
        params: found.params,
        query,
        path,
        previous,
        transition: type,
      }));

      if (document.title !== next.title) {
        document.title = next.title ? `${next.title} · خَيال` : 'خَيال';
      }

      restoreScroll(path);
      notify({ type, to: next, from: previous });
    } catch (err) {
      console.error('[router.render]', err);
    } finally {
      renderInFlight = false;
    }
  };

  /** التنقّل إلى مسار جديد */
  const go = (path, opts = {}) => {
    const target = path.startsWith('/') ? path : `/${path}`;
    const full = `#${target}`;
    if (location.hash === full) return;
    if (opts.replace) {
      history.replaceState(null, '', full);
      render('replace');
    } else {
      history.pushState(null, '', full);
      render('push');
    }
  };

  /** الرجوع خطوة */
  const back = () => {
    if (stack.length > 1 || history.length > 1) history.back();
    else go('/');
  };

  /** استبدال (بلا إضافة للمكدس) */
  const replace = (path) => go(path, { replace: true });

  /** الرجوع للجذر */
  const home = () => replace('/');

  /** هل يمكن الرجوع؟ */
  const canGoBack = () => stack.length > 1;

  /** تسجيل مستمع */
  const on = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };

  /** الحالة الحالية */
  const getCurrent = () => current;

  /** المكدس (قراءة فقط) */
  const getStack = () => stack.slice();

  /** إعادة التحميل القسري */
  const reload = () => render('replace');

  /** بدء الاستماع */
  const start = () => {
    window.addEventListener('hashchange', () => render('pop'), { passive: true });
    window.addEventListener('popstate', () => render('pop'), { passive: true });
    render('replace');
  };

  return {
    register, go, back, replace, home, canGoBack,
    on, getCurrent, getStack, reload, start,
    saveScroll, restoreScroll,
  };
})();


/* ═══════════════════════════════════════════════════════════
   Utils — أدوات صغيرة عابرة
   ═══════════════════════════════════════════════════════════ */

K.utils = {
  /** تأخير قابل للإلغاء */
  debounce(fn, wait = 200, immediate = false) {
    let timer = null;
    return function (...args) {
      const ctx = this;
      const callNow = immediate && !timer;
      clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        if (!immediate) fn.apply(ctx, args);
      }, wait);
      if (callNow) fn.apply(ctx, args);
    };
  },

  /** تنفيذ مرة كل إطار على الأكثر */
  throttleRAF(fn) {
    let pending = false;
    let lastArgs = null;
    return function (...args) {
      lastArgs = args;
      if (pending) return;
      pending = true;
      requestAnimationFrame(() => {
        pending = false;
        fn.apply(this, lastArgs);
      });
    };
  },

  /** تفريغ رقمي آمن */
  clamp(v, min, max) { return Math.min(max, Math.max(min, v)); },

  /** توليد معرّف عشوائي قصير */
  uid(prefix = 'k') {
    return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  },

  /** نسخ نص إلى الحافظة مع تراجع آمن */
  async copy(text) {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        return true;
      }
      // تراجع: عنصر وسيط + execCommand
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'absolute';
      ta.style.insetInlineStart = '-9999px';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return ok;
    } catch (err) {
      console.error('[copy]', err);
      return false;
    }
  },

  /** تنزيل ملف (blob) */
  download(filename, content, type = 'text/plain;charset=utf-8') {
    const blob = content instanceof Blob ? content : new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  },

  /** تأجيل بسيط */
  sleep(ms) { return new Promise(r => setTimeout(r, ms)); },

  /** تنفيذ آمن مع تراجع */
  tryCatch(fn, fallback = null) {
    try { return fn(); } catch (e) { console.warn('[tryCatch]', e); return fallback; }
  },

  /** قراءة قيمة بعمق من كائن (a.b.c) */
  get(obj, path, def) {
    const parts = path.split('.');
    let cur = obj;
    for (const p of parts) {
      if (cur == null) return def;
      cur = cur[p];
    }
    return cur === undefined ? def : cur;
  },

  /** تعيين قيمة بعمق (a.b.c = v) */
  set(obj, path, value) {
    const parts = path.split('.');
    let cur = obj;
    for (let i = 0; i < parts.length - 1; i++) {
      const p = parts[i];
      if (!cur[p] || typeof cur[p] !== 'object') cur[p] = {};
      cur = cur[p];
    }
    cur[parts[parts.length - 1]] = value;
    return obj;
  },

  /** مقارنة ضحلة */
  shallowEqual(a, b) {
    if (a === b) return true;
    if (!a || !b) return false;
    const ka = Object.keys(a), kb = Object.keys(b);
    if (ka.length !== kb.length) return false;
    for (const k of ka) if (a[k] !== b[k]) return false;
    return true;
  },

  /** انتظار انتهاء فترة هدوء على دالة (للبحث) */
  settled(fn, wait = 400) {
    let timer = null;
    return (...args) => new Promise((resolve) => {
      clearTimeout(timer);
      timer = setTimeout(() => resolve(fn(...args)), wait);
    });
  },

  /** إزالة تكرار من مصفوفة كائنات بمفتاح */
  uniqueBy(arr, key) {
    const seen = new Set();
    return arr.filter(item => {
      const v = item[key];
      if (seen.has(v)) return false;
      seen.add(v);
      return true;
    });
  },

  /** تقسيم مصفوفة لدفعات */
  chunk(arr, size) {
    const out = [];
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
    return out;
  },
};


/* ═══════════════════════════════════════════════════════════
   أخطاء مُصنّفة (تُستخدم عبر المنصة)
   ═══════════════════════════════════════════════════════════ */

K.errors = {
  Network:  class extends Error { constructor(msg, status) { super(msg); this.name = 'NetworkError'; this.status = status; } },
  Auth:     class extends Error { constructor(msg) { super(msg); this.name = 'AuthError'; } },
  Validate: class extends Error { constructor(msg, field) { super(msg); this.name = 'ValidationError'; this.field = field; } },
  NotFound: class extends Error { constructor(msg) { super(msg); this.name = 'NotFoundError'; } },
  RateLimit:class extends Error { constructor(msg, retryAfter) { super(msg); this.name = 'RateLimitError'; this.retryAfter = retryAfter; } },
  Unknown:  class extends Error { constructor(msg, cause) { super(msg); this.name = 'UnknownError'; this.cause = cause; } },
};


/* ═══════════════════════════════════════════════════════════
   إشارة الجاهزية
   ═══════════════════════════════════════════════════════════ */

K.ready = () => new Promise(resolve => {
  if (document.readyState !== 'loading') return resolve();
  document.addEventListener('DOMContentLoaded', resolve, { once: true });
});

/* نهاية 01-core.js */