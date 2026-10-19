// components/ui — مكتبة خيال الموحّدة.
// نقطة استيراد واحدة لكل عناصر نظام التصميم:
//   · الرموز       → ./tokens
//   · الحركة       → ./motion
//   · فرشاة الشعار → ./LogoMark
//   · الحالات      → ../states
//   · التراكبات    → ./overlays
//   · المكوّنات القابلة للتركيب (Button · Card · Field · Tabs…) → ../kit
// راجع components/ui/README.md للتوثيق الكامل.

/* ── الرموز ── */
export { BRAND, BASE, rgbVar, TYPE, SPACE, RADIUS, ELEVATION, ICON, LOGO_STATES } from "./tokens";
export type { LogoState } from "./tokens";

/* ── الحركة ── */
export {
  DURATION, EASE, SPRING, TRANSITION,
  fadeIn, fadeUp, popIn, screen,
  prefersReduced, useReducedMotion, motionTransition,
  HAPTIC, hapticsEnabled, haptic, useHaptic,
  soundsEnabled, playSound, useFeedback,
} from "./motion";
export type { SoundKind } from "./motion";

/* ── فرشاة الشعار المصغّرة ── */
export { LogoMark, LogoBrush } from "./LogoMark";
export type { LogoMarkProps } from "./LogoMark";

/* ── الحالات الموحّدة ── */
export { SafeImg, Skeleton, EmptyState, ErrorState } from "../states";

/* ── التراكبات والنوافذ ── */
export {
  BottomSheet, Modal, Toaster, CopyButton, Lightbox, Gallery, Comments, Splash, VarsSheet,
} from "./overlays";
