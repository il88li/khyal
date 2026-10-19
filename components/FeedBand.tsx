"use client";
// components/FeedBand.tsx — شريط Bento تمهيدي في رأس الخلاصة:
// ترحيب ممتدّ + اهتماماتك + أنشئ. تجميع بالمسافة وكتلة ارتكاز واحدة (span-2).
import Link from "next/link";
import { useEffect, useState } from "react";
import { Plus, Sparkles } from "./icons";
import { CATEGORIES, readInterests } from "@/lib/taxonomy";

/** تحية بحسب ساعة الجهاز — تُحسب بعد التركيب تفادياً لاختلاف الخادم والعميل */
function greeting(h: number) {
  if (h < 5) return "سهرة هادئة";
  if (h < 12) return "صباح الخير";
  if (h < 17) return "مساء النور";
  return "مساء الخير";
}

export default function FeedBand({ note }: { note?: string }) {
  const [hi, setHi] = useState("أهلاً بك");
  const [names, setNames] = useState<string[]>([]);

  useEffect(() => {
    setHi(greeting(new Date().getHours()));
    const picked = readInterests();
    setNames(CATEGORIES.filter((c) => picked.includes(c.slug)).map((c) => c.name).slice(0, 4));
  }, []);

  return (
    <section className="bento feed-band" aria-label="لوحة خيال">
      <div className="card feed-band-hero span-2">
        <p className="feed-band-hi">{hi}</p>
        <p className="feed-band-note">
          {note || "برومبتات مختارة تناسب مجالاتك — تفاعلك يضبط الدقّة أكثر."}
        </p>
      </div>

      <Link href="/settings#interests" className="card feed-band-tile" aria-label="اهتماماتك">
        <Sparkles size={20} />
        <span className="feed-band-t">اهتماماتك</span>
        <span className="feed-band-s">{names.length ? names.join(" · ") : "اختر مجالاتك ليُخصَّص الفيد"}</span>
      </Link>

      <Link href="/new" className="card feed-band-tile" aria-label="أنشئ برومبت">
        <Plus size={20} />
        <span className="feed-band-t">أنشئ برومبت</span>
        <span className="feed-band-s">بعنوان وتصنيف تلقائيين</span>
      </Link>
    </section>
  );
}
