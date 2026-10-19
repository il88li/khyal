"use server";
// app/admin/actions.ts — كل عمليات الأدمن (Server Actions) + audit log
import { cookies, headers } from "next/headers";
import { audit, bustSettings, checkPassword, getFreeModels, getSettings, passwordMode, problems, purgeUserFiles, pushAll, requireAdmin, runSetupSql, startSession, svc } from "@/lib/server";
import { SETUP_SQL, SETUP_PARTS } from "@/lib/setup-sql";

const tries = new Map<string, number[]>();
export async function login(pw: string) {
  const ip = headers().get("x-forwarded-for") ?? "x", now = Date.now(), a = (tries.get(ip) ?? []).filter((t) => now - t < 600_000);
  if (a.length >= 5) return { ok: false, error: "محاولات كثيرة، انتظر 10 دقائق" };
  if (passwordMode() === "none") return { ok: false, error: "لم تُضبط كلمة مرور الأدمن: أضف ADMIN_PASSWORD_HASH في Vercel ثم أعد النشر (Redeploy)" };
  if (!checkPassword(pw)) { tries.set(ip, [...a, now]); return { ok: false, error: `كلمة المرور غير صحيحة (التحقق: ${passwordMode() === "hash" ? "hash" : "نص صريح"})` }; }
  startSession(); return { ok: true, error: "" };
}
export async function logout() { cookies().set("kh_admin", "", { path: "/admin", maxAge: 0 }); }

export async function overview(c: string) {
  await requireAdmin(c); const s = svc(), D = 864e5;
  const cnt = async (t: string, since?: number) => { let q = s.from(t).select("*", { count: "exact", head: true }); if (since) q = q.gte("created_at", new Date(Date.now() - since).toISOString()); return (await q).count ?? 0; };
  const [users, newUsers, prompts, likes, enhancements, daily, weekly, errors24h] = await Promise.all([cnt("profiles"), cnt("profiles", 7 * D), cnt("prompts"), cnt("likes"), cnt("usage"), cnt("usage", D), cnt("usage", 7 * D), cnt("error_log", D)]);
  return { users, newUsers, prompts, likes, enhancements, daily, weekly, errors24h };
}
const clean = (q: string) => q.replace(/[^\p{L}\p{N}_ ]/gu, "").slice(0, 40);
export async function users(c: string, q: string) {
  await requireAdmin(c); let r = svc().from("profiles").select("id,username,display_name,role,banned").order("created_at", { ascending: false }).limit(30);
  if (clean(q)) r = r.or(`username.ilike.%${clean(q)}%,display_name.ilike.%${clean(q)}%`); return (await r).data ?? [];
}
export async function userOp(c: string, id: string, op: string) {
  const a = await requireAdmin(c), s = svc();
  const P: Record<string, object> = { ban: { banned: true }, unban: { banned: false }, promote: { role: "moderator" }, demote: { role: "user" }, admin: { role: "admin" } };
  if (op === "delete") { await purgeUserFiles(id); await s.auth.admin.deleteUser(id); } else if (P[op]) await s.from("profiles").update(P[op]).eq("id", id); else throw new Error("bad_op");
  await audit(a, `user.${op}`, id); return true;
}
export async function prompts(c: string, q: string) {
  await requireAdmin(c); let r = svc().from("prompts").select("id,body,pinned,like_count,author:profiles!author_id(username)").order("created_at", { ascending: false }).limit(30);
  if (clean(q)) r = r.ilike("body", `%${clean(q)}%`); return ((await r).data ?? []) as any[];
}
export async function promptOp(c: string, id: string, op: string) {
  const a = await requireAdmin(c), s = svc();
  if (op === "delete") await s.from("prompts").delete().eq("id", id); else if (op === "pin" || op === "unpin") await s.from("prompts").update({ pinned: op === "pin" }).eq("id", id); else throw new Error("bad_op");
  await audit(a, `prompt.${op}`, id); return true;
}
export async function reports(c: string) {
  await requireAdmin(c);
  return ((await svc().from("reports").select("id,reason,created_at,prompt:prompts(id,body),reporter:profiles!reporter_id(username)").eq("resolved", false).order("created_at", { ascending: false }).limit(50)).data ?? []) as any[];
}
export async function reportOp(c: string, id: string, op: string) {
  const a = await requireAdmin(c), s = svc();
  const { data: r } = await s.from("reports").select("prompt_id").eq("id", id).single();
  if (op === "delete" && r) await s.from("prompts").delete().eq("id", r.prompt_id); // البلاغات تُحذف تلقائياً (cascade)
  else if (op === "dismiss") await s.from("reports").update({ resolved: true }).eq("id", id); else throw new Error("bad_op");
  await audit(a, `report.${op}`, id); return true;
}
/** التوثيق: قائمة الطلبات (المعلّقة أولاً) مع بيانات المتقدّم وإحصاءاته */
export async function verifications(c: string) {
  await requireAdmin(c);
  const s = svc();
  const { data } = await s.from("verification_requests").select("id,user_id,kind,note,status,review_note,created_at,user:profiles!user_id(id,username,display_name,avatar_url,verified)").order("created_at", { ascending: false }).limit(100);
  const rows = (data ?? []) as any[];
  const ids = Array.from(new Set(rows.map((r) => r.user_id)));
  const stats: Record<string, { prompts: number; likes: number; followers: number }> = {};
  await Promise.all(ids.map(async (uid) => {
    const [pr, fl] = await Promise.all([
      s.from("prompts").select("like_count").eq("author_id", uid).limit(1000),
      s.from("follows").select("*", { count: "exact", head: true }).eq("following_id", uid).eq("status", "accepted"),
    ]);
    const p = (pr.data ?? []) as any[];
    stats[uid] = { prompts: p.length, likes: p.reduce((a, r) => a + (r.like_count ?? 0), 0), followers: fl.count ?? 0 };
  }));
  return rows.map((r) => ({ ...r, stats: stats[r.user_id] ?? { prompts: 0, likes: 0, followers: 0 } }));
}
/** التوثيق: قبول/رفض طلب + تحديث شارة الحساب + إشعار المستخدم */
export async function verifyUser(c: string, userId: string, approve: boolean, note?: string) {
  const a = await requireAdmin(c), s = svc();
  const { data: req } = await s.from("verification_requests").select("id").eq("user_id", userId).eq("status", "pending").order("created_at", { ascending: false }).maybeSingle();
  if (req) await s.from("verification_requests").update({ status: approve ? "approved" : "rejected", review_note: (note ?? "").slice(0, 500), reviewed_at: new Date().toISOString() }).eq("id", req.id);
  await s.from("profiles").update(approve ? { verified: true, verified_at: new Date().toISOString() } : { verified: false, verified_at: null }).eq("id", userId);
  await s.from("notifications").insert({ user_id: userId, title: approve ? "تم توثيق حسابك" : "نتيجة طلب التوثيق", body: approve ? "أصبح حسابك موثّقاً — تظهر الشارة بجانب اسمك." : ((note ?? "").trim() || "لم يُقبل طلب التوثيق حالياً."), link: approve ? `/profile/${userId}` : "/verification" });
  await audit(a, approve ? "verify.approve" : "verify.reject", userId, { note });
  return true;
}
export async function cats(c: string) { await requireAdmin(c); return (await svc().from("categories").select("*").order("sort")).data ?? []; }
export async function catSave(c: string, r: { id?: number; slug: string; name_ar: string; sort: number; active: boolean }) {
  const a = await requireAdmin(c); const { error } = await svc().from("categories").upsert(r); if (error) throw error; await audit(a, "category.save", String(r.id ?? r.slug)); return true;
}
export async function catDelete(c: string, id: number) { const a = await requireAdmin(c); await svc().from("categories").delete().eq("id", id); await audit(a, "category.delete", String(id)); return true; }

export async function getCfg(c: string) { await requireAdmin(c); const s = await getSettings(); return { flags: s.flags ?? {}, rate: s.rate ?? 10, visibility: s.visibility ?? { guest: 0.5, free: 0.8 }, limits: s.limits ?? { guestHour: 2, guestDay: 5, classify: 8 }, models: s.models ?? { disabled: [], default: "" }, all: await getFreeModels() }; }
export async function setCfg(c: string, key: string, value: unknown) {
  const a = await requireAdmin(c); if (!["flags", "rate", "models", "visibility", "limits"].includes(key)) throw new Error("bad_key");
  await svc().from("settings").upsert({ key, value }); bustSettings(); await audit(a, `settings.${key}`, key, value); return true;
}
/** الإعلانات: مفتاح settings باسم ad:<slot> (feed | home) */
const AD_SLOTS = ["feed", "home"] as const;
export async function getAds(c: string) {
  await requireAdmin(c); const s = await getSettings();
  return Object.fromEntries(AD_SLOTS.map((k) => [k, s[`ad:${k}`] ?? null]));
}
export async function setAd(c: string, slot: string, ad: { title: string; body?: string; cta?: string; href: string; image?: string; active: boolean } | null) {
  const a = await requireAdmin(c); if (!(AD_SLOTS as readonly string[]).includes(slot)) throw new Error("bad_slot");
  const key = `ad:${slot}`;
  if (!ad) await svc().from("settings").delete().eq("key", key);
  else {
    if (!ad.title?.trim() || !/^https?:\/\//i.test(ad.href) || (ad.image && !/^https?:\/\//i.test(ad.image))) throw new Error("bad_ad");
    await svc().from("settings").upsert({ key, value: { title: ad.title.trim().slice(0, 80), body: (ad.body ?? "").slice(0, 200), cta: (ad.cta ?? "").slice(0, 24), href: ad.href, image: ad.image || undefined, active: ad.active } });
  }
  bustSettings(); await audit(a, `ad.${slot}`, key, ad); return true;
}
export async function logs(c: string, kind: "audit" | "error") {
  await requireAdmin(c); return (await svc().from(kind === "audit" ? "audit_log" : "error_log").select("*").order("created_at", { ascending: false }).limit(50)).data ?? [];
}
/** إحصاءات الإعلانات: ظهور/نقر لكل مساحة خلال آخر 30 يوماً */
export async function adStats(c: string) {
  await requireAdmin(c);
  const since = new Date(Date.now() - 30 * 864e5).toISOString();
  const { data } = await svc().from("ad_events").select("slot,kind").gte("created_at", since).limit(10000);
  const out: Record<string, { impression: number; click: number }> = {};
  for (const r of (data ?? []) as { slot: string; kind: string }[]) {
    const o = (out[r.slot] ??= { impression: 0, click: 0 });
    if (r.kind === "click") o.click++; else o.impression++;
  }
  return out;
}
export async function broadcast(c: string, title: string, body: string) {
  const a = await requireAdmin(c), s = svc(); if (!title.trim() || !body.trim()) throw new Error("empty");
  let n = 0;
  for (let from = 0; ; from += 1000) {
    const { data } = await s.from("profiles").select("id").range(from, from + 999); if (!data?.length) break;
    await s.from("notifications").insert(data.map((u) => ({ user_id: u.id, title: title.slice(0, 80), body: body.slice(0, 300), link: "/", kind: "broadcast" }))); n += data.length;
    if (data.length < 1000) break;
  }
  await pushAll({ title: title.slice(0, 80), body: body.slice(0, 300), link: "/" });
  await audit(a, "broadcast", undefined, { title, n }); return n;
}
export async function exportData(c: string, table: string, fmt: "csv" | "json") {
  const a = await requireAdmin(c); if (!["profiles", "prompts", "audit_log"].includes(table)) throw new Error("bad_table");
  const rows = (await svc().from(table).select("*").limit(5000)).data ?? []; await audit(a, "export", table);
  if (fmt === "json") return JSON.stringify(rows, null, 2);
  const cols = Object.keys(rows[0] ?? {}), esc = (v: unknown) => `"${String(typeof v === "object" ? JSON.stringify(v) : v ?? "").replace(/"/g, '""')}"`;
  return [cols.join(","), ...rows.map((r: any) => cols.map((k) => esc(r[k])).join(","))].join("\n");
}

/** فحص جاهزية النظام: متغيرات البيئة، الجداول، الحاوية، OpenRouter */
export async function health(c: string) {
  await requireAdmin(c);
  const out: { name: string; ok: boolean; detail?: string }[] = [];
  for (const k of ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY", "OPENROUTER_API_KEY", "ADMIN_PASSWORD_HASH"]) out.push({ name: `متغير ${k}`, ok: !!process.env[k] });
  for (const k of ["NEXT_PUBLIC_FIREBASE_API_KEY", "FIREBASE_SERVICE_ACCOUNT", "PUSH_WEBHOOK_SECRET"]) out.push({ name: `متغير ${k} (اختياري)`, ok: !!process.env[k] });
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
    const s = svc();
    const tables = ["profiles", "categories", "prompts", "likes", "saves", "follows", "comments", "library", "notifications", "push_tokens", "reports", "blocks", "audit_log", "error_log", "usage", "settings", "rate_hits", "ad_events"];
    const res = await Promise.all(tables.map(async (t) => { const { error } = await s.from(t).select("*", { count: "exact", head: true }); return { name: `جدول ${t}`, ok: !error, detail: error?.message }; }));
    out.push(...res);
    const b = await s.storage.getBucket("prompts"); out.push({ name: "حاوية الصور prompts", ok: !!b.data, detail: b.error?.message });
    const pe = await s.from("profiles").select("onboarded").limit(1); out.push({ name: "عمود profiles.onboarded", ok: !pe.error, detail: pe.error?.message });
    const rl = await s.rpc("rate_hit", { p_user: "00000000-0000-0000-0000-000000000000", p_limit: 100000 }); out.push({ name: "دالة rate_hit", ok: !rl.error, detail: rl.error?.message });
    try { out.push(...(await problems()).map((x) => ({ name: `ناقص في قاعدة البيانات: ${x}`, ok: false }))); } catch {}
    const sl = await s.from("setup_log").select("step,error").order("id"); // أخطاء آخر تشغيل لـ setup.sql
    if (!sl.error && sl.data?.length) out.push(...sl.data.map((r: any) => ({ name: `فشل أمر في التهيئة: ${String(r.step).slice(0, 60)}`, ok: false, detail: r.error as string })));
  }
  if (process.env.OPENROUTER_API_KEY) {
    try {
      const r = await fetch("https://openrouter.ai/api/v1/chat/completions", { method: "POST", headers: { Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ model: "openrouter/free", messages: [{ role: "user", content: "قل مرحباً" }], max_tokens: 20 }), signal: AbortSignal.timeout(25000) });
      const j: any = await r.json().catch(() => ({}));
      out.push({ name: "OpenRouter (openrouter/free)", ok: r.ok, detail: r.ok ? `النموذج: ${j.model}` : `${r.status} ${JSON.stringify(j.error ?? j).slice(0, 200)}` });
    } catch (e: any) { out.push({ name: "OpenRouter (openrouter/free)", ok: false, detail: String(e?.message ?? e) }); }
  }
  return out;
}
/** ينشئ صفوف profiles للحسابات المسجّلة قبل تفعيل المشغّل */
export async function repairProfiles(c: string) {
  const a = await requireAdmin(c), s = svc();
  const { data } = await s.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const rows = (data?.users ?? []).map((u) => { const base = (u.email ?? "user").split("@")[0]; return { id: u.id, username: base.replace(/[^a-z0-9_]/gi, "").toLowerCase() + u.id.slice(0, 4), display_name: ((u.user_metadata as any)?.full_name as string) ?? base, avatar_url: ((u.user_metadata as any)?.avatar_url as string) ?? null }; });
  const { error } = await s.from("profiles").upsert(rows, { onConflict: "id", ignoreDuplicates: true });
  if (error) throw error; await audit(a, "repair.profiles", undefined, { n: rows.length }); return rows.length;
}

/** نص setup.sql الكامل لنسخه ولصقه في Supabase SQL Editor */
export async function setupSql(c: string, i?: number) { await requireAdmin(c); return i === undefined ? SETUP_SQL : (SETUP_PARTS[i] ?? ""); }
export async function setupPartsCount(c: string) { await requireAdmin(c); return SETUP_PARTS.length; }

/** تشغّل setup.sql عبر اتصال Postgres (تحتاج SUPABASE_DB_URL من Session pooler) */
export async function runSetup(c: string): Promise<{ ok: boolean; msg: string }> {
  const a = await requireAdmin(c);
  const url = (process.env.SUPABASE_DB_URL ?? "").trim();
  if (!url) return { ok: false, msg: "أضف SUPABASE_DB_URL في Vercel (Supabase ← Connect ← Session pooler، مع كلمة مرور قاعدة البيانات) ثم Redeploy." };
  const r = await runSetupSql(url);
  await audit(a, "setup.run", undefined, { ok: r.ok, msg: r.msg.slice(0, 300) });
  return r;
}

/** يحذف جداول التطبيق ويعيد بناءها (للجداول القادمة من نسخة سابقة بهيكل مختلف). تحتاج SUPABASE_DB_URL */
export async function resetSchema(c: string): Promise<{ ok: boolean; msg: string }> {
  const a = await requireAdmin(c);
  const url = (process.env.SUPABASE_DB_URL ?? "").trim();
  if (!url) return { ok: false, msg: "أضف SUPABASE_DB_URL في Vercel (Session pooler) ثم Redeploy." };
  const r = await runSetupSql(url, true);
  await audit(a, "setup.reset", undefined, { ok: r.ok, msg: r.msg.slice(0, 300) });
  return r;
}
