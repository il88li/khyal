"use client";
// app/pricing/page.tsx — الأسعار: مقارنة بسيطة بين المجاني و«خيال برو» + بوابة الدفع
import { useState } from "react";
import Link from "next/link";
import { Check, Sparkles } from "@/components/icons";
import { useAuth } from "@/components/auth";
import { toast } from "@/lib/supabase";

const FREE = ["تحسين البرومبتات بلا حدود يومية", "مكتبة شخصية وتنظيم بالفئات", "متابعة المبدعين والتفاعل", "عرض 80% من كل برومبت"];
const PRO = ["عرض البرومبتات كاملة", "حدود تحسين أعلى وأولوية في المعالجة", "شارة «برو» على ملفك", "دعم تطوير خيال مباشرة"];

export default function Pricing() {
  const { status, me } = useAuth();
  const [busy, setBusy] = useState(false);
  const isPro = me?.plan === "pro";

  async function upgrade() {
    if (status !== "in") return toast("سجّل الدخول أولاً");
    setBusy(true);
    try {
      const r = await fetch("/api/plan", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ plan: "pro" }) });
      const j = await r.json().catch(() => ({}));
      if (r.ok && j.url) { location.href = j.url; return; }
      toast(j.message || "الاشتراك المدفوع قيد التجهيز — سنعلمك عند إطلاقه");
    } catch { toast("تعذّر بدء الدفع الآن، أعد المحاولة"); }
    setBusy(false);
  }

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-5 pt-6 pb-8">
      <header className="flex flex-col items-center gap-3 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-tint text-brand-ink"><Sparkles size={26} /></span>
        <h1 className="text-h2 font-bold text-charcoal">خطط خيال</h1>
        <p className="max-w-[46ch] text-base text-graphite">ابدأ مجاناً. وارفع إلى «خيال برو» حين تريد رؤية البرومبتات كاملة وحدوداً أعلى.</p>
      </header>

      <section className="grid gap-4 sm:grid-cols-2">
        <article className="card flex flex-col gap-3 p-4">
          <h2 className="text-lg font-bold text-charcoal">المجاني</h2>
          <p className="text-h2 font-extrabold text-charcoal">0<span className="text-sm font-medium text-smoke"> ريال</span></p>
          <ul className="flex flex-col gap-2">
            {FREE.map((x) => <li key={x} className="flex items-start gap-2 text-sm text-graphite"><Check size={16} className="mt-0.5 shrink-0 text-brand-ink" />{x}</li>)}
          </ul>
          {status === "in" && !isPro
            ? <span className="btn btn-soft mt-auto w-full">خطتك الحالية</span>
            : <Link href={status === "in" ? "/" : "/auth?mode=up"} className="btn btn-soft mt-auto w-full">{status === "in" ? "المجاني" : "ابدأ مجاناً"}</Link>}
        </article>

        <article className="card flex flex-col gap-3 p-4">
          <div className="flex items-center justify-between"><h2 className="text-lg font-bold text-charcoal">خيال برو</h2><span className="chip bg-brand-tint text-brand-ink">الأفضل</span></div>
          <p className="text-h2 font-extrabold text-charcoal">19<span className="text-sm font-medium text-smoke"> ريال / شهرياً</span></p>
          <ul className="flex flex-col gap-2">
            {PRO.map((x) => <li key={x} className="flex items-start gap-2 text-sm text-graphite"><Check size={16} className="mt-0.5 shrink-0 text-brand-ink" />{x}</li>)}
          </ul>
          {isPro
            ? <span className="btn btn-soft mt-auto w-full">أنت مشترك ★</span>
            : <button onClick={upgrade} disabled={busy} className="btn btn-primary mt-auto w-full">{busy ? "جارٍ التحويل…" : "رقِّ إلى برو"}</button>}
        </article>
      </section>

      <p className="text-center text-caption text-smoke">الدفع آمن، ويمكنك الإلغاء في أي وقت. تفاصيل الفواتير تظهر في الإعدادات بعد الاشتراك.</p>
    </main>
  );
}
