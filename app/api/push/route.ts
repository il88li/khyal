// app/api/push/route.ts — Webhook من Supabase (INSERT على notifications) → FCM للمستلم
import { sendPush, svc } from "@/lib/server";
export async function POST(req: Request) {
  if (!process.env.PUSH_WEBHOOK_SECRET || req.headers.get("x-webhook-secret") !== process.env.PUSH_WEBHOOK_SECRET) return new Response("unauthorized", { status: 401 });
  const { record } = await req.json();
  if (!record || record.kind === "broadcast") return Response.json({ ok: true }); // البث الجماعي يُرسَل مباشرة من الأدمن
  const { data } = await svc().from("push_tokens").select("token").eq("user_id", record.user_id);
  await sendPush((data ?? []).map((t) => t.token), { title: record.title ?? "خيال", body: record.body ?? "", link: record.link ?? "/" });
  return Response.json({ ok: true });
}
