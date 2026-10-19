"use client";
// app/new/page.tsx — نشر برومبت: صور أولاً، ثم النص؛ العنوان والتصنيف والوسوم تُولَّد تلقائياً عند النشر
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronLeft, ChevronRight, ImagePlus, Sparkles, X } from "@/components/icons";
import { dims, explain, sb, toast, uid, uploadImage } from "@/lib/supabase";
import { publishReadiness } from "@/lib/algorithm";
import PromptCard from "@/components/PromptCard";
import type { Img, PromptRow } from "@/types";

type Item = { file: File; url: string; w: number; h: number; p: number };
type Phase = "idle" | "upload" | "analyze" | "save";
const MAX = 10, LIMIT = 8000;
const PHASE: Record<Phase, string> = { idle: "نشر", upload: "جارٍ رفع الصور…", analyze: "نحلّل البرومبت ونضع العنوان والتصنيف…", save: "جارٍ النشر…" };

export default function NewPrompt() {
  const router = useRouter(), input = useRef<HTMLInputElement>(null);
  const [text, setText] = useState(""), [items, setItems] = useState<Item[]>([]), [cats, setCats] = useState<{ id: number; name_ar: string }[]>([]);
  const [phase, setPhase] = useState<Phase>("idle"), [preview, setPreview] = useState(false);
  const [forkOf, setForkOf] = useState<string | null>(null), [forkCat, setForkCat] = useState<number | null>(null);
  const busy = phase !== "idle";
  const ready = useMemo(() => publishReadiness({ text, images: items.length }), [text, items.length]);

  useEffect(() => { // تفريع: املأ النموذج بنص الأصل وانسبه عند النشر
    const f = new URLSearchParams(location.search).get("fork"); if (!f) return;
    sb.from("prompts").select("id,body,enhanced,category_id").eq("id", f).maybeSingle().then(({ data }) => { if (data) { setForkOf(data.id); setText(data.enhanced ?? data.body); setForkCat(data.category_id ?? null); } });
  }, []);
  useEffect(() => { sb.from("categories").select("id,name_ar").eq("active", true).order("sort").then(({ data }) => data && setCats(data)); }, []);

  async function pick(files: FileList | null) {
    if (!files) return;
    const room = MAX - items.length; if (files.length > room) toast(`الحد الأقصى ${MAX} صور`);
    const add = await Promise.all(Array.from(files).filter((f) => f.type.startsWith("image/")).slice(0, room).map(async (file) => ({ file, url: URL.createObjectURL(file), ...(await dims(file)), p: 0 })));
    setItems((a) => [...a, ...add]);
  }
  const move = (i: number, d: number) => setItems((a) => { const b = [...a], j = i + d; if (j < 0 || j >= b.length) return a; [b[i], b[j]] = [b[j], b[i]]; return b; });

  /** عنوان وتصنيف ووسوم: فشلها لا يمنع النشر */
  async function classify(body: string) {
    const ac = new AbortController(), t = setTimeout(() => ac.abort(), 45_000);
    try {
      const r = await fetch("/api/classify", { method: "POST", headers: { "Content-Type": "application/json" }, signal: ac.signal, body: JSON.stringify({ text: body, cats: cats.map((c) => ({ id: c.id, name: c.name_ar })) }) });
      return r.ok ? await r.json() : null;
    } catch { return null; } finally { clearTimeout(t); }
  }

  async function publish() {
    const id = await uid(); if (!id) return toast("سجّل الدخول أولاً");
    const body = text.trim(); if (!body || busy) return;
    try {
      setPhase("upload");
      const imgs: Img[] = [];
      for (let i = 0; i < items.length; i++) imgs.push(await uploadImage(items[i].file, id, (p) => setItems((a) => a.map((x, j) => (j === i ? { ...x, p } : x)))));
      setPhase("analyze");
      const ai = await classify(body);
      setPhase("save");
      const row: any = { author_id: id, body, category_id: ai?.category_id ?? forkCat, images: imgs, title: ai?.title ?? null, tags: ai?.tags ?? [] };
      if (forkOf) row.forked_from = forkOf;
      let { error } = await sb.from("prompts").insert(row);
      if (error && /title|tags|forked_from|schema cache|column/i.test(error.message)) { // مخطط قديم: انشر بدون الأعمدة الاختيارية
        delete row.title; delete row.tags; if (!forkOf || /forked_from/i.test(error.message)) delete row.forked_from;
        ({ error } = await sb.from("prompts").insert(row));
      }
      if (error) throw error;
      (window as any).__feedDirty = true; toast("تم النشر"); router.push("/");
    } catch (e: any) { toast(explain(e)); setPhase("idle"); }
  }

  const row: PromptRow = { id: "preview", body: text, enhanced: null, model: null, like_count: 0, comment_count: 0, created_at: new Date().toISOString(), category_id: forkCat, title: null, images: items.map((i) => ({ url: i.url, w: i.w, h: i.h })), author: { id: "", username: "", display_name: "معاينة", avatar_url: null } };
  const ib = "flex h-8 w-8 items-center justify-center rounded-full bg-snow/90 text-charcoal";

  return (
    <main className="mx-auto flex w-full max-w-xl flex-col gap-4 pt-2">
      <header className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-charcoal">برومبت جديد</h1>
        <button onClick={() => setPreview(!preview)} disabled={busy} className="btn btn-secondary btn-md">{preview ? "تحرير" : "معاينة"}</button>
      </header>

      {preview ? <PromptCard p={row} /> : (<>
        {forkOf && <p className="rounded-xl bg-brand-tint p-4 text-sm text-brand-ink">مفرّع من برومبت آخر — سيُنسب الأصل تلقائياً، عدّل كما تشاء.</p>}

        <section aria-label="الصور" className="flex flex-col gap-2">
          <div className="flex items-center justify-between"><h2 className="text-lg font-bold text-charcoal">الصور</h2><span className="text-sm tabular-nums text-smoke">{items.length}/{MAX}</span></div>
          <div className="bento">
            {!items.length && (
              <button onClick={() => input.current?.click()} className="span-2 flex aspect-[2/1] flex-col items-center justify-center gap-2 rounded-xl bg-mist text-smoke transition-all active:scale-95">
                <ImagePlus size={32} /><span className="text-sm font-medium">أضف صوراً للبرومبت (اختياري)</span>
              </button>)}
            {items.map((it, i) => (
              <div key={it.url} className={`relative overflow-hidden rounded-xl bg-mist ${i === 0 ? "span-2" : ""}`} style={{ aspectRatio: i === 0 ? Math.min(Math.max(it.w / it.h, 0.8), 1.91) : 1 }}>
                <img src={it.url} alt="" className="h-full w-full object-cover" />
                {phase === "upload" ? <span className="absolute inset-x-0 bottom-0 h-1 bg-brand" style={{ width: `${it.p}%` }} /> : <>
                  <button onClick={() => setItems((a) => a.filter((_, j) => j !== i))} disabled={busy} aria-label="حذف" className={`${ib} absolute end-2 top-2`}><X size={16} /></button>
                  <div className="absolute inset-x-2 bottom-2 flex justify-between">
                    <button onClick={() => move(i, 1)} disabled={busy} aria-label="تأخير" className={ib}><ChevronLeft size={16} /></button>
                    <button onClick={() => move(i, -1)} disabled={busy} aria-label="تقديم" className={ib}><ChevronRight size={16} /></button>
                  </div></>}
              </div>))}
            {!!items.length && items.length < MAX && (
              <button onClick={() => input.current?.click()} aria-label="إضافة صور" className="flex aspect-square items-center justify-center rounded-xl bg-mist text-smoke transition-all active:scale-95"><ImagePlus size={24} /></button>)}
          </div>
          <input ref={input} type="file" accept="image/*" multiple hidden onChange={(e) => { pick(e.target.files); e.target.value = ""; }} />
        </section>

        <section aria-label="البرومبت" className="flex flex-col gap-2">
          <div className="flex items-center justify-between"><h2 className="text-lg font-bold text-charcoal">البرومبت</h2><span className="text-sm tabular-nums text-smoke">{text.length}/{LIMIT}</span></div>
          <textarea value={text} onChange={(e) => setText(e.target.value.slice(0, LIMIT))} rows={8} disabled={busy} placeholder="اكتب البرومبت…" className="field min-h-[200px] w-full resize-none py-3 text-base" />
        </section>

        <div className="flex items-start gap-4 rounded-xl bg-brand-tint p-4 text-brand-ink">
          <Sparkles size={24} className="shrink-0" />
          <p className="text-sm">العنوان والتصنيف والوسوم يُولَّدون تلقائياً بالذكاء الاصطناعي عند النشر، بلا أي تدخل منك.</p>
        </div>

        {/* مقياس جاهزية النشر — يعلّم المنشئ كيف يرفع وصول برومبته قبل النشر */}
        <section aria-label="جاهزية النشر" className="card flex flex-col gap-3 p-4 shadow-soft">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-charcoal">جاهزية النشر</h2>
            <span className={`text-sm font-semibold tabular-nums ${ready.tone}`}>{ready.total}٪ · {ready.label}</span>
          </div>
          <span className="h-2 overflow-hidden rounded-full bg-mist"><span className="block h-full rounded-full bg-brand transition-[width] duration-300" style={{ width: `${ready.total}%` }} /></span>
          <ul className="flex flex-col gap-1.5">
            {ready.checks.map((c) => (
              <li key={c.key} className="flex items-start gap-2 text-caption">
                <span className={`mt-0.5 shrink-0 ${c.ok ? "text-ok-ink" : "text-smoke"}`}>{c.ok ? <Check size={14} /> : <X size={14} />}</span>
                <span className={c.ok ? "text-charcoal" : "text-graphite"}><b className="font-medium">{c.label}</b>{!c.ok && <span className="text-smoke"> — {c.hint}</span>}</span>
              </li>
            ))}
          </ul>
        </section>
      </>)}

      <div className="sticky bottom-[calc(84px+env(safe-area-inset-bottom))] z-10 -mx-4 bg-fog px-4 pb-2 pt-2">
        <button onClick={publish} disabled={busy || !text.trim()} aria-busy={busy} className="btn btn-primary btn-lg w-full">
          {busy && <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />}{PHASE[phase]}
        </button>
      </div>
    </main>
  );
}
