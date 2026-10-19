"use client";
// app/search/page.tsx — اكتشاف فوري ببطاقات منتظمة للبرومبتات والمبدعين
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Search as SearchIcon, X, UserRound } from "@/components/icons";
import { motion, AnimatePresence } from "framer-motion";
import { sb, explain, thumb, withMeta } from "@/lib/supabase";
import { Lightbox, Skeleton } from "@/components/ui";
import { PromptCover } from "@/components/PromptCover";
import { VerifiedBadge } from "@/components/badges";
import type { PromptRow } from "@/types";

type Person = { id: string; username: string | null; display_name: string | null; avatar_url: string | null; bio: string | null };
const SEL = "id,body,enhanced,model,images,like_count,comment_count,created_at,category_id,author:profiles!author_id(id,username,display_name,avatar_url)";


// بلاطة استكشاف: صورة فعلية عند توفرها، وإلا يعرض النص نفسه بلا صورة وهمية.
function Tile({ p, i, onOpen }: { p: PromptRow; i: number; onOpen: (p: PromptRow) => void }) {
  const im = p.images?.[0], text = (p.enhanced || p.body || "").trim(), name = p.author?.display_name ?? p.author?.username ?? "";
  return (
    <motion.article initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i, 8) * 0.04, type: "spring", stiffness: 260, damping: 26 }}
      className={`search-tile group overflow-hidden rounded-xl border border-silver bg-snow transition-shadow${i === 0 ? " featured" : ""}`}>
      {im ? (
        <button onClick={() => onOpen(p)} aria-label="معاينة الصورة" className="block w-full">
          <img src={thumb(im.url, 800)} alt="" loading="lazy" width={im.w} height={im.h} className="w-full object-cover" style={im.w && im.h ? { aspectRatio: `${im.w}/${im.h}` } : undefined} />
        </button>
      ) : (
        /* بلا صورة: شريط غلاف مصمّم يحافظ على جمال البلاطة */
        <Link href={`/p/${p.id}`} aria-label="فتح البرومبت" className="block">
          <PromptCover variant="band" author={name} />
        </Link>
      )}
      <Link href={`/p/${p.id}`} className="flex h-full flex-col gap-4 p-4">
        <p className="line-clamp-5 text-base leading-[1.8] text-charcoal">{text}</p>
        {name && <span className="mt-auto flex items-center gap-1 truncate border-t border-silver pt-3 text-caption font-medium text-graphite">{name}{p.author?.verified && <VerifiedBadge size={14} />}</span>}
      </Link>
    </motion.article>
  );
}

export default function SearchPage() {
  const [q, setQ] = useState(""), [tab, setTab] = useState<"p" | "u">("p"), input = useRef<HTMLInputElement>(null);
  const [prompts, setPrompts] = useState<PromptRow[]>([]), [people, setPeople] = useState<Person[]>([]);
  const [light, setLight] = useState<PromptRow | null>(null), [busy, setBusy] = useState(false), [done, setDone] = useState(false), [err, setErr] = useState("");
  useEffect(() => { if (matchMedia("(pointer: fine)").matches) input.current?.focus(); }, []);
  // البحث الشامل في الهيدر يمرّر الكلمة عبر ?q= — نزرعها في الحقل عند الوصول
  useEffect(() => {
    const seed = new URLSearchParams(window.location.search).get("q");
    if (seed) { setQ(seed); input.current?.focus(); }
  }, []);
  useEffect(() => {
    const term = q.trim().replace(/[%,()*]/g, " ").trim();
    if (term.length < 2) { setPrompts([]); setPeople([]); setDone(false); setErr(""); return; }
    let stale = false;
    const t = setTimeout(async () => {
      setBusy(true); setErr("");
      const [a, b] = await Promise.all([
        sb.from("prompts").select(SEL).or(`body.ilike.%${term}%,enhanced.ilike.%${term}%`).order("created_at", { ascending: false }).limit(20),
        sb.from("profiles").select("id,username,display_name,avatar_url,bio").or(`username.ilike.%${term}%,display_name.ilike.%${term}%`).eq("banned", false).limit(20),
      ]);
      if (stale) return;
      if (a.error || b.error) setErr(explain(a.error ?? b.error));
      setPrompts(await withMeta((a.data as unknown as PromptRow[]) ?? [])); setPeople((b.data as Person[]) ?? []); setDone(true); setBusy(false);
    }, 320);
    return () => { stale = true; clearTimeout(t); };
  }, [q]);

  const empty = (t: string) => <p className="py-16 text-center text-graphite">{t}</p>;
  return (
    <main className="search-page flex flex-col gap-5 pt-2">
      <div className="relative">
        <SearchIcon size={21} className="absolute start-4 top-1/2 -translate-y-1/2 text-smoke" />
        <input ref={input} value={q} onChange={(e) => setQ(e.target.value)} placeholder="ابحث في البرومبتات والأشخاص…" enterKeyHint="search"
          className="field !min-h-14 ps-11 pe-12" />
        {q && <button onClick={() => { setQ(""); input.current?.focus(); }} aria-label="مسح" className="absolute end-1 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center text-smoke"><X size={21} /></button>}
      </div>
      <div className="seg">
        {([["p", `برومبتات${done ? ` (${prompts.length})` : ""}`], ["u", `أشخاص${done ? ` (${people.length})` : ""}`]] as const).map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} className={`relative ${tab === k ? "bg-snow shadow-soft" : ""}`} data-on={tab === k ? "1" : undefined}>{l}</button>))}
      </div>
      {busy && <div className="search-grid">{[160, 210, 175, 230, 185, 155].map((h, k) => <div key={k} className="card overflow-hidden p-4.5"><div className="skel mb-3 w-full" style={{ height: h }} /><Skeleton lines={2} /></div>)}</div>}
      {err && <p className="py-8 text-center text-graphite">{err}</p>}
      {!busy && !err && !done && empty("اكتب كلمتين على الأقل للبحث")}
      {!busy && !err && done && tab === "p" && (prompts.length ? <div className="search-grid pb-4">{prompts.map((p, i) => <Tile key={p.id} p={p} i={i} onOpen={setLight} />)}</div> : empty("لا توجد برومبتات مطابقة"))}
      {!busy && !err && done && tab === "u" && (people.length ? (
        <div className="flex flex-col gap-2 pb-4">{people.map((u) => (
          <Link key={u.id} href={`/profile/${u.id}`} className="card flex items-center gap-4 p-4.5">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand/20 text-brand-ink">{u.avatar_url ? <img src={u.avatar_url} alt="" className="h-full w-full object-cover" /> : <UserRound size={23} />}</span>
            <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{u.display_name ?? u.username}</span><span dir="ltr" className="block truncate text-start text-caption text-smoke">@{u.username}</span></span>
          </Link>))}</div>) : empty("لا يوجد أشخاص مطابقون"))}
    <AnimatePresence>{light?.images?.length ? <Lightbox images={light.images} onClose={() => setLight(null)} /> : null}</AnimatePresence>
    </main>
  );
}
