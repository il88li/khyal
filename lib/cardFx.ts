"use client";
// lib/cardFx.ts — بطاقة المبدع المخصّصة: الأنواع، قائمة السماح للتحقق، وفحص إمكانية الحركة
// التأثيرات من React Bits (نسخ المصدر في components/fx) بلا توهج أو نيون.
import { useEffect, useState } from "react";

export const CARD_FX_MAX_PROMPTS = 3;

/** قوائم السماح — لا يُقبل أي تأثير خارجها (تطابق على جهة العميل وفي قاعدة البيانات) */
export const FX_NAME = { none: "بدون", blur: "تمويه", decrypt: "تشفير", gradient: "تدرّج" } as const;
export const FX_STATS = { none: "بدون", count: "عدّ تصاعدي" } as const;
export const FX_BG = { none: "بدون", noise: "حبيبات", dots: "نقاط" } as const;
export const FX_CARDS = { none: "بدون", tilt: "بطاقة مائلة", pixel: "بكسل" } as const;

export type FxName = keyof typeof FX_NAME;
export type FxStats = keyof typeof FX_STATS;
export type FxBg = keyof typeof FX_BG;
export type FxCards = keyof typeof FX_CARDS;

export type CardFx = {
  v: 1;
  name: FxName;
  stats: FxStats;
  bg: FxBg;
  cards: FxCards;
  prompts: string[]; // معرّفات حتى 3 برومبتات
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const inList = <T extends string>(list: readonly string[], v: unknown, fallback: T): T =>
  (typeof v === "string" && (list as readonly string[]).includes(v) ? (v as T) : fallback);

/** تحقّق بقائمة السماح: يقبل القيمة الخام فقط إذا كانت كل حقولها ضمن القوائم، وإلا يرجّع الافتراضي */
export function sanitizeCardFx(raw: unknown): CardFx | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const fx: CardFx = {
    v: 1,
    name: inList<FxName>(Object.keys(FX_NAME), r.name, "none"),
    stats: inList<FxStats>(Object.keys(FX_STATS), r.stats, "none"),
    bg: inList<FxBg>(Object.keys(FX_BG), r.bg, "none"),
    cards: inList<FxCards>(Object.keys(FX_CARDS), r.cards, "none"),
    prompts: Array.isArray(r.prompts)
      ? Array.from(new Set(r.prompts.filter((x) => typeof x === "string" && UUID.test(x)) as string[])).slice(0, CARD_FX_MAX_PROMPTS)
      : [],
  };
  const empty = fx.name === "none" && fx.stats === "none" && fx.bg === "none" && fx.cards === "none" && !fx.prompts.length;
  return empty ? null : fx;
}

export const hasCardFx = (raw: unknown): boolean => sanitizeCardFx(raw) !== null;

/** قيم الألوان من design.md عبر متغيّرات CSS الحالية (فاتح/داكن) */
export function cssHex(name: string, fallback: string): string {
  if (typeof document === "undefined") return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const p = v.split(/\s+/).map(Number);
  if (p.length >= 3 && p.every((n) => Number.isFinite(n)))
    return "#" + p.slice(0, 3).map((n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0")).join("");
  return v || fallback;
}

/** الجهاز ضعيف؟ (أنوية قليلة أو ذاكرة قليلة أو اقتصاد بيانات) */
function weakDevice(): boolean {
  if (typeof navigator === "undefined") return true;
  const nav = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } };
  if (nav.connection?.saveData) return true;
  if ((nav.hardwareConcurrency ?? 8) <= 4) return true;
  if ((nav.deviceMemory ?? 8) <= 2) return true;
  return false;
}

/** هل تُسمح الحركات؟ يحترم تفضيل النظام وخيار «تخفيف الحركة» في الإعدادات و weakness الجهاز */
export function motionAllowed(): boolean {
  if (typeof window === "undefined") return false;
  try { if (localStorage.getItem("khiyal:reduce") === "1") return false; } catch { /* خاصية */ }
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return false;
  return !weakDevice();
}

/** حالة الحركة مع الاستماع لتغيير «تخفيف الحركة» وتفضيل النظام */
export function useMotionFx(): boolean {
  const [on, setOn] = useState(motionAllowed);
  useEffect(() => {
    const check = () => setOn(motionAllowed());
    check();
    window.addEventListener("khiyal:reduce", check);
    const mq = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    mq?.addEventListener?.("change", check);
    return () => {
      window.removeEventListener("khiyal:reduce", check);
      mq?.removeEventListener?.("change", check);
    };
  }, []);
  return on;
}

/** بطاقة المبدع كما تُخزَّن في profiles.card_fx (jsonb) */
export const DEFAULT_CARD_FX: CardFx = { v: 1, name: "none", stats: "none", bg: "none", cards: "none", prompts: [] };
