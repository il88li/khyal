"use client";
// app/admin/ui.tsx — واجهة الأدمن (موبايل أولاً): 7 أقسام
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import * as A from "./actions";
import { toast } from "@/lib/supabase";

const card = "card p-4", btn = "btn btn-ghost !min-h-9 disabled:text-ash";
const dark = "btn btn-primary !min-h-9 disabled:bg-mist disabled:text-ash", inp = "field px-4";

export function Login() {
  const r = useRouter(), [pw, setPw] = useState(""), [err, setErr] = useState(""), [busy, setBusy] = useState(false);
  async function go() { setBusy(true); const x = await A.login(pw); setBusy(false); x.ok ? r.refresh() : setErr(x.error); }
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-4">
      <h1 className="text-2xl font-semibold">الإدارة</h1>
      <input type="password" dir="ltr" value={pw} onChange={(e) => setPw(e.target.value)} onKeyDown={(e) => e.key === "Enter" && go()} placeholder="كلمة المرور" className={inp} autoComplete="current-password" />
      {err && <p role="alert" className="text-caption">{err}</p>}
      <button onClick={go} disabled={busy || !pw} className={dark}>{busy ? "…" : "دخول"}</button>
    </main>
  );
}

function useData<T>(fn: () => Promise<T>, deps: unknown[]) {
  const r = useRouter(), [d, setD] = useState<T | null>(null);
  const load = useCallback(async () => { try { setD(await fn()); } catch { toast("انتهت الجلسة أو حدث خطأ"); r.refresh(); } }, deps); // eslint-disable-line
  useEffect(() => { load(); }, [load]);
  return [d, load] as const;
}
const Tog = ({ on, set, label }: { on: boolean; set: (v: boolean) => void; label: string }) => (
  <button role="switch" aria-checked={on} onClick={() => set(!on)} className="flex min-h-11 w-full items-center justify-between text-sm"><span>{label}</span>
    <span dir="ltr" className={`flex h-7 w-12 items-center rounded-full border px-0.5 ${on ? "border-brand bg-brand" : "border-silver bg-mist"}`}><span className={`h-5 w-5 rounded-full bg-snow transition-transform ${on ? "translate-x-5" : ""}`} /></span></button>
);
const dl = (name: string, text: string, type: string) => { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name; a.click(); };

function Search({ onChange }: { onChange: (v: string) => void }) {
  const [v, setV] = useState("");
  useEffect(() => { const t = setTimeout(() => onChange(v), 300); return () => clearTimeout(t); }, [v]); // eslint-disable-line
  return <input className={inp} placeholder="بحث…" value={v} onChange={(e) => setV(e.target.value)} />;
}

export function Panel({ csrf }: { csrf: string }) {
  const r = useRouter(), [tab, setTab] = useState("overview"), [q, setQ] = useState("");
  const T = [["overview", "نظرة عامة"], ["users", "المستخدمون"], ["prompts", "البرومبتات"], ["reports", "البلاغات"], ["verify", "التوثيق"], ["health", "الفحص"], ["cats", "الفئات"], ["models", "النماذج"], ["ads", "الإعلانات"], ["system", "النظام"], ["logs", "السجلات"]];
  const act = async (fn: () => Promise<unknown>, done: () => void, ok = "تم") => { try { await fn(); toast(ok); done(); } catch { toast("تعذّر التنفيذ"); } };

  function Overview() {
    const [d] = useData(() => A.overview(csrf), []); if (!d) return <p className="text-smoke">…</p>;
    const L: Record<string, string> = { users: "المستخدمون", newUsers: "جدد (7 أيام)", prompts: "البرومبتات", likes: "الإعجابات", enhancements: "التحسينات", daily: "استخدام اليوم", weekly: "استخدام الأسبوع", errors24h: "أخطاء 24س" };
    return <div className="grid grid-cols-2 gap-4">{Object.entries(d).map(([k, v]) => <div key={k} className={card}><p className="text-2xl font-semibold tabular-nums">{v as number}</p><p className="text-caption text-smoke">{L[k]}</p></div>)}</div>;
  }
  function Users() {
    const [d, load] = useData(() => A.users(csrf, q), [q]);
    return <div className="flex flex-col gap-4">{d?.map((u: any) => (
      <div key={u.id} className={`${card} flex flex-col gap-2`}><p className="text-sm font-medium">{u.display_name} <span dir="ltr" className="text-caption text-smoke">@{u.username} · {u.role}{u.banned ? " · محظور" : ""}</span></p>
        <div className="flex flex-wrap gap-2">
          <button className={btn} onClick={() => act(() => A.userOp(csrf, u.id, u.banned ? "unban" : "ban"), load)}>{u.banned ? "إلغاء الحظر" : "حظر"}</button>
          <button className={btn} onClick={() => act(() => A.userOp(csrf, u.id, u.role === "user" ? "promote" : "demote"), load)}>{u.role === "user" ? "ترقية" : "تخفيض"}</button>
          <button className={btn} onClick={() => confirm("حذف المستخدم نهائياً؟") && act(() => A.userOp(csrf, u.id, "delete"), load)}>حذف</button></div></div>))}</div>;
  }
  function Prompts() {
    const [d, load] = useData(() => A.prompts(csrf, q), [q]);
    return <div className="flex flex-col gap-4">{d?.map((p: any) => (
      <div key={p.id} className={`${card} flex flex-col gap-2`}><p className="line-clamp-3 text-sm">{p.body}</p><p className="text-caption text-smoke">@{p.author?.username} · ♥ {p.like_count}</p>
        <div className="flex gap-2"><button className={btn} onClick={() => act(() => A.promptOp(csrf, p.id, p.pinned ? "unpin" : "pin"), load)}>{p.pinned ? "إلغاء التثبيت" : "تثبيت"}</button>
          <button className={btn} onClick={() => confirm("حذف البرومبت؟") && act(() => A.promptOp(csrf, p.id, "delete"), load)}>حذف</button></div></div>))}</div>;
  }
  function Cats() {
    const [d, load] = useData(() => A.cats(csrf), []), [n, setN] = useState({ slug: "", name_ar: "", sort: 99, active: true });
    return <div className="flex flex-col gap-4">{d?.map((c: any) => (
      <div key={c.id} className={`${card} flex items-center gap-2`}><span className="flex-1 text-sm">{c.name_ar} <span className="text-caption text-smoke">#{c.sort}</span></span>
        <button className={btn} onClick={() => act(() => A.catSave(csrf, { ...c, sort: Math.max(0, c.sort - 1) }), load)}>↑</button>
        <button className={btn} onClick={() => act(() => A.catSave(csrf, { ...c, sort: c.sort + 1 }), load)}>↓</button>
        <button className={btn} onClick={() => act(() => A.catSave(csrf, { ...c, active: !c.active }), load)}>{c.active ? "تعطيل" : "تفعيل"}</button>
        <button className={btn} onClick={() => confirm("حذف الفئة؟") && act(() => A.catDelete(csrf, c.id), load)}>✕</button></div>))}
      <div className={`${card} flex flex-col gap-2`}><input className={inp} placeholder="الاسم بالعربية" value={n.name_ar} onChange={(e) => setN({ ...n, name_ar: e.target.value })} />
        <input dir="ltr" className={inp} placeholder="slug" value={n.slug} onChange={(e) => setN({ ...n, slug: e.target.value })} />
        <button disabled={!n.slug || !n.name_ar} className={dark} onClick={() => act(() => A.catSave(csrf, n), () => { setN({ ...n, slug: "", name_ar: "" }); load(); })}>إضافة فئة</button></div></div>;
  }
  function Models() {
    const [d, load] = useData(() => A.getCfg(csrf), []); if (!d) return null;
    const m = d.models as { disabled: string[]; default: string }, save = (v: typeof m) => act(() => A.setCfg(csrf, "models", v), load);
    return <div className="flex flex-col gap-2">{d.all.slice(0, 40).map((id: string) => { const off = m.disabled.includes(id); return (
      <div key={id} className={`${card} flex items-center gap-2`}><span dir="ltr" className="min-w-0 flex-1 truncate text-caption">{id.replace(":free", "")}{m.default === id ? " ★" : ""}</span>
        <button className={btn} onClick={() => save({ ...m, default: id })}>افتراضي</button>
        <button className={btn} onClick={() => save({ ...m, disabled: off ? m.disabled.filter((x) => x !== id) : [...m.disabled, id] })}>{off ? "تفعيل" : "تعطيل"}</button></div>); })}</div>;
  }
  function System() {
    const [d, load] = useData(() => A.getCfg(csrf), []), [t, setT] = useState(""), [b, setB] = useState(""); if (!d) return null;
    const F: [string, string][] = [["enhancer", "المحسّن"], ["publishing", "النشر"], ["signups", "التسجيل الجديد"]];
    const Num = ({ label, value, onSave }: { label: string; value: number; onSave: (v: number) => void }) => (
      <div className={`${card} flex items-center gap-4`}><span className="flex-1 text-sm">{label}</span>
        <input type="number" min={0} step={label.includes("%") ? 5 : 1} defaultValue={Math.round(label.includes("%") ? value * 100 : value)} onBlur={(e) => onSave(label.includes("%") ? Math.min(100, Math.max(0, +e.target.value || 0)) / 100 : Math.max(0, +e.target.value || 0))} className={`${inp} !w-24 text-center`} /></div>);
    return <div className="flex flex-col gap-4">
      <div className={card}>{F.map(([k, l]) => <Tog key={k} label={l} on={d.flags[k] !== false} set={(v) => act(() => A.setCfg(csrf, "flags", { ...d.flags, [k]: v }), load)} />)}</div>
      <div className={`${card} flex items-center gap-4`}><span className="flex-1 text-sm">حد التحسين في الدقيقة</span>
        <input type="number" min={1} defaultValue={d.rate} onBlur={(e) => act(() => A.setCfg(csrf, "rate", Math.max(1, +e.target.value || 10)), load)} className={`${inp} !w-24 text-center`} /></div>
      <div className="flex flex-col gap-2">
        <p className="text-caption text-smoke">نسبة ظهور البرومبت للزوار والمستخدمين المجانيين</p>
        <Num label="الزوار %" value={d.visibility.guest} onSave={(v) => act(() => A.setCfg(csrf, "visibility", { ...d.visibility, guest: v }), load)} />
        <Num label="المجاني %" value={d.visibility.free} onSave={(v) => act(() => A.setCfg(csrf, "visibility", { ...d.visibility, free: v }), load)} />
      </div>
      <div className="flex flex-col gap-2">
        <p className="text-caption text-smoke">حدود الاستخدام (طلبات لكل نافذة)</p>
        <Num label="تحسين الزوار / ساعة" value={d.limits.guestHour} onSave={(v) => act(() => A.setCfg(csrf, "limits", { ...d.limits, guestHour: v }), load)} />
        <Num label="تحسين الزوار / يوم" value={d.limits.guestDay} onSave={(v) => act(() => A.setCfg(csrf, "limits", { ...d.limits, guestDay: v }), load)} />
        <Num label="تصنيف / دقيقة" value={d.limits.classify} onSave={(v) => act(() => A.setCfg(csrf, "limits", { ...d.limits, classify: v }), load)} />
      </div>
      <div className={`${card} flex flex-col gap-2`}><p className="text-sm font-medium">إشعار جماعي</p><input className={inp} placeholder="العنوان" value={t} onChange={(e) => setT(e.target.value)} />
        <textarea className={`${inp} py-3`} rows={3} placeholder="النص" value={b} onChange={(e) => setB(e.target.value)} />
        <button disabled={!t || !b} className={dark} onClick={() => confirm("إرسال لكل المستخدمين؟") && act(() => A.broadcast(csrf, t, b), () => { setT(""); setB(""); }, "أُرسل")}>إرسال</button></div>
      <div className={`${card} flex flex-wrap gap-2`}>{["profiles", "prompts", "audit_log"].flatMap((tb) => (["csv", "json"] as const).map((f) => (
        <button key={tb + f} className={btn} onClick={() => act(async () => dl(`${tb}.${f}`, await A.exportData(csrf, tb, f), "text/plain"), () => {}, "جاهز")}>{tb}.{f}</button>)))}</div></div>;
  }
  function Ads() {
    const [d, load] = useData(() => A.getAds(csrf), []);
    const [stats] = useData(() => A.adStats(csrf), []);
    const [slot, setSlot] = useState<"feed" | "home">("feed");
    const [f, setF] = useState({ title: "", body: "", cta: "", href: "", image: "", active: true });
    useEffect(() => { const a = d?.[slot]; setF(a ? { title: a.title ?? "", body: a.body ?? "", cta: a.cta ?? "", href: a.href ?? "", image: a.image ?? "", active: a.active !== false } : { title: "", body: "", cta: "", href: "", image: "", active: true }); }, [d, slot]);
    const L = { feed: "الخلاصة (كل 12 بطاقة)", home: "العمود الجانبي (سطح المكتب)" } as const;
    const NM: Record<string, string> = { feed: "الخلاصة", home: "الجانب" };
    return <div className="flex flex-col gap-4">
      <div className={card}>
        <p className="mb-2 text-sm font-medium">القياس (آخر 30 يوماً)</p>
        <div className="grid grid-cols-2 gap-4">{(["feed", "home"] as const).map((k) => { const s = stats?.[k] ?? { impression: 0, click: 0 }; const ctr = s.impression ? Math.round((s.click / s.impression) * 1000) / 10 : 0;
          return <div key={k} className="rounded-xl bg-white/[0.03] p-4"><p className="text-caption text-smoke">{NM[k]}</p><p className="text-lg font-semibold tabular-nums">{s.impression} <span className="text-caption text-smoke">ظهور</span></p><p className="text-caption text-smoke tabular-nums">{s.click} نقر · {ctr}%</p></div>; })}</div>
      </div>
      <div className="flex gap-2">{(Object.keys(L) as (keyof typeof L)[]).map((k) => <button key={k} onClick={() => setSlot(k)} className={`${btn} ${slot === k ? "!bg-brand-tint !text-brand-ink" : ""}`}>{L[k]}</button>)}</div>
      <div className={`${card} flex flex-col gap-2`}>
        <p className="text-caption text-smoke">{d?.[slot] ? "إعلان محفوظ" : "لا إعلان — تظهر دعوة «أعلن لدى خيال»"}</p>
        <input className={inp} placeholder="العنوان" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
        <textarea className={`${inp} py-3`} rows={3} placeholder="النص" value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} />
        <input dir="ltr" className={inp} placeholder="https://رابط-الإعلان" value={f.href} onChange={(e) => setF({ ...f, href: e.target.value })} />
        <input dir="ltr" className={inp} placeholder="https://رابط-الصورة (اختياري)" value={f.image} onChange={(e) => setF({ ...f, image: e.target.value })} />
        <input className={inp} placeholder="نص الزر (اختياري)" value={f.cta} onChange={(e) => setF({ ...f, cta: e.target.value })} />
        <Tog label="مفعّل" on={f.active} set={(v) => setF({ ...f, active: v })} />
        <div className="flex gap-2">
          <button disabled={!f.title || !/^https?:\/\//i.test(f.href)} className={dark} onClick={() => act(() => A.setAd(csrf, slot, f), load)}>حفظ</button>
          {d?.[slot] && <button className={btn} onClick={() => confirm("حذف الإعلان؟") && act(() => A.setAd(csrf, slot, null), load)}>حذف</button>}
        </div>
      </div>
    </div>;
  }
  function Logs() {
    const [k, setK] = useState<"audit" | "error">("audit"), [d] = useData(() => A.logs(csrf, k), [k]);
    return <div className="flex flex-col gap-2"><div className="flex gap-2">{(["audit", "error"] as const).map((x) => <button key={x} onClick={() => setK(x)} className={k === x ? dark : btn}>{x === "audit" ? "العمليات" : "الأخطاء"}</button>)}</div>
      {d?.map((l: any) => <div key={l.id} dir="ltr" className={`${card} text-caption`}><p className="font-medium">{l.action ?? l.source}</p><p className="break-all text-smoke">{l.target ?? l.message}</p><p className="text-smoke">{new Date(l.created_at).toLocaleString()}</p></div>)}</div>;
  }
  function Health() {
    const [d, load] = useData(() => A.health(csrf), []), [msg, setMsg] = useState(""), [parts] = useData(() => A.setupPartsCount(csrf), []);
    return <div className="flex flex-col gap-2">
      <div className="flex gap-2"><button className={btn} onClick={load}>إعادة الفحص</button><button className={btn} onClick={() => act(() => A.repairProfiles(csrf), load, "أُصلحت الحسابات")}>إصلاح الحسابات</button>
        {Array.from({ length: parts ?? 0 }).map((_, k) => <button key={k} className={btn} onClick={() => act(async () => { await navigator.clipboard.writeText(await A.setupSql(csrf, k)); }, () => {}, `نُسخ الجزء ${k + 1} — الصقه في SQL Editor ثم Run`)}>نسخ الجزء {k + 1}</button>)}
        <button className={`${btn} !border-brand/40 text-brand-ink`} onClick={async () => { setMsg("جارٍ التهيئة…"); const r = await A.runSetup(csrf); setMsg(r.msg); toast(r.ok ? "اكتملت التهيئة" : "انظر النتيجة أسفل الأزرار"); load(); }}>تهيئة تلقائية</button>
        <button className={`${btn} text-smoke`} onClick={async () => { if (!confirm("سيحذف كل بيانات جداول التطبيق (المنشورات والمتابعات والتعليقات…) ثم يعيد بناءها نظيفة. الحسابات نفسها لا تُحذف. متابعة؟")) return; setMsg("جارٍ إعادة البناء…"); const r = await A.resetSchema(csrf); setMsg(r.msg); toast(r.ok ? "أُعيد بناء الجداول" : "انظر النتيجة"); load(); }}>إعادة بناء الجداول</button></div>
      {msg && <p dir="auto" className="whitespace-pre-wrap rounded-xl bg-brand-tint p-4 text-caption text-charcoal">{msg}</p>}
      {!d ? <p className="py-6 text-center text-smoke">جارٍ الفحص…</p> : d.map((x, i) => <div key={i} className={`${card} flex items-start gap-4`}><span className={x.ok ? "text-brand-ink" : "text-charcoal"}>{x.ok ? "✓" : "⚠"}</span><div className="min-w-0 flex-1"><p className="text-sm">{x.name}</p>{x.detail && <p dir="ltr" className="break-all text-caption text-smoke">{x.detail}</p>}</div></div>)}
    </div>;
  }
  function Reports() {
    const [d, load] = useData(() => A.reports(csrf), []);
    if (d && !d.length) return <p className="py-10 text-center text-graphite">لا بلاغات معلّقة.</p>;
    return <div className="flex flex-col gap-4">{d?.map((r: any) => (
      <div key={r.id} className={`${card} flex flex-col gap-2`}><p className="text-caption text-smoke">{r.reason} · @{r.reporter?.username}</p><p className="line-clamp-3 text-sm">{r.prompt?.body}</p>
        <div className="flex gap-2"><button className={btn} onClick={() => act(() => A.reportOp(csrf, r.id, "dismiss"), load)}>تجاهل</button>
          <button className={btn} onClick={() => confirm("حذف البرومبت المُبلَّغ عنه؟") && act(() => A.reportOp(csrf, r.id, "delete"), load)}>حذف البرومبت</button></div></div>))}</div>;
  }
  function Verify() {
    const [d, load] = useData(() => A.verifications(csrf), []);
    if (d && !d.length) return <p className="py-10 text-center text-graphite">لا طلبات توثيق بعد.</p>;
    return <div className="flex flex-col gap-4">{d?.map((r: any) => (
      <div key={r.id} className={`${card} flex flex-col gap-2`}>
        <div className="flex items-center justify-between gap-2"><p className="text-sm font-medium">@{r.user?.username}{r.user?.verified ? " ✓ موثّق" : ""}</p>
          <span className={`chip !h-7 px-2 text-caption ${r.status === "pending" ? "chip-gold" : r.status === "approved" ? "chip-info" : ""}`}>{r.status === "pending" ? "معلّق" : r.status === "approved" ? "مقبول" : "مرفوض"}</span></div>
        {r.note && <p className="line-clamp-2 text-caption text-smoke">{r.note}</p>}
        <p className="text-caption text-smoke tabular-nums">برومبتات {r.stats?.prompts ?? 0} · إعجابات {r.stats?.likes ?? 0} · متابعون {r.stats?.followers ?? 0}</p>
        <div className="flex flex-wrap gap-2">
          <button className={dark} onClick={() => act(() => A.verifyUser(csrf, r.user_id, true), load, "تم التوثيق")}>قبول وتوثيق</button>
          <button className={btn} onClick={() => { const n = prompt("سبب الرفض (اختياري)") ?? ""; act(() => A.verifyUser(csrf, r.user_id, false, n), load, "تم الرفض"); }}>رفض</button>
          {r.user?.verified && <button className={btn} onClick={() => confirm("سحب شارة التوثيق؟") && act(() => A.verifyUser(csrf, r.user_id, false, "سُحبت شارة التوثيق"), load, "سُحبت الشارة")}>سحب الشارة</button>}
        </div>
      </div>))}</div>;
  }
  const V: Record<string, () => JSX.Element | null> = { health: Health, reports: Reports, verify: Verify, overview: Overview, users: Users, prompts: Prompts, cats: Cats, models: Models, system: System, ads: Ads, logs: Logs }, View = V[tab];
  return (
    <main className="flex flex-col gap-4 pt-4 pb-10">
      <header className="flex h-14 items-center justify-between"><h1 className="text-2xl font-bold tracking-tight">الإدارة</h1><button className={btn} onClick={async () => { await A.logout(); r.replace("/profile/me"); }}>خروج</button></header>
      <nav className="-mx-5 flex gap-2 overflow-x-auto px-5 [scrollbar-width:none]">{T.map(([k, l]) => <button key={k} onClick={() => { setTab(k); setQ(""); }} className={`shrink-0 ${tab === k ? dark : btn}`}>{l}</button>)}</nav>
      {(tab === "users" || tab === "prompts") && <Search key={tab} onChange={setQ} />}
      <View key={tab} />
    </main>
  );
}
