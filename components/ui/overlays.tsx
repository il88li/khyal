"use client";
// components/ui/overlays.tsx — الطبقات والتراكبات: BottomSheet, Toaster, CopyButton, Lightbox, Gallery, Comments, Splash, VarsSheet
import { AnimatePresence, motion, useDragControls, useMotionValue, useTransform } from "framer-motion";
import { AlertTriangle, CheckCircle, Copy, Flame, Info, Send, Target, X } from "@/components/icons";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ago, burst, extractVars, fillVars, sb, thumb, toast, uid, type Tone } from "@/lib/supabase";
import { challengeOf } from "@/types";
import type { Img } from "@/types";
import { LogoMark } from "./LogoMark";

export { Skeleton } from "../states";

/* ════════════════════════════════════════════════════════════════
   BottomSheet — نافذة سفلية: سحب من المقبض للإغلاق، Esc، قفل التمرير
   ════════════════════════════════════════════════════════════════ */
export function BottomSheet({
  open,
  onClose,
  title,
  children,
  layer,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  compact?: boolean;
  layer?: "top";
}) {
  const controls = useDragControls();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", k);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", k);
    };
  }, [open, onClose]);
  if (!mounted) return null;

  // Portal: يمنع قصّ النافذة داخل عناصر أصلها transform/overflow (سبب عدم فتح التعليقات)
  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="bd"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className={`fixed inset-0 bg-black/40 ${layer === "top" ? "z-[70]" : "z-50"}`}
          />
          <motion.div
            key="sh"
            role="dialog"
            aria-modal="true"
            aria-label={title}
            drag="y"
            dragListener={false}
            dragControls={controls}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.6 }}
            onDragEnd={(_, i) => (i.offset.y > 120 || i.velocity.y > 600) && onClose()}
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 460, damping: 38 }}
            className={`fixed inset-x-0 bottom-0 ${layer === "top" ? "z-[70]" : "z-50"} mx-auto max-h-[70vh] w-full max-w-xl overflow-y-auto overscroll-contain rounded-t-3xl bg-snow shadow-lift`}
            style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
          >
            <div
              onPointerDown={(e) => controls.start(e)}
              style={{ touchAction: "none" }}
              className="sticky top-0 z-10 flex cursor-grab flex-col items-center gap-1.5 bg-snow px-4 pb-2 pt-2"
            >
              <span className="h-1 w-8 rounded-full bg-silver" />
              {title && <h2 className="text-lg font-bold text-charcoal">{title}</h2>}
            </div>
            <div className="flex flex-col px-4 pb-4">{children}</div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
}

/* ════════════════════════════════════════════════════════════════
   Modal — نافذة مركزية: max-h-[80vh] مع تمرير داخلي (عرض النص كاملاً)
   ════════════════════════════════════════════════════════════════ */
export function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", k);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", k);
    };
  }, [open, onClose]);
  if (!mounted) return null;
  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          key="md"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            onClick={(e) => e.stopPropagation()}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
            className="max-h-[80vh] w-full max-w-md overflow-y-auto overscroll-contain rounded-xl border border-silver bg-snow p-4 shadow-lift"
          >
            <div className="mb-4 flex items-center justify-between gap-4">
              <h2 className="text-lg font-bold text-charcoal">{title}</h2>
              <button onClick={onClose} aria-label="إغلاق" className="icon-btn"><X size={20} /></button>
            </div>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

/* ════════════════════════════════════════════════════════════════
   Toaster — تنبيه علوي: خلفية حبرية + نص كريمي
   ════════════════════════════════════════════════════════════════ */
export function Toaster() {
  const [items, setItems] = useState<{ id: number; msg: string; tone: Tone }[]>([]);
  useEffect(() => {
    let seq = 0;
    const h = (e: Event) => {
      const d = (e as CustomEvent).detail;
      const msg = typeof d === "string" ? d : d?.msg;
      const tone: Tone = typeof d === "string" ? "info" : d?.tone ?? "info";
      if (!msg) return;
      const id = ++seq;
      setItems((a) => [...a.slice(-2), { id, msg, tone }]);
      setTimeout(() => setItems((a) => a.filter((x) => x.id !== id)), tone === "error" ? 3400 : 2200);
    };
    window.addEventListener("khiyal:toast", h);
    return () => window.removeEventListener("khiyal:toast", h);
  }, []);
  const ICONS = { info: Info, success: CheckCircle, error: AlertTriangle } as const;
  const COLORS = { info: "text-snow/70", success: "text-[rgb(var(--ok))]", error: "text-[rgb(var(--danger))]" } as const;
  return (
    <div className="pointer-events-none fixed inset-x-4 z-[80] mx-auto flex max-w-[420px] flex-col items-center gap-2" style={{ top: "calc(12px + env(safe-area-inset-top))" }}>
      <AnimatePresence initial={false}>
        {items.map((t) => {
          const Icon = ICONS[t.tone];
          return (
            <motion.div
              key={t.id}
              role={t.tone === "error" ? "alert" : "status"}
              aria-live={t.tone === "error" ? "assertive" : "polite"}
              initial={{ y: -12, opacity: 0, scale: 0.97 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: -12, opacity: 0, scale: 0.97 }}
              transition={{ type: "spring", stiffness: 500, damping: 38 }}
              className="pointer-events-auto flex w-full items-center gap-2.5 rounded-xl bg-charcoal px-4 py-2.5 text-base font-medium text-snow shadow-lift"
            >
              <Icon size={17} className={`shrink-0 ${COLORS[t.tone]}`} aria-hidden />
              <span className="min-w-0 flex-1 leading-snug">{t.msg}</span>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
   CopyButton — زر نسخ مباشر (النسخ عبر الأزرار فقط)
   ════════════════════════════════════════════════════════════════ */
export function CopyButton({
  text,
  label = "نسخ البرومبت",
}: {
  text: string;
  label?: string;
}) {
  return (
    <button
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        navigator.vibrate?.(10);
        toast("نُسخ البرومبت");
      }}
      className="btn"
    >
      <Copy size={18} />
      {label}
    </button>
  );
}

/* ════════════════════════════════════════════════════════════════
   Lightbox — عارض صور: سحب رأسي للإغلاق، تكبير بإصبعين، نقر مزدوج
   ════════════════════════════════════════════════════════════════ */
function Zoom({ im, onZoom }: { im: Img; onZoom: (z: boolean) => void }) {
  const [z, setZ] = useState(false);
  const last = useRef(0);
  const tap = () => {
    const n = Date.now();
    if (n - last.current < 300) {
      setZ((v) => { onZoom(!v); return !v; });
    }
    last.current = n;
  };
  return (
    <div
      onClick={tap}
      className="flex h-full w-full shrink-0 snap-center overflow-auto touch-pan-x touch-pan-y touch-pinch-zoom [scrollbar-width:none]"
    >
      <img
        src={thumb(im.url, 1600)}
        alt=""
        draggable={false}
        className={z ? "m-auto h-auto max-w-none" : "m-auto max-h-full max-w-full object-contain"}
        style={z ? { width: "250%" } : undefined}
      />
    </div>
  );
}

export function Lightbox({
  images,
  start = 0,
  onClose,
}: {
  images: Img[];
  start?: number;
  onClose: () => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [idx, setIdx] = useState(start);
  const [zoomed, setZoomed] = useState(false);
  const y = useMotionValue(0);
  const fade = useTransform(y, [-260, 0, 260], [0.2, 1, 0.2]);
  const shrink = useTransform(y, [-260, 0, 260], [0.86, 1, 0.86]);

  useEffect(() => {
    (box.current?.children[start] as HTMLElement | undefined)?.scrollIntoView({
      inline: "center",
      behavior: "instant" as ScrollBehavior,
    });
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", k);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", k);
    };
  }, []); // eslint-disable-line

  const end = (
    _: unknown,
    i: { offset: { y: number }; velocity: { y: number } },
  ) => {
    if (Math.abs(i.offset.y) > 120 || Math.abs(i.velocity.y) > 700) {
      navigator.vibrate?.(10);
      onClose();
    }
  };

  return createPortal(
    <motion.div
      className="fixed inset-0 z-[60]"
      role="dialog"
      aria-modal="true"
      aria-label="عارض الصور"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        style={{ opacity: fade }}
        onClick={onClose}
        className="absolute inset-0 bg-[rgb(18_18_16/.9)] backdrop-blur-xl"
      />
      <button
        onClick={onClose}
        aria-label="إغلاق"
        className="glass-strong absolute end-4 z-10 flex h-11 w-11 items-center justify-center rounded-full text-charcoal"
        style={{ top: "calc(14px + env(safe-area-inset-top))" }}
      >
        <X size={22} />
      </button>
      <motion.div
        style={{ y, scale: shrink }}
        drag={zoomed ? false : "y"}
        dragDirectionLock
        dragElastic={0.5}
        dragConstraints={{ top: 0, bottom: 0 }}
        onDragEnd={end}
        className="relative h-full w-full"
      >
        <div
          ref={box}
          onScroll={(e) =>
            setIdx(
              Math.round(
                Math.abs(e.currentTarget.scrollLeft) / e.currentTarget.clientWidth,
              ),
            )
          }
          className={`flex h-full snap-x snap-mandatory py-16 [scrollbar-width:none] ${
            zoomed ? "overflow-hidden" : "overflow-x-auto"
          }`}
        >
          {images.map((im, i) => (
            <Zoom key={i} im={im} onZoom={setZoomed} />
          ))}
        </div>
      </motion.div>
      {images.length > 1 && (
        <motion.div
          style={{
            opacity: fade,
            bottom: "calc(24px + env(safe-area-inset-bottom))",
          }}
          className="glass-strong absolute left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full px-3 py-2"
        >
          {images.map((_, i) => (
            <span
              key={i}
              className={`h-1.5 rounded-full transition-all ${
                i === idx ? "w-6" : "w-1.5 opacity-50"
              }`}
              style={{
                background:
                  i === idx ? "rgb(var(--brand))" : "rgb(var(--c-ink))",
              }}
            />
          ))}
        </motion.div>
      )}
    </motion.div>,
    document.body,
  );
}

/* ════════════════════════════════════════════════════════════════
   Skeleton — هيكل تحميل بوميض لون الهوية
   ════════════════════════════════════════════════════════════════ */
/* ════════════════════════════════════════════════════════════════
   Gallery — صور صفحة التفاصيل: 4:5، مؤشر نقطي، ضغط يفتح Lightbox
   ════════════════════════════════════════════════════════════════ */
export function Gallery({ images }: { images: Img[] }) {
  const [i, setI] = useState(0);
  const [open, setOpen] = useState<number | null>(null);
  if (!images.length) return null;
  return (
    <div className="relative overflow-hidden rounded-xl bg-mist">
      <div
        onScroll={(e) =>
          setI(
            Math.round(
              Math.abs(e.currentTarget.scrollLeft) / e.currentTarget.clientWidth,
            ),
          )
        }
        className="flex snap-x snap-mandatory overflow-x-auto [scrollbar-width:none]"
        style={{ aspectRatio: "16/9" }}
      >
        {images.map((im, k) => (
          <button
            key={k}
            onClick={() => setOpen(k)}
            className="relative h-full w-full shrink-0 snap-center"
          >
            <img
              src={thumb(im.url, 1600)}
              alt=""
              width={im.w}
              height={im.h}
              className="h-full w-full object-cover"
            />
            {im.url.endsWith(".gif") && (
              <span className="absolute start-3 top-3 rounded-full bg-charcoal/80 px-2 text-caption text-snow">
                GIF
              </span>
            )}
          </button>
        ))}
      </div>
      {images.length > 1 && (
        <div className="absolute inset-x-0 bottom-3 flex justify-center gap-1">
          {images.map((_, k) => (
            <span
              key={k}
              className={`h-1 rounded-full bg-charcoal ${
                k === i ? "w-4" : "w-1.5 opacity-40"
              }`}
            />
          ))}
        </div>
      )}
      <AnimatePresence>
        {open !== null && (
          <Lightbox images={images} start={open} onClose={() => setOpen(null)} />
        )}
      </AnimatePresence>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
   Comments — تعليقات حيّة: إضافة/حذف فوري (Optimistic) + Realtime
   ════════════════════════════════════════════════════════════════ */
type C = {
  id: string;
  body: string;
  created_at: string;
  author_id: string;
  author: {
    display_name: string | null;
    username: string | null;
    avatar_url: string | null;
  } | null;
};
const C_SEL =
  "id,body,created_at,author_id,author:profiles!author_id(display_name,username,avatar_url)";

export function Comments({ promptId }: { promptId: string }) {
  const [items, setItems] = useState<C[] | null>(null);
  const [me, setMe] = useState<string>();
  const [mine, setMine] = useState<C["author"]>(null);
  const [text, setText] = useState("");
  const list = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let ch: ReturnType<typeof sb.channel>;
    uid().then(async (id) => {
      setMe(id);
      if (id)
        setMine(
          (
            await sb
              .from("profiles")
              .select("display_name,username,avatar_url")
              .eq("id", id)
              .single()
          ).data,
        );
    });
    sb.from("comments")
      .select(C_SEL)
      .eq("prompt_id", promptId)
      .order("created_at")
      .limit(100)
      .then(({ data }) => setItems((data as unknown as C[]) ?? []));

    ch = sb
      .channel(`c-${promptId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "comments", filter: `prompt_id=eq.${promptId}` },
        async (p: any) => {
          const { data } = await sb
            .from("comments")
            .select(C_SEL)
            .eq("id", p.new.id)
            .single();
          if (data)
            setItems((a) =>
              a && !a.some((x) => x.id === p.new.id)
                ? [...a, data as unknown as C]
                : a,
            );
        },
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "comments" },
        (p: any) => setItems((a) => a && a.filter((x) => x.id !== p.old.id)),
      )
      .subscribe();
    return () => {
      sb.removeChannel(ch);
    };
  }, [promptId]);

  useEffect(() => {
    const el = list.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [items?.length]);

  async function send() {
    const body = text.trim();
    if (!body) return;
    if (!me) return toast("سجّل الدخول أولاً");
    const id = crypto.randomUUID();
    setText("");
    navigator.vibrate?.(8);
    setItems((a) => [
      ...(a ?? []),
      {
        id,
        body,
        created_at: new Date().toISOString(),
        author_id: me,
        author: mine,
      },
    ]);
    const { error } = await sb
      .from("comments")
      .insert({ id, prompt_id: promptId, author_id: me, body });
    if (error) {
      setItems((a) => a && a.filter((x) => x.id !== id));
      setText(body);
      toast("تعذّر إرسال التعليق");
    }
  }

  async function del(c: C) {
    setItems((a) => a && a.filter((x) => x.id !== c.id));
    const { error } = await sb.from("comments").delete().eq("id", c.id);
    if (error) {
      setItems((a) =>
        a ? [...a, c].sort((x, y) => x.created_at.localeCompare(y.created_at)) : a,
      );
      toast("تعذّر الحذف");
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <div ref={list} className="flex min-h-0 max-h-[45vh] flex-1 flex-col gap-4 overflow-y-auto overscroll-contain py-1">
        {!items ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-9 animate-pulse rounded-xl bg-fog" />
          ))
        ) : !items.length ? (
          <p className="py-8 text-center text-graphite">كن أول من يعلّق.</p>
        ) : (
          items.map((c) => (
            <div key={c.id} className="flex gap-2">
              <span
                className="avatar h-7 w-7 text-caption"
                data-i={(c.author?.display_name ?? c.author?.username ?? "؟").slice(0, 1)}
              >
                {c.author?.avatar_url && <img src={c.author.avatar_url} alt="" />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-caption text-smoke">
                  <span className="font-bold text-charcoal">
                    {c.author?.display_name ?? c.author?.username ?? "مستخدم"}
                  </span>{" "}
                  · {ago(c.created_at)}
                </p>
                <p className="max-w-[65ch] whitespace-pre-wrap break-words text-caption">
                  {c.body}
                </p>
              </div>
              {c.author_id === me && (
                <button
                  onClick={() => del(c)}
                  aria-label="حذف"
                  className="icon-btn shrink-0 self-start"
                >
                  <X size={18} />
                </button>
              )}
            </div>
          ))
        )}
      </div>
      <div className="sticky bottom-0 flex items-center gap-2 border-t border-silver bg-snow pt-2 pb-1">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.nativeEvent.isComposing) {
              e.preventDefault();
              send();
            }
          }}
          maxLength={500}
          placeholder="اكتب تعليقاً…"
          className="field !min-h-9 flex-1 px-3.5 text-caption"
        />
        <button
          onClick={send}
          disabled={!text.trim()}
          aria-label="إرسال"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand text-snow transition-opacity active:opacity-80 disabled:bg-mist disabled:text-ash"
          style={{ opacity: text.trim() ? 1 : 0.45 } as React.CSSProperties}
        >
          <Send size={18} />
        </button>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
   Splash — شاشة افتتاح خيال
   ════════════════════════════════════════════════════════════════ */
export function Splash() {
  const [show, setShow] = useState(true);
  useEffect(() => {
    try {
      if (sessionStorage.getItem("khiyal:splash")) {
        setShow(false);
        return;
      }
    } catch {}
    const t = setTimeout(() => {
      setShow(false);
      try {
        sessionStorage.setItem("khiyal:splash", "1");
      } catch {}
    }, Math.max(900, 1600 - performance.now()));
    return () => clearTimeout(t);
  }, []);
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          key="splash"
          id="khiyal-splash"
          aria-hidden
          initial={false}
          exit={{ opacity: 0, scale: 1.04 }}
          transition={{ duration: 0.35, ease: [0.2, 0, 0, 1] }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, ease: [0.2, 0, 0, 1] }}
            className="flex flex-col items-center gap-4"
          >
            <LogoMark state="welcome" size={80} className="brand-mark !rounded-xl" decorative />
            <motion.h1
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25, duration: 0.4 }}
              className="text-2xl font-bold text-charcoal"
            >
              خيال
            </motion.h1>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4, duration: 0.4 }}
              className="text-caption text-smoke"
            >
              فكرتك تستحق صياغة أوضح
            </motion.p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ════════════════════════════════════════════════════════════════
   VarsSheet — تعبئة متغيرات القالب [المنتج] [الجمهور] ثم نسخ/تحسين
   ════════════════════════════════════════════════════════════════ */
export function VarsSheet({
  text,
  open,
  onClose,
}: {
  text: string;
  open: boolean;
  onClose: () => void;
}) {
  const vars = useMemo(() => extractVars(text), [text]);
  const [vals, setVals] = useState<Record<string, string>>({});
  const out = fillVars(text, vals);
  const ready = vars.every((v) => (vals[v] ?? "").trim());

  return (
    <BottomSheet open={open} onClose={onClose} title="عبّئ المتغيرات">
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto pb-4">
        {vars.map((v) => (
          <label key={v} className="flex flex-col gap-1">
            <span className="text-caption text-smoke">{v}</span>
            <input
              value={vals[v] ?? ""}
              onChange={(e) => setVals({ ...vals, [v]: e.target.value })}
              placeholder={`اكتب ${v}…`}
              className="field"
            />
          </label>
        ))}
        <p className="whitespace-pre-wrap rounded-xl bg-mist p-4 text-caption leading-relaxed">
          {out}
        </p>
        <div className="flex gap-2">
          <button
            disabled={!ready}
            onClick={async () => {
              await navigator.clipboard.writeText(out);
              navigator.vibrate?.(10);
              toast("نُسخ البرومبت جاهزاً");
            }}
            className="btn btn-primary !min-h-10 flex-1 disabled:opacity-50"
          >
            نسخ النتيجة
          </button>
          <Link
            href={`/enhance?text=${encodeURIComponent(out)}`}
            className="btn !min-h-10"
          >
            حسّن
          </Link>
        </div>
      </div>
    </BottomSheet>
  );
}
