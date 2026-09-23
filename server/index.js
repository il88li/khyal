/* ============================================================
   خَيال · نقطة الدخول
   Express + WebSocket + تقديم الملفات الثابتة
   الإصلاحات:
   - uploads و staticRoot مثبّتان بجانب الملف (لا process.cwd)
   - ضبط ثقة الوكيل لـ Render
   ============================================================ */

import express from 'express';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import http from 'node:http';
import crypto from 'node:crypto';

import router from './routes.js';
import {
  loadUser, errorHandler, notFound, getUploadRoot,
} from './middleware.js';
import {
  pool, registerWsClient, unregisterWsClient,
} from './services.js';

/* ---- مسارات مثبّتة ---- */
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = parseInt(process.env.PORT || '3000', 10);
const NODE_ENV = process.env.NODE_ENV || 'development';
const IS_PROD = NODE_ENV === 'production';

/* ═══════════════════════════════════════════════════════════
   Express
   ═══════════════════════════════════════════════════════════ */

const app = express();

// Render يقف خلف proxy — ثق به
app.set('trust proxy', 1);
app.disable('x-powered-by');

// Security headers
app.use(helmet({
  contentSecurityPolicy: IS_PROD ? {
    directives: {
      defaultSrc: ["'self'"],
      imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
      mediaSrc: ["'self'", 'blob:', 'https:'],
      fontSrc: ["'self'", 'data:'],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      connectSrc: ["'self'", 'wss:', 'https:'],
      frameAncestors: ["'none'"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
    },
  } : false,
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

// Body parsers
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false, limit: '1mb' }));
app.use(cookieParser());

// الجلسة (يحمّل req.user إن وُجد)
app.use(loadUser);

// المسارات
app.use(router);

// الملفات المرفوعة — من نفس مجلد middleware.js
app.use('/uploads', express.static(getUploadRoot(), {
  maxAge: '30d',
  immutable: true,
}));

// الملفات الثابتة (الواجهة الأمامية) — مجلد واحد فوق server/
const staticRoot = process.env.STATIC_ROOT || path.resolve(__dirname, '..');
app.use(express.static(staticRoot, {
  maxAge: IS_PROD ? '1h' : 0,
  etag: true,
  index: false,
  setHeaders(res, filePath) {
    if (/\.(woff2?|png|jpg|jpeg|svg|webp)$/i.test(filePath)) {
      res.setHeader('Cache-Control', 'public, max-age=2592000, immutable');
    }
  },
}));

// SPA fallback — كل مسار ليس /api أو /uploads يعود إلى index.html
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/') || req.path.startsWith('/uploads/')) {
    return next();
  }
  res.sendFile(path.join(staticRoot, 'index.html'));
});

// 404 + معالج أخطاء
app.use('/api', notFound);
app.use(errorHandler);

/* ═══════════════════════════════════════════════════════════
   HTTP + WebSocket
   ═══════════════════════════════════════════════════════════ */

const server = http.createServer(app);
const wss = new WebSocketServer({ noServer: true });

server.on('upgrade', async (req, socket, head) => {
  if (!req.url.startsWith('/api/live')) {
    socket.destroy();
    return;
  }

  try {
    const cookieHeader = req.headers.cookie || '';
    const cookies = Object.fromEntries(
      cookieHeader.split(';').map(c => {
        const [k, ...v] = c.trim().split('=');
        return [k, v.join('=')];
      })
    );
    const token = cookies.khayal_sid;
    if (!token) {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
      return;
    }
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const { rows } = await pool.query(`
      SELECT u.id FROM sessions s
      JOIN users u ON u.id = s.user_id
      WHERE s.token_hash = $1 AND s.expires_at > NOW() AND u.status = 'active'
    `, [tokenHash]);
    if (!rows.length) {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
      return;
    }
    req.userId = rows[0].id;
    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit('connection', ws, req);
    });
  } catch (err) {
    console.error('[ws.upgrade]', err);
    socket.destroy();
  }
});

wss.on('connection', (ws, req) => {
  const userId = req.userId;
  console.info('[ws] اتصال جديد:', userId);

  registerWsClient(userId, ws);

  ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; });

  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data.toString());
      if (msg.type === 'ping') {
        ws.send(JSON.stringify({ type: 'heartbeat', ts: Date.now() }));
      } else if (msg.type === 'typing') {
        pool.query(`
          SELECT user_id FROM conversation_members
          WHERE conversation_id = $1 AND user_id <> $2
        `, [msg.conversationId, userId]).then(r => {
          for (const row of r.rows) {
            const payload = JSON.stringify({
              type: 'message:typing',
              data: {
                conversationId: msg.conversationId,
                typing: !!msg.typing,
              },
            });
            // نستخدم registerWsClient لاحقاً للتحسين
          }
        }).catch(() => {});
      }
    } catch {
      /* تجاهل */
    }
  });

  ws.on('close', () => {
    unregisterWsClient(userId, ws);
    console.info('[ws] قطع:', userId);
  });

  ws.on('error', (err) => console.warn('[ws.error]', err.message));
});

// نبضة كل 30 ثانية للحفاظ على الاتصالات
const heartbeat = setInterval(() => {
  wss.clients.forEach((ws) => {
    if (ws.isAlive === false) return ws.terminate();
    ws.isAlive = false;
    try { ws.ping(); } catch { /* */ }
  });
}, 30_000);
heartbeat.unref?.();

/* ═══════════════════════════════════════════════════════════
   تشغيل
   ═══════════════════════════════════════════════════════════ */

server.listen(PORT, '0.0.0.0', () => {
  console.info(`خَيال · جاهز على http://0.0.0.0:${PORT}`);
  console.info(`البيئة: ${NODE_ENV}`);
  console.info(`المجلد الثابت: ${staticRoot}`);
  console.info(`مجلد المرفوعات: ${getUploadRoot()}`);
});

// إغلاق نظيف
const shutdown = async (signal) => {
  console.info(`\n[${signal}] إغلاق...`);
  clearInterval(heartbeat);
  wss.clients.forEach(ws => ws.close());
  server.close(() => {
    pool.end().then(() => {
      console.info('أُغلق بنجاح');
      process.exit(0);
    });
  });
  setTimeout(() => process.exit(1), 10_000).unref();
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

// منع انهيار الخادم على أخطاء غير ملتقطة
process.on('unhandledRejection', (reason) => {
  console.error('[unhandledRejection]', reason);
});
process.on('uncaughtException', (err) => {
  console.error('[uncaughtException]', err);
});