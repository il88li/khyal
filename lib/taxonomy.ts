// lib/taxonomy.ts — تصنيفات خيال (تطابق جدول categories في القاعدة: slug + name_ar).
// تُستخدم في اختيار الاهتمامات أثناء الإقلاع الأول، وفي بناء الفيد «مختار لك».
export type Category = { slug: string; name: string };

export const CATEGORIES: Category[] = [
  { slug: "writing", name: "كتابة" },
  { slug: "coding", name: "برمجة" },
  { slug: "design", name: "تصميم" },
  { slug: "marketing", name: "تسويق" },
  { slug: "education", name: "تعليم" },
  { slug: "translation", name: "ترجمة" },
  { slug: "images", name: "صور" },
  { slug: "video", name: "فيديو" },
  { slug: "audio", name: "صوت" },
  { slug: "business", name: "أعمال" },
  { slug: "creative", name: "إبداع" },
  { slug: "social", name: "محتوى سوشيال" },
  { slug: "shops", name: "متاجر ومبيعات" },
  { slug: "beginners", name: "للمبتدئين" },
];

export const CATEGORY_BY_SLUG = new Map(CATEGORIES.map((c) => [c.slug, c]));

/** مفتاح تخزين الاهتمامات المحلي — يعمل حتى قبل تهيئة عمود القاعدة. */
export const INTERESTS_KEY = "khiyal:interests";

export function readInterests(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = JSON.parse(localStorage.getItem(INTERESTS_KEY) || "[]");
    return Array.isArray(raw) ? raw.filter((s) => typeof s === "string") : [];
  } catch {
    return [];
  }
}

export function writeInterests(slugs: string[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(INTERESTS_KEY, JSON.stringify(slugs));
  } catch {}
}
