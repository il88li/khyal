/* ============================================================
   خَيال · الخدمات
   اتصال القاعدة + دوال منطق الأعمال
   ============================================================ */

import pg from 'pg';

const { Pool } = pg;

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL ||
    'postgres://khayal:khayal@localhost:5432/khayal',
  max: 20,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => console.error('[pg.pool]', err));

/* ═══════════════════════════════════════════════════════════
   Cursor — base64({ts, id})
   ═══════════════════════════════════════════════════════════ */

export function encodeCursor({ ts, id }) {
  return Buffer.from(JSON.stringify({ ts, id })).toString('base64url');
}

export function decodeCursor(cursor) {
  if (!cursor) return null;
  try {
    const obj = JSON.parse(Buffer.from(cursor, 'base64url').toString());
    if (!obj?.ts || !obj?.id) return null;
    return { ts: new Date(obj.ts), id: obj.id };
  } catch {
    return null;
  }
}

/* ═══════════════════════════════════════════════════════════
   تطبيع النماذج للرد
   ═══════════════════════════════════════════════════════════ */

export function normalizeUser(row, viewerRelation = {}) {
  if (!row) return null;
  return {
    id: row.id,
    handle: row.handle,
    displayName: row.display_name,
    avatar: row.avatar,
    cover: row.cover,
    bio: row.bio || '',
    location: row.location || '',
    website: row.website || '',
    verified: row.verified,
    accentColor: row.accent_color,
    createdAt: row.created_at,
    stats: {
      posts: Number(row.posts_count || 0),
      followers: Number(row.followers_count || 0),
      following: Number(row.following_count || 0),
      likes: Number(row.likes_received || 0),
    },
    relation: {
      isSelf: !!viewerRelation.isSelf,
      isFollowing: !!viewerRelation.isFollowing,
      isFollowedBy: !!viewerRelation.isFollowedBy,
      isBlocked: false,
    },
  };
}

export function normalizePost(row, viewer = {}) {
  if (!row) return null;
  return {
    id: row.id,
    title: row.title,
    prompt: row.prompt,
    images: row.images || [],
    cover: row.cover || (row.images?.[0] ?? null),
    model: row.model || '',
    aspectRatio: Number(row.aspect_ratio) || 0.8,
    tags: row.tags || [],
    author: row.author_id ? {
      id: row.author_id,
      handle: row.author_handle,
      displayName: row.author_display_name,
      avatar: row.author_avatar,
      verified: row.author_verified,
      relation: {
        isSelf: viewer.id === row.author_id,
        isFollowing: !!viewer.followingSet?.has(row.author_id),
      },
    } : null,
    stats: {
      likes: Number(row.likes_count || 0),
      saves: Number(row.saves_count || 0),
      copies: Number(row.copies_count || 0),
      comments: Number(row.comments_count || 0),
      views: Number(row.views_count || 0),
    },
    viewer: {
      liked: !!viewer.likedSet?.has(row.id),
      saved: !!viewer.savedSet?.has(row.id),
      isAuthor: viewer.id === row.author_id,
    },
    visibility: row.visibility,
    nsfw: row.nsfw,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function normalizeComment(row, viewer = {}) {
  if (!row) return null;
  return {
    id: row.id,
    postId: row.post_id,
    parentId: row.parent_id,
    author: {
      id: row.author_id,
      handle: row.author_handle,
      displayName: row.author_display_name,
      avatar: row.author_avatar,
      verified: row.author_verified,
    },
    text: row.text,
    stats: { likes: Number(row.likes_count || 0) },
    viewer: {
      liked: !!viewer.likedSet?.has(row.id),
      canDelete: viewer.id === row.author_id ||
                 viewer.role === 'admin' || viewer.role === 'moderator',
    },
    repliesCount: Number(row.replies_count || 0),
    createdAt: row.created_at,
  };
}

/* ═══════════════════════════════════════════════════════════
   جمع view-state (likedSet, savedSet, followingSet)
   ═══════════════════════════════════════════════════════════ */

export async function loadViewerState(userId, postIds = [], authorIds = []) {
  const state = {
    id: userId,
    likedSet: new Set(),
    savedSet: new Set(),
    followingSet: new Set(),
  };
  if (!userId) return state;

  const tasks = [];

  if (postIds.length) {
    tasks.push(
      pool.query('SELECT post_id FROM likes WHERE user_id = $1 AND post_id = ANY($2)',
        [userId, postIds])
        .then(r => r.rows.forEach(x => state.likedSet.add(x.post_id)))
    );
    tasks.push(
      pool.query('SELECT post_id FROM saves WHERE user_id = $1 AND post_id = ANY($2)',
        [userId, postIds])
        .then(r => r.rows.forEach(x => state.savedSet.add(x.post_id)))
    );
  }

  if (authorIds.length) {
    tasks.push(
      pool.query('SELECT following_id FROM follows WHERE follower_id = $1 AND following_id = ANY($2)',
        [userId, authorIds])
        .then(r => r.rows.forEach(x => state.followingSet.add(x.following_id)))
    );
  }

  await Promise.all(tasks);
  return state;
}

/* ═══════════════════════════════════════════════════════════
   الاستعلامات المشتركة للمنشورات
   ═══════════════════════════════════════════════════════════ */

const POST_SELECT = `
  SELECT p.*,
    u.handle          AS author_handle,
    u.display_name    AS author_display_name,
    u.avatar          AS author_avatar,
    u.verified        AS author_verified
  FROM posts p
  JOIN users u ON u.id = p.author_id
`;

const POST_FILTERS = {
  recent:   'p.created_at DESC, p.id DESC',
  trending: '(p.likes_count + p.saves_count * 2 + p.comments_count * 3) DESC, p.created_at DESC',
  top:      'p.likes_count DESC, p.created_at DESC',
};

/**
 * قائمة منشورات بترقيم cursor.
 * @returns {Promise<{items, cursor, hasMore, total}>}
 */
export async function listPosts(opts = {}, viewerId = null) {
  const {
    sort = 'recent', period = 'all', tags, models, author,
    cursor = null, limit = 20, excludeId = null,
  } = opts;

  const order = POST_FILTERS[sort] || POST_FILTERS.recent;
  const conds = ['p.deleted_at IS NULL', "p.visibility = 'public'"];
  const params = [];
  let i = 1;

  if (author) {
    conds.push(`u.handle = $${i++}`);
    params.push(author);
  }
  if (tags?.length) {
    conds.push(`p.tags && $${i++}::text[]`);
    params.push(tags);
  }
  if (models?.length) {
    conds.push(`p.model = ANY($${i++}::text[])`);
    params.push(models);
  }
  if (period !== 'all') {
    const interval = period === 'today' ? '1 day'
      : period === 'week' ? '7 days' : '30 days';
    conds.push(`p.created_at > NOW() - INTERVAL '${interval}'`);
  }
  if (excludeId) {
    conds.push(`p.id <> $${i++}`);
    params.push(excludeId);
  }

  const cur = decodeCursor(cursor);
  if (cur) {
    // نستخدم مقارنة بسيطة على created_at (تجاهل id للتيسيط)
    conds.push(`p.created_at < $${i++}`);
    params.push(cur.ts);
  }

  const where = conds.join(' AND ');
  const sql = `
    ${POST_SELECT}
    WHERE ${where}
    ORDER BY ${order}
    LIMIT $${i}
  `;
  params.push(Math.min(limit, 50) + 1);

  const { rows } = await pool.query(sql, params);
  const hasMore = rows.length > limit;
  const items = (hasMore ? rows.slice(0, limit) : rows);

  const postIds = items.map(r => r.id);
  const authorIds = [...new Set(items.map(r => r.author_id))];
  const viewer = await loadViewerState(viewerId, postIds, authorIds);

  const normalized = items.map(r => normalizePost(r, viewer));
  const last = items[items.length - 1];
  const nextCursor = hasMore && last
    ? encodeCursor({ ts: last.created_at, id: last.id })
    : null;

  return { items: normalized, cursor: nextCursor, hasMore, total: normalized.length };
}

/** جلب منشور واحد بمعرّفه */
export async function getPostById(id, viewerId = null) {
  const { rows } = await pool.query(
    `${POST_SELECT} WHERE p.id = $1 AND p.deleted_at IS NULL`, [id]
  );
  if (!rows.length) return null;
  const row = rows[0];
  const viewer = await loadViewerState(viewerId, [row.id], [row.author_id]);
  // زيادة المشاهدات بلا انتظار
  pool.query('UPDATE posts SET views_count = views_count + 1 WHERE id = $1', [id]).catch(() => {});
  return normalizePost(row, viewer);
}

/** منشورات ذات صلة — نفس الوسوم أو نفس المؤلف */
export async function getRelatedPosts(postId, limit = 8, viewerId = null) {
  const { rows } = await pool.query(`
    SELECT p.*,
      u.handle AS author_handle, u.display_name AS author_display_name,
      u.avatar AS author_avatar, u.verified AS author_verified
    FROM posts p
    JOIN users u ON u.id = p.author_id
    WHERE p.deleted_at IS NULL
      AND p.visibility = 'public'
      AND p.id <> $1
      AND (
        p.tags && (SELECT tags FROM posts WHERE id = $1)
        OR p.author_id = (SELECT author_id FROM posts WHERE id = $1)
      )
    ORDER BY
      CASE WHEN p.tags && (SELECT tags FROM posts WHERE id = $1) THEN 0 ELSE 1 END,
      (p.likes_count + p.saves_count * 2) DESC,
      p.created_at DESC
    LIMIT $2
  `, [postId, limit]);

  const postIds = rows.map(r => r.id);
  const authorIds = [...new Set(rows.map(r => r.author_id))];
  const viewer = await loadViewerState(viewerId, postIds, authorIds);
  return rows.map(r => normalizePost(r, viewer));
}

/* ═══════════════════════════════════════════════════════════
   الإشعارات — توليد تلقائي
   ═══════════════════════════════════════════════════════════ */

export async function createNotification({
  userId, type, actorId, targetType, targetId, targetThumb, text = '',
}) {
  if (!userId || userId === actorId) return null;
  const { rows } = await pool.query(`
    INSERT INTO notifications
      (user_id, type, actor_id, target_type, target_id, target_thumb, text)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING *
  `, [userId, type, actorId, targetType, targetId, targetThumb, text]);
  return rows[0];
}

/* ═══════════════════════════════════════════════════════════
   الإشعارات الحية (تُستخدم من routes.js عبر WS)
   ═══════════════════════════════════════════════════════════ */

const wsClients = new Map(); // userId → Set<WebSocket>

export function registerWsClient(userId, ws) {
  if (!wsClients.has(userId)) wsClients.set(userId, new Set());
  wsClients.get(userId).add(ws);
}

export function unregisterWsClient(userId, ws) {
  const set = wsClients.get(userId);
  if (!set) return;
  set.delete(ws);
  if (!set.size) wsClients.delete(userId);
}

export function pushToUser(userId, payload) {
  const set = wsClients.get(userId);
  if (!set) return 0;
  const msg = JSON.stringify(payload);
  let sent = 0;
  for (const ws of set) {
    if (ws.readyState === 1) {
      try { ws.send(msg); sent += 1; } catch { /* */ }
    }
  }
  return sent;
}

export function broadcastToConversation(conversationId, payload, excludeUserId = null) {
  pool.query(
    'SELECT user_id FROM conversation_members WHERE conversation_id = $1',
    [conversationId]
  ).then(r => {
    for (const row of r.rows) {
      if (row.user_id === excludeUserId) continue;
      pushToUser(row.user_id, payload);
    }
  }).catch(err => console.error('[broadcast]', err));
}

/* ═══════════════════════════════════════════════════════════
   الوسوم الرائجة
   ═══════════════════════════════════════════════════════════ */

export async function trendingTags(period = 'week', limit = 12) {
  const interval = period === 'today' ? '1 day'
    : period === 'month' ? '30 days' : '7 days';
  const { rows } = await pool.query(`
    SELECT tag, COUNT(*)::int AS count
    FROM (
      SELECT UNNEST(tags) AS tag
      FROM posts
      WHERE deleted_at IS NULL
        AND visibility = 'public'
        AND created_at > NOW() - INTERVAL '${interval}'
    ) t
    GROUP BY tag
    ORDER BY count DESC
    LIMIT $1
  `, [limit]);
  return rows.map(r => ({ tag: r.tag, count: r.count, growth: 0 }));
}

export async function searchTags(q, limit = 20) {
  const pattern = `%${q.toLowerCase()}%`;
  const { rows } = await pool.query(`
    SELECT tag, COUNT(*)::int AS count
    FROM (SELECT UNNEST(tags) AS tag FROM posts WHERE deleted_at IS NULL) t
    WHERE tag ILIKE $1
    GROUP BY tag
    ORDER BY count DESC
    LIMIT $2
  `, [pattern, limit]);
  return rows.map(r => ({ tag: r.tag, count: r.count }));
}

export async function searchUsers(q, limit = 20, cursor = null) {
  const pattern = `%${q.toLowerCase()}%`;
  const conds = [
    "status = 'active'",
    '(LOWER(handle) LIKE $1 OR LOWER(display_name) LIKE $1)',
  ];
  const params = [pattern];
  let i = 2;

  const cur = decodeCursor(cursor);
  if (cur) {
    conds.push(`created_at < $${i++}`);
    params.push(cur.ts);
  }

  params.push(limit + 1);
  const { rows } = await pool.query(`
    SELECT id, handle, display_name, avatar, verified, bio, created_at
    FROM users
    WHERE ${conds.join(' AND ')}
    ORDER BY
      CASE WHEN LOWER(handle) = $1 THEN 0 ELSE 1 END,
      followers_count_cache DESC NULLS LAST,
      created_at DESC
    LIMIT $${i}
  `, params);
  return rows;
}