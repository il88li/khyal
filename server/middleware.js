/* ============================================================
   خَيال · الوسطاء
   auth · csrf · rateLimit · validate · sanitize · upload
   الإصلاح: UPLOAD_ROOT مثبّت بجانب الملف (لا process.cwd)
   ============================================================ */

import crypto from 'node:crypto';
import bcrypt from 'bcrypt';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { pool } from './services.js';

/* ---- مسارات مثبّتة ---- */
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/* ═══════════════════════════════════════════════════════════
   الحساب والجلسة
   ═══════════════════════════════════════════════════════════ */

const SESSION_COOKIE = 'khayal_sid';
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 يوماً

const hashToken = (token) =>
  crypto.createHash('sha256').update(token).digest('hex');

export async function createSession(userId, req, res) {
  const token = crypto.randomBytes(32).toString('hex');
  const csrf = crypto.randomBytes(24).toString('hex');
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  await pool.query(
    `INSERT INTO sessions (user_id, token_hash, csrf_token, user_agent, ip, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [userId, hashToken(token), csrf, req.headers['user-agent'] || '', req.ip, expiresAt]
  );

  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: req.secure || req.headers['x-forwarded-proto'] === 'https',
    sameSite: 'lax',
    maxAge: SESSION_TTL_MS,
    path: '/',
  });

  return { token, csrf, expiresAt };
}

export async function destroySession(req, res) {
  const token = req.cookies?.[SESSION_COOKIE];
  if (token) {
    await pool.query('DELETE FROM sessions WHERE token_hash = $1', [hashToken(token)]);
  }
  res.clearCookie(SESSION_COOKIE, { path: '/' });
}

/** يحمّل المستخدم من الجلسة إن وُجدت (بلا رفض) */
export async function loadUser(req, _res, next) {
  try {
    const token = req.cookies?.[SESSION_COOKIE];
    if (!token) {
      req.user = null;
      req.session = null;
      return next();
    }
    const { rows } = await pool.query(
      `SELECT s.id AS session_id, s.csrf_token, s.expires_at,
              u.*
       FROM sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.token_hash = $1 AND s.expires_at > NOW()
         AND u.status = 'active'`,
      [hashToken(token)]
    );
    if (!rows.length) {
      req.user = null;
      req.session = null;
      return next();
    }
    const row = rows[0];
    req.user = {
      id: row.id,
      handle: row.handle,
      displayName: row.display_name,
      email: row.email,
      avatar: row.avatar,
      cover: row.cover,
      bio: row.bio,
      location: row.location,
      website: row.website,
      accentColor: row.accent_color,
      verified: row.verified,
      role: row.role,
      status: row.status,
      createdAt: row.created_at,
    };
    req.session = { id: row.session_id, csrfToken: row.csrf_token, userId: row.id };
    next();
  } catch (err) {
    next(err);
  }
}

/** يرفض إن لم يكن مسجّلاً */
export function requireAuth(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'unauthorized', message: 'سجّل الدخول للمتابعة' });
  }
  next();
}

/* ═══════════════════════════════════════════════════════════
   CSRF
   ═══════════════════════════════════════════════════════════ */

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export function csrfProtect(req, res, next) {
  if (SAFE_METHODS.has(req.method)) return next();

  const exempt = [
    '/api/account/signup',
    '/api/account/login',
    '/api/csrf',
  ];
  if (exempt.includes(req.path)) return next();

  if (!req.session) {
    return res.status(403).json({ error: 'no-session', message: 'لا توجد جلسة نشطة' });
  }
  const provided = req.headers['x-csrf-token'];
  if (!provided || !crypto.timingSafeEqual(
    Buffer.from(provided),
    Buffer.from(req.session.csrfToken)
  )) {
    return res.status(403).json({ error: 'csrf', message: 'رمز الحماية غير صالح' });
  }
  next();
}

/* ═══════════════════════════════════════════════════════════
   Rate Limiting
   ═══════════════════════════════════════════════════════════ */

const buckets = new Map();
setInterval(() => {
  const now = Date.now();
  for (const [key, b] of buckets) {
    if (now > b.resetAt) buckets.delete(key);
  }
}, 60_000).unref?.();

export function rateLimit(opts = {}) {
  const { max = 60, window: win = 60_000 } = opts;
  return (req, res, next) => {
    const key = opts.key
      ? opts.key(req)
      : `${req.ip}:${req.path}:${req.user?.id || 'anon'}`;
    const now = Date.now();
    let b = buckets.get(key);
    if (!b || now > b.resetAt) {
      b = { count: 0, resetAt: now + win };
      buckets.set(key, b);
    }
    b.count += 1;
    res.setHeader('X-RateLimit-Limit', String(max));
    res.setHeader('X-RateLimit-Remaining', String(Math.max(0, max - b.count)));
    if (b.count > max) {
      const retryAfter = Math.ceil((b.resetAt - now) / 1000);
      res.setHeader('Retry-After', String(retryAfter));
      return res.status(429).json({
        error: 'rate-limit',
        message: 'طلبات كثيرة — انتظر قليلاً',
        retryAfter: retryAfter * 1000,
      });
    }
    next();
  };
}

/* ═══════════════════════════════════════════════════════════
   Sanitize + Validate
   ═══════════════════════════════════════════════════════════ */

export function sanitizeText(input, maxLen = 4000) {
  if (input == null) return '';
  let s = String(input).slice(0, maxLen);
  s = s.replace(/[\u0000-\u0008\u000B-\u001F\u007F]/g, '');
  s = s.replace(/<\/?[^>]+(>|$)/g, '');
  return s.trim();
}

export function sanitizeUrl(input) {
  if (!input) return null;
  const s = String(input).trim();
  if (s.startsWith('/') && !s.startsWith('//')) return s;
  try {
    const u = new URL(s);
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.toString() : null;
  } catch {
    return null;
  }
}

export const validators = {
  handle: (v) => {
    const s = String(v || '').trim().replace(/^@/, '').toLowerCase();
    if (!/^[a-z0-9_.]{3,30}$/.test(s)) return { ok: false, error: 'المعرّف: 3-30 حرفاً لاتينياً' };
    if (/^[_.]|[_.]$/.test(s)) return { ok: false, error: 'لا يبدأ أو ينتهي بـ _ أو .' };
    return { ok: true, value: s };
  },
  displayName: (v) => {
    const s = String(v || '').trim().replace(/\s+/g, ' ');
    if (s.length < 2 || s.length > 60) return { ok: false, error: 'الاسم: من حرفين إلى 60' };
    return { ok: true, value: s };
  },
  email: (v) => {
    const s = String(v || '').trim().toLowerCase();
    if (!/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i.test(s) || s.length > 254)
      return { ok: false, error: 'صيغة البريد غير صحيحة' };
    return { ok: true, value: s };
  },
  password: (v) => {
    const s = String(v || '');
    if (s.length < 8 || s.length > 128) return { ok: false, error: 'كلمة المرور: 8-128 حرفاً' };
    if (!/[A-Za-z]/.test(s) || !/\d/.test(s)) return { ok: false, error: 'يجب أن تحتوي على حرف ورقم' };
    return { ok: true, value: s };
  },
  title: (v) => {
    const s = String(v || '').trim();
    if (!s) return { ok: false, error: 'العنوان مطلوب' };
    if (s.length > 200) return { ok: false, error: 'العنوان: 200 حرفاً كحد أقصى' };
    return { ok: true, value: s };
  },
  prompt: (v) => {
    const s = String(v || '').trim();
    if (!s) return { ok: false, error: 'البرومبت مطلوب' };
    if (s.length > 4000) return { ok: false, error: 'البرومبت: 4000 حرفاً كحد أقصى' };
    return { ok: true, value: s };
  },
  commentText: (v) => {
    const s = String(v || '').trim();
    if (!s) return { ok: false, error: 'التعليق فارغ' };
    if (s.length > 2000) return { ok: false, error: 'التعليق: 2000 حرفاً كحد أقصى' };
    return { ok: true, value: s };
  },
  messageText: (v) => {
    const s = String(v || '').trim();
    if (!s) return { ok: false, error: 'الرسالة فارغة' };
    if (s.length > 4000) return { ok: false, error: 'الرسالة: 4000 حرفاً كحد أقصى' };
    return { ok: true, value: s };
  },
  tag: (v) => {
    const s = String(v || '').trim().toLowerCase().replace(/^#/, '').replace(/\s+/g, '-');
    if (!/^[\p{L}\p{N}_-]{1,30}$/u.test(s)) return { ok: false, error: 'الوسم غير صالح' };
    return { ok: true, value: s };
  },
  tags: (v) => {
    if (!Array.isArray(v)) return { ok: true, value: [] };
    const out = [];
    for (const t of v) {
      const r = validators.tag(t);
      if (r.ok && !out.includes(r.value)) out.push(r.value);
      if (out.length >= 12) break;
    }
    return { ok: true, value: out };
  },
  uuid: (v) => {
    const s = String(v || '').trim();
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s))
      return { ok: false, error: 'المعرّف غير صالح' };
    return { ok: true, value: s };
  },
};

export function validateBody(schema, opts = {}) {
  return (req, _res, next) => {
    const out = {};
    const input = req.body || {};
    for (const [field, fn] of Object.entries(schema)) {
      const v = input[field];
      if (opts.partial && (v === undefined || v === null || v === '')) continue;
      const r = fn(v);
      if (!r.ok) {
        const err = new Error(r.error);
        err.status = 422;
        err.field = field;
        return next(err);
      }
      out[field] = r.value;
    }
    req.clean = out;
    next();
  };
}

/* ═══════════════════════════════════════════════════════════
   رفع الملفات — المسار مثبّت بجانب middleware.js
   ═══════════════════════════════════════════════════════════ */

const UPLOAD_ROOT =
  process.env.UPLOAD_ROOT ||
  path.resolve(__dirname, 'uploads');

if (!fs.existsSync(UPLOAD_ROOT)) fs.mkdirSync(UPLOAD_ROOT, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const now = new Date();
    const sub = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}`;
    const dir = path.join(UPLOAD_ROOT, sub);
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).slice(0, 8).toLowerCase() ||
      (file.mimetype.startsWith('image/') ? '.jpg' : '.bin');
    const id = crypto.randomBytes(12).toString('hex');
    cb(null, `${Date.now()}-${id}${ext}`);
  },
});

const ALLOWED_IMAGE = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const ALLOWED_ATTACH = new Set([
  ...ALLOWED_IMAGE,
  'video/mp4', 'video/webm',
  'application/pdf',
]);

export const uploadImage = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_IMAGE.has(file.mimetype)) {
      const err = new Error('صيغة الصورة غير مدعومة');
      err.status = 415;
      return cb(err);
    }
    cb(null, true);
  },
});

export const uploadAttachment = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_ATTACH.has(file.mimetype)) {
      const err = new Error('صيغة الملف غير مدعومة');
      err.status = 415;
      return cb(err);
    }
    cb(null, true);
  },
});

/** يحوّل مسار الملف إلى URL عام */
export function fileToUrl(file) {
  const rel = path.relative(UPLOAD_ROOT, file.path).split(path.sep).join('/');
  return `/uploads/${rel}`;
}

/** يُستخدم في index.js لتحديد مسار المجلد */
export function getUploadRoot() {
  return UPLOAD_ROOT;
}

/* ═══════════════════════════════════════════════════════════
   معالجة الأخطاء
   ═══════════════════════════════════════════════════════════ */

export function errorHandler(err, req, res, _next) {
  const status = err.status || err.statusCode || 500;
  if (status >= 500) {
    console.error('[error]', req.method, req.path, err);
  }
  res.status(status).json({
    error: err.code || (status >= 500 ? 'server-error' : 'client-error'),
    message: err.message || 'حدث خطأ غير متوقع',
    field: err.field || undefined,
  });
}

export function notFound(_req, res) {
  res.status(404).json({ error: 'not-found', message: 'المسار غير موجود' });
}