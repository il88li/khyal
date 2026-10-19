"use client";
// app/enhance/page.tsx — تحسين مضغوط: كل شيء داخل الشاشة بلا تمرير، بلا أي إفصاح تقني عن النماذج أو المزودين
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Copy, RefreshCw, Bookmark, Send, Square, SlidersHorizontal, History } from "@/components/icons";
import { ago, explain, sb, toast, wordDiff } from "@/lib/supabase";
import { BottomSheet, Skeleton } from "@/components/ui";

const LANGS = ["عربي", "إنجليزي", "ثنائي"], TONES = ["رسمي", "ودّي", "تقني", "تسويقي", "أكاديمي"], DETAILS = ["موجز", "متوازن", "مفصّل"];
const KEY = "khiyal:enhance";
type Cat = { id: number; name_ar: string };

type Hist = { id: string; text: string; out: string; t: number };
const HK = "khiyal:history", EXAMPLES = ["اكتب مقالاً عن فوائد القراءة", "صمّم شعاراً لمقهى عصري", "اشرح الذكاء الاصطناعي لطفل", "اكتب دالة لترتيب قائمة أرقام"];
const readHist = (): Hist[] => { try { return JSON.parse(localStorage.getItem(HK) || "[]"); } catch { return []; } };
function pushHistory(text: string, out: string) {
  try { localStorage.setItem(HK, JSON.stringify([{ id: crypto.randomUUID(), text, out, t: Date.now() }, ...readHist()].slice(0, 20))); } catch {}
}

function Chips({ items, value, onChange, wrap }: { items: string[]; value: string; onChange: (v: string) => void; wrap?: boolean }) {
  return (
    <div className={wrap ? "flex flex-wrap gap-2" : "-mx-4 flex gap-2 overflow-x-auto px-4 md:mx-0 md:px-0 [scrollbar-width:none]"}>
      {items.map((i) => <button key={i} onClick={() => onChange(i)} className={`min-h-9 shrink-0 rounded-full border px-3.5 text-base font-semibold ${value === i ? "border-transparent bg-charcoal text-snow" : "border-silver bg-snow text-graphite"}`}>{i}</button>)}
    </div>
  );
}

function Enhancer() {
  const router = useRouter(), qs = useSearchParams();
  const [text, setText] = useState(qs.get("text") ?? ""), [cats, setCats] = useState<Cat[]>([]), [cat, setCat] = useState<Cat | null>(null);
  const [lang, setLang] = useState("عربي"), [tone, setTone] = useState("ودّي"), [detail, setDetail] = useState("متوازن"), [opts, setOpts] = useState(false);
  const [out, setOut] = useState(""), [err, setErr] = useState(""), [busy, setBusy] = useState(false), [editing, setEditing] = useState(false);
  const [view, setView] = useState<"res" | "diff">("res"), [saving, setSaving] = useState("");
  const ctl = useRef<AbortController | null>(null);
  const [hist, setHist] = useState<Hist[]>([]), [histOpen, setHistOpen] = useState(false), first = useRef(true);

  useEffect(() => {
    if (!qs.get("text")) { try { const d = localStorage.getItem("khiyal:draft"); if (d) setText(d); } catch {} } // استعادة المسودة
    try { const p = JSON.parse(localStorage.getItem(KEY) || "{}"); p.lang && setLang(p.lang); p.tone && setTone(p.tone); p.detail && setDetail(p.detail); } catch {}
    sb.from("categories").select("id,name_ar").eq("active", true).order("sort").then(({ data }) => { if (data?.length) { setCats(data); setCat(data[0]); } });
  }, []);
  useEffect(() => { try { const p = JSON.parse(localStorage.getItem(KEY) || "{}"); localStorage.setItem(KEY, JSON.stringify({ ...p, lang, tone, detail })); } catch {} }, [lang, tone, detail]);
  useEffect(() => { if (first.current) { first.current = false; return; } try { localStorage.setItem("khiyal:draft", text); } catch {} }, [text]); // حفظ المسودة تلقائياً
  useEffect(() => { // اقتراح الفئة من النص
    if (!cats.length || text.length < 12) return;
    const rules: [RegExp, string][] = [[/كود|دالة|برمج|code|function|api/i, "برمجة"], [/ترجم|translate/i, "ترجمة"], [/صورة|image|midjourney/i, "صور"], [/فيديو|video/i, "فيديو"], [/إعلان|تسويق|marketing/i, "تسويق"], [/تصميم|شعار|design|logo/i, "تصميم"]];
    const hit = rules.find(([r]) => r.test(text)), c = hit && cats.find((x) => x.name_ar === hit[1]);
    if (c && c.id !== cat?.id) setCat(c);
  }, [text, cats]); // eslint-disable-line

  async function run() {
    if (!text.trim() || busy) return;
    setBusy(true); setOut(""); setErr(""); setView("res"); setEditing(false);
    ctl.current = new AbortController();
    try {
      const res = await fetch("/api/enhance", { method: "POST", headers: { "Content-Type": "application/json" }, signal: ctl.current.signal, body: JSON.stringify({ text, category: cat?.name_ar, lang, tone, detail }) });
      if (!res.ok || !res.body) {
        const j = await res.json().catch(() => ({}));
        // رسائل عربية بلا أي إشارة تقنية (لا نماذج ولا مزودين ولا مفاتيح)
        const m = res.status === 401 ? "سجّل الدخول أولاً"
          : res.status === 429 ? (j.error === "guest_limit" ? "جرّبتَ حدّ التجربة اليوم — سجّل الدخول لمتابعة التحسين" : "طلبات كثيرة، انتظر قليلاً")
          : j.error === "disabled" ? "المحسّن متوقف مؤقتاً"
          : j.error === "bad_input" ? "تأكد من كتابة فكرة واضحة ثم أعد المحاولة"
          : "الخدمة مشغولة الآن، أعد المحاولة بعد لحظات";
        setErr(m); setBusy(false); return;
      }
      const reader = res.body.getReader(), dec = new TextDecoder(); let buf = "", acc = "";
      for (;;) {
        const { done, value } = await reader.read(); if (done) { if (acc.trim()) pushHistory(text, acc); break; }
        buf += dec.decode(value, { stream: true });
        const lines = buf.split("\n"); buf = lines.pop() ?? "";
        for (const l of lines) {
          if (!l.startsWith("data: ") || l.includes("[DONE]")) continue;
          let j: any; try { j = JSON.parse(l.slice(6)); } catch { continue; }
          if (j.error) { console.error("enhance stream", j.error); setErr("تعذّر إتمام التحسين، أعد المحاولة بعد لحظات"); continue; }
          const d = j.choices?.[0]?.delta?.content; if (d) { acc += d; setOut((o) => o + d); }
        }
      }
    } catch (e: any) { if (e.name !== "AbortError") setErr("تعذّر الاتصال بالخادم"); }
    setBusy(false);
  }
  async function persist(kind: "library" | "prompts") {
    const id = (await sb.auth.getSession()).data.session?.user.id; if (!id || !out) return;
    setSaving(kind);
    const base = { body: text, enhanced: out, category_id: cat?.id };
    const { error } = kind === "library" ? await sb.from("library").insert({ user_id: id, ...base }) : await sb.from("prompts").insert({ author_id: id, ...base });
    setSaving("");
    if (error) return toast(explain(error));
    toast(kind === "library" ? "حُفظ في مكتبتك" : "تم النشر");
    if (kind === "prompts") { (window as any).__feedDirty = true; router.push("/"); }
  }
  const diff = useMemo(() => (view === "diff" && out ? wordDiff(text, out) : null), [view, text, out]);
  const copy = async () => { await navigator.clipboard.writeText(out); navigator.vibrate?.(10); toast("نُسخ البرومبت"); };
  const showResult = (out || busy || err) && !editing;
  const act = "btn btn-ghost !min-h-10 flex-1 disabled:text-ash";
  const step = !text.trim() ? 1 : !out && !busy ? 2 : 3; // خيال: اختر ← خصّص ← أنشئ

  return (
    <main className="flex flex-col gap-4 pb-1" style={{ height: "calc(100dvh - var(--top) - var(--bottom) - env(safe-area-inset-top) - env(safe-area-inset-bottom))" }}>
      <div className="flex shrink-0 items-center gap-1.5">
        {([[1, "اختر"], [2, "خصّص"], [3, "أنشئ"]] as const).map(([n, l]) => (
          <span key={n} className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-caption font-medium ${step === n ? "bg-brand text-snow" : step > n ? "bg-brand-tint text-brand-ink" : "bg-mist text-smoke"}`}>
            <span className={`flex h-4 w-4 items-center justify-center rounded-full text-caption ${step === n ? "bg-snow text-brand-ink" : ""}`}>{n}</span>{l}
          </span>))}
      </div>
      {showResult ? (
        <button onClick={() => setEditing(true)} className="flex shrink-0 items-center gap-4 card-flat p-4 text-start">
          <span className="min-w-0 flex-1"><span className="block text-caption text-smoke">النص الأصلي</span><span className="line-clamp-1 text-sm">{text}</span></span>
          <span className="btn btn-soft !min-h-10 !px-3">تعديل</span>
        </button>
      ) : (<>
        <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="اكتب فكرتك… أو الصق برومبتًا خامًا" className="field min-h-[120px] flex-1 resize-none py-3 text-base" />
        {!text && <div className="flex shrink-0 flex-wrap gap-2">{EXAMPLES.map((x) => <button key={x} onClick={() => setText(x)} className="btn btn-soft !min-h-9 !px-3 !text-caption">{x}</button>)}</div>}
        <div className="shrink-0"><Chips items={cats.map((c) => c.name_ar)} value={cat?.name_ar ?? ""} onChange={(v) => setCat(cats.find((c) => c.name_ar === v) ?? null)} /></div>
        <div className="flex shrink-0 gap-2"><button onClick={() => setOpts(true)} className="flex min-h-11 flex-1 items-center justify-between rounded-xl bg-mist px-4 text-sm">
          <span className="flex items-center gap-2"><SlidersHorizontal size={19} className="text-brand-ink" />{lang} · {tone} · {detail}</span><span className="btn btn-soft !min-h-10 !px-3">تغيير</span>
        </button>
        <button onClick={() => { setHist(readHist()); setHistOpen(true); }} aria-label="السجل" className="btn !min-h-10 !px-3"><History size={21} /></button></div>
      </>)}

      <button onClick={busy ? () => ctl.current?.abort() : run} disabled={!busy && !text.trim()}
        style={{ background: "linear-gradient(180deg, rgb(var(--brand-hi)), rgb(var(--brand-lo)))" }} className="flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-full text-sm font-semibold text-snow shadow-pop active:opacity-80 disabled:bg-mist disabled:text-ash disabled:shadow-none">
        {busy ? <><Square size={19} />إيقاف</> : out && !editing ? <><RefreshCw size={19} />إعادة التوليد</> : "أنشئ النتيجة"}
      </button>

      <AnimatePresence>
        {showResult && (
          <motion.section initial={{ y: 12, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ opacity: 0 }} transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="card flex min-h-0 flex-1 flex-col gap-2 p-4">
            {err && !out ? (
              <div className="flex-1 overflow-y-auto"><p className="text-sm">{err.split("\n")[0]}</p></div>
            ) : (<>
              <div className="flex shrink-0 items-center justify-between gap-2">
                <div className="flex gap-1">{(["res", "diff"] as const).map((v) => <button key={v} onClick={() => setView(v)} className={`chip !h-10 px-3 text-base font-semibold ${view === v ? "chip-brand" : ""}`}>{v === "res" ? "النتيجة" : "الفرق"}</button>)}</div>
                <span className="max-w-[55%] truncate text-caption text-smoke">{busy ? "جارٍ التحسين…" : ""}</span>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto whitespace-pre-wrap text-base">
                {view === "diff" && diff ? diff.map((p, i) => <span key={i} className={p.k === "del" ? "text-smoke line-through" : p.k === "add" ? "border-b border-brand" : ""}>{p.t}</span>) : out || <Skeleton lines={6} className="pt-1" />}
              </div>
              <div className="flex shrink-0 gap-2">
                <button onClick={copy} disabled={!out} className={act}><Copy size={19} />نسخ</button>
                <button onClick={() => persist("library")} disabled={!out || busy || !!saving} className={act}><Bookmark size={19} />{saving === "library" ? "…" : "حفظ"}</button>
                <button onClick={() => persist("prompts")} disabled={!out || busy || !!saving} className={`${act} !border-transparent !bg-brand !text-[rgb(var(--on-brand))]`}><Send size={19} />{saving === "prompts" ? "…" : "انشر"}</button>
              </div>
            </>)}
          </motion.section>
        )}
      </AnimatePresence>

      <BottomSheet compact open={opts} onClose={() => setOpts(false)} title="خيارات التحسين">
        <div className="flex flex-col gap-4 pb-2">
          <p className="text-caption text-smoke">اللغة</p><Chips wrap items={LANGS} value={lang} onChange={setLang} />
          <p className="text-caption text-smoke">النبرة</p><Chips wrap items={TONES} value={tone} onChange={setTone} />
          <p className="text-caption text-smoke">التفصيل</p><Chips wrap items={DETAILS} value={detail} onChange={setDetail} />
          <p className="rounded-xl bg-brand-tint p-4 text-caption text-graphite">تُصاغ النتيجة تلقائياً بأعلى جودة متاحة، وباللغة والنبرة والتفصيل التي تختارها — كل ذلك دون أي إعدادات تقنية منك.</p>
          <button onClick={() => setOpts(false)} className="btn btn-primary w-full !min-h-10">تم</button>
        </div>
      </BottomSheet>

      <BottomSheet open={histOpen} onClose={() => setHistOpen(false)} title="سجل التحسينات">
        <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto pb-4">
          {!hist.length ? <p className="py-10 text-center text-graphite">لا يوجد سجل بعد.</p> : hist.map((h) => (
            <button key={h.id} onClick={() => { setText(h.text); setOut(h.out); setErr(""); setEditing(false); setView("res"); setHistOpen(false); }}
              className="flex flex-col gap-1 card p-4 text-start active:opacity-70">
              <span className="line-clamp-1 text-sm font-medium">{h.text}</span><span className="line-clamp-2 text-caption text-graphite">{h.out}</span>
              <span className="text-caption text-smoke">{ago(new Date(h.t).toISOString())}</span></button>))}
          {!!hist.length && <button onClick={() => { try { localStorage.removeItem(HK); } catch {} setHist([]); }} className="btn text-smoke">مسح السجل</button>}
        </div>
      </BottomSheet>
    </main>
  );
}

export default function Page() { return <Suspense><Enhancer /></Suspense>; }
