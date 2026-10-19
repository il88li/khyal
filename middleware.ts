// middleware.ts — حماية المسارات: غير المسجّل → /welcome (والوجهات العامة مفتوحة)
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// الوجهات المتاحة للزائر: الترحيب، الدخول، صفحة البرومبت العامة، والمحتوى التعريفي (خطط/قانوني)
const PUBLIC = ["/welcome", "/splash", "/.well-known", "/offline", "/auth", "/p/", "/manifest", "/icons", "/images", "/sw.js", "/robots", "/safety", "/pricing", "/privacy", "/terms"];
export async function middleware(req: NextRequest) {
  let res = NextResponse.next({ request: req });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  let user: { id: string } | null = null;
  const p = req.nextUrl.pathname;
  if (!url || !key) {
    // متغيّرات البيئة غير متاحة في هذه البيئة (مثل نشر تجريبي بلا env) — لا نُسقط الخدمة
    console.error(`[middleware] NEXT_PUBLIC_SUPABASE_URL / ANON_KEY missing — treating "${p}" as logged out`);
  } else {
    try {
      const sb = createServerClient(url, key, {
        cookies: {
          getAll: () => req.cookies.getAll(),
          setAll: (list: { name: string; value: string; options: CookieOptions }[]) => {
            list.forEach(({ name, value }) => req.cookies.set(name, value));
            res = NextResponse.next({ request: req });
            list.forEach(({ name, value, options }) => res.cookies.set(name, value, options));
          },
        },
      });
      const { data, error } = await sb.auth.getUser();
      if (error) console.error(`[middleware] getUser error for "${p}": ${error.name}`);
      user = data.user;
    } catch (e) {
      // فشل شبكتي/مصادقي مؤقت — لا نُحوّل الخدمة إلى 500
      console.error(`[middleware] auth check failed for "${p}":`, e instanceof Error ? e.message : String(e));
    }
  }
  // واجهة الإدارة: مدخلها كلمة مرور الخادم فقط — لا رابط ولا إيماء داخل التطبيق، ولا فهرسة في محركات البحث
  if (p.startsWith("/admin")) {
    res.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
    res.headers.set("Referrer-Policy", "no-referrer");
    res.headers.set("Cache-Control", "no-store");
  }
  const isPublic = PUBLIC.some((x) => p.startsWith(x));
  if (!user && !isPublic) return NextResponse.redirect(new URL("/welcome", req.url));
  if (user && (p === "/auth" || p === "/welcome")) return NextResponse.redirect(new URL("/", req.url));
  return res;
}
export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico|api/).*)"] };
