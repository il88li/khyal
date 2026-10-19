// scripts/preflight.mjs — فحص جاهزية الإطلاق: تعليمات كل تصنيف، لا تسريب تقني للمستخدم، وميزات محذوفة فعلاً
// التشغيل: node scripts/preflight.mjs
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const read = (p) => readFileSync(join(root, p), "utf8");
let fails = 0;
const ok = (name) => console.log("  ✓", name);
const bad = (name, why) => { fails++; console.error("  ✗", name, "—", why); };

const walk = (dir, out = []) => {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) { if (f !== "node_modules" && f !== ".next") walk(p, out); }
    else if (/\.(ts|tsx|css)$/.test(f)) out.push(p);
  }
  return out;
};

console.log("\n[1] تعليمات النظام لكل تصنيف");
const { PROMPT_DOMAINS, systemPrompt } = await import(join(root, "lib/prompts.ts"));
const sql = read("supabase/setup.src.sql");
const catsBlock = sql.match(/insert into categories[\s\S]*?on conflict \(slug\) do nothing;/);
const cats = catsBlock ? [...catsBlock[0].matchAll(/'[a-z-]+','([^']+)'/g)].map((m) => m[1]) : [];
if (!cats.length) bad("فئات قاعدة البيانات", "تعذّر قراءة قائمة الفئات من supabase/setup.src.sql");
else {
  for (const c of cats) {
    const s = systemPrompt({ text: "فكرة", category: c, lang: "عربي", tone: "ودّي", detail: "متوازن" });
    if (!PROMPT_DOMAINS[c]) bad(`تغطية «${c}»`, "لا يوجد وصف مجال مخصص — يسقط في الوصف العام");
    else if (s.length < 1200) bad(`تغطية «${c}»`, "تعليمات النظام قصيرة جداً");
  }
  ok(`كل الفئات (${cats.length}) لها تعليمات نظام عالية الكفاءة`);
  const fallback = systemPrompt({ text: "فكرة", category: "فئة غير موجودة", lang: "عربي", tone: "ودّي", detail: "متوازن" });
  if (!fallback.includes("عام")) bad("الوصف العام", "لا يوجد fallback لفئة غير معروفة"); else ok("يوجد وصف عام احتياطي لفئة غير معروفة");
}

console.log("\n[2] لا تسريب تقني في واجهة المستخدم");
// الواجهة الموجّهة للمستخدم فقط: صفحة/مكونات عامة (باستثناء لوحة الأدمن)
const UI = [
  ...walk(join(root, "app")).filter((f) => f.endsWith(".tsx") && !f.includes("/admin/")),
  ...walk(join(root, "components")),
];
const FORBIDDEN = [/openrouter/i, /:free\b/, /deepseek/i, /llama/i, /qwen/i, /gemini/i, /gpt-4/i, /gpt-oss/i, /mistral/i, /X-Model-Used/, /api\/models/, /api\/compare/];
let leaks = 0;
for (const f of UI) {
  const txt = readFileSync(f, "utf8");
  for (const re of FORBIDDEN) if (re.test(txt)) { leaks++; console.error("  ✗", f.replace(root, ""), "— يحوي", re); }
}
if (!leaks) ok("لا يوجد أي ذكر للنماذج أو المزودين في ملفات الواجهة");
else fails++;

console.log("\n[3] الميزات المحذوفة والميزات المنقلة");
for (const p of ["app/lab", "app/api/compare", "app/api/models"]) {
  if (existsSync(join(root, p))) bad(p, "لا يزال موجوداً"); else ok(`${p} محذوف`);
}
const card = read("components/PromptCard.tsx");
if (/\/lab/.test(card) || /FlaskConical/.test(card)) bad("PromptCard", "ما يزال يشير إلى المختبر"); else ok("البطاقة لا تشير إلى المختبر");
if (/<Pencil|<Trash2/.test(card)) bad("PromptCard", "أزرار التعديل/حذف ما زالت في الرئيسية"); else ok("أزرار تعديل/حذف غائبة عن الرئيسية");
const prof = read("app/profile/[id]/page.tsx");
if (!/<Pencil/.test(prof) || !/<Trash2/.test(prof) || !/saveEdit/.test(prof)) bad("البروفايل", "أزرار تعديل/حذف المنشورات غير موجودة"); else ok("إدارة المنشورات (تعديل/حذف) في البروفايل");

console.log("\n[4] الخصوصية التقنية في مسار التحسين");
const enhance = read("app/api/enhance/route.ts");
if (!/function scrub\(/.test(enhance)) bad("api/enhance", "البث لا يُنقّى من أسماء النماذج"); else ok("بث SSE يُنقّى من أي حقل يكشف التقنية");
if (/detail:\s*(msg|String|j\.|e\.)/.test(enhance)) bad("api/enhance", "يستعيد تفاصيل تقنية للواجهة"); else ok("لا تفاصيل تقنية في استجابات الخطأ");
const page = read("app/enhance/page.tsx");
if (/j\.detail/.test(page)) bad("enhance page", "يعرض j.detail للمستخدم"); else ok("الواجهة لا تعرض تفاصيل الخادم");
if (/setUsed\(|used\?\.replace/.test(page)) bad("enhance page", "ما يزال يعرض اسم النموذج"); else ok("لا يُعرض اسم النموذج في المحسّن");

console.log("\n[5] الهيدر الثابت والشريط العائم");
const clean = read("app/clean.css");
if (!/\.app-topbar \{[^}]*position: fixed !important; top: 0 !important/.test(clean)) bad("clean.css", "الهيدر ليس ثابتاً بالحافة"); else ok("الهيدر شريط ثابت بالحافة العليا");
if (!/\.mobile-bottomnav \{[^}]*bottom: calc\(10px/.test(clean)) bad("clean.css", "الشريط السفلي ليس عائماً"); else ok("الشريط السفلي عائم بحواف دائرية");
const chrome = read("components/chrome.tsx");
if (!/MoreSheet open=\{more\}/.test(chrome.split("export function BottomNav")[0])) bad("chrome.tsx", "قائمة المزيد ليست في الهيدر"); else ok("قائمة «المزيد» في الهيدر");
if (!/ENHANCE_LINK/.test(chrome)) bad("chrome.tsx", "زر التحسين غير موجود في الشريط السفلي"); else ok("زر واجهة التحسين في الشريط السفلي");

console.log("");
if (fails) { console.error(`فشل ${fails} فحصاً — صحّحها قبل الإطلاق`); process.exit(1); }
console.log("✓ كل فحوصات ما قبل الإطلاق نجحت");
