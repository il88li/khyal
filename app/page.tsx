"use client";
// app/page.tsx — Feed: تبويبات، لا نهائي، Pull-to-refresh، Realtime، حفظ الموضع
import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import { AdSlot } from "@/components/AdSlot";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { Loader2, Sparkles } from "@/components/icons";
import PromptCard from "@/components/PromptCard";
import { sb, uid, explain, withMeta } from "@/lib/supabase";
import { rankForYou } from "@/lib/algorithm";
import { hasCardFx } from "@/lib/cardFx";
import { readInterests } from "@/lib/taxonomy";
import CreatorCardSlot from "@/components/CreatorCardSlot";
import FeedBand from "@/components/FeedBand";
import Link from "next/link";
import type { PromptRow } from "@/types";

/* بطاقة المبدع في الخلاصة: مرة واحدة لكل كاتب في الجلسة */
const feedCards = new Set<string>();
function maybeFeedCard(p: PromptRow) {
  const id = p.author?.id;
  if (!id || feedCards.has(id) || !hasCardFx(p.author?.card_fx)) return null;
  feedCards.add(id);
  return (
    <CreatorCardSlot
      compact
      fxRaw={p.author!.card_fx}
      profileId={id}
      profile={{ name: p.author!.display_name || p.author!.username || "مبدع خيال", username: p.author!.username, avatar_url: p.author!.avatar_url, prompts: 0, likes: 0, followers: 0 }}
    />
  );
}

const TABS = [["foryou", "مختار لك"], ["following", "أتابعه"], ["trending", "رائج"], ["cats", "الفئات"]] as const;
type Tab = (typeof TABS)[number][0];
const PAGE = 10;
const SEL = "id,body,enhanced,model,images,like_count,comment_count,created_at,category_id,author:profiles!author_id(id,username,display_name,avatar_url,card_fx)";
type PageOut = { rows: PromptRow[]; note?: string };
const cache: Record<string, { items: PromptRow[]; page: number; done: boolean; y: number; note?: string }> = {};

/** اهتماماتي: ما اخترته صراحةً + ما يُستنتج من إعجابي وحفظي — تُحسب مرة كل نصف ساعة */
let prefCache: { userId: string; ids: number[]; names: string; at: number } | null = null;
let catCache: { bySlug: Map<string, number>; byId: Map<number, string>; at: number } | null = null;

/** فهرس التصنيفات (slug ↔ id) — يُجلب مرة ويُخزّن نصف ساعة. */
async function categoriesIndex() {
  if (catCache && Date.now() - catCache.at < 1_800_000) return catCache;
  const bySlug = new Map<string, number>(), byId = new Map<number, string>();
  const { data, error } = await sb.from("categories").select("id,slug,name_ar");
  if (!error) for (const c of (data ?? []) as any[]) { bySlug.set(c.slug, c.id); byId.set(c.id, c.name_ar); }
  catCache = { bySlug, byId, at: Date.now() };
  return catCache;
}

async function interests(me: string | null) {
  if (!me) return null;
  if (prefCache && prefCache.userId === me && Date.now() - prefCache.at < 1_800_000) return prefCache;
  try {
    const idx = await categoriesIndex();

    // (1) الاهتمامات المُعلنة: من الجهاز مباشرةً، ومن الملف إن كان العمود مهيّأً
    let declared: string[] = readInterests();
    try {
      const { data } = await sb.from("profiles").select("interests").eq("id", me).maybeSingle();
      const db = (data as any)?.interests;
      if (Array.isArray(db)) declared = Array.from(new Set([...declared, ...db.filter((s: unknown): s is string => typeof s === "string")]));
    } catch {}
    const top: number[] = declared.map((s) => idx.bySlug.get(s)).filter((n): n is number => typeof n === "number");

    // (2) الاستنتاج من الإعجاب والحفظ
    const [lk, sv] = await Promise.all([
      sb.from("likes").select("prompt_id").eq("user_id", me).limit(60),
      sb.from("saves").select("prompt_id").eq("user_id", me).limit(60),
    ]);
    const ids = Array.from(new Set([...(lk.data ?? []), ...(sv.data ?? [])].map((x: any) => x.prompt_id as string))).slice(0, 120);
    if (ids.length) {
      const { data: ps } = await sb.from("prompts").select("category_id").in("id", ids).not("category_id", "is", null);
      const cnt = new Map<number, number>();
      for (const p of (ps ?? []) as any[]) if (p.category_id != null) cnt.set(p.category_id, (cnt.get(p.category_id) ?? 0) + 1);
      for (const [id] of [...cnt.entries()].sort((a, b) => b[1] - a[1])) if (!top.includes(id)) top.push(id);
    }

    const picked = top.slice(0, 5);
    const names = picked.map((id) => idx.byId.get(id)).filter(Boolean).join("، ");
    prefCache = { userId: me, ids: picked, names, at: Date.now() };
    return prefCache;
  } catch {
    return null;
  }
}

async function fetchPage(tab: Tab, cat: number | null, page: number): Promise<PageOut> {
  const me = await uid();
  const p = tab === "foryou" ? await interests(me ?? null) : null;
  const usePref = !!p?.ids.length;

  const build = async (applyPref: boolean): Promise<PromptRow[] | null> => {
    let q = sb.from("prompts").select(SEL).range(page * PAGE, page * PAGE + PAGE - 1);
    q = tab === "trending"
      ? q.order("like_count", { ascending: false }).order("created_at", { ascending: false })
      : q.order("pinned", { ascending: false }).order("created_at", { ascending: false });
    if (tab === "following") {
      const { data: f } = await sb.from("follows").select("following_id").eq("follower_id", me ?? "").eq("status", "accepted");
      if (!f?.length) return [];
      q = q.in("author_id", f.map((x) => x.following_id));
    }
    if (tab === "cats" && cat) q = q.eq("category_id", cat);
    if (applyPref && usePref) q = q.in("category_id", p!.ids);
    const { data, error } = await q;
    if (error) throw error;
    return (data ?? []) as unknown as PromptRow[];
  };

  let rows = await build(true);
  let note = rows?.length && page === 0 && usePref ? `مُختارة لك حسب اهتمامك بـ${p!.names || "مجالاتك"}` : undefined;
  if (!rows?.length && page === 0 && usePref && tab === "foryou") {
    rows = await build(false);
    note = undefined;
  }
  const list = rows ?? [];
  if (me && list.length) {
    const ids = list.map((r) => r.id);
    const [l, s] = await Promise.all([
      sb.from("likes").select("prompt_id").eq("user_id", me).in("prompt_id", ids),
      sb.from("saves").select("prompt_id").eq("user_id", me).in("prompt_id", ids),
    ]);
    const L = new Set(l.data?.map((x) => x.prompt_id));
    const S = new Set(s.data?.map((x) => x.prompt_id));
    list.forEach((r) => { r.liked = L.has(r.id); r.saved = S.has(r.id); });
  }
  if (list.length) {
    const x = await sb.from("prompts").select("id,forked_from,copy_count,fork_count").in("id", list.map((r) => r.id));
    if (!x.error) {
      const M = new Map((x.data ?? []).map((r: any) => [r.id, r]));
      list.forEach((r) => Object.assign(r, M.get(r.id) ?? {}));
    }
  }
  await gateRows(list);
  // خوارزمية التوزيع: ترتيب «مختار لك» و«رائج» حسب السرعة/الجِدة/الجودة/الاهتمام بدل الزمن الخام
  const rank = tab === "foryou" ? rankForYou(list, p?.ids ?? []) : tab === "trending" ? rankForYou(list) : list;
  return { rows: rank, note };
}

/** يفرض حدود رؤية البرومبت من جهة الخادم (RPC) ويجلب العنوان/الوسوم — مع احتياطٍ إن لم تُنفَّذ الهجرة */
async function gateRows(list: PromptRow[]) {
  if (!list.length) return;
  try {
    const { data, error } = await sb.rpc("prompts_gated", { p_ids: list.map((r) => r.id) });
    const arr = (data ?? []) as any[];
    if (!error && arr.length) {
      const M = new Map(arr.map((r) => [r.id, r]));
      list.forEach((r) => { const g = M.get(r.id); if (g) Object.assign(r, { body: g.body, enhanced: g.enhanced, locked: g.locked, hidden: g.hidden, title: g.title ?? r.title, tags: g.tags ?? r.tags, author: g.author ? { ...r.author, verified: g.author.verified ?? r.author?.verified } : r.author }); });
      return;
    }
  } catch {}
  await withMeta(list); // احتياطي: عنوان/وسوم فقط
}

const Skeleton = () => (
  <div className="card prompt-card prompt-card-skel" aria-hidden>
    <div className="prompt-card-head">
      <div className="skel h-10 w-10 shrink-0 rounded-full" />
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="skel h-3.5 w-28 rounded-full" />
        <div className="skel h-3 w-16 rounded-full" />
      </div>
      <div className="skel h-8 w-20 shrink-0 rounded-full" />
    </div>
    <div className="prompt-card-media skel" />
    <div className="prompt-card-copy-wrap flex flex-col gap-2">
      <div className="skel h-3.5 w-full rounded-full" />
      <div className="skel h-3.5 w-3/4 rounded-full" />
    </div>
    <div className="prompt-card-footer">
      <div className="skel h-6 w-32 rounded-full" />
      <div className="skel h-9 w-full rounded-full" />
    </div>
  </div>
);

export default function Feed() {
  const router = useRouter();
  useEffect(() => {
    uid().then(async (id) => {
      if (!id) return;
      const { data, error } = await sb.from("profiles").select("onboarded").eq("id", id).maybeSingle();
      if (!error && !data?.onboarded) router.replace("/setup");
    });
  }, []); // eslint-disable-line

  const [tab, setTab] = useState<Tab>("foryou");
  const [cat, setCat] = useState<number | null>(null);
  const [cats, setCats] = useState<{ id: number; name_ar: string }[]>([]);
  const [items, setItems] = useState<PromptRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [done, setDone] = useState(false);
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [note, setNote] = useState("");
  const page = useRef(0);
  const busy = useRef(false);
  const end = useRef<HTMLDivElement>(null);
  const key = `${tab}:${cat}`;

  const load = useCallback(async (reset = false) => {
    if (busy.current) return;
    busy.current = true;
    setLoading(true);
    if (reset) { page.current = 0; setDone(false); }
    let out: PageOut = { rows: [] };
    try {
      out = await fetchPage(tab, cat, page.current);
      setErr("");
    } catch (e: any) {
      setErr(explain(e));
      setLoading(false);
      busy.current = false;
      return;
    }
    if (reset) setNote(out.note ?? "");
    const rows = out.rows;
    page.current++;
    const fin = rows.length < PAGE;
    setDone(fin);
    setItems((p) => (reset ? rows : [...p, ...rows]));
    setLoading(false);
    busy.current = false;
  }, [tab, cat]);

  const itemsRef = useRef(items), doneRef = useRef(done), noteRef = useRef(note);
  itemsRef.current = items;
  doneRef.current = done;
  noteRef.current = note;

  useEffect(() => {
    if ((window as any).__feedDirty) {
      Object.keys(cache).forEach((k) => delete cache[k]);
      prefCache = null;
      (window as any).__feedDirty = false;
    }
    const c = cache[key];
    if (c) {
      setItems(c.items);
      page.current = c.page;
      setDone(c.done);
      setNote(c.note ?? "");
      setLoading(false);
      requestAnimationFrame(() => window.scrollTo(0, c.y));
    } else {
      setItems([]);
      load(true);
    }
    return () => {
      cache[key] = { items: itemsRef.current, page: page.current, done: doneRef.current, y: window.scrollY, note: noteRef.current };
    };
  }, [key]); // eslint-disable-line

  useEffect(() => {
    sb.from("categories").select("id,name_ar").eq("active", true).order("sort").then(({ data }) => data && setCats(data));
  }, []);

  useEffect(() => {
    const el = end.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => e.isIntersecting && !done && !busy.current && items.length && load(),
      { rootMargin: "400px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [done, items.length, load]);

  useEffect(() => {
    const ch = sb
      .channel("prompts-live")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "prompts" }, (p: any) =>
        setItems((it) => it.map((x) => (x.id === p.new.id ? { ...x, like_count: p.new.like_count, comment_count: p.new.comment_count } : x))),
      )
      .subscribe();
    return () => { sb.removeChannel(ch); };
  }, []);

  useEffect(() => {
    let y0 = 0, d = 0;
    const s = (e: TouchEvent) => { y0 = window.scrollY <= 0 ? e.touches[0].clientY : -1; d = 0; };
    const m = (e: TouchEvent) => { if (y0 < 0) return; d = Math.max(0, (e.touches[0].clientY - y0) * 0.5); setPull(Math.min(d, 90)); };
    const en = async () => {
      if (d > 70) {
        setRefreshing(true);
        delete cache[key];
        busy.current = false;
        await load(true);
        navigator.vibrate?.(10);
        setRefreshing(false);
      }
      setPull(0);
      y0 = -1;
    };
    window.addEventListener("touchstart", s, { passive: true });
    window.addEventListener("touchmove", m, { passive: true });
    window.addEventListener("touchend", en);
    return () => {
      window.removeEventListener("touchstart", s);
      window.removeEventListener("touchmove", m);
      window.removeEventListener("touchend", en);
    };
  }, [key, load]);

  const go = (d: number) => {
    const i = TABS.findIndex((t) => t[0] === tab) + d;
    if (TABS[i]) setTab(TABS[i][0]);
  };

  return (
    <main className="feed-main flex flex-col gap-4">
      <header className="feed-tabs-header flex flex-col pb-1 pt-1">
        <nav className="seg feed-tabs" aria-label="تصفية الفيد">
          {TABS.map(([k, l]) => (
            <button key={k} data-on={tab === k ? "1" : undefined} onClick={() => setTab(k)} className="relative">
              {tab === k && (
                <motion.span
                  layoutId="feed-tab"
                  transition={{ type: "spring", stiffness: 480, damping: 38 }}
                  className="feed-tab-pill absolute inset-0"
                />
              )}
              <span className="relative z-10">{l}</span>
            </button>
          ))}
        </nav>
      </header>

      {tab === "foryou" && <FeedBand note={note} />}

      {tab === "cats" && (
        <div className="-mx-3 flex gap-2 overflow-x-auto px-3 md:mx-0 md:px-0 [scrollbar-width:none]">
          {cats.map((c) => (
            <button
              key={c.id}
              onClick={() => setCat(c.id === cat ? null : c.id)}
              data-on={cat === c.id ? "1" : undefined}
              className="chip feed-cat !h-8 shrink-0 bg-snow px-3 text-caption font-semibold text-graphite"
            >
              {c.name_ar}
            </button>
          ))}
        </div>
      )}

      <div
        style={{ height: refreshing ? 40 : pull }}
        className="flex items-center justify-center overflow-hidden text-smoke transition-[height] duration-150"
      >
        {(pull > 20 || refreshing) && (
          <Loader2 size={22} className={refreshing ? "animate-spin" : ""} style={{ transform: `rotate(${pull * 4}deg)` }} />
        )}
      </div>

      <motion.div
        style={{ touchAction: "pan-y" }}
        className="feed-stream flex flex-col gap-4 pb-4"
        onPanEnd={(_, i) => {
          if (Math.abs(i.offset.x) > 80 && Math.abs(i.velocity.x) > 200 && Math.abs(i.offset.y) < 60) {
            go(i.offset.x < 0 ? 1 : -1);
          }
        }}
      >
        {items.map((p, i) => (
          <Fragment key={p.id}>
            <PromptCard p={p} i={i} />
            {/* بطاقة المبدع في الخلاصة: لأول ظهور للكاتب في الجلسة */}
            {maybeFeedCard(p)}
            {(i + 1) % 12 === 0 && <div className="xl:hidden"><AdSlot slot="feed" /></div>}
          </Fragment>
        ))}
        {loading && Array.from({ length: items.length ? 1 : 3 }).map((_, i) => <Skeleton key={i} />)}

        {!loading && err && (
          <div className="flex flex-col items-center gap-4 py-16 text-center">
            <p className="max-w-[30ch] text-graphite">{err}</p>
            <button className="btn btn-primary" onClick={() => load(true)}>إعادة المحاولة</button>
          </div>
        )}

        {!loading && !err && !items.length && (
          <div className="flex flex-col items-center gap-4 py-16 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-xl bg-brand-tint text-brand-ink">
              <Sparkles size={26} />
            </span>
            <p className="max-w-[30ch] text-graphite">
              {tab === "following" ? "تابع بعض المبدعين لتظهر منشوراتهم هنا." : "لا توجد برومبتات بعد. كن الأول!"}
            </p>
            <Link href="/new" className="btn btn-primary">انشر أول برومبت</Link>
          </div>
        )}

        <div ref={end} className="h-px" />
      </motion.div>
    </main>
  );
}
