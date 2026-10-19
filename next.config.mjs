/** @type {import('next').NextConfig} */

// رؤوس الأمان — مُطبّقة على كل الصفحات
const SECURITY_HEADERS = [
  // منع تضمين الموقع في iframe (Clickjacking)
  { key: "X-Frame-Options", value: "DENY" },
  // منع تخمين نوع الملف (MIME sniffing)
  { key: "X-Content-Type-Options", value: "nosniff" },
  // سياسة المُحيل — لا تُسرّب روابط داخلية
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // تقييد الميزات الحساسة افتراضيًا
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), magnetometer=(), gyroscope=()",
  },
  // فرض HTTPS لمدة سنتين
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  // منع تشغيل Adobe Flash/PDF من نفس الأصل
  { key: "X-Permitted-Cross-Domain-Policies", value: "none" },
  // سياسة DNS المسبقة
  { key: "X-DNS-Prefetch-Control", value: "on" },
];

// CSP مبسّط — يسمح بـ Supabase + Firebase + OpenRouter فقط
const CSP = [
  "default-src 'self'",
  // Supabase + Firebase + Vercel Analytics
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.googleapis.com https://*.firebaseio.com https://openrouter.ai https://vitals.vercel-insights.com",
  // الصور من Supabase Storage + Firebase
  "img-src 'self' data: blob: https://*.supabase.co https://*.googleapis.com https://*.gstatic.com",
  // السكربتات: Next.js يحتاج unsafe-inline/unsafe-eval في التطوير
  // للإنتاج الكامل، انتقل إلى CSP مع nonce عبر middleware
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://apis.google.com https://*.firebaseapp.com",
  // الستايلات
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  // الخطوط
  "font-src 'self' data: https://fonts.gstatic.com",
  // منع التضمين في iframe
  "frame-ancestors 'none'",
  // خدمة العمال (Service Worker + FCM)
  "worker-src 'self' blob:",
  // منع تحويل النماذج لجهات خارجية
  "form-action 'self'",
  // قاعدة المسار الأساسي
  "base-uri 'self'",
].join("; ");

const nextConfig = {
  reactStrictMode: true,

  // pg يحتاج أن يبقى خارج حزمة Edge (يستخدم في التهيئة الذاتية)
  experimental: {
    serverComponentsExternalPackages: ["pg"],
    // tree-shaking أفضل للحزم ذات الملف الواحد — يقلّل حجم حزمة العميل
    optimizePackageImports: ["framer-motion"],
  },

  // ⚠️ حرج: فعّل ESLint في البناء — 10+ تعليقات `eslint-disable-line` يجب مراجعتها
  eslint: {
    ignoreDuringBuilds: false,
  },

  // تصدير أوامر TypeScript ضمن البناء
  typescript: {
    ignoreBuildErrors: false,
  },

  async headers() {
    return [
      // رؤوس الأمان على كل الصفحات
      {
        source: "/(.*)",
        headers: SECURITY_HEADERS,
      },
      // CSP كامل (بعد نجاح الاختبار على staging)
      {
        source: "/((?!api/).*)",
        headers: [{ key: "Content-Security-Policy", value: CSP }],
      },
      // Service Worker: لا كاش، صلاحية الجذر
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
        ],
      },
      // manifest
      {
        source: "/manifest.webmanifest",
        headers: [
          { key: "Content-Type", value: "application/manifest+json" },
          { key: "Cache-Control", value: "public, max-age=3600" },
        ],
      },
      // الأدمن: منع الفهرسة تماماً (مكرّر في middleware للأمان المزدوج)
      {
        source: "/admin/:path*",
        headers: [
          { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive, nosnippet" },
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "Cache-Control", value: "no-store, must-revalidate" },
        ],
      },
      // الصور المُصدَّرة من Storage: كاش طويل (الملفات ثابتة URL)
      {
        source: "/icons/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
    ];
  },

  // ضغط صور Next/Image (متاح لو استخدمت next/image لاحقاً)
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "*.supabase.co" },
      { protocol: "https", hostname: "*.googleapis.com" },
    ],
    formats: ["image/avif", "image/webp"],
  },

  // لا نُصدّر خرائط المصدر للإنتاج — أسرع وأصغر ولا تكشف الكود
  productionBrowserSourceMaps: false,

  // إخفاء رأس `X-Powered-By`
  poweredByHeader: false,

  // ضغط Brotli على Vercel (مفعّل افتراضياً، هذه إعادة تأكيد)
  compress: true,

  // إعادة التوجيه: توحيد الوجهات المكرّرة والحفاظ على المسارات القديمة
  async redirects() {
    return [
      // التغذية القديمة
      { source: "/feed", destination: "/", permanent: true },
      // تسجيل الدخول: وجهة واحدة فقط (/auth) — /login كان نسخة مكرّرة
      { source: "/login", destination: "/auth", permanent: false },
      { source: "/signin", destination: "/auth", permanent: false },
      { source: "/signup", destination: "/auth", permanent: false },
      // أسماء بديلة واضحة لوجهات التنقل الأساسية
      { source: "/explore", destination: "/search", permanent: true },
      { source: "/saved", destination: "/library", permanent: true },
      { source: "/account", destination: "/settings", permanent: true },
      { source: "/me", destination: "/profile/me", permanent: true },
    ];
  },
};

export default nextConfig;