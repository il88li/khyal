// lib/algorithm.ts — خوارزمية التوزيع/التسويق للمنشئين + مقياس جاهزية النشر
// شفّافة بالكامل: كل قرار له سبب مكتوب، ليعلّم المنشئ كيف يرفع وصول برومبته.
import type { PromptRow } from "@/types";

const HOUR = 3_600_000;
const clamp = (x: number, a = 0, b = 1) => Math.max(a, Math.min(b, x));

export type Signals = {
  velocity: number;   // سرعة التفاعل (تفاعل مرجّح لكل ساعة)
  freshness: number;  // جِدة المحتوى (تلاشٍ تدريجي)
  quality: number;    // اكتمال المحتوى (عنوان/وسوم/طول/صورة)
  engagement: number; // وزن تفاعل خام
  affinity: number;   // قربٌ من اهتمامات المتصفّح
  boost: number;      // مصداقية/شارة المنشئ
};
export type Score = { total: number; s: Signals; reasons: string[] };

/** يقيّم برومبتاً من 0..100 لترتيب الخلاصة. الأوزان: السرعة 40٪، الجِدة 20٪، الجودة 20٪، الاهتمام 12٪، المصداقية 8٪ */
export function scoreOf(p: PromptRow, opts?: { interests?: number[]; now?: number }): Score {
  const now = opts?.now ?? Date.now();
  const ageH = Math.max(0.5, (now - new Date(p.created_at).getTime()) / HOUR);
  const likes = p.like_count ?? 0, comments = p.comment_count ?? 0, copies = p.copy_count ?? 0, forks = p.fork_count ?? 0;
  // وزّع التفاعل: التعليقات والنسخ/التفريع أثقل من الإعجاب (نية أعلى من مجرّد الإعجاب)
  const engagement = likes + comments * 2.5 + copies * 2 + forks * 3;
  // سرعة موزونة بالزمن: التفاعل لكل ساعة مُخفّض بجذر الزمن كي لا يُعاقَب الناجح المتراكم
  const velocity = engagement / Math.pow(ageH + 2, 0.6);
  const freshness = Math.exp(-ageH / 72); // تلاشٍ خلال ~3 أيام
  const text = (p.enhanced || p.body || "").trim();
  const quality = clamp(
    (text.length >= 140 ? 0.35 : text.length >= 80 ? 0.22 : text.length >= 40 ? 0.12 : 0.04) +
    (p.title ? 0.2 : 0) +
    ((p.tags?.length ?? 0) >= 2 ? 0.2 : (p.tags?.length ?? 0) === 1 ? 0.1 : 0) +
    ((p.images?.length ?? 0) > 0 ? 0.25 : 0),
  );
  const affinity = opts?.interests?.length && p.category_id != null ? (opts.interests.includes(p.category_id) ? 1 : 0) : 0;
  const boost = p.author?.verified ? 1 : 0;
  const total = clamp(0.4 * clamp(velocity / 40) + 0.2 * freshness + 0.2 * quality + 0.12 * affinity + 0.08 * boost) * 100;

  const reasons: string[] = [];
  if (velocity >= 8) reasons.push("تفاعل سريع");
  if (freshness >= 0.5) reasons.push("حديث");
  if (quality >= 0.75) reasons.push("محتوى مكتمل");
  if (affinity) reasons.push("يناسب اهتماماتك");
  if (boost) reasons.push("منشئ موثّق");
  return { total: Math.round(total * 10) / 10, s: { velocity, freshness, quality, engagement, affinity, boost }, reasons };
}

/** يرتّب قائمة (صفحة) حسب خوارزمية التوزيع — يُستخدم في خلاصتَي «مختار لك» و«رائج» */
export function rankForYou(rows: PromptRow[], interests: number[] = []): PromptRow[] {
  const now = Date.now();
  return rows
    .map((r) => ({ r, s: scoreOf(r, { interests, now }).total }))
    .sort((a, b) => b.s - a.s)
    .map((x) => x.r);
}

export const scoreLabel = (n: number) => (n >= 75 ? "وصول مرتفع" : n >= 50 ? "وصول جيد" : n >= 30 ? "وصول متوسط" : "وصول منخفض");

export type ReadyCheck = { key: string; label: string; hint: string; ok: boolean; points: number };
export type Readiness = { total: number; label: string; tone: string; checks: ReadyCheck[] };

const GOAL_RE = /(اكتب|لخّص|صمّم|صمم|حوّل|حول|اشرح|ولّد|ولد|ترجم|حلّل|حلل|اقترح|ابنِ|ابن|أنشئ|انشئ|قائمة|خطة|بالعربية|بأسلوب|اسلوب)/;

/** مقياس جاهزية النشر (0..100) لمسودة في صفحة «برومبت جديد» — يركز على ما يتحكّم به المنشئ يدوياً */
export function publishReadiness(draft: { text: string; images: number }): Readiness {
  const text = (draft.text ?? "").trim();
  const lines = text.split(/\n+/).filter((l) => l.trim()).length;
  const hasVars = /\[[^\]\n]{1,30}\]/.test(text);
  const checks: ReadyCheck[] = [
    { key: "len", label: "وصف كافٍ (120 حرفاً+)", hint: "البرومبتات الأوضح تحصل على تفاعل أعلى", ok: text.length >= 120, points: text.length >= 120 ? 30 : text.length >= 60 ? 16 : text.length >= 20 ? 6 : 0 },
    { key: "struct", label: "بنية واضحة", hint: "قسّم التعليمات إلى أسطر أو استخدم [متغيّرات]", ok: lines >= 2 || hasVars, points: lines >= 2 || hasVars ? 25 : 6 },
    { key: "goal", label: "هدف محدّد", hint: "ابدأ بفعل واضح: اكتب/لخّص/صمّم/حوّل…", ok: GOAL_RE.test(text), points: GOAL_RE.test(text) ? 20 : 5 },
    { key: "media", label: "صورة توضيحية", hint: "الصور تزيد الظهور والنقرات", ok: draft.images > 0, points: draft.images > 0 ? 25 : 10 },
  ];
  const total = Math.min(100, checks.reduce((a, c) => a + c.points, 0));
  const label = total >= 85 ? "جاهز للتميّز" : total >= 65 ? "جاهز للنشر" : total >= 40 ? "مقبول" : "بحاجة لتحسين";
  const tone = total >= 85 ? "text-ok-ink" : total >= 65 ? "text-brand-ink" : total >= 40 ? "text-gold-ink" : "text-danger";
  return { total, label, tone, checks };
}
