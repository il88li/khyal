"use client";
// components/AdSlot.tsx — مساحة إعلانية واحدة وواضحة الوسم.
// - إعلان فعّال إن وُجد في settings بالمفتاح `ad:<slot>`، وإلا مخطط دعوة للإعلان لدى خيال.
// - الإعلان يُخزَّن: { title, body?, cta?, href, image?, active? }
// - تتبّع الظهور (impression) والنقر (click) عبر /api/ad.
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ExternalLink, Megaphone } from "@/components/icons";
import { Skeleton } from "./states";
import { sb } from "@/lib/supabase";

type Ad = { title: string; body?: string; cta?: string; href: string; image?: string; active?: boolean };
const https = (u?: string) => !!u && /^https?:\/\//i.test(u);

/** يسجّل حدث إعلان مرة واحدة لكل نوع في كل تشغيل — لا يزعج المستخدم ولا يعطّل العرض */
function track(slot: string, kind: "impression" | "click") {
  try {
    const key = `khiyal:ad:${slot}:${kind}`;
    if (kind === "impression" && sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");
    const body = JSON.stringify({ slot, kind });
    if (navigator.sendBeacon) navigator.sendBeacon("/api/ad", new Blob([body], { type: "application/json" }));
    else fetch("/api/ad", { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true }).catch(() => {});
  } catch {}
}

export function AdSlot({ slot, className = "" }: { slot: string; className?: string }) {
  const [ad, setAd] = useState<Ad | null | undefined>(undefined);
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    let dead = false;
    sb.from("settings").select("value").eq("key", `ad:${slot}`).maybeSingle().then(
      ({ data, error }) => {
        const v = data?.value as Ad | undefined;
        if (!dead) setAd(!error && v && v.active !== false && v.title && https(v.href) ? v : null);
      },
      () => !dead && setAd(null),
    );
    return () => { dead = true; };
  }, [slot]);

  // ظهور الإعلان: يُحتسب مرة واحدة عند دخوله الشاشة فعلياً
  useEffect(() => {
    if (!ad || !ref.current) return;
    const el = ref.current;
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) { track(slot, "impression"); io.disconnect(); }
    }, { threshold: 0.5 });
    io.observe(el);
    return () => io.disconnect();
  }, [ad, slot]);

  if (ad === undefined) return <Skeleton variant="list" count={1} className={className} />;

  // إعلان فعّال — وسم «إعلان» صريح في الأعلى
  if (ad)
    return (
      <aside ref={ref} aria-label="إعلان" className={`card flex flex-col gap-4 p-4 ${className}`}>
        <span className="chip self-start text-micro text-smoke">إعلان مُموَّل</span>
        {https(ad.image) && <img src={ad.image} alt="" loading="lazy" decoding="async" width={640} height={360} className="aspect-video w-full rounded-xl object-cover" />}
        <div className="flex flex-col gap-1"><p className="text-lg font-bold text-charcoal">{ad.title}</p>{ad.body && <p className="text-sm text-graphite">{ad.body}</p>}</div>
        <a href={ad.href} target="_blank" rel="sponsored noopener noreferrer" onClick={() => track(slot, "click")} className="btn btn-primary btn-md self-start"><ExternalLink size={16} />{ad.cta || "اعرف المزيد"}</a>
      </aside>
    );

  // لا إعلان: مخطط البطاقة + دعوة واحدة للإعلان (لا يتكرر بنفس الوسم)
  return (
    <aside aria-label="مساحة إعلانية متاحة" className={`card flex flex-col gap-4 p-4 ${className}`}>
      <span className="chip self-start text-micro text-smoke">إعلان</span>
      <div className="flex items-center gap-2 text-brand-ink"><Megaphone size={24} /><span className="text-sm font-semibold">مساحة إعلانية</span></div>
      <div aria-hidden="true" className="flex flex-col gap-2">
        <div className="aspect-video w-full rounded-xl bg-mist" />
        <div className="h-3 w-2/3 rounded-full bg-mist" /><div className="h-3 w-full rounded-full bg-mist" /><div className="h-8 w-28 rounded-full bg-mist" />
      </div>
      <div className="flex flex-col gap-1">
        <p className="text-lg font-bold text-charcoal">أعلن لدى خيال</p>
        <p className="text-sm text-graphite">اوصل إلى صنّاع المحتوى والمبدعين العرب في المكان الذي يبحثون فيه عن الإلهام كل يوم.</p>
      </div>
      <Link href="/advertise" className="btn btn-primary btn-md self-start">أعلن معنا</Link>
    </aside>
  );
}
