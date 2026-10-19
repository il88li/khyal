"use client";
// components/UpgradeNote.tsx — إشعار الجزء المقفول من البرومبت
import Link from "next/link";
import { Lock } from "@/components/icons";
import { toast } from "@/lib/supabase";
import type { Tier } from "@/lib/access";

export function UpgradeNote({ hidden, tier }: { hidden: number; tier: Tier }) {
  return (
    <div className="flex flex-col gap-4 rounded-xl bg-brand-tint p-4">
      <div className="flex items-center gap-2 text-brand-ink"><Lock size={24} /><p className="text-base font-semibold">باقي البرومبت مقفول</p></div>
      <p className="text-sm text-graphite">يظهر لك جزء منه فقط ({hidden} حرفاً مخفياً). يمكنك نسخه كاملاً، أما عرضه كاملاً فلمشتركي خيال.</p>
      {tier === "guest"
        ? <Link href="/auth?mode=up" className="btn btn-primary btn-md self-start">أنشئ حساباً لعرض المزيد</Link>
        : <button onClick={() => toast("الاشتراك المدفوع قريباً")} className="btn btn-primary btn-md self-start">أخبرني عند إطلاق الاشتراك</button>}
    </div>
  );
}
