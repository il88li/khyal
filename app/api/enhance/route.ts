// app/api/enhance/route.ts — بث SSE للنص المحسّن، بلا أي إفصاح عن النماذج أو المزودين
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { buildMessages, getSettings, logError, rateHit, streamEnhance, svc } from "@/lib/server";

export const runtime = "nodejs";
// مهلة موحّدة مع مهل الاتصال بالنموذج (lib/server.ts) — تمنع قطع الردود الطويلة
// سقف Vercel Hobby هو 60ث، وهو أقصى ما تسمح به الباقة المجانية.
export const maxDuration = 60;

/** ينزع من كل حدث في البث أي حقل يكشف التقنية (اسم النموذج، المزوّد، السجلات) قبل وصوله إلى المستخدم */
function scrub(body: ReadableStream<Uint8Array>): ReadableStream<Uint8Array> {
  const dec = new TextDecoder(), enc = new TextEncoder();
  let buf = "";
  const cleanLine = (l: string) => {
    if (!l.startsWith("data: ") || l.includes("[DONE]")) return l + "\n";
    try {
      const j = JSON.parse(l.slice(6));
      delete j.model; delete j.id; delete j.provider; delete j.logprobs; delete j.usage;
      if (Array.isArray(j.choices)) for (const c of j.choices) { if (c && typeof c === "object") { delete c.logprobs; delete c.finish_reason; } }
      return `data: ${JSON.stringify(j)}\n`;
    } catch { return ""; }
  };
  return body.pipeThrough(new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, ctl) {
      buf += dec.decode(chunk, { stream: true });
      const lines = buf.split("\n"); buf = lines.pop() ?? "";
      let out = ""; for (const l of lines) out += cleanLine(l);
      if (out) ctl.enqueue(enc.encode(out));
    },
    flush(ctl) {
      if (buf) { ctl.enqueue(enc.encode(cleanLine(buf))); buf = ""; }
    },
  }));
}

export async function POST(req: Request) {
  const store = cookies();
  const sb = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: { getAll: () => store.getAll(), setAll: () => {} },
  });
  const { data: { user } } = await sb.auth.getUser();
  if (!user) { // تجربة مجانية بلا تسجيل (حدّ صارم يحمي التكلفة) عبر مخزن مشترك
    const ip = (req.headers.get("x-forwarded-for") ?? "local").split(",")[0].trim() || "local";
    const hour = await rateHit(`guest-h:${ip}`, 2, 3600);
    const day = hour.ok && hour.durable ? await rateHit(`guest-d:${ip}`, 5, 86400) : { ok: true, durable: true };
    if (hour.durable && (!hour.ok || !day.ok)) return Response.json({ error: "guest_limit" }, { status: 429 });
  }

  const cfg = await getSettings();
  if (cfg.flags?.enhancer === false) return Response.json({ error: "disabled" }, { status: 503 });
  if (user) { // حدّ المسجّلين (الضيف له حدّه الخاص أعلاه) عبر مخزن مشترك
    const limit = cfg.rate ?? 10;
    const r = await rateHit(`user:${user.id}`, limit, 60);
    if (r.durable && !r.ok) return Response.json({ error: "rate_limited" }, { status: 429 });
  }

  const b = await req.json();
  if (!b?.text || String(b.text).length > 8000) return Response.json({ error: "bad_input" }, { status: 400 });

  try {
    const { body, model } = await streamEnhance(
      buildMessages({
        text: b.text,
        category: b.category ?? "عام",
        lang: b.lang ?? "عربي",
        tone: b.tone ?? "ودّي",
        detail: b.detail ?? "متوازن",
      }),
      undefined, // التوجيه التلقائي دائماً
      b.onlyFree !== false
    );
    if (user) { try { svc().from("usage").insert({ user_id: user.id, model }).then(() => {}, () => {}); } catch {} }
    return new Response(scrub(body), {
      headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" },
    });
  } catch (e: any) {
    console.error("[enhance]", e.message);
    logError("enhance", e.message);
    const msg = String(e.message ?? "");
    const code = /^no_api_key/.test(msg) ? "no_api_key" : /^auth_failed/.test(msg) ? "bad_api_key" : "all_models_failed";
    // لا نُعيد أي تفاصيل تقنية إلى الواجهة — الرسالة للمستخدم عربية ومجرّدة
    return Response.json({ error: code }, { status: 503 });
  }
}
