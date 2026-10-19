// app/auth/callback/route.ts — يستبدل code القادم من Google بجلسة
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") ?? "/setup";
  if (code) {
    const store = cookies();
    const sb = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      cookies: {
        getAll: () => store.getAll(),
        setAll: (list: { name: string; value: string; options: CookieOptions }[]) => list.forEach(({ name, value, options }) => store.set(name, value, options)),
      },
    });
    const { error } = await sb.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next.startsWith("/") ? next : "/", url.origin));
  }
  return NextResponse.redirect(new URL("/auth?error=oauth", url.origin));
}

/*
إعداد لازم (مرة واحدة):
1) Supabase → Authentication → Providers → Email: عطّل "Confirm email".
2) Providers → Google: فعّله وضع Client ID/Secret من Google Cloud
   (Authorized redirect URI: https://<PROJECT>.supabase.co/auth/v1/callback).
3) Authentication → URL Configuration: أضف https://khiyal-web.vercel.app/auth/callback و http://localhost:3000/auth/callback.
4) .env.local: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, OPENROUTER_API_KEY
5) npm i @supabase/ssr @supabase/supabase-js
*/
