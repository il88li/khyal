"use client";
// app/library/page.tsx — مكتبتي: النسخ المحسّنة المحفوظة (خاصة بي): بحث، فلترة بالفئة، نسخ، إعادة تحسين، نشر، حذف
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { Copy, Send, Sparkles, Trash2, BookMarked, Search } from "@/components/icons";
import { EmptyState, ErrorState, Skeleton } from "@/components/states";
import { sb, toast, uid, ago, explain } from "@/lib/supabase";

type Item = { id: string; body: string; enhanced: string; model: string | null; category_id: number | null; created_at: string };

export default function Library() {
  const [items, setItems] = useState<Item[] | null>(null), [cats, setCats] = useState<Record<number, string>>({});
  const [cat, setCat] = useState<number | null>(null), [q, setQ] = useState(""), [open, setOpen] = useState<string | null>(null), [err, setErr] = useState(""), [tick, setTick] = useState(0);

  useEffect(() => {
    (async () => {
      const id = await uid(); if (!id) return;
      const [l, c] = await Promise.all([
        sb.from("library").select("id,body,enhanced,model,category_id,created_at").eq("user_id", id).order("created_at", { ascending: false }).limit(200),
        sb.from("categories").select("id,name_ar"),
      ]);
      if (l.error) { setErr(explain(l.error)); setItems([]); return; }
      setItems((l.data as Item[]) ?? []); setCats(Object.fromEntries((c.data ?? []).map((x: any) => [x.id, x.name_ar])));
    })();
  }, [tick]);

  const usedCats = useMemo(() => Array.from(new Set((items ?? []).map((i) => i.category_id).filter((x): x is number => x != null))), [items]);
  const list = useMemo(() => (items ?? []).filter((i) => (cat == null || i.category_id === cat) && (!q.trim() || (i.body + " " + i.enhanced).toLowerCase().includes(q.trim().toLowerCase()))), [items, cat, q]);

  const copy = async (t: string) => { await navigator.clipboard.writeText(t); navigator.vibrate?.(10); toast("نُسخ البرومبت"); };
  async function publish(i: Item) {
    const id = await uid(); if (!id) return;
    const { error } = await sb.from("prompts").insert({ author_id: id, body: i.body, enhanced: i.enhanced, category_id: i.category_id, model: i.model });
    if (error) return toast(explain(error));
    (window as any).__feedDirty = true; toast("تم النشر على حسابك");
  }
  async function remove(i: Item) {
    if (!confirm("حذف هذا العنصر من مكتبتك؟")) return;
    const prev = items; setItems((a) => a && a.filter((x) => x.id !== i.id));
    const { error } = await sb.from("library").delete().eq("id", i.id);
    if (error) { setItems(prev); toast(explain(error)); } else toast("تم الحذف");
  }

  const chip = (on: boolean) => `chip !h-11 shrink-0 border px-3.5 text-base font-semibold ${on ? "border-transparent bg-charcoal text-snow" : "border-silver bg-snow text-graphite"}`;
  return (
    <main className="flex flex-col gap-4 pt-2">
      <div className="relative">
        <Search size={21} className="absolute start-4 top-1/2 -translate-y-1/2 text-smoke" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ابحث في مكتبتك…" className="field !min-h-10 !rounded-full ps-11 pe-4 shadow-soft" />
      </div>
      {usedCats.length > 0 && (
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 md:mx-0 md:px-0 [scrollbar-width:none]">
          <button onClick={() => setCat(null)} className={chip(cat == null)}>الكل</button>
          {usedCats.map((c) => <button key={c} onClick={() => setCat(c)} className={chip(cat === c)}>{cats[c] ?? "عام"}</button>)}
        </div>)}

      {err ? <ErrorState message={err} onRetry={() => { setErr(""); setItems(null); setTick((t) => t + 1); }} />
        : !items ? <Skeleton variant="card" count={3} />
        : !items.length ? <EmptyState icon={BookMarked} title="مكتبتك فارغة" hint="حسّن برومبتاً واضغط «حفظ» ليظهر هنا." action={{ label: "ابدأ التحسين", href: "/enhance" }} />
        : !list.length ? <EmptyState icon={Search} title="لا نتائج مطابقة" hint="جرّب كلمات أخرى." />
        : (
          <div className="flex flex-col gap-4 pb-4">
            <AnimatePresence initial={false}>
              {list.map((i) => (
                <motion.article key={i.id} layout initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96 }} transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  className="card flex flex-col gap-4 p-4">
                  <header className="flex items-center justify-between">
                    <span className="chip chip-brand">{cats[i.category_id ?? -1] ?? "عام"}</span>
                    <span className="text-caption text-smoke">{ago(i.created_at)}</span>
                  </header>
                  <p onClick={() => setOpen(open === i.id ? null : i.id)} className={`cursor-pointer whitespace-pre-wrap text-base ${open === i.id ? "" : "line-clamp-5"}`}>{i.enhanced}</p>
                  {open === i.id && <div className="rounded-xl bg-mist p-4"><p className="text-caption text-smoke">النص الأصلي</p><p className="whitespace-pre-wrap text-sm text-graphite">{i.body}</p></div>}
                  <footer className="flex flex-wrap gap-2">
                    <button onClick={() => copy(i.enhanced)} className="btn"><Copy size={19} />نسخ</button>
                    <Link href={`/enhance?text=${encodeURIComponent(i.body)}`} className="btn"><Sparkles size={19} />حسّن</Link>
                    <button onClick={() => publish(i)} className="btn btn-soft"><Send size={19} />نشر</button>
                    <button onClick={() => remove(i)} aria-label="حذف" className="btn !px-3 text-smoke"><Trash2 size={19} /></button>
                  </footer>
                </motion.article>))}
            </AnimatePresence>
          </div>)}
    </main>
  );
}
