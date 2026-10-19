"use client";
// app/welcome/page.tsx — الواجهة الترحيبية للجدد:
// رفّ شرائح مرن (elastic-reel) يعرض ما يمكن أن يصنعه الخيال، وعبارة تتبخّر (vapor-type)
// تُذكّر بأن كل شيء يبدأ بفكرة. لا نعرض تجربة تحسين البرومبت التفاعلية هنا — التسجيل هو الخطوة.
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowLeft, Check, Sparkles, WandSparkles } from "@/components/icons";
import { ElasticReel, type ReelItem } from "@/components/ui/elastic-reel";
import { VaporType } from "@/components/ui/vapor-type";

/** شرائح الخيال: صورتان حقيقيتان + شرائح ضوئية مولّدة بالكود (بلا ملفات إضافية). */
const REEL: ReelItem[] = [
  {
    src: "/images/khiyal-hero-luminous.webp",
    alt: "تكوين فني من طبقات ورقية يرمز إلى تطوّر الفكرة",
    title: "فكرة ← برومبت",
    subtitle: "نحوّل ما تفكر فيه إلى صياغة أوضح",
  },
  { tone: 1, title: "صورة", subtitle: "وصفٌ يُولّد الصورة التي في خيالك" },
  {
    src: "/images/khiyal-hero-cobalt.webp",
    alt: "تكوين فني بديل بطبقات ضوئية",
    title: "مشهد",
    subtitle: "اضبط الإضاءة والمزاج والتفاصيل",
  },
  { tone: 3, title: "قصة", subtitle: "اسردها في برومبتٍ متماسك" },
];

/** كلمات الخيال التي تتبخّر في العنوان */
const IMAGINATION = ["صورةً", "قصةً", "شعاراً", "مشهداً", "حلماً", "فكرةً"];

export default function Welcome() {
  return (
    <main className="welcome-page">
      <header className="welcome-nav">
        <Link href="/welcome" className="brand-lockup" aria-label="خيال — الرئيسية">
          <span className="brand-mark"><img src="/icons/khiyal-mark-192-v5.png" alt="" /></span>
          <span className="brand-word"><strong>خيال</strong><small>مساحة لصنّاع الأفكار</small></span>
        </Link>
        <nav className="welcome-nav-actions" aria-label="الحساب">
          <Link href="/auth" className="welcome-signin">لديّ حساب</Link>
          <Link href="/auth?mode=up" className="btn btn-primary !min-h-10 !px-4">ابدأ مجانًا<ArrowLeft size={16} /></Link>
        </nav>
      </header>

      <section className="welcome-hero-grid" aria-labelledby="welcome-heading">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45 }} className="welcome-copy">
          <span className="welcome-eyebrow"><Sparkles size={15} />منصة عربية لصياغة البرومبتات</span>
          <h1 id="welcome-heading" className="welcome-title">من فكرتك،<br /><span>إلى صياغة أوضح.</span></h1>
          <p className="welcome-vapor">
            <span className="welcome-vapor-label">خيالك يصنع</span>
            <VaporType words={IMAGINATION} className="welcome-vapor-word" />
          </p>
          <p className="welcome-lead">حسّن أفكارك، جرّبها، واحفظ البرومبتات التي تستحق أن تعود إليها. أنشئ حسابك المجاني وابدأ من أول فكرة.</p>
          <div className="welcome-hero-actions">
            <Link href="/auth?mode=up" className="btn btn-primary btn-lg"><WandSparkles size={18} />أنشئ حسابًا مجانيًا<ArrowLeft size={16} /></Link>
            <Link href="/auth" className="btn btn-lg">لديّ حساب</Link>
          </div>
          <div className="welcome-benefits">
            <span><Check size={15} />اكتب بالعربية</span>
            <span><Check size={15} />طوّر واحفظ</span>
            <span><Check size={15} />شارك المجتمع</span>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, scale: 0.985 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.55, delay: 0.08 }} className="welcome-reel">
          <ElasticReel items={REEL} />
          <div className="welcome-art-note">
            <span className="welcome-art-icon"><WandSparkles size={17} /></span>
            <span><strong>كل شيء يبدأ بفكرة</strong><small>خيال يساعدك على صياغتها</small></span>
          </div>
        </motion.div>
      </section>

      <footer className="welcome-footer">
        <span>خيال — فكرة جيدة تستحق صياغة جيدة.</span>
        <div>
          <Link href="/pricing">خطط خيال</Link>
          <Link href="/safety">الأمان والثقة</Link>
          <Link href="/privacy">الخصوصية</Link>
          <Link href="/terms">الشروط</Link>
        </div>
      </footer>
    </main>
  );
}
