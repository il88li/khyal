"use client";
// app/community/page.tsx — المجتمع: تحدّي اليوم + الأكثر إعجابًا وأكثر تأثيرًا هذا الأسبوع + أطول السلاسل
import { useEffect, useState } from "react";
import Link from "next/link";
import { Flame, Heart, MessageCircle, Plus, Trophy, Users } from "@/components/icons";
import {  } from "@/components/ui";
import { explain, fmt, sb, thumb } from "@/lib/supabase";

type Author = { id: string; username: string | null; display_name: string | null; avatar_url: string | null } | null;
type Row = { id: string; body: string; enhanced: string | null; like_count: number; comment_count: number; created_at: string; author: Author };
type Person = { id: string; username: string | null; display_name: string | null; avatar_url: string | null; streak: number };

const Card = ({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) => (
  <section className="card flex flex-col gap-4 p-4">
    <h2 className="flex items-center gap-2 text-lg font-bold">{icon}{title}</h2>
    {children}
  </section>
);
const Avatar = ({ a }: { a: Author }) => (
  <span className="avatar h-9 w-9 bg-brand-tint text-brand-ink" data-i={(a?.display_name ?? a?.username ?? "؟").slice(0, 1)}>{a?.avatar_url && <img src={thumb(a.avatar_url, 400)} alt="" />}</span>
);

export default function Community() {
  const [top, setTop] = useState<Row[] | null>(null), [stars, setStars] = useState<{ a: Author; likes: number; posts: number }[]>([]);
  const [err, setErr] = useState("");
  useEffect(() => {
    (async () => {
      const since = new Date(Date.now() - 7 * 864e5).toISOString();
      try {
        const [w, a] = await Promise.all([
          sb.from("prompts").select("id,body,enhanced,like_count,comment_count,created_at,author:profiles!author_id(id,username,display_name,avatar_url)").gte("created_at", since).order("like_count", { ascending: false }).limit(10),
          sb.from("prompts").select("like_count,author:profiles!author_id(id,username,display_name,avatar_url)").gte("created_at", since).order("like_count", { ascending: false }).limit(50),
        ]);
        if (w.error) throw w.error;
        setTop((w.data as unknown as Row[]) ?? []);
        const m = new Map<string, { a: Author; likes: number; posts: number }>();
        for (const r of (a.data ?? []) as unknown as { like_count: number; author: Author }[]) {
          if (!r.author?.id) continue;
          const e = m.get(r.author.id) ?? { a: r.author, likes: 0, posts: 0 };
          e.likes += r.like_count ?? 0; e.posts++; m.set(r.author.id, e);
        }
        setStars([...m.values()].sort((x, y) => y.likes - x.likes).slice(0, 5));
      } catch (e: any) { setErr(explain(e)); setTop([]); }
    })();
  }, []);

  return (
    <main className="flex flex-col gap-4 pb-5">
      <Card title="الأكثر إعجابًا هذا الأسبوع" icon={<Trophy size={21} className="text-brand-ink" />}>
        {!top ? <div className="h-40 animate-pulse rounded-xl bg-mist" />
          : err ? <p className="text-sm text-graphite">{err}</p>
          : !top.length ? <p className="py-6 text-center text-sm text-graphite">لا نتائج هذا الأسبوع بعد — كن أول من يشارك نتيجته.</p>
          : <ol className="flex flex-col gap-2">{top.map((r, i) => (
            <li key={r.id}>
              <Link href={`/p/${r.id}`} className="flex items-start gap-4 rounded-xl bg-fog p-4 active:opacity-70">
                <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-caption font-bold ${i < 3 ? "bg-brand text-snow" : "bg-mist text-graphite"}`}>{i + 1}</span>
                <span className="min-w-0 flex-1">
                  <span className="line-clamp-2 block text-sm">{r.enhanced ?? r.body}</span>
                  <span className="mt-1 flex flex-wrap items-center gap-4 text-caption text-smoke">
                    <span className="truncate">{r.author?.display_name ?? r.author?.username ?? "مستخدم"}</span>
                    <span className="flex items-center gap-1"><Heart size={16} />{fmt(r.like_count)}</span>
                    <span className="flex items-center gap-1"><MessageCircle size={16} />{fmt(r.comment_count)}</span>
                  </span>
                </span>
              </Link>
            </li>))}</ol>}
      </Card>

      <Card title="الأكثر تأثيرًا هذا الأسبوع" icon={<Users size={21} className="text-brand-ink" />}>
        {!stars.length ? <p className="py-4 text-center text-sm text-graphite">لا نشاط كافٍ بعد.</p>
          : <ul className="flex flex-col gap-1">{stars.map(({ a, likes, posts }) => (
            <li key={a!.id}>
              <Link href={`/profile/${a!.id}`} className="flex min-h-11 items-center gap-4 rounded-xl px-2 active:bg-mist">
                <Avatar a={a} />
                <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{a?.display_name ?? a?.username ?? "مستخدم"}</span>
                  <span className="text-caption text-smoke">{fmt(likes)} إعجاباً · {posts} منشوراً</span></span>
                <span className="btn btn-soft !min-h-10 !px-3 !text-caption">زيارة</span>
              </Link>
            </li>))}</ul>}
      </Card>

      <section className="flex flex-col items-center gap-4 rounded-xl border border-brand/30 bg-brand-tint p-4 text-center">
        <p className="text-base font-semibold">شارِك نتيجتك اليوم</p>
        <p className="max-w-[36ch] text-caption text-graphite">ما تتعلّمه اليوم يفيد غيرك غدًا — انشر برومبتك وانضم إلى ترتيب الأسبوع.</p>
        <div className="flex flex-wrap justify-center gap-2">
          <Link href="/new" className="btn btn-primary"><Plus size={19} />شارك نتيجتك</Link>
          <Link href="/enhance" className="btn">حسّن برومبتك</Link>
        </div>
      </section>
    </main>
  );
}
