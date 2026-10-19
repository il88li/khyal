// app/terms/page.tsx — شروط الاستخدام: قواعد بسيطة وعادلة للمشاركة في خيال
import Link from "next/link";
import type { Metadata } from "next";
import { FileWarning } from "@/components/icons";

export const metadata: Metadata = {
  title: "شروط الاستخدام",
  description: "قواعد استخدام منصة خيال: ملكية المحتوى، السلوك المقبول، وحدود المسؤولية.",
};

const SECTIONS = [
  { t: "ملكية المحتوى", d: "تحتفظ بملكية البرومبتات التي تنشرها، وبنشرك تمنح خيال ترخيصاً لعرضها ومشاركتها داخل المنصة. كل تفريع يحمل نسبة أصله." },
  { t: "السلوك المقبول", d: "يُمنع نشر المحتوى المسيء أو المنتهك للحقوق أو المضلّل أو الدعائي بلا وسم. البلاغات تُراجَع، والمخالفات قد تُحذف أو تُفضي إلى الحظر." },
  { t: "الحساب", d: "أنت مسؤول عن سرّية بيانات دخولك وعن الأنشطة التي تجري عبر حسابك. أخبرنا فوراً عند أي استخدام غير مصرّح به." },
  { t: "الخدمة أثناء التغيير", d: "قد نطوّر الميزات أو نوقف بعضها. نبذل وسعنا للإبقاء على المحتوى متاحاً وإشعارك بالتغييرات الجوهرية." },
  { t: "حدود المسؤولية", d: "نتائج الذكاء الاصطناعي مقترحات لا حقائق. خيال غير مسؤول عن قرارات تتخذها بناءً على مخرجاتها؛ راجعها قبل الاعتماد عليها." },
  { t: "الإعلانات والاشتراك", d: "قد نعرض إعلانات موسومة، ونوفّر خططاً مدفوعة تمنح مزايا إضافية. تفاصيل أي خطة تُعرض بوضوح قبل الاشتراك." },
] as const;

export default function Terms() {
  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-5 pt-6 pb-8">
      <header className="flex flex-col gap-4">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-tint text-brand-ink"><FileWarning size={26} /></span>
        <h1 className="text-2xl font-bold text-charcoal">شروط الاستخدام</h1>
        <p className="text-base text-graphite">قواعد بسيطة وعادلة تحمي عملك وعمل الآخرين، وتجعل خيال مساحة آمنة للإبداع.</p>
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
        <Link href="/privacy" className="btn">سياسة الخصوصية</Link>
        <Link href="/safety" className="btn">الأمان والثقة</Link>
      </div>
    </main>
  );
}
