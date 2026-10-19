"use client";
// components/GatedPrompt.tsx — نص البرومبت في صفحة البرومبت:
// غلاف مقتطع من جهة الخادم بحسب المستوى، مع إشعار قفل واحد مختصر. النسخ يبقى مسموحاً.
import { useAuth } from "./auth";
import { TryButton } from "./tryButton";
import { CopyButton } from "./ui";
import { previewOf } from "@/lib/access";
import Link from "next/link";
import { Lock } from "@/components/icons";

export function GatedPrompt({ text, ownerId, locked, hidden }: { text: string; ownerId?: string; locked?: boolean; hidden?: number }) {
  const { tier, me } = useAuth();
  const mine = !!ownerId && me?.id === ownerId; // صاحب البرومبت يرى نصه كاملاً دائماً
  // القيمة القادمة من الخادم (prompt_gated) مفروضة فعلياً؛ وإلا نحسب محلياً كاحتياطٍ
  const gate = typeof locked === "boolean" ? { shown: text, locked, hidden: hidden ?? 0 } : previewOf(text, tier, mine);

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <CopyButton text={text} />
        {!gate.locked && <TryButton text={text} />}
      </div>
      <p className="max-w-[65ch] whitespace-pre-wrap rounded-xl bg-mist p-4 text-base leading-relaxed">
        {gate.shown}
        {gate.locked && "…"}
      </p>
      {gate.locked && (
        <p className="flex items-center gap-2 self-start rounded-xl bg-brand-tint px-3.5 py-2 text-caption font-medium text-brand-ink">
          <Lock size={15} />
          باقي البرومبت لمشتركي خيال.
          <Link href="/pricing" className="font-semibold underline underline-offset-2">اعرف المزيد</Link>
        </p>
      )}
    </>
  );
}
