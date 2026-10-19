import "server-only";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { createHash, createHmac, randomBytes, scryptSync, timingSafeEqual } from "crypto";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getMessaging } from "firebase-admin/messaging";
import { cookies } from "next/headers";
import { Client } from "pg";
import { systemPrompt } from "./prompts";
import { SETUP_SQL } from "./setup-sql";

// lib/admin.ts — خادم فقط: تحقق scrypt، جلسة ساعة (httpOnly)، CSRF، service client، audit/error log، إعدادات النظام

export const svc = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

/** يحوّل مفتاحاً (معرّف مستخدم أو بصمة IP) إلى uuid ثابت — لتخزين العدّاد في rate_hits */
const uuidOf = (k: string) => {
  const h = createHash("sha256").update("rate:" + k).digest("hex").slice(0, 32);
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
};
/**
 * حدّ المعدّل عبر مخزن مشترك (جدول rate_hits في Postgres) — صالح لبيئات serverless،
 * بخلاف الخرائط في الذاكرة المحلية التي تُصفَّر مع كل مثيل. يرجع durable=false إن لم تُنفَّذ الدالة بعد.
 */
export async function rateHit(key: string, limit: number, windowSec = 60): Promise<{ ok: boolean; durable: boolean }> {
  try {
    const { data, error } = await svc().rpc("rate_hit_window", { p_user: uuidOf(key), p_limit: limit, p_window: windowSec });
    if (error) return { ok: true, durable: false };
    return { ok: data !== false, durable: true };
  } catch { return { ok: true, durable: false }; }
}
const sign = (s: string) => createHmac("sha256", process.env.ADMIN_SESSION_SECRET || process.env.ADMIN_PASSWORD_HASH || "x").update(s).digest("base64url");
const eq = (a: string, b: string) => { const x = Buffer.from(a), y = Buffer.from(b); return x.length === y.length && timingSafeEqual(x, y); };

const clean = (v?: string) => (v ?? "").trim().replace(/^["']|["']$/g, "");
const HASH_RE = /^[0-9a-f]{16,}:[0-9a-f]{64,}$/i;
/** وضع التحقق: hash (ناتج scripts/hash-admin.mjs) أو text (كلمة المرور نفسها) أو none (غير مضبوطة) */
export function passwordMode(): "hash" | "text" | "none" {
  const h = clean(process.env.ADMIN_PASSWORD_HASH), p = clean(process.env.ADMIN_PASSWORD);
  return HASH_RE.test(h) ? "hash" : h || p ? "text" : "none";
}
export function checkPassword(pw: string) {
  const h = clean(process.env.ADMIN_PASSWORD_HASH), p = clean(process.env.ADMIN_PASSWORD), mode = passwordMode();
  if (mode === "hash") { const [salt, hash] = h.split(":"); return eq(scryptSync(pw.trim(), salt, 64).toString("hex"), hash.toLowerCase()); }
  const expected = p || h; // نص صريح: مقبول للبداية، والأفضل لاحقاً استخدام hash
  if (!expected) return false;
  const k = (x: string) => createHmac("sha256", "khiyal-pw").update(x).digest("hex"); // يوحّد الأطوال قبل المقارنة
  return eq(k(pw.trim()), k(expected));
}
export function startSession() {
  const body = `${Date.now() + 3_600_000}.${randomBytes(12).toString("base64url")}`;
  cookies().set("kh_admin", `${body}.${sign(body)}`, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", path: "/admin", maxAge: 3600 });
}
export async function adminSession() {
  const [exp, n, sig] = (cookies().get("kh_admin")?.value ?? "").split(".");
  if (!exp || !n || !sig || !eq(sig, sign(`${exp}.${n}`)) || Date.now() > +exp) return null;
  return { csrf: sign(`csrf.${n}`) };
}
/** كل Server Action تمر من هنا: جلسة أدمن صالحة + CSRF + مستخدم Supabase مسجّل */
export async function requireAdmin(csrf: string) {
  const s = await adminSession();
  if (!s || !eq(s.csrf, csrf ?? "")) throw new Error("unauthorized");
  const store = cookies();
  const sb = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { cookies: { getAll: () => store.getAll(), setAll: () => {} } });
  const { data: { user } } = await sb.auth.getUser();
  if (!user) throw new Error("unauthorized");
  return user.id;
}
export const audit = (actor: string, action: string, target?: string, meta?: unknown) => svc().from("audit_log").insert({ actor, action, target, meta });
export const logError = async (source: string, message: string) => { try { await svc().from("error_log").insert({ source, message: message.slice(0, 500) }); } catch {} };

let cfg: { at: number; v: any } | null = null;
export const bustSettings = () => { cfg = null; };
export async function getSettings(): Promise<any> {
  if (cfg && Date.now() - cfg.at < 60_000) return cfg.v;
  try { const { data } = await svc().from("settings").select("key,value"); const v = Object.fromEntries((data ?? []).map((r) => [r.key, r.value])); cfg = { at: Date.now(), v }; return v; } catch { return {}; }
}

/** يحذف كل ملفات صور المستخدم من التخزين (مجلد بمعرّفه) — يُستدعى قبل حذف الحساب */
export async function purgeUserFiles(userId: string) {
  try {
    const st = svc().storage.from("prompts");
    const { data: dirs } = await st.list(userId, { limit: 1000 });
    for (const d of dirs ?? []) {
      const { data: files } = await st.list(`${userId}/${d.name}`, { limit: 100 });
      if (files?.length) await st.remove(files.map((f) => `${userId}/${d.name}/${f.name}`));
    }
  } catch (e: any) { await logError("purge", String(e?.message ?? e)); }
}

// lib/openrouter.ts — توجيه النماذج المجانية من OpenRouter مع fallback تلقائي
const BASE = "https://openrouter.ai/api/v1";
/** مفتاح OpenRouter منظَّف (يزيل المسافات وعلامات الاقتباس الشائعة عند اللصق في Vercel) ويفشل بوضوح إن كان ناقصاً */
function orKey(): string {
  const k = (process.env.OPENROUTER_API_KEY ?? "").trim().replace(/^["']|["']$/g, "").trim();
  if (!k) throw Object.assign(new Error("no_api_key: OPENROUTER_API_KEY غير مضبوط في متغيّرات البيئة"), { fatal: true });
  return k;
}
const PREFERRED = [
  "deepseek/deepseek-chat-v3-0324:free",
  "meta-llama/llama-3.3-70b-instruct:free",
  "qwen/qwen-2.5-72b-instruct:free",
  "google/gemini-2.0-flash-exp:free",
];
const rank = (id: string) => (/(llama|qwen|deepseek|gemma|mistral|gpt-oss|glm|kimi)/i.test(id) ? 0 : 1);
let cache: { at: number; ids: string[] } | null = null;

/** يجلب النماذج المجانية فعلياً (السعر = 0) ويخزنها ساعة */
export async function getFreeModels(): Promise<string[]> {
  if (cache && Date.now() - cache.at < 3_600_000) return cache.ids;
  try {
    const r = await fetch(`${BASE}/models`, { next: { revalidate: 3600 } });
    const { data } = await r.json();
    const free = (data as any[])
      .filter((m) => +m.pricing?.prompt === 0 && +m.pricing?.completion === 0)
      .filter((m) => (m.architecture?.output_modalities ?? ["text"]).join() === "text")
      .filter((m) => !/(guard|embed|moderation|safeguard|image|-vl\b|vision)/i.test(m.id))
      .sort((a, b) => rank(a.id) - rank(b.id) || (b.context_length ?? 0) - (a.context_length ?? 0)) // العائلات المعروفة أولاً
      .map((m) => m.id as string);
    const ids = [...PREFERRED.filter((p) => free.includes(p)), ...free.filter((f) => !PREFERRED.includes(f))];
    if (ids.length) cache = { at: Date.now(), ids };
    return ids.length ? ids : PREFERRED;
  } catch {
    return cache?.ids ?? PREFERRED;
  }
}

type Msg = { role: "system" | "user" | "assistant"; content: string };

// ── اتصال أمتن بالنماذج المجانية: تبريد النماذج الفاشلة، فحص أول رمز، وسقف زمني لكل محاولة ──
const cool = new Map<string, number>(); // نموذج → وقت انتهاء التبريد
const coolDown = (m: string, ms: number) => { cool.set(m, Date.now() + ms); };
const isCool = (m: string) => (cool.get(m) ?? 0) > Date.now();
const HEADERS = () => ({
  Authorization: `Bearer ${orKey()}`,
  "Content-Type": "application/json",
  "HTTP-Referer": process.env.NEXT_PUBLIC_SITE_URL || "https://khiyal-web.vercel.app",
  "X-Title": "Khiyal",
});
const short = (t: string) => t.replace(/\s+/g, " ").slice(0, 160);

async function failOf(model: string, res: Response): Promise<never> {
  const t = short(await res.text().catch(() => ""));
  if (res.status === 401 || res.status === 403) throw Object.assign(new Error(`auth_failed:${res.status}:${t}`), { fatal: true }); // مفتاح مرفوض: لا فائدة من بقية النماذج
  coolDown(model, res.status === 429 ? 60_000 : res.status === 402 ? 600_000 : 300_000);
  throw new Error(`${model}:${res.status}:${t}`);
}

/** مهل الاتصال بالذكاء الاصطناعي — موسّعة لتحمّل بطء النماذج المجانية (قابلة للتعديل من البيئة) */
export const CONNECT_MS = Number(process.env.OPENROUTER_CONNECT_MS ?? 35_000);
export const FIRST_TOKEN_MS = Number(process.env.OPENROUTER_FIRST_TOKEN_MS ?? 35_000);

/** بثّ نموذج واحد: اتصال ≤35ث وأول رمز ≤35ث، ويُرفض البث الفارغ أو المحمّل بخطأ */
export async function openRouterStream(model: string, messages: Msg[], signal?: AbortSignal, maxTokens = 2000): Promise<ReadableStream<Uint8Array>> {
  const ac = new AbortController();
  const relay = () => ac.abort();
  signal?.addEventListener("abort", relay);
  if (signal?.aborted) ac.abort();
  const connect = setTimeout(() => ac.abort(), CONNECT_MS);
  let ok = false;
  try {
    const res = await fetch(`${BASE}/chat/completions`, {
      method: "POST", headers: HEADERS(), signal: ac.signal,
      body: JSON.stringify({ model, messages, stream: true, temperature: 0.7, max_tokens: maxTokens, reasoning: { exclude: true } }),
    });
    clearTimeout(connect);
    if (!res.ok || !res.body) await failOf(model, res);
    const reader = res.body!.getReader(), dec = new TextDecoder(), buffered: Uint8Array[] = [];
    const deadline = Date.now() + FIRST_TOKEN_MS;
    let seen = false;
    while (!seen) { // الانتظار لأول بيانات فعلية (تُتجاهل تعليقات keep-alive)
      const left = deadline - Date.now();
      if (left <= 0) { reader.cancel().catch(() => {}); coolDown(model, 120_000); throw new Error(`${model}:first_token_timeout`); }
      const r = await Promise.race([reader.read(), new Promise<null>((res) => setTimeout(() => res(null), left))]);
      if (!r) continue;
      if (r.done) { coolDown(model, 120_000); throw new Error(`${model}:empty_stream`); }
      buffered.push(r.value);
      const txt = dec.decode(r.value, { stream: true });
      if (/"error"\s*:/.test(txt) && !/"content"\s*:\s*"/.test(txt)) { reader.cancel().catch(() => {}); coolDown(model, 180_000); throw new Error(`${model}:stream_error:${short(txt)}`); }
      if (/^data:/m.test(txt)) seen = true;
    }
    ok = true;
    const detach = () => signal?.removeEventListener("abort", relay);
    return new ReadableStream<Uint8Array>({
      start(c) { for (const b of buffered) c.enqueue(b); },
      async pull(c) { try { const { done, value } = await reader.read(); if (done) { detach(); c.close(); } else c.enqueue(value); } catch (e) { detach(); throw e; } },
      cancel(reason) { detach(); return reader.cancel(reason); },
    });
  } finally {
    clearTimeout(connect);
    if (!ok) signal?.removeEventListener("abort", relay);
  }
}

async function candidatesFor(preferred?: string): Promise<string[]> {
  const free = await activeModels();
  const first = preferred && free.includes(preferred) ? preferred : undefined; // لا يقبل إلا نموذجاً مجانياً
  const all: string[] = [];
  for (const m of [first, "openrouter/free", ...free]) if (m && !all.includes(m)) all.push(m);
  const ready = all.filter((m) => !isCool(m));
  return (ready.length ? ready : all).slice(0, 6);
}

/** توجيه تلقائي: أول نموذج يعطي رمزاً فعلياً يفوز؛ تُبرَّد النماذج المتعثرة مؤقتاً */
export async function streamEnhance(messages: Msg[], preferred?: string, _onlyFree = true) {
  const errs: string[] = [];
  for (const model of await candidatesFor(preferred)) {
    try { return { body: await openRouterStream(model, messages), model }; }
    catch (e: any) {
      if (e?.fatal) throw e;
      errs.push(String(e?.message ?? e?.name ?? "error").slice(0, 140));
    }
  }
  throw new Error(`all_models_failed (${errs.length} فشلت؛ آخرها: ${errs[errs.length - 1] ?? "no_models"})`);
}

/** إكمال غير متدفّق (للمهام القصيرة كالتصنيف): يجرّب النماذج بالتتابع بمهلة 35ث لكل منها */
export async function completeText(messages: Msg[], maxTokens = 300): Promise<{ text: string; model: string }> {
  const errs: string[] = [];
  for (const model of (await candidatesFor()).slice(0, 5)) {
    const ac = new AbortController(), t = setTimeout(() => ac.abort(), CONNECT_MS);
    try {
      const res = await fetch(`${BASE}/chat/completions`, {
        method: "POST", headers: HEADERS(), signal: ac.signal,
        body: JSON.stringify({ model, messages, stream: false, temperature: 0.2, max_tokens: maxTokens, reasoning: { exclude: true } }),
      });
      if (!res.ok) await failOf(model, res);
      const j = await res.json();
      const text = String(j?.choices?.[0]?.message?.content ?? "").trim();
      if (!text) { coolDown(model, 120_000); throw new Error(`${model}:empty`); }
      return { text, model };
    } catch (e: any) {
      if (e?.fatal) throw e;
      if (e?.name === "AbortError") coolDown(model, 120_000);
      errs.push(String(e?.message ?? e?.name ?? "error").slice(0, 120));
    } finally { clearTimeout(t); }
  }
  throw new Error(`all_models_failed (${errs.length}: ${errs[errs.length - 1] ?? "no_models"})`);
}

export function buildMessages(p: { text: string; category: string; lang: string; tone: string; detail: string }): Msg[] {
  return [
    // تعليمات نظام عالية الكفاءة لكل تصنيف (lib/prompts.ts) — تُخرج برومبتاً مكتملاً بلا شرح
    { role: "system", content: systemPrompt({ text: p.text, category: p.category, lang: p.lang, tone: p.tone, detail: p.detail }) },
    { role: "user", content: p.text },
  ];
}

/** النماذج الفعّالة بعد تطبيق إعدادات الأدمن (تعطيل + افتراضي) */
export async function activeModels() {
  const s = await getSettings(), off = new Set<string>(s.models?.disabled ?? []);
  const free = (await getFreeModels()).filter((m) => !off.has(m)), d = s.models?.default;
  if (d && free.includes(d)) free.unshift(...free.splice(free.indexOf(d), 1));
  return free;
}

// lib/push.ts — إرسال FCM من الخادم (رسائل بيانات فقط؛ يعرضها SW أو تطبيق أندرويد)

type PushMsg = { title: string; body: string; link: string };
const app = () => getApps()[0] ?? initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT!)) });

export async function sendPush(tokens: string[], m: PushMsg) {
  if (!tokens.length || !process.env.FIREBASE_SERVICE_ACCOUNT) return;
  try {
    for (let i = 0; i < tokens.length; i += 500) {
      const chunk = tokens.slice(i, i + 500);
      const r = await getMessaging(app()).sendEachForMulticast({ tokens: chunk, data: { ...m }, android: { priority: "high" } });
      const bad = r.responses.flatMap((x, j) => (!x.success && /not-registered|invalid-argument|invalid-registration/.test(x.error?.code ?? "") ? [chunk[j]] : []));
      if (bad.length) await svc().from("push_tokens").delete().in("token", bad);
    }
  } catch (e: any) { logError("push", e.message); }
}
export async function pushAll(m: PushMsg) {
  const s = svc();
  for (let f = 0; ; f += 1000) {
    const { data } = await s.from("push_tokens").select("token").range(f, f + 999);
    if (!data?.length) break; await sendPush(data.map((t) => t.token), m); if (data.length < 1000) break;
  }
}

// lib/bootstrap.ts — تهيئة ذاتية لقاعدة البيانات: يكتشف النقص ويشغّل setup.sql عبر Postgres دون لصق يدوي

let readyAt = 0, lastRun = 0;

/** يضبط رابط الاتصال: يزيل أقواس [كلمة-المرور] ويرمّز الرموز الخاصة فيها (@ # / % …) */
export function normalizeUrl(u: string) {
  const m = u.match(/^(postgres(?:ql)?:\/\/)([^:@/]+):(.+)@([^@]+)$/s);
  if (!m) return u;
  let pw = m[3];
  if (pw.startsWith("[") && pw.endsWith("]")) pw = pw.slice(1, -1);
  try { pw = decodeURIComponent(pw); } catch {}
  return `${m[1]}${m[2]}:${encodeURIComponent(pw)}@${m[4]}`;
}

/** ما الناقص في قاعدة البيانات الآن؟ (قائمة فارغة = جاهزة) */
export async function problems(): Promise<string[]> {
  const out: string[] = [], s = svc();
  const t = await s.from("profiles").select("id", { head: true, count: "exact" }).limit(1);
  if (t.error) out.push("جدول profiles");
  else {
    const c = await s.from("profiles").select("username,role,is_private,banned,links,cover_url,onboarded").limit(1); if (c.error) out.push("أعمدة profiles");
    const sk = await s.from("profiles").select("streak,best_streak,last_active").limit(1); if (sk.error) out.push("اختياري: أعمدة السلسلة (streak)");
    const rel = await s.from("prompts").select("id,author:profiles!author_id(id)").limit(1); if (rel.error) out.push("جدول prompts أو علاقته بـ profiles");
  }
  const b = await s.storage.getBucket("prompts"); if (b.error || !b.data) out.push("حاوية prompts");
  const r = await s.rpc("rate_hit", { p_user: "00000000-0000-0000-0000-000000000000", p_limit: 100000 }); if (r.error) out.push("دالة rate_hit");
  const st = await s.rpc("touch_streak"); if (st.error) out.push("اختياري: دالة touch_streak");
  const fk = await s.from("prompts").select("forked_from,copy_count,fork_count").limit(1); if (fk.error && !t.error) out.push("اختياري: أعمدة التفريع والنسخ (forked_from, copy_count)");
  const tt = await s.from("prompts").select("title,tags").limit(1); if (tt.error && !t.error) out.push("اختياري: أعمدة العنوان والوسوم (title, tags)");
  const pv = await s.from("prompt_versions").select("id").limit(1); if (pv.error) out.push("اختياري: جدول الإصدارات prompt_versions");
  const bc = await s.rpc("bump_copy", { p_id: "00000000-0000-0000-0000-000000000000" }); if (bc.error) out.push("اختياري: دالة bump_copy");
  return out;
}

const RESET_SQL = "drop table if exists reports, blocks, push_tokens, notifications, library, comments, saves, likes, follows, prompts, categories, profiles, rate_hits, usage, error_log, audit_log, settings cascade;";
export async function runSetupSql(url: string, reset = false): Promise<{ ok: boolean; msg: string }> {
  const client = new Client({ connectionString: normalizeUrl(url.trim()), ssl: { rejectUnauthorized: false } });
  try {
    await client.connect();
    if (reset) await client.query(RESET_SQL); // يحذف جداول التطبيق فقط (حسابات auth لا تُمَس) ثم يعيد بناءها
    const res: any = await client.query(SETUP_SQL);
    const last = Array.isArray(res) ? res[res.length - 1] : res;
    const msg = String(last?.rows?.[0]?.result ?? "اكتملت التهيئة");
    return { ok: !msg.includes("→"), msg };
  } catch (e: any) { return { ok: false, msg: `تعذّر الاتصال أو التنفيذ: ${String(e?.message ?? e).slice(0, 220)}` }; }
  finally { await client.end().catch(() => {}); }
}

export type Boot = { status: "ready" | "ran" | "no_db_url" | "no_service_key" | "failed" | "partial"; msg?: string; problems?: string[] };
/** يفحص ثم (إن لزم وتوفّر SUPABASE_DB_URL) يهيّئ تلقائياً. آمن لإعادة الاستدعاء ومحدود المعدّل */
export async function ensureSetup(): Promise<Boot> {
  if (Date.now() - readyAt < 600_000) return { status: "ready" };
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.NEXT_PUBLIC_SUPABASE_URL) return { status: "no_service_key", msg: "أضف NEXT_PUBLIC_SUPABASE_URL و SUPABASE_SERVICE_ROLE_KEY في Vercel ثم Redeploy" };
  const p = await problems();
  if (!p.length) { readyAt = Date.now(); return { status: "ready" }; }
  const url = (process.env.SUPABASE_DB_URL ?? "").trim();
  const crit = p.filter((x) => !x.startsWith("اختياري"));
  if (!url) return crit.length ? { status: "no_db_url", problems: p, msg: `ينقص: ${crit.join("، ")}` } : { status: "partial", problems: p, msg: `ميزات اختيارية تحتاج تحديث القاعدة: ${p.join("، ")}` };
  if (Date.now() - lastRun < 30_000) return { status: "failed", problems: p, msg: "جرت محاولة تهيئة قبل لحظات، أعد المحاولة بعد قليل" };
  lastRun = Date.now();
  const r = await runSetupSql(url);
  if (!r.ok) return { status: "failed", problems: p, msg: r.msg };
  readyAt = 0;
  return { status: "ran", msg: r.msg, problems: p };
}
