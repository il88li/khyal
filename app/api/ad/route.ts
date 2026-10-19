// app/api/ad/route.ts — يسجّل ظهور/نقر الإعلانات في جدول ad_events (خدمة فقط) لأغراض القياس
import { rateHit, svc } from "@/lib/server";

export const runtime = "nodejs";

const SLOTS = new Set(["home", "feed", "rail", "search"]);
const KINDS = new Set(["impression", "click"]);

export async function POST(req: Request) {
  const b = await req.json().catch(() => null);
  const slot = String(b?.slot ?? "").slice(0, 24);
  const kind = String(b?.kind ?? "");
  if (!SLOTS.has(slot) || !KINDS.has(kind)) return new Response(null, { status: 204 });

  // حدّ بسيط لكل عنوان لتفادي الإغراق (مخزن مشترك)
  const ip = (req.headers.get("x-forwarded-for") ?? "local").split(",")[0].trim() || "local";
  const r = await rateHit(`ad:${ip}`, 60, 60);
  if (r.durable && !r.ok) return new Response(null, { status: 204 });

  try { await svc().from("ad_events").insert({ slot, kind }); } catch {}
  return new Response(null, { status: 204 });
}
