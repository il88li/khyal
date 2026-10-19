// app/layout.tsx — الجذر: RTL · خط عربي · فاتح/داكن · Luminous Minimalism
import "./globals.css";
import "./clean.css";
import "./tokens.css"; // آخر طبقة: الرموز المرجعية (ألوان/طباعة/مسافات/حركة)
import type { Metadata, Viewport } from "next";
import { IBM_Plex_Sans_Arabic, Tajawal } from "next/font/google";
import { Providers, PwaBoot, Shell } from "@/components/chrome";
import { Splash, Toaster } from "@/components/ui";

// يُنفَّذ قبل الرسم
const INIT = `
try {
  var t = localStorage.getItem("khiyal:theme");
  if (t === "dark" || ((!t || t === "sys") && matchMedia("(prefers-color-scheme: dark)").matches))
    document.documentElement.classList.add("dark");
  localStorage.removeItem("khiyal:accent");
  if (sessionStorage.getItem("khiyal:splash")) document.documentElement.setAttribute("data-nosplash", "1");
} catch (e) {}
`;

// الخط التصميمي المطلوب هو «زنجبيل» (Zanjabeel) — وهو خط تجاري مُرخّص وغير متاح للاستضافة
// الذاتية. لذلك نضع "Zanjabeel" في مقدمة سلسلة الخطوط (يُستخدم فوراً إن كان مثبّتاً أو
// مُضافاً محلياً)، ونحمّل «تجوال» كأقرب بديل مجاني بنفس الطابع الهندسي/النسخي.
// لإضافة زنجبيل المرخّص: أضف قاعدة @font-face باسم Zanjabeel في app/globals.css.
const tajawal = Tajawal({
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "700", "800"],
  variable: "--font-tajawal",
  display: "swap",
});

const plex = IBM_Plex_Sans_Arabic({
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-plex",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://khiyal-web.vercel.app"),
  title: "خيال",
  description: "مساحة عربية لصنّاع المحتوى لصياغة البرومبتات وتحسينها ومشاركتها.",
  manifest: "/manifest.webmanifest",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: "خيال",
    locale: "ar",
    title: "خيال — فكرة جيدة تستحق صياغة جيدة",
    description: "حسّن برومبتاتك بالعربية، شاركها، واحفظ ما يستحق العودة إليه.",
  },
  twitter: { card: "summary_large_image", title: "خيال", description: "مساحة عربية لصياغة البرومبتات وتحسينها." },
  icons: {
    icon: [{ url: "/favicon.ico", sizes: "any" }, { url: "/icons/khiyal-mark-192-v5.png", type: "image/png", sizes: "192x192" }],
    apple: "/icons/khiyal-apple-touch-v5.png",
  },
  appleWebApp: {
    capable: true,
    title: "خيال",
    statusBarStyle: "default",
    startupImage: [
      { url: "/splash/750x1334.png?v=luminous-6", media: "(device-width: 375px) and (device-height: 667px) and (-webkit-device-pixel-ratio: 2)" },
      { url: "/splash/1170x2532.png?v=luminous-6", media: "(device-width: 390px) and (device-height: 844px) and (-webkit-device-pixel-ratio: 3)" },
      { url: "/splash/1179x2556.png?v=luminous-6", media: "(device-width: 393px) and (device-height: 852px) and (-webkit-device-pixel-ratio: 3)" },
      { url: "/splash/1284x2778.png?v=luminous-6", media: "(device-width: 428px) and (device-height: 926px) and (-webkit-device-pixel-ratio: 3)" },
      { url: "/splash/1290x2796.png?v=luminous-6", media: "(device-width: 430px) and (device-height: 932px) and (-webkit-device-pixel-ratio: 3)" },
    ],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F7F8FA" },
    { media: "(prefers-color-scheme: dark)", color: "#121212" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl" className={`${tajawal.variable} ${plex.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: INIT }} />
      </head>
      <body className="min-h-dvh overflow-x-hidden font-sans text-base text-charcoal">
        <div className="aurora" aria-hidden />
        <Splash />
        <Providers>
          <Shell>{children}</Shell>
        </Providers>
        <PwaBoot />
        <Toaster />
      </body>
    </html>
  );
}
