/* ============================================================
   خَيال · migrate · إنشاء مخطط القاعدة
   idempotent · آمن للتشغيل المتكرر
   ============================================================ */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool } from '../services.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const schemaPath = path.join(__dirname, 'schema.sql');
const RESET = process.argv.includes('--reset');

async function migrate() {
  // ---- Reset اختياري (للتطوير فقط) ----
  if (RESET) {
    if (process.env.NODE_ENV === 'production' && process.env.ALLOW_DB_RESET !== 'yes') {
      console.error('❌ reset ممنوع في الإنتاج. اضبط ALLOW_DB_RESET=yes للمتابعة.');
      process.exit(1);
    }
    console.info('⚠️  reset: حذف كل الجداول...');
    await pool.query(`
      DROP TABLE IF EXISTS
        messages, conversation_members, conversations,
        reports, notifications, comment_likes, comments,
        follows, saves, save_folders, likes, posts,
        sessions, users
      CASCADE;
      DROP FUNCTION IF EXISTS touch_updated_at() CASCADE;
    `);
    console.info('  ✓ حُذفت');
  }

  // ---- هل المخطط موجود؟ ----
  const { rows } = await pool.query(`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'users'
    ) AS exists
  `);

  if (rows[0].exists && !RESET) {
    console.info('✓ المخطط موجود مسبقاً — لا حاجة للمزيد');
    await pool.end();
    return;
  }

  // ---- نفّذ schema.sql ----
  console.info('🔧 إنشاء المخطط...');
  const sql = fs.readFileSync(schemaPath, 'utf8');

  // pg يقبل عدة أوامر في استدعاء واحد (simple query protocol)
  // طالما لا توجد parameters
  await pool.query(sql);

  console.info('✅ اكتمل المخطط');
  console.info(`   الجداول: users · sessions · posts · likes · saves`);
  console.info(`            follows · comments · comment_likes`);
  console.info(`            notifications · conversations · messages · reports`);

  await pool.end();
}

migrate().catch((err) => {
  console.error('❌ فشل الترحيل:', err.message);
  if (err.code) console.error('   code:', err.code);
  if (err.detail) console.error('   detail:', err.detail);
  process.exit(1);
});