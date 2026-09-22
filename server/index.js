/* ============================================================
   خَيال · نقطة الدخول
   Express + WebSocket + تقديم الملفات الثابتة
   ============================================================ */

import express from 'express';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import http from 'node:http';

import router from './routes.js';
import {
  loadUser, errorHandler, notFound,
} from './middleware.js';
import {
  pool, registerWsClient, unregisterWsClient,
} from './services.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = parseInt(process.env.PORT || '3000', 10);
const NODE_ENV = process.env.NODE_ENV || 'development';
const IS_PROD = NODE_ENV === 'production';

/* ═══════════════════════════════════════════════════════════
   Express
   ═══════════════════════════════════════════════════════════ */

const app = express();

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

// الجلسة
app.use(loadUser);

// الطلبات
app.use(router);

// الملفات المرفوعة
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads'), {
  maxAge: '30d',
  immutable: true,
}));

// الملفات الثابتة (الواجهة الأمامية)
const staticRoot = process.env.STATIC_ROOT || path.resolve(process.cwd(), '..');
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

// SPA fallback — كل ما ليس /api أو /uploads يعود إلى index.html
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

  // استخرج الجلسة من الكوكي
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
    const crypto = await import('node:crypto');
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

  // نبضة دورية للحفاظ على الاتصال
  ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; });

  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data.toString());
      // رسائل العميل المدعومة: ping · typing
      if (msg.type === 'ping') {
        ws.send(JSON.stringify({ type: 'heartbeat', ts: Date.now() }));
      } else if (msg.type === 'typing') {
        // أعد بثّ للطرف الآخر
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
            // pushToUser مستوردة لكن بلا حاجة هنا
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

// نبضة كل 30 ثانية
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

server.listen(PORT, () => {
  console.info(`خَيال · جاهز على http://localhost:${PORT}`);
  console.info(`البيئة: ${NODE_ENV}`);
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