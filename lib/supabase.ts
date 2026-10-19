import { createBrowserClient } from "@supabase/ssr";
import imageCompression from "browser-image-compression";
import { getApps, initializeApp } from "firebase/app";
import { getMessaging, getToken, isSupported, onMessage } from "firebase/messaging";
import { useEffect, useState } from "react";
import type { Img } from "@/types";

// lib/supabase.ts — عميل المتصفح الموحّد + مساعد التنبيهات
// قيم احتياطية عند غياب متغيّرات البيئة (نشر بلا env): الحزم لا ينهار عند الاستيراد،
// وتفشل الطلبات لاحقاً برقم خطأ يُعرض كرسالة عربية عبر explain() بدل استثناء أثناء التحميل.
const envUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
const envKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder";
if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
  try { console.error("[khiyal] NEXT_PUBLIC_SUPABASE_URL غير مضبوط — عميل Supabase يعمل بقيم احتياطية ولن ينجح في الطلبات"); } catch {}
}
export const sb = createBrowserClient(envUrl, envKey);
export type Tone = "info" | "success" | "error";
export const toast = (m: string, tone: Tone = "info") =>
  typeof window !== "undefined" && window.dispatchEvent(new CustomEvent("khiyal:toast", { detail: { msg: m, tone } }));
export const uid = async () => (await sb.auth.getSession()).data.session?.user.id;
export const ago = (d: string) => {
  const s = (new Date(d).getTime() - Date.now()) / 1000, f = new Intl.RelativeTimeFormat("ar", { numeric: "auto" });
  for (const [u, n] of [["day", 86400], ["hour", 3600], ["minute", 60]] as const) if (Math.abs(s) >= n) return f.format(Math.round(s / n), u);
  return "الآن";
};
export const VERSION = "v0.4.0";
/** صفحات بلا شريط علوي/سفلي (ترحيب، دخول، إعداد، أدمن) */
export const isBare = (p: string) => ["/auth", "/welcome", "/setup", "/admin", "/offline"].some((x) => p.startsWith(x));

/** يحوّل أخطاء Supabase/الشبكة إلى رسالة عربية مفهومة، وينبّه الحارس إن كانت قاعدة البيانات غير مهيّأة */
export function explain(e: any): string {
  const m = String(e?.message ?? e ?? "");
  const missing = () => { if (typeof window !== "undefined") window.dispatchEvent(new Event("khiyal:dbmissing")); };
  if (/schema cache|Could not find the (table|function)|relation .* does not exist/i.test(m)) { missing(); return "قاعدة البيانات غير مهيّأة بعد (جدول أو دالة ناقصة). نفّذ setup.sql في Supabase."; }
  if (/Bucket not found/i.test(m)) { missing(); return "حاوية الصور غير موجودة. نفّذ setup.sql في Supabase."; }
  if (/column .* does not exist/i.test(m)) { missing(); return "عمود ناقص في قاعدة البيانات. نفّذ setup.sql في Supabase."; }
  if (/row-level security|violates row-level/i.test(m)) return "ليست لديك صلاحية لهذه العملية (أو أن الميزة متوقفة).";
  if (/duplicate key|already exists|23505/i.test(m)) return "هذه القيمة مستخدمة مسبقاً.";
  if (/JWT|expired|not authenticated/i.test(m)) return "انتهت الجلسة، سجّل الدخول من جديد.";
  if (/Failed to fetch|NetworkError|Load failed/i.test(m)) return "تعذّر الاتصال، تحقق من الإنترنت.";
  if (/too large|maximum allowed size/i.test(m)) return "حجم الملف كبير جداً.";
  // لا نُسرّب أي تفاصيل تقنية (أسماء خدمات/مزودين/جداول) في رسائل الواجهة
  try { console.error("[khiyal]", m); } catch {}
  return "حدث خطأ غير متوقّع، أعد المحاولة بعد لحظات.";
}

/** يختصر الأعداد: 1200 → 1.2K */
export const fmt = (n: number) => (n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1000 ? `${(n / 1000).toFixed(1)}K` : String(n));

/** انفجار جسيمات صغير (قلوب الإعجاب/احتفال) — خفيف بلا مكتبات */
export function burst(x: number, y: number, n = 12) {
  if (typeof document === "undefined" || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const colors = ["rgb(var(--brand))", "rgb(var(--gold))", "rgb(var(--secondary))", "rgb(var(--ok))"];
  for (let i = 0; i < n; i++) {
    const el = document.createElement("span"), a = (Math.PI * 2 * i) / n + Math.random() * 0.5, d = 38 + Math.random() * 52;
    Object.assign(el.style, { position: "fixed", left: `${x}px`, top: `${y}px`, width: "8px", height: "8px", borderRadius: "9999px", background: colors[i % colors.length], pointerEvents: "none", zIndex: "90" });
    document.body.appendChild(el);
    el.animate([{ transform: "translate(0,0) scale(1)", opacity: 1 }, { transform: `translate(${Math.cos(a) * d}px, ${Math.sin(a) * d + 18}px) scale(.2)`, opacity: 0 }], { duration: 600 + Math.random() * 250, easing: "cubic-bezier(.2,.8,.3,1)" }).onfinish = () => el.remove();
  }
}

/** أسماء الفئات (تُجلب مرة واحدة وتُخزَّن) */
let catMap: Record<number, string> | null = null, catReq: Promise<void> | null = null;
export function useCategories(): Record<number, string> {
  const [m, setM] = useState(catMap);
  useEffect(() => {
    if (catMap) return;
    if (!catReq) catReq = (async () => { const { data } = await sb.from("categories").select("id,name_ar"); catMap = Object.fromEntries((data ?? []).map((c: any) => [c.id, c.name_ar])); })();
    catReq.then(() => setM(catMap));
  }, []);
  return m ?? {};
}

// lib/image-utils.ts — ضغط من العميل + 3 أحجام WebP (400/800/1600) + رفع إلى Supabase Storage

const SIZES = [400, 800, 1600] as const;
export const thumb = (url: string, s: 400 | 800 | 1600) => (url.endsWith("/1600.webp") ? url.replace("/1600.webp", `/${s}.webp`) : url);
/**
 * مصدر متجاوب للصور المرفوعة بصيغة WebP متعدّدة الأحجام (400/800/1600).
 * يعيد `src` بحجم افتراضي مناسب + `srcSet` + `sizes` — للصور الثابتة الرابط فقط،
 * وإلا يعيد الرابط كما هو (GIF مثلاً). يقلّل البيانات على الشاشات الصغيرة بشكل كبير.
 */
export const imgSet = (url: string, fallback: 400 | 800 | 1600 = 800) => {
  if (!url.endsWith("/1600.webp")) return { src: url };
  const base = url.slice(0, -"/1600.webp".length);
  return {
    src: `${base}/${fallback}.webp`,
    srcSet: `${base}/400.webp 400w, ${base}/800.webp 800w, ${base}/1600.webp 1600w`,
  };
};

export async function dims(f: Blob) {
  const b = await createImageBitmap(f); const r = { w: b.width, h: b.height }; b.close(); return r;
}
const pub = (path: string) => sb.storage.from("prompts").getPublicUrl(path).data.publicUrl;

/** يرفع الصورة بثلاثة أحجام ويعيد رابط الأكبر + الأبعاد (GIF يُرفع كما هو لحفظ الحركة) */
export async function uploadImage(file: File, userId: string, onProgress?: (pct: number) => void): Promise<Img> {
  const { w, h } = await dims(file), id = crypto.randomUUID(), base = `${userId}/${id}`;
  if (file.type === "image/gif") {
    const { error } = await sb.storage.from("prompts").upload(`${base}/orig.gif`, file, { contentType: "image/gif", cacheControl: "31536000" });
    if (error) throw error; onProgress?.(100);
    return { url: pub(`${base}/orig.gif`), w, h };
  }
  for (let i = 0; i < SIZES.length; i++) {
    const blob = await imageCompression(file, { maxWidthOrHeight: SIZES[i], maxSizeMB: 2, initialQuality: 0.8, fileType: "image/webp", useWebWorker: true });
    const { error } = await sb.storage.from("prompts").upload(`${base}/${SIZES[i]}.webp`, blob, { contentType: "image/webp", cacheControl: "31536000" });
    if (error) throw error;
    onProgress?.(Math.round(((i + 1) / SIZES.length) * 100));
  }
  return { url: pub(`${base}/1600.webp`), w, h };
}

/** يحذف ملفات صور برومبت واحد ({userId}/{uuid}) — يُستدعى بعد حذف المنشور، وفشله لا يُعيد الحذف */
export async function purgeImageFolder(urls: string[] | null | undefined) {
  try {
    const st = sb.storage.from("prompts");
    const folders = new Set<string>();
    for (const u of urls ?? []) {
      const m = u.match(/\/object\/public\/prompts\/(.+\/)[^\/?#]+$/);
      if (m) folders.add(m[1].replace(/\/$/, ""));
    }
    for (const folder of folders) {
      const { data } = await st.list(folder, { limit: 100 });
      if (data?.length) await st.remove(data.map((f) => `${folder}/${f.name}`));
    }
  } catch { /* تحسّسي */ }
}

// lib/firebase.ts — FCM للويب + جسر التوكن لتطبيق أندرويد (WebView)

export async function registerToken(token: string, platform: "web" | "android") {
  const id = await uid(); if (!id || !token) return;
  await sb.from("push_tokens").upsert({ token, user_id: id, platform, updated_at: new Date().toISOString() });
}
async function webToken() {
  if (!(await isSupported())) return null;
  const app = getApps()[0] ?? initializeApp({ apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY, projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID, messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID, appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID });
  const reg = await navigator.serviceWorker.ready;
  return getToken(getMessaging(app), { vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY, serviceWorkerRegistration: reg });
}
/** تحديث صامت للتوكن عند كل تشغيل (إن كان الإذن ممنوحاً) */
export async function refreshWebToken() { const t = await webToken(); if (t) { localStorage.setItem("khiyal:pushtoken", t); await registerToken(t, "web"); listenForeground(); } }
let fgOn = false;
/** رسائل FCM أثناء فتح التطبيق: تُعرض كتنبيه داخلي */
export function listenForeground() {
  const app = getApps()[0]; if (fgOn || !app) return; fgOn = true;
  onMessage(getMessaging(app), (m) => { const d: any = m.data ?? m.notification ?? {}; if (d.title) toast(d.body ? `${d.title} — ${d.body}` : d.title); });
}
export async function enablePush(): Promise<"ok" | "denied" | "unsupported"> {
  const native = (window as any).KhiyalNative; // تطبيق أندرويد: إذن POST_NOTIFICATIONS + قناة الإشعار + توكن FCM أصلية
  if (native?.requestToken) { native.requestPermission?.(); native.requestToken(); localStorage.setItem("khiyal:push", "1"); return "ok"; }
  if (!("Notification" in window) || !("serviceWorker" in navigator)) return "unsupported";
  if ((await Notification.requestPermission()) !== "granted") return "denied";
  const t = await webToken(); if (!t) return "unsupported";
  localStorage.setItem("khiyal:push", "1"); localStorage.setItem("khiyal:pushtoken", t); await registerToken(t, "web"); listenForeground(); return "ok";
}
export async function disablePush() {
  const t = localStorage.getItem("khiyal:pushtoken"); localStorage.setItem("khiyal:push", "0");
  if (t) await sb.from("push_tokens").delete().eq("token", t);
}

// lib/diff.ts — فرق على مستوى الكلمات (LCS) لعرض Diff بين الأصل والمحسّن
export type Part = { t: string; k: "same" | "add" | "del" };
export function wordDiff(a: string, b: string): Part[] | null {
  const x = a.split(/(\s+)/).filter(Boolean), y = b.split(/(\s+)/).filter(Boolean);
  if (x.length > 500 || y.length > 500) return null;
  const n = x.length, m = y.length;
  const L = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--)
    L[i][j] = x[i] === y[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
  const out: Part[] = []; let i = 0, j = 0;
  while (i < n && j < m) {
    if (x[i] === y[j]) { out.push({ t: x[i], k: "same" }); i++; j++; }
    else if (L[i + 1][j] >= L[i][j + 1]) out.push({ t: x[i++], k: "del" });
    else out.push({ t: y[j++], k: "add" });
  }
  while (i < n) out.push({ t: x[i++], k: "del" });
  while (j < m) out.push({ t: y[j++], k: "add" });
  return out;
}

/** متغيرات القوالب: [المنتج] [الجمهور] … */
const VAR_RE = /\[([^\[\]\n]{1,30})\]/g;
export const extractVars = (t: string): string[] => Array.from(new Set((t.match(VAR_RE) ?? []).map((m) => m.slice(1, -1).trim()))).filter(Boolean);
export const fillVars = (t: string, v: Record<string, string>) => t.replace(VAR_RE, (m, k: string) => (v[k.trim()]?.trim() ? v[k.trim()].trim() : m));


/** أعمدة اختيارية (العنوان والوسوم التلقائية): تُدمج إن وُجدت ويُتجاهل غيابها حتى تكتمل الهجرة */
export async function withMeta<T extends { id: string }>(rows: T[]): Promise<T[]> {
  if (!rows.length) return rows;
  try {
    const x = await sb.from("prompts").select("id,title,tags").in("id", rows.map((r) => r.id));
    if (!x.error) { const M = new Map((x.data ?? []).map((r: any) => [r.id, r])); rows.forEach((r) => Object.assign(r, M.get(r.id) ?? {})); }
  } catch {}
  await withVerified(rows);
  return rows;
}

/** يدمج شارة التوثيق على كائن الكاتب (اختياري: يتجاهل غياب العمود قبل تنفيذ التهيئة) */
export async function withVerified<T extends { id: string }>(rows: T[]): Promise<T[]> {
  const ids = Array.from(new Set(rows.map((r: any) => r.author?.id).filter(Boolean))) as string[];
  if (!ids.length) return rows;
  try {
    const v = await sb.from("profiles").select("id,verified").in("id", ids);
    if (!v.error && v.data) {
      const V = new Map((v.data as any[]).map((p) => [p.id, p.verified]));
      rows.forEach((r: any) => { if (r.author && V.has(r.author.id)) r.author.verified = V.get(r.author.id); });
    }
  } catch {}
  return rows;
}
