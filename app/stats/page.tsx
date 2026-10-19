"use client";
// app/stats/page.tsx — إحصاءات المنشئ: مجاميع الإعجاب/التعليق/النسخ/التفريع + أفضل برومبتاتك أداءً
import { useEffect, useState } from "react";
import Link from "next/link";
import { Heart, MessageCircle, Copy, GitFork, FileText, Users, Flame } from "@/components/icons";
import { sb, uid, fmt, explain } from "@/lib/supabase";
import { EmptyState, ErrorState, Skeleton } from "@/components/states";
import { BadgeGrid, type BStats } from "@/components/badges";

type Row = { id: string; body: string; enhanced: string | null; like_count: number; comment_count: number; copy_count?: number; fork_count?: number };
const score = (r: Row) => r.like_count + r.comment_count * 2 + (r.copy_count ?? 0) * 2 + (r.fork_count ?? 0) * 3;

export default function Stats() {
  const [rows, setRows] = useState<Row[] | null>(null), [followers, setFollowers] = useState(0), [streak, setStreak] = useState<{ s: number; b: number } | null>(null), [err, setErr] = useState(""), [taught, setTaught] = useState(0), [tick, setTick] = useState(0);
  useEffect(() => {
    (async () => {
      const id = await uid(); if (!id) return;
      let r: any = await sb.from("prompts").select("id,body,enhanced,like_count,comment_count,copy_count,fork_count").eq("author_id", id).order("created_at", { ascending: false }).limit(200);
      if (r.error) r = await sb.from("prompts").select("id,body,enhanced,like_count,comment_count").eq("author_id", id).order("created_at", { ascending: false }).limit(200); // قبل تهيئة أعمدة النسخ
      if (r.error) { setErr(explain(r.error)); setRows([]); return; }
      setRows(r.data ?? []);
      const f = await sb.from("follows").select("*", { count: "exact", head: true }).eq("following_id", id).eq("status", "accepted"); setFollowers(f.count ?? 0);
      const c = await sb.from("comments").select("*", { count: "exact", head: true }).eq("author_id", id); setTaught(c.count ?? 0); // شارة «معلّم»
    })();
  }, [tick]);

  const sum = (k: keyof Row) => (rows ?? []).reduce((a, r) => a + ((r[k] as number) ?? 0), 0);
  const top = [...(rows ?? [])].sort((a, b) => score(b) - score(a)).slice(0, 5), max = Math.max(1, ...top.map(score));
  const badges: BStats = { prompts: rows?.length ?? 0, likes: sum("like_count"), comments: sum("comment_count"), copies: sum("copy_count"), forks: sum("fork_count"), followers, taught, streak: streak?.s ?? 0, best: streak?.b ?? 0 };
  const tiles = [[FileText, "برومبتات", rows?.length ?? 0, "bg-brand-tint text-brand-ink"], [Users, "متابعون", followers, "bg-ok-tint text-ok-ink"], [Heart, "إعجابات", sum("like_count"), "bg-danger-tint text-danger"], [MessageCircle, "تعليقات", sum("comment_count"), "bg-info-tint text-info-ink"], [Copy, "مرات النسخ", sum("copy_count"), "bg-gold-tint text-gold-ink"], [GitFork, "تفريعات", sum("fork_count"), "bg-secondary-tint text-secondary"]] as const;

  if (err) return <ErrorState message={err} onRetry={() => { setErr(""); setRows(null); setTick((t) => t + 1); }} />;
  if (!rows) return <Skeleton variant="grid" count={6} className="pt-2" />;
  if (!rows.length) return (
    <div className="flex flex-col gap-4">
      <EmptyState icon={FileText} title="لا إحصاءات بعد" hint="انشر أول برومبت لتظهر إحصاءاتك هنا." action={{ label: "انشر الآن", href: "/new" }} />
      <BadgeGrid s={badges} />
    </div>);
  return (
    <main className="flex flex-col gap-4 pt-2 pb-4">
      <div className="bento">
        {tiles.map(([Icon, label, v, tone], i) => (
          <div key={label} className={`stat-tile${i === 0 ? " span-2 md-span-2" : ""}`}>
            <span className={`stat-icon ${tone}`}><Icon size={20} /></span>
            <p className="stat-value">{fmt(v)}</p><p className="stat-label">{label}</p>
          </div>))}
      </div>
      <BadgeGrid s={badges} />
      <section className="flex flex-col gap-4 card p-4 shadow-soft">
        <h2 className="text-lg font-bold text-charcoal">الأفضل أداءً</h2>
        {top.map((r) => (
          <Link key={r.id} href={`/p/${r.id}`} className="flex flex-col gap-1.5">
            <span className="line-clamp-1 text-sm">{r.enhanced ?? r.body}</span>
            <span className="h-2 overflow-hidden rounded-full bg-mist"><span className="block h-full rounded-full bg-brand" style={{ width: `${Math.max(6, (score(r) / max) * 100)}%` }} /></span>
            <span className="text-caption text-smoke">♥ {r.like_count} · 💬 {r.comment_count} · نسخ {r.copy_count ?? 0} · تفريع {r.fork_count ?? 0}</span>
          </Link>))}
      </section>
    </main>
  );
}
