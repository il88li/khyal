// tailwind.config.ts — نظام تصميم خيال: رموز tokens.css مُكبَّرة إلى صفوف Tailwind.
// الهوية أحمر #CC1728 على أساس #121212 في الداكن. لا نيون ولا توهّج.
import type { Config } from "tailwindcss";

export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    colors: {
      transparent: "transparent",
      black: "rgb(0 0 0 / <alpha-value>)",
      white: "rgb(255 255 255 / <alpha-value>)",
      "on-brand": "rgb(var(--on-brand) / <alpha-value>)",
      secondary: "rgb(var(--secondary) / <alpha-value>)",
      "secondary-tint": "rgb(var(--secondary-tint) / <alpha-value>)",
      current: "currentColor",
      snow: "rgb(var(--c-snow) / <alpha-value>)",
      fog: "rgb(var(--c-fog) / <alpha-value>)",
      mist: "rgb(var(--c-mist) / <alpha-value>)",
      silver: "rgb(var(--c-line) / <alpha-value>)",
      charcoal: "rgb(var(--c-ink) / <alpha-value>)",
      graphite: "rgb(var(--c-ink-2) / <alpha-value>)",
      smoke: "rgb(var(--c-ink-3) / <alpha-value>)",
      ash: "rgb(var(--c-ash) / <alpha-value>)",
      brand: "rgb(var(--brand) / <alpha-value>)",
      "brand-lo": "rgb(var(--brand-lo) / <alpha-value>)",
      "brand-hi": "rgb(var(--brand-hi) / <alpha-value>)",
      "brand-ink": "rgb(var(--brand-ink) / <alpha-value>)",
      "brand-tint": "rgb(var(--brand-tint) / <alpha-value>)",
      ok: "rgb(var(--ok) / <alpha-value>)",
      "ok-ink": "rgb(var(--ok-ink) / <alpha-value>)",
      "ok-tint": "rgb(var(--ok-tint) / <alpha-value>)",
      gold: "rgb(var(--gold) / <alpha-value>)",
      "gold-ink": "rgb(var(--gold-ink) / <alpha-value>)",
      "gold-tint": "rgb(var(--gold-tint) / <alpha-value>)",
      info: "rgb(var(--info) / <alpha-value>)",
      "info-ink": "rgb(var(--info-ink) / <alpha-value>)",
      "info-tint": "rgb(var(--info-tint) / <alpha-value>)",
      danger: "rgb(var(--danger) / <alpha-value>)",
      "danger-tint": "rgb(var(--danger-tint) / <alpha-value>)",
    },

    // ── سلّم الطباعة العربية: micro 11 · caption 12 · sm 13 · base 15 · lg 17 · xl 20 · 2xl 24 · 3xl 32 ──
    // أسطر أطول من اللاتينية لاستيعاب التشكيل والنقاط تحت الحروف.
    fontSize: {
      micro: ["11px", { lineHeight: "1.5" }],
      caption: ["12px", { lineHeight: "1.55" }],
      sm: ["13px", { lineHeight: "1.6" }],
      base: ["15px", { lineHeight: "1.7" }],
      lg: ["17px", { lineHeight: "1.65" }],
      xl: ["20px", { lineHeight: "1.5", letterSpacing: "-0.01em" }],
      "2xl": ["24px", { lineHeight: "1.4", letterSpacing: "-0.01em" }],
      "3xl": ["32px", { lineHeight: "1.25", letterSpacing: "-0.015em" }],
      // أسماء دلالية للعناوين
      label: ["12px", { lineHeight: "1.5", fontWeight: "600" }],
      h3: ["17px", { lineHeight: "1.5", fontWeight: "600" }],
      h2: ["20px", { lineHeight: "1.4", fontWeight: "700", letterSpacing: "-0.01em" }],
      h1: ["24px", { lineHeight: "1.35", fontWeight: "700", letterSpacing: "-0.01em" }],
      display: ["32px", { lineHeight: "1.25", fontWeight: "800", letterSpacing: "-0.015em" }],
    },

    // ── زوايا: زر حبّة · حقل 14 · بطاقة 20 · ورقة 24 ──
    borderRadius: {
      none: "0",
      xs: "6px",
      sm: "8px",
      DEFAULT: "var(--r)", // 12px
      md: "12px",
      lg: "16px",
      link: "16px",
      xl: "20px",
      "2xl": "24px",
      "3xl": "28px",
      full: "9999px",
    },

    // ── الظلال للارتفاع فقط: محايدة بلا ألوان ولا توهّج ──
    boxShadow: {
      none: "none",
      soft: "var(--elev-1)",
      card: "var(--elev-1)",
      lift: "var(--elev-2)",
      pop: "var(--elev-3)",
      "elev-1": "var(--elev-1)",
      "elev-2": "var(--elev-2)",
      "elev-3": "var(--elev-3)",
    },

    extend: {
      fontFamily: {
        sans: ["var(--font-sans)", "IBM Plex Sans Arabic", "system-ui", "sans-serif"],
      },
      // ── المسافات: مضاعفات 4 + أسماء دلالية للبطاقات والأقسام ──
      spacing: {
        card: "16px",
        "card-lg": "20px",
        "card-xl": "24px",
        section: "32px",
        gutter: "16px",
      },
      // ── الحركة: مدد قصيرة + تباطؤ/زنبرك ──
      transitionDuration: {
        instant: "80ms",
        fast: "150ms",
        DEFAULT: "220ms",
        base: "220ms",
        slow: "320ms",
        slower: "480ms",
      },
      transitionTimingFunction: {
        standard: "cubic-bezier(.2, 0, 0, 1)",
        out: "cubic-bezier(0, 0, .2, 1)",
        in: "cubic-bezier(.4, 0, 1, 1)",
        emphasis: "cubic-bezier(.2, 0, 0, 1)",
        "spring-gentle": "cubic-bezier(.34, 1.28, .46, 1)",
        "spring-snappy": "cubic-bezier(.2, 1.4, .32, 1)",
      },
      zIndex: {
        base: "0",
        sticky: "20",
        header: "50",
        overlay: "90",
        modal: "100",
        toast: "120",
        splash: "200",
      },
    },
  },
} satisfies Config;
