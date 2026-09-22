/* ============================================================
   خَيال · 06-interactions · التفاعل
   الأجزاء: 42 (API تفاعلات) · 46 (بلاغات) · 29 (متحكّم التفاعل)
   تحديث تفاؤلي + rollback تلقائي · كتم تكرار · تغذية بصرية/صوتية
   ============================================================ */

'use strict';

(function () {
  const K = window.K;
  if (!K) { console.error('[interactions] النواة غير محمّلة'); return; }


  /* ═══════════════════════════════════════════════════════════
     الجزء 42 · API التفاعلات
     إعجاب · حفظ · متابعة · تعليق · نسخ
     ═══════════════════════════════════════════════════════════ */

  const api = (() => {
    const BASE = '/api/interactions';

    /* ---- إعجاب ---- */
    const like = (postId) => K.http.post(`${BASE}/like`, { postId });
    const unlike = (postId) => K.http.del(`${BASE}/like?postId=${encodeURIComponent(postId)}`);
    const getLikes = (opts = {}) => {
      const params = new URLSearchParams({ limit: String(opts.limit || 20) });
      if (opts.cursor) params.set('cursor', opts.cursor);
      return K.http.get(`${BASE}/likes?${params}`);
    };

    /* ---- حفظ ---- */
    const save = (postId, folderId = null) => K.http.post(`${BASE}/save`, { postId, folderId });
    const unsave = (postId) => K.http.del(`${BASE}/save?postId=${encodeURIComponent(postId)}`);
    const getSaves = (opts = {}) => {
      const params = new URLSearchParams({ limit: String(opts.limit || 20) });
      if (opts.cursor) params.set('cursor', opts.cursor);
      if (opts.folderId) params.set('folderId', opts.folderId);
      return K.http.get(`${BASE}/saves?${params}`);
    };

    /* ---- متابعة ---- */
    const follow = (userId) => K.http.post(`${BASE}/follow`, { userId });
    const unfollow = (userId) => K.http.del(`${BASE}/follow?userId=${encodeURIComponent(userId)}`);
    const getFollowers = (userId, opts = {}) => {
      const params = new URLSearchParams({ limit: String(opts.limit || 20) });
      if (opts.cursor) params.set('cursor', opts.cursor);
      return K.http.get(`${BASE}/followers/${encodeURIComponent(userId)}?${params}`);
    };
    const getFollowing = (userId, opts = {}) => {
      const params = new URLSearchParams({ limit: String(opts.limit || 20) });
      if (opts.cursor) params.set('cursor', opts.cursor);
      return K.http.get(`${BASE}/following/${encodeURIComponent(userId)}?${params}`);
    };

    /* ---- نسخ ---- */
    const countCopy = (postId) =>
      K.http.post(`${BASE}/copy`, { postId }, { timeout: 5000 }).catch(() => null);

    /* ---- تعليقات ---- */
    const createComment = (payload) => {
      const clean = K.validate.object(payload, K.validate.schemas.commentCreate);
      return K.http.post(`${BASE}/comments`, {
        postId: payload.postId,
        parentId: payload.parentId || null,
        text: clean.text,
      });
    };

    const updateComment = (commentId, text) => {
      const check = K.validate.commentText(text);
      if (!check.ok) throw new K.errors.Validate(check.error, 'text');
      return K.http.patch(`${BASE}/comments/${encodeURIComponent(commentId)}`, { text: check.value });
    };

    const deleteComment = (commentId) =>
      K.http.del(`${BASE}/comments/${encodeURIComponent(commentId)}`);

    const getComments = (postId, opts = {}) => {
      const params = new URLSearchParams({ limit: String(opts.limit || 20) });
      if (opts.cursor) params.set('cursor', opts.cursor);
      if (opts.sort) params.set('sort', opts.sort);
      return K.http.get(`${BASE}/comments/${encodeURIComponent(postId)}?${params}`);
    };

    const getReplies = (commentId, opts = {}) => {
      const params = new URLSearchParams({ limit: String(opts.limit || 10) });
      if (opts.cursor) params.set('cursor', opts.cursor);
      return K.http.get(`${BASE}/comments/${encodeURIComponent(commentId)}/replies?${params}`);
    };

    const likeComment = (commentId) =>
      K.http.post(`${BASE}/comments/${encodeURIComponent(commentId)}/like`, {});
    const unlikeComment = (commentId) =>
      K.http.del(`${BASE}/comments/${encodeURIComponent(commentId)}/like`);

    return {
      like, unlike, getLikes,
      save, unsave, getSaves,
      follow, unfollow, getFollowers, getFollowing,
      countCopy,
      createComment, updateComment, deleteComment,
      getComments, getReplies,
      likeComment, unlikeComment,
    };
  })();


  /* ═══════════════════════════════════════════════════════════
     الجزء 46 · API البلاغات
     ═══════════════════════════════════════════════════════════ */

  const apiReports = (() => {
    const BASE = '/api/reports';

    /** إرسال بلاغ جديد */
    const create = (payload) => {
      K.security.requireAuth();
      const clean = K.validate.object(payload, K.validate.schemas.reportCreate);

      // منع التكرار محلياً — 5 بلاغات / ساعة
      const rl = K.security.canDo('report:create', { max: 5, window: 60 * 60 * 1000 });
      if (!rl.allowed) {
        throw new K.errors.RateLimit('أرسلت بلاغات كثيرة — سنراجع السابقة أولاً');
      }

      // منع التكرار على نفس الهدف — 24 ساعة
      const dedupKey = `report:${clean.targetType}:${clean.targetId}`;
      const rl2 = K.security.canDo(dedupKey, { max: 1, window: 24 * 60 * 60 * 1000 });
      if (!rl2.allowed) {
        throw new K.errors.RateLimit('أبلغت عن هذا العنصر مسبقاً — شكراً لاهتمامك');
      }

      return K.http.post(BASE, clean);
    };

    /** بلاغاتي */
    const list = (opts = {}) => {
      const params = new URLSearchParams({ limit: String(opts.limit || 20) });
      if (opts.cursor) params.set('cursor', opts.cursor);
      return K.http.get(`${BASE}?${params}`);
    };

    /** حالة بلاغ معيّن (هل أبلغت عنه؟) */
    const status = async (targetType, targetId) => {
      try {
        const params = new URLSearchParams({ targetType, targetId });
        const res = await K.http.get(`${BASE}/status?${params}`);
        return {
          reported: !!res?.reported,
          state: res?.state || null,
          reportedAt: res?.reportedAt || null,
        };
      } catch {
        return { reported: false, state: null, reportedAt: null };
      }
    };

    return { create, list, status };
  })();


  /* ═══════════════════════════════════════════════════════════
     مفتاح كتم التكرار — لكل فعل على هدف معيّن
     ═══════════════════════════════════════════════════════════ */

  const pending = new Map();

  /** ينفّذ العملية إن لم تكن معلّقة · وإلا يُرجع الوعد الجاري */
  const once = (key, fn) => {
    if (pending.has(key)) return pending.get(key);
    const p = Promise.resolve().then(fn).finally(() => pending.delete(key));
    pending.set(key, p);
    return p;
  };

  const isPending = (key) => pending.has(key);

  /** يُلغي كل الطلبات المعلّقة لمفتاح يبدأ ببادئة */
  const cancelPrefix = (prefix) => {
    for (const k of Array.from(pending.keys())) {
      if (k.startsWith(prefix)) pending.delete(k);
    }
  };


  /* ═══════════════════════════════════════════════════════════
     مخزن تعليقات مؤقت (لكل منشور)
     ═══════════════════════════════════════════════════════════ */

  const commentsStore = (() => {
    const map = new Map();  // postId → { items, cursor, hasMore, loading, sort, total }

    const get = (postId) => {
      if (map.has(postId)) return map.get(postId);
      const state = {
        postId,
        items: [],
        cursor: null,
        hasMore: true,
        loading: false,
        error: null,
        sort: 'recent',
        total: 0,
        generation: 0,
      };
      map.set(postId, state);
      return state;
    };

    /** تطبيع قائمة تعليقات */
    const normalizeList = (raw) => {
      const items = (raw?.items || [])
        .map(K.models.Comment.normalize)
        .filter(Boolean);
      return {
        items,
        cursor: raw?.cursor || null,
        hasMore: !!raw?.hasMore,
        total: Number(raw?.total) || items.length,
      };
    };

    const load = async (postId, opts = {}) => {
      const state = get(postId);
      state.generation += 1;
      const myGen = state.generation;

      if (opts.sort && opts.sort !== state.sort) {
        state.sort = opts.sort;
        state.items = [];
        state.cursor = null;
        state.hasMore = true;
      }

      state.loading = true;
      state.error = null;

      try {
        const raw = await api.getComments(postId, { sort: state.sort, limit: opts.limit || 20 });
        if (state.generation !== myGen) return { ok: false, stale: true };

        const page = normalizeList(raw);
        state.items = page.items;
        state.cursor = page.cursor;
        state.hasMore = page.hasMore;
        state.total = page.total;
        state.loading = false;
        return { ok: true, state, page };
      } catch (err) {
        if (state.generation !== myGen) return { ok: false, stale: true };
        state.error = err;
        state.loading = false;
        return { ok: false, error: err, state };
      }
    };

    const loadMore = async (postId) => {
      const state = get(postId);
      if (state.loading || !state.hasMore || !state.cursor) return { ok: false };

      state.generation += 1;
      const myGen = state.generation;
      state.loading = true;

      try {
        const raw = await api.getComments(postId, { sort: state.sort, cursor: state.cursor, limit: 20 });
        if (state.generation !== myGen) return { ok: false, stale: true };

        const page = normalizeList(raw);
        const seen = new Set(state.items.map(c => c.id));
        for (const c of page.items) {
          if (!seen.has(c.id)) { seen.add(c.id); state.items.push(c); }
        }
        state.cursor = page.cursor;
        state.hasMore = page.hasMore;
        state.total = page.total;
        state.loading = false;
        return { ok: true, state, added: page.items.length };
      } catch (err) {
        state.error = err;
        state.loading = false;
        return { ok: false, error: err };
      }
    };

    /** إدراج تعليق في الرأس */
    const prepend = (postId, comment) => {
      const state = get(postId);
      state.items = [comment, ...state.items];
      state.total += 1;
      return state;
    };

    /** استبدال تعليق (بعد تحرير) */
    const replace = (postId, commentId, patch) => {
      const state = get(postId);
      const idx = state.items.findIndex(c => c.id === commentId);
      if (idx === -1) return false;
      state.items[idx] = { ...state.items[idx], ...patch };
      return true;
    };

    /** حذف تعليق */
    const remove = (postId, commentId) => {
      const state = get(postId);
      const before = state.items.length;
      state.items = state.items.filter(c => c.id !== commentId);
      if (state.items.length !== before) state.total = Math.max(0, state.total - 1);
      return before !== state.items.length;
    };

    const reset = (postId) => {
      const state = get(postId);
      state.generation += 1;
      state.items = [];
      state.cursor = null;
      state.hasMore = true;
      state.total = 0;
      state.loading = false;
      state.error = null;
    };

    const resetAll = () => map.clear();

    return { get, load, loadMore, prepend, replace, remove, reset, resetAll };
  })();


  /* ═══════════════════════════════════════════════════════════
     الجزء 29 · متحكّم التفاعل
     تغليف كل فعل مع optimistic + rollback + feedback
     ═══════════════════════════════════════════════════════════ */

  const actions = (() => {

    /* ---- أدوات مساعدة مشتركة ---- */

    /** يضمن وجود مستخدم مسجّل */
    const auth = () => {
      K.security.requireAuth();
      const user = K.store.get('user');
      if (!user?.id) throw new K.errors.Auth('سجّل الدخول للمتابعة');
      return user;
    };

    /** يُظهر خطأ تفاعلي موحّد */
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

    /** يشغّل تغذية بصرية/صوتية */
    const feedback = (kind) => {
      if (kind === 'success') K.sound.success();
      else if (kind === 'tap') K.sound.tap();
      else if (kind === 'error') K.sound.error();
      if (kind === 'success' || kind === 'tap') K.sound.haptic(6);
    };

    /* ═══════════════════════════════════════════════════════════
       الإعجاب
       ═══════════════════════════════════════════════════════════ */

    const toggleLike = (postId) => {
      if (!postId) return Promise.resolve(false);
      auth();

      const key = `like:${postId}`;
      return once(key, async () => {
        const post = K.content.getPost(postId);
        if (!post) {
          // لم يكن في الكاش — جلب سريع للتزامن
          try { await K.api.posts.get(postId); } catch { /* تجاهل */ }
        }
        const current = K.content.getPost(postId);
        if (!current) throw new K.errors.NotFound('المنشور غير موجود');

        const wasLiked = !!current.viewer?.liked;
        const nextLiked = !wasLiked;
        const statDelta = nextLiked ? 1 : -1;

        // 1) تحديث تفاؤلي فوري
        K.content.patchItem(postId, {
          viewer: { ...current.viewer, liked: nextLiked },
          stats: {
            ...current.stats,
            likes: Math.max(0, (current.stats?.likes || 0) + statDelta),
          },
        });

        // 2) تغذية بصرية فورية
        if (nextLiked) feedback('tap');

        try {
          const res = nextLiked
            ? await api.like(postId)
            : await api.unlike(postId);

          // 3) تأكيد من الخادم (إن أرسل إحصاءً مصححاً)
          if (res?.stats) {
            K.content.patchItem(postId, { stats: res.stats });
          }
          if (typeof res?.liked === 'boolean' && res.liked !== nextLiked) {
            // الخادم صحح الحالة — نطبّق
            K.content.patchItem(postId, {
              viewer: { ...K.content.getPost(postId)?.viewer, liked: res.liked },
            });
          }
          return nextLiked;
        } catch (err) {
          // 4) rollback كامل
          K.content.patchItem(postId, {
            viewer: { ...current.viewer, liked: wasLiked },
            stats: current.stats,
          });
          feedback('error');
          fail(err, 'تعذّر تسجيل إعجابك');
          throw err;
        }
      });
    };

    /* ═══════════════════════════════════════════════════════════
       الحفظ
       ═══════════════════════════════════════════════════════════ */

    const toggleSave = (postId, folderId = null) => {
      if (!postId) return Promise.resolve(false);
      auth();

      const key = `save:${postId}`;
      return once(key, async () => {
        const post = K.content.getPost(postId);
        if (!post) throw new K.errors.NotFound('المنشور غير موجود');

        const wasSaved = !!post.viewer?.saved;
        const nextSaved = !wasSaved;
        const statDelta = nextSaved ? 1 : -1;

        // تحديث تفاؤلي
        K.content.patchItem(postId, {
          viewer: { ...post.viewer, saved: nextSaved },
          stats: {
            ...post.stats,
            saves: Math.max(0, (post.stats?.saves || 0) + statDelta),
          },
        });

        if (nextSaved) feedback('success');

        try {
          const res = nextSaved
            ? await api.save(postId, folderId)
            : await api.unsave(postId);

          if (res?.stats) K.content.patchItem(postId, { stats: res.stats });

          // إبلاغ المستخدم
          if (nextSaved) {
            K.utils.tryCatch(() => K.overlays?.toast?.({
              type: 'success',
              title: 'حُفظ في مكتبتك',
              message: folderId ? 'أُضيف إلى المجلد المحدد' : 'تجد المنشور في «المحفوظات»',
              duration: 2200,
              actionLabel: 'عرض',
              onAction: () => K.router.go('/saved'),
            }));
          }

          return nextSaved;
        } catch (err) {
          K.content.patchItem(postId, {
            viewer: { ...post.viewer, saved: wasSaved },
            stats: post.stats,
          });
          feedback('error');
          fail(err, 'تعذّر حفظ المنشور');
          throw err;
        }
      });
    };

    /* ═══════════════════════════════════════════════════════════
       المتابعة
       ═══════════════════════════════════════════════════════════ */

    const toggleFollow = (targetUser) => {
      if (!targetUser) return Promise.resolve(false);
      const me = auth();

      const userId = typeof targetUser === 'string' ? targetUser : targetUser.id;
      if (!userId) return Promise.resolve(false);
      if (userId === me.id) {
        throw new K.errors.Validate('لا يمكنك متابعة نفسك');
      }

      const key = `follow:${userId}`;
      return once(key, async () => {
        // ابحث عن الحالة الحالية في أي مكان
        const knownRelation =
          K.content.getPost(null)?.author?.relation ||   // لا يعمل لكن الفكرة
          null;

        // ابحث في كل المنشورات عن هذا المستخدم لمعرفة الحالة
        let wasFollowing = false;
        let foundAnywhere = false;
        for (const feedKey of K.content.allFeeds) {
          const feed = K.content.getFeed(feedKey);
          for (const p of feed.items) {
            if (p.author?.id === userId) {
              wasFollowing = !!p.author.relation?.isFollowing;
              foundAnywhere = true;
              break;
            }
          }
          if (foundAnywhere) break;
        }

        // إن لم يُعرف، جرّب جلب العلاقة من الخادم
        if (!foundAnywhere) {
          try {
            const u = await K.api.discovery.searchUsers('');
            // بديل: نعتبر غير متابع إن لم نجد
          } catch { /* تجاهل */ }
        }

        const nextFollowing = !wasFollowing;

        // 1) تحديث تفاؤلي في كل منشورات هذا المستخدم
        const patches = [];
        for (const feedKey of K.content.allFeeds) {
          const feed = K.content.getFeed(feedKey);
          for (const p of feed.items) {
            if (p.author?.id !== userId) continue;
            const oldAuthor = p.author;
            const oldStats = p.author.stats || {};
            patches.push({
              postId: p.id,
              oldAuthor,
            });
            K.content.patchItem(p.id, {
              author: {
                ...oldAuthor,
                relation: { ...oldAuthor.relation, isFollowing: nextFollowing },
              },
            });
          }
        }

        if (nextFollowing) feedback('success');

        try {
          const res = nextFollowing
            ? await api.follow(userId)
            : await api.unfollow(userId);

          // تحديث إحصاءات المستخدم الحالي (following +1/-1)
          const currentUser = K.store.get('user');
          if (currentUser) {
            K.store.set('user', {
              ...currentUser,
              stats: {
                ...currentUser.stats,
                following: Math.max(0, (currentUser.stats?.following || 0) + (nextFollowing ? 1 : -1)),
              },
            });
          }

          // رسالة تأكيد
          K.utils.tryCatch(() => K.overlays?.toast?.({
            type: 'success',
            title: nextFollowing ? 'تتابع الآن' : 'أُلغي المتابعة',
            message: nextFollowing
              ? 'ستظهر منشوراتهم في تغذيتك'
              : 'لن ترى تحديثاتهم في الرئيسية',
            duration: 2000,
          }));

          return nextFollowing;
        } catch (err) {
          // rollback
          for (const p of patches) {
            K.content.patchItem(p.postId, { author: p.oldAuthor });
          }
          feedback('error');
          fail(err, 'تعذّر تحديث المتابعة');
          throw err;
        }
      });
    };

    /* ═══════════════════════════════════════════════════════════
       النسخ
       ═══════════════════════════════════════════════════════════ */

    const copyPrompt = (postId, promptText) => {
      if (!postId || !promptText) return Promise.resolve(false);

      const key = `copy:${postId}`;
      return once(key, async () => {
        // نسخ فوري (لا يحتاج مصادقة للقراءة، لكن العدّاد يحتاج)
        const ok = await K.utils.copy(String(promptText));
        if (!ok) {
          K.utils.tryCatch(() => K.overlays?.toast?.({
            type: 'error',
            title: 'تعذّر النسخ',
            message: 'حاول تحديد النص ونسخه يدوياً',
          }));
          return false;
        }

        feedback('success');

        // تحديث محلي فوري
        const post = K.content.getPost(postId);
        if (post) {
          K.content.patchItem(postId, {
            stats: {
              ...post.stats,
              copies: (post.stats?.copies || 0) + 1,
            },
          });
        }

        // toast تأكيد
        K.utils.tryCatch(() => K.overlays?.toast?.({
          type: 'success',
          title: 'نُسخ البرومبت',
          message: 'جاهز للصق في أي أداة توليد',
          duration: 1800,
        }));

        // عدّاد الخادم (بلا انتظار)
        if (K.store.get('authStatus') === 'authenticated') {
          api.countCopy(postId).catch(() => { /* صامت */ });
        }

        return true;
      });
    };

    /* ═══════════════════════════════════════════════════════════
       التعليقات
       ═══════════════════════════════════════════════════════════ */

    const loadComments = (postId, opts = {}) => commentsStore.load(postId, opts);
    const loadMoreComments = (postId) => commentsStore.loadMore(postId);

    const postComment = (postId, text, parentId = null) => {
      const me = auth();
      const check = K.validate.commentText(text);
      if (!check.ok) throw new K.errors.Validate(check.error, 'text');

      const key = `comment:create:${postId}`;
      return once(key, async () => {
        // 1) تعليق مؤقت معرّف محلياً
        const tempId = K.utils.uid('tmp_comment');
        const optimistic = {
          id: tempId,
          postId,
          parentId,
          author: K.models.User.compact(me),
          text: check.value,
          stats: { likes: 0 },
          viewer: { liked: false, canDelete: true },
          repliesCount: 0,
          createdAt: new Date().toISOString(),
          __pending__: true,
        };

        if (parentId) {
          const st = commentsStore.get(postId);
          const parent = st.items.find(c => c.id === parentId);
          if (parent) parent.repliesCount = (parent.repliesCount || 0) + 1;
        }
        commentsStore.prepend(postId, optimistic);

        // تحديث عدّاد التعليقات على المنشور
        const post = K.content.getPost(postId);
        if (post) {
          K.content.patchItem(postId, {
            stats: {
              ...post.stats,
              comments: (post.stats?.comments || 0) + 1,
            },
          });
        }

        try {
          const res = await api.createComment({ postId, parentId, text: check.value });
          const real = K.models.Comment.normalize(res?.comment || res);
          if (!real || !real.id) throw new K.errors.Unknown('رد غير متوقع');

          // استبدال المؤقت بالحقيقي
          commentsStore.remove(postId, tempId);
          commentsStore.prepend(postId, real);
          feedback('success');
          return real;
        } catch (err) {
          // rollback
          commentsStore.remove(postId, tempId);
          if (parentId) {
            const st = commentsStore.get(postId);
            const parent = st.items.find(c => c.id === parentId);
            if (parent) parent.repliesCount = Math.max(0, (parent.repliesCount || 1) - 1);
          }
          if (post) {
            K.content.patchItem(postId, { stats: post.stats });
          }
          feedback('error');
          fail(err, 'تعذّر نشر التعليق');
          throw err;
        }
      });
    };

    const editComment = (postId, commentId, newText) => {
      auth();
      const check = K.validate.commentText(newText);
      if (!check.ok) throw new K.errors.Validate(check.error, 'text');

      const key = `comment:edit:${commentId}`;
      return once(key, async () => {
        const state = commentsStore.get(postId);
        const idx = state.items.findIndex(c => c.id === commentId);
        if (idx === -1) throw new K.errors.NotFound('التعليق غير موجود');

        const original = state.items[idx];
        commentsStore.replace(postId, commentId, { text: check.value, __edited__: true });

        try {
          const res = await api.updateComment(commentId, check.value);
          const real = K.models.Comment.normalize(res?.comment || res);
          if (real) commentsStore.replace(postId, commentId, real);
          feedback('success');
          return real || check.value;
        } catch (err) {
          commentsStore.replace(postId, commentId, original);
          feedback('error');
          fail(err, 'تعذّر تحديث التعليق');
          throw err;
        }
      });
    };

    const deleteComment = (postId, commentId) => {
      auth();
      const key = `comment:delete:${commentId}`;
      return once(key, async () => {
        const state = commentsStore.get(postId);
        const idx = state.items.findIndex(c => c.id === commentId);
        if (idx === -1) return false;

        const backup = state.items[idx];
        commentsStore.remove(postId, commentId);

        const post = K.content.getPost(postId);
        if (post) {
          K.content.patchItem(postId, {
            stats: {
              ...post.stats,
              comments: Math.max(0, (post.stats?.comments || 0) - 1),
            },
          });
        }

        try {
          await api.deleteComment(commentId);
          feedback('tap');
          K.utils.tryCatch(() => K.overlays?.toast?.({
            type: 'info',
            title: 'حُذف التعليق',
            duration: 1800,
          }));
          return true;
        } catch (err) {
          // rollback
          if (backup.parentId) {
            // أعد التعليق في مكانه الأصلي
            state.items.splice(idx, 0, backup);
          } else {
            commentsStore.prepend(postId, backup);
          }
          if (post) K.content.patchItem(postId, { stats: post.stats });
          feedback('error');
          fail(err, 'تعذّر حذف التعليق');
          throw err;
        }
      });
    };

    const toggleCommentLike = (postId, commentId) => {
      auth();
      const key = `comment:like:${commentId}`;
      return once(key, async () => {
        const state = commentsStore.get(postId);
        const idx = state.items.findIndex(c => c.id === commentId);
        if (idx === -1) return false;

        const c = state.items[idx];
        const wasLiked = !!c.viewer?.liked;
        const next = !wasLiked;
        const delta = next ? 1 : -1;

        commentsStore.replace(postId, commentId, {
          viewer: { ...c.viewer, liked: next },
          stats: { likes: Math.max(0, (c.stats?.likes || 0) + delta) },
        });

        if (next) feedback('tap');

        try {
          await (next
            ? api.likeComment(commentId)
            : api.unlikeComment(commentId));
          return next;
        } catch (err) {
          commentsStore.replace(postId, commentId, {
            viewer: { ...c.viewer, liked: wasLiked },
            stats: c.stats,
          });
          feedback('error');
          fail(err, 'تعذّر تسجيل الإعجاب');
          throw err;
        }
      });
    };

    /* ═══════════════════════════════════════════════════════════
       البلاغ
       ═══════════════════════════════════════════════════════════ */

    const report = (target) => {
      auth();
      const payload = {
        targetType: target.type || 'post',
        targetId: target.id,
        reason: target.reason,
        note: target.note || '',
      };

      const key = `report:${payload.targetType}:${payload.targetId}`;
      return once(key, async () => {
        try {
          const res = await apiReports.create(payload);
          feedback('success');
          K.utils.tryCatch(() => K.overlays?.toast?.({
            type: 'success',
            title: 'استلمنا بلاغك',
            message: 'سنراجع المحتوى خلال 24 ساعة',
            duration: 3500,
          }));
          return res;
        } catch (err) {
          feedback('error');
          fail(err, 'تعذّر إرسال البلاغ');
          throw err;
        }
      });
    };

    /* ═══════════════════════════════════════════════════════════
       حذف منشور
       ═══════════════════════════════════════════════════════════ */

    const deletePost = (postId) => {
      auth();
      const key = `post:delete:${postId}`;
      return once(key, async () => {
        const post = K.content.getPost(postId);
        if (!post) throw new K.errors.NotFound('المنشور غير موجود');
        if (!K.security.can('delete:own', { owner: post.author?.id })) {
          throw new K.errors.Auth('لا تملك صلاحية حذف هذا المنشور');
        }

        // إزالة تفاؤلية
        K.content.removeItem(postId);

        try {
          await K.api.posts.remove(postId);
          feedback('tap');
          K.utils.tryCatch(() => K.overlays?.toast?.({
            type: 'success',
            title: 'حُذف المنشور',
            duration: 2000,
          }));
          // إن كنّا في صفحة التفاصيل → عد للرئيسية
          if (K.router.getCurrent()?.path?.startsWith('/post/')) {
            K.router.home();
          }
          return true;
        } catch (err) {
          // rollback — أعد الإدراج
          if (post) {
            // لا نعرف التغذية الأصلية؛ نُدرجه في الرئيسية
            K.content.prependItem('home', post);
          }
          feedback('error');
          fail(err, 'تعذّر حذف المنشور');
          throw err;
        }
      });
    };

    /* ---- تنظيف ---- */
    const cleanup = () => {
      pending.clear();
      commentsStore.resetAll();
    };

    /* ---- واجهة عامة ---- */
    return {
      // إعجاب/حفظ/متابعة/نسخ
      toggleLike, toggleSave, toggleFollow, copyPrompt,
      // منشور
      deletePost,
      // تعليقات
      loadComments, loadMoreComments,
      postComment, editComment, deleteComment, toggleCommentLike,
      // بلاغ
      report,
      // أدوات
      isPending, cleanup,
      get comments() { return commentsStore; },
    };
  })();


  /* ═══════════════════════════════════════════════════════════
     التهيئة
     ═══════════════════════════════════════════════════════════ */

  const init = () => {
    // إلغاء كل الطلبات المعلّقة عند تسجيل الخروج
    K.store.subscribe('authStatus', (status) => {
      if (status === 'guest') actions.cleanup();
    });

    // تنظيف الطلبات المعلّقة عند ترك الصفحة
    window.addEventListener('pagehide', () => actions.cleanup(), { passive: true });
  };

  /* ═══════════════════════════════════════════════════════════
     التصدير
     ═══════════════════════════════════════════════════════════ */

  K.api.interactions = api;
  K.api.reports = apiReports;
  K.actions = actions;
  K.actions.init = init;

  /* نهاية 06-interactions.js */
})();