"use client";
// components/PromptCard.tsx — محتوى أولًا: رأس هادئ، نص مقروء، وأفعال واضحة
import { memo, useEffect, useRef, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { motion } from "framer-motion";
import {
  Bookmark, Braces, Copy, GitFork, Heart, MessageCircle,
  Share2, Sparkles, UserPlus, Check } from "@/components/icons";
import { ago, burst, extractVars, fmt, imgSet, sb, toast, uid, useCategories } from "@/lib/supabase";
import { BottomSheet, Comments, VarsSheet } from "./ui";
import { VerifiedBadge } from "./badges";
import { PromptCover } from "./PromptCover";
import { SafeImg } from "./states";
import { previewOf } from "@/lib/access";
import { mediaTransitionName, withViewTransition } from "@/lib/viewTransition";
// معاينة الصور ثقيلة (سحب/تكبير) — تُحمَّل فقط عند فتحها
const ImagePreview = dynamic(() => import("./ImagePreview"), { ssr: false });
import type { PromptRow } from "@/types";

const REASONS = ["محتوى مسيء", "احتيال أو spam", "انتهاك حقوق", "أخرى"];

/* ── ذاكرة عالمية لمن أتابعهم ── */
let followedSet: Set<string> | null = null;
let followedPromise: Promise<Set<string>> | null = null;
async function getFollowed(): Promise<Set<string>> {
  if (followedSet) return followedSet;
  if (followedPromise) return followedPromise;
  followedPromise = (async () => {
    try {
      const me = await uid();
      if (!me) return (followedSet = new Set());
      const { data } = await sb
        .from("follows")
        .select("following_id")
        .eq("follower_id", me)
        .eq("status", "accepted");
      followedSet = new Set((data ?? []).map((x) => x.following_id as string));
      return followedSet;
    } catch {
      return (followedSet = new Set());
    }
  })();
  return followedPromise;
}
const invalidateFollowed = () => { followedSet = null; followedPromise = null; };

/* حركات الدخول المتتابعة: تُقصَر على أول ظهور في الجلسة فقط */
let entranceSeen = false;
const MAX_STAGGER = 4, STEP = 0.05;

function PromptCard({ p, i = 0 }: { p: PromptRow; i?: number }) {
  const cats = useCategories();
  const [liked, setLiked] = useState(!!p.liked);
  const [saved, setSaved] = useState(!!p.saved);
  const [count, setCount] = useState(p.like_count);
  const [pulse, setPulse] = useState(0);
  const [idx, setIdx] = useState(0);
  const [sheet, setSheet] = useState(false);
  const [lb, setLb] = useState<number | null>(null);
  const [mine, setMine] = useState(false);
  const [rep, setRep] = useState(false);
  const [orig, setOrig] = useState(false);
  const [vsheet, setVsheet] = useState(false);
  const override: string | null = null; // نصّ يدوي بعد التعديل — التعديل صار من الملف الشخصي

  const [following, setFollowing] = useState<boolean | null>(null);
  const [followBusy, setFollowBusy] = useState(false);

  const lockLike = useRef(false);
  const likeBtn = useRef<HTMLButtonElement>(null);
  const lastTap = useRef(0);
  const timer = useRef<any>();
  const firstRun = useRef(!entranceSeen);
  useEffect(() => { if (firstRun.current) entranceSeen = true; }, []);

  useEffect(() => setCount(p.like_count), [p.like_count]);

  useEffect(() => {
    uid().then((id) => setMine(!!id && id === p.author?.id));
  }, [p.author?.id]);

  useEffect(() => {
    if (mine || !p.author?.id) { setFollowing(null); return; }
    let dead = false;
    getFollowed().then((set) => { if (!dead) setFollowing(set.has(p.author!.id)); });
    return () => { dead = true; };
  }, [mine, p.author?.id]);

  async function toggle(table: "likes" | "saves") {
    const id = await uid();
    if (!id) return toast("سجّل الدخول أولاً");
    const isLike = table === "likes";
    const next = !(isLike ? liked : saved);
    if (isLike) {
      if (lockLike.current) return;
      lockLike.current = true;
      setLiked(next);
      setCount((c) => Math.max(0, c + (next ? 1 : -1)));
      setPulse((n) => n + 1);
      if (next && likeBtn.current) {
        const r = likeBtn.current.getBoundingClientRect();
        burst(r.left + r.width / 2, r.top + r.height / 2, 12);
      }
    } else setSaved(next);
    navigator.vibrate?.(8);
    const key = { user_id: id, prompt_id: p.id };
    const { error } = next
      ? await sb.from(table).insert(key)
      : await sb.from(table).delete().match(key);
    if (error && error.code !== "23505") {
      if (isLike) { setLiked(!next); setCount((c) => Math.max(0, c + (next ? -1 : 1))); }
      else setSaved(!next);
      toast("تعذّر تنفيذ الإجراء");
    } else if (!isLike) toast(next ? "حُفظ" : "أُزيل من المحفوظات");
    if (isLike) lockLike.current = false;
  }

  async function follow() {
    if (!p.author?.id || followBusy) return;
    const me = await uid();
    if (!me) return toast("سجّل الدخول أولاً");
    setFollowBusy(true);
    const willFollow = !following;
    setFollowing(willFollow);
    navigator.vibrate?.(8);
    const key = { follower_id: me, following_id: p.author.id };
    const { error } = willFollow
      ? await sb.from("follows").insert(key)
      : await sb.from("follows").delete().match(key);
    setFollowBusy(false);
    if (error && error.code !== "23505") {
      setFollowing(!willFollow);
      toast("تعذّر تنفيذ المتابعة");
    } else {
      invalidateFollowed();
      toast(willFollow ? "تتابعه الآن" : "أُلغي المتابعة");
    }
  }

  const tapText = () => {
    const n = Date.now();
    if (n - lastTap.current < 320 && !liked) toggle("likes");
    lastTap.current = n;
  };
  function tapImg(i: number) {
    const n = Date.now();
    if (n - lastTap.current < 300) {
      clearTimeout(timer.current);
      if (!liked) toggle("likes");
      lastTap.current = 0;
      return;
    }
    lastTap.current = n;
    // الفتح داخل انتقال مشترك: وسائط البطاقة تنتقل إلى معاينتها (وبلا أثر عند عدم الدعم)
    timer.current = setTimeout(() => withViewTransition(() => setLb(i)), 300);
  }

  const hasBoth = !!p.enhanced && p.enhanced !== p.body;
  const shown = orig ? p.body : override ?? p.enhanced ?? p.body;
  // المقصوص يأتي من الخادم (RPC prompt_gated) بحسب مستوى المستخدم، وإلا نحسبه محلياً كاحتياطٍ.
  const serverGated = typeof p.locked === "boolean";
  const gate = serverGated ? { shown, locked: !!p.locked, hidden: p.hidden ?? 0 } : previewOf(shown, "guest");
  const revealEnabled = !(serverGated && p.locked); // النص مقصوص من الخادم فلا فائدة من زر الكشف
  const vars = extractVars(shown);

  const copy = async () => {
    await navigator.clipboard.writeText(shown);
    navigator.vibrate?.(10);
    toast("نُسخ البرومبت");
    if (p.id !== "preview") sb.rpc("bump_copy", { p_id: p.id }).then(() => {}, () => {});
  };

  async function share() {
    const url = `${location.origin}/p/${p.id}`;
    try {
      if (navigator.share) await navigator.share({ title: "خيال", text: gate.shown.slice(0, 120), url });
      else { await navigator.clipboard.writeText(url); toast("نُسخ الرابط"); }
    } catch {}
  }

  async function report(reason: string) {
    const id = await uid();
    if (!id) return toast("سجّل الدخول أولاً");
    const { error } = await sb.from("reports").insert({ prompt_id: p.id, reporter_id: id, reason });
    setRep(false);
    toast(error ? (error.code === "23505" ? "بلغتَ عن هذا المنشور سابقاً" : "تعذّر الإرسال") : "شكراً، سنراجع البلاغ");
  }

  const first = p.images?.[0];
  const ratio = first?.w && first?.h ? Math.min(Math.max(first.w / first.h, 0.8), 1.91) : 4 / 3;
  const name = p.author?.display_name ?? p.author?.username ?? "مستخدم";
  const cat = p.category_id != null ? cats[p.category_id] : null;
  const hot = p.like_count >= 50;
  const fresh = Date.now() - new Date(p.created_at).getTime() < 86_400_000;
  const trusted = (p.copy_count ?? 0) >= 10;
  const initial = name.trim().slice(0, 1);

  return (
    <motion.article
      initial={firstRun.current ? { opacity: 0, y: 16 } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 420, damping: 34, delay: firstRun.current ? Math.min(i, MAX_STAGGER) * STEP : 0 }}
      className="prompt-card card"
    >
      <header className="prompt-card-head">
        <Link
          href={`/profile/${p.author?.id}`}
          className="avatar h-10 w-10 shrink-0 bg-brand-tint text-brand-ink"
          data-i={initial}
          aria-label={`الملف الشخصي: ${name}`}
        >
          {p.author?.avatar_url && <img src={p.author.avatar_url} alt="" loading="lazy" decoding="async" onError={(e) => { e.currentTarget.style.display = "none"; }} />}
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 flex-wrap items-baseline gap-x-1.5">
            <Link href={`/profile/${p.author?.id}`} className="truncate text-sm font-semibold text-charcoal">{name}</Link>
            {p.author?.verified && <VerifiedBadge />}
            {p.author?.username && <span dir="ltr" className="truncate text-caption text-smoke">@{p.author.username}</span>}
          </div>
          <p className="text-caption text-smoke">{ago(p.created_at)}</p>
        </div>
        {!mine && following !== null && (
          <button
            onClick={follow}
            disabled={followBusy}
            className={`btn !min-h-9 !px-3 !text-caption ${following ? "btn-ghost" : "btn-soft"}`}
          >
            {following ? <Check size={14} /> : <UserPlus size={14} />}
            {following ? "متابع" : "متابعة"}
          </button>
        )}
        {/* تعديل/حذف البرومبت انتقل إلى الملف الشخصي (تبويب المنشورات) */}
      </header>

      {first ? (
        <div className="prompt-card-media">
          <div
            onScroll={(e) => setIdx(Math.round(Math.abs(e.currentTarget.scrollLeft) / e.currentTarget.clientWidth))}
            className="prompt-gallery-track"
          >
            {p.images.map((im, i) => (
              <button
                key={`${im.url}-${i}`}
                onClick={() => tapImg(i)}
                className="prompt-gallery-slide"
                style={{ aspectRatio: ratio, ...(i === 0 && lb === null ? { viewTransitionName: mediaTransitionName(p.id) } : {}) } as any}
                aria-label={`عرض الصورة ${i + 1} من ${p.images.length}`}
              >
                <SafeImg {...imgSet(im.url)} sizes="(max-width: 768px) 100vw, 640px" alt={`مرفق للبرومبت: ${name}`} className="h-full w-full object-cover" />
                {im.url.endsWith(".gif") && <span className="chip absolute start-3 top-3 bg-charcoal/75 text-snow">GIF</span>}
              </button>
            ))}
          </div>
          {p.images.length > 1 && (
            <div className="prompt-gallery-dots" aria-label={`الصورة ${idx + 1} من ${p.images.length}`}>
              {p.images.map((_, i) => <span key={i} className={i === idx ? "active" : ""} />)}
            </div>
          )}
          {/* طبقة العنوان: تعلو حافّة الوسائط فتُقرأ الفكرة فوراً بلا فاصل بينها وبين الصورة */}
          {p.title && <p className="prompt-media-title">{p.title}</p>}
        </div>
      ) : (
        /* بلا صورة: غلاف مصمّم بديل يحمل روح البرومبت بدل الفراغ */
        <div className="prompt-card-media prompt-card-media--cover">
          <PromptCover title={p.title} category={cat} author={name} />
        </div>
      )}

      {(cat || hot || fresh || trusted || hasBoth || !!p.tags?.length) && (
        <div className="prompt-card-tags">
          {hasBoth && (
            <div className="seg prompt-origin-toggle">
              {([[false, "✨ محسّن"], [true, "الأصلي"]] as const).map(([v, label]) => (
                <button key={label} data-on={orig === v ? "1" : undefined} onClick={() => setOrig(v)}>
                  {label}
                </button>
              ))}
            </div>
          )}
          {cat && <span className="chip">{cat}</span>}
          {/* وسوم قليلة فقط: وسمان كحدّ أقصى لتقليل الزحام */}
          {p.tags?.slice(0, 2).map((t) => <span key={t} className="chip">{t}</span>)}
          {/* شارة حالة واحدة فقط — بالأولوية: ترند ← جديد */}
          {hot ? <span className="chip chip-gold">🔥 ترند</span>
            : fresh ? <span className="chip">جديد</span>
            : trusted ? <span className="chip chip-ok">موثّق</span> : null}
        </div>
      )}

      {/* بطاقة البرومبت: بنفس نظام معاينة الصورة — ارتفاع ثابت وتمرير داخلي بدل الكشف المنسدل */}
      <div className="prompt-card-copy-wrap">
        <section
          onClick={tapText}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && tapText()}
          aria-label={revealEnabled ? "نص البرومبت" : "مقتطف من البرومبت"}
          className="glass-h prompt-text-card"
        >
          {first
            ? <img src={first.url} alt="" aria-hidden="true" className="glass-h-bg" />
            : <span aria-hidden className="glass-h-fallback" />}
          <div className="glass-h-body">
            {/* العنوان يظهر مرة واحدة — طبقةً فوق الوسائط — فلا يتكرّر هنا */}
            <div className="prompt-scroll prompt-text-scroll">
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-white/90">
                {revealEnabled ? shown : gate.shown}{!revealEnabled && gate.locked && "…"}
              </p>
            </div>
            {!revealEnabled && (
              <Link href="/pricing" onClick={(e) => e.stopPropagation()} className="prompt-lock-note prompt-lock-note--glass">
                باقي البرومبت لمشتركي خيال — اعرف المزيد
              </Link>
            )}
          </div>
        </section>
      </div>

      {(!!p.copy_count || !!p.fork_count || !!p.forked_from) && (
        <p className="prompt-card-counts">
          {!!p.copy_count && <span>نُسخ {fmt(p.copy_count)} مرة</span>}
          {!!p.fork_count && <span>فُرّع {fmt(p.fork_count)}</span>}
          {p.forked_from && <Link href={`/p/${p.forked_from}`}>مفرّع من أصل ↗</Link>}
        </p>
      )}

      <footer className="prompt-card-footer">
        <div className="prompt-social-row" aria-label="التفاعل مع البرومبت">
          <button ref={likeBtn} onClick={() => toggle("likes")} className={`prompt-social-action ${liked ? "is-active" : ""}`} aria-label={liked ? "إلغاء الإعجاب" : "إعجاب"} aria-pressed={liked}>
            <motion.span key={pulse} animate={pulse ? { scale: [1, 1.3, 1] } : {}} transition={{ type: "spring", stiffness: 480, damping: 18 }}>
              <Heart size={17} fill={liked ? "currentColor" : "none"} />
            </motion.span>
            <span>{fmt(count)}</span>
          </button>
          <button onClick={() => p.id !== "preview" && setSheet(true)} className="prompt-social-action" aria-label="تعليقات">
            <MessageCircle size={17} /><span>{fmt(p.comment_count)}</span>
          </button>
          <button onClick={() => toggle("saves")} className={`prompt-social-action ${saved ? "is-active" : ""}`} aria-label={saved ? "إلغاء الحفظ" : "حفظ"} aria-pressed={saved}>
            <Bookmark size={17} fill={saved ? "currentColor" : "none"} />
          </button>
          <button onClick={share} className="prompt-social-icon" aria-label="مشاركة"><Share2 size={17} /></button>
          {!mine && p.id !== "preview" && (
            <button onClick={() => setRep(true)} className="prompt-social-icon" aria-label="خيارات المنشور">⋯</button>
          )}
        </div>
        <div className={`prompt-cta-row ${!mine && p.id !== "preview" ? "with-fork" : ""}`}>
          <button onClick={copy} className="btn btn-primary prompt-copy-cta">
            <Copy size={16} /><span>انسخ البرومبت</span>
          </button>
          {vars.length ? (
            <button onClick={() => setVsheet(true)} className="btn prompt-use-cta"><Braces size={16} /><span>عبّئ المتغيرات</span></button>
          ) : (
            <Link href={`/enhance?text=${encodeURIComponent(p.body)}`} className="btn prompt-use-cta"><Sparkles size={16} /><span>جرّبه أو حسّنه</span></Link>
          )}
          {!mine && p.id !== "preview" && <Link href={`/new?fork=${p.id}`} aria-label="فرّع البرومبت" className="btn prompt-fork-cta"><GitFork size={16} /><span>فرّع</span></Link>}
        </div>
      </footer>

      {/* ══════════════ النوافذ ══════════════ */}
      <BottomSheet open={sheet} onClose={() => setSheet(false)} title="التعليقات">
        {sheet && <Comments promptId={p.id} />}
      </BottomSheet>

      {lb !== null && (
        <ImagePreview p={p} start={lb} onClose={() => setLb(null)}
          a={{ liked, saved, likes: count, onLike: () => toggle("likes"), onSave: () => toggle("saves"), onComment: () => { setLb(null); setSheet(true); }, onCopy: copy, onShare: share }} />
      )}

      {/* التعديل والحذف انتقلوا إلى الملف الشخصي — هنا الإبلاغ فقط */}
      <BottomSheet compact open={rep} onClose={() => setRep(false)} title="إبلاغ عن المنشور">
        {REASONS.map((r) => (
          <button
            key={r}
            onClick={() => report(r)}
            className="btn btn-ghost mb-1.5 w-full justify-start"
          >
            {r}
          </button>
        ))}
      </BottomSheet>

      {/* النص الكامل: المتغيرات تُستخرج وتُعبّأ وتُنسخ من النص كاملاً لا من الغلاف المقتطع */}
      <VarsSheet text={shown} open={vsheet} onClose={() => setVsheet(false)} />
    </motion.article>
  );
}

// memo: يمنع إعادة الرسم عند تحديث الفيد إلا إذا تغيّر الكائن نفسه
export default memo(PromptCard);
