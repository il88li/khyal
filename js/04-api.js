/* ============================================================
   خَيال · 04-api · الطبقة الأساسية
   الأجزاء: 37 (نماذج) · 38 (تحقق) · 39 (حماية) · 40 (حساب) · 47 (صحة)
   لا innerHTML · لا قراءة localStorage مباشرة من خارج هذا الملف
   ============================================================ */

'use strict';

(function () {
  const K = window.K;
  if (!K) { console.error('[api] النواة غير محمّلة'); return; }

  /* ═══════════════════════════════════════════════════════════
     الجزء 37 · تعريف بنية البيانات
     نماذج مُصنّفة + مُطبِّعات (normalizers) + مُدقّقات
     ═══════════════════════════════════════════════════════════ */

  const models = (() => {
    /* ---- أدوات تطبيع مشتركة ---- */
    const safeStr = (v, fallback = '') => (v == null ? fallback : String(v));
    const safeNum = (v, fallback = 0) => {
      const n = Number(v);
      return Number.isFinite(n) ? n : fallback;
    };
    const safeBool = (v, fallback = false) => !!v === true || v === 'true' ? true : (v === false ? false : fallback);
    const safeArr = (v) => Array.isArray(v) ? v : [];
    const safeIso = (v) => {
      if (!v) return null;
      if (v instanceof Date) return v.toISOString();
      const d = new Date(v);
      return Number.isFinite(d.getTime()) ? d.toISOString() : null;
    };
    const safeUrl = (v) => {
      const s = safeStr(v).trim();
      if (!s) return null;
      // نسمح فقط بـ https أو مسارات نسبية
      if (/^https?:\/\//i.test(s) || s.startsWith('/')) return s;
      return null;
    };

    /* ═══════════════════════════════════════════════════════════
       User
       ═══════════════════════════════════════════════════════════ */
    const User = {
      normalize(raw) {
        if (!raw) return null;
        return {
          id: safeStr(raw.id),
          handle: safeStr(raw.handle).replace(/^@/, ''),
          displayName: safeStr(raw.displayName, raw.handle || 'مبدع'),
          avatar: safeUrl(raw.avatar),
          cover: safeUrl(raw.cover),
          bio: safeStr(raw.bio).slice(0, 300),
          location: safeStr(raw.location).slice(0, 80),
          website: safeUrl(raw.website),
          verified: safeBool(raw.verified),
          accentColor: /^#[0-9a-fA-F]{6}$/.test(raw.accentColor || '') ? raw.accentColor : null,
          createdAt: safeIso(raw.createdAt),
          stats: {
            posts: safeNum(raw.stats?.posts),
            followers: safeNum(raw.stats?.followers),
            following: safeNum(raw.stats?.following),
            likes: safeNum(raw.stats?.likes),
          },
          // العلاقة مع المستخدم الحالي (تُحسب على الخادم)
          relation: {
            isSelf: safeBool(raw.relation?.isSelf),
            isFollowing: safeBool(raw.relation?.isFollowing),
            isFollowedBy: safeBool(raw.relation?.isFollowedBy),
            isBlocked: safeBool(raw.relation?.isBlocked),
          },
        };
      },

      /** نسخة مختصرة تُستخدم داخل البطاقات */
      compact(raw) {
        const u = User.normalize(raw);
        if (!u) return null;
        return {
          id: u.id,
          handle: u.handle,
          displayName: u.displayName,
          avatar: u.avatar,
          verified: u.verified,
          relation: u.relation,
        };
      },
    };

    /* ═══════════════════════════════════════════════════════════
       Post
       ═══════════════════════════════════════════════════════════ */
    const Post = {
      normalize(raw) {
        if (!raw) return null;
        const images = safeArr(raw.images).map(safeUrl).filter(Boolean);
        return {
          id: safeStr(raw.id),
          title: safeStr(raw.title).slice(0, 200),
          prompt: safeStr(raw.prompt).slice(0, 4000),
          images,
          cover: safeUrl(raw.cover) || images[0] || null,
          model: safeStr(raw.model).slice(0, 60),
          aspectRatio: safeNum(raw.aspectRatio, 4 / 5),
          tags: safeArr(raw.tags).map(t => safeStr(t).toLowerCase().replace(/^#/, '')).filter(Boolean).slice(0, 12),
          author: User.compact(raw.author),
          stats: {
            likes: safeNum(raw.stats?.likes),
            saves: safeNum(raw.stats?.saves),
            copies: safeNum(raw.stats?.copies),
            comments: safeNum(raw.stats?.comments),
            views: safeNum(raw.stats?.views),
          },
          // حالة التفاعل للمستخدم الحالي
          viewer: {
            liked: safeBool(raw.viewer?.liked),
            saved: safeBool(raw.viewer?.saved),
            isAuthor: safeBool(raw.viewer?.isAuthor),
          },
          visibility: ['public', 'unlisted', 'private'].includes(raw.visibility) ? raw.visibility : 'public',
          nsfw: safeBool(raw.nsfw),
          createdAt: safeIso(raw.createdAt),
          updatedAt: safeIso(raw.updatedAt),
        };
      },
    };

    /* ═══════════════════════════════════════════════════════════
       Comment
       ═══════════════════════════════════════════════════════════ */
    const Comment = {
      normalize(raw) {
        if (!raw) return null;
        return {
          id: safeStr(raw.id),
          postId: safeStr(raw.postId),
          parentId: raw.parentId ? safeStr(raw.parentId) : null,
          author: User.compact(raw.author),
          text: safeStr(raw.text).slice(0, 2000),
          stats: { likes: safeNum(raw.stats?.likes) },
          viewer: {
            liked: safeBool(raw.viewer?.liked),
            canDelete: safeBool(raw.viewer?.canDelete),
          },
          repliesCount: safeNum(raw.repliesCount),
          createdAt: safeIso(raw.createdAt),
        };
      },
    };

    /* ═══════════════════════════════════════════════════════════
       Like / Save / Follow — كائنات تفاعل خفيفة
       ═══════════════════════════════════════════════════════════ */
    const Like = {
      normalize(raw) {
        if (!raw) return null;
        return {
          id: safeStr(raw.id),
          userId: safeStr(raw.userId),
          postId: safeStr(raw.postId),
          createdAt: safeIso(raw.createdAt),
        };
      },
    };

    const Save = {
      normalize(raw) {
        if (!raw) return null;
        return {
          id: safeStr(raw.id),
          userId: safeStr(raw.userId),
          postId: safeStr(raw.postId),
          folderId: raw.folderId ? safeStr(raw.folderId) : null,
          createdAt: safeIso(raw.createdAt),
        };
      },
    };

    const Follow = {
      normalize(raw) {
        if (!raw) return null;
        return {
          followerId: safeStr(raw.followerId),
          followingId: safeStr(raw.followingId),
          createdAt: safeIso(raw.createdAt),
        };
      },
    };

    /* ═══════════════════════════════════════════════════════════
       Conversation / Message
       ═══════════════════════════════════════════════════════════ */
    const Conversation = {
      normalize(raw) {
        if (!raw) return null;
        return {
          id: safeStr(raw.id),
          peer: User.compact(raw.peer),
          lastMessage: raw.lastMessage ? Message.compact(raw.lastMessage) : null,
          unreadCount: safeNum(raw.unreadCount),
          createdAt: safeIso(raw.createdAt),
          updatedAt: safeIso(raw.updatedAt),
        };
      },
    };

    const Message = {
      normalize(raw) {
        if (!raw) return null;
        return {
          id: safeStr(raw.id),
          conversationId: safeStr(raw.conversationId),
          senderId: safeStr(raw.senderId),
          text: safeStr(raw.text).slice(0, 4000),
          attachment: raw.attachment ? {
            type: ['image', 'video', 'file'].includes(raw.attachment.type) ? raw.attachment.type : 'file',
            url: safeUrl(raw.attachment.url),
            size: safeNum(raw.attachment.size),
          } : null,
          state: ['sending', 'sent', 'delivered', 'read', 'failed'].includes(raw.state) ? raw.state : 'sent',
          createdAt: safeIso(raw.createdAt),
          readAt: safeIso(raw.readAt),
        };
      },

      compact(raw) {
        const m = Message.normalize(raw);
        if (!m) return null;
        return {
          id: m.id,
          text: m.text.slice(0, 120),
          senderId: m.senderId,
          state: m.state,
          createdAt: m.createdAt,
        };
      },
    };

    /* ═══════════════════════════════════════════════════════════
       Notification
       ═══════════════════════════════════════════════════════════ */
    const Notification = {
      TYPES: ['like', 'comment', 'follow', 'save', 'mention'],

      normalize(raw) {
        if (!raw) return null;
        const type = Notification.TYPES.includes(raw.type) ? raw.type : 'like';
        return {
          id: safeStr(raw.id),
          type,
          actor: User.compact(raw.actor),
          targetId: raw.targetId ? safeStr(raw.targetId) : null,
          targetThumb: safeUrl(raw.targetThumb),
          text: safeStr(raw.text).slice(0, 300),
          unread: safeBool(raw.unread, true),
          createdAt: safeIso(raw.createdAt),
        };
      },
    };

    /* ═══════════════════════════════════════════════════════════
       Report
       ═══════════════════════════════════════════════════════════ */
    const Report = {
      REASONS: [
        'spam',
        'harassment',
        'hate',
        'violence',
        'sexual',
        'misinformation',
        'copyright',
        'impersonation',
        'other',
      ],

      normalize(raw) {
        if (!raw) return null;
        return {
          id: safeStr(raw.id),
          targetType: ['post', 'comment', 'user', 'message'].includes(raw.targetType) ? raw.targetType : 'post',
          targetId: safeStr(raw.targetId),
          reason: Report.REASONS.includes(raw.reason) ? raw.reason : 'other',
          note: safeStr(raw.note).slice(0, 500),
          state: ['pending', 'reviewing', 'resolved', 'rejected'].includes(raw.state) ? raw.state : 'pending',
          createdAt: safeIso(raw.createdAt),
        };
      },
    };

    /* ---- تصدير ---- */
    return { User, Post, Comment, Like, Save, Follow, Conversation, Message, Notification, Report };
  })();

  K.models = models;

  /* ═══════════════════════════════════════════════════════════
     الجزء 38 · التحقق من المدخلات
     كل قاعدة صريحة · لا قبول صامت لحقل غير صالح
     ═══════════════════════════════════════════════════════════ */

  const validate = (() => {
    const errors = (msgs) => {
      const e = new K.errors.Validate(msgs[0] || 'مدخل غير صالح');
      e.messages = msgs;
      e.field = msgs[0]?.field;
      return e;
    };

    /* ---- أدوات ذرّية ---- */
    const isNonEmpty = (s) => typeof s === 'string' && s.trim().length > 0;
    const len = (s) => (typeof s === 'string' ? s.length : 0);
    const clampLen = (s, min, max) => len(s) >= min && len(s) <= max;

    /* ---- قواعد الحقول ---- */

    /** Handle: a-z · 0-9 · _ · . — 3..30 حرفاً */
    const handle = (value) => {
      const v = String(value || '').trim().replace(/^@/, '');
      if (!v) return { ok: false, error: 'المعرّف مطلوب', field: 'handle' };
      if (!/^[a-z0-9_.]{3,30}$/i.test(v)) {
        return { ok: false, error: 'المعرّف: 3-30 حرفاً لاتينياً أو رقماً أو _ أو .', field: 'handle' };
      }
      if (/^[_.]|[_.]$/.test(v)) {
        return { ok: false, error: 'لا يبدأ المعرّف أو ينتهي بـ _ أو .', field: 'handle' };
      }
      return { ok: true, value: v.toLowerCase() };
    };

    /** الاسم المعروض: 2..60 حرفاً — يقبل العربية والإيموجي */
    const displayName = (value) => {
      const v = String(value || '').trim().replace(/\s+/g, ' ');
      if (!isNonEmpty(v)) return { ok: false, error: 'الاسم مطلوب', field: 'displayName' };
      if (!clampLen(v, 2, 60)) return { ok: false, error: 'الاسم: من حرفين إلى 60 حرفاً', field: 'displayName' };
      // منع الأحرف الخاصة بلا داعٍ
      if (/[\u0000-\u001F\u007F]/.test(v)) {
        return { ok: false, error: 'الاسم يحتوي على رموز غير مسموحة', field: 'displayName' };
      }
      return { ok: true, value: v };
    };

    /** البريد الإلكتروني */
    const email = (value) => {
      const v = String(value || '').trim().toLowerCase();
      if (!v) return { ok: false, error: 'البريد الإلكتروني مطلوب', field: 'email' };
      // RFC بشريط عملي
      const re = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i;
      if (!re.test(v) || v.length > 254) {
        return { ok: false, error: 'صيغة البريد غير صحيحة', field: 'email' };
      }
      return { ok: true, value: v };
    };

    /** كلمة المرور: 8..128 — حرف + رقم */
    const password = (value) => {
      const v = String(value || '');
      if (!v) return { ok: false, error: 'كلمة المرور مطلوبة', field: 'password' };
      if (!clampLen(v, 8, 128)) {
        return { ok: false, error: 'كلمة المرور: من 8 إلى 128 حرفاً', field: 'password' };
      }
      if (!/[A-Za-z]/.test(v) || !/\d/.test(v)) {
        return { ok: false, error: 'يجب أن تحتوي على حرف ورقم على الأقل', field: 'password' };
      }
      // رفض الأكثر شيوعاً
      const common = ['password', '12345678', 'qwertyui', 'aaaaaaaa', 'password1'];
      if (common.some(c => v.toLowerCase().includes(c))) {
        return { ok: false, error: 'كلمة المرور ضعيفة — اختر عبارة أقوى', field: 'password' };
      }
      return { ok: true, value: v };
    };

    /** نبذة: ≤ 300 */
    const bio = (value) => {
      const v = String(value || '').trim();
      if (!v) return { ok: true, value: '' };
      if (len(v) > 300) return { ok: false, error: 'النبذة: 300 حرفاً كحد أقصى', field: 'bio' };
      return { ok: true, value: v };
    };

    /** العنوان: 1..200 */
    const title = (value) => {
      const v = String(value || '').trim();
      if (!isNonEmpty(v)) return { ok: false, error: 'العنوان مطلوب', field: 'title' };
      if (len(v) > 200) return { ok: false, error: 'العنوان: 200 حرفاً كحد أقصى', field: 'title' };
      return { ok: true, value: v };
    };

    /** نص البرومبت: 1..4000 */
    const prompt = (value) => {
      const v = String(value || '').trim();
      if (!isNonEmpty(v)) return { ok: false, error: 'البرومبت مطلوب', field: 'prompt' };
      if (len(v) > 4000) return { ok: false, error: 'البرومبت: 4000 حرفاً كحد أقصى', field: 'prompt' };
      return { ok: true, value: v };
    };

    /** تعليق: 1..2000 */
    const commentText = (value) => {
      const v = String(value || '').trim();
      if (!isNonEmpty(v)) return { ok: false, error: 'التعليق فارغ', field: 'text' };
      if (len(v) > 2000) return { ok: false, error: 'التعليق: 2000 حرفاً كحد أقصى', field: 'text' };
      return { ok: true, value: v };
    };

    /** رسالة دردشة: 1..4000 */
    const messageText = (value) => {
      const v = String(value || '').trim();
      if (!isNonEmpty(v)) return { ok: false, error: 'الرسالة فارغة', field: 'text' };
      if (len(v) > 4000) return { ok: false, error: 'الرسالة: 4000 حرفاً كحد أقصى', field: 'text' };
      return { ok: true, value: v };
    };

    /** وسم: 1..30 · بلا مسافات ولا # */
    const tag = (value) => {
      const v = String(value || '').trim().toLowerCase().replace(/^#/, '').replace(/\s+/g, '-');
      if (!isNonEmpty(v)) return { ok: false, error: 'الوسم فارغ', field: 'tag' };
      if (!/^[\p{L}\p{N}_-]{1,30}$/u.test(v)) {
        return { ok: false, error: 'الوسم: حروف وأرقام و _ و - فقط', field: 'tag' };
      }
      return { ok: true, value: v };
    };

    /** مصفوفة وسوم: ≤ 12 */
    const tags = (value) => {
      if (!Array.isArray(value)) return { ok: true, value: [] };
      const out = [];
      for (const t of value) {
        const r = tag(t);
        if (r.ok && !out.includes(r.value)) out.push(r.value);
        if (out.length >= 12) break;
      }
      return { ok: true, value: out };
    };

    /** رابط: http/https فقط */
    const url = (value, opts = {}) => {
      const v = String(value || '').trim();
      if (!v) return { ok: true, value: '' };
      try {
        const u = new URL(v);
        const allowed = opts.allowedSchemes || ['http:', 'https:'];
        if (!allowed.includes(u.protocol)) {
          return { ok: false, error: 'الرابط يجب أن يبدأ بـ http أو https', field: opts.field || 'url' };
        }
        if (opts.requireHttps && u.protocol !== 'https:') {
          return { ok: false, error: 'الرابط يجب أن يكون https', field: opts.field || 'url' };
        }
        return { ok: true, value: u.toString() };
      } catch {
        return { ok: false, error: 'صيغة الرابط غير صحيحة', field: opts.field || 'url' };
      }
    };

    /** اسم ملف صورة */
    const imageFile = (file, opts = {}) => {
      if (!file) return { ok: false, error: 'الملف مطلوب', field: 'file' };
      const allowed = opts.types || ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
      const maxBytes = opts.maxBytes || 10 * 1024 * 1024;
      if (!allowed.includes(file.type)) {
        return { ok: false, error: 'صيغة الصورة غير مدعومة', field: 'file' };
      }
      if (file.size > maxBytes) {
        return { ok: false, error: `حجم الصورة يجب أن يكون أقل من ${K.format.fileSize(maxBytes)}`, field: 'file' };
      }
      return { ok: true, value: file };
    };

    /**
     * تحقق من كائن كامل حسب مخطط.
     * @param {object} input
     * @param {object} schema  {field: fn(value) => {ok,value,error,field}}
     * @param {object} [opts]
     * @param {boolean} [opts.partial]  يسمح بحقول ناقصة
     */
    const object = (input, schema, opts = {}) => {
      const out = {};
      const msgs = [];
      for (const field in schema) {
        const value = input?.[field];
        const isEmpty = value === undefined || value === null || value === '';
        if (opts.partial && isEmpty) continue;
        const result = schema[field](value);
        if (!result.ok) {
          msgs.push({ field: result.field || field, message: result.error });
          continue;
        }
        if (result.value !== undefined) out[field] = result.value;
      }
      if (msgs.length) {
        const err = new K.errors.Validate(msgs[0].message);
        err.messages = msgs;
        err.field = msgs[0].field;
        throw err;
      }
      return out;
    };

    /* ---- مدقّقات خاصة بالمخططات ---- */
    const schemas = {
      signup: {
        handle: handle,
        displayName: displayName,
        email: email,
        password: password,
      },
      login: {
        email: email,
        password: (v) => ({ ok: isNonEmpty(v), value: v, error: 'كلمة المرور مطلوبة', field: 'password' }),
      },
      profileUpdate: {
        displayName: (v) => v == null ? { ok: true, value: undefined } : displayName(v),
        bio: (v) => v == null ? { ok: true, value: undefined } : bio(v),
        location: (v) => v == null ? { ok: true, value: undefined } : { ok: true, value: String(v).slice(0, 80) },
        website: (v) => v == null ? { ok: true, value: undefined } : url(v, { field: 'website' }),
      },
      postCreate: {
        title, prompt, tags,
      },
      commentCreate: {
        text: commentText,
      },
      messageCreate: {
        text: messageText,
      },
      reportCreate: {
        targetType: (v) => ['post', 'comment', 'user', 'message'].includes(v)
          ? { ok: true, value: v }
          : { ok: false, error: 'نوع الهدف غير صحيح', field: 'targetType' },
        targetId: (v) => isNonEmpty(v)
          ? { ok: true, value: String(v) }
          : { ok: false, error: 'المعرّف مطلوب', field: 'targetId' },
        reason: (v) => models.Report.REASONS.includes(v)
          ? { ok: true, value: v }
          : { ok: false, error: 'السبب مطلوب', field: 'reason' },
        note: (v) => ({ ok: true, value: String(v || '').slice(0, 500) }),
      },
    };

    return {
      handle, displayName, email, password, bio, title, prompt,
      commentText, messageText, tag, tags, url, imageFile,
      object, schemas,
      // أدوات مساعدة للاستخدام الخارجي
      isNonEmpty, len,
    };
  })();

  K.validate = validate;

  /* ═══════════════════════════════════════════════════════════
     الجزء 39 · الحماية
     CSRF · Rate Limit · Sanitize · Permissions
     ═══════════════════════════════════════════════════════════ */

  const security = (() => {
    let csrfToken = null;
    let csrfFetchedAt = 0;
    const CSRF_TTL = 20 * 60 * 1000;   // 20 دقيقة

    /* ---- CSRF ---- */
    const fetchCsrf = async () => {
      if (csrfToken && Date.now() - csrfFetchedAt < CSRF_TTL) return csrfToken;
      const res = await fetch('/api/csrf', { credentials: 'same-origin' });
      if (!res.ok) throw new Error('فشل جلب رمز الحماية');
      const data = await res.json();
      csrfToken = data.token;
      csrfFetchedAt = Date.now();
      return csrfToken;
    };

    const getCsrf = () => csrfToken;
    const refreshCsrf = () => { csrfToken = null; return fetchCsrf(); };

    /* ---- Rate Limit محلي (حماية مبكرة قبل الخادم) ---- */
    const buckets = new Map();

    /**
     * هل العملية مسموحة الآن؟
     * @param {string} key      مثل: 'like:' + postId
     * @param {object} [opts]
     * @param {number} [opts.max=10]     الحد
     * @param {number} [opts.window=60000] النافذة (مللي)
     */
    const canDo = (key, opts = {}) => {
      const max = opts.max ?? 10;
      const windowMs = opts.window ?? 60000;
      const now = Date.now();
      let b = buckets.get(key);
      if (!b || now - b.resetAt > windowMs) {
        b = { count: 0, resetAt: now + windowMs };
        buckets.set(key, b);
      }
      if (b.count >= max) return { allowed: false, retryAfter: b.resetAt - now };
      b.count += 1;
      return { allowed: true, remaining: max - b.count };
    };

    const resetRateLimit = (key) => { buckets.delete(key); };

    /* ---- Sanitize ---- */

    /** إزالة كل وسوم HTML من نص (بلا innerHTML — regex آمن) */
    const stripHtml = (input) => {
      const s = String(input || '');
      // إزالة الوسوم بشكل غير مدمّر
      return s
        .replace(/<\/?[^>]+(>|$)/g, '')
        .replace(/[\u0000-\u001F\u007F]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
    };

    /** تنقية نص مع الحفاظ على الأسطر الجديدة والمسافات البادئة */
    const sanitizeText = (input, opts = {}) => {
      const maxLen = opts.maxLen ?? 4000;
      let s = String(input || '').slice(0, maxLen);
      // إزالة محارف التحكم ما عدا \n \t
      s = s.replace(/[\u0000-\u0008\u000B-\u001F\u007F]/g, '');
      // إزالة وسوم HTML
      s = s.replace(/<\/?[^>]+(>|$)/g, '');
      return s.trim();
    };

    /** تنقية رابط (نسبي أو https فقط) */
    const sanitizeUrl = (input) => {
      const s = String(input || '').trim();
      if (!s) return '';
      if (s.startsWith('/') && !s.startsWith('//')) return s;
      try {
        const u = new URL(s);
        if (u.protocol !== 'https:' && u.protocol !== 'http:') return '';
        // منع javascript: · data: · file:
        return u.toString();
      } catch {
        return '';
      }
    };

    /** منع البروتوكولات الخطرة في input */
    const isDangerousUrl = (input) => {
      const s = String(input || '').toLowerCase().trim();
      return /^(javascript|data|vbscript|file):/i.test(s);
    };

    /* ---- Permissions ---- */

    /**
     * هل المستخدم الحالي يملك الصلاحية؟
     * @param {string} action   'like' | 'save' | 'comment' | 'delete:own' | 'delete:any' | 'edit:own'
     * @param {object} [ctx]    {owner: userId, ...}
     */
    const can = (action, ctx = {}) => {
      const user = K.store.get('user');
      const authed = K.store.get('authStatus') === 'authenticated' && user?.id;

      const [base, scope] = action.split(':');

      switch (base) {
        case 'like':
        case 'save':
        case 'comment':
        case 'follow':
        case 'report':
          return authed;
        case 'delete':
          if (!authed) return false;
          if (scope === 'own') return ctx.owner === user.id;
          if (scope === 'any') return user.role === 'moderator' || user.role === 'admin';
          return false;
        case 'edit':
          if (!authed) return false;
          if (scope === 'own') return ctx.owner === user.id;
          if (scope === 'any') return user.role === 'moderator' || user.role === 'admin';
          return false;
        case 'view':
          if (ctx.visibility === 'public') return true;
          if (!authed) return false;
          return ctx.owner === user.id || ctx.visibility === 'unlisted';
        default:
          return false;
      }
    };

    /** يرمي خطأ إن لم تكن الصلاحية متوفرة */
    const require_ = (action, ctx = {}) => {
      if (!can(action, ctx)) {
        throw new K.errors.Auth('لا تملك صلاحية تنفيذ هذا الإجراء');
      }
    };

    /* ---- المصادقة عند الطلب ---- */

    /** يضمن أن المستخدم مسجّل · يرمي استثناءً إن لا */
    const requireAuth = () => {
      if (K.store.get('authStatus') !== 'authenticated' || !K.store.get('user')?.id) {
        throw new K.errors.Auth('سجّل الدخول للمتابعة');
      }
    };

    return {
      fetchCsrf, getCsrf, refreshCsrf,
      canDo, resetRateLimit,
      stripHtml, sanitizeText, sanitizeUrl, isDangerousUrl,
      can, require: require_, requireAuth,
    };
  })();

  K.security = security;

  /* ═══════════════════════════════════════════════════════════
     HTTP Client — يُستخدم من كل أجزاء الـ API
     ═══════════════════════════════════════════════════════════ */

  const http = (() => {
    const DEFAULT_TIMEOUT = 15000;
    const MAX_RETRIES = 2;

    /** استخراج الحالة من Response */
    const classify = (res) => {
      if (res.ok) return null;
      if (res.status === 401) return new K.errors.Auth('انتهت الجلسة — سجّل الدخول مجدداً');
      if (res.status === 403) return new K.errors.Auth('لا تملك صلاحية لهذا الإجراء');
      if (res.status === 404) return new K.errors.NotFound('العنصر غير موجود');
      if (res.status === 429) {
        const retryAfter = parseInt(res.headers.get('Retry-After') || '60', 10) * 1000;
        return new K.errors.RateLimit('طلبات كثيرة — انتظر قليلاً', retryAfter);
      }
      if (res.status >= 500) return new K.errors.Network('الخادم مشغول — سنحاول مجدداً', res.status);
      return new K.errors.Network('فشل الطلب', res.status);
    };

    /** الطلب الأساسي */
    const request = async (method, url, opts = {}) => {
      const {
        body = null,
        headers = {},
        timeout = DEFAULT_TIMEOUT,
        csrf = false,           // هل يحتاج رمز حماية؟
        signal: userSignal,
        retries = MAX_RETRIES,
        parse = 'json',         // 'json' | 'text' | 'blob' | 'none'
      } = opts;

      const controller = new AbortController();
      const signal = userSignal || controller.signal;
      const timer = setTimeout(() => controller.abort('timeout'), timeout);

      const finalHeaders = {
        Accept: 'application/json',
        ...headers,
      };

      // CSRF للطلبات المُغيِّرة
      if (csrf && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method.toUpperCase())) {
        try {
          const token = await security.fetchCsrf();
          if (token) finalHeaders['X-CSRF-Token'] = token;
        } catch (err) {
          console.warn('[http.csrf]', err);
        }
      }

      let bodyOut = body;
      if (body != null && !(body instanceof FormData) && typeof body !== 'string') {
        finalHeaders['Content-Type'] = 'application/json';
        bodyOut = JSON.stringify(body);
      }

      let attempt = 0;
      let lastError = null;

      while (attempt <= retries) {
        try {
          const res = await fetch(url, {
            method,
            headers: finalHeaders,
            body: bodyOut,
            credentials: 'same-origin',
            signal,
          });

          clearTimeout(timer);

          const error = classify(res);
          if (error) {
            // إعادة محاولة على 5xx و429 فقط
            if (
              attempt < retries &&
              (error instanceof K.errors.Network || error instanceof K.errors.RateLimit) &&
              (res.status >= 500 || res.status === 429)
            ) {
              const backoff = Math.min(1000 * Math.pow(2, attempt), 4000);
              await K.utils.sleep(error.retryAfter || backoff);
              attempt += 1;
              continue;
            }
            throw error;
          }

          if (parse === 'none') return null;
          if (parse === 'text') return res.text();
          if (parse === 'blob') return res.blob();
          // json مع تراجع إن كان الرد فارغاً
          const text = await res.text();
          if (!text) return null;
          try { return JSON.parse(text); }
          catch { return text; }
        } catch (err) {
          clearTimeout(timer);
          if (err.name === 'AbortError') {
            if (err.message === 'timeout' || userSignal?.aborted !== true) {
              lastError = new K.errors.Network('انتهت مهلة الاتصال');
            } else {
              throw new K.errors.Network('تم إلغاء الطلب');
            }
          } else if (err instanceof K.errors.Network || err instanceof K.errors.Auth ||
                     err instanceof K.errors.NotFound || err instanceof K.errors.RateLimit) {
            throw err;
          } else {
            lastError = new K.errors.Network('تعذّر الاتصال بالخادم', 0);
          }

          if (attempt < retries) {
            const backoff = Math.min(1000 * Math.pow(2, attempt), 4000);
            await K.utils.sleep(backoff);
            attempt += 1;
            continue;
          }
          throw lastError;
        }
      }
      throw lastError || new K.errors.Unknown('فشل غير متوقع');
    };

    return {
      get: (url, opts) => request('GET', url, opts),
      post: (url, body, opts) => request('POST', url, { ...opts, body, csrf: true }),
      put: (url, body, opts) => request('PUT', url, { ...opts, body, csrf: true }),
      patch: (url, body, opts) => request('PATCH', url, { ...opts, body, csrf: true }),
      del: (url, opts) => request('DELETE', url, { ...opts, csrf: true }),
      request,
    };
  })();

  K.http = http;

  /* ═══════════════════════════════════════════════════════════
     الجزء 40 · حساب المستخدم
     ═══════════════════════════════════════════════════════════ */

  const account = (() => {
    const BASE = '/api/account';

    /* ---- إنشاء حساب ---- */
    const signup = async (payload) => {
      const clean = validate.object(payload, validate.schemas.signup);
      const res = await http.post(`${BASE}/signup`, clean);
      const user = models.User.normalize(res?.user);
      if (!user) throw new K.errors.Unknown('رد غير متوقع من الخادم');
      K.store.patch({
        user,
        authStatus: 'authenticated',
      });
      K.router.home();
      K.sound.success();
      return user;
    };

    /* ---- تسجيل الدخول ---- */
    const login = async (payload) => {
      const clean = validate.object(payload, validate.schemas.login);
      const res = await http.post(`${BASE}/login`, clean);
      const user = models.User.normalize(res?.user);
      if (!user) throw new K.errors.Unknown('رد غير متوقع من الخادم');
      K.store.patch({
        user,
        authStatus: 'authenticated',
      });
      K.router.home();
      K.sound.success();
      return user;
    };

    /* ---- تسجيل الخروج ---- */
    const logout = async (opts = {}) => {
      const silent = opts.silent === true;
      try {
        await http.post(`${BASE}/logout`, {});
      } catch (err) {
        console.warn('[account.logout]', err);
      }
      K.store.reset({ keep: ['prefs'], noPersist: silent ? false : false });
      K.store.set('authStatus', 'guest');
      K.router.home();
      if (!silent) K.sound.tap();
    };

    /* ---- جلب الحساب الحالي ---- */
    const me = async (opts = {}) => {
      try {
        const res = await http.get(`${BASE}/me`, { timeout: opts.timeout || 8000 });
        const user = models.User.normalize(res?.user);
        if (!user) {
          K.store.set('authStatus', 'guest');
          return null;
        }
        K.store.patch({
          user,
          authStatus: 'authenticated',
        });
        return user;
      } catch (err) {
        if (err instanceof K.errors.Auth) {
          K.store.set('authStatus', 'guest');
          return null;
        }
        // خطأ شبكي — لا نعلن أن المستخدم زائر
        throw err;
      }
    };

    /* ---- تحديث الملف الشخصي ---- */
    const updateProfile = async (payload) => {
      security.requireAuth();
      const clean = validate.object(payload, validate.schemas.profileUpdate, { partial: true });
      const res = await http.patch(`${BASE}/profile`, clean);
      const user = models.User.normalize(res?.user);
      if (!user) throw new K.errors.Unknown('فشل تحديث الملف');
      K.store.set('user', user);
      K.sound.success();
      return user;
    };

    /* ---- رفع صورة ---- */
    const uploadAvatar = async (file) => {
      security.requireAuth();
      const check = validate.imageFile(file, { maxBytes: 5 * 1024 * 1024 });
      if (!check.ok) throw new K.errors.Validate(check.error, check.field);

      const form = new FormData();
      form.append('avatar', file);

      const res = await http.post(`${BASE}/avatar`, form, {
        headers: {},           // يُضبط تلقائياً في http
        timeout: 30000,
      });
      const user = models.User.normalize(res?.user);
      if (!user) throw new K.errors.Unknown('فشل رفع الصورة');
      K.store.set('user', user);
      K.sound.success();
      return user;
    };

    /* ---- رفع الغلاف ---- */
    const uploadCover = async (file) => {
      security.requireAuth();
      const check = validate.imageFile(file, { maxBytes: 10 * 1024 * 1024 });
      if (!check.ok) throw new K.errors.Validate(check.error, check.field);

      const form = new FormData();
      form.append('cover', file);

      const res = await http.post(`${BASE}/cover`, form, { timeout: 45000 });
      const user = models.User.normalize(res?.user);
      if (!user) throw new K.errors.Unknown('فشل رفع الغلاف');
      K.store.set('user', user);
      K.sound.success();
      return user;
    };

    /* ---- تغيير كلمة المرور ---- */
    const changePassword = async (currentPassword, newPassword) => {
      security.requireAuth();
      const pass = validate.password(newPassword);
      if (!pass.ok) throw new K.errors.Validate(pass.error, 'password');
      if (!validate.isNonEmpty(currentPassword)) {
        throw new K.errors.Validate('كلمة المرور الحالية مطلوبة', 'currentPassword');
      }

      // Rate limit محلي
      const rl = security.canDo('password-change', { max: 3, window: 5 * 60 * 1000 });
      if (!rl.allowed) {
        throw new K.errors.RateLimit('محاولات كثيرة — انتظر بضع دقائق');
      }

      await http.patch(`${BASE}/password`, {
        currentPassword,
        newPassword: pass.value,
      });
      K.sound.success();
      return true;
    };

    /* ---- حذف الحساب ---- */
    const deleteAccount = async (password) => {
      security.requireAuth();
      if (!validate.isNonEmpty(password)) {
        throw new K.errors.Validate('كلمة المرور مطلوبة للتأكيد', 'password');
      }
      await http.del(`${BASE}/delete`, {
        headers: { 'X-Confirm-Delete': 'yes' },
      });
      await logout({ silent: true });
      return true;
    };

    return {
      signup, login, logout, me,
      updateProfile, uploadAvatar, uploadCover,
      changePassword, deleteAccount,
    };
  })();

  K.account = account;

  /* ═══════════════════════════════════════════════════════════
     الجزء 47 · الصحة والصيانة
     مراقبة الاتصال · حالة القاعدة · أدوات التشخيص
     ═══════════════════════════════════════════════════════════ */

  const health = (() => {
    const BASE = '/api/health';
    let lastPing = null;
    let lastPingAt = 0;
    let consecutiveFailures = 0;
    let status = 'unknown';   // 'ok' | 'degraded' | 'down' | 'unknown'

    /* ---- نبضة بسيطة ---- */
    const ping = async () => {
      const started = performance.now();
      try {
        const res = await http.get(`${BASE}/ping`, { timeout: 5000, retries: 0 });
        const latency = performance.now() - started;
        lastPing = latency;
        lastPingAt = Date.now();
        consecutiveFailures = 0;
        status = latency > 1500 ? 'degraded' : 'ok';
        return { ok: true, latency };
      } catch (err) {
        consecutiveFailures += 1;
        lastPing = null;
        lastPingAt = Date.now();
        status = consecutiveFailures >= 3 ? 'down' : 'degraded';
        return { ok: false, error: err };
      }
    };

    /* ---- فحص كامل (يستدعيه زر التشخيص) ---- */
    const check = async () => {
      const out = {
        timestamp: new Date().toISOString(),
        client: {
          online: navigator.onLine !== false,
          effectiveType: navigator.connection?.effectiveType || 'unknown',
          saveData: !!navigator.connection?.saveData,
          memory: navigator.deviceMemory || 'unknown',
          cores: navigator.hardwareConcurrency || 'unknown',
          isWebView: K.support.isWebView,
          userAgent: navigator.userAgent,
          reducedMotion: K.support.reducedMotion,
        },
        perf: K.perf?.stats?.() || null,
        server: null,
        errors: [],
      };

      try {
        const res = await http.get(`${BASE}/check`, { timeout: 10000, retries: 0 });
        out.server = {
          ok: true,
          status: res?.status || 'ok',
          database: res?.database || 'unknown',
          version: res?.version || 'unknown',
          uptime: res?.uptime || 0,
          latency: res?.latency || null,
        };
      } catch (err) {
        out.server = {
          ok: false,
          error: err?.message || 'فشل الفحص',
          name: err?.name || 'UnknownError',
        };
        out.errors.push(err);
      }

      return out;
    };

    /* ---- نبض دوري ---- */
    let pingInterval = null;
    const startHeartbeat = (intervalMs = 60000) => {
      if (pingInterval) clearInterval(pingInterval);
      ping();
      pingInterval = setInterval(ping, intervalMs);
    };

    const stopHeartbeat = () => {
      if (pingInterval) {
        clearInterval(pingInterval);
        pingInterval = null;
      }
    };

    /* ---- حالة موحّدة للعرض في الواجهة ---- */
    const snapshot = () => ({
      status,
      latency: lastPing,
      lastPingAt,
      failures: consecutiveFailures,
      online: navigator.onLine !== false,
      slow: !!navigator.connection?.saveData ||
            ['slow-2g', '2g'].includes(navigator.connection?.effectiveType),
    });

    /* ---- إصلاح ذاتي عند العودة ---- */
    const init = () => {
      window.addEventListener('online', () => {
        consecutiveFailures = 0;
        ping();
      }, { passive: true });
      window.addEventListener('offline', () => {
        status = 'down';
      }, { passive: true });
      startHeartbeat(60000);
    };

    return {
      ping, check, snapshot,
      startHeartbeat, stopHeartbeat,
      init,
      get status() { return status; },
      get latency() { return lastPing; },
    };
  })();

  K.health = health;

  /* ═══════════════════════════════════════════════════════════
     التهيئة الموحّدة
     ═══════════════════════════════════════════════════════════ */

  const init = async () => {
    health.init();
    // جلب الجلسة عند البدء — يُخبر الحالة الرئيسية
    try {
      await account.me({ timeout: 6000 });
    } catch (err) {
      // فشل شبكي — نُبقي authStatus='loading' ليُقرّره المستدعي
      console.warn('[api.init] فشل جلب الجلسة', err);
    }
  };

  K.api = {
    init,
    models,
    validate,
    security,
    http,
    account,
    health,
    // تسهيلات
    get models_() { return models; },
    schemas: validate.schemas,
  };

  /* نهاية 04-api.js */
})();