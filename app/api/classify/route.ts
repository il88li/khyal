// app/api/classify/route.ts — عنوان + تصنيف + وسوم تلقائية للبرومبت عبر النماذج المجانية (لا يمنع النشر أبداً)
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { completeText, logError, rateHit } from "@/lib/server";

export const runtime = "nodejs";

const fallbackTitle = (t: string) => t.replace(/\s+/g, " ").trim().split(" ").slice(0, 7).join(" ").slice(0, 60);

export async function POST(req: Request) {
  const store = cookies();
  const sb = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { cookies: { getAll: () => store.getAll(), setAll: () => {} } });
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return Response.json({ error: "auth_required" }, { status: 401 });

  const r = await rateHit(`classify:${user.id}`, 8, 60);
  if (r.durable && !r.ok) return Response.json({ error: "rate_limited" }, { status: 429 });

  const b = await req.json().catch(() => null);
  const text = String(b?.text ?? "").trim().slice(0, 6000);
  const cats: { id: number; name: string }[] = (Array.isArray(b?.cats) ? b.cats : []).filter((c: any) => Number.isInteger(c?.id) && typeof c?.name === "string").slice(0, 40);
  if (!text) return Response.json({ error: "bad_input" }, { status: 400 });

  const base = { title: fallbackTitle(text), category_id: null as number | null, tags: [] as string[], ai: false };
  try {
    const { text: out } = await completeText([
      { role: "system", content: `أنت مصنّف برومبتات عربي. أعد JSON واحداً فقط بلا أي نص آخر بالشكل {"title":"...","category_id":رقم_أو_null,"tags":["..",".."]}.
- title: عنوان عربي جذاب موجز (3 إلى 8 كلمات) يصف الغرض من البرومبت.
- category_id: اختر رقماً واحداً من القائمة فقط، أو null إن لم يناسب أي تصنيف.
- tags: من 2 إلى 4 وسوم عربية قصيرة (كلمة أو كلمتان) بلا رموز #.
التصنيفات:
${cats.map((c) => `${c.id}: ${c.name}`).join("\n") || "لا توجد"}` },
      { role: "user", content: text },
    ], 250);
    const m = out.match(/\{[\s\S]*\}/);
    const j = m ? JSON.parse(m[0]) : null;
    if (!j) return Response.json(base);
    const title = String(j.title ?? "").replace(/["«»]/g, "").trim().slice(0, 80);
    const category_id = cats.some((c) => c.id === Number(j.category_id)) ? Number(j.category_id) : null;
    const tags = (Array.isArray(j.tags) ? j.tags : []).map((x: any) => String(x).replace(/[#,]/g, "").trim()).filter((x: string) => x && x.length <= 24).slice(0, 4);
    return Response.json({ title: title || base.title, category_id, tags, ai: true });
  } catch (e: any) {
    await logError("classify", String(e?.message ?? e));
    return Response.json(base); // فشل الذكاء الاصطناعي لا يمنع النشر
  }
}
