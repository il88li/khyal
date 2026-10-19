"use client";
// app/verification/page.tsx — توثيق الحساب: شروط واضحة + إرسال الطلب للمراجعة
import { useEffect, useState } from "react";
import { BadgeCheck, ShieldCheck, Check, FileText, Heart, Users, History, Loader2, Sparkles } from "@/components/icons";
import { uid, explain } from "@/lib/supabase";
import { verificationStats, requestVerification, VERIFY_RULES } from "@/lib/verification";
import { Skeleton, ErrorState } from "@/components/states";
import type { VerificationStats } from "@/types";

const ICONS: Record<string, typeof FileText> = { prompts: FileText, likes: Heart, followers: Users, days: History };

export default function VerificationPage() {
  const [s, setS] = useState<VerificationStats | null>(null);
  const [loading, setLoading] = useState(true), [err, setErr] = useState(""), [note, setNote] = useState(""), [busy, setBusy] = useState(false), [tick, setTick] = useState(0);

  useEffect(() => {
    (async () => {
      const id = await uid(); if (!id) { setLoading(false); return; }
      const r = await verificationStats(id);
      if (!r) { setErr("تعذّر تحميل شروط التوثيق."); setLoading(false); return; }
      setS(r); setLoading(false);
    })();
  }, [tick]);

  async function submit() {
    setBusy(true);
    const ok = await requestVerification(note);
    if (ok) setTick((t) => t + 1);
    setBusy(false);
  }

  if (err) return <ErrorState message={err} onRetry={() => { setErr(""); setLoading(true); setTick((t) => t + 1); }} />;
  if (loading || !s) return <Skeleton variant="card" count={2} className="pt-2" />;

  const rows = VERIFY_RULES.map((r) => {
    const value = s[r.key] as number, goal = s[r.min] as number, done = value >= goal;
    return { ...r, value, goal, done, pct: Math.min(100, Math.round((value / goal) * 100)) };
  });
  const doneCount = rows.filter((r) => r.done).length;

  return (
    <main className="flex flex-col gap-4 pt-2 pb-4">
      <section className={`card flex flex-col items-center gap-3 p-5 text-center shadow-soft ${s.verified ? "border-ok/40 bg-ok-tint" : ""}`}>
        <span className={`flex h-16 w-16 items-center justify-center rounded-full ${s.verified ? "bg-ok text-snow shadow-pop" : "bg-brand-tint text-brand-ink"}`}>
          {s.verified ? <BadgeCheck size={34} /> : <ShieldCheck size={32} />}
        </span>
        <h2 className="text-xl font-bold text-charcoal">{s.verified ? "حسابك موثّق" : "التوثيق في خيال"}</h2>
        <p className="max-w-md text-caption text-graphite">
          {s.verified
            ? "تظهر شارة التوثيق بجانب اسمك على برومبتاتك وملفك الشخصي."
            : "شارة التوثيق تمنح جمهورك ثقة أكبر: تظهر على برومبتاتك وملفك الشخصي. أكمل الشروط الأربعة ثم أرسل طلبك للمراجعة."}
        </p>
        {s.verified ? (
          <span className="chip chip-gold !h-9 px-3"><BadgeCheck size={17} />موثّق</span>
        ) : (
          <span className="chip !h-9 px-3 text-caption">{doneCount} من {rows.length} شروط مكتملة</span>
        )}
      </section>

      {!s.verified && (
        <section className="card flex flex-col gap-4 p-4 shadow-soft">
          <h2 className="text-lg font-bold text-charcoal">شروط التوثيق</h2>
          <div className="flex flex-col gap-3.5">
            {rows.map((r) => {
              const Icon = ICONS[r.key];
              return (
                <div key={r.key} className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2 text-sm font-medium text-charcoal">
                      <Icon size={18} className={r.done ? "text-ok-ink" : "text-smoke"} />{r.label}
                    </span>
                    <span dir="ltr" className={`text-caption tabular-nums ${r.done ? "text-ok-ink" : "text-smoke"}`}>
                      {r.done && <Check size={14} className="inline align-middle" />} {r.value} / {r.goal}
                    </span>
                  </div>
                  <span className="h-2 overflow-hidden rounded-full bg-mist">
                    <span className={`block h-full rounded-full ${r.done ? "bg-ok" : "bg-brand"}`} style={{ width: `${r.done ? 100 : r.pct}%` }} />
                  </span>
                </div>
              );
            })}
          </div>

          {s.eligible && s.status !== "pending" && (
            <div className="flex flex-col gap-3 border-t border-silver pt-4">
              <label className="text-sm font-medium text-charcoal" htmlFor="vnote">ملاحظة للمراجعة (اختياري)</label>
              <textarea id="vnote" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} rows={3}
                placeholder="عرّفنا بنفسك وبمحتواك بإيجاز…" className="w-full resize-none rounded-xl border border-silver bg-fog p-3 text-sm outline-none focus:border-brand" />
              <button onClick={submit} disabled={busy} className="btn btn-primary self-start">
                {busy ? <><Loader2 size={18} className="animate-spin" />جارٍ الإرسال…</> : <><BadgeCheck size={18} />أرسل طلب التوثيق</>}
              </button>
            </div>
          )}
          {s.status === "pending" && (
            <p className="rounded-xl bg-info-tint p-3 text-caption text-info-ink">طلبك قيد المراجعة — سنبلغك بالنتيجة عبر الإشعارات.</p>
          )}
          {s.status === "rejected" && (
            <p className="rounded-xl bg-danger-tint p-3 text-caption text-danger">لم يُقبل طلبك السابق حالياً. واصل النشر ويمكنك التقديم مجدداً عند استيفاء الشروط.</p>
          )}
        </section>
      )}

      <section className="card flex flex-col gap-3 p-4 shadow-soft">
        <h2 className="flex items-center gap-2 text-lg font-bold text-charcoal"><Sparkles size={20} className="text-brand-ink" />ماذا يمنحك التوثيق؟</h2>
        <ul className="flex flex-col gap-2 text-sm text-graphite">
          <li className="flex items-start gap-2"><Check size={17} className="mt-0.5 shrink-0 text-ok-ink" />شارة موثّق بجانب اسمك في كل مكان داخل خيال.</li>
          <li className="flex items-start gap-2"><Check size={17} className="mt-0.5 shrink-0 text-ok-ink" />ثقة أعلى من الجمهور وفرص ظهور أفضل في الخلاصات.</li>
          <li className="flex items-start gap-2"><Check size={17} className="mt-0.5 shrink-0 text-ok-ink" />أولوية في الترتيب والمشاركة بمبادرات خيال للمنشئين.</li>
        </ul>
      </section>
    </main>
  );
}
