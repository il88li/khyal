"use client";
// components/PromptCover.tsx — غلاف البرومبت بلا صورة.
// طبقات ضوئية بألوان الهوية + شبكة رقيقة + كرة ضوء، تحاكي اتساع الخيال.
// موحّد بين: بطاقة الرئيسية (card) · شبكة الملف (tile) · نتائج الاستكشاف (band).
import { Sparkles } from "@/components/icons";

type Variant = "card" | "tile" | "band";

export function PromptCover({
  title,
  text,
  category,
  author,
  variant = "card",
}: {
  title?: string | null;
  text?: string | null;
  category?: string | null;
  author?: string | null;
  variant?: Variant;
}) {
  const lead = (text ?? "").replace(/\s+/g, " ").trim();
  return (
    <div className={`prompt-cover is-${variant}`}>
      <span className="prompt-cover-orb" aria-hidden="true" />
      <div className="prompt-cover-top">
        <span className="prompt-cover-badge">
          <Sparkles size={14} />
          {category || "خيال"}
        </span>
        {author && <span className="prompt-cover-author">{author}</span>}
      </div>
      {variant === "card" && title && <p className="prompt-cover-lead">{title}</p>}
      {variant === "tile" && !!lead && <p className="prompt-cover-lead">{lead}</p>}
    </div>
  );
}

export default PromptCover;
