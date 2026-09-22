/* ============================================================
   خَيال · 07-social · الاجتماعي
   الأجزاء: 44 (API إشعارات) · 45 (API رسائل)
   تكملة الجزء 35 (إدارة الإشعارات) بتزامن الخادم والرسائل الحية
   ============================================================ */

'use strict';

(function () {
  const K = window.K;
  if (!K) { console.error('[social] النواة غير محمّلة'); return; }


  /* ═══════════════════════════════════════════════════════════
     الجزء 44 · API الإشعارات
     تحميل · قراءة · عدّاد · اشتراك حي
     ═══════════════════════════════════════════════════════════ */

  const apiNotifications = (() => {
    const BASE = '/api/notifications';

    /** قائمة الإشعارات (مرقّمة) */
    const list = async (opts = {}) => {
      K.security.requireAuth();
      const params = new URLSearchParams({ limit: String(opts.limit || 30) });
      if (opts.cursor) params.set('cursor', opts.cursor);
      if (opts.unreadOnly) params.set('unreadOnly', 'true');
      if (opts.type) params.set('type', opts.type);

      const res = await K.http.get(`${BASE}?${params}`);
      const items = (res?.items || []).map(K.models.Notification.normalize).filter(Boolean);
      return {
        items,
        cursor: res?.cursor || null,
        hasMore: !!res?.hasMore,
        unread: Number(res?.unread) || items.filter(n => n.unread).length,
      };
    };

    /** عدّاد غير المقروء فقط (طلب خفيف) */
    const unreadCount = async () => {
      if (K.store.get('authStatus') !== 'authenticated') return 0;
      const res = await K.http.get(`${BASE}/unread-count`, { timeout: 5000 });
      return Number(res?.count) || 0;
    };

    /** وسم إشعار واحد كمقروء */
    const markRead = (id) => K.http.patch(`${BASE}/${encodeURIComponent(id)}/read`, {});

    /** وسم عدة إشعارات كمقروءة */
    const markManyRead = (ids) => {
      if (!Array.isArray(ids) || !ids.length) return Promise.resolve({ count: 0 });
      return K.http.patch(`${BASE}/read`, { ids });
    };

    /** وسم الكل كمقروء */
    const markAllRead = () => K.http.patch(`${BASE}/read-all`, {});

    /** حذف إشعار */
    const remove = (id) => K.http.del(`${BASE}/${encodeURIComponent(id)}`);

    /** مسح كل الإشعارات */
    const clear = () => K.http.del(BASE);

    return {
      list, unreadCount,
      markRead, markManyRead, markAllRead,
      remove, clear,
    };
  })();


  /* ═══════════════════════════════════════════════════════════
     الجزء 45 · API الرسائل
     محادثات · رسائل · فتح جديدة · عدّاد
     ═══════════════════════════════════════════════════════════ */

  const apiMessages = (() => {
    const BASE = '/api/messages';

    /* ---- محادثات ---- */

    /** قائمة المحادثات */
    const listConversations = async (opts = {}) => {
      K.security.requireAuth();
      const params = new URLSearchParams({ limit: String(opts.limit || 30) });
      if (opts.cursor) params.set('cursor', opts.cursor);
      if (opts.query) params.set('q', opts.query);

      const res = await K.http.get(`${BASE}/conversations?${params}`);
      const items = (res?.items || []).map(K.models.Conversation.normalize).filter(Boolean);
      return {
        items,
        cursor: res?.cursor || null,
        hasMore: !!res?.hasMore,
        unread: Number(res?.unread) || 0,
      };
    };

    /** فتح أو إنشاء محادثة مع مستخدم */
    const openConversation = async (userId) => {
      K.security.requireAuth();
      if (!userId) throw new K.errors.Validate('معرّف المستخدم مطلوب');
      const res = await K.http.post(`${BASE}/conversations`, { userId });
      const conv = K.models.Conversation.normalize(res?.conversation || res);
      if (!conv || !conv.id) throw new K.errors.Unknown('فشل فتح المحادثة');
      return conv;
    };

    /** جلب محادثة واحدة (مع آخر رسائل) */
    const getConversation = async (conversationId) => {
      K.security.requireAuth();
      if (!conversationId) throw new K.errors.Validate('معرّف المحادثة مطلوب');
      const res = await K.http.get(`${BASE}/conversations/${encodeURIComponent(conversationId)}`);
      const conv = K.models.Conversation.normalize(res?.conversation || res);
      if (!conv || !conv.id) throw new K.errors.NotFound('المحادثة غير موجودة');
      return conv;
    };

    /* ---- رسائل ---- */

    /** قائمة الرسائل داخل محادثة */
    const listMessages = async (conversationId, opts = {}) => {
      K.security.requireAuth();
      if (!conversationId) throw new K.errors.Validate('معرّف المحادثة مطلوب');
      const params = new URLSearchParams({ limit: String(opts.limit || 30) });
      if (opts.cursor) params.set('cursor', opts.cursor);
      if (opts.before) params.set('before', opts.before);

      const res = await K.http.get(`${BASE}/conversations/${encodeURIComponent(conversationId)}/messages?${params}`);
      const items = (res?.items || []).map(K.models.Message.normalize).filter(Boolean);
      return {
        items,
        cursor: res?.cursor || null,
        hasMore: !!res?.hasMore,
      };
    };

    /** إرسال رسالة */
    const sendMessage = (conversationId, payload) => {
      K.security.requireAuth();
      if (!conversationId) throw new K.errors.Validate('معرّف المحادثة مطلوب');

      const clean = K.validate.object(payload, K.validate.schemas.messageCreate, { partial: !!payload.attachment });

      if (!clean.text && !payload.attachment) {
        throw new K.errors.Validate('لا يمكن إرسال رسالة فارغة');
      }

      // rate limit محلي — 30 رسالة / دقيقة
      const rl = K.security.canDo('message:send', { max: 30, window: 60 * 1000 });
      if (!rl.allowed) {
        throw new K.errors.RateLimit('أرسلت رسائل كثيرة — خفّف قليلاً');
      }

      return K.http.post(`${BASE}/conversations/${encodeURIComponent(conversationId)}/messages`, {
        text: clean.text || '',
        attachment: payload.attachment || null,
        clientId: payload.clientId || null,
      });
    };

    /** وسم رسائل محادثة كمقروءة */
    const markConversationRead = (conversationId, upToMessageId = null) => {
      K.security.requireAuth();
      return K.http.patch(
        `${BASE}/conversations/${encodeURIComponent(conversationId)}/read`,
        { upToMessageId },
      );
    };

    /** حذف رسالة (لمنع ظهورها لدي فقط) */
    const deleteMessage = (conversationId, messageId) => {
      K.security.requireAuth();
      return K.http.del(
        `${BASE}/conversations/${encodeURIComponent(conversationId)}/messages/${encodeURIComponent(messageId)}`,
      );
    };

    /** كتم محادثة */
    const muteConversation = (conversationId, muted = true) => {
      K.security.requireAuth();
      return K.http.patch(`${BASE}/conversations/${encodeURIComponent(conversationId)}/mute`, { muted });
    };

    /** حظر المستخدم من داخل المحادثة */
    const blockConversation = (conversationId) => {
      K.security.requireAuth();
      return K.http.post(`${BASE}/conversations/${encodeURIComponent(conversationId)}/block`, {});
    };

    /** عدّاد الرسائل غير المقروءة */
    const unreadCount = async () => {
      if (K.store.get('authStatus') !== 'authenticated') return 0;
      const res = await K.http.get(`${BASE}/unread-count`, { timeout: 5000 });
      return Number(res?.count) || 0;
    };

    /* ---- رفع مرفق ---- */
    const uploadAttachment = async (file) => {
      K.security.requireAuth();
      if (!file) throw new K.errors.Validate('الملف مطلوب');
      const maxBytes = 20 * 1024 * 1024;
      const allowed = [
        'image/jpeg', 'image/png', 'image/webp', 'image/gif',
        'video/mp4', 'video/webm',
        'application/pdf',
      ];
      if (!allowed.includes(file.type)) {
        throw new K.errors.Validate('صيغة الملف غير مدعومة');
      }
      if (file.size > maxBytes) {
        throw new K.errors.Validate(`حجم الملف يجب أن يكون أقل من ${K.format.fileSize(maxBytes)}`);
      }

      const form = new FormData();
      form.append('file', file);
      const res = await K.http.post(`${BASE}/upload`, form, { timeout: 90000 });
      const url = K.security.sanitizeUrl(res?.url || '');
      if (!url) throw new K.errors.Unknown('فشل رفع المرفق');
      return {
        type: file.type.startsWith('image/') ? 'image'
            : file.type.startsWith('video/') ? 'video' : 'file',
        url,
        size: file.size,
      };
    };

    return {
      listConversations, openConversation, getConversation,
      listMessages, sendMessage, markConversationRead,
      deleteMessage, muteConversation, blockConversation,
      unreadCount, uploadAttachment,
    };
  })();


  /* ═══════════════════════════════════════════════════════════
     مزامنة الإشعارات الحية عبر WebSocket / SSE
     (آمن مع تراجع إلى polling)
     ═══════════════════════════════════════════════════════════ */

  const liveUpdates = (() => {
    let socket = null;
    let sse = null;
    let pollTimer = null;
    let reconnectAttempts = 0;
    let active = false;
    let lastPongAt = 0;
    let backoffTimer = null;

    const MAX_RECONNECT = 6;
    const BASE_BACKOFF = 1000;

    const buildURL = () => {
      const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
      return `${proto}//${location.host}/api/live`;
    };

    /* ---- معالجة الرسائل الواردة ---- */

    const handleIncoming = (payload) => {
      if (!payload || typeof payload !== 'object') return;
      const { type, data } = payload;

      switch (type) {
        case 'notification':
          K.utils.tryCatch(() => K.notifications.push(data));
          break;
        case 'notification:read':
          if (data?.id) K.notifications.markRead(data.id);
          break;
        case 'notification:read-all':
          K.notifications.markAllRead();
          break;
        case 'unread-count':
          K.notifications.setUnread(Number(data?.notifications) || 0);
          K.utils.tryCatch(() => K.messages.setUnread(Number(data?.messages) || 0));
          break;
        case 'message':
          K.utils.tryCatch(() => K.messages.receive(data));
          break;
        case 'message:read':
          K.utils.tryCatch(() => K.messages.handleReadReceipt(data));
          break;
        case 'message:typing':
          K.utils.tryCatch(() => K.messages.handleTyping(data));
          break;
        case 'presence':
          K.utils.tryCatch(() => K.presence?.update?.(data));
          break;
        case 'heartbeat':
          lastPongAt = Date.now();
          break;
        default:
          // أنواع مستقبلية — نتجاهلها بأمان
          break;
      }
    };

    /* ---- WebSocket ---- */

    const connectWS = () => {
      if (!('WebSocket' in window)) return false;
      try {
        socket = new WebSocket(buildURL());
        socket.binaryType = 'arraybuffer';

        socket.onopen = () => {
          reconnectAttempts = 0;
          lastPongAt = Date.now();
          K.utils.tryCatch(() => K.store.set('network.live', true, { noPersist: true }));
        };

        socket.onmessage = (evt) => {
          try {
            const text = typeof evt.data === 'string'
              ? evt.data
              : new TextDecoder().decode(evt.data);
            const payload = JSON.parse(text);
            handleIncoming(payload);
          } catch (err) {
            console.warn('[live.ws.parse]', err);
          }
        };

        socket.onerror = () => {
          // onclose سيأتي بعدها
        };

        socket.onclose = () => {
          socket = null;
          K.utils.tryCatch(() => K.store.set('network.live', false, { noPersist: true }));
          if (active) scheduleReconnect();
        };

        return true;
      } catch (err) {
        console.warn('[live.ws]', err);
        return false;
      }
    };

    /* ---- SSE (تراجع) ---- */

    const connectSSE = () => {
      if (!('EventSource' in window)) return false;
      try {
        sse = new EventSource('/api/live');
        sse.onopen = () => {
          reconnectAttempts = 0;
          K.utils.tryCatch(() => K.store.set('network.live', true, { noPersist: true }));
        };
        sse.onmessage = (evt) => {
          try {
            const payload = JSON.parse(evt.data);
            handleIncoming(payload);
          } catch (err) {
            console.warn('[live.sse.parse]', err);
          }
        };
        sse.onerror = () => {
          if (sse) { sse.close(); sse = null; }
          K.utils.tryCatch(() => K.store.set('network.live', false, { noPersist: true }));
          if (active) scheduleReconnect();
        };
        return true;
      } catch (err) {
        console.warn('[live.sse]', err);
        return false;
      }
    };

    /* ---- Polling (تراجع أخير) ---- */

    const startPolling = () => {
      if (pollTimer) return;
      const interval = K.store.get('network.slow') ? 60000 : 30000;
      pollTimer = setInterval(async () => {
        if (!active) return;
        if (document.hidden) return;   // لا نستهلك بيانات في الخلفية
        try {
          const [notif, msg] = await Promise.allSettled([
            apiNotifications.unreadCount(),
            apiMessages.unreadCount(),
          ]);
          if (notif.status === 'fulfilled') K.notifications.setUnread(notif.value);
          if (msg.status === 'fulfilled') K.messages.setUnread(msg.value);
        } catch (err) {
          // صامت
        }
      }, interval);
    };

    const stopPolling = () => {
      if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
    };

    /* ---- إدارة الاتصال ---- */

    const scheduleReconnect = () => {
      if (backoffTimer) return;
      if (reconnectAttempts >= MAX_RECONNECT) {
        // انسحب — استخدم polling فقط
        startPolling();
        return;
      }
      const delay = Math.min(BASE_BACKOFF * Math.pow(2, reconnectAttempts), 30000);
      reconnectAttempts += 1;
      backoffTimer = setTimeout(() => {
        backoffTimer = null;
        if (!active) return;
        if (!connectWS()) {
          if (!connectSSE()) {
            startPolling();
          }
        }
      }, delay);
    };

    const connect = () => {
      if (socket || sse) return;
      if (K.store.get('authStatus') !== 'authenticated') return;
      if (K.store.get('network.online') === false) return;

      const okWS = connectWS();
      if (!okWS) {
        const okSSE = connectSSE();
        if (!okSSE) startPolling();
      }
    };

    const disconnect = () => {
      if (socket) { socket.close(); socket = null; }
      if (sse) { sse.close(); sse = null; }
      if (backoffTimer) { clearTimeout(backoffTimer); backoffTimer = null; }
      stopPolling();
      reconnectAttempts = 0;
    };

    const start = () => {
      active = true;
      connect();
      // في حال عدم دعم أي قناة حيّة → polling
      setTimeout(() => {
        if (!socket && !sse && !pollTimer && active) startPolling();
      }, 2500);
    };

    const stop = () => {
      active = false;
      disconnect();
    };

    /* ---- إرسال (WebSocket فقط) ---- */

    const send = (payload) => {
      if (!socket || socket.readyState !== WebSocket.OPEN) return false;
      try {
        socket.send(JSON.stringify(payload));
        return true;
      } catch {
        return false;
      }
    };

    /* ---- مؤشرات الكتابة ---- */

    const sendTyping = (conversationId, typing) => {
      send({
        type: 'typing',
        conversationId,
        typing: !!typing,
        ts: Date.now(),
      });
    };

    /* ---- حالة الإجهاد ---- */

    const watchVisibility = () => {
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
          // نُبقي الاتصال مفتوحاً لكن نقلل النشاط
          stopPolling();
        } else if (active) {
          // استأنف
          if (!socket && !sse) connect();
          if (socket || sse) {
            // نبضة فورية
            send({ type: 'ping', ts: Date.now() });
          }
        }
      }, { passive: true });
    };

    const init = () => {
      watchVisibility();

      // ابدأ/أوقف بحسب المصادقة
      K.store.subscribe('authStatus', (status) => {
        if (status === 'authenticated') start();
        else stop();
      });

      // ابدأ/أوقف بحسب الشبكة
      K.store.subscribe('network.online', (online) => {
        if (online === false) disconnect();
        else if (active) connect();
      });

      if (K.store.get('authStatus') === 'authenticated') start();
    };

    return {
      init, start, stop, send, sendTyping,
      get connected() { return !!socket || !!sse; },
      get transport() {
        if (socket) return 'ws';
        if (sse) return 'sse';
        if (pollTimer) return 'poll';
        return 'none';
      },
    };
  })();


  /* ═══════════════════════════════════════════════════════════
     مخزن محادثات — حالة الرسائل الحية
     ═══════════════════════════════════════════════════════════ */

  const messagesState = (() => {
    const conversations = new Map();   // convId → {items[], cursor, hasMore, loading, peer}
    const typingTimers = new Map();    // convId → timeout

    /* ---- عدّاد غير المقروء ---- */
    const setUnread = (n) => {
      K.store.set('messages.unread', Math.max(0, Number(n) || 0), { noPersist: true });
    };

    const getUnread = () => K.store.get('messages.unread', 0);

    /* ---- محادثة مفتوحة ---- */

    const getConversation = (convId) => {
      if (conversations.has(convId)) return conversations.get(convId);
      const c = {
        id: convId,
        peer: null,
        items: [],
        cursor: null,
        hasMore: true,
        loading: false,
        error: null,
        typing: false,
        lastReadAt: null,
        generation: 0,
      };
      conversations.set(convId, c);
      return c;
    };

    const normalizeMessages = (raw) => {
      const items = (raw?.items || []).map(K.models.Message.normalize).filter(Boolean);
      // الرسائل تُعاد من الأحدث للأقدم من الخادم عادة — نعكسها للترتيب الزمني
      return items.reverse();
    };

    const load = async (convId, opts = {}) => {
      const c = getConversation(convId);
      c.generation += 1;
      const myGen = c.generation;

      if (opts.peer) c.peer = opts.peer;
      c.loading = true;
      c.error = null;

      try {
        const raw = await apiMessages.listMessages(convId, { limit: opts.limit || 30 });
        if (c.generation !== myGen) return { ok: false, stale: true };

        c.items = normalizeMessages(raw);
        c.cursor = raw.cursor;
        c.hasMore = raw.hasMore;
        c.loading = false;

        // وسم كمقروء
        if (c.items.length) {
          const lastId = c.items[c.items.length - 1].id;
          markRead(convId, lastId).catch(() => {});
        }

        return { ok: true, state: c };
      } catch (err) {
        if (c.generation !== myGen) return { ok: false, stale: true };
        c.error = err;
        c.loading = false;
        return { ok: false, error: err, state: c };
      }
    };

    const loadMore = async (convId) => {
      const c = getConversation(convId);
      if (c.loading || !c.hasMore || !c.cursor) return { ok: false };

      c.generation += 1;
      const myGen = c.generation;
      c.loading = true;

      try {
        const raw = await apiMessages.listMessages(convId, { cursor: c.cursor, limit: 30 });
        if (c.generation !== myGen) return { ok: false, stale: true };

        const older = normalizeMessages(raw);
        const seen = new Set(c.items.map(m => m.id));
        const merged = [];
        for (const m of older) if (!seen.has(m.id)) merged.push(m);
        c.items = [...merged, ...c.items];   // الأقدم في الأعلى
        c.cursor = raw.cursor;
        c.hasMore = raw.hasMore;
        c.loading = false;
        return { ok: true, added: merged.length, state: c };
      } catch (err) {
        c.error = err;
        c.loading = false;
        return { ok: false, error: err };
      }
    };

    /* ---- إرسال تفاؤلي ---- */

    const send = async (convId, text, attachment = null) => {
      const me = K.store.get('user');
      if (!me?.id) throw new K.errors.Auth('سجّل الدخول للإرسال');

      const clean = String(text || '').trim();
      if (!clean && !attachment) return null;

      const c = getConversation(convId);
      const clientId = K.utils.uid('msg');

      const optimistic = {
        id: clientId,
        conversationId: convId,
        senderId: me.id,
        text: clean,
        attachment: attachment || null,
        state: 'sending',
        createdAt: new Date().toISOString(),
        readAt: null,
        __clientId__: clientId,
        __pending__: true,
      };

      c.items = [...c.items, optimistic];

      // تسجيل الكتابة
      liveUpdates.sendTyping(convId, false);

      try {
        const res = await apiMessages.sendMessage(convId, {
          text: clean,
          attachment,
          clientId,
        });

        const real = K.models.Message.normalize(res?.message || res);
        if (!real || !real.id) throw new K.errors.Unknown('رد غير متوقع');

        // استبدال المؤقت بالحقيقي
        replaceMessage(convId, clientId, { ...real, __pending__: false, __clientId__: undefined });

        // تحديث آخر رسالة في قائمة المحادثات
        updateConversationPreview(convId, real);

        return real;
      } catch (err) {
        // وسم بالفشل
        replaceMessage(convId, clientId, { state: 'failed' });
        K.sound.error();
        K.utils.tryCatch(() => K.overlays?.toast?.({
          type: 'error',
          title: 'لم تُرسَل الرسالة',
          message: err?.message || 'فشل الإرسال',
          actionLabel: 'إعادة المحاولة',
          onAction: () => retryFailed(convId, clientId),
          duration: 5000,
        }));
        throw err;
      }
    };

    /** إعادة إرسال رسالة فاشلة */
    const retryFailed = async (convId, clientId) => {
      const c = getConversation(convId);
      const msg = c.items.find(m => m.id === clientId || m.__clientId__ === clientId);
      if (!msg || msg.state !== 'failed') return;

      // استبدال بمؤقت جديد
      c.items = c.items.filter(m => m !== msg);
      return send(convId, msg.text, msg.attachment);
    };

    /* ---- استقبال رسالة حية ---- */

    const receive = (raw) => {
      const msg = K.models.Message.normalize(raw);
      if (!msg || !msg.id) return;

      const convId = msg.conversationId;
      if (!convId) return;

      const c = getConversation(convId);

      // منع التكرار
      if (c.items.some(m => m.id === msg.id)) return;

      c.items = [...c.items, msg];
      updateConversationPreview(convId, msg);

      // إشعار داخل التطبيق
      const meId = K.store.get('user')?.id;
      if (msg.senderId !== meId) {
        // زيادة العدّاد
        setUnread(getUnread() + 1);

        // toast إن لم تكن المحادثة مفتوحة حالياً
        const currentPath = K.router.getCurrent()?.path || '';
        const isOnThisChat = currentPath.includes(convId);
        if (!isOnThisChat) {
          K.utils.tryCatch(() => K.overlays?.toast?.({
            type: 'info',
            title: 'رسالة جديدة',
            message: msg.text?.slice(0, 60) || 'مرفق',
            actionLabel: 'فتح',
            onAction: () => K.router.go(`/messages/${convId}`),
            duration: 4000,
          }));
        }

        // إبلاغ الخادم أننا قرأنا فوراً إن كنا في نفس المحادثة
        if (isOnThisChat) {
          markRead(convId, msg.id).catch(() => {});
        }
      }

      // إعلام المشتركين
      K.utils.tryCatch(() => K.events.emit(document, 'khayal:message-received', { conversationId: convId, message: msg }));
    };

    const replaceMessage = (convId, id, patch) => {
      const c = getConversation(convId);
      const idx = c.items.findIndex(m => m.id === id || m.__clientId__ === id);
      if (idx === -1) return false;
      c.items[idx] = { ...c.items[idx], ...patch };
      // إعلام المشتركين
      K.utils.tryCatch(() => K.events.emit(document, 'khayal:message-updated', {
        conversationId: convId,
        messageId: c.items[idx].id,
      }));
      return true;
    };

    /* ---- وسم كمقروء ---- */

    const markRead = async (convId, messageId = null) => {
      try {
        await apiMessages.markConversationRead(convId, messageId);
        const c = getConversation(convId);
        c.lastReadAt = new Date().toISOString();
        // تحديث كل الرسائل الواردة
        c.items = c.items.map(m => {
          const meId = K.store.get('user')?.id;
          if (m.senderId !== meId && m.state !== 'read') {
            return { ...m, state: 'read', readAt: new Date().toISOString() };
          }
          return m;
        });
      } catch (err) {
        // صامت — لا نزعج المستخدم بفشل وسم القراءة
      }
    };

    /* ---- استلام إشعار قراءة من الطرف الآخر ---- */

    const handleReadReceipt = ({ conversationId, upToMessageId }) => {
      if (!conversationId || !upToMessageId) return;
      const c = getConversation(conversationId);
      let touched = false;
      c.items = c.items.map(m => {
        const meId = K.store.get('user')?.id;
        if (m.senderId === meId && m.state !== 'read' &&
            (m.id <= upToMessageId || m.createdAt <= upToMessageId)) {
          touched = true;
          return { ...m, state: 'read', readAt: new Date().toISOString() };
        }
        return m;
      });
      if (touched) {
        K.utils.tryCatch(() => K.events.emit(document, 'khayal:messages-read', { conversationId }));
      }
    };

    /* ---- مؤشر الكتابة ---- */

    const handleTyping = ({ conversationId, typing }) => {
      const c = getConversation(conversationId);
      c.typing = !!typing;
      K.utils.tryCatch(() => K.events.emit(document, 'khayal:typing', { conversationId, typing: !!typing }));

      // إخماد تلقائي بعد 4 ثوان
      const prev = typingTimers.get(conversationId);
      if (prev) clearTimeout(prev);
      if (typing) {
        const t = setTimeout(() => {
          c.typing = false;
          typingTimers.delete(conversationId);
          K.utils.tryCatch(() => K.events.emit(document, 'khayal:typing', { conversationId, typing: false }));
        }, 4000);
        typingTimers.set(conversationId, t);
      }
    };

    /* ---- قائمة المحادثات ---- */

    const conversationsList = {
      items: [],
      cursor: null,
      hasMore: true,
      loading: false,
      error: null,
      generation: 0,
    };

    const loadConversations = async (opts = {}) => {
      conversationsList.generation += 1;
      const myGen = conversationsList.generation;
      conversationsList.loading = true;
      conversationsList.error = null;

      try {
        const raw = await apiMessages.listConversations({
          cursor: opts.cursor || null,
          limit: opts.limit || 30,
          query: opts.query || null,
        });
        if (conversationsList.generation !== myGen) return { ok: false, stale: true };

        if (opts.append && conversationsList.cursor) {
          const seen = new Set(conversationsList.items.map(c => c.id));
          for (const item of raw.items) {
            if (!seen.has(item.id)) conversationsList.items.push(item);
          }
        } else {
          conversationsList.items = raw.items;
        }
        conversationsList.cursor = raw.cursor;
        conversationsList.hasMore = raw.hasMore;
        conversationsList.loading = false;
        setUnread(raw.unread || 0);
        return { ok: true, items: raw.items };
      } catch (err) {
        if (conversationsList.generation !== myGen) return { ok: false, stale: true };
        conversationsList.error = err;
        conversationsList.loading = false;
        return { ok: false, error: err };
      }
    };

    const updateConversationPreview = (convId, msg) => {
      const idx = conversationsList.items.findIndex(c => c.id === convId);
      if (idx === -1) return;
      const conv = conversationsList.items[idx];
      conversationsList.items[idx] = {
        ...conv,
        lastMessage: K.models.Message.compact(msg),
        updatedAt: msg.createdAt,
        unreadCount: msg.senderId === K.store.get('user')?.id
          ? conv.unreadCount
          : (conv.unreadCount || 0) + 1,
      };
      // إعادة الترتيب — الأحدث في الأعلى
      conversationsList.items.sort((a, b) =>
        new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));
    };

    const reset = () => {
      conversations.clear();
      conversationsList.items = [];
      conversationsList.cursor = null;
      conversationsList.hasMore = true;
      conversationsList.loading = false;
      conversationsList.error = null;
      conversationsList.generation += 1;
      for (const t of typingTimers.values()) clearTimeout(t);
      typingTimers.clear();
      setUnread(0);
    };

    return {
      getConversation,
      load, loadMore, send, retryFailed,
      receive, replaceMessage,
      markRead, handleReadReceipt, handleTyping,
      loadConversations, updateConversationPreview, reset,
      setUnread, getUnread,
      get conversations() { return conversationsList; },
    };
  })();


  /* ═══════════════════════════════════════════════════════════
     متحكّم الرسائل — واجهة عامة
     ═══════════════════════════════════════════════════════════ */

  const messages = (() => {
    const auth = () => {
      K.security.requireAuth();
      const user = K.store.get('user');
      if (!user?.id) throw new K.errors.Auth('سجّل الدخول للمتابعة');
      return user;
    };

    const fail = (err, fallback = 'تعذّر إتمام الإجراء') => {
      const message = err?.message || fallback;
      K.utils.tryCatch(() => K.overlays?.toast?.({
        type: 'error',
        title: 'لم يكتمل',
        message,
        duration: 4000,
      }));
      return err;
    };

    /* ---- فتح محادثة مع مستخدم ---- */
    const openWith = async (userId) => {
      auth();
      if (!userId) throw new K.errors.Validate('معرّف المستخدم مطلوب');
      try {
        const conv = await apiMessages.openConversation(userId);
        return conv;
      } catch (err) {
        fail(err, 'تعذّر فتح المحادثة');
        throw err;
      }
    };

    /* ---- فتح بالمعرّف ---- */
    const open = async (conversationId, peer = null) => {
      auth();
      return messagesState.load(conversationId, { peer });
    };

    /* ---- قائمة المحادثات ---- */
    const list = (opts = {}) => {
      if (K.store.get('authStatus') !== 'authenticated') {
        return Promise.resolve({ ok: false, error: new K.errors.Auth('سجّل الدخول') });
      }
      return messagesState.loadConversations(opts);
    };

    /* ---- إرسال ---- */
    const send = async (conversationId, text, attachment = null) => {
      auth();
      const clean = String(text || '').trim();
      if (!clean && !attachment) return null;
      try {
        return await messagesState.send(conversationId, clean, attachment);
      } catch (err) {
        throw err;   // الرسالة معالجة داخل messagesState
      }
    };

    /* ---- إرسال مرفق ---- */
    const sendAttachment = async (conversationId, file) => {
      auth();
      const uploaded = await apiMessages.uploadAttachment(file);
      return messagesState.send(conversationId, '', uploaded);
    };

    /* ---- مؤشر الكتابة ---- */
    let typingSentAt = 0;
    const notifyTyping = (conversationId) => {
      if (!conversationId) return;
      const now = Date.now();
      // لا ترسل أكثر من مرة كل 2 ثانية
      if (now - typingSentAt < 2000) return;
      typingSentAt = now;
      liveUpdates.sendTyping(conversationId, true);
    };

    const stopTyping = (conversationId) => {
      typingSentAt = 0;
      liveUpdates.sendTyping(conversationId, false);
    };

    /* ---- وسم كمقروء ---- */
    const markRead = (conversationId, messageId = null) =>
      messagesState.markRead(conversationId, messageId);

    /* ---- حذف رسالة ---- */
    const remove = async (conversationId, messageId) => {
      auth();
      const c = messagesState.getConversation(conversationId);
      const idx = c.items.findIndex(m => m.id === messageId);
      if (idx === -1) return false;

      const backup = c.items[idx];
      c.items = c.items.filter(m => m.id !== messageId);

      try {
        await apiMessages.deleteMessage(conversationId, messageId);
        K.sound.tap();
        return true;
      } catch (err) {
        // rollback
        c.items.splice(idx, 0, backup);
        fail(err, 'تعذّر حذف الرسالة');
        throw err;
      }
    };

    /* ---- كتم ---- */
    const mute = async (conversationId, muted = true) => {
      auth();
      try {
        await apiMessages.muteConversation(conversationId, muted);
        K.utils.tryCatch(() => K.overlays?.toast?.({
          type: 'info',
          title: muted ? 'تم كتم المحادثة' : 'أُلغي الكتم',
          duration: 1800,
        }));
        return true;
      } catch (err) {
        fail(err, 'تعذّر تحديث الكتم');
        throw err;
      }
    };

    /* ---- حظر ---- */
    const block = async (conversationId) => {
      auth();
      try {
        await apiMessages.blockConversation(conversationId);
        // أزل المحادثة من القائمة
        messagesState.conversations.items = messagesState.conversations.items
          .filter(c => c.id !== conversationId);
        K.sound.tap();
        K.utils.tryCatch(() => K.overlays?.toast?.({
          type: 'info',
          title: 'حُظر المستخدم',
          duration: 2200,
        }));
        return true;
      } catch (err) {
        fail(err, 'تعذّر حظر المستخدم');
        throw err;
      }
    };

    /* ---- إعادة تعيين ---- */
    const reset = () => messagesState.reset();

    /* ---- إشعارات خارجية (للطبقة الحية) ---- */
    const receive = (msg) => messagesState.receive(msg);
    const handleReadReceipt = (data) => messagesState.handleReadReceipt(data);
    const handleTyping = (data) => messagesState.handleTyping(data);
    const setUnread = (n) => messagesState.setUnread(n);

    return {
      openWith, open, list,
      send, sendAttachment,
      notifyTyping, stopTyping,
      markRead, remove, mute, block, reset,
      receive, handleReadReceipt, handleTyping, setUnread,
      get state() { return messagesState; },
      get unread() { return messagesState.getUnread(); },
    };
  })();


  /* ═══════════════════════════════════════════════════════════
     الإشعارات — متحكّم عليا
     (يوسّع K.notifications المُعرّف في 03-store.js)
     ═══════════════════════════════════════════════════════════ */

  const notificationsApi = (() => {
    const load = async (opts = {}) => {
      if (K.store.get('authStatus') !== 'authenticated') return { items: [] };
      try {
        const raw = await apiNotifications.list(opts);

        if (opts.append) {
          const existing = K.store.get('notifications.items', []);
          const seen = new Set(existing.map(n => n.id));
          const merged = [...existing];
          for (const n of raw.items) if (!seen.has(n.id)) merged.push(n);
          K.store.set('notifications.items', merged);
        } else {
          K.store.set('notifications.items', raw.items);
        }

        K.store.set('notifications.lastFetchedAt', Date.now());
        K.notifications.setUnread(raw.unread);
        return raw;
      } catch (err) {
        console.warn('[notifications.load]', err);
        throw err;
      }
    };

    const markRead = async (id) => {
      // تحديث محلي فوري
      K.notifications.markRead(id);
      // خادم
      try { await apiNotifications.markRead(id); } catch { /* صامت */ }
    };

    const markAllRead = async () => {
      K.notifications.markAllRead();
      try { await apiNotifications.markAllRead(); } catch { /* صامت */ }
    };

    const remove = async (id) => {
      const items = K.store.get('notifications.items', []);
      const backup = items;
      const next = items.filter(n => n.id !== id);
      K.store.set('notifications.items', next);

      // عدّل العدّاد
      const removed = items.find(n => n.id === id);
      if (removed?.unread) {
        K.notifications.setUnread(K.store.get('notifications.unread', 1) - 1);
      }

      try {
        await apiNotifications.remove(id);
        return true;
      } catch (err) {
        // rollback
        K.store.set('notifications.items', backup);
        if (removed?.unread) K.notifications.setUnread(K.store.get('notifications.unread', 0) + 1);
        throw err;
      }
    };

    const clear = async () => {
      const backup = K.store.get('notifications.items', []);
      K.store.set('notifications.items', []);
      K.notifications.setUnread(0);
      try {
        await apiNotifications.clear();
        return true;
      } catch (err) {
        K.store.set('notifications.items', backup);
        throw err;
      }
    };

    const refreshUnread = async () => {
      if (K.store.get('authStatus') !== 'authenticated') return 0;
      try {
        const n = await apiNotifications.unreadCount();
        K.notifications.setUnread(n);
        return n;
      } catch {
        return K.store.get('notifications.unread', 0);
      }
    };

    return { load, markRead, markAllRead, remove, clear, refreshUnread };
  })();


  /* ═══════════════════════════════════════════════════════════
     التهيئة
     ═══════════════════════════════════════════════════════════ */

  const init = () => {
    // مزامنة عبر الحالة
    K.store.subscribe('authStatus', (status) => {
      if (status === 'guest') {
        messagesState.reset();
        K.notifications.clear();
      } else if (status === 'authenticated') {
        // جلب أولي للعدّادات
        K.utils.tryCatch(() => notificationsApi.refreshUnread());
        K.utils.tryCatch(() => apiMessages.unreadCount().then(n => messagesState.setUnread(n)));
      }
    });

    // بدء التحديثات الحية
    liveUpdates.init();

    // تنظيف عند إغلاق الصفحة
    window.addEventListener('pagehide', () => {
      liveUpdates.stop();
    }, { passive: true });
  };


  /* ═══════════════════════════════════════════════════════════
     التصدير
     ═══════════════════════════════════════════════════════════ */

  K.api.notifications = apiNotifications;
  K.api.messages = apiMessages;
  K.notificationsApi = notificationsApi;
  K.messages = messages;
  K.live = liveUpdates;

  K.social = {
    init,
    messages,
    notifications: notificationsApi,
    live: liveUpdates,
  };

  /* نهاية 07-social.js */
})();