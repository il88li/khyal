"use client";
// components/CardStudio.tsx — واجهة «بطاقتي» في الإعدادات > المظهر: معاينة حية + اختيار التأثيرات
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { CARD_FX_MAX_PROMPTS, FX_BG, FX_CARDS, FX_NAME, FX_STATS, sanitizeCardFx, type CardFx } from "@/lib/cardFx";
import { sb, toast, uid } from "@/lib/supabase";
import type { CardPrompt } from "./CreatorCard";

const CreatorCard = dynamic(() => import("./CreatorCard"), { ssr: false, loading: () => <div className="card h-[260px] animate-pulse bg-mist" /> });

type Own = { display_name: string | null; username: string | null; avatar_url: string | null; cover_url: string | null; card_fx: unknown };
type Row = { id: string; body: string; enhanced: string | null; title: string | null; images: { url: string }[] };

/** صف اختيار تأثير واحد */
function Pick<T extends string>({ label, list, value, set }: { label: string; list: Record<string, string>; value: T; set: (v: T) => void }) {
  const keys = Object.keys(list) as T[];
  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-caption text-smoke">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {keys.map((k) => (
          <button
            key={k}
            onClick={() => { set(k); navigator.vibrate?.(6); }}
            aria-pressed={value === k}
            className={`min-h-9 rounded-full border px-3 text-caption font-semibold transition-all active:scale-95 ${value === k ? "border-transparent bg-brand text-on-brand" : "border-silver bg-snow text-graphite"}`}
          >
            {list[k]}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function CardStudio() {
  const [p, setP] = useState<Own | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [fx, setFx] = useState<CardFx>({ v: 1, name: "none", stats: "none", bg: "none", cards: "none", prompts: [] });
  const [stats, setStats] = useState({ likes: 0, followers: 0 });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    uid().then(async (id) => {
      if (!id) return;
      const [{ data: pr }, { data: ps }, lk, fl] = await Promise.all([
        sb.from("profiles").select("display_name,username,avatar_url,cover_url,card_fx").eq("id", id).maybeSingle(),
        sb.from("prompts").select("id,body,enhanced,title,images").eq("author_id", id).order("created_at", { ascending: false }).limit(30),
        sb.from("prompts").select("like_count").eq("author_id", id),
        sb.from("follows").select("*", { count: "exact", head: true }).eq("following_id", id).eq("status", "accepted"),
      ]);
      if (pr) {
        setP(pr as Own);
        setFx(sanitizeCardFx((pr as Own).card_fx) ?? { v: 1, name: "none", stats: "none", bg: "none", cards: "none", prompts: [] });
      }
      setRows(((ps as { data: Row[] | null } | null)?.data as Row[]) ?? []);
      setStats({ likes: (lk.data ?? []).reduce((s, x) => s + (x.like_count ?? 0), 0), followers: fl.count ?? 0 });
    });
  }, []);

  const all: CardPrompt[] = rows.map((r) => ({ id: r.id, title: r.title, text: r.enhanced ?? r.body, image: r.images?.[0]?.url ?? null }));
  const togglePrompt = (id: string) =>
    setFx((f) => ({ ...f, prompts: f.prompts.includes(id) ? f.prompts.filter((x) => x !== id) : f.prompts.length >= CARD_FX_MAX_PROMPTS ? [...f.prompts.slice(1), id] : [...f.prompts, id] }));

  async function save() {
    setBusy(true);
    const id = await uid();
    const clean = sanitizeCardFx(fx);
    const { error } = await sb.from("profiles").update({ card_fx: clean }).eq("id", id!);
    setBusy(false);
    toast(error ? "تعذّر الحفظ" : clean ? "حُفظت بطاقتك" : "أُزيلت بطاقتك");
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-caption text-smoke">معاينة حية — تظهر لزوّار ملفك كما في الأسفل</p>

      {/* المعاينة الحية */}
      {p && (
        <CreatorCard
          fx={fx}
          preview
          profile={{
            name: p.display_name || p.username || "مبدع خيال",
            username: p.username,
            avatar_url: p.avatar_url,
            cover_url: p.cover_url,
            prompts: rows.length,
            likes: stats.likes,
            followers: stats.followers,
          }}
          items={all.filter((x) => fx.prompts.includes(x.id))}
        />
      )}

      <Pick label="تأثير الاسم" list={FX_NAME} value={fx.name} set={(name) => setFx((f) => ({ ...f, name }))} />
      <Pick label="تأثير الإحصاءات" list={FX_STATS} value={fx.stats} set={(stats) => setFx((f) => ({ ...f, stats }))} />
      <Pick label="تأثير خلفية الملف" list={FX_BG} value={fx.bg} set={(bg) => setFx((f) => ({ ...f, bg }))} />
      <Pick label="تأثير بطاقات البرومبتات" list={FX_CARDS} value={fx.cards} set={(cards) => setFx((f) => ({ ...f, cards }))} />

      {/* اختيار البرومبتات: حدّ أقصى 3 */}
      <div className="flex flex-col gap-1.5">
        <p className="text-caption text-smoke">برومبتات بطاقتك ({fx.prompts.length} من {CARD_FX_MAX_PROMPTS})</p>
        {!all.length ? (
          <p className="text-sm text-smoke">لا برومبتات بعد — انشر بعضها لتختار من هنا.</p>
        ) : (
          <div className="flex flex-col gap-1.5">
            {all.slice(0, 12).map((r) => {
              const on = fx.prompts.includes(r.id);
              return (
                <button
                  key={r.id}
                  onClick={() => togglePrompt(r.id)}
                  aria-pressed={on}
                  className={`flex min-h-11 items-center justify-between gap-3 rounded-xl border px-3 py-2 text-start transition-all active:scale-[0.99] ${on ? "border-brand/40 bg-brand-tint" : "border-silver bg-snow"}`}
                >
                  <span className="min-w-0 flex-1 truncate text-sm text-charcoal">{r.title || r.text.slice(0, 70)}</span>
                  <span className={`chip shrink-0 ${on ? "chip-ink" : ""}`}>{on ? "مختارة" : "اختيار"}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <button onClick={save} disabled={busy} className="btn btn-primary w-full">
        {busy ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" /> : "حفظ البطاقة"}
      </button>
    </div>
  );
}
