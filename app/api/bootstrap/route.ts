// app/api/bootstrap/route.ts — يستدعيه التطبيق عند الفتح: يفحص قاعدة البيانات ويهيّئها ذاتياً إن لزم (لا يقبل مدخلات)
import { ensureSetup } from "@/lib/server";
export const dynamic = "force-dynamic";
export const maxDuration = 30;
export async function POST() {
  try { return Response.json(await ensureSetup()); }
  catch (e: any) { return Response.json({ status: "failed", msg: String(e?.message ?? e).slice(0, 200) }); }
}
