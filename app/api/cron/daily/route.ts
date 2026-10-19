// app/api/cron/daily/route.ts — تذكير يومي (Vercel Cron): يرسل «تحدي اليوم» لمن فعّل الإشعارات
import { pushAll } from "@/lib/server";
import { challengeOf } from "@/types";
export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  if (!process.env.CRON_SECRET || req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) return new Response("unauthorized", { status: 401 });
  const c = challengeOf(new Date());
  await pushAll({ title: "تحدي اليوم في خيال", body: c, link: `/enhance?text=${encodeURIComponent(c)}` });
  return Response.json({ ok: true, challenge: c });
}
