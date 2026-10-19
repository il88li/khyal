// app/api/plan/route.ts — بوابة الدفع للاشتراك: تُعيد رابط الدفع إن كانت البوابة مضبوطة، وإلا «قيد التجهيز».
// تُضبط البوابة عبر PAYMENT_CHECKOUT_URL (رابط الدفع/الاشتراك). تحديث الخطة يتم من webhook مزوّد الدفع.
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const store = cookies();
  const sb = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { cookies: { getAll: () => store.getAll(), setAll: () => {} } });
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return Response.json({ message: "سجّل الدخول أولاً" }, { status: 401 });

  const b = await req.json().catch(() => ({}));
  if (b?.plan !== "pro") return Response.json({ message: "خطة غير معروفة" }, { status: 400 });

  const base = process.env.PAYMENT_CHECKOUT_URL;
  if (!base) return Response.json({ message: "الاشتراك المدفوع قيد التجهيز — سنعلمك عند إطلاقه" }, { status: 501 });

  // نمرّر معرّف المستخدم كمرجع للعميل حتى يربط مزوّد الدفع الاشتراك بالحساب الصحيح
  const url = `${base}${base.includes("?") ? "&" : "?"}ref=${encodeURIComponent(user.id)}&email=${encodeURIComponent(user.email ?? "")}`;
  return Response.json({ url });
}
