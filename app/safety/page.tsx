// app/safety/page.tsx — الأمان والثقة: صفحة عامة تشرح كيف نحمي عملك وخصوصيتك وماذا تملك أنت
import Link from "next/link";
import { AlertTriangle, Copy, EyeOff, FileWarning, Lock, ShieldCheck, UserX } from "@/components/icons";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "الأمان والثقة",
  description: "ملكية عملك، المحتوى الآمن، خصوريتك، وأدواتك للإبلاغ والحظر — هكذا تحمي خيال عملك.",
};

const CARDS = [
  { icon: ShieldCheck, t: "عملك ملكك", d: "كل برومبت يبقى ملك صاحبه. اسم المؤلف ظاهر دائمًا، ونسبة الأصل معلنة مع كل تفريع، ومعدّل النسخ يرى الجميع." },
  { icon: Copy, t: "نسخ محسوب ومَنسب", d: "يُعدّ النسخ عبر أزرار المنصة فيرجع الفضل لصاحبه، وكل تفريع يحمل مصدره الأصلي. لا يُخفى صاحب العمل." },
  { icon: FileWarning, t: "محتوى آمن", d: "فلترة تلقائية للمحتوى الحساس قبل ظهوره، وبلاغ بضغطة من أي منشور. البلاغات تُراجَع يدويًا، وقد تؤدي إلى الحذف أو الحظر." },
  { icon: Lock, t: "خصوصيتك في يدك", d: "فعّل «حساب خاص» ليرى منشوراتك متابعوك فقط، نزّل بياناتك كاملة متى شئت، واحذف حسابك نهائيًا بضغطة واحدة — بلا استثناءات." },
  { icon: UserX, t: "سيطرتك على من ترى", d: "احظر أي حساب من ملفه، فتختفي منشوراتكما في الاتجاهين. قائمة المحظورين في أي وقت من الإعدادات." },
  { icon: AlertTriangle, t: "نتائج تحتاج مراجعة", d: "ما يولّده الذكاء الاصطناعي مقترح لا حقيقة. راجع الأرقام والتواريخ والادعاءات قبل نشرها أو الاعتماد عليها." },
] as const;

export default function Safety() {
  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-5 pt-6 pb-8">
      <header className="flex flex-col gap-4">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-tint text-brand-ink"><ShieldCheck size={26} /></span>
        <p className="max-w-[60ch] text-base text-graphite">الثقة ليست صفحة شروط: هي قواعد نعمل بها. هكذا نحمي عملك، وخصوصيتك، ومن تتفاعل معه.</p>
        <div className="flex flex-wrap gap-2">
          {["ملكية معلنة", "بلاغات مراجَعة", "بياناتك لك", "بلا محتوى حساس"].map((x) => <span key={x} className="rounded-full bg-brand-tint px-3 py-1 text-caption font-medium text-brand-ink">{x}</span>)}
        </div>
      </header>

      <section className="grid gap-4 sm:grid-cols-2">
        {CARDS.map(({ icon: Icon, t, d }) => (
          <article key={t} className="flex flex-col gap-2 card p-4 shadow-soft">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-tint text-brand-ink"><Icon size={21} /></span>
            <h2 className="text-lg font-bold text-charcoal">{t}</h2>
            <p className="text-sm text-graphite">{d}</p>
          </article>
        ))}
      </section>

      <section className="flex flex-col gap-4 rounded-xl border border-silver bg-fog p-4">
        <h2 className="flex items-center gap-2 text-lg font-bold"><FileWarning size={21} className="text-brand-ink" />لديك بلاغ؟</h2>
        <p className="text-sm text-graphite">من أي منشور: زر «المزيد» ← «الإبلاغ». تُراجع البلاغات وتُحذف المخالفات، وكرّر الإبلاغ يُعجّل المراجعة. للخصوصية والحظر وتنزيل بياناتك: الإعدادات.</p>
        <div className="flex flex-wrap gap-2">
          <Link href="/settings" className="btn btn-primary">الإعدادات والخصوصية</Link>
          <Link href="/" className="btn">العودة للتصفح</Link>
        </div>
      </section>

      <p className="text-caption text-smoke">هذه الصفحة تشرح الميزات القائمة في خيال حاليًا، وتُحدَّث مع كل ميزة جديدة.</p>
    </main>
  );
}
