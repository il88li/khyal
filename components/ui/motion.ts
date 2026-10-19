"use client";
// components/ui/motion.ts — فلسفة حركة خيال:
//   · الظهور: تباطؤ هادئ (ease-out/standard) بمدد قصيرة.
//   · اللمس: زنبرك ناعم يرتدّ قليلاً ثم يستقر.
//   · الانتقال بين الشاشات: تلاشٍ + إزاحة رأسية 4–8px فقط.
//   · تقليل الحركة: يحترم إعداد النظام وإعداد «تخفيف الحركة» في خيال.
//   · الاهتزاز والأصوات اختيارية ومطفأة افتراضياً (الأصوات).
// لا تأثيرات نيون أو توهّج، ولا حركة بلا وظيفة.
import { useCallback, useEffect, useState } from "react";
import type { Transition, Variants } from "framer-motion";

/* ── المدد (ثوانٍ، كما تتوقّعها framer-motion) ── */
export const DURATION = {
  instant: 0.08,
  fast: 0.15,
  base: 0.22,
  slow: 0.32,
  slower: 0.48,
} as const;

type Bezier = [number, number, number, number];

/* ── منحنيات التباطؤ ── */
export const EASE: Record<"standard" | "out" | "in" | "emphasis", Bezier> = {
  standard: [0.2, 0, 0, 1], // التباطؤ المعتمد: يبدأ سريعاً ويستقر بهدوء
  out: [0, 0, 0.2, 1],
  in: [0.4, 0, 1, 1],
  emphasis: [0.2, 0, 0, 1],
};

/* ── الزنبرك: للتفاعل المباشر (لمس/سحب/تحديد) لا للظهور ── */
export const SPRING: Record<"gentle" | "snappy" | "soft", Transition> = {
  gentle: { type: "spring", stiffness: 260, damping: 26, mass: 0.9 },
  snappy: { type: "spring", stiffness: 420, damping: 30, mass: 0.8 },
  soft: { type: "spring", stiffness: 180, damping: 24, mass: 1 },
};

export const TRANSITION = {
  enter: { duration: DURATION.base, ease: EASE.standard },
  exit: { duration: DURATION.fast, ease: EASE.in },
  spring: SPRING.gentle,
  snappy: SPRING.snappy,
} satisfies Record<string, Transition>;

/* ── نماذج جاهزة ── */
export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: DURATION.base, ease: EASE.standard } },
};

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: DURATION.base, ease: EASE.standard } },
};

export const popIn: Variants = {
  hidden: { opacity: 0, scale: 0.96 },
  show: { opacity: 1, scale: 1, transition: SPRING.gentle },
};

/** انتقال بين الشاشات: إزاحة رأسية 6px فقط + تلاشٍ. */
export const screen: Variants = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0, transition: { duration: DURATION.base, ease: EASE.standard } },
  exit: { opacity: 0, y: -4, transition: { duration: DURATION.fast, ease: EASE.in } },
};

/* ── تقليل الحركة: نظام + إعداد خيال ── */
export function prefersReduced(): boolean {
  if (typeof window === "undefined") return false;
  try {
    if (localStorage.getItem("khiyal:reduce") === "1") return true;
  } catch {}
  return typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** يرصد تغيّر النظام وحدث `khiyal:reduce` أثناء التشغيل. */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const read = () => setReduced(prefersReduced());
    read();
    const mq = typeof window.matchMedia === "function" ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;
    mq?.addEventListener?.("change", read);
    window.addEventListener("khiyal:reduce", read);
    return () => {
      mq?.removeEventListener?.("change", read);
      window.removeEventListener("khiyal:reduce", read);
    };
  }, []);
  return reduced;
}

/** يطفئ الحركة حين يُطلب تقليلها. */
export function motionTransition<T extends Transition>(t: T, reduced = prefersReduced()): T {
  return reduced ? ({ duration: 0 } as unknown as T) : t;
}

/* ── الاهتزاز: اختياري، يحترم إعداد «الاهتزاز عند التفاعل» ── */
export const HAPTIC = { light: 8, medium: 14, heavy: 22 } as const;

export function hapticsEnabled(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem("khiyal:haptics") !== "0";
  } catch {
    return true;
  }
}

export function haptic(ms: number | keyof typeof HAPTIC = HAPTIC.light, enabled = hapticsEnabled()): void {
  if (!enabled) return;
  try {
    navigator.vibrate?.(typeof ms === "string" ? HAPTIC[ms] : ms);
  } catch {}
}

/** يعيد دالة اهتزاز مرتبطة بالإعداد الحالي. */
export function useHaptic() {
  const [enabled, setEnabled] = useState(true);
  useEffect(() => {
    const read = () => setEnabled(hapticsEnabled());
    read();
    window.addEventListener("khiyal:haptics", read);
    return () => window.removeEventListener("khiyal:haptics", read);
  }, []);
  return useCallback((ms: number | keyof typeof HAPTIC = HAPTIC.light) => haptic(ms, enabled), [enabled]);
}

/* ── الأصوات: اختيارية ومطفأة افتراضياً، مُولَّدة بلا ملفات صوت ── */
export type SoundKind = "tap" | "toggle" | "success" | "error";

export function soundsEnabled(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem("khiyal:sound") === "1";
  } catch {
    return false;
  }
}

const TONES: Record<SoundKind, { freq: number; dur: number }> = {
  tap: { freq: 660, dur: 0.05 },
  toggle: { freq: 520, dur: 0.06 },
  success: { freq: 880, dur: 0.14 },
  error: { freq: 220, dur: 0.18 },
};

let ctx: AudioContext | null = null;

/** نغمة قصيرة مُولَّدة عند الحاجة. لا تعمل قبل تفاعل المستخدم (سياسة المتصفح). */
export function playSound(kind: SoundKind = "tap", enabled = soundsEnabled()): void {
  if (!enabled || typeof window === "undefined") return;
  try {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    ctx = ctx ?? new AC();
    if (ctx.state === "suspended") void ctx.resume();
    const { freq, dur } = TONES[kind];
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.06, ctx.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + dur + 0.02);
  } catch {}
}

/** يجمع الاهتزاز والنغمة في «تأكيد تفاعل» واحد اختياري. */
export function useFeedback() {
  const [sound, setSound] = useState(false);
  useEffect(() => {
    const read = () => setSound(soundsEnabled());
    read();
    window.addEventListener("khiyal:sound", read);
    return () => window.removeEventListener("khiyal:sound", read);
  }, []);
  return useCallback(
    (kind: SoundKind = "tap", ms: number | keyof typeof HAPTIC = HAPTIC.light) => {
      haptic(ms);
      playSound(kind, sound);
    },
    [sound],
  );
}
