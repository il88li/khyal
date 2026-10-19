// lib/access.ts — طبقة صلاحيات العرض
// guest = زائر، free = مسجّل مجاني، pro = مشترك. المالك يرى كل شيء.
// القاعدة المتفق عليها: المعاينة المقتطعة مجرّد «غلاف» تشويقي، وزر «عرض البرومبت كاملاً»
// (في البطاقة ومعاينة الصورة وصفحة البرومبت) يكشف النص الكامل للجميع بلا استثناء.
export type Tier = "guest" | "free" | "pro";

/** نسبة المعاينة المقتطعة لكل مستوى — سخيّة عمداً حتى تبدو الفكرة كاملة تقريباً. عدّلها هنا فقط. */
export const VISIBLE_RATIO: Record<Tier, number> = { guest: 0.5, free: 0.8, pro: 1 };
/** حدّ أدنى لما يظهر حتى لا تصبح المعاينة بلا معنى */
const MIN_CHARS = 60;
const OFF = process.env.NEXT_PUBLIC_PAYWALL_OFF === "1";

export type Preview = { shown: string; locked: boolean; hidden: number };

export function previewOf(text: string, tier: Tier, owner = false): Preview {
  if (OFF || owner || tier === "pro" || !text) return { shown: text, locked: false, hidden: 0 };
  let cut = Math.max(MIN_CHARS, Math.floor(text.length * VISIBLE_RATIO[tier]));
  if (cut >= text.length) cut = Math.floor(text.length * VISIBLE_RATIO[tier]);
  const sp = text.lastIndexOf(" ", cut);
  if (sp > cut * 0.6) cut = sp; // قصّ عند حدّ كلمة
  const shown = text.slice(0, cut).trimEnd();
  return { shown, locked: shown.length < text.length, hidden: text.length - shown.length };
}
