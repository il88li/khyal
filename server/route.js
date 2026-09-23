/* ============================================================
   خَيال · المسارات
   كل واجهات API المنصوص عليها في /js/04–08
   ============================================================ */

import { Router } from 'express';
import bcrypt from 'bcrypt';
import crypto from 'node:crypto';
import {
  pool, listPosts, getPostById, getRelatedPosts,
  normalizeUser, normalizePost, normalizeComment,
  loadViewerState, createNotification,
  trendingTags, searchTags, searchUsers,
  encodeCursor, decodeCursor,
  pushToUser, broadcastToConversation,
} from './services.js';
import {
  requireAuth, csrfProtect, rateLimit,
  validateBody, validators, sanitizeText, sanitizeUrl,
  uploadImage, uploadAttachment, fileToUrl,
  createSession, destroySession,
} from './middleware.js';

const router = Router();

/* ═══════════════════════════════════════════════════════════
   CSRF token
   ═══════════════════════════════════════════════════════════ */

router.get('/api/csrf', (req, res) => {
  if (!req.session) {
    return res.status(403).json({ error: 'no-session', message: 'لا توجد جلسة' });
  }
  res.json({ token: req.session.csrfToken });
});

/* ═══════════════════════════════════════════════════════════
   Health
   ═══════════════════════════════════════════════════════════ */

router.get('/api/health/ping', (_req, res) => res.json({ ok: true }));
router.head('/api/health/ping', (_req, res) => res.status(200).end());

router.get('/api/health/check', async (_req, res) => {
  const started = Date.now();
  let dbOk = false;
  try {
    await pool.query('SELECT 1');
    dbOk = true;
  } catch { /* */ }
  res.json({
    status: dbOk ? 'ok' : 'degraded',
    database: dbOk ? 'ok' : 'down',
    version: '1.0.0',
    uptime: process.uptime(),
    latency: Date.now() - started,
  });
});

/* ═══════════════════════════════════════════════════════════
   Account
   ═══════════════════════════════════════════════════════════ */

router.post(
  '/api/account/signup',
  rateLimit({ max: 10, window: 60 * 60 * 1000 }),
  validateBody({
    handle: validators.handle,
    displayName: validators.displayName,
    email: validators.email,
    password: validators.password,
  }),
  async (req, res, next) => {
    try {
      const { handle, displayName, email, password } = req.clean;
      const exists = await pool.query(
        'SELECT 1 FROM users WHERE LOWER(handle) = $1 OR LOWER(email) = $2 LIMIT 1',
        [handle, email]
      );
      if (exists.rows.length) {
        return res.status(409).json({
          error: 'conflict',
          message: 'المعرّف أو البريد مستخدم مسبقاً',
        });
      }
      const hash = await bcrypt.hash(password, 12);
      const { rows } = await pool.query(`
        INSERT INTO users (handle, display_name, email, password_hash)
        VALUES ($1, $2, $3, $4)
        RETURNING *
      `, [handle, displayName, email, hash]);

      const user = rows[0];
      await createSession(user.id, req, res);
      res.status(201).json({ user: normalizeUser(user, { isSelf: true }) });
    } catch (err) { next(err); }
  }
);

router.post(
  '/api/account/login',
  rateLimit({ max: 10, window: 15 * 60 * 1000 }),
  validateBody({ email: validators.email, password: (v) => ({ ok: !!v, value: v }) }),
  async (req, res, next) => {
    try {
      const { email, password } = req.clean;
      const { rows } = await pool.query(
        "SELECT * FROM users WHERE LOWER(email) = $1 AND status = 'active'",
        [email]
      );
      if (!rows.length) {
        return res.status(401).json({ error: 'auth', message: 'البريد أو كلمة المرور غير صحيحة' });
      }
      const user = rows[0];
      const ok = await bcrypt.compare(password, user.password_hash);
      if (!ok) {
        return res.status(401).json({ error: 'auth', message: 'البريد أو كلمة المرور غير صحيحة' });
      }
      await createSession(user.id, req, res);
      res.json({ user: normalizeUser(user, { isSelf: true }) });
    } catch (err) { next(err); }
  }
);

router.post('/api/account/logout', async (req, res, next) => {
  try {
    await destroySession(req, res);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

router.get('/api/account/me', requireAuth, async (req, res, next) => {
  try {
    const { rows } = await pool.query(`
      SELECT u.*,
        (SELECT COUNT(*) FROM posts WHERE author_id = u.id AND deleted_at IS NULL)::int AS posts_count,
        (SELECT COUNT(*) FROM follows WHERE following_id = u.id)::int AS followers_count,
        (SELECT COUNT(*) FROM follows WHERE follower_id = u.id)::int AS following_count,
        (SELECT COALESCE(SUM(likes_count),0) FROM posts WHERE author_id = u.id)::int AS likes_received
      FROM users u WHERE u.id = $1
    `, [req.user.id]);
    if (!rows.length) return res.status(404).json({ error: 'not-found' });
    res.json({ user: normalizeUser(rows[0], { isSelf: true }) });
  } catch (err) { next(err); }
});

router.get('/api/account/profile/:handle', async (req, res, next) => {
  try {
    const { rows } = await pool.query(`
      SELECT u.*,
        (SELECT COUNT(*) FROM posts WHERE author_id = u.id AND deleted_at IS NULL)::int AS posts_count,
        (SELECT COUNT(*) FROM follows WHERE following_id = u.id)::int AS followers_count,
        (SELECT COUNT(*) FROM follows WHERE follower_id = u.id)::int AS following_count
      FROM users u WHERE LOWER(u.handle) = $1 AND u.status = 'active'
    `, [req.params.handle.toLowerCase()]);
    if (!rows.length) return res.status(404).json({ error: 'not-found' });

    const target = rows[0];
    const viewerId = req.user?.id;
    let isFollowing = false;
    let isFollowedBy = false;
    if (viewerId && viewerId !== target.id) {
      const r = await pool.query(`
        SELECT
          EXISTS(SELECT 1 FROM follows WHERE follower_id = $1 AND following_id = $2) AS f1,
          EXISTS(SELECT 1 FROM follows WHERE follower_id = $2 AND following_id = $1) AS f2
      `, [viewerId, target.id]);
      isFollowing = r.rows[0].f1;
      isFollowedBy = r.rows[0].f2;
    }
    res.json({
      user: normalizeUser(target, {
        isSelf: viewerId === target.id,
        isFollowing, isFollowedBy,
      }),
    });
  } catch (err) { next(err); }
});

router.patch(
  '/api/account/profile',
  requireAuth, csrfProtect,
  (req, _res, next) => {
    const { displayName, bio, location, website } = req.body || {};
    const clean = {};
    if (displayName !== undefined) {
      const r = validators.displayName(displayName);
      if (!r.ok) { const e = new Error(r.error); e.status = 422; e.field = 'displayName'; return next(e); }
      clean.displayName = r.value;
    }
    if (bio !== undefined) clean.bio = sanitizeText(bio, 300);
    if (location !== undefined) clean.location = sanitizeText(location, 80);
    if (website !== undefined) clean.website = sanitizeUrl(website) || '';
    req.clean = clean;
    next();
  },
  async (req, res, next) => {
    try {
      const c = req.clean;
      const sets = [];
      const params = [];
      let i = 1;
      if (c.displayName !== undefined) { sets.push(`display_name = $${i++}`); params.push(c.displayName); }
      if (c.bio !== undefined) { sets.push(`bio = $${i++}`); params.push(c.bio); }
      if (c.location !== undefined) { sets.push(`location = $${i++}`); params.push(c.location); }
      if (c.website !== undefined) { sets.push(`website = $${i++}`); params.push(c.website); }

      if (!sets.length) return res.status(400).json({ error: 'no-fields' });

      params.push(req.user.id);
      const { rows } = await pool.query(
        `UPDATE users SET ${sets.join(', ')} WHERE id = $${i} RETURNING *`,
        params
      );
      res.json({ user: normalizeUser(rows[0], { isSelf: true }) });
    } catch (err) { next(err); }
  }
);

router.post(
  '/api/account/avatar',
  requireAuth, csrfProtect,
  uploadImage.single('avatar'),
  async (req, res, next) => {
    try {
      if (!req.file) return res.status(400).json({ error: 'no-file' });
      const url = fileToUrl(req.file);
      const { rows } = await pool.query(
        'UPDATE users SET avatar = $1 WHERE id = $2 RETURNING *',
        [url, req.user.id]
      );
      res.json({ user: normalizeUser(rows[0], { isSelf: true }) });
    } catch (err) { next(err); }
  }
);

router.post(
  '/api/account/cover',
  requireAuth, csrfProtect,
  uploadImage.single('cover'),
  async (req, res, next) => {
    try {
      if (!req.file) return res.status(400).json({ error: 'no-file' });
      const url = fileToUrl(req.file);
      const { rows } = await pool.query(
        'UPDATE users SET cover = $1 WHERE id = $2 RETURNING *',
        [url, req.user.id]
      );
      res.json({ user: normalizeUser(rows[0], { isSelf: true }) });
    } catch (err) { next(err); }
  }
);

router.patch(
  '/api/account/password',
  requireAuth, csrfProtect,
  rateLimit({ max: 5, window: 15 * 60 * 1000 }),
  async (req, res, next) => {
    try {
      const { currentPassword, newPassword } = req.body || {};
      const r = validators.password(newPassword);
      if (!r.ok) return res.status(422).json({ error: 'invalid', message: r.error, field: 'password' });

      const { rows } = await pool.query('SELECT password_hash FROM users WHERE id = $1', [req.user.id]);
      const ok = await bcrypt.compare(currentPassword || '', rows[0].password_hash);
      if (!ok) return res.status(401).json({ error: 'auth', message: 'كلمة المرور الحالية غير صحيحة' });

      const hash = await bcrypt.hash(r.value, 12);
      await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [hash, req.user.id]);

      const token = req.cookies.khayal_sid;
      const tokenHash = token ? crypto.createHash('sha256').update(token).digest('hex') : '';
      await pool.query('DELETE FROM sessions WHERE user_id = $1 AND token_hash <> $2', [req.user.id, tokenHash]);

      res.json({ ok: true });
    } catch (err) { next(err); }
  }
);

router.delete('/api/account/delete', requireAuth, csrfProtect, async (req, res, next) => {
  try {
    if (req.headers['x-confirm-delete'] !== 'yes') {
      return res.status(400).json({ error: 'confirm-required', message: 'يتطلب تأكيد الحذف' });
    }
    await pool.query("UPDATE users SET status = 'deleted', handle = CONCAT('deleted-', id) WHERE id = $1", [req.user.id]);
    await destroySession(req, res);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

/* ═══════════════════════════════════════════════════════════
   Posts
   ═══════════════════════════════════════════════════════════ */

router.get('/api/posts', async (req, res, next) => {
  try {
    const tags = req.query.tags ? String(req.query.tags).split(',').filter(Boolean) : [];
    const models = req.query.models ? String(req.query.models).split(',').filter(Boolean) : [];
    const result = await listPosts({
      sort: req.query.sort || 'recent',
      period: req.query.period || 'all',
      author: req.query.author || null,
      tags, models,
      cursor: req.query.cursor || null,
      limit: Math.min(parseInt(req.query.limit || '20', 10), 50),
    }, req.user?.id);
    res.json(result);
  } catch (err) { next(err); }
});

router.get('/api/posts/:id', async (req, res, next) => {
  try {
    const r = validators.uuid(req.params.id);
    if (!r.ok) return res.status(400).json({ error: 'invalid-id' });
    const post = await getPostById(r.value, req.user?.id);
    if (!post) return res.status(404).json({ error: 'not-found', message: 'المنشور غير موجود' });
    res.json({ post });
  } catch (err) { next(err); }
});

router.post(
  '/api/posts',
  requireAuth, csrfProtect,
  rateLimit({ max: 10, window: 10 * 60 * 1000 }),
  validateBody({ title: validators.title, prompt: validators.prompt, tags: validators.tags }),
  async (req, res, next) => {
    try {
      const { title, prompt, tags } = req.clean;
      const images = Array.isArray(req.body.images)
        ? req.body.images.map(sanitizeUrl).filter(Boolean).slice(0, 4)
        : [];
      if (!images.length) return res.status(422).json({ error: 'no-image', message: 'أضف صورة على الأقل' });

      const model = sanitizeText(req.body.model || '', 60);
      const visibility = ['public', 'unlisted', 'private'].includes(req.body.visibility)
        ? req.body.visibility : 'public';
      const nsfw = !!req.body.nsfw;

      const { rows } = await pool.query(`
        INSERT INTO posts (author_id, title, prompt, images, cover, model, tags, visibility, nsfw)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *
      `, [req.user.id, title, prompt, images, images[0], model, tags, visibility, nsfw]);

      const post = await getPostById(rows[0].id, req.user.id);
      res.status(201).json({ post });
    } catch (err) { next(err); }
  }
);

router.patch(
  '/api/posts/:id',
  requireAuth, csrfProtect,
  async (req, res, next) => {
    try {
      const { rows: own } = await pool.query(
        'SELECT author_id FROM posts WHERE id = $1 AND deleted_at IS NULL', [req.params.id]
      );
      if (!own.length) return res.status(404).json({ error: 'not-found' });
      if (own[0].author_id !== req.user.id && req.user.role !== 'admin') {
        return res.status(403).json({ error: 'forbidden' });
      }
      const updates = {};
      if (req.body.title !== undefined) {
        const r = validators.title(req.body.title);
        if (!r.ok) return res.status(422).json({ error: 'invalid', message: r.error });
        updates.title = r.value;
      }
      if (req.body.prompt !== undefined) {
        const r = validators.prompt(req.body.prompt);
        if (!r.ok) return res.status(422).json({ error: 'invalid', message: r.error });
        updates.prompt = r.value;
      }
      if (req.body.tags !== undefined) {
        const r = validators.tags(req.body.tags);
        updates.tags = r.value;
      }
      if (!Object.keys(updates).length) return res.status(400).json({ error: 'no-fields' });

      const sets = [];
      const params = [];
      let i = 1;
      for (const [k, v] of Object.entries(updates)) {
        sets.push(`${k} = $${i++}`);
        params.push(v);
      }
      params.push(req.params.id);
      await pool.query(`UPDATE posts SET ${sets.join(', ')} WHERE id = $${i}`, params);

      const post = await getPostById(req.params.id, req.user.id);
      res.json({ post });
    } catch (err) { next(err); }
  }
);

router.delete('/api/posts/:id', requireAuth, csrfProtect, async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      'SELECT author_id FROM posts WHERE id = $1 AND deleted_at IS NULL', [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'not-found' });
    if (rows[0].author_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'forbidden' });
    }
    await pool.query('UPDATE posts SET deleted_at = NOW() WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

router.post(
  '/api/posts/upload',
  requireAuth, csrfProtect,
  uploadImage.single('image'),
  (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'no-file' });
    res.json({ url: fileToUrl(req.file) });
  }
);

/* ═══════════════════════════════════════════════════════════
   Discovery
   ═══════════════════════════════════════════════════════════ */

router.get('/api/discovery/related/:id', async (req, res, next) => {
  try {
    const limit = Math.min(parseInt(req.query.limit || '8', 10), 20);
    const items = await getRelatedPosts(req.params.id, limit, req.user?.id);
    res.json({ items });
  } catch (err) { next(err); }
});

router.get('/api/discovery/users', async (req, res, next) => {
  try {
    const q = String(req.query.q || '').trim();
    if (!q) return res.json({ items: [], hasMore: false, cursor: null });
    const limit = Math.min(parseInt(req.query.limit || '20', 10), 50);
    const rows = await searchUsers(q, limit, req.query.cursor);
    const items = rows.slice(0, limit).map(r => ({
      id: r.id, handle: r.handle, displayName: r.display_name,
      avatar: r.avatar, verified: r.verified, bio: r.bio || '',
      relation: {},
    }));
    const hasMore = rows.length > limit;
    const last = rows[rows.length - 1];
    res.json({
      items,
      hasMore,
      cursor: hasMore && last ? encodeCursor({ ts: last.created_at, id: last.id }) : null,
    });
  } catch (err) { next(err); }
});

router.get('/api/discovery/posts', async (req, res, next) => {
  try {
    const q = String(req.query.q || '').trim();
    if (!q) return res.json({ items: [], hasMore: false, cursor: null });
    const limit = Math.min(parseInt(req.query.limit || '20', 10), 50);
    const pattern = `%${q}%`;
    const { rows } = await pool.query(`
      SELECT p.*, u.handle AS author_handle, u.display_name AS author_display_name,
        u.avatar AS author_avatar, u.verified AS author_verified
      FROM posts p
      JOIN users u ON u.id = p.author_id
      WHERE p.deleted_at IS NULL AND p.visibility = 'public'
        AND (p.title ILIKE $1 OR p.prompt ILIKE $1 OR $2 = ANY(p.tags))
      ORDER BY (p.likes_count + p.saves_count * 2) DESC, p.created_at DESC
      LIMIT $3
    `, [pattern, q.toLowerCase(), limit + 1]);

    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;
    const postIds = items.map(r => r.id);
    const authorIds = [...new Set(items.map(r => r.author_id))];
    const viewer = await loadViewerState(req.user?.id, postIds, authorIds);
    res.json({ items: items.map(r => normalizePost(r, viewer)), hasMore, cursor: null });
  } catch (err) { next(err); }
});

router.get('/api/discovery/tags', async (req, res, next) => {
  try {
    const q = String(req.query.q || '').trim();
    const items = await searchTags(q, Math.min(parseInt(req.query.limit || '20', 10), 30));
    res.json({ items });
  } catch (err) { next(err); }
});

router.get('/api/discovery/trending-tags', async (req, res, next) => {
  try {
    const items = await trendingTags(req.query.period || 'week', Math.min(parseInt(req.query.limit || '12', 10), 20));
    res.json({ items });
  } catch (err) { next(err); }
});

router.get('/api/discovery/suggested-users', async (req, res, next) => {
  try {
    const limit = Math.min(parseInt(req.query.limit || '5', 10), 20);
    const { rows } = await pool.query(`
      SELECT u.id, u.handle, u.display_name, u.avatar, u.verified
      FROM users u
      WHERE u.status = 'active'
        AND u.id <> COALESCE($1, '00000000-0000-0000-0000-000000000000'::uuid)
        AND NOT EXISTS (
          SELECT 1 FROM follows WHERE follower_id = $1 AND following_id = u.id
        )
      ORDER BY RANDOM()
      LIMIT $2
    `, [req.user?.id || null, limit]);
    res.json({
      items: rows.map(r => ({
        id: r.id, handle: r.handle, displayName: r.display_name,
        avatar: r.avatar, verified: r.verified, relation: {},
      })),
    });
  } catch (err) { next(err); }
});

router.get('/api/discovery/editor-picks', async (req, res, next) => {
  try {
    const limit = Math.min(parseInt(req.query.limit || '6', 10), 20);
    const result = await listPosts({ sort: 'top', period: 'week', limit }, req.user?.id);
    res.json({ items: result.items });
  } catch (err) { next(err); }
});

router.get('/api/discovery/trending', async (req, res, next) => {
  try {
    const limit = Math.min(parseInt(req.query.limit || '12', 10), 30);
    const result = await listPosts({
      sort: 'trending', period: req.query.period || 'week', limit,
    }, req.user?.id);
    res.json({ items: result.items });
  } catch (err) { next(err); }
});

router.get('/api/discovery/new-today', async (req, res, next) => {
  try {
    const limit = Math.min(parseInt(req.query.limit || '18', 10), 30);
    const result = await listPosts({ sort: 'recent', period: 'today', limit }, req.user?.id);
    res.json({ items: result.items });
  } catch (err) { next(err); }
});

/* ═══════════════════════════════════════════════════════════
   Interactions
   ═══════════════════════════════════════════════════════════ */

router.post('/api/interactions/like', requireAuth, csrfProtect, async (req, res, next) => {
  try {
    const { postId } = req.body;
    if (!postId) return res.status(400).json({ error: 'missing-postId' });
    const { rowCount } = await pool.query(
      'INSERT INTO likes (user_id, post_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [req.user.id, postId]
    );
    if (rowCount) {
      await pool.query('UPDATE posts SET likes_count = likes_count + 1 WHERE id = $1', [postId]);
      const { rows } = await pool.query('SELECT author_id, cover FROM posts WHERE id = $1', [postId]);
      if (rows[0]) {
        const notif = await createNotification({
          userId: rows[0].author_id, type: 'like',
          actorId: req.user.id, targetType: 'post',
          targetId: postId, targetThumb: rows[0].cover,
        });
        if (notif) pushToUser(rows[0].author_id, { type: 'notification', data: notif });
      }
    }
    const { rows: p } = await pool.query('SELECT likes_count FROM posts WHERE id = $1', [postId]);
    res.json({ liked: true, stats: { likes: p[0]?.likes_count || 0 } });
  } catch (err) { next(err); }
});

router.delete('/api/interactions/like', requireAuth, csrfProtect, async (req, res, next) => {
  try {
    const postId = req.query.postId;
    if (!postId) return res.status(400).json({ error: 'missing-postId' });
    const { rowCount } = await pool.query(
      'DELETE FROM likes WHERE user_id = $1 AND post_id = $2', [req.user.id, postId]
    );
    if (rowCount) {
      await pool.query('UPDATE posts SET likes_count = GREATEST(0, likes_count - 1) WHERE id = $1', [postId]);
    }
    const { rows } = await pool.query('SELECT likes_count FROM posts WHERE id = $1', [postId]);
    res.json({ liked: false, stats: { likes: rows[0]?.likes_count || 0 } });
  } catch (err) { next(err); }
});

router.get('/api/interactions/likes', requireAuth, async (req, res, next) => {
  try {
    const limit = Math.min(parseInt(req.query.limit || '20', 10), 50);
    const cur = decodeCursor(req.query.cursor);
    const conds = ['l.user_id = $1', 'p.deleted_at IS NULL'];
    const params = [req.user.id];
    let i = 2;
    if (cur) { conds.push(`l.created_at < $${i++}`); params.push(cur.ts); }
    params.push(limit + 1);

    const { rows } = await pool.query(`
      SELECT p.*, u.handle AS author_handle, u.display_name AS author_display_name,
        u.avatar AS author_avatar, u.verified AS author_verified,
        l.created_at AS liked_at
      FROM likes l
      JOIN posts p ON p.id = l.post_id
      JOIN users u ON u.id = p.author_id
      WHERE ${conds.join(' AND ')}
      ORDER BY l.created_at DESC
      LIMIT $${i}
    `, params);

    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;
    const postIds = items.map(r => r.id);
    const authorIds = [...new Set(items.map(r => r.author_id))];
    const viewer = await loadViewerState(req.user.id, postIds, authorIds);
    const last = items[items.length - 1];

    res.json({
      items: items.map(r => ({ post: normalizePost(r, viewer) })),
      hasMore,
      cursor: hasMore && last ? encodeCursor({ ts: last.liked_at, id: last.id }) : null,
    });
  } catch (err) { next(err); }
});

router.post('/api/interactions/save', requireAuth, csrfProtect, async (req, res, next) => {
  try {
    const { postId, folderId } = req.body;
    if (!postId) return res.status(400).json({ error: 'missing-postId' });
    const { rowCount } = await pool.query(
      `INSERT INTO saves (user_id, post_id, folder_id) VALUES ($1, $2, $3)
       ON CONFLICT (user_id, post_id) DO UPDATE SET folder_id = EXCLUDED.folder_id`,
      [req.user.id, postId, folderId || null]
    );
    if (rowCount) {
      await pool.query('UPDATE posts SET saves_count = saves_count + 1 WHERE id = $1', [postId]);
      const { rows } = await pool.query('SELECT author_id, cover FROM posts WHERE id = $1', [postId]);
      if (rows[0]) {
        const notif = await createNotification({
          userId: rows[0].author_id, type: 'save',
          actorId: req.user.id, targetType: 'post',
          targetId: postId, targetThumb: rows[0].cover,
        });
        if (notif) pushToUser(rows[0].author_id, { type: 'notification', data: notif });
      }
    }
    const { rows: p } = await pool.query('SELECT saves_count FROM posts WHERE id = $1', [postId]);
    res.json({ saved: true, stats: { saves: p[0]?.saves_count || 0 } });
  } catch (err) { next(err); }
});

router.delete('/api/interactions/save', requireAuth, csrfProtect, async (req, res, next) => {
  try {
    const postId = req.query.postId;
    if (!postId) return res.status(400).json({ error: 'missing-postId' });
    const { rowCount } = await pool.query(
      'DELETE FROM saves WHERE user_id = $1 AND post_id = $2', [req.user.id, postId]
    );
    if (rowCount) {
      await pool.query('UPDATE posts SET saves_count = GREATEST(0, saves_count - 1) WHERE id = $1', [postId]);
    }
    const { rows } = await pool.query('SELECT saves_count FROM posts WHERE id = $1', [postId]);
    res.json({ saved: false, stats: { saves: rows[0]?.saves_count || 0 } });
  } catch (err) { next(err); }
});

router.get('/api/interactions/saves', requireAuth, async (req, res, next) => {
  try {
    const limit = Math.min(parseInt(req.query.limit || '20', 10), 50);
    const cur = decodeCursor(req.query.cursor);
    const conds = ['s.user_id = $1', 'p.deleted_at IS NULL'];
    const params = [req.user.id];
    let i = 2;
    if (req.query.folderId) { conds.push(`s.folder_id = $${i++}`); params.push(req.query.folderId); }
    if (cur) { conds.push(`s.created_at < $${i++}`); params.push(cur.ts); }
    params.push(limit + 1);

    const { rows } = await pool.query(`
      SELECT p.*, u.handle AS author_handle, u.display_name AS author_display_name,
        u.avatar AS author_avatar, u.verified AS author_verified,
        s.created_at AS saved_at
      FROM saves s
      JOIN posts p ON p.id = s.post_id
      JOIN users u ON u.id = p.author_id
      WHERE ${conds.join(' AND ')}
      ORDER BY s.created_at DESC
      LIMIT $${i}
    `, params);

    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;
    const postIds = items.map(r => r.id);
    const authorIds = [...new Set(items.map(r => r.author_id))];
    const viewer = await loadViewerState(req.user.id, postIds, authorIds);
    const last = items[items.length - 1];

    res.json({
      items: items.map(r => ({ post: normalizePost(r, viewer) })),
      hasMore,
      cursor: hasMore && last ? encodeCursor({ ts: last.saved_at, id: last.id }) : null,
    });
  } catch (err) { next(err); }
});

router.post('/api/interactions/follow', requireAuth, csrfProtect, async (req, res, next) => {
  try {
    const { userId } = req.body;
    if (!userId || userId === req.user.id) return res.status(400).json({ error: 'invalid-userId' });
    const { rowCount } = await pool.query(
      'INSERT INTO follows (follower_id, following_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [req.user.id, userId]
    );
    if (rowCount) {
      const notif = await createNotification({
        userId, type: 'follow', actorId: req.user.id,
        targetType: 'user', targetId: req.user.id,
      });
      if (notif) pushToUser(userId, { type: 'notification', data: notif });
    }
    res.json({ following: true });
  } catch (err) { next(err); }
});

router.delete('/api/interactions/follow', requireAuth, csrfProtect, async (req, res, next) => {
  try {
    const userId = req.query.userId;
    if (!userId) return res.status(400).json({ error: 'missing-userId' });
    await pool.query(
      'DELETE FROM follows WHERE follower_id = $1 AND following_id = $2',
      [req.user.id, userId]
    );
    res.json({ following: false });
  } catch (err) { next(err); }
});

router.get('/api/interactions/followers/:userId', async (req, res, next) => {
  try {
    const limit = Math.min(parseInt(req.query.limit || '20', 10), 50);
    const { rows } = await pool.query(`
      SELECT u.id, u.handle, u.display_name, u.avatar, u.verified
      FROM follows f
      JOIN users u ON u.id = f.follower_id
      WHERE f.following_id = $1 AND u.status = 'active'
      ORDER BY f.created_at DESC
      LIMIT $2
    `, [req.params.userId, limit + 1]);
    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;
    res.json({
      items: items.map(r => ({
        id: r.id, handle: r.handle, displayName: r.display_name,
        avatar: r.avatar, verified: r.verified,
      })),
      hasMore,
    });
  } catch (err) { next(err); }
});

router.get('/api/interactions/following/:userId', async (req, res, next) => {
  try {
    const limit = Math.min(parseInt(req.query.limit || '20', 10), 50);
    const { rows } = await pool.query(`
      SELECT u.id, u.handle, u.display_name, u.avatar, u.verified
      FROM follows f
      JOIN users u ON u.id = f.following_id
      WHERE f.follower_id = $1 AND u.status = 'active'
      ORDER BY f.created_at DESC
      LIMIT $2
    `, [req.params.userId, limit + 1]);
    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;
    res.json({
      items: items.map(r => ({
        id: r.id, handle: r.handle, displayName: r.display_name,
        avatar: r.avatar, verified: r.verified,
      })),
      hasMore,
    });
  } catch (err) { next(err); }
});

router.post('/api/interactions/copy', requireAuth, csrfProtect, async (req, res, next) => {
  try {
    const { postId } = req.body;
    if (!postId) return res.status(400).json({ error: 'missing-postId' });
    await pool.query('UPDATE posts SET copies_count = copies_count + 1 WHERE id = $1', [postId]);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

router.post(
  '/api/interactions/comments',
  requireAuth, csrfProtect,
  rateLimit({ max: 30, window: 5 * 60 * 1000 }),
  validateBody({ text: validators.commentText }),
  async (req, res, next) => {
    try {
      const { text } = req.clean;
      const postId = req.body.postId;
      const parentId = req.body.parentId || null;
      if (!postId) return res.status(400).json({ error: 'missing-postId' });

      const { rows } = await pool.query(`
        INSERT INTO comments (post_id, parent_id, author_id, text)
        VALUES ($1, $2, $3, $4)
        RETURNING *
      `, [postId, parentId, req.user.id, text]);

      await pool.query('UPDATE posts SET comments_count = comments_count + 1 WHERE id = $1', [postId]);

      const { rows: postInfo } = await pool.query('SELECT author_id, cover FROM posts WHERE id = $1', [postId]);
      if (postInfo[0]) {
        const notif = await createNotification({
          userId: postInfo[0].author_id, type: 'comment',
          actorId: req.user.id, targetType: 'post',
          targetId: postId, targetThumb: postInfo[0].cover,
          text: text.slice(0, 120),
        });
        if (notif) pushToUser(postInfo[0].author_id, { type: 'notification', data: notif });
      }

      const { rows: full } = await pool.query(`
        SELECT c.*, u.handle AS author_handle, u.display_name AS author_display_name,
          u.avatar AS author_avatar, u.verified AS author_verified,
          (SELECT COUNT(*) FROM comments WHERE parent_id = c.id AND deleted_at IS NULL)::int AS replies_count
        FROM comments c
        JOIN users u ON u.id = c.author_id
        WHERE c.id = $1
      `, [rows[0].id]);

      res.status(201).json({ comment: normalizeComment(full[0], { id: req.user.id }) });
    } catch (err) { next(err); }
  }
);

router.patch('/api/interactions/comments/:id', requireAuth, csrfProtect, async (req, res, next) => {
  try {
    const text = sanitizeText(req.body.text, 2000);
    if (!text) return res.status(400).json({ error: 'empty' });
    const { rows } = await pool.query(
      `UPDATE comments SET text = $1 WHERE id = $2 AND author_id = $3 AND deleted_at IS NULL
       RETURNING *`,
      [text, req.params.id, req.user.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'not-found' });
    const { rows: full } = await pool.query(`
      SELECT c.*, u.handle AS author_handle, u.display_name AS author_display_name,
        u.avatar AS author_avatar, u.verified AS author_verified,
        (SELECT COUNT(*) FROM comments WHERE parent_id = c.id AND deleted_at IS NULL)::int AS replies_count
      FROM comments c JOIN users u ON u.id = c.author_id WHERE c.id = $1
    `, [req.params.id]);
    res.json({ comment: normalizeComment(full[0], { id: req.user.id }) });
  } catch (err) { next(err); }
});

router.delete('/api/interactions/comments/:id', requireAuth, csrfProtect, async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT c.author_id, c.post_id FROM comments c WHERE c.id = $1`, [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'not-found' });
    const isOwner = rows[0].author_id === req.user.id;
    const isMod = ['admin', 'moderator'].includes(req.user.role);
    if (!isOwner && !isMod) return res.status(403).json({ error: 'forbidden' });

    await pool.query('UPDATE comments SET deleted_at = NOW() WHERE id = $1', [req.params.id]);
    await pool.query('UPDATE posts SET comments_count = GREATEST(0, comments_count - 1) WHERE id = $1', [rows[0].post_id]);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

router.get('/api/interactions/comments/:postId', async (req, res, next) => {
  try {
    const limit = Math.min(parseInt(req.query.limit || '20', 10), 50);
    const sort = req.query.sort === 'top' ? 'c.likes_count DESC, c.created_at DESC' : 'c.created_at DESC';
    const { rows } = await pool.query(`
      SELECT c.*, u.handle AS author_handle, u.display_name AS author_display_name,
        u.avatar AS author_avatar, u.verified AS author_verified,
        (SELECT COUNT(*) FROM comments WHERE parent_id = c.id AND deleted_at IS NULL)::int AS replies_count
      FROM comments c
      JOIN users u ON u.id = c.author_id
      WHERE c.post_id = $1 AND c.parent_id IS NULL AND c.deleted_at IS NULL
      ORDER BY ${sort}
      LIMIT $2
    `, [req.params.postId, limit]);

    const commentIds = rows.map(r => r.id);
    let likedSet = new Set();
    if (req.user && commentIds.length) {
      const r = await pool.query(
        'SELECT comment_id FROM comment_likes WHERE user_id = $1 AND comment_id = ANY($2)',
        [req.user.id, commentIds]
      );
      r.rows.forEach(x => likedSet.add(x.comment_id));
    }
    res.json({
      items: rows.map(r => normalizeComment(r, { id: req.user?.id, likedSet })),
      cursor: null,
      hasMore: rows.length === limit,
      total: rows.length,
    });
  } catch (err) { next(err); }
});

router.get('/api/interactions/comments/:commentId/replies', async (req, res, next) => {
  try {
    const limit = Math.min(parseInt(req.query.limit || '10', 10), 30);
    const { rows } = await pool.query(`
      SELECT c.*, u.handle AS author_handle, u.display_name AS author_display_name,
        u.avatar AS author_avatar, u.verified AS author_verified,
        (SELECT COUNT(*) FROM comments WHERE parent_id = c.id AND deleted_at IS NULL)::int AS replies_count
      FROM comments c
      JOIN users u ON u.id = c.author_id
      WHERE c.parent_id = $1 AND c.deleted_at IS NULL
      ORDER BY c.created_at ASC
      LIMIT $2
    `, [req.params.commentId, limit]);
    res.json({
      items: rows.map(r => normalizeComment(r, { id: req.user?.id })),
      hasMore: false,
    });
  } catch (err) { next(err); }
});

router.post('/api/interactions/comments/:commentId/like', requireAuth, csrfProtect, async (req, res, next) => {
  try {
    await pool.query(
      'INSERT INTO comment_likes (user_id, comment_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [req.user.id, req.params.commentId]
    );
    await pool.query('UPDATE comments SET likes_count = likes_count + 1 WHERE id = $1', [req.params.commentId]);
    res.json({ liked: true });
  } catch (err) { next(err); }
});

router.delete('/api/interactions/comments/:commentId/like', requireAuth, csrfProtect, async (req, res, next) => {
  try {
    const { rowCount } = await pool.query(
      'DELETE FROM comment_likes WHERE user_id = $1 AND comment_id = $2',
      [req.user.id, req.params.commentId]
    );
    if (rowCount) {
      await pool.query('UPDATE comments SET likes_count = GREATEST(0, likes_count - 1) WHERE id = $1', [req.params.commentId]);
    }
    res.json({ liked: false });
  } catch (err) { next(err); }
});

/* ═══════════════════════════════════════════════════════════
   Reports
   ═══════════════════════════════════════════════════════════ */

router.post(
  '/api/reports',
  requireAuth, csrfProtect,
  rateLimit({ max: 5, window: 60 * 60 * 1000 }),
  async (req, res, next) => {
    try {
      const { targetType, targetId, reason, note } = req.body || {};
      if (!['post', 'comment', 'user', 'message'].includes(targetType))
        return res.status(422).json({ error: 'invalid', message: 'نوع الهدف غير صحيح' });
      if (!targetId) return res.status(422).json({ error: 'invalid', message: 'المعرّف مطلوب' });
      if (!['spam','harassment','hate','violence','sexual','misinformation','copyright','impersonation','other'].includes(reason))
        return res.status(422).json({ error: 'invalid', message: 'السبب مطلوب' });

      await pool.query(`
        INSERT INTO reports (reporter_id, target_type, target_id, reason, note)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (reporter_id, target_type, target_id) DO NOTHING
      `, [req.user.id, targetType, targetId, reason, sanitizeText(note || '', 500)]);
      res.status(201).json({ ok: true });
    } catch (err) { next(err); }
  }
);

router.get('/api/reports', requireAuth, async (req, res, next) => {
  try {
    const limit = Math.min(parseInt(req.query.limit || '20', 10), 50);
    const { rows } = await pool.query(`
      SELECT * FROM reports WHERE reporter_id = $1
      ORDER BY created_at DESC LIMIT $2
    `, [req.user.id, limit]);
    res.json({
      items: rows.map(r => ({
        id: r.id, targetType: r.target_type, targetId: r.target_id,
        reason: r.reason, note: r.note, state: r.state,
        createdAt: r.created_at,
      })),
      hasMore: false,
    });
  } catch (err) { next(err); }
});

router.get('/api/reports/status', requireAuth, async (req, res, next) => {
  try {
    const { targetType, targetId } = req.query;
    const { rows } = await pool.query(`
      SELECT state, created_at FROM reports
      WHERE reporter_id = $1 AND target_type = $2 AND target_id = $3
    `, [req.user.id, targetType, targetId]);
    if (!rows.length) return res.json({ reported: false });
    res.json({ reported: true, state: rows[0].state, reportedAt: rows[0].created_at });
  } catch (err) { next(err); }
});

/* ═══════════════════════════════════════════════════════════
   Notifications
   ═══════════════════════════════════════════════════════════ */

router.get('/api/notifications', requireAuth, async (req, res, next) => {
  try {
    const limit = Math.min(parseInt(req.query.limit || '30', 10), 50);
    const conds = ['n.user_id = $1'];
    const params = [req.user.id];
    let i = 2;
    if (req.query.unreadOnly === 'true') conds.push('n.unread = TRUE');
    if (req.query.type) { conds.push(`n.type = $${i++}`); params.push(req.query.type); }
    const cur = decodeCursor(req.query.cursor);
    if (cur) { conds.push(`n.created_at < $${i++}`); params.push(cur.ts); }
    params.push(limit + 1);

    const { rows } = await pool.query(`
      SELECT n.*, u.handle AS actor_handle, u.display_name AS actor_display_name,
        u.avatar AS actor_avatar, u.verified AS actor_verified
      FROM notifications n
      LEFT JOIN users u ON u.id = n.actor_id
      WHERE ${conds.join(' AND ')}
      ORDER BY n.created_at DESC
      LIMIT $${i}
    `, params);

    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;

    const { rows: ur } = await pool.query(
      'SELECT COUNT(*)::int AS n FROM notifications WHERE user_id = $1 AND unread = TRUE',
      [req.user.id]
    );

    const last = items[items.length - 1];
    res.json({
      items: items.map(r => ({
        id: r.id, type: r.type,
        actor: r.actor_id ? {
          id: r.actor_id, handle: r.actor_handle,
          displayName: r.actor_display_name,
          avatar: r.actor_avatar, verified: r.actor_verified,
        } : null,
        targetId: r.target_id, targetThumb: r.target_thumb,
        text: r.text, unread: r.unread, createdAt: r.created_at,
      })),
      hasMore,
      cursor: hasMore && last ? encodeCursor({ ts: last.created_at, id: last.id }) : null,
      unread: ur[0]?.n || 0,
    });
  } catch (err) { next(err); }
});

router.get('/api/notifications/unread-count', requireAuth, async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      'SELECT COUNT(*)::int AS n FROM notifications WHERE user_id = $1 AND unread = TRUE',
      [req.user.id]
    );
    res.json({ count: rows[0]?.n || 0 });
  } catch (err) { next(err); }
});

router.patch('/api/notifications/:id/read', requireAuth, csrfProtect, async (req, res, next) => {
  try {
    await pool.query(
      'UPDATE notifications SET unread = FALSE WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );
    res.json({ ok: true });
  } catch (err) { next(err); }
});

router.patch('/api/notifications/read', requireAuth, csrfProtect, async (req, res, next) => {
  try {
    const ids = Array.isArray(req.body.ids) ? req.body.ids : [];
    if (!ids.length) return res.json({ count: 0 });
    const { rowCount } = await pool.query(
      'UPDATE notifications SET unread = FALSE WHERE user_id = $1 AND id = ANY($2)',
      [req.user.id, ids]
    );
    res.json({ count: rowCount });
  } catch (err) { next(err); }
});

router.patch('/api/notifications/read-all', requireAuth, csrfProtect, async (req, res, next) => {
  try {
    await pool.query('UPDATE notifications SET unread = FALSE WHERE user_id = $1', [req.user.id]);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

router.delete('/api/notifications/:id', requireAuth, csrfProtect, async (req, res, next) => {
  try {
    await pool.query('DELETE FROM notifications WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

router.delete('/api/notifications', requireAuth, csrfProtect, async (req, res, next) => {
  try {
    await pool.query('DELETE FROM notifications WHERE user_id = $1', [req.user.id]);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

/* ═══════════════════════════════════════════════════════════
   Messages
   ═══════════════════════════════════════════════════════════ */

router.get('/api/messages/conversations', requireAuth, async (req, res, next) => {
  try {
    const limit = Math.min(parseInt(req.query.limit || '30', 10), 50);
    const { rows } = await pool.query(`
      SELECT c.id, c.last_message_at,
        cm.unread_count,
        peer.id AS peer_id, peer.handle AS peer_handle,
        peer.display_name AS peer_display_name, peer.avatar AS peer_avatar,
        peer.verified AS peer_verified,
        m.id AS last_id, m.text AS last_text, m.sender_id AS last_sender_id,
        m.state AS last_state, m.created_at AS last_created
      FROM conversations c
      JOIN conversation_members cm ON cm.conversation_id = c.id AND cm.user_id = $1
      JOIN conversation_members cm2 ON cm2.conversation_id = c.id AND cm2.user_id <> $1
      JOIN users peer ON peer.id = cm2.user_id
      LEFT JOIN LATERAL (
        SELECT * FROM messages WHERE conversation_id = c.id
        ORDER BY created_at DESC LIMIT 1
      ) m ON TRUE
      WHERE peer.status = 'active'
      ORDER BY c.last_message_at DESC
      LIMIT $2
    `, [req.user.id, limit]);

    const { rows: ur } = await pool.query(`
      SELECT COALESCE(SUM(unread_count), 0)::int AS n
      FROM conversation_members WHERE user_id = $1
    `, [req.user.id]);

    res.json({
      items: rows.map(r => ({
        id: r.id,
        peer: {
          id: r.peer_id, handle: r.peer_handle,
          displayName: r.peer_display_name, avatar: r.peer_avatar,
          verified: r.peer_verified,
        },
        lastMessage: r.last_id ? {
          id: r.last_id, text: r.last_text,
          senderId: r.last_sender_id, state: r.last_state,
          createdAt: r.last_created,
        } : null,
        unreadCount: r.unread_count || 0,
        updatedAt: r.last_message_at,
        createdAt: r.last_message_at,
      })),
      hasMore: false,
      cursor: null,
      unread: ur[0]?.n || 0,
    });
  } catch (err) { next(err); }
});

router.post('/api/messages/conversations', requireAuth, csrfProtect, async (req, res, next) => {
  try {
    const { userId } = req.body;
    if (!userId || userId === req.user.id) return res.status(400).json({ error: 'invalid-userId' });

    const existing = await pool.query(`
      SELECT c.id FROM conversations c
      JOIN conversation_members m1 ON m1.conversation_id = c.id AND m1.user_id = $1
      JOIN conversation_members m2 ON m2.conversation_id = c.id AND m2.user_id = $2
      LIMIT 1
    `, [req.user.id, userId]);

    let convId;
    if (existing.rows.length) {
      convId = existing.rows[0].id;
    } else {
      const { rows: cr } = await pool.query('INSERT INTO conversations DEFAULT VALUES RETURNING id');
      convId = cr[0].id;
      await pool.query(
        'INSERT INTO conversation_members (conversation_id, user_id) VALUES ($1, $2), ($1, $3)',
        [convId, req.user.id, userId]
      );
    }

    const { rows } = await pool.query(`
      SELECT c.id, c.last_message_at,
        peer.id AS peer_id, peer.handle AS peer_handle,
        peer.display_name AS peer_display_name, peer.avatar AS peer_avatar,
        peer.verified AS peer_verified
      FROM conversations c
      JOIN conversation_members cm2 ON cm2.conversation_id = c.id AND cm2.user_id <> $1
      JOIN users peer ON peer.id = cm2.user_id
      WHERE c.id = $2
    `, [req.user.id, convId]);

    const r = rows[0];
    res.status(201).json({
      conversation: {
        id: r.id,
        peer: {
          id: r.peer_id, handle: r.peer_handle,
          displayName: r.peer_display_name, avatar: r.peer_avatar,
          verified: r.peer_verified,
        },
        lastMessage: null,
        unreadCount: 0,
        updatedAt: r.last_message_at,
        createdAt: r.last_message_at,
      },
    });
  } catch (err) { next(err); }
});

router.get('/api/messages/conversations/:id', requireAuth, async (req, res, next) => {
  try {
    const { rows } = await pool.query(`
      SELECT c.id, c.last_message_at,
        peer.id AS peer_id, peer.handle AS peer_handle,
        peer.display_name AS peer_display_name, peer.avatar AS peer_avatar,
        peer.verified AS peer_verified,
        cm.unread_count
      FROM conversations c
      JOIN conversation_members cm ON cm.conversation_id = c.id AND cm.user_id = $1
      JOIN conversation_members cm2 ON cm2.conversation_id = c.id AND cm2.user_id <> $1
      JOIN users peer ON peer.id = cm2.user_id
      WHERE c.id = $2
    `, [req.user.id, req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'not-found' });
    const r = rows[0];
    res.json({
      conversation: {
        id: r.id,
        peer: {
          id: r.peer_id, handle: r.peer_handle,
          displayName: r.peer_display_name, avatar: r.peer_avatar,
          verified: r.peer_verified,
        },
        lastMessage: null,
        unreadCount: r.unread_count || 0,
        updatedAt: r.last_message_at,
        createdAt: r.last_message_at,
      },
    });
  } catch (err) { next(err); }
});

router.get('/api/messages/conversations/:id/messages', requireAuth, async (req, res, next) => {
  try {
    const limit = Math.min(parseInt(req.query.limit || '30', 10), 60);
    const conds = ['conversation_id = $1'];
    const params = [req.params.id];
    let i = 2;
    if (req.query.before) { conds.push(`created_at < $${i++}`); params.push(new Date(req.query.before)); }
    const cur = decodeCursor(req.query.cursor);
    if (cur) { conds.push(`created_at < $${i++}`); params.push(cur.ts); }
    params.push(limit + 1);

    const { rows } = await pool.query(`
      SELECT * FROM messages
      WHERE ${conds.join(' AND ')}
      ORDER BY created_at DESC
      LIMIT $${i}
    `, params);

    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;
    const last = items[items.length - 1];

    res.json({
      items: items.map(r => ({
        id: r.id, conversationId: r.conversation_id,
        senderId: r.sender_id, text: r.text,
        attachment: r.attachment, state: r.state,
        createdAt: r.created_at, readAt: r.read_at,
      })),
      hasMore,
      cursor: hasMore && last ? encodeCursor({ ts: last.created_at, id: last.id }) : null,
    });
  } catch (err) { next(err); }
});

router.post(
  '/api/messages/conversations/:id/messages',
  requireAuth, csrfProtect,
  rateLimit({ max: 30, window: 60 * 1000 }),
  async (req, res, next) => {
    try {
      const { text = '', attachment = null, clientId = null } = req.body || {};
      const cleanText = sanitizeText(text, 4000);
      if (!cleanText && !attachment) return res.status(400).json({ error: 'empty' });

      const convId = req.params.id;
      const member = await pool.query(
        'SELECT 1 FROM conversation_members WHERE conversation_id = $1 AND user_id = $2',
        [convId, req.user.id]
      );
      if (!member.rows.length) return res.status(403).json({ error: 'forbidden' });

      const { rows } = await pool.query(`
        INSERT INTO messages (conversation_id, sender_id, client_id, text, attachment)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
      `, [convId, req.user.id, clientId, cleanText, attachment]);

      await pool.query('UPDATE conversations SET last_message_at = NOW() WHERE id = $1', [convId]);
      await pool.query(
        'UPDATE conversation_members SET unread_count = unread_count + 1 WHERE conversation_id = $1 AND user_id <> $2',
        [convId, req.user.id]
      );

      const msg = rows[0];
      const payload = {
        type: 'message',
        data: {
          id: msg.id, conversationId: msg.conversation_id,
          senderId: msg.sender_id, text: msg.text,
          attachment: msg.attachment, state: msg.state,
          createdAt: msg.created_at, readAt: msg.read_at,
        },
      };
      broadcastToConversation(convId, payload, req.user.id);

      res.status(201).json({
        message: {
          id: msg.id, conversationId: msg.conversation_id,
          senderId: msg.sender_id, text: msg.text,
          attachment: msg.attachment, state: msg.state,
          createdAt: msg.created_at, readAt: msg.read_at,
        },
      });
    } catch (err) { next(err); }
  }
);

router.patch('/api/messages/conversations/:id/read', requireAuth, csrfProtect, async (req, res, next) => {
  try {
    const { upToMessageId } = req.body || {};
    await pool.query(
      'UPDATE conversation_members SET unread_count = 0, last_read_at = NOW() WHERE conversation_id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );
    if (upToMessageId) {
      await pool.query(
        "UPDATE messages SET state = 'read', read_at = NOW() WHERE conversation_id = $1 AND id = $2",
        [req.params.id, upToMessageId]
      );
      broadcastToConversation(req.params.id, {
        type: 'message:read',
        data: { conversationId: req.params.id, upToMessageId },
      }, req.user.id);
    }
    res.json({ ok: true });
  } catch (err) { next(err); }
});

router.delete('/api/messages/conversations/:id/messages/:messageId', requireAuth, csrfProtect, async (req, res, next) => {
  try {
    await pool.query(
      "UPDATE messages SET deleted_by_sender = TRUE, text = '' WHERE id = $1 AND sender_id = $2",
      [req.params.messageId, req.user.id]
    );
    res.json({ ok: true });
  } catch (err) { next(err); }
});

router.patch('/api/messages/conversations/:id/mute', requireAuth, csrfProtect, async (req, res, next) => {
  try {
    await pool.query(
      'UPDATE conversation_members SET muted = $1 WHERE conversation_id = $2 AND user_id = $3',
      [!!req.body.muted, req.params.id, req.user.id]
    );
    res.json({ ok: true });
  } catch (err) { next(err); }
});

router.post('/api/messages/conversations/:id/block', requireAuth, csrfProtect, async (req, res, next) => {
  try {
    await pool.query(
      'UPDATE conversation_members SET blocked = TRUE WHERE conversation_id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );
    res.json({ ok: true });
  } catch (err) { next(err); }
});

router.get('/api/messages/unread-count', requireAuth, async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      'SELECT COALESCE(SUM(unread_count), 0)::int AS n FROM conversation_members WHERE user_id = $1',
      [req.user.id]
    );
    res.json({ count: rows[0]?.n || 0 });
  } catch (err) { next(err); }
});

router.post(
  '/api/messages/upload',
  requireAuth, csrfProtect,
  uploadAttachment.single('file'),
  (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'no-file' });
    res.json({ url: fileToUrl(req.file) });
  }
);

export default router;