/* ============================================================
   خَيال · 05-content · إدارة المحتوى
   الأجزاء: 28 (متحكّم التدفقات) · 41 (API المنشورات) · 43 (الاكتشاف)
   لا innerHTML · كل قيمة عبر K.store · كل طلب عبر K.http
   ============================================================ */

'use strict';

(function () {
  const K = window.K;
  if (!K) { console.error('[content] النواة غير محمّلة'); return; }

  /* ═══════════════════════════════════════════════════════════
     ذاكرة مؤقتة للمنشورات (LRU · 5 دقائق)
     ═══════════════════════════════════════════════════════════ */

  const cache = (() => {
    const MAX = 300;
    const TTL = 5 * 60 * 1000;
    const map = new Map();

    const get = (id) => {
      const entry = map.get(id);
      if (!entry) return null;
      if (Date.now() - entry.at > TTL) { map.delete(id); return null; }
      map.delete(id);
      map.set(id, entry);
      return entry.post;
    };

    const set = (id, post) => {
      if (!id) return;
      map.set(id, { post, at: Date.now() });
      if (map.size > MAX) {
        const firstKey = map.keys().next().value;
        map.delete(firstKey);
      }
    };

    const setMany = (posts) => {
      for (const p of posts || []) if (p?.id) set(p.id, p);
    };

    const invalidate = (id) => map.delete(id);
    const clear = () => map.clear();

    return { get, set, setMany, invalidate, clear, get size() { return map.size; } };
  })();

  /* ═══════════════════════════════════════════════════════════
     منع تكرار الطلبات المتماثلة (in-flight dedup)
     ═══════════════════════════════════════════════════════════ */

  const inflight = new Map();

  const deduped = (key, fn) => {
    if (inflight.has(key)) return inflight.get(key);
    const p = Promise.resolve()
      .then(fn)
      .finally(() => { inflight.delete(key); });
    inflight.set(key, p);
    return p;
  };

  const abortInflight = (prefix) => {
    for (const key of Array.from(inflight.keys())) {
      if (key.startsWith(prefix)) inflight.delete(key);
    }
  };


  /* ═══════════════════════════════════════════════════════════
     الجزء 41 · API المنشورات
     إنشاء · قراءة · تحديث · حذف · بحث · ترقيم
     ═══════════════════════════════════════════════════════════ */

  const posts = (() => {
    const BASE = '/api/posts';

    /**
     * قائمة المنشورات (مع ترقيم · فلترة · ترتيب).
     * @param {object} [opts]
     * @param {string} [opts.sort='recent']  'recent' | 'trending' | 'top'
     * @param {string[]} [opts.tags]
     * @param {string[]} [opts.models]
     * @param {string} [opts.period='all']   'today' | 'week' | 'month' | 'all'
     * @param {string} [opts.author]
     * @param {string} [opts.cursor]
     * @param {number} [opts.limit=20]
     */
    const list = async (opts = {}) => {
      const params = new URLSearchParams();
      params.set('sort', opts.sort || 'recent');
      if (opts.period && opts.period !== 'all') params.set('period', opts.period);
      if (opts.tags?.length)   params.set('tags',   opts.tags.map(t => String(t).toLowerCase()).join(','));
      if (opts.models?.length) params.set('models', opts.models.join(','));
      if (opts.author) params.set('author', String(opts.author).replace(/^@/, ''));
      if (opts.cursor) params.set('cursor', opts.cursor);
      params.set('limit', String(Math.min(opts.limit || 20, 50)));

      const key = `posts.list:${params.toString()}`;
      return deduped(key, async () => {
        const res = await K.http.get(`${BASE}?${params.toString()}`);
        const items = (res?.items || []).map(K.models.Post.normalize).filter(Boolean);
        cache.setMany(items);
        return {
          items,
          cursor: res?.cursor || null,
          hasMore: !!res?.hasMore,
          total: Number(res?.total) || items.length,
        };
      });
    };

    /**
     * جلب منشور واحد (كاش إن أمكن).
     * @param {string} id
     * @param {object} [opts]
     * @param {boolean} [opts.force]
     */
    const get = async (id, opts = {}) => {
      if (!id) throw new K.errors.Validate('معرّف المنشور مطلوب');
      if (!opts.force) {
        const cached = cache.get(id);
        if (cached) return cached;
      }
      const key = `posts.get:${id}`;
      return deduped(key, async () => {
        const res = await K.http.get(`${BASE}/${encodeURIComponent(id)}`);
        const post = K.models.Post.normalize(res?.post || res);
        if (!post || !post.id) throw new K.errors.NotFound('المنشور غير موجود');
        cache.set(post.id, post);
        return post;
      });
    };

    /**
     * إنشاء منشور جديد.
     * @param {object} payload  {title, prompt, images[], model, tags[], visibility, nsfw}
     */
    const create = async (payload) => {
      K.security.requireAuth();

      const clean = K.validate.object(payload, K.validate.schemas.postCreate);
      const images = Array.isArray(payload.images)
        ? payload.images.map(K.security.sanitizeUrl).filter(Boolean).slice(0, 4)
        : [];

      if (!images.length) {
        throw new K.errors.Validate('أضف صورة واحدة على الأقل');
      }

      // rate limit محلي — 10 منشورات / 10 دقائق
      const rl = K.security.canDo('post:create', { max: 10, window: 10 * 60 * 1000 });
      if (!rl.allowed) {
        throw new K.errors.RateLimit('أنشأت منشورات كثيرة — انتظر قليلاً قبل النشر مجدداً');
      }

      const res = await K.http.post(BASE, {
        title: clean.title,
        prompt: clean.prompt,
        tags: clean.tags || [],
        images,
        model: String(payload.model || '').trim().slice(0, 60),
        visibility: ['public', 'unlisted', 'private'].includes(payload.visibility)
          ? payload.visibility : 'public',
        nsfw: !!payload.nsfw,
      });

      const post = K.models.Post.normalize(res?.post || res);
      if (!post || !post.id) throw new K.errors.Unknown('فشل نشر المنشور');
      cache.set(post.id, post);
      return post;
    };

    /** تحديث منشور (المؤلف فقط) */
    const update = async (id, patch) => {
      K.security.requireAuth();
      if (!id) throw new K.errors.Validate('معرّف المنشور مطلوب');

      const clean = K.validate.object(patch, K.validate.schemas.postCreate, { partial: true });
      const res = await K.http.patch(`${BASE}/${encodeURIComponent(id)}`, clean);
      const post = K.models.Post.normalize(res?.post || res);
      if (!post || !post.id) throw new K.errors.Unknown('فشل تحديث المنشور');
      cache.set(post.id, post);
      return post;
    };

    /** حذف منشور */
    const remove = async (id) => {
      K.security.requireAuth();
      if (!id) throw new K.errors.Validate('معرّف المنشور مطلوب');
      await K.http.del(`${BASE}/${encodeURIComponent(id)}`);
      cache.invalidate(id);
      return true;
    };

    /** رفع صورة منشور (يُستدعى من محرّر النشر) */
    const uploadImage = async (file) => {
      K.security.requireAuth();
      const check = K.validate.imageFile(file, { maxBytes: 10 * 1024 * 1024 });
      if (!check.ok) throw new K.errors.Validate(check.error, check.field);

      const form = new FormData();
      form.append('image', file);

      const res = await K.http.post(`${BASE}/upload`, form, { timeout: 45000 });
      const url = K.security.sanitizeUrl(res?.url || '');
      if (!url) throw new K.errors.Unknown('فشل رفع الصورة');
      return url;
    };

    const invalidate = (id) => cache.invalidate(id);
    const clearCache = () => cache.clear();

    return { list, get, create, update, remove, uploadImage, invalidate, clearCache };
  })();


  /* ═══════════════════════════════════════════════════════════
     الجزء 43 · API الاكتشاف
     منشورات ذات صلة · بحث · وسوم رائجة · مقترحات
     ═══════════════════════════════════════════════════════════ */

  const discovery = (() => {
    const BASE = '/api/discovery';

    /** منشورات ذات صلة بمنشور معيّن */
    const related = async (postId, opts = {}) => {
      if (!postId) return [];
      const limit = Math.min(opts.limit || 8, 20);
      const key = `discovery.related:${postId}:${limit}`;
      return deduped(key, async () => {
        const res = await K.http.get(`${BASE}/related/${encodeURIComponent(postId)}?limit=${limit}`);
        const items = (res?.items || []).map(K.models.Post.normalize).filter(Boolean);
        cache.setMany(items);
        return items;
      });
    };

    /** بحث المستخدمين */
    const searchUsers = async (query, opts = {}) => {
      const q = String(query || '').trim();
      if (!q) return { items: [], cursor: null, hasMore: false };
      const params = new URLSearchParams({ q, limit: String(opts.limit || 20) });
      if (opts.cursor) params.set('cursor', opts.cursor);
      const res = await K.http.get(`${BASE}/users?${params}`);
      return {
        items: (res?.items || []).map(K.models.User.compact).filter(Boolean),
        cursor: res?.cursor || null,
        hasMore: !!res?.hasMore,
      };
    };

    /** بحث المنشورات */
    const searchPosts = async (query, opts = {}) => {
      const q = String(query || '').trim();
      if (!q) return { items: [], cursor: null, hasMore: false };
      const params = new URLSearchParams({ q, limit: String(opts.limit || 20) });
      if (opts.cursor) params.set('cursor', opts.cursor);
      const res = await K.http.get(`${BASE}/posts?${params}`);
      const items = (res?.items || []).map(K.models.Post.normalize).filter(Boolean);
      cache.setMany(items);
      return {
        items,
        cursor: res?.cursor || null,
        hasMore: !!res?.hasMore,
      };
    };

    /** بحث الوسوم */
    const searchTags = async (query, opts = {}) => {
      const q = String(query || '').trim();
      if (!q) return [];
      const params = new URLSearchParams({ q, limit: String(opts.limit || 20) });
      const res = await K.http.get(`${BASE}/tags?${params}`);
      return (res?.items || [])
        .map(t => ({
          tag: String(t.tag || '').toLowerCase().replace(/^#/, ''),
          count: Number(t.count) || 0,
        }))
        .filter(t => t.tag);
    };

    /** وسوم رائجة */
    const trendingTags = async (opts = {}) => {
      const params = new URLSearchParams({
        period: opts.period || 'week',
        limit: String(opts.limit || 12),
      });
      const key = `discovery.trendingTags:${params.toString()}`;
      return deduped(key, async () => {
        const res = await K.http.get(`${BASE}/trending-tags?${params}`);
        return (res?.items || [])
          .map(t => ({
            tag: String(t.tag || '').toLowerCase().replace(/^#/, ''),
            count: Number(t.count) || 0,
            growth: Number(t.growth) || 0,
          }))
          .filter(t => t.tag);
      });
    };

    /** مستخدمون مقترحون (لمن تتابع) */
    const suggestedUsers = async (opts = {}) => {
      const limit = opts.limit || 5;
      const key = `discovery.suggested:${limit}`;
      return deduped(key, async () => {
        const res = await K.http.get(`${BASE}/suggested-users?limit=${limit}`);
        return (res?.items || []).map(K.models.User.compact).filter(Boolean);
      });
    };

    /** مختارات المحرر */
    const editorPicks = async (opts = {}) => {
      const limit = opts.limit || 6;
      const key = `discovery.editorPicks:${limit}`;
      return deduped(key, async () => {
        const res = await K.http.get(`${BASE}/editor-picks?limit=${limit}`);
        const items = (res?.items || []).map(K.models.Post.normalize).filter(Boolean);
        cache.setMany(items);
        return items;
      });
    };

    /** الرائج */
    const trending = async (opts = {}) => {
      const params = new URLSearchParams({
        period: opts.period || 'week',
        limit: String(opts.limit || 12),
      });
      const key = `discovery.trending:${params.toString()}`;
      return deduped(key, async () => {
        const res = await K.http.get(`${BASE}/trending?${params}`);
        const items = (res?.items || []).map(K.models.Post.normalize).filter(Boolean);
        cache.setMany(items);
        return items;
      });
    };

    /** جديد اليوم */
    const newToday = async (opts = {}) => {
      const limit = opts.limit || 18;
      const key = `discovery.newToday:${limit}`;
      return deduped(key, async () => {
        const res = await K.http.get(`${BASE}/new-today?limit=${limit}`);
        const items = (res?.items || []).map(K.models.Post.normalize).filter(Boolean);
        cache.setMany(items);
        return items;
      });
    };

    return {
      related, searchUsers, searchPosts, searchTags,
      trendingTags, suggestedUsers, editorPicks, trending, newToday,
    };
  })();


  /* ═══════════════════════════════════════════════════════════
     الجزء 28 · إدارة المحتوى — متحكّم التدفقات
     ═══════════════════════════════════════════════════════════ */

  const content = (() => {
    /**
     * الوصف الداخلي لكل تغذية (feeds map):
     * {
     *   key, items[], cursor, hasMore, total,
     *   loading, loadedAt, error, filters,
     *   generation  — عدّاد لمنع تطبيق نتائج قديمة
     * }
     */
    const feeds = new Map();

    const DEFAULT_FILTERS = Object.freeze({
      sort: 'recent',
      tags: [],
      models: [],
      period: 'all',
      author: null,
      q: '',
    });

    const getFeed = (key) => {
      if (feeds.has(key)) return feeds.get(key);
      const feed = {
        key,
        items: [],
        cursor: null,
        hasMore: true,
        total: 0,
        loading: false,
        loadedAt: 0,
        error: null,
        filters: { ...DEFAULT_FILTERS },
        generation: 0,
      };
      feeds.set(key, feed);
      return feed;
    };

    /** اختيار الفيتشر المناسب حسب مفتاح التغذية */
    const fetchPage = (feed, cursor, limit) => {
      const key = feed.key;

      if (key === 'likes') {
        return K.http.get(`/api/interactions/likes?limit=${limit}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`);
      }
      if (key === 'saved') {
        return K.http.get(`/api/interactions/saves?limit=${limit}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`);
      }
      if (key.startsWith('profile:')) {
        const author = key.slice('profile:'.length);
        return K.api.posts.list({ ...feed.filters, author, cursor, limit });
      }
      if (key.startsWith('tag:')) {
        const tag = key.slice('tag:'.length);
        return K.api.posts.list({ ...feed.filters, tags: [tag], cursor, limit });
      }
      if (key === 'search:posts') {
        return K.api.discovery.searchPosts(feed.filters.q, { cursor, limit });
      }
      // home · explore · أي تغذية عامة
      return K.api.posts.list({ ...feed.filters, cursor, limit });
    };

    /** تطبيع رد الصفحة */
    const normalizePage = (raw) => {
      if (!raw) return { items: [], cursor: null, hasMore: false, total: 0 };
      const list = Array.isArray(raw.items) ? raw.items : [];
      const items = list.map(item => {
        // قد يعود العنصر كـ {post: {...}} من مسارات التفاعلات
        const candidate = item?.post || item;
        return K.models.Post.normalize(candidate);
      }).filter(Boolean);
      return {
        items,
        cursor: raw.cursor || null,
        hasMore: !!raw.hasMore,
        total: Number(raw.total) || items.length,
      };
    };

    /** دمج بلا تكرار */
    const mergeItems = (existing, incoming) => {
      if (!incoming?.length) return existing;
      const seen = new Set(existing.map(p => p.id));
      const out = existing.slice();
      for (const p of incoming) {
        if (!p?.id || seen.has(p.id)) continue;
        seen.add(p.id);
        out.push(p);
      }
      return out;
    };

    /** مزامنة معرفات التغذية مع الحالة المركزية */
    const syncToStore = (feed) => {
      if (!['home', 'explore', 'likes', 'saved'].includes(feed.key)) return;
      K.store.patch({
        feeds: {
          [feed.key]: {
            items: feed.items.map(p => p.id),
            cursor: feed.cursor,
            hasMore: feed.hasMore,
            loadedAt: feed.loadedAt,
          },
        },
      }, { noPersist: true });
    };

    /**
     * تحميل الصفحة الأولى.
     * @param {object} opts
     * @param {string} opts.feed
     * @param {number} [opts.limit=20]
     * @param {object} [opts.filters]
     * @param {boolean} [opts.refresh]
     */
    const load = async (opts = {}) => {
      const key = opts.feed || 'home';
      const feed = getFeed(key);

      if (opts.filters) feed.filters = { ...feed.filters, ...opts.filters };

      // تعطيل أي نتيجة قادمة من طلب أقدم
      feed.generation += 1;
      const myGen = feed.generation;

      feed.loading = true;
      feed.error = null;

      if (opts.refresh || !opts.append) {
        feed.items = [];
        feed.cursor = null;
        feed.hasMore = true;
      }

      try {
        const raw = await fetchPage(feed, null, opts.limit || 20);

        // نتأكد أن الطلب ما زال الأحدث
        if (feed.generation !== myGen) return { ok: false, stale: true };

        const page = normalizePage(raw);
        feed.items = page.items;      // الصفحة الأولى دائماً تستبدل
        feed.cursor = page.cursor;
        feed.hasMore = page.hasMore;
        feed.total = page.total;
        feed.loadedAt = Date.now();
        feed.loading = false;
        syncToStore(feed);

        return { ok: true, feed, page };
      } catch (err) {
        if (feed.generation !== myGen) return { ok: false, stale: true };
        feed.error = err;
        feed.loading = false;
        return { ok: false, error: err, feed };
      }
    };

    /** تحميل الصفحة التالية */
    const loadMore = async (feedKey) => {
      const feed = getFeed(feedKey);
      if (feed.loading) return { ok: false, busy: true };
      if (!feed.hasMore) return { ok: false, done: true };
      if (!feed.cursor) return load({ feed: feedKey });  // لم تُحمَّل بعد

      feed.generation += 1;
      const myGen = feed.generation;

      feed.loading = true;
      feed.error = null;

      try {
        const raw = await fetchPage(feed, feed.cursor, 20);
        if (feed.generation !== myGen) return { ok: false, stale: true };

        const page = normalizePage(raw);
        const before = feed.items.length;
        feed.items = mergeItems(feed.items, page.items);
        const added = feed.items.length - before;

        feed.cursor = page.cursor;
        feed.hasMore = page.hasMore && added > 0;
        feed.total = page.total;
        feed.loading = false;
        syncToStore(feed);

        return { ok: true, feed, added, page };
      } catch (err) {
        if (feed.generation !== myGen) return { ok: false, stale: true };
        feed.error = err;
        feed.loading = false;
        return { ok: false, error: err, feed };
      }
    };

    /** إعادة تعيين (تفريغ محلي) */
    const reset = (feedKey) => {
      const feed = getFeed(feedKey);
      feed.generation += 1;   // يُلغي أي طلب معلّق
      feed.items = [];
      feed.cursor = null;
      feed.hasMore = true;
      feed.total = 0;
      feed.loading = false;
      feed.error = null;
      feed.loadedAt = 0;
      return feed;
    };

    /** إعادة تعيين الكل (يُستدعى عند الخروج) */
    const resetAll = () => {
      for (const feed of feeds.values()) feed.generation += 1;
      feeds.clear();
      inflight.clear();
      cache.clear();
    };

    /** تحديث = إعادة التحميل من الرأس */
    const refresh = (feedKey) => load({ feed: feedKey, refresh: true });

    /** تعديل عنصر في كل التغذيات (مثلاً بعد إعجاب/حفظ) */
    const patchItem = (postId, patch) => {
      if (!postId || !patch) return 0;
      let touched = 0;
      for (const feed of feeds.values()) {
        const idx = feed.items.findIndex(p => p.id === postId);
        if (idx === -1) continue;
        feed.items[idx] = { ...feed.items[idx], ...patch };
        touched += 1;
      }
      const cached = cache.get(postId);
      if (cached) cache.set(postId, { ...cached, ...patch });
      return touched;
    };

    /** إزالة عنصر من كل التغذيات (بعد حذف) */
    const removeItem = (postId) => {
      if (!postId) return 0;
      let touched = 0;
      for (const feed of feeds.values()) {
        const before = feed.items.length;
        feed.items = feed.items.filter(p => p.id !== postId);
        if (feed.items.length !== before) touched += 1;
      }
      cache.invalidate(postId);
      return touched;
    };

    /** إدراج عنصر في رأس التغذية (بعد نشر جديد) */
    const prependItem = (feedKey, post) => {
      const feed = getFeed(feedKey);
      feed.items = mergeItems([post], feed.items);
      syncToStore(feed);
      return feed;
    };

    /* ---- البحث الموحّد ---- */

    const search = (() => {
      let lastQuery = '';
      let lastType = 'all';
      let lastCursors = { users: null, posts: null };
      let generation = 0;

      /**
       * تشغيل بحث.
       * @param {string} query
       * @param {string} [type='all']  'all' | 'users' | 'posts' | 'tags'
       * @param {object} [opts]
       * @param {boolean} [opts.silent]  لا تُسجّل في السجل
       */
      const run = async (query, type = 'all', opts = {}) => {
        const q = String(query || '').trim();
        lastQuery = q;
        lastType = type;
        lastCursors = { users: null, posts: null };
        generation += 1;
        const myGen = generation;

        if (!q) {
          return { query: q, type, users: [], posts: [], tags: [], hasMore: {}, stale: false };
        }

        // تسجيل في السجل
        if (!opts.silent) {
          const history = (K.store.get('search.history', []) || []).filter(h => h !== q);
          history.unshift(q);
          K.store.set('search.history', history.slice(0, 10));
        }
        K.store.set('search.query', q, { noPersist: true });
        K.store.set('search.type', type, { noPersist: true });

        const out = {
          query: q,
          type,
          users: [],
          posts: [],
          tags: [],
          hasMore: { users: false, posts: false },
          stale: false,
        };

        const tasks = [];

        if (type === 'all' || type === 'users') {
          tasks.push(
            K.api.discovery.searchUsers(q, { limit: type === 'all' ? 6 : 20 })
              .then(r => {
                out.users = r.items;
                out.hasMore.users = r.hasMore;
                lastCursors.users = r.cursor;
              })
              .catch(err => console.warn('[search.users]', err))
          );
        }

        if (type === 'all' || type === 'posts') {
          tasks.push(
            K.api.discovery.searchPosts(q, { limit: type === 'all' ? 12 : 20 })
              .then(r => {
                out.posts = r.items;
                out.hasMore.posts = r.hasMore;
                lastCursors.posts = r.cursor;
              })
              .catch(err => console.warn('[search.posts]', err))
          );
        }

        if (type === 'all' || type === 'tags') {
          tasks.push(
            K.api.discovery.searchTags(q, { limit: 12 })
              .then(items => { out.tags = items; })
              .catch(err => console.warn('[search.tags]', err))
          );
        }

        await Promise.all(tasks);
        if (generation !== myGen) {
          out.stale = true;
        }
        return out;
      };

      /** تحميل المزيد من نتائج نوع معيّن */
      const loadMore = async (type) => {
        const q = lastQuery;
        if (!q) return { items: [], hasMore: false, cursor: null };

        if (type === 'users' && lastCursors.users) {
          const r = await K.api.discovery.searchUsers(q, { cursor: lastCursors.users, limit: 20 });
          lastCursors.users = r.cursor;
          return r;
        }
        if (type === 'posts' && lastCursors.posts) {
          const r = await K.api.discovery.searchPosts(q, { cursor: lastCursors.posts, limit: 20 });
          lastCursors.posts = r.cursor;
          return r;
        }
        return { items: [], hasMore: false, cursor: null };
      };

      const clear = () => {
        generation += 1;
        lastQuery = '';
        lastCursors = { users: null, posts: null };
        K.store.set('search.query', '', { noPersist: true });
      };

      const clearHistory = () => {
        K.store.set('search.history', []);
      };

      return {
        run, loadMore, clear, clearHistory,
        get query() { return lastQuery; },
        get type() { return lastType; },
      };
    })();

    /* ---- التمرير اللانهائي ---- */

    /**
     * يربط sentinel لتحميل المزيد عند الاقتراب.
     * @param {Element} sentinel
     * @param {string} feedKey
     * @param {object} [opts]
     * @param {Function} [opts.onLoad]   ({feed, added, page}) => void
     * @param {Function} [opts.onError]  ({error, feed}) => void
     * @param {number} [opts.rootMargin='400px 0px']
     * @param {number} [opts.cooldown=350]
     */
    const attachInfiniteScroll = (sentinel, feedKey, opts = {}) => {
      if (!sentinel) return { detach: () => {}, refresh: () => {} };

      let armed = true;
      const cooldown = opts.cooldown ?? 350;

      const trigger = () => {
        if (!armed) return;
        const feed = getFeed(feedKey);
        if (feed.loading || !feed.hasMore) return;

        armed = false;
        loadMore(feedKey).then(res => {
          if (res.ok && opts.onLoad) {
            K.utils.tryCatch(() => opts.onLoad(res));
          }
          if (!res.ok && !res.busy && !res.stale && opts.onError) {
            K.utils.tryCatch(() => opts.onError(res));
          }
          setTimeout(() => { armed = true; }, cooldown);
        });
      };

      // IntersectionObserver عند الدعم
      if (K.support.intersection) {
        const observer = new IntersectionObserver((entries) => {
          for (const entry of entries) {
            if (entry.isIntersecting) trigger();
          }
        }, {
          root: sentinel.closest('.k-screen') || null,
          rootMargin: opts.rootMargin || '400px 0px',
          threshold: 0,
        });
        observer.observe(sentinel);

        return {
          detach() { observer.disconnect(); },
          refresh() { observer.unobserve(sentinel); observer.observe(sentinel); },
          trigger,
        };
      }

      // تراجع: مستمع scroll يدوي
      const screen = sentinel.closest('.k-screen') || document.scrollingElement;
      const onScroll = K.utils.throttleRAF(() => {
        const rect = sentinel.getBoundingClientRect();
        if (rect.top < innerHeight + 400 && rect.bottom > -400) trigger();
      });
      screen.addEventListener('scroll', onScroll, { passive: true });

      return {
        detach() { screen.removeEventListener('scroll', onScroll); },
        refresh() { /* لا شيء — المستمع يعمل دائماً */ },
        trigger,
      };
    };

    /* ---- الفلاتر ---- */

    /** تطبيق فلتر على تغذية وإعادة التحميل إن تغيّر */
    const applyFilters = async (feedKey, patch) => {
      const feed = getFeed(feedKey);
      const before = JSON.stringify(feed.filters);
      feed.filters = { ...feed.filters, ...patch };
      const after = JSON.stringify(feed.filters);

      // مزامنة مع الحالة (لا حفظ دائم)
      K.store.set('filters', { ...feed.filters }, { noPersist: true });

      if (before === after) return { ok: true, unchanged: true };
      return load({ feed: feedKey, refresh: true });
    };

    /** إعادة ضبط الفلاتر */
    const resetFilters = (feedKey) => {
      const feed = getFeed(feedKey);
      feed.filters = { ...DEFAULT_FILTERS };
      K.store.set('filters', { ...DEFAULT_FILTERS }, { noPersist: true });
      return load({ feed: feedKey, refresh: true });
    };

    /** الحصول على منشور من الكاش (لتسريع الرسم) */
    const getPost = (id) => cache.get(id);

    /* ---- واجهة عامة ---- */

    return {
      getFeed,
      load, loadMore, refresh, reset, resetAll,
      patchItem, removeItem, prependItem,
      search,
      attachInfiniteScroll,
      applyFilters, resetFilters,
      getPost,
      cache,
      get allFeeds() { return Array.from(feeds.keys()); },
      feedState(key) {
        const f = feeds.get(key);
        if (!f) return null;
        return {
          key: f.key,
          count: f.items.length,
          hasMore: f.hasMore,
          loading: f.loading,
          error: f.error ? (f.error.message || 'خطأ') : null,
          loadedAt: f.loadedAt,
          filters: { ...f.filters },
        };
      },
    };
  })();


  /* ═══════════════════════════════════════════════════════════
     التهيئة
     ═══════════════════════════════════════════════════════════ */

  const init = () => {
    // مزامنة الفلاتر المحفوظة مع تغذية الرئيسية
    const stored = K.store.get('filters', null);
    if (stored) {
      const feed = content.getFeed('home');
      feed.filters = { ...feed.filters, ...stored };
    }

    // مسح الكاش عند الخروج
    K.store.subscribe('authStatus', (status) => {
      if (status === 'guest') content.resetAll();
    });
  };

  /* ═══════════════════════════════════════════════════════════
     التصدير
     ═══════════════════════════════════════════════════════════ */

  K.api = K.api || {};
  K.api.posts = posts;
  K.api.discovery = discovery;
  K.content = content;
  K.content.init = init;

  /* نهاية 05-content.js */
})();