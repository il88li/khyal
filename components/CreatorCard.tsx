"use client";
// components/CreatorCard.tsx — بطاقة المبدع بتأثيرات React Bits المطفية
// تُحمَّل بـ next/dynamic، وتُعطَّل الحركات عند تفضيل النظام أو «تخفيف الحركة» أو الجهاز الضعيف.
import dynamic from "next/dynamic";
import Link from "next/link";
import { useMemo } from "react";
import { CARD_FX_MAX_PROMPTS, cssHex, useMotionFx, type CardFx } from "@/lib/cardFx";

// React Bits — نسخ المصدر في components/fx (بلا توهج: glow/glare = 0)
const BlurText = dynamic(() => import("@/components/fx/BlurText"), { ssr: false });
const DecryptedText = dynamic(() => import("@/components/fx/DecryptedText"), { ssr: false });
const GradientText = dynamic(() => import("@/components/fx/GradientText"), { ssr: false });
const CountUp = dynamic(() => import("@/components/fx/CountUp"), { ssr: false });
const Noise = dynamic(() => import("@/components/fx/Noise"), { ssr: false });
const DotGrid = dynamic(() => import("@/components/fx/DotGrid"), { ssr: false });
const TiltedCard = dynamic(() => import("@/components/fx/TiltedCard"), { ssr: false });
const PixelCard = dynamic(() => import("@/components/fx/PixelCard"), { ssr: false });

export type CardPrompt = { id: string; title?: string | null; text: string; image?: string | null };
export type CardProfile = {
  name: string;
  username?: string | null;
  avatar_url?: string | null;
  cover_url?: string | null;
  prompts: number;
  likes: number;
  followers: number;
};

type Props = {
  fx: CardFx | null;
  profile: CardProfile;
  items?: CardPrompt[];
  /** نسخة مضغوطة للخلاصة ومعاينة البرومبت: الاسم والخلفية فقط */
  compact?: boolean;
  /** معاينة حية في الإعدادات */
  preview?: boolean;
  className?: string;
};

/** عنوان الاسم حسب التأثير المختار — بلا أي توهج */
function FxTitle({ fx, name, dark }: { fx: CardFx["name"]; name: string; dark: boolean }) {
  const cls = "text-xl font-bold tracking-tight";
  if (fx === "blur")
    return <BlurText text={name} animateBy="words" direction="bottom" effect="blur" delay={40} className={`${cls} text-charcoal`} />;
  if (fx === "decrypt")
    return <DecryptedText text={name} animateOn="view" sequential effect="scramble" speed={45} useOriginalCharsOnly className={`${cls} text-charcoal`} parentClassName="text-charcoal" />;
  if (fx === "gradient")
    return (
      <GradientText colors={[dark ? "#FF8A92" : "#A00E1E", dark ? "#D62836" : "#CC1728"]} animationSpeed={7} variant="linear" glow={0} className={cls}>
        {name}
      </GradientText>
    );
  return <h2 className={`${cls} text-charcoal`}>{name}</h2>;
}

/** قيمة إحصائية: عدّ تصاعدي أو رقم ثابت */
function FxStat({ fx, value, label }: { fx: CardFx["stats"]; value: number; label: string }) {
  return (
    <div className="flex min-w-0 flex-col items-center gap-0.5">
      <span className="text-lg font-bold tabular-nums text-charcoal">
        {fx === "count" ? <CountUp to={value} duration={1.6} trigger="view" /> : value}
      </span>
      <span className="text-caption text-smoke">{label}</span>
    </div>
  );
}

/** بلاطة برومبت صغيرة حسب التأثير المختار */
function FxPrompt({ fx, p, colors }: { fx: CardFx["cards"]; p: CardPrompt; colors: { brand: string; mist: string; ink: string } }) {
  const inner = (
    <div className="flex h-full w-full flex-col justify-between gap-1 overflow-hidden p-4 text-start">
      <span className="line-clamp-2 text-sm font-semibold text-charcoal">{p.title || p.text.slice(0, 60)}</span>
      <span className="line-clamp-2 text-caption text-smoke">{p.text.slice(0, 90)}</span>
    </div>
  );
  const body = (
    <div className="card relative h-full w-full overflow-hidden !rounded-2xl border border-silver bg-snow">
      {p.image && <img src={p.image} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover opacity-25" />}
      <div className="relative">{inner}</div>
    </div>
  );
  if (fx === "tilt")
    return (
      <TiltedCard
        containerHeight="100%" containerWidth="100%" imageHeight="100%" imageWidth="100%"
        rotateAmplitude={7} scaleOnHover={1.02} glare={0} shadow={0.08} parallax={0.12} axis="both" radius={16}
        className="h-full w-full"
      >
        {body}
      </TiltedCard>
    );
  if (fx === "pixel")
    return (
      <PixelCard
        colors={[colors.brand]} gap={6} speed={1.2} pixelSize={2} glow={0} opacity={0.5} fade={0.2}
        trigger="hover" theme="light" radius={16} className="h-full w-full"
      >
        {body}
      </PixelCard>
    );
  return body;
}

export default function CreatorCard({ fx, profile, items = [], compact = false, preview = false, className = "" }: Props) {
  const on = useMotionFx(); // يُعطَّل عند prefers-reduced-motion أو «تخفيف الحركة» أو الجهاز الضعيف
  const eff = fx ?? { v: 1 as const, name: "none" as const, stats: "none" as const, bg: "none" as const, cards: "none" as const, prompts: [] };
  const dark = typeof document !== "undefined" && document.documentElement.classList.contains("dark");
  const colors = useMemo(
    () => ({ brand: cssHex("--brand", "#CC1728"), mist: cssHex("--c-mist", "#EEF0F6"), ink: cssHex("--c-ink", "#12141C") }),
    [on, dark] // eslint-disable-line react-hooks/exhaustive-deps
  );
  const shown = items.slice(0, CARD_FX_MAX_PROMPTS);
  const active = on; // الحركات مسموحة فقط على الأجهزة القادرة وبلا تفضيل تخفيف الحركة

  return (
    <section
      aria-label={`بطاقة المبدع: ${profile.name}`}
      className={`relative isolate overflow-hidden rounded-3xl border border-silver bg-snow ${className}`}
    >
      {/* خلفية الملف: حبيبات أو نقاط — أثر مطفى وواضح */}
      {active && eff.bg === "noise" && <Noise opacity={0.05} size={1} fps={24} colored={false} dust={0.15} className="pointer-events-none absolute inset-0" />}
      {active && eff.bg === "dots" && (
        <div className="pointer-events-none absolute inset-0 opacity-60">
          <DotGrid dotSize={2.2} gap={16} baseColor={colors.mist} activeColor={colors.brand} glow={0} opacity={0.5} fade={0.35} mouseInteraction={false} clickShock={false} intro />
        </div>
      )}

      <div className="relative flex flex-col gap-4 p-6">
        {/* الرأس: صورة + اسم بتأثير + معرّف */}
        <div className="flex items-center gap-3">
          <span className="avatar h-14 w-14 shrink-0 border-2 border-snow bg-brand-tint text-xl text-brand-ink shadow-soft" data-i={profile.name.trim().slice(0, 1) || "؟"}>
            {profile.avatar_url && <img src={profile.avatar_url} alt="" loading="lazy" />}
          </span>
          <div className="min-w-0 flex-1">
            <FxTitle fx={active ? eff.name : "none"} name={profile.name} dark={dark} />
            {profile.username && <p dir="ltr" className="truncate text-start text-caption text-smoke">@{profile.username}</p>}
          </div>
        </div>

        {/* الإحصاءات */}
        {!compact && (
          <div className="grid grid-cols-3 gap-2" dir="rtl">
            <FxStat fx={active ? eff.stats : "none"} value={profile.prompts} label="برومبت" />
            <FxStat fx={active ? eff.stats : "none"} value={profile.likes} label="إعجاب" />
            <FxStat fx={active ? eff.stats : "none"} value={profile.followers} label="متابِع" />
          </div>
        )}

        {/* برومبتات مختارة (حتى 3) */}
        {!compact && !!shown.length && (
          <div className="grid gap-3 sm:grid-cols-3" dir="rtl">
            {shown.map((p) => (
              <Link key={p.id} href={`/p/${p.id}`} className="block h-[112px] transition-transform active:scale-[0.98]">
                <FxPrompt fx={active ? eff.cards : "none"} p={p} colors={colors} />
              </Link>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
