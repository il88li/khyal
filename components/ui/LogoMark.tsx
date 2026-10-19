"use client";
// components/ui/LogoMark.tsx — فرشاة شعار خيال المصغّرة بحالاتها الوظيفية.
// الحالات: welcome · loading · empty · success · error
// الحركة وظيفية فقط: دخول هادئ، تنفّس أثناء التحميل، نبضة نجاح، رجّة خطأ.
// بلا توهّج وبلا نيون، وتحترم «تخفيف الحركة».
import { motion } from "framer-motion";
import { AlertTriangle, Check } from "../icons";
import { DURATION, EASE, SPRING, useReducedMotion } from "./motion";
import type { LogoState } from "./tokens";

const SRC = "/icons/khiyal-mark-192-v5.png";

export type LogoMarkProps = {
  /** الحالة الوظيفية التي تعبّر عنها الفرشاة. */
  state?: LogoState;
  /** الضلع بالمحور (px). */
  size?: number;
  className?: string;
  /** بديل نصّي؛ الافتراضي يوصف الحالة لقارئ الشاشة. */
  label?: string;
  /** علامة زخرفية بحتة (تُخفى عن قارئ الشاشة). */
  decorative?: boolean;
};

const ARIA: Record<LogoState, string> = {
  welcome: "شعار خيال",
  loading: "جارٍ التحميل",
  empty: "لا يوجد محتوى",
  success: "تم بنجاح",
  error: "حدث خطأ",
};

export function LogoMark({ state = "welcome", size = 48, className, label, decorative }: LogoMarkProps) {
  const reduced = useReducedMotion();
  const box = { width: size, height: size };

  const animate = (() => {
    if (reduced) return { opacity: 1, scale: 1, x: 0 };
    switch (state) {
      case "loading":
        return { opacity: [1, 0.55, 1], scale: [1, 0.97, 1] };
      case "success":
        return { scale: [1, 1.09, 1] };
      case "error":
        return { x: [0, -4, 4, -3, 3, 0] };
      default:
        return { opacity: 1, scale: 1, x: 0 };
    }
  })();

  const transition = reduced
    ? { duration: 0 }
    : state === "loading"
      ? { duration: 1.6, ease: EASE.standard, repeat: Infinity }
      : state === "success" || state === "error"
        ? { duration: DURATION.slow, ease: EASE.standard }
        : SPRING.gentle;

  const badge =
    state === "success" ? (
      <Check size={Math.max(12, Math.round(size * 0.3))} strokeWidth={2.5} aria-hidden />
    ) : state === "error" ? (
      <AlertTriangle size={Math.max(12, Math.round(size * 0.3))} strokeWidth={2.5} aria-hidden />
    ) : null;

  const badgeTone = state === "success" ? "rgb(var(--ok))" : "rgb(var(--danger))";

  return (
    <span
      className={`logo-brush relative inline-grid ${className ?? ""}`}
      data-state={state}
      style={box}
      role={decorative ? "presentation" : "img"}
      aria-label={decorative ? undefined : (label ?? ARIA[state])}
      aria-hidden={decorative || undefined}
    >
      <motion.img
        src={SRC}
        alt=""
        width={size}
        height={size}
        draggable={false}
        initial={reduced || state === "empty" || state === "loading" ? false : { opacity: 0, scale: 0.9 }}
        animate={animate}
        transition={transition}
        style={{
          width: size,
          height: size,
          objectFit: "contain",
          // empty: مطفأة رمادية — دلالة وظيفية على غياب المحتوى، لا زخرفة
          filter: state === "empty" ? "grayscale(1)" : undefined,
          opacity: state === "empty" ? 0.5 : 1,
        }}
      />
      {badge && (
        <span
          className="absolute -bottom-0.5 -left-0.5 grid place-items-center rounded-full"
          style={{
            width: Math.max(16, Math.round(size * 0.42)),
            height: Math.max(16, Math.round(size * 0.42)),
            background: "rgb(var(--c-snow))",
            color: badgeTone,
          }}
        >
          {badge}
        </span>
      )}
    </span>
  );
}

/** اسم بديل مقروء. */
export const LogoBrush = LogoMark;

export default LogoMark;
