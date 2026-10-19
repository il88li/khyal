// app/advertise/page.tsx — صفحة الإعلان لدى خيال
import Link from "next/link";

const EMAIL = process.env.NEXT_PUBLIC_ADS_EMAIL ?? "ads@khiyal.app";
const POINTS: [string, string][] = [
  ["جمهور عربي مهتم", "صنّاع محتوى ومسوّقون ومطوّرون يبحثون عن أفكار وبرومبتات كل يوم."],
  ["مساحات واضحة", "بطاقات إعلانية بصور وعنوان ونص ورابط، مميّزة بوسم «إعلان»."],
  ["بلا إزعاج", "لا نوافذ منبثقة ولا تتبّع؛ الإعلان يظهر في مكانه المخصّص فقط."],
];

export const metadata = { title: "أعلن لدى خيال" };

export default function Advertise() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-col gap-4 pt-4">
      <h1 className="text-2xl font-bold text-charcoal">أعلن لدى خيال</h1>
      <p className="text-base text-graphite">اعرض منتجك أو خدمتك أمام مجتمع يصنع الأفكار ويشاركها.</p>
      <ul className="flex flex-col gap-4">
        {POINTS.map(([t, d]) => <li key={t} className="card p-4"><p className="text-base font-semibold text-charcoal">{t}</p><p className="mt-1 text-sm text-graphite">{d}</p></li>)}
      </ul>
      <a href={`mailto:${EMAIL}?subject=${encodeURIComponent("إعلان لدى خيال")}`} className="btn btn-primary btn-lg self-start">راسلنا للإعلان</a>
      <Link href="/community" className="btn btn-transparent btn-md self-start">عودة إلى المجتمع</Link>
    </main>
  );
}
