"use client";
// app/profile/[id]/page.tsx — بروفايل بطراز الصورة: غلاف بعرض الشاشة ← أفاتار مركزي ← هوية موسّطة ← إحصاءات ← أزرار ← تبويبات بخط ← شبكة
import ImagePreview from "@/components/ImagePreview";
import { withMeta } from "@/lib/supabase";
import type { PromptRow } from "@/types";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Award, BarChart3, BookMarked, Camera, FileText, Flame, Heart, Lock, Settings, Share2, UserPlus, Users } from "@/components/icons";
import { VERSION, explain, sb, thumb, toast, uid, uploadImage } from "@/lib/supabase";
import { PromptCover } from "@/components/PromptCover";
import OwnerPromptCard from "@/components/OwnerPromptCard";
import { EmptyState, ErrorState, Skeleton } from "@/components/states";
import { BADGES, BadgeStrip, VerifiedBadge, badgeStats, levelOf, nextStep, type BStats } from "@/components/badges";
import CreatorCardSlot from "@/components/CreatorCardSlot";

type Prof = { id: string; username: string | null; display_name: string | null; avatar_url: string | null; cover_url: string | null; bio: string | null; is_private: boolean; links: string[] | null; streak: number | null; card_fx?: unknown };
type Cell = { id: string; body: string; enhanced: string | null; images: { url: string }[]; like_count?: number };
const SEL = "id,body,enhanced,images,like_count,comment_count,category_id,created_at,author_id";

export default function Profile() {
  const { id } = useParams<{ id: string }>();
  const [me, setMe] = useState<string | undefined>(), [p, setP] = useState<Prof | null>(null), [cells, setCells] = useState<Cell[]>([]), [saved, setSaved] = useState<Cell[]>([]);
  const [stats, setStats] = useState({ followers: 0, following: 0, prompts: 0 }), [likes, setLikes] = useState(0), [fol, setFol] = useState(false), [pend, setPend] = useState(false), [tab, setTab] = useState<"posts" | "saved">("posts"), [ready, setReady] = useState(false);
  const [pv, setPv] = useState<PromptRow | null>(null), [err, setErr] = useState(false), [tick, setTick] = useState(0), [up, setUp] = useState(""), [badges, setBadges] = useState<BStats | null>(null), [verified, setVerified] = useState(false);
  async function change(kind: "cover_url" | "avatar_url", f?: File) {
    if (!f || !me) return; setUp(kind);
    try {
      const im = await uploadImage(f, me), url = thumb(im.url, kind === "cover_url" ? 800 : 400);
      const { error } = await sb.from("profiles").update({ [kind]: url }).eq("id", me); if (error) throw error;
      setP((x) => (x ? ({ ...x, [kind]: url } as Prof) : x)); toast("تم التحديث");
    } catch (e: any) { toast(explain(e)); }
    setUp("");
  }
  const pid = id === "me" ? me : id, own = !!me && me === pid;
  useEffect(() => { // حسابي بلا صف في profiles: أنشئه تلقائياً مرة واحدة ثم أعد التحميل
    if (!(ready && !p && own)) return;
    try { if (sessionStorage.getItem("khiyal:repaired")) return; sessionStorage.setItem("khiyal:repaired", "1"); } catch {}
    (async () => {
      const u = (await sb.auth.getUser()).data.user; if (!u) return;
      const base = (u.email ?? "user").split("@")[0].replace(/[^a-z0-9_]/gi, "").toLowerCase();
      const { error } = await sb.from("profiles").upsert({ id: u.id, username: base + u.id.slice(0, 4), display_name: (u.user_metadata?.full_name as string) || base }, { onConflict: "id", ignoreDuplicates: true });
      if (error) toast(explain(error)); else location.reload();
    })();
  }, [ready, p, own]); // eslint-disable-line
  const [blocked, setBlocked] = useState(false);
  useEffect(() => {
    if (!me || !pid || me === pid) return;
    sb.from("blocks").select("blocked_id").match({ blocker_id: me, blocked_id: pid }).maybeSingle().then(({ data }) => setBlocked(!!data));
  }, [me, pid]);
  async function block() {
    if (!me || !pid) return;
    if (!blocked && !confirm("حظر هذا المستخدم؟ لن ترى منشوراته ولن يرى منشوراتك.")) return;
    const next = !blocked; setBlocked(next);
    const key = { blocker_id: me, blocked_id: pid };
    const { error } = next ? await sb.from("blocks").insert(key) : await sb.from("blocks").delete().match(key);
    if (error) { setBlocked(!next); toast("تعذّر التنفيذ"); } else { toast(next ? "تم الحظر" : "أُلغي الحظر"); if (next) setFol(false); }
  }

  useEffect(() => { uid().then(setMe); }, []);
  useEffect(() => { if (pid) badgeStats(pid).then(setBadges); }, [pid]);
  useEffect(() => { // شارة التوثيق (اختيارية: تُتجاهل قبل تنفيذ التهيئة)
    setVerified(false);
    if (!pid) return;
    sb.from("profiles").select("verified").eq("id", pid).maybeSingle().then(({ data }) => { if (data) setVerified(!!(data as any).verified); });
  }, [pid]);
  useEffect(() => {
    if (!pid) return;
    const count = (t: string, col: string) => { const q = sb.from(t).select("*", { count: "exact", head: true }).eq(col, pid); return t === "follows" ? q.eq("status", "accepted") : q; };
    Promise.all([sb.from("profiles").select("id,username,display_name,avatar_url,cover_url,bio,is_private,links,card_fx").eq("id", pid).maybeSingle(), count("follows", "following_id"), count("follows", "follower_id"), count("prompts", "author_id"),
      sb.from("prompts").select(SEL).eq("author_id", pid).order("created_at", { ascending: false }).limit(60),
      sb.from("prompts").select("like_count").eq("author_id", pid),
      me ? sb.from("follows").select("status").match({ follower_id: me, following_id: pid }).maybeSingle() : Promise.resolve({ data: null })]).then(([pr, a, b, c, ps, lk, f]: any) => {
      setP(pr.data ? { ...pr.data, streak: null } : null); setStats({ followers: a.count ?? 0, following: b.count ?? 0, prompts: c.count ?? 0 }); setLikes((lk.data ?? []).reduce((s: number, x: any) => s + (x.like_count ?? 0), 0)); setCells(ps.data ?? []); setFol(f.data?.status === "accepted"); setPend(f.data?.status === "pending"); setReady(true);
    }).catch(() => { setErr(true); setReady(true); });
  }, [pid, me, tick]);
  useEffect(() => { // المحفوظات (لصاحب الحساب فقط)
    if (!own || tab !== "saved" || saved.length) return;
    sb.from("saves").select("prompt_id").eq("user_id", me!).limit(60).then(async ({ data }) => {
      const ids = data?.map((x) => x.prompt_id) ?? []; if (!ids.length) return;
      const r = await sb.from("prompts").select(SEL).in("id", ids); setSaved((r.data as Cell[]) ?? []);
    });
  }, [own, tab]); // eslint-disable-line

  /* ── إدارة منشوراتي انتقلت إلى بطاقة المالك القابلة للتوسّع بالسحب ──
     (components/OwnerPromptCard.tsx) — بلا نافذة منبثقة، وداخل الملف الشخصي فقط. */

  async function follow() {
    if (!me || !pid) return toast("سجّل الدخول أولاً");
    const key = { follower_id: me, following_id: pid }; navigator.vibrate?.(8);
    if (fol || pend) {
      const was = fol; setFol(false); setPend(false); if (was) setStats((s) => ({ ...s, followers: s.followers - 1 }));
      const { error } = await sb.from("follows").delete().match(key);
      if (error) { setFol(was); setPend(!was); if (was) setStats((s) => ({ ...s, followers: s.followers + 1 })); toast("تعذّر التنفيذ"); }
      return;
    }
    const priv = !!p?.is_private;
    if (priv) setPend(true); else { setFol(true); setStats((s) => ({ ...s, followers: s.followers + 1 })); }
    const { error } = await sb.from("follows").insert(key);
    if (error) { setPend(false); setFol(false); if (!priv) setStats((s) => ({ ...s, followers: s.followers - 1 })); toast("تعذّرت المتابعة"); }
    else if (priv) toast("أُرسل طلب المتابعة");
  }
  async function shareCard() { // صورة إنجاز أنيقة تُولَّد محلياً
    if (!badges || !p) return;
    const W = 800, H = 800, cv = document.createElement("canvas"); cv.width = W; cv.height = H;
    const x = cv.getContext("2d"); if (!x) return;
    const css = getComputedStyle(document.documentElement), v = (k: string) => css.getPropertyValue(k).trim();
    const brand = `rgb(${v("--brand")})`, snow = `rgb(${v("--c-snow")})`, fog = `rgb(${v("--c-fog")})`, ink = `rgb(${v("--c-ink")})`, ink3 = `rgb(${v("--c-ink-3")})`;
    const fam = `"${v("--font-sans").replace(/"/g, "")}", sans-serif`;
    (x as CanvasRenderingContext2D).direction = "rtl"; x.textAlign = "center";
    x.fillStyle = fog; x.fillRect(0, 0, W, H);
    x.strokeStyle = brand; x.lineWidth = 6; x.strokeRect(20, 20, W - 40, H - 40);
    x.fillStyle = brand; x.beginPath(); x.arc(W / 2, 150, 62, 0, Math.PI * 2); x.fill();
    x.fillStyle = snow; x.font = `700 62px ${fam}`; x.fillText("✦", W / 2, 172);
    x.fillStyle = ink; x.font = `700 42px ${fam}`; x.fillText(p.display_name ?? "مبدع خيال", W / 2, 290);
    x.fillStyle = brand; x.font = `600 28px ${fam}`; x.fillText(`المستوى ${levelOf(badges)} في خيال`, W / 2, 336);
    const won = BADGES.filter((b) => b.val(badges) >= b.goal).length;
    x.fillStyle = ink3; x.font = `500 26px ${fam}`;
    [`برومبتات: ${badges.prompts}`, `إعجابات: ${badges.likes}`, `شارات: ${won} من ${BADGES.length}`].forEach((t, i) => x.fillText(t, W / 2, 420 + i * 48));
    x.fillStyle = ink; x.font = `700 28px ${fam}`; x.fillText("خيال — برومبتات عربية جاهزة", W / 2, 660);
    x.fillStyle = brand; x.font = `600 22px ${fam}`; x.fillText("khiyal", W / 2, 700);
    cv.toBlob(async (b) => {
      if (!b) return;
      const f = new File([b], "khiyal-achievement.png", { type: "image/png" });
      try {
        if (navigator.canShare?.({ files: [f] })) await navigator.share({ files: [f], title: "إنجازي في خيال" });
        else { const a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = "khiyal-achievement.png"; a.click(); toast("نُزّلت صورة إنجازك — شاركها أينما شئت"); }
      } catch { /* أُلغيت المشاركة */ }
    }, "image/png");
  }
  async function shareProfile() {
    const url = `${location.origin}/profile/${pid}`;
    try { if (navigator.share) await navigator.share({ title: p?.display_name ?? "خيال", url }); else { await navigator.clipboard.writeText(url); toast("نُسخ رابط الحساب"); } } catch {}
  }

  const openPreview = (c: any) => {
    const row: PromptRow = { ...c, comment_count: c.comment_count ?? 0, created_at: c.created_at ?? new Date().toISOString(), model: null, author: { id: c.author_id ?? p?.id ?? "", username: p?.username ?? null, display_name: p?.display_name ?? null, avatar_url: p?.avatar_url ?? null } };
    if (c.author_id && c.author_id !== p?.id) row.author = { id: c.author_id, username: null, display_name: null, avatar_url: null };
    setPv(row); withMeta([row]).then(([r]) => setPv({ ...r }));
  };
  if (err) return <ErrorState onRetry={() => { setErr(false); setReady(false); setTick((t) => t + 1); }} />;
  if (ready && !p) return (
    <div className="flex flex-col items-center gap-4 py-16 text-center">
      <p className="text-graphite">{own ? "لم يكتمل إعداد حسابك بعد." : "الحساب غير موجود"}</p>
      {own && <Link href="/setup" className="btn btn-primary">إكمال الإعداد</Link>}
    </div>
  );
  const hidden = !!p?.is_private && !own && !fol, list = tab === "saved" ? saved : cells;
  return (
    <main className="mx-auto flex w-full max-w-md flex-col overflow-x-hidden">
      {/*1 — الغلاف بعرض العمود */}
      <div className="cover-fallback relative h-40 w-full overflow-hidden rounded-xl">
        {p?.cover_url && <img src={p.cover_url} alt="" className="h-full w-full object-cover" />}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
        {own && <>
          <label className="absolute end-3 top-3 flex h-9 w-9 cursor-pointer items-center justify-center rounded-full bg-snow/95 text-charcoal shadow-soft active:scale-95">{up === "cover_url" ? <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-silver border-t-charcoal" /> : <Camera size={18} />}<input type="file" accept="image/*" hidden onChange={(e) => change("cover_url", e.target.files?.[0])} /></label>
          <div className="absolute start-3 top-3 flex items-center gap-1.5">
            <Link href="/settings" aria-label="الإعدادات" className="flex h-9 w-9 items-center justify-center rounded-full bg-snow/95 text-charcoal shadow-soft active:scale-95"><Settings size={18} /></Link>
            <span dir="ltr" className="rounded-full bg-black/40 px-2 py-0.5 text-micro font-medium text-white">{VERSION}</span>
          </div>
        </>}
      </div>

      {/*2 — الأفاتار المركزي فوق الغلاف */}
      <div className="relative -mt-11 flex justify-center">
        <div className="relative h-[88px] w-[88px]">
          <div className="avatar h-full w-full border-[4px] border-snow bg-brand-tint text-2xl text-brand-ink shadow-soft" data-i={(p?.display_name ?? "؟").slice(0, 1)}>{p?.avatar_url && <img src={p.avatar_url} alt="" />}</div>
          {own && <label className="absolute bottom-0 end-0 flex h-7 w-7 cursor-pointer items-center justify-center rounded-full border-2 border-snow bg-brand text-snow shadow-pop active:scale-95">{up === "avatar_url" ? <span className="h-3 w-3 animate-spin rounded-full border-2 border-snow/40 border-t-snow" /> : <Camera size={17} />}<input type="file" accept="image/*" hidden onChange={(e) => change("avatar_url", e.target.files?.[0])} /></label>}
        </div>
      </div>

      {/*3 — الهوية موسّطة: اسم + @username + شارات */}
      <div className="flex flex-col items-center gap-1 px-2 pt-2 text-center">
        <h1 className="flex items-center justify-center gap-1.5 text-2xl font-bold tracking-tight text-charcoal">{p?.display_name ?? <span className="inline-block h-6 w-28 animate-pulse rounded-full bg-mist" />}{verified && <VerifiedBadge size={20} />}</h1>
        <p className="text-caption text-smoke">{p ? <bdi dir="ltr">@{p.username}</bdi> : ""}</p>
        <div className="flex flex-wrap items-center justify-center gap-1.5 pt-1">
          {badges && <span className="chip chip-gold">المستوى {levelOf(badges)}</span>}
        </div>
      </div>

      {/*4 — نبذة وروابط */}
      {p?.bio && <p className="mx-auto px-4 pt-2 text-center text-sm leading-relaxed text-graphite">{p.bio}</p>}
      {!!p?.links?.length && <div className="flex flex-wrap justify-center gap-1.5 px-4 pt-2">{p.links.map((l) => <a key={l} href={l} target="_blank" rel="noopener noreferrer nofollow" dir="ltr" className="chip chip-info max-w-[220px] truncate px-3">{l.replace(/^https?:\/\//, "")}</a>)}</div>}

      {/*4ب — بطاقة المبدع بتأثيرات React Bits (تُعرض لزوّار الملف) */}
      {p && !hidden && (
        <CreatorCardSlot
          profileId={p.id}
          profile={{ name: p.display_name || p.username || "مبدع خيال", username: p.username, avatar_url: p.avatar_url, cover_url: p.cover_url, prompts: stats.prompts, likes, followers: stats.followers }}
          className="mx-4 mt-4"
        />
      )}

      {/*5 — الإحصاءات: ثلاثة أعمدة بلا بطاقات (طاقة الأرقام وحدها) */}
      <dl className="grid w-full grid-cols-3 gap-4 px-4 pt-4">
        {([["prompts", "برومبت", FileText, "bg-brand-tint text-brand-ink"], ["followers", "متابِع", Users, "bg-ok-tint text-ok-ink"], ["following", "يتابع", UserPlus, "bg-gold-tint text-gold-ink"]] as const).map(([k, l, Icon, tone]) => (
          <div key={k} className="stat-tile">
            <span className={`stat-icon ${tone}`}><Icon size={20} /></span>
            <dt className="stat-value">{stats[k]}</dt>
            <dd className="stat-label">{l}</dd>
          </div>))}
      </dl>

      {/*6 — الإجراءات: أساسي موسّط + ثانويتان */}
      <div className="flex flex-wrap justify-center gap-2 px-4 pt-4">
        {own ? (<>
          <Link href="/settings" className="btn !min-h-9">تعديل الحساب</Link>
          <Link href="/library" className="btn btn-ghost !min-h-9"><BookMarked size={18} />مكتبتي</Link>
          <Link href="/stats" className="btn btn-ghost !min-h-9"><BarChart3 size={18} />إحصاءاتي</Link>
          <button onClick={shareProfile} aria-label="مشاركة الحساب" className="icon-btn border border-silver"><Share2 size={18} /></button>
          {badges && <button onClick={shareCard} aria-label="مشاركة صورة إنجاز" title="شارك صورة إنجازك" className="icon-btn border border-silver"><Award size={18} className="text-brand-ink" /></button>}
        </>) : (<>
          <button onClick={follow} className={`btn !min-h-9 flex-1 ${fol || pend ? "btn-ghost" : "btn-primary"}`}>{fol ? "أتابعه" : pend ? "تم الطلب" : "متابعة"}</button>
          <button onClick={block} className="btn btn-ghost !min-h-9">{blocked ? "إلغاء الحظر" : "حظر"}</button>
          <button onClick={shareProfile} aria-label="مشاركة الحساب" className="icon-btn border border-silver"><Share2 size={18} /></button>
        </>)}
      </div>

      {/*7 — الخطوة التالية + الشارات */}
      {own && badges && <p className="mx-4 mt-4 rounded-xl bg-mist px-4 py-2.5 text-center text-caption font-semibold text-charcoal">{nextStep(badges)}</p>}
      {!hidden && badges && <div className="flex justify-center px-4 pt-3"><BadgeStrip s={badges} own={own} /></div>}

      {/*8 — تبويبات بخط سفلي */}
      {(own || !hidden) && (
        <div className="tabs2 mt-4">
          <button data-on={tab === "posts" ? "1" : undefined} onClick={() => setTab("posts")}>منشورات</button>
          {own && <button data-on={tab === "saved" ? "1" : undefined} onClick={() => setTab("saved")}>المحفوظة</button>}
        </div>)}

      {/*9 — الشبكة: عمودان بزوايا دائرية (طراز الصورة) */}
      {hidden ? <EmptyState icon={Lock} title="هذا الحساب خاص" hint="تابعه لترى منشوراته." />
        : !ready ? <Skeleton variant="grid" count={6} className="pt-4" />
        : !list.length ? <EmptyState title="لا شيء هنا بعد" hint={own ? "انشر أول برومبت ليظهر هنا." : undefined} action={own ? { label: "برومبت جديد", href: "/new" } : undefined} />
        : <div className="grid grid-cols-2 gap-4 pt-4">{list.map((c) => (
          <Tile key={c.id} c={c} onOpen={() => openPreview(c)}>
            {own && tab === "posts" && (
              <span className="absolute end-2 top-2 z-10 flex gap-1">
                <button onClick={(e) => { e.stopPropagation(); e.preventDefault(); openEdit(c); }} aria-label="تعديل البرومبت" title="تعديل" className="flex h-8 w-8 items-center justify-center rounded-full bg-snow/95 text-charcoal shadow-soft active:scale-90">
                  <Pencil size={15} />
                </button>
                <button onClick={(e) => { e.stopPropagation(); e.preventDefault(); removePrompt(c); }} aria-label="حذف البرومبت" title="حذف" disabled={busy === `del:${c.id}`} className="flex h-8 w-8 items-center justify-center rounded-full bg-snow/95 text-danger shadow-soft active:scale-90 disabled:opacity-60">
                  <Trash2 size={15} />
                </button>
              </span>
            )}
            {c.images?.[0]
              ? <>
                  <img src={thumb(c.images[0].url, 400)} alt="" loading="lazy" className="h-full w-full object-cover" />
                  {!!c.like_count && <span className="on-media absolute bottom-2 end-2 flex items-center gap-1 text-micro font-semibold text-white"><Heart size={16} fill="currentColor" />{c.like_count}</span>}
                </>
              : <PromptCover variant="tile" text={c.enhanced ?? c.body} />}
          </Tile>))}</div>}
      {pv && <ImagePreview p={pv} start={0} onClose={() => setPv(null)} />}

      {/* تعديل برومبت: نفس أسلوب البطاقة — نصّ + الإصدارات السابقة */}
      <BottomSheet compact open={!!editCell} onClose={() => setEditCell(null)} title="تعديل البرومبت">
        <textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={6} className="field min-h-[120px] w-full resize-none py-2" />
        {vers.length > 0 && (
          <div className="mt-2 flex flex-col gap-1.5">
            <p className="text-caption text-smoke">الإصدارات السابقة — اضغط للاسترجاع</p>
            {vers.map((x) => (
              <button key={x.id} onClick={() => setDraft(x.enhanced ?? x.body)} className="card-flat flex flex-col gap-0.5 p-2 text-start">
                <span className="text-caption text-smoke">{ago(x.created_at)}</span>
                <span className="line-clamp-2 text-caption">{x.enhanced ?? x.body}</span>
              </button>
            ))}
          </div>
        )}
        <button onClick={saveEdit} disabled={!draft.trim() || busy === "edit"} className="btn btn-primary mt-2 !min-h-10 w-full disabled:opacity-50">
          {busy === "edit" ? "جارٍ الحفظ…" : "حفظ التعديل"}
        </button>
      </BottomSheet>
    </main>
  );
}


/** بلاطة منشور: بصورة → تفتح المعاينة، بنص فقط → صفحة البرومبت */
function Tile({ c, onOpen, children }: { c: any; onOpen: () => void; children: React.ReactNode }) {
  const cls = "relative aspect-[4/5] overflow-hidden rounded-xl bg-mist text-start transition-all active:scale-95";
  return c.images?.[0] ? <button onClick={onOpen} aria-label="معاينة" className={cls}>{children}</button> : <Link href={`/p/${c.id}`} className={cls}>{children}</Link>;
}
