// app/privacy/page.tsx — سياسة الخصوصية: ما نجمعه، ولماذا، وحقوقك
import Link from "next/link";
import type { Metadata } from "next";
import { ShieldCheck } from "@/components/icons";

export const metadata: Metadata = {
  title: "سياسة الخصوصية",
  description: "كيف يجمع خيال بياناتك ويستخدمها ويحميها، وما حقوقك في الوصول إليها وحذفها.",
};

const SECTIONS = [
  { t: "ما نجمعه", d: "بيانات الحساب (البريد، الاسم المعروض، الصورة)، والمحتوى الذي تنشره (البرومبتات والصور والتعليقات)، وتفاعلاتك (الإعجاب والحفظ والمتابعة)، وبيانات تقنية أساسية لتشغيل الخدمة." },
  { t: "كيف نستخدمه", d: "لتشغيل المنصة: عرض المحتوى، وتحسين البرومبتات، والإشعارات، ومنع إساءة الاستخدام. لا نبيع بياناتك الشخصية لأي طرف ثالث." },
  { t: "الإعلانات", d: "نعرض مساحات إعلانية مميّزة بوسم «إعلان». قد نقيس الظهور والنقر بشكل مجمّع لتحسين الخدمة دون ربطها بهويتك الشخصية." },
  { t: "المشاركة", d: "محتواك العام (البرومبتات المنشورة) يراه الجميع. الحساب الخاص يقيّد الرؤية لمتابعيك. أنت تتحكم بذلك من الإعدادات." },
  { t: "الاحتفاظ والحذف", d: "يمكنك تنزيل بياناتك أو حذف حسابك نهائياً من الإعدادات، فيُحذف محتواك وملفاتك المرتبطة به." },
  { t: "حقوقك", d: "لك حق الوصول إلى بياناتك وتصحيحها وحذفها. لأي طلب تواصل معنا عبر الدعم." },
] as const;

export default function Privacy() {
  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-5 pt-6 pb-8">
      <header className="flex flex-col gap-4">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-tint text-brand-ink"><ShieldCheck size={26} /></span>
        <h1 className="text-2xl font-bold text-charcoal">سياسة الخصوصية</h1>
        <p className="text-base text-graphite">خصوصيتك في خيال ليست بنداً قانونياً فقط، بل سلوك نلتزم به. هذه الصفحة تلخّص ذلك بوضوح.</p>
      </header>

      <section className="flex flex-col gap-4">
        {SECTIONS.map(({ t, d }) => (
          <article key={t} className="card p-4">
            <h2 className="mb-1 text-lg font-bold text-charcoal">{t}</h2>
            <p className="text-sm text-graphite">{d}</p>
          </article>
        ))}
      </section>

      <div className="flex flex-wrap gap-2">
        <Link href="/terms" className="btn">شروط الاستخدام</Link>
        <Link href="/settings" className="btn btn-primary">إدارة خصوصيتي</Link>
      </div>
    </main>
  );
}
