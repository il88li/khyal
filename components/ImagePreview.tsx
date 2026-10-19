"use client";
// components/ImagePreview.tsx — معاينة الصورة: بطاقة برومبت زجاجية أفقية + أيقونات رئيسية + زيارة الرابط + صور مشابهة
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import { Bookmark, Copy, ExternalLink, Heart, Lock, MessageCircle, Share2, X } from "@/components/icons";
import { useAuth } from "./auth";
import { Skeleton } from "./states";
import { BottomSheet, Comments } from "./ui";
import { VerifiedBadge } from "./badges";
import { previewOf } from "@/lib/access";
import { mediaTransitionName } from "@/lib/viewTransition";
import { sb, toast, uid, withMeta } from "@/lib/supabase";
import type { Img, PromptRow } from "@/types";

type Sim = { id: string; img: Img };
export type PreviewActions = {
  liked: boolean; saved: boolean; likes: number;
  onLike: () => void; onSave: () => void; onComment: () => void; onCopy: () => void; onShare: () => void;
};
const clamp = (im: Img) => { const r = im.w && im.h ? im.w / im.h : 1; return Math.min(Math.max(r, 0.7), 1.8); };
const safeUrl = (u?: string) => (u && /^https?:\/\//i.test(u) ? u : null);

/** إجراءات داخلية عند الفتح من صفحة لا تملك حالة البطاقة (مثل الملف الشخصي) */
function useOwnActions(p: PromptRow, openComments: () => void): PreviewActions {
  const [liked, setLiked] = useState(!!p.liked), [saved, setSaved] = useState(!!p.saved), [likes, setLikes] = useState(p.like_count ?? 0);
  useEffect(() => {
    let dead = false;
    uid().then(async (id) => {
      if (!id) return;
      const key = { user_id: id, prompt_id: p.id };
      const [l, s] = await Promise.all([sb.from("likes").select("prompt_id").match(key).maybeSingle(), sb.from("saves").select("prompt_id").match(key).maybeSingle()]);
      if (!dead) { setLiked(!!l.data); setSaved(!!s.data); }
    });
    return () => { dead = true; };
  }, [p.id]);
  async function toggle(table: "likes" | "saves") {
    const id = await uid(); if (!id) return toast("سجّل الدخول أولاً");
    const isLike = table === "likes", next = !(isLike ? liked : saved);
    if (isLike) { setLiked(next); setLikes((c) => Math.max(0, c + (next ? 1 : -1))); } else setSaved(next);
    const key = { user_id: id, prompt_id: p.id };
    const { error } = next ? await sb.from(table).insert(key) : await sb.from(table).delete().match(key);
    if (error && error.code !== "23505") { if (isLike) { setLiked(!next); setLikes((c) => Math.max(0, c + (next ? -1 : 1))); } else setSaved(!next); toast("تعذّر تنفيذ الإجراء"); }
    else if (!isLike) toast(next ? "حُفظ" : "أُزيل من المحفوظات");
  }
  const full = p.enhanced ?? p.body;
  return {
    liked, saved, likes,
    onLike: () => toggle("likes"), onSave: () => toggle("saves"), onComment: openComments,
    onCopy: async () => {
      try { await navigator.clipboard.writeText(full); toast("نُسخ البرومبت"); sb.rpc("bump_copy", { p_id: p.id }).then(() => {}, () => {}); } catch { toast("تعذّر النسخ"); }
    },
    onShare: async () => {
      const url = `${location.origin}/p/${p.id}`;
      try { if (navigator.share) await navigator.share({ title: "خيال", text: full.slice(0, 120), url }); else { await navigator.clipboard.writeText(url); toast("نُسخ الرابط"); } } catch {}
    },
  };
}

function Preview({ p, start, onClose, a, onOpen }: { p: PromptRow; start: number; onClose: () => void; a?: PreviewActions; onOpen: (row: PromptRow) => void }) {
  const { tier } = useAuth();
  const [cur, setCur] = useState(start), [zoom, setZoom] = useState(false), [cm, setCm] = useState(false);
  const [open, setOpen] = useState(false), [mine, setMine] = useState(false);
  const [link, setLink] = useState<string | null>(null), [name, setName] = useState(p.author?.display_name ?? p.author?.username ?? "");
  const [sim, setSim] = useState<Sim[] | null>(null);
  const last = useRef(0);
  const im = p.images[cur] ?? p.images[0];
  const full = p.enhanced ?? p.body ?? "";
  // غلاف مقتطع للعرض السريع؛ والزر المخصص بالأسفل يكشف النص الكامل للجميع (بلا اشتراك).
  const gate = previewOf(full, tier, mine);
  const own = useOwnActions(p, () => setCm(true));
  const act = a ?? own;

  useEffect(() => { // قفل تمرير الصفحة الخلفية
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    const html = document.documentElement, prev = html.style.overflow;
    html.style.overflow = "hidden"; document.body.style.overflow = "hidden";
    window.addEventListener("keydown", k);
    return () => { html.style.overflow = prev; document.body.style.overflow = ""; window.removeEventListener("keydown", k); };
  }, [onClose]);

  useEffect(() => { // هل أنا صاحب هذا البرومبت؟ (لإظهار نصّي كاملاً)
    let dead = false;
    uid().then((id) => { if (!dead) setMine(!!id && id === p.author?.id); });
    return () => { dead = true; };
  }, [p.author?.id]);

  useEffect(() => { // اسم صاحب البرومبت ورابطه من ملفه الشخصي
    if (!p.author?.id) return;
    sb.from("profiles").select("links,display_name,username").eq("id", p.author.id).maybeSingle().then(({ data }) => {
      setLink(((data?.links as string[] | null) ?? []).map(safeUrl).find(Boolean) ?? null);
      if (data && !name) setName(data.display_name ?? data.username ?? "");
    }, () => {});
  }, [p.author?.id]); // eslint-disable-line

  useEffect(() => { // صور مشابهة: نفس التصنيف أولاً ثم الأحدث
    let dead = false;
    (async () => {
      const pull = async (cat: number | null) => {
        let q = sb.from("prompts").select("id,images").neq("id", p.id).order("created_at", { ascending: false }).limit(30);
        if (cat != null) q = q.eq("category_id", cat);
        const { data } = await q;
        return (data ?? []).filter((x: any) => x.images?.length).map((x: any) => ({ id: x.id, img: x.images[0] as Img }));
      };
      try {
        let list = await pull(p.category_id ?? null);
        if (list.length < 6) { const more = await pull(null); list = [...list, ...more.filter((m) => !list.some((l) => l.id === m.id))]; }
        if (!dead) setSim(list.slice(0, 12));
      } catch { if (!dead) setSim([]); }
    })();
    return () => { dead = true; };
  }, [p.id, p.category_id]);

  /** المشابه يفتح في نفس تصميم المعاينة (لا الصفحة القديمة) */
  const openSim = async (id: string) => {
    const { data, error } = await sb.from("prompts").select("id,body,enhanced,model,images,like_count,comment_count,created_at,category_id,author:profiles!author_id(id,username,display_name,avatar_url)").eq("id", id).maybeSingle();
    if (error || !data) return toast("تعذّر فتح الصورة");
    const [row] = await withMeta([data as unknown as PromptRow]);
    onOpen(row);
  };
  const tap = () => { const n = Date.now(); if (n - last.current < 300) setZoom((z) => !z); last.current = n; };

  return createPortal(
    <motion.div role="dialog" aria-modal="true" aria-label="معاينة الصورة"
      className="fixed inset-0 z-[60] overflow-x-hidden overflow-y-auto overscroll-contain bg-fog touch-pan-y"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}>
      <div className="mx-auto flex w-full min-w-0 max-w-xl flex-col gap-4 px-4 pb-12" style={{ paddingTop: "max(16px, env(safe-area-inset-top))" }}>
        <header className="flex items-center justify-between gap-4">
          <p className="flex min-w-0 flex-1 items-center gap-1.5 truncate text-base font-semibold text-charcoal"><span className="truncate">{name || "برومبت"}</span>{p.author?.verified && <VerifiedBadge size={17} />}</p>
          <button onClick={onClose} aria-label="إغلاق" className="icon-btn shrink-0"><X size={24} /></button>
        </header>

        {/* الصورة بمقاسها: تمرير وتكبير بالقرصة، ونقر مزدوج للتكبير.
            تحمل اسم الانتقال المشترك نفسه الذي تحمله بطاقة البرومبت في الخلاصة. */}
        <div onClick={tap} style={{ viewTransitionName: mediaTransitionName(p.id) } as any} className="max-h-[62dvh] w-full overflow-auto rounded-xl bg-mist touch-pan-x touch-pan-y touch-pinch-zoom [scrollbar-width:none]">
          <img src={im.url} alt="" draggable={false}
            className={zoom ? "block h-auto max-w-none" : "mx-auto block h-auto max-h-[62dvh] w-auto max-w-full object-contain"}
            style={zoom ? { width: "220%" } : undefined} />
        </div>
        {p.images.length > 1 && (
          <div className="flex gap-2 overflow-x-auto [scrollbar-width:none]">
            {p.images.map((x, i) => (
              <button key={i} onClick={() => { setCur(i); setZoom(false); }} aria-label={`الصورة ${i + 1}`} aria-current={i === cur}
                className={`h-14 w-14 shrink-0 overflow-hidden rounded-xl transition-all active:scale-95 ${i === cur ? "opacity-100" : "opacity-50"}`}>
                <img src={x.url} alt="" className="h-full w-full object-cover" />
              </button>))}
          </div>
        )}

        {/* بطاقة البرومبت: أفقية زجاجية مضغوطة، ارتفاع ثابت مع تمرير داخلي */}
        <section aria-label="معاينة البرومبت" className="glass-h">
          <img src={im.url} alt="" aria-hidden="true" className="glass-h-bg" />
          <div className="glass-h-body glass-h-body--sm">
            {p.title && <p className="text-sm font-semibold text-white">{p.title}</p>}
            <div className="prompt-scroll prompt-text-scroll prompt-text-scroll--sm">
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-white/90">{open ? full : gate.shown}{!open && gate.locked && "…"}</p>
            </div>
            {!!p.tags?.length && <div className="flex flex-wrap gap-1">{p.tags.map((t) => <span key={t} className="rounded-full bg-white/15 px-2 text-micro text-white">{t}</span>)}</div>}
            {gate.locked && !open && (
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1 text-caption text-white/80"><Lock size={16} />جزء من النص فقط</span>
                <button onClick={() => setOpen(true)} className="btn btn-xs bg-white !text-black">عرض البرومبت كاملاً</button>
              </div>)}
            {open && (
              <button onClick={() => setOpen(false)} className="self-start text-caption font-medium text-white/80">إخفاء</button>)}
          </div>
        </section>

        {/* الأيقونات الرئيسية */}
        <div className="flex w-full items-center justify-between">
          <button onClick={act.onLike} aria-pressed={act.liked} aria-label="إعجاب" className={`flex h-10 items-center gap-1 rounded-full px-2 transition-all active:scale-95 ${act.liked ? "text-brand" : "text-graphite"}`}>
            <Heart size={24} fill={act.liked ? "currentColor" : "none"} /><span className="text-sm tabular-nums">{act.likes}</span>
          </button>
          <button onClick={act.onComment} aria-label="التعليقات" className="icon-btn"><MessageCircle size={24} /></button>
          <button onClick={act.onCopy} aria-label="نسخ البرومبت" className="icon-btn"><Copy size={24} /></button>
          <button onClick={act.onSave} aria-pressed={act.saved} aria-label="حفظ" className={`icon-btn ${act.saved ? "!text-brand" : ""}`}><Bookmark size={24} fill={act.saved ? "currentColor" : "none"} /></button>
          <button onClick={act.onShare} aria-label="مشاركة" className="icon-btn"><Share2 size={24} /></button>
        </div>
        {link && (
          <a href={link} target="_blank" rel="noopener noreferrer nofollow" className="btn btn-primary btn-lg w-full">
            <ExternalLink size={20} />زيارة الرابط
          </a>)}

        {/* صور مشابهة: عمودان، كل صورة بمقاسها */}
        <section aria-label="صور مشابهة" className="flex flex-col gap-4 pt-4">
          <h2 className="text-lg font-bold text-charcoal">صور مشابهة</h2>
          {sim === null ? <Skeleton variant="grid" count={4} />
            : !sim.length ? <p className="text-sm text-smoke">لا صور مشابهة بعد.</p>
            : <div className="columns-2 gap-4">
                {sim.map((s) => (
                  <button key={s.id} onClick={() => openSim(s.id)} aria-label="معاينة" className="mb-4 block w-full break-inside-avoid overflow-hidden rounded-xl bg-mist transition-all active:scale-95">
                    <img src={s.img.url} alt="" loading="lazy" decoding="async" className="block h-full w-full object-cover" style={{ aspectRatio: clamp(s.img) }} />
                  </button>))}
              </div>}
        </section>
      </div>
      {!a && <BottomSheet layer="top" open={cm} onClose={() => setCm(false)} title="التعليقات">{cm && <Comments promptId={p.id} />}</BottomSheet>}
    </motion.div>,
    document.body,
  );
}

export default function ImagePreview({ p: p0, start, onClose, a }: { p: PromptRow; start: number; onClose: () => void; a?: PreviewActions }) {
  const [p, setP] = useState(p0);
  const same = p.id === p0.id;
  return <Preview key={p.id} p={p} start={same ? start : 0} onClose={onClose} a={same ? a : undefined} onOpen={setP} />;
}
