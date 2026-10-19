// app/api/account/route.ts — حذف حساب المستخدم نفسه (يحذف بياناته بالـ cascade)
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { svc, purgeUserFiles } from "@/lib/server";
export async function DELETE() {
  const store = cookies();
  const sb = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { cookies: { getAll: () => store.getAll(), setAll: () => {} } });
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });
  await purgeUserFiles(user.id);
  const { error } = await svc().auth.admin.deleteUser(user.id);
  return error ? Response.json({ error: "failed" }, { status: 500 }) : Response.json({ ok: true });
}
