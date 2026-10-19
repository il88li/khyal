// components/ui/tokens.ts — مرآة TypeScript لرموز app/tokens.css.
// استخدمها حين تحتاج قيمة داخل JavaScript (رسوم SVG، حركة، قماش Canvas…)
// بدل كتابة اللون أو المدة نصّاً في المكوّن. المصدر المرجعي يبقى tokens.css.

/** الهوية الثابتة — لا تتغيّر بين الوضعين. */
export const BRAND = {
  red: "#CC1728",
  redDeep: "#A00E1E",
  redBright: "#E2424E",
  tintLight: "#FDE9EB",
  tintDark: "#3C161B",
  onRed: "#FFFFFF",
} as const;

/** الأساس الداكن. */
export const BASE = {
  dark: "#121212",
  light: "#F7F8FA",
  snow: "#FFFFFF",
} as const;

/**
 * مساعد ألوان: يحوّل قنوات `r g b` (كما في tokens.css) إلى نصّ CSS.
 * مثال: `rgbVar("204 23 40", 0.5)` → `rgb(204 23 40 / 0.5)`.
 */
export function rgbVar(channels: string, alpha?: number): string {
  return alpha === undefined ? `rgb(${channels})` : `rgb(${channels} / ${alpha})`;
}

/** سلّم الطباعة العربية (px). */
export const TYPE = {
  micro: 11,
  caption: 12,
  sm: 13,
  base: 15,
  lg: 17,
  xl: 20,
  "2xl": 24,
  "3xl": 32,
} as const;

/** المسافات (مضاعفات 4). */
export const SPACE = {
  1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 8: 32, 10: 40, 12: 48, 16: 64,
} as const;

/** الأشكال. */
export const RADIUS = {
  xs: 6, sm: 8, md: 12, lg: 16, xl: 20, "2xl": 24, "3xl": 28,
  button: 9999, input: 14, card: 20, sheet: 24, media: 16,
} as const;

/** الظلال — للارتفاع فقط، محايدة بلا ألوان. */
export const ELEVATION = {
  0: "none",
  1: "0 1px 2px rgb(16 20 30 / .05)",
  2: "0 4px 14px -6px rgb(16 20 30 / .10)",
  3: "0 16px 40px -16px rgb(16 20 30 / .20)",
} as const;

/** الأيقونات: شبكة 24px وسماكة خطية 1.5px. */
export const ICON = {
  grid: 24,
  stroke: 1.5,
  sizes: { sm: 16, md: 20, lg: 24, xl: 32 },
} as const;

/** حالات فرشاة الشعار المصغّرة. */
export type LogoState = "welcome" | "loading" | "empty" | "success" | "error";
export const LOGO_STATES: readonly LogoState[] = ["welcome", "loading", "empty", "success", "error"];
