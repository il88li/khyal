# خيال (Khiyal)

منصة عربية لتحسين البرومبتات ومشاركتها: Next.js 14 + TypeScript + Tailwind + Supabase + OpenRouter (توجيه تلقائي للنماذج المجانية) + PWA/FCM.
واجهة عربية RTL بنظام **Luminous Minimalism** (بنفسجي #6750A4، أسطح بيضاء بتمويه وظلال هادئة)، وتخطيط ويب ثلاثي الأعمدة: Sidebar على اليمين، محتوى في الوسط، وتحدي اليوم على اليسار. على الهاتف يتحول إلى رأس علوي وشريط سفلي ثابت.

> الفحص: اجتاز TypeScript وبناء Next.js للإنتاج؛ تمت مراجعة نقاط العرض المكتبية والهاتفية (390×844) في Chromium. لم يجرِ اختبار على جهاز مادي. مواصفات الهوية في `DESIGN_SYSTEM.md` وسجل التنفيذ في `plan.md`.

## الجمهور المستهدف والأولويات
**الأساسي:** صنّاع المحتوى العرب، المسوّقون، المستقلون وأصحاب المتاجر، والمبتدئون في الذكاء الاصطناعي. **الثانوي:** المطورون، المعلمون والطلاب، الوكالات، ومنشئو البرومبتات.

| الميزة | الحالة |
|---|---|
| قوالب بمتغيرات `[المنتج] [الجمهور]` + نموذج تعبئة | ✅ مبنية |
| تفريع (Fork) مع نسبة الأصل + إشعار للمؤلف | ✅ مبنية |
| سجل إصدارات عند التعديل + استرجاع | ✅ مبنية |
| مكتبة شخصية + بحث + فلترة بالفئة | ✅ مبنية (المجلدات والوسوم والبحث الدلالي لاحقاً) |
| إحصاءات المنشئ (إعجاب/تعليق/نسخ/تفريع) | ✅ مبنية (المشاهدات ومعدل التحويل لاحقاً) |
| سلسلة أيام + تحدي يومي + تذكير | ✅ مبنية |
| مقارنة مخرجات عدة نماذج، توصيات مخصصة | ⏳ لم تُبنَ |
| تعاون الفرق، سوق واشتراكات (دفع)، تكاملات (Chrome/API/Slack…) | ⏳ لم تُبنَ |

> بعد التحديث نفّذ «تهيئة تلقائية» من `/admin` ← الفحص (أو أعد النشر مع `SUPABASE_DB_URL`) لإنشاء أعمدة التفريع/النسخ وجدول الإصدارات؛ قبلها تعمل بقية الميزات ولا يتعطل شيء.

## بنية المشروع (مدمجة لتقليل الملفات)
| المسار | المحتوى |
|---|---|
| `lib/supabase.ts` | **عميل**: عميل Supabase، رفع الصور وضغطها، FCM، فرق النصوص، `explain` للأخطاء، `burst` (احتفال)، `useCategories` |
| `lib/server.ts` | **خادم فقط**: الأدمن (جلسة/CSRF/audit)، OpenRouter، الإشعارات، التهيئة الذاتية للقاعدة |
| `lib/setup-sql.ts` | مُولَّد من `supabase/setup.src.sql` عبر `python3 scripts/build-setup.py` |
| `components/ui.tsx` | BottomSheet, Toaster, CopyButton, Lightbox, Gallery, Comments, Splash, DailyCard |
| `components/chrome.tsx` | TopBar, BottomNav, Sidebar, Shell, Providers, PwaBoot |
| `components/PromptCard.tsx` | بطاقة البرومبت |
| `app/*` | الصفحات: الرئيسية، `/enhance`، `/new`، `/library`، `/search`، `/profile/[id]`، `/settings`، `/notifications`، `/requests`، `/welcome`، `/auth`، `/setup`، `/admin`، `/p/[id]` + مسارات `api/*` |
| `types/index.ts` | الأنواع + تحديات اليوم |
| `android/` | تطبيق WebView (Kotlin) |

## التشغيل
```bash
npm install
cp .env.example .env.local   # املأ القيم
npm run dev
```

## تهيئة Supabase (بلا لصق SQL)
التطبيق يهيّئ قاعدة بياناته بنفسه عند أول فتح (جداول، دوال، صلاحيات، حاوية الصور، إصلاح الجداول القديمة).
1. أنشئ مشروعاً على supabase.com وخذ: Project URL، anon key، service_role key (Project Settings ← API).
2. زر **Connect** ← **Session pooler** ← انسخ الرابط واستبدل `[YOUR-PASSWORD]` بكلمة مرور قاعدة البيانات (يُرمَّز تلقائياً) ← `SUPABASE_DB_URL`. (Session pooler وليس Direct: Vercel لا يدعم IPv6.)
3. Vercel ← Settings ← Environment Variables: `NEXT_PUBLIC_SUPABASE_URL` · `NEXT_PUBLIC_SUPABASE_ANON_KEY` · `SUPABASE_SERVICE_ROLE_KEY` · `SUPABASE_DB_URL` · `OPENROUTER_API_KEY` · `ADMIN_PASSWORD_HASH` ثم **Redeploy**.
   - `ADMIN_PASSWORD_HASH`: كلمة المرور نفسها، أو ناتج `node scripts/hash-admin.mjs "كلمتك"` (الأفضل).
4. Supabase ← Authentication ← Providers ← Email: **عطّل «Confirm email»**. (Google اختياري: فعّله وأضف `…/auth/callback` و`…/auth/reset` في URL Configuration.)
5. افتح التطبيق: «جارٍ تهيئة قاعدة البيانات…» ثم يعمل. للتحقق: `/admin` ← «الفحص».

**بدون `SUPABASE_DB_URL`** (يدوي): `/admin` ← الفحص ← «نسخ الجزء 1…6» والصق كل جزء بالترتيب في SQL Editor ← Run (اللصق الأطول من ~20 ألف حرف يُقصّ على الهاتف). بعد كل جزء تظهر نتيجة: «بلا أخطاء» أو قائمة الأوامر الفاشلة.
**جداول من نسخة سابقة**: التهيئة تضيف الأعمدة الناقصة والمفاتيح الأجنبية وتحذف السياسات القديمة. وإن بقيت المشكلة: `/admin` ← الفحص ← «إعادة بناء الجداول» (يحذف بيانات جداول التطبيق فقط).

## تحديث قاعدة بيانات قائمة بدل التهيئة الكاملة
إن ظهرت «ينقص: أعمدة profiles، دالة touch_streak» ولم تضبط `SUPABASE_DB_URL`، الصق هذا الملخّص (قصير) في SQL Editor ← Run ثم «إعادة المحاولة»:
```sql
alter table profiles add column if not exists streak int not null default 0;
alter table profiles add column if not exists best_streak int not null default 0;
alter table profiles add column if not exists last_active date;
create or replace function touch_streak(p_offset int default 0) returns json language plpgsql security definer set search_path = public as $$
declare s int; b int; l date; t date := ((now() at time zone 'utc') + make_interval(mins => p_offset))::date;
begin
  if auth.uid() is null then return json_build_object('streak', 0, 'best', 0, 'changed', false); end if;
  select streak, best_streak, last_active into s, b, l from profiles where id = auth.uid();
  if l = t then return json_build_object('streak', coalesce(s, 0), 'best', coalesce(b, 0), 'changed', false); end if;
  s := case when l = t - 1 then coalesce(s, 0) + 1 else 1 end;
  b := greatest(coalesce(b, 0), s);
  update profiles set streak = s, best_streak = b, last_active = t where id = auth.uid();
  return json_build_object('streak', s, 'best', b, 'changed', true);
end $$;
notify pgrst, 'reload schema';
```

## التذكير اليومي (سبب العودة)
`vercel.json` يشغّل `/api/cron/daily` كل يوم 16:00 UTC فيرسل «تحدي اليوم» لمن فعّل الإشعارات. أضف `CRON_SECRET` في Vercel (Vercel يرسله كترويسة Authorization تلقائياً) + إعداد Firebase للإشعارات.

## أخطاء شائعة
| الرسالة | الحل |
|---|---|
| ينقص: جدول profiles … | أضف `SUPABASE_DB_URL` ثم Redeploy |
| password authentication failed | أعد تعيين كلمة مرور قاعدة البيانات وحدّث الرابط |
| ENOTFOUND / ENETUNREACH | استخدم Session pooler لا Direct |
| تعذّر دخول الأدمن | تأكد من `ADMIN_PASSWORD_HASH` ثم Redeploy |

## تطبيق أندرويد
مجلد `android/` (انظر `android/README.md`): WebView + FCM + App Links. الجسور: `window.khiyalRegisterToken(token)` و`window.khiyalOpen(path)`.
