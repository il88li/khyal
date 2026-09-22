/* ============================================================
   خَيال · بيانات اختبار
   يُشغَّل بعد migrate: node db/seed.js
   ============================================================ */

import bcrypt from 'bcrypt';
import { pool } from '../services.js';

/* ---- صور SVG مضمّنة — تعمل بلا شبكة ---- */
const svg = (c1, c2) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 500"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient></defs><rect fill="url(#g)" width="400" height="500"/></svg>`
)}`;

const COLORS = [
  ['#786cef', '#1a1543'], ['#ea8a5c', '#9d4e31'],
  ['#1e9166', '#106244'], ['#d97706', '#924f04'],
  ['#3b6ff5', '#2449a8'], ['#dc3e3e', '#972828'],
  ['#56515f', '#17161a'], ['#9790f3', '#3a309e'],
];

const POSTS_DATA = [
  { title: 'امرأة ترتدي عباءة في صحراء الغسق', model: 'Midjourney', tags: ['portrait','fantasy'], prompt: 'a woman in flowing abaya, desert dunes at dusk, cinematic lighting, portrait orientation, golden hour, soft rim light, shallow depth of field, kodak portra film, hyper detailed, 8k' },
  { title: 'معمار مستقبلي في الصحراء العربية', model: 'DALL·E 3', tags: ['architecture','scifi'], prompt: 'futuristic architecture, middle eastern desert, curved organic forms, sunset, reflective glass, isometric view, minimalistic, concrete and copper, brutalist influences, high contrast' },
  { title: 'مدينة عائمة على السحاب', model: 'Stable Diffusion', tags: ['scifi','landscape'], prompt: 'floating city above the clouds, cyberpunk arabic architecture, neon accents, aerial view, epic scale, volumetric lighting, dark ambient, photorealistic' },
  { title: 'بورتريه بلا ملامح', model: 'Flux', tags: ['portrait','minimal'], prompt: 'faceless portrait, abstract human form, minimalist, warm earth tones, film grain, medium format camera, studio lighting, matte finish' },
  { title: 'بستان نخيل في الضباب', model: 'Midjourney', tags: ['landscape','nature'], prompt: 'palm grove in morning mist, dense fog, soft diffused light, tranquil, muted color palette, hasselblad medium format, gentle gradient, cinematic' },
  { title: 'مخطوطة عربية ذهبية', model: 'Adobe Firefly', tags: ['art','traditional'], prompt: 'arabic calligraphy manuscript, gold leaf on dark leather, intricate geometric borders, aging parchment, dramatic side light, museum quality photo' },
  { title: 'روبوت في زي عربي تقليدي', model: 'Leonardo', tags: ['scifi','portrait'], prompt: 'humanoid robot wearing traditional arabic clothing, thobe and ghutra, studio portrait, neutral background, metallic skin, sleek, hyperreal' },
  { title: 'باب نجدي قديم', model: 'Midjourney', tags: ['architecture','traditional'], prompt: 'old najdi door, weathered wood, geometric carvings, warm terracotta wall, morning light, documentary photography, fujifilm classic chrome, sharp detail' },
  { title: 'شجرة وحيدة على تلة', model: 'Stable Diffusion', tags: ['landscape','minimal'], prompt: 'single tree on a hill, minimalist landscape, soft morning light, pastel sky, negative space, film photography aesthetic, kodak ektar' },
  { title: 'نافورة في صحن المسجد', model: 'DALL·E 3', tags: ['architecture','spiritual'], prompt: 'fountain in the courtyard of a mosque, marble floor, geometric tiles, call to prayer time, warm light, wide angle, cinematic, hyper detailed' },
  { title: 'أطلال مدينة قديمة', model: 'Flux', tags: ['landscape','history'], prompt: 'ancient city ruins, sand, broken columns, dust in the air, late afternoon, wide angle, muted palette, natural light, epic scale' },
  { title: 'فتاة تقرأ القرآن', model: 'Midjourney', tags: ['portrait','spiritual'], prompt: 'young girl reading quran, soft window light, minimalist interior, warm tones, quiet moment, shallow depth of field, medium format, kodak portra 400' },
  { title: 'غروب على الخليج', model: 'Midjourney', tags: ['landscape','water'], prompt: 'sunset over gulf, dhows sailing, warm orange sky, calm water, silhouette, minimal, cinematic, long exposure' },
  { title: 'قنديل معلق في فراغ', model: 'Stable Diffusion', tags: ['object','minimal'], prompt: 'hanging lantern, empty dark space, single point light, reflection, minimal composition, still life, hyper detailed, 8k' },
  { title: 'خيل عربية في الصحراء', model: 'DALL·E 3', tags: ['animal','landscape'], prompt: 'arabian horse, desert dunes, sunset, gold light, dust kicked up, dynamic pose, cinematic composition, shallow depth' },
  { title: 'مقهى قديم في زقاق', model: 'Adobe Firefly', tags: ['architecture','life'], prompt: 'old coffee shop in narrow alley, arabic signage, warm interior glow, evening, quiet street, documentary photo, kodak portra, film grain' },
  { title: 'طائرة ورقية فوق سطح', model: 'Midjourney', tags: ['life','minimal'], prompt: 'paper kite over rooftop, blue sky, minimal, one cloud, single subject, warm afternoon, kodak ektar, 35mm film' },
  { title: 'مرآة في غرفة مهجورة', model: 'Flux', tags: ['interior','mood'], prompt: 'mirror in abandoned room, peeling wallpaper, dust in light beam, moody, cinematic, wide angle, quiet horror aesthetic, kodak portra' },
];

/* ---- مستخدمون ---- */
const USERS_DATA = [
  { handle: 'noor',     displayName: 'نور العمري',       email: 'noor@khayal.test',     bio: 'مصممة بصرية · أستكشف حدود الذكاء الاصطناعي في السرد البصري العربي' },
  { handle: 'salma',    displayName: 'سلمى الحربي',      email: 'salma@khayal.test',    bio: 'فنانة رقمية · أهتم بالمعمار التقليدي والحديث' },
  { handle: 'kareem',   displayName: 'كريم الدوسري',     email: 'kareem@khayal.test',   bio: 'مخرج سينمائي · أبحث عن الصورة التي تحكي قصة' },
  { handle: 'lina',     displayName: 'لينا عوض',          email: 'lina@khayal.test',     bio: 'كاتبة ورسامة · أحب الفانتازيا العربية' },
  { handle: 'yousef',   displayName: 'يوسف المهنا',      email: 'yousef@khayal.test',   bio: 'مصوّر فوتوغرافي · أهتم بالضوء والظل' },
  { handle: 'hala',     displayName: 'هالة القحطاني',    email: 'hala@khayal.test',     bio: 'رسامة رقمية · أستكشف البورتريه' },
  { handle: 'rawan',    displayName: 'روان الشمري',      email: 'rawan@khayal.test',    bio: 'طالبة تصميم · أتعلم وأشارك كل يوم' },
  { handle: 'fahad',    displayName: 'فهد المطيري',      email: 'fahad@khayal.test',    bio: 'مهتم بالمعمار والفراغات' },
];

/* ═══════════════════════════════════════════════════════════
   التنفيذ
   ═══════════════════════════════════════════════════════════ */

const rand = (arr) => arr[Math.floor(Math.random() * arr.length)];
const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const pick = (arr, n) => [...arr].sort(() => Math.random() - 0.5).slice(0, n);

async function seed() {
  console.info('🌱 بدء البيانات الاختبارية...');

  // 1) تحقق إن كان هناك بيانات
  const { rows: existing } = await pool.query('SELECT COUNT(*)::int AS n FROM users');
  if (existing[0].n > 0) {
    console.info('⚠️  توجد بيانات مسبقاً. للتشغيل من الصفر:');
    console.info('   TRUNCATE users, posts, comments, likes, saves, follows CASCADE;');
    console.info('   ثم أعد تشغيل seed.');
    process.exit(0);
  }

  // 2) المستخدمون
  const passwordHash = await bcrypt.hash('password123', 12);
  const users = [];
  for (const u of USERS_DATA) {
    const { rows } = await pool.query(`
      INSERT INTO users (handle, display_name, email, password_hash, bio, verified, avatar)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id, handle
    `, [
      u.handle, u.displayName, u.email, passwordHash, u.bio,
      ['noor', 'kareem', 'salma'].includes(u.handle),
      svg(rand(COLORS)[0], rand(COLORS)[1]),
    ]);
    users.push(rows[0]);
    console.info(`  ✓ مستخدم: @${u.handle}`);
  }

  // 3) المتابعات
  for (const u of users) {
    const others = users.filter(x => x.id !== u.id);
    const follows = pick(others, randInt(2, 5));
    for (const f of follows) {
      await pool.query(
        'INSERT INTO follows (follower_id, following_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [u.id, f.id]
      );
    }
  }
  console.info(`  ✓ متابعات`);

  // 4) المنشورات
  const posts = [];
  for (const p of POSTS_DATA) {
    const author = rand(users);
    const colors = pick(COLORS, randInt(1, 2));
    const images = colors.map(c => svg(c[0], c[1]));
    const createdAt = new Date(Date.now() - randInt(0, 30) * 86400000 - randInt(0, 86400000));

    const { rows } = await pool.query(`
      INSERT INTO posts
        (author_id, title, prompt, images, cover, model, tags, aspect_ratio, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING id
    `, [
      author.id, p.title, p.prompt, images, images[0], p.model, p.tags, 0.8, createdAt,
    ]);
    posts.push(rows[0]);
    console.info(`  ✓ منشور: ${p.title.slice(0, 40)}`);
  }

  // 5) الإعجابات
  let likeCount = 0;
  for (const post of posts) {
    const likers = pick(users, randInt(1, users.length));
    for (const u of likers) {
      const r = await pool.query(
        'INSERT INTO likes (user_id, post_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [u.id, post.id]
      );
      if (r.rowCount) likeCount += 1;
    }
  }
  await pool.query(`
    UPDATE posts SET likes_count = (SELECT COUNT(*) FROM likes WHERE post_id = posts.id)
  `);
  console.info(`  ✓ ${likeCount} إعجاب`);

  // 6) المحفوظات
  let saveCount = 0;
  for (const post of posts) {
    const savers = pick(users, randInt(0, 3));
    for (const u of savers) {
      const r = await pool.query(
        'INSERT INTO saves (user_id, post_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [u.id, post.id]
      );
      if (r.rowCount) saveCount += 1;
    }
  }
  await pool.query(`
    UPDATE posts SET saves_count = (SELECT COUNT(*) FROM saves WHERE post_id = posts.id)
  `);
  console.info(`  ✓ ${saveCount} حفظ`);

  // 7) التعليقات
  const COMMENTS = [
    'عمل رائع، مذهل التفاصيل!',
    'البرومبت موفق — سأنسخه وأجربه',
    'الإضاءة هنا مثالية',
    'أحب هذا التكوين',
    'ما الموديل بالضبط؟',
    'أعدتَ للأذهان جمال الفن العربي',
    'من أين الإلهام؟',
    'استمر، عمل يستحق المتابعة',
    'التدرج اللوني بديع',
    'كأنها لوحة من القرن الماضي',
  ];
  let commentCount = 0;
  for (const post of posts) {
    const n = randInt(1, 4);
    for (let i = 0; i < n; i++) {
      const author = rand(users);
      await pool.query(
        'INSERT INTO comments (post_id, author_id, text) VALUES ($1, $2, $3)',
        [post.id, author.id, rand(COMMENTS)]
      );
      commentCount += 1;
    }
  }
  await pool.query(`
    UPDATE posts SET comments_count = (SELECT COUNT(*) FROM comments WHERE post_id = posts.id AND deleted_at IS NULL)
  `);
  console.info(`  ✓ ${commentCount} تعليق`);

  // 8) نسخ
  await pool.query(`
    UPDATE posts SET copies_count = FLOOR(RANDOM() * 200)::int
  `);
  await pool.query(`
    UPDATE posts SET views_count = FLOOR(RANDOM() * 2000)::int
  `);

  // 9) محادثة اختبارية
  const me = users[0], peer = users[1];
  const { rows: conv } = await pool.query('INSERT INTO conversations DEFAULT VALUES RETURNING id');
  await pool.query(
    'INSERT INTO conversation_members (conversation_id, user_id) VALUES ($1, $2), ($1, $3)',
    [conv[0].id, me.id, peer.id]
  );
  const msgs = [
    [me.id, 'أهلاً سلمى، أعجبني آخر منشور لك!'],
    [peer.id, 'شكراً نور، سعيد أنه أعجبك 🙏'],
    [me.id, 'كيف حصلت على ذلك التدرج اللوني؟'],
    [peer.id, 'استخدمت Flux مع برومبت طويل جداً'],
  ];
  for (const [sender, text] of msgs) {
    await pool.query(`
      INSERT INTO messages (conversation_id, sender_id, text)
      VALUES ($1, $2, $3)
    `, [conv[0].id, sender, text]);
  }
  console.info(`  ✓ محادثة اختبارية`);

  // 10) إشعارات اختبارية
  await pool.query(`
    INSERT INTO notifications (user_id, type, actor_id, target_type, target_id, target_thumb, text, unread, created_at)
    SELECT $1, 'like', $2, 'post', p.id, p.cover, '', TRUE, NOW() - INTERVAL '10 minutes'
    FROM posts p LIMIT 3
  `, [me.id, peer.id]);
  await pool.query(`
    INSERT INTO notifications (user_id, type, actor_id, target_type, target_id, text, unread, created_at)
    VALUES ($1, 'follow', $2, 'user', $2, '', TRUE, NOW() - INTERVAL '2 hours')
  `, [me.id, users[2].id]);

  console.info('✅ اكتمل');
  console.info('');
  console.info('حسابات للدخول:');
  console.info('  البريد:    noor@khayal.test');
  console.info('  كلمة السر: password123');
  console.info('');
  console.info('كل الحسابات تستخدم نفس كلمة السر.');

  await pool.end();
}

seed().catch(err => {
  console.error('❌ فشل:', err);
  process.exit(1);
});