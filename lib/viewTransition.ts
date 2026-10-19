// lib/viewTransition.ts — الانتقال المشترك الآمن بين البطاقة ومعاينتها.
// يعتمد على View Transitions API الأصلية في المتصفح: بلا مكتبة إضافية، وبلا أي خطأ
// إن لم يكن مدعوماً أو إن كان المستخدم يفضّل تقليل الحركة — عندها يُنفَّذ التغيير فوراً.
import { flushSync } from "react-dom";

type Doc = Document & { startViewTransition?: (cb: () => void) => { finished: Promise<void> } };

/** اسم عنصر الوسائط المشترك لبرومبت بعينه — يوضع على وسائطه في البطاقة وفي المعاينة. */
export const mediaTransitionName = (id: string) => `khiyal-media-${id}`;

/**
 * ينفّذ تحديث الحالة داخل انتقال مشترك إن أمكن، وإلا فوراً.
 * `flushSync` ضروري لأن المتصفح يلتقط الحالة الجديدة بعد انتهاء دالة الانتقال.
 */
export function withViewTransition(update: () => void) {
  const d = typeof document === "undefined" ? null : (document as Doc);
  const reduce = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!d || reduce || typeof d.startViewTransition !== "function") {
    update();
    return;
  }
  try {
    d.startViewTransition(() => flushSync(update));
  } catch {
    update();
  }
}
