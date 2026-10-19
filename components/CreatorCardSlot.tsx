"use client";
// components/CreatorCardSlot.tsx — يجلب card_fx للحساب ثم يعرض البطاقة محملة بـ next/dynamic
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { sanitizeCardFx, type CardFx } from "@/lib/cardFx";
import { sb } from "@/lib/supabase";
import type { CardProfile, CardPrompt } from "./CreatorCard";

const CreatorCard = dynamic(() => import("./CreatorCard"), { ssr: false });

type Props = {
  profileId: string;
  profile: CardProfile;
  /** نسخة مضغوطة للخلاصة ومعاينة البرومبت */
  compact?: boolean;
  /** قيمة card_fx مسبقة الجلب (من استعلام الموجز) لتخطّي استعلام إضافي */
  fxRaw?: unknown;
  className?: string;
};

/** يعرض بطاقة المبدع لزوّار الملف وفي الخلاصة والمعاينة — يُحمَّل ديناميكياً ويتوقف عند ضعف الحركة */
export default function CreatorCardSlot({ profileId, profile, compact = false, fxRaw, className = "" }: Props) {
  const [fx, setFx] = useState<CardFx | null>(() => (fxRaw === undefined ? null : sanitizeCardFx(fxRaw)));
  const [items, setItems] = useState<CardPrompt[]>([]);

  useEffect(() => {
    if (fxRaw !== undefined) return;
    let dead = false;
    sb.from("profiles").select("card_fx").eq("id", profileId).maybeSingle().then(async ({ data }) => {
      const clean = sanitizeCardFx((data as { card_fx: unknown } | null)?.card_fx);
      if (dead || !clean) return;
      setFx(clean);
      if (!compact && clean.prompts.length) {
        const { data: ps } = await sb.from("prompts").select("id,body,enhanced,title,images").in("id", clean.prompts);
        if (dead) return;
        const by = new Map((ps as { id: string; body: string; enhanced: string | null; title: string | null; images: { url: string }[] }[])
          .map((r) => [r.id, { id: r.id, title: r.title, text: r.enhanced ?? r.body, image: r.images?.[0]?.url ?? null } as CardPrompt]));
        setItems(clean.prompts.map((id) => by.get(id)).filter(Boolean) as CardPrompt[]);
      }
    });
    return () => { dead = true; };
  }, [profileId, compact]);

  if (!fx) return null;
  return <CreatorCard fx={fx} profile={profile} items={items} compact={compact} className={className} />;
}
