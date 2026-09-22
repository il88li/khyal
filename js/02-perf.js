/* ============================================================
   خَيال · 02-perf · الأداء
   Performance Shield · Streaming Render Optimizer · device-tier
   يعمل تلقائياً · يقيس · يقرّر · يخفّض قبل ظهور التقطيع
   ============================================================ */

'use strict';

(function () {
  const K = window.K;
  if (!K) { console.error('[perf] النواة غير محمّلة'); return; }

  /* ═══════════════════════════════════════════════════════════
     device-tier — كشف قدرات الجهاز وGPU والحرارة
     ═══════════════════════════════════════════════════════════ */

  const GPU_TIERS = {
    // معرّفات ضعيفة (Mali القديم · Adreno القديم · PowerVR · SwiftShader)
    low: [
      /Mali-4\d{2}/i, /Mali-T[1-6]\d{2}/i,
      /Adreno.*[23]\d{2}/i, /Adreno.*4[0-2]\d/i,
      /PowerVR.*SGX/i, /PowerVR.*Rogue G6/i,
      /SwiftShader/i, /llvmpipe/i, /Software/i,
      /Intel.*HD Graphics (2|3|4|5)\d{3}/i,
    ],
    // معرّفات متوسطة
    medium: [
      /Mali-G[5-6]\d/i, /Mali-T[7-8]\d{2}/i,
      /Adreno.*5\d{2}/i, /Adreno.*6[0-1]\d/i,
      /Intel.*UHD.*6\d{2}/i, /Intel.*Iris.*Plus/i,
      /PowerVR.*Rogue GE/i,
    ],
    // معرّفات عالية (Apple Silicon · Adreno حديث · Mali-G7x+)
    high: [
      /Apple M[1-9]/i, /Apple GPU/i,
      /Adreno.*7\d{2}/i, /Adreno.*8\d{2}/i,
      /Mali-G[7-9]\d/i, /Mali-G1\d{2}/i,
      /NVIDIA.*RTX/i, /NVIDIA.*GTX (16|20|30|40)/i,
      /AMD.*Radeon RX/i, /AMD.*RDNA/i,
    ],
  };

  const detectGPU = () => {
    if (!K.support.webgl) return { vendor: 'none', renderer: 'none', tier: 'low' };
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      if (!gl) return { vendor: 'none', renderer: 'none', tier: 'low' };

      const dbg = gl.getExtension('WEBGL_debug_renderer_info');
      const vendor = dbg ? gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL)   : gl.getParameter(gl.VENDOR);
      const renderer = dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);

      const combined = `${vendor} ${renderer}`;
      let tier = 'medium';
      if (GPU_TIERS.high.some(r => r.test(combined)))   tier = 'high';
      else if (GPU_TIERS.low.some(r => r.test(combined))) tier = 'low';

      // إضافة سياقية: عدد النوى القليلة ترجّح low
      if (tier === 'medium' && (navigator.hardwareConcurrency || 8) <= 4) tier = 'low';

      // إعادة التحرير
      gl.getExtension('WEBGL_lose_context')?.loseContext();

      return { vendor, renderer, tier };
    } catch (e) {
      return { vendor: 'unknown', renderer: 'unknown', tier: 'medium' };
    }
  };

  const readBattery = () => {
    if (!navigator.getBattery) return null;
    return navigator.getBattery().then(b => ({
      level: b.level,
      charging: b.charging,
      __battery__: b,
    })).catch(() => null);
  };

  const device = {
    memory: navigator.deviceMemory || 4,
    cores: navigator.hardwareConcurrency || 4,
    gpu: detectGPU(),
    connection: {
      effectiveType: navigator.connection?.effectiveType || 'unknown',
      saveData: !!navigator.connection?.saveData,
      downlink: navigator.connection?.downlink || 0,
    },
    battery: null,
    thermal: 'nominal',
    reducedMotion: K.support.reducedMotion,
    isWebView: K.support.isWebView,
    initialized: false,
  };

  /** حساب الفئة الابتدائية بناءً على المواصفات فقط */
  const computeInitialTier = () => {
    let score = 0;

    if (device.memory <= 2) score += 3;
    else if (device.memory <= 4) score += 1;

    if (device.cores <= 2) score += 3;
    else if (device.cores <= 4) score += 1;

    if (device.gpu.tier === 'low') score += 3;
    else if (device.gpu.tier === 'high') score -= 1;

    if (device.connection.saveData) score += 2;
    if (device.connection.effectiveType === '2g' || device.connection.effectiveType === 'slow-2g') score += 2;

    if (device.battery && device.battery.level < 0.20 && !device.battery.charging) score += 2;

    if (device.reducedMotion) score += 1;

    if (score >= 6) return 'low';
    if (score >= 3) return 'medium';
    return 'high';
  };

  device.initialize = async () => {
    if (device.initialized) return device;
    device.battery = await readBattery();
    device.initialized = true;
    return device;
  };

  /* ═══════════════════════════════════════════════════════════
     FPS Monitor — قياس دقيق عبر RAF + متابعة الانحدار
     ═══════════════════════════════════════════════════════════ */

  const fps = {
    current: 60,
    average: 60,
    min: 60,
    samples: [],
    maxSamples: 60,
    // عدد الإطارات المتتالية التي نزلت عن 45
    sustainedLow: 0,
    // عدد الإطارات المتتالية التي نزلت عن 30
    sustainedCritical: 0,
    paused: false,
  };

  let lastFrameTs = 0;
  let fpsRAF = 0;

  const tickFPS = (ts) => {
    if (fps.paused) { fpsRAF = requestAnimationFrame(tickFPS); return; }

    if (lastFrameTs) {
      const delta = ts - lastFrameTs;
      if (delta > 0 && delta < 500) {
        const inst = 1000 / delta;
        fps.current = inst;
        fps.samples.push(inst);
        if (fps.samples.length > fps.maxSamples) fps.samples.shift();

        let sum = 0, min = Infinity;
        for (const v of fps.samples) { sum += v; if (v < min) min = v; }
        fps.average = sum / fps.samples.length;
        fps.min = min;

        // انحدار متواصل
        if (inst < 45) fps.sustainedLow += 1; else fps.sustainedLow = 0;
        if (inst < 30) fps.sustainedCritical += 1; else fps.sustainedCritical = 0;

        // 60 إطاراً ≈ ثانية واحدة عند 60fps
        if (fps.sustainedCritical >= 60) onSustainedDegradation('critical');
        else if (fps.sustainedLow >= 90) onSustainedDegradation('warning');
      }
    }
    lastFrameTs = ts;
    fpsRAF = requestAnimationFrame(tickFPS);
  };

  /* ═══════════════════════════════════════════════════════════
     Performance Shield — التخفيض التدريجي
     ═══════════════════════════════════════════════════════════ */

  const shield = {
    tier: 'high',
    level: 0,               // 0 = مرتفع · 1 = متوسط · 2 = منخفض
    locked: false,          // يمنع التخفيض التلقائي إن طُلب
    listeners: new Set(),
  };

  const TIER_TO_LEVEL = { high: 0, medium: 1, low: 2 };
  const LEVEL_TO_TIER = ['high', 'medium', 'low'];

  const applyShield = (level) => {
    if (shield.locked && level > shield.level) return;
    if (level === shield.level && document.documentElement.dataset.perf) return;

    shield.level = level;
    shield.tier = LEVEL_TO_TIER[level];

    // إعادة وسم DOM — كل CSS [data-perf] سيعاد تطبيقه
    const html = document.documentElement;
    html.dataset.perf = shield.tier;
    html.dataset.perfLevel = String(level);

    // إطالة مدد الحركة على المستويات الأدنى
    if (level >= 1) {
      html.style.setProperty('--k-dur-fast', '200ms');
      html.style.setProperty('--k-dur-base', '280ms');
      html.style.setProperty('--k-dur-slow', '380ms');
    } else {
      html.style.removeProperty('--k-dur-fast');
      html.style.removeProperty('--k-dur-base');
      html.style.removeProperty('--k-dur-slow');
    }

    // إخماد الجسيمات والتأثيرات الثقيلة تماماً على low
    if (level >= 2) {
      html.dataset.perfParticles = 'off';
      html.dataset.perfBlur = 'off';
      html.dataset.perfShadows = 'cheap';
    } else if (level === 1) {
      html.removeAttribute('data-perf-particles');
      html.dataset.perfBlur = 'reduced';
      html.dataset.perfShadows = 'normal';
    } else {
      html.removeAttribute('data-perf-particles');
      html.removeAttribute('data-perf-blur');
      html.removeAttribute('data-perf-shadows');
    }

    // إبلاغ المستمعين
    for (const fn of shield.listeners) {
      try { fn({ level, tier: shield.tier, reason: shield.lastReason || 'auto' }); }
      catch (e) { console.error('[shield.listener]', e); }
    }
  };

  const onSustainedDegradation = (severity) => {
    if (shield.locked) return;
    if (severity === 'critical' && shield.level < 2) {
      shield.lastReason = 'fps-critical';
      applyShield(2);
    } else if (severity === 'warning' && shield.level < 1) {
      shield.lastReason = 'fps-warning';
      applyShield(1);
    }
  };

  const shieldAPI = {
    /** يدوي: تخفيض بمستوى واحد */
    degrade(reason = 'manual') {
      if (shield.level < 2) {
        shield.lastReason = reason;
        applyShield(shield.level + 1);
      }
    },
    /** يدوي: رفع بمستوى واحد */
    upgrade(reason = 'manual') {
      if (shield.level > 0) {
        shield.lastReason = reason;
        applyShield(shield.level - 1);
      }
    },
    /** قفل المستوى الحالي — يمنع التخفيض التلقائي */
    lock() { shield.locked = true; },
    unlock() { shield.locked = false; },
    /** تعيين صريح */
    set(level, reason = 'manual') {
      shield.lastReason = reason;
      applyShield(K.utils.clamp(level, 0, 2));
    },
    /** الحالة الحالية */
    get() {
      return {
        level: shield.level,
        tier: shield.tier,
        locked: shield.locked,
        reason: shield.lastReason || 'auto',
        fps: { current: fps.current, average: fps.average, min: fps.min },
      };
    },
    /** تسجيل مستمع */
    on(fn) { shield.listeners.add(fn); return () => shield.listeners.delete(fn); },
  };

  /* ═══════════════════════════════════════════════════════════
     مراقبة Battery Saver + reduced-motion + الشبكة
     ═══════════════════════════════════════════════════════════ */

  const watchBattery = () => {
    const b = device.battery?.__battery__;
    if (!b) return;
    const onChange = () => {
      device.battery.level = b.level;
      device.battery.charging = b.charging;
      if (b.level < 0.15 && !b.charging && shield.level < 1) {
        shieldAPI.set(1, 'battery-low');
      }
    };
    b.addEventListener('levelchange', onChange);
    b.addEventListener('chargingchange', onChange);
  };

  const watchReducedMotion = () => {
    if (!K.support.reducedMotion) return;
    // تفضيل النظام يُجبر المستوى على low فوراً
    shieldAPI.set(2, 'reduced-motion');
    shieldAPI.lock();
  };

  const watchSaveData = () => {
    if (device.connection.saveData && shield.level < 1) {
      shieldAPI.set(1, 'save-data');
    }
  };

  /* ═══════════════════════════════════════════════════════════
     Thermal Throttling Hint — مؤشر غير مباشر
     كلما ارتفعت الحرارة، تنخفض سرعة GPU/CPU — نكتشفها بمراقبة
     انخفاض FPS المستمر بلا سبب من الـ DOM.
     ═══════════════════════════════════════════════════════════ */

  const thermal = {
    state: 'nominal',
    startedAt: 0,
    checkpoints: [],
    lastSample: { fps: 60, ts: 0 },
  };

  const watchThermal = () => {
    const now = performance.now();
    if (!thermal.startedAt) thermal.startedAt = now;

    thermal.checkpoints.push({ ts: now, fps: fps.average });
    // احتفظ بآخر دقيقتين فقط
    while (thermal.checkpoints.length && now - thermal.checkpoints[0].ts > 120000) {
      thermal.checkpoints.shift();
    }

    // إذا نزل المتوسط من أول دقيقة إلى الثانية بأكثر من 25% → احتمال اختناق
    if (thermal.checkpoints.length >= 60) {
      const firstHalf = thermal.checkpoints.slice(0, Math.floor(thermal.checkpoints.length / 2));
      const secondHalf = thermal.checkpoints.slice(Math.floor(thermal.checkpoints.length / 2));
      const avg1 = firstHalf.reduce((s, x) => s + x.fps, 0) / firstHalf.length;
      const avg2 = secondHalf.reduce((s, x) => s + x.fps, 0) / secondHalf.length;
      const drop = (avg1 - avg2) / avg1;

      if (drop > 0.30 && avg2 < 40) {
        thermal.state = 'critical';
        device.thermal = 'critical';
      } else if (drop > 0.18 && avg2 < 50) {
        thermal.state = 'serious';
        device.thermal = 'serious';
      } else if (drop > 0.10) {
        thermal.state = 'fair';
        device.thermal = 'fair';
      } else {
        thermal.state = 'nominal';
        device.thermal = 'nominal';
      }
    }
  };

  /* ═══════════════════════════════════════════════════════════
     Scroll Smoothing — يضمن عدم تقطيع التمرير
     ═══════════════════════════════════════════════════════════ */

  const scrollShield = (() => {
    let lastY = 0;
    let lastTs = 0;
    let velocity = 0;
    let scrollDirection = 'down';
    let ticking = false;
    let pendingY = 0;

    const onScroll = (evt) => {
      const target = evt.target === document ? document.scrollingElement : evt.target;
      const y = target.scrollTop;
      pendingY = y;

      // إخفاء tabbar عند التمرير لأسفل · إظهاره عند التمرير لأعلى
      const tabbar = document.querySelector('.k-tabbar');
      if (tabbar) {
        const dy = y - lastY;
        if (y < 40) {
          tabbar.dataset.hidden = 'false';
        } else if (dy > 8 && scrollDirection !== 'down') {
          scrollDirection = 'down';
          tabbar.dataset.hidden = 'true';
        } else if (dy < -8 && scrollDirection !== 'up') {
          scrollDirection = 'up';
          tabbar.dataset.hidden = 'false';
        }
      }

      lastY = y;

      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        ticking = false;
        // وسم الشاشات النشطة للسماح بتقليل الرسم خارج نافذة العرض
        document.documentElement.dataset.scrolling = 'true';
      });

      clearTimeout(onScroll.__idle);
      onScroll.__idle = setTimeout(() => {
        document.documentElement.dataset.scrolling = 'false';
      }, 180);
    };

    const attach = (root = document) => {
      // مستمع سلبي بشكل صريح — لا يمنع التمرير
      root.addEventListener('scroll', onScroll, { passive: true, capture: true });
    };

    return { attach };
  })();

  /* ═══════════════════════════════════════════════════════════
     Streaming Render Optimizer — العرض المتدفق
     ═══════════════════════════════════════════════════════════ */

  const stream = (() => {
    /**
     * إنشاء قناة تدفق نصي آمنة.
     * @param {Element} target  العنصر الذي سيُحقن النص فيه
     * @param {object} [opts]
     * @param {number} [opts.buffer=8]  حد الدمج قبل الإفراغ (8 أحرف)
     * @param {number} [opts.autoScrollThreshold=80]  مسافة من الأسفل تُفعّل التمرير التلقائي
     * @param {boolean} [opts.autoScroll=true]
     * @param {Function} [opts.onFlush]  يُستدعى بعد كل إفراغ
     * @param {Function} [opts.onEnd]
     */
    const create = (target, opts = {}) => {
      if (!target) throw new Error('stream: target مطلوب');

      const buffer = opts.buffer ?? 8;
      const autoScroll = opts.autoScroll !== false;
      const autoScrollThreshold = opts.autoScrollThreshold ?? 80;

      // عقدة نصية واحدة — لا إنشاء عقد جديدة مع كل قطعة
      const textNode = document.createTextNode('');
      target.appendChild(textNode);

      let pending = '';
      let rafHandle = 0;
      let idleHandle = 0;
      let ended = false;
      let cancelled = false;
      let lastCharCount = 0;

      // إحصاءات القياس
      const metrics = {
        startedAt: performance.now(),
        firstChunkAt: 0,
        lastChunkAt: 0,
        chunkCount: 0,
        flushCount: 0,
        gaps: [],
        totalChars: 0,
      };

      const isNearBottom = () => {
        const scrollParent = target.closest('.k-screen') || document.scrollingElement;
        const dist = scrollParent.scrollHeight - scrollParent.scrollTop - scrollParent.clientHeight;
        return dist < autoScrollThreshold;
      };

      const doScroll = () => {
        if (!autoScroll) return;
        const scrollParent = target.closest('.k-screen') || document.scrollingElement;
        if (isNearBottom()) {
          scrollParent.scrollTop = scrollParent.scrollHeight;
        }
      };

      /** الإفراغ الفعلي — يعمل داخل RAF write */
      const flush = () => {
        rafHandle = 0;
        idleHandle = 0;
        if (!pending) return;

        const chunk = pending;
        pending = '';

        const wasNearBottom = autoScroll && isNearBottom();

        K.raf.write(() => {
          if (cancelled) return;
          // إلحاق فعلي — تحديث nodeValue أخف من textContent
          textNode.nodeValue = textNode.nodeValue + chunk;
          lastCharCount = textNode.nodeValue.length;
          metrics.flushCount += 1;
          metrics.totalChars = lastCharCount;

          if (wasNearBottom) doScroll();

          if (opts.onFlush) K.utils.tryCatch(() => opts.onFlush(lastCharCount));
        });
      };

      /** جدولة الإفراغ — idle إن أمكن، وإلا RAF */
      const schedule = () => {
        if (rafHandle || idleHandle) return;
        // نُفرغ في idle للسماح للرسم بالتنفس
        if (K.support.idleCallback) {
          idleHandle = K.idle(() => {
            idleHandle = 0;
            if (pending) {
              // إن كان هناك عمل عرض آخر، أجّلنا
              rafHandle = requestAnimationFrame(flush);
            }
          }, 32);
        } else {
          rafHandle = requestAnimationFrame(flush);
        }
      };

      const api = {
        /**
         * إضافة قطعة.
         * @param {string} chunk
         */
        push(chunk) {
          if (cancelled || ended || !chunk) return;
          const now = performance.now();
          if (!metrics.firstChunkAt) metrics.firstChunkAt = now;
          if (metrics.lastChunkAt) metrics.gaps.push(now - metrics.lastChunkAt);
          metrics.lastChunkAt = now;
          metrics.chunkCount += 1;

          pending += chunk;

          // سطر جديد → إفراغ فوري
          if (chunk.includes('\n') || pending.length >= buffer) {
            if (rafHandle) { cancelAnimationFrame(rafHandle); rafHandle = 0; }
            if (idleHandle) { K.idle.cancel(idleHandle); idleHandle = 0; }
            flush();
          } else {
            schedule();
          }
        },

        /** إنهاء التدفق مع تفريغ ما تبقّى */
        end(finalChunk) {
          if (cancelled || ended) return;
          if (finalChunk) pending += finalChunk;
          if (pending) {
            if (rafHandle) cancelAnimationFrame(rafHandle);
            if (idleHandle) K.idle.cancel(idleHandle);
            rafHandle = 0; idleHandle = 0;
            flush();
          }
          ended = true;
          if (opts.onEnd) K.utils.tryCatch(() => opts.onEnd(metrics));
        },

        /** إلغاء فوري */
        cancel() {
          cancelled = true;
          if (rafHandle) cancelAnimationFrame(rafHandle);
          if (idleHandle) K.idle.cancel(idleHandle);
          rafHandle = 0; idleHandle = 0;
          pending = '';
        },

        /** الحالة الحالية */
        get isActive() { return !ended && !cancelled; },
        get length() { return lastCharCount; },
        get metrics() { return { ...metrics, pendingLength: pending.length }; },

        /** الحصول على العقدة النصية للاستخدام الخارجي */
        get node() { return textNode; },
      };

      return api;
    };

    /**
     * تشخيص مشكلة التدفق:
     *  - فاصل > 100ms بين قطع، أو انقطاع عند القطعة الثالثة → مشكلة أمامية
     *  - تأخر > 800ms عن القطعة الأولى → مشكلة API
     * @param {object} metrics
     * @returns {{ verdict, details }}
     */
    const diagnose = (metrics) => {
      const out = {
        verdict: 'unknown',
        ttfb: metrics.firstChunkAt - metrics.startedAt,
        maxGap: metrics.gaps.length ? Math.max(...metrics.gaps) : 0,
        avgGap: metrics.gaps.length
          ? metrics.gaps.reduce((s, x) => s + x, 0) / metrics.gaps.length
          : 0,
        chunkCount: metrics.chunkCount,
        totalChars: metrics.totalChars,
      };

      // تأخر أول قطعة
      if (out.ttfb > 800) {
        out.verdict = 'backend';
        out.reason = 'تأخر القطعة الأولى > 800ms — مشكلة على الخادم أو الشبكة';
        return out;
      }

      // فاصل > 100ms
      if (out.maxGap > 100) {
        out.verdict = 'frontend';
        out.reason = `فاصل أقصى ${Math.round(out.maxGap)}ms > 100ms — مشكلة في الواجهة الأمامية`;
        return out;
      }

      // انقطاع عند القطعة الثالثة (يظهر كفاصل مبكر ثم استئناف)
      if (out.chunkCount >= 3 && metrics.gaps.length >= 2) {
        const earlyGaps = metrics.gaps.slice(0, 2);
        const earlyMax = Math.max(...earlyGaps);
        const laterGaps = metrics.gaps.slice(2);
        const laterAvg = laterGaps.length
          ? laterGaps.reduce((s, x) => s + x, 0) / laterGaps.length
          : 0;
        if (earlyMax > 60 && laterAvg < earlyMax / 2) {
          out.verdict = 'frontend';
          out.reason = 'انقطاع عند القطعة الثالثة — أولوية الرسم الخاطئة';
          return out;
        }
      }

      out.verdict = 'healthy';
      out.reason = 'التدفق سلس';
      return out;
    };

    /**
     * قياس وقت مع تشخيص مباشر في الـ console.
     * الاستخدام:
     *   const t = K.perf.stream.timer('fetch-feed');
     *   ... بعد انتهاء التدفق:
     *   t.end(metrics);
     */
    const timer = (label) => {
      const start = performance.now();
      const marks = [];
      return {
        mark(name) {
          marks.push({ name, ts: performance.now() - start });
        },
        end(metrics) {
          const total = performance.now() - start;
          if (metrics) {
            const diag = diagnose(metrics);
            console.groupCollapsed(
              `%c[stream] ${label} · ${diag.verdict} · ${Math.round(total)}ms`,
              diag.verdict === 'healthy'
                ? 'color:#1e9166'
                : diag.verdict === 'backend'
                ? 'color:#d97706'
                : 'color:#dc3e3e',
            );
            console.timeLog?.(label, 'المجموع', total.toFixed(1) + 'ms');
            console.table({
              'TTFB (ms)': Math.round(diag.ttfb),
              'أقصى فاصل (ms)': Math.round(diag.maxGap),
              'متوسط الفاصل (ms)': Math.round(diag.avgGap),
              'عدد القطع': diag.chunkCount,
              'إجمالي الأحرف': diag.totalChars,
            });
            console.log('الحكم:', diag.reason);
            console.groupEnd();
            return diag;
          }
          console.timeEnd?.(label);
          return { total };
        },
      };
    };

    return { create, diagnose, timer };
  })();

  /* ═══════════════════════════════════════════════════════════
     Virtualization — تفريغ العناصر خارج نافذة العرض
     يُستخدم في القوائم الطويلة (الإعجابات · المحفوظات · البحث)
     ═══════════════════════════════════════════════════════════ */

  const virtualize = (() => {
    /**
     * يراقب أبناء حاوية · يعلّم المرئي بـ data-visible="true" والبعيد بـ false.
     * لا يحذف شيئاً — فقط يعلّم ليتولّى CSS إخفاء المحتوى الثقيل.
     * @param {Element} root
     * @param {object} [opts]
     * @param {string} [opts.child='> *']  محدّد الأبناء
     * @param {number} [opts.margin=400]  هامش حول نافذة العرض
     * @param {number} [opts.unload=2000]  مسافة تُعتبر خارج النطاق
     */
    const attach = (root, opts = {}) => {
      if (!K.support.intersection || !root) return { detach: () => {} };

      const margin = opts.margin ?? 400;
      const childSel = opts.child || ':scope > *';

      const observer = new IntersectionObserver((entries) => {
        for (const entry of entries) {
          const el = entry.target;
          el.dataset.visible = entry.isIntersecting ? 'true' : 'false';
        }
      }, {
        root: root.closest('.k-screen') || null,
        rootMargin: `${margin}px 0px ${margin}px 0px`,
        threshold: 0,
      });

      const observeAll = () => {
        for (const child of root.querySelectorAll(childSel)) {
          if (child.dataset.virtualObserved) continue;
          child.dataset.virtualObserved = '1';
          observer.observe(child);
        }
      };

      observeAll();

      // مراقبة إضافات جديدة
      let mutationObserver = null;
      if (typeof MutationObserver === 'function') {
        mutationObserver = new MutationObserver((mutations) => {
          let dirty = false;
          for (const m of mutations) {
            if (m.addedNodes.length) { dirty = true; break; }
          }
          if (dirty) {
            K.raf.write(observeAll);
          }
        });
        mutationObserver.observe(root, { childList: true });
      }

      return {
        detach() {
          observer.disconnect();
          if (mutationObserver) mutationObserver.disconnect();
        },
        refresh: observeAll,
      };
    };

    return { attach };
  })();

  /* ═══════════════════════════════════════════════════════════
     جسر الأداء إلى WebView — لحفظ الحالة
     ═══════════════════════════════════════════════════════════ */

  const reportToBridge = () => {
    if (!window.KhayalBridge || typeof window.KhayalBridge.postMessage !== 'function') return;
    K.utils.tryCatch(() => {
      window.KhayalBridge.postMessage(JSON.stringify({
        type: 'perf-tier',
        tier: shield.tier,
        level: shield.level,
        deviceMemory: device.memory,
        cores: device.cores,
        gpuTier: device.gpu.tier,
        thermal: device.thermal,
      }));
    });
  };

  /* ═══════════════════════════════════════════════════════════
     التهيئة والربط
     ═══════════════════════════════════════════════════════════ */

  const init = async () => {
    await device.initialize();
    await K.icons?.loadSprite?.();

    // الفئة الابتدائية
    const initial = computeInitialTier();
    applyShield(TIER_TO_LEVEL[initial]);

    // بدء مراقبة FPS
    if (!fpsRAF) fpsRAF = requestAnimationFrame(tickFPS);

    // مراقبة دورية للحرارة كل 5 ثوان
    setInterval(watchThermal, 5000);

    // ربط الأحداث
    watchBattery();
    watchReducedMotion();
    watchSaveData();

    // تفعيل حماية التمرير
    scrollShield.attach(document);

    // إبلاغ الجسر
    reportToBridge();

    // إبلاغ عند تغيّر المستوى
    shieldAPI.on(reportToBridge);
  };

  /* ═══════════════════════════════════════════════════════════
     تصدير الواجهة العامة
     ═══════════════════════════════════════════════════════════ */

  K.device = device;
  K.perf = {
    init,
    shield: shieldAPI,
    fps,
    stream,
    virtualize,
    // قراءة سريعة
    get tier() { return shield.tier; },
    get level() { return shield.level; },
    // إحصاءات تشخيصية
    stats() {
      return {
        tier: shield.tier,
        level: shield.level,
        fps: { current: Math.round(fps.current), average: Math.round(fps.average), min: Math.round(fps.min) },
        device: {
          memory: device.memory,
          cores: device.cores,
          gpuTier: device.gpu.tier,
          thermal: device.thermal,
          saveData: device.connection.saveData,
          effectiveType: device.connection.effectiveType,
        },
      };
    },
  };

  /* نهاية 02-perf.js */
})();