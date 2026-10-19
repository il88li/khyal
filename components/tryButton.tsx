"use client";
// components/tryButton.tsx — زر «جرّب» في صفحة البرومبت: يعبّئ المتغيرات إن وُجدت، وإلا ينقل للمحسّن
import { useState } from "react";
import Link from "next/link";
import { Braces, Sparkles } from "@/components/icons";
import { extractVars } from "@/lib/supabase";
import { VarsSheet } from "./ui";

export function TryButton({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const vars = extractVars(text);
  if (!vars.length) return <Link href={`/enhance?text=${encodeURIComponent(text)}`} className="btn btn-primary !min-h-9 flex-1"><Sparkles size={19} />جرّب الآن</Link>;
  return (
    <>
      <button onClick={() => setOpen(true)} className="btn btn-primary !min-h-9 flex-1"><Braces size={19} />عبّئ المتغيرات وجرّب</button>
      <VarsSheet text={text} open={open} onClose={() => setOpen(false)} />
    </>
  );
}
