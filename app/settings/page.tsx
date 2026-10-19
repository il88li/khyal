"use client";
// app/settings/page.tsx — إعدادات الحساب والخصوصية والتطبيق
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";
import { VERSION, disablePush, enablePush, explain, sb, thumb, toast, uid, uploadImage } from "@/lib/supabase";
import { Bell, ChevronLeft, ChevronRight, Database, Languages, Lock, Palette, ShieldCheck, Sparkles, Trash2, User } from "@/components/icons";
import type { LucideIcon } from "@/components/icons";
import { CATEGORIES, readInterests, writeInterests } from "@/lib/taxonomy";

const CardStudio = dynamic(() => import("@/components/CardStudio"), { ssr: false, loading: () => <div className="card h-64 animate-pulse bg-mist" /> });

const field = "field px-4";
function Section({ id, title, children, danger }: { id: string; icon?: LucideIcon; title: string; children: React.ReactNode; danger?: boolean }) {
  return (
    <section id={id} aria-label={title} className={`card flex scroll-mt-20 flex-col gap-4 p-4 ${danger ? "!border-danger/30" : ""}`}>
      {children}
    </section>
  );
}
const MENU: { id: string; icon: LucideIcon; title: string; hint: string; danger?: boolean }[] = [
  { id: "account", icon: User, title: "الحساب", hint: "الصورة والاسم والنبذة والروابط" },
  { id: "appearance", icon: Palette, title: "المظهر", hint: "النمط الفاتح أو الداكن والحركة" },
  { id: "interests", icon: Sparkles, title: "الاهتمامات", hint: "المجالات التي تظهر في «مختار لك»" },
  { id: "language", icon: Languages, title: "اللغة", hint: "لغة التطبيق" },
  { id: "notifications", icon: Bell, title: "الإشعارات", hint: "التنبيهات الفورية" },
  { id: "privacy", icon: Lock, title: "الخصوصية والأمان", hint: "الحساب الخاص والمحظورون وكلمة المرور" },
  { id: "data", icon: Database, title: "بياناتي", hint: "تنزيل البيانات وتسجيل الخروج" },
  { id: "danger", icon: Trash2, title: "حذف الحساب", hint: "إجراء نهائي لا رجعة فيه", danger: true },
];
function Switch({ on, set, label, hint }: { on: boolean; set: (v: boolean) => void; label: string; hint?: string }) {
  return (
    <button role="switch" aria-checked={on} onClick={() => set(!on)} className="flex min-h-11 w-full items-center justify-between gap-4 text-start">
      <span><span className="block text-sm font-medium text-charcoal">{label}</span>{hint && <span className="block text-caption text-smoke">{hint}</span>}</span>
      <span className={`flex h-[26px] w-11 shrink-0 items-center rounded-full border px-0.5 transition-colors ${on ? "border-transparent bg-brand" : "border-silver bg-mist"}`} dir="ltr">
        <span className={`h-[21px] w-[21px] rounded-full bg-snow shadow-soft transition-transform ${on ? "translate-x-[18px]" : ""}`} /></span>
    </button>
  );
}

export default function Settings() {
  const router = useRouter(), file = useRef<HTMLInputElement>(null), cov = useRef<HTMLInputElement>(null);
  const [f, setF] = useState({ display_name: "", username: "", bio: "", avatar_url: "", cover_url: "", links: "", is_private: false });
  const [email, setEmail] = useState(""), [busy, setBusy] = useState(false), [reduce, setReduce] = useState(false);
  const [view, setView] = useState<string | null>(null);
  useEffect(() => { // كل واجهة فرعية لها سجلّ تاريخ ليعمل زر الرجوع
    const read = () => { const h = location.hash.slice(1); setView(MENU.some((m) => m.id === h) ? h : null); };
    read(); window.addEventListener("popstate", read); return () => window.removeEventListener("popstate", read);
  }, []);
  const go = (id: string | null) => { if (id) history.pushState(null, "", `#${id}`); else history.pushState(null, "", location.pathname); setView(id); window.scrollTo({ top: 0 }); };
  const [push, setPush] = useState(false), [perm, setPerm] = useState("default"), [lang, setLang] = useState("ar");
  useEffect(() => { setLang(localStorage.getItem("khiyal:lang") || "ar"); setPerm(typeof Notification === "undefined" ? ((window as any).KhiyalNative ? "granted" : "unsupported") : Notification.permission); }, [push]);
  const testNotif = async () => { try { const reg = await navigator.serviceWorker.ready; await reg.showNotification("خيال", { body: "هذا إشعار تجريبي ✓", icon: "/icons/khiyal-mark-192-v5.png", badge: "/icons/khiyal-mark-192-v5.png", dir: "rtl", lang: "ar" }); } catch { toast("تعذّر إرسال إشعار تجريبي"); } };
  useEffect(() => setPush(localStorage.getItem("khiyal:push") === "1"), []);
  const togglePush = async (v: boolean) => { if (!v) { await disablePush(); return setPush(false); } const r = await enablePush(); toast(r === "ok" ? "فُعّلت الإشعارات" : r === "denied" ? "الإذن مرفوض من المتصفح" : "غير مدعوم على هذا الجهاز"); setPush(r === "ok"); };
  useEffect(() => {
    setReduce(localStorage.getItem("khiyal:reduce") === "1");
    uid().then(async (id) => {
      if (!id) return; setEmail((await sb.auth.getUser()).data.user?.email ?? "");
      const { data } = await sb.from("profiles").select("display_name,username,bio,avatar_url,cover_url,links,is_private").eq("id", id).single();
      if (data) setF({ display_name: data.display_name ?? "", username: data.username ?? "", bio: data.bio ?? "", avatar_url: data.avatar_url ?? "", cover_url: data.cover_url ?? "", links: ((data.links as string[]) ?? []).join("\n"), is_private: data.is_private });
    });
  }, []);

  async function avatar(fl?: File) {
    const id = await uid(); if (!fl || !id) return;
    try { const im = await uploadImage(fl, id); setF((x) => ({ ...x, avatar_url: thumb(im.url, 400) })); } catch (e: any) { toast(explain(e)); }
  }
  async function cover(fl?: File) {
    const id = await uid(); if (!fl || !id) return;
    try { const im = await uploadImage(fl, id); setF((x) => ({ ...x, cover_url: thumb(im.url, 800) })); } catch (e: any) { toast(explain(e)); }
  }
  async function save() {
    const id = await uid(); if (!id) return; setBusy(true);
    const { error } = await sb.from("profiles").update({ ...f, links: f.links.split("\n").map((x) => x.trim()).filter((x) => /^https?:\/\//.test(x)).slice(0, 3), username: f.username.trim().toLowerCase().replace(/[^a-z0-9_]/g, "") }).eq("id", id);
    setBusy(false); toast(error ? (error.code === "23505" ? "المعرّف مستخدم" : "تعذّر الحفظ") : "تم الحفظ");
  }
  const setR = (v: boolean) => { setReduce(v); localStorage.setItem("khiyal:reduce", v ? "1" : "0"); window.dispatchEvent(new Event("khiyal:reduce")); };
  const out = async () => { await sb.auth.signOut(); router.replace("/auth"); router.refresh(); };
  const [hap, setHap] = useState(true), [snd, setSnd] = useState(false), [pw, setPw] = useState(""), [theme, setTheme] = useState("sys");
  useEffect(() => { setHap(localStorage.getItem("khiyal:haptics") !== "0"); setSnd(localStorage.getItem("khiyal:sound") === "1"); setTheme(localStorage.getItem("khiyal:theme") || "sys"); }, []);
  const [ints, setInts] = useState<string[]>([]);
  useEffect(() => {
    setInts(readInterests());
    uid().then(async (id) => {
      if (!id) return;
      const { data } = await sb.from("profiles").select("interests").eq("id", id).maybeSingle();
      const db = (data as any)?.interests;
      if (Array.isArray(db) && db.length) setInts(db.filter((s: unknown): s is string => typeof s === "string"));
    });
  }, []);
  const toggleInt = (slug: string) => {
    const next = ints.includes(slug) ? ints.filter((s) => s !== slug) : [...ints, slug];
    setInts(next);
    writeInterests(next);
    (window as any).__feedDirty = true;
    // أفضل جهد: العمود قد لا يكون مُهيّأً بعد
    uid().then((id) => { if (id) sb.from("profiles").update({ interests: next }).eq("id", id); });
  };
  const pickTheme = (v: string) => { setTheme(v); localStorage.setItem("khiyal:theme", v); document.documentElement.classList.toggle("dark", v === "dark" || (v === "sys" && matchMedia("(prefers-color-scheme: dark)").matches)); };
  const [blocks, setBlocks] = useState<{ blocked_id: string; profile: { display_name: string | null; username: string | null } | null }[]>([]);
  useEffect(() => { uid().then(async (id) => { if (!id) return; const { data } = await sb.from("blocks").select("blocked_id,profile:profiles!blocked_id(display_name,username)").eq("blocker_id", id); setBlocks((data as any) ?? []); }); }, []);
  async function unblock(b: string) { const id = await uid(); setBlocks((a) => a.filter((x) => x.blocked_id !== b)); await sb.from("blocks").delete().match({ blocker_id: id!, blocked_id: b }); toast("أُلغي الحظر"); }
  const pickHap = (v: boolean) => { setHap(v); localStorage.setItem("khiyal:haptics", v ? "1" : "0"); window.dispatchEvent(new Event("khiyal:haptics")); };
  const pickSnd = (v: boolean) => { setSnd(v); localStorage.setItem("khiyal:sound", v ? "1" : "0"); window.dispatchEvent(new Event("khiyal:sound")); if (v) import("@/components/ui/motion").then((m) => m.playSound("toggle", true)); };
  async function changePw() { const { error } = await sb.auth.updateUser({ password: pw }); toast(error ? "تعذّر التغيير" : "تم تغيير كلمة المرور"); if (!error) setPw(""); }
  async function exportMine() {
    const id = await uid(); if (!id) return;
    const [a, b] = await Promise.all([sb.from("prompts").select("*").eq("author_id", id), sb.from("library").select("*").eq("user_id", id)]);
    const l = document.createElement("a"); l.href = URL.createObjectURL(new Blob([JSON.stringify({ prompts: a.data, library: b.data }, null, 2)], { type: "application/json" })); l.download = "khiyal-data.json"; l.click();
  }
  async function deleteAccount() {
    if (!confirm("حذف الحساب نهائياً مع كل منشوراتك؟ لا يمكن التراجع.")) return;
    const r = await fetch("/api/account", { method: "DELETE" });
    if (r.ok) { await sb.auth.signOut(); router.replace("/auth"); } else toast("تعذّر حذف الحساب");
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-4 pt-4">
      {view ? (
        <header className="flex items-center gap-2">
          <button onClick={() => go(null)} aria-label="رجوع إلى الإعدادات" className="icon-btn"><ChevronRight size={24} /></button>
          <h1 className="text-xl font-bold text-charcoal">{MENU.find((m) => m.id === view)?.title}</h1>
        </header>
      ) : (
        <>
          <h1 className="text-2xl font-bold text-charcoal">الإعدادات</h1>
          <ul className="flex flex-col gap-2">
            {MENU.map(({ id, icon: Icon, title, hint, danger }) => (
              <li key={id}>
                <button onClick={() => go(id)} className="card card-interactive flex min-h-16 w-full items-center gap-4 p-4 text-start">
                  <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${danger ? "bg-danger-tint text-danger" : "bg-brand-tint text-brand-ink"}`}><Icon size={24} /></span>
                  <span className="min-w-0 flex-1"><span className={`block text-base font-semibold ${danger ? "text-danger" : "text-charcoal"}`}>{title}</span><span className="block truncate text-sm text-smoke">{hint}</span></span>
                  <ChevronLeft size={20} className="shrink-0 text-smoke" />
                </button>
              </li>))}
          </ul>
        </>
      )}

      {view === "account" && (
      <Section id="account" icon={User} title="الحساب">
        <button onClick={() => file.current?.click()} className="flex min-h-11 items-center gap-4 text-sm font-semibold text-brand-ink">
          <span className="h-14 w-14 overflow-hidden rounded-full bg-mist">{f.avatar_url && <img src={f.avatar_url} alt="" className="h-full w-full object-cover" />}</span>تغيير الصورة</button>
        <input ref={file} type="file" accept="image/*" hidden onChange={(e) => avatar(e.target.files?.[0])} />
        <button onClick={() => cov.current?.click()} className="flex min-h-11 items-center gap-4 text-sm font-semibold text-brand-ink"><span className="h-14 w-24 overflow-hidden rounded-xl bg-mist">{f.cover_url && <img src={f.cover_url} alt="" className="h-full w-full object-cover" />}</span>تغيير الغلاف</button>
        <input ref={cov} type="file" accept="image/*" hidden onChange={(e) => cover(e.target.files?.[0])} />
        <input value={f.display_name} onChange={(e) => setF({ ...f, display_name: e.target.value })} placeholder="الاسم" className={field} />
        <input dir="ltr" value={f.username} onChange={(e) => setF({ ...f, username: e.target.value })} placeholder="username" className={field} />
        <textarea value={f.bio} onChange={(e) => setF({ ...f, bio: e.target.value })} rows={3} placeholder="نبذة" className={`${field} resize-none`} />
        <textarea dir="ltr" value={f.links} onChange={(e) => setF({ ...f, links: e.target.value })} rows={3} placeholder={"https://… (رابط في كل سطر، حتى 3)"} className={`${field} resize-none`} />
        <input dir="ltr" value={email} readOnly className={`${field} bg-fog text-smoke`} />
        <button onClick={save} disabled={busy} className="btn btn-primary w-full">
          {busy ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" /> : "حفظ التغييرات"}</button>
      </Section>
      )}

      {view === "appearance" && (
      <Section id="appearance" icon={Palette} title="المظهر">
        <p className="text-caption text-smoke">النمط</p>
        <div className="flex gap-2">
          {([["sys", "النظام"], ["light", "فاتح"], ["dark", "داكن"]] as const).map(([v, l]) => (
            <button key={v} onClick={() => pickTheme(v)} className={`min-h-11 flex-1 rounded-full border px-3 text-sm font-semibold transition-all active:scale-95 ${theme === v ? "border-transparent bg-brand text-on-brand" : "border-silver bg-snow text-graphite"}`}>{l}</button>))}
        </div>
        <Switch on={reduce} set={setR} label="تخفيف الحركة" hint="يقلل الحركات والانتقالات" />
        <Switch on={hap} set={pickHap} label="الاهتزاز عند التفاعل" />
        <Switch on={snd} set={pickSnd} label="الأصوات عند التفاعل" hint="نغمات قصيرة اختيارية" />
        <p className="divider" />
        <div>
          <h2 className="text-lg font-bold text-charcoal">بطاقتي</h2>
          <p className="pb-1 text-caption text-smoke">اختر تأثيرات بطاقتك التي يراها زوّار ملفك</p>
          <CardStudio />
        </div>
      </Section>
      )}

      {view === "interests" && (
      <Section id="interests" icon={Sparkles} title="الاهتمامات">
        <p className="text-sm text-graphite">اختر ما يهمّك — نبني بها تبويب «مختار لك» في الرئيسية.</p>
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((c) => {
            const on = ints.includes(c.slug);
            return (
              <button key={c.slug} type="button" role="switch" aria-checked={on} onClick={() => toggleInt(c.slug)}
                className={`min-h-10 shrink-0 rounded-full border px-4 text-sm font-semibold transition-all active:scale-95 ${on ? "border-transparent bg-charcoal text-snow" : "border-silver bg-snow text-graphite"}`}>
                {on ? "✓ " : ""}{c.name}
              </button>
            );
          })}
        </div>
      </Section>
      )}

      {view === "language" && (
      <Section id="language" icon={Languages} title="اللغة">
        <div className="flex gap-2">
          <button onClick={() => { setLang("ar"); localStorage.setItem("khiyal:lang", "ar"); }} className={`min-h-11 flex-1 rounded-full border px-3 text-sm font-semibold transition-all active:scale-95 ${lang === "ar" ? "border-transparent bg-brand text-on-brand" : "border-silver bg-snow text-graphite"}`}>العربية</button>
          <button disabled dir="ltr" className="min-h-11 flex-1 rounded-full border border-silver bg-mist px-3 text-sm font-semibold text-ash">English · soon</button>
        </div>
      </Section>
      )}

      {view === "notifications" && (
      <Section id="notifications" icon={Bell} title="الإشعارات">
        <Switch on={push} set={togglePush} label="الإشعارات الفورية" hint="تنبيهات الإعجاب والمتابعة والتعليقات" />
        <p className="text-caption text-smoke">حالة الإذن: {perm === "granted" ? "ممنوح" : perm === "denied" ? "مرفوض — فعّله من إعدادات الجهاز" : perm === "unsupported" ? "غير مدعوم على هذا الجهاز" : "لم يُطلب بعد"}</p>
        {push && perm === "granted" && <button onClick={testNotif} className="btn btn-soft w-full">إرسال إشعار تجريبي</button>}
      </Section>
      )}

      {view === "privacy" && (
      <Section id="privacy" icon={Lock} title="الخصوصية">
        <Link href="/safety" className="flex min-h-11 items-center justify-between rounded-xl bg-mist px-4 text-sm font-medium transition-all active:scale-95">
          <span className="flex items-center gap-2"><ShieldCheck size={20} className="text-brand-ink" />مركز الأمان والثقة</span><span className="chip">افتح</span>
        </Link>
        <Switch on={f.is_private} set={async (v) => { setF({ ...f, is_private: v }); const id = await uid(); await sb.from("profiles").update({ is_private: v }).eq("id", id!); }} label="حساب خاص" hint="لا يرى منشوراتك إلا متابعوك" />
        <p className="text-caption text-smoke">الحسابات المحظورة</p>
        {!blocks.length ? <p className="text-sm text-smoke">لا أحد محظور.</p> : blocks.map((b) => (
          <div key={b.blocked_id} className="flex min-h-11 items-center justify-between gap-4"><span className="truncate text-sm">{b.profile?.display_name ?? b.profile?.username ?? "مستخدم"}</span>
            <button onClick={() => unblock(b.blocked_id)} className="btn btn-ghost btn-sm">إلغاء الحظر</button></div>))}
        <p className="text-caption text-smoke">كلمة المرور</p>
        <input type="password" dir="ltr" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="كلمة مرور جديدة (6 أحرف+)" autoComplete="new-password" className={field} />
        <button onClick={changePw} disabled={pw.length < 6} className="btn btn-soft disabled:text-ash">تغيير كلمة المرور</button>
      </Section>
      )}

      {view === "data" && (
      <Section id="data" icon={Database} title="بياناتي">
        <button onClick={exportMine} className="btn btn-soft">تنزيل بياناتي (JSON)</button>
        <button onClick={out} className="btn btn-ghost w-full">تسجيل الخروج</button>
        <p className="text-caption text-smoke" dir="ltr">Khiyal {VERSION}</p>
      </Section>
      )}

      {view === "danger" && (
      <Section id="danger" icon={Trash2} title="حذف الحساب" danger>
        <p className="text-sm text-graphite">يحذف حسابك مع كل منشوراتك نهائياً ولا يمكن التراجع.</p>
        <button onClick={deleteAccount} className="btn w-full !border-danger/30 !text-danger">حذف الحساب نهائياً</button>
      </Section>
      )}
    </main>
  );
}
