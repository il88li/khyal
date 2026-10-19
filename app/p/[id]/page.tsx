// app/p/[id]/page.tsx — صفحة برومبت عامة موحّدة مع تصميم المعاينة: غلاف/معرض + بيانات + نص مقطوع من الخادم + تعليقات + Open Graph
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { Comments, Gallery } from "@/components/ui";
import { PromptCover } from "@/components/PromptCover";
import { GatedPrompt } from "@/components/GatedPrompt";
import { BadgeCheck } from "@/components/icons";
import CreatorCardSlot from "@/components/CreatorCardSlot";

type PublicPrompt = {
  id: string; body: string; enhanced: string | null; images: { url: string; w: number; h: number }[];
  title?: string | null; tags?: string[] | null; category_id?: number | null; locked?: boolean; hidden?: number;
  author?: { id: string; display_name: string | null; username: string | null; avatar_url?: string | null; verified?: boolean; card_fx?: unknown } | null;
};

function client() {
  const store = cookies();
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { cookies: { getAll: () => store.getAll(), setAll: () => {} } });
}

/** جلب البرومبت: أولاً عبر RPC المقصوص من جهة الخادم (يفرض حدود الرؤية)، ثم احتياطاً الاستعلام المباشر */
async function get(id: string): Promise<PublicPrompt | null> {
  const sb = client();
  try {
    const { data, error } = await sb.rpc("prompt_gated", { p_id: id });
    if (!error && data) return data as PublicPrompt;
  } catch {}
  const { data } = await sb.from("prompts").select("id,body,enhanced,images,title,tags,category_id,author:profiles!author_id(id,display_name,username,avatar_url,card_fx)").eq("id", id).maybeSingle();
  return (data as unknown as PublicPrompt) ?? null;
}

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const p = await get(params.id); if (!p) return {};
  const d = (p.title || p.enhanced || p.body || "").slice(0, 90);
  return { title: p.title ? `${p.title} — خيال` : `${p.author?.display_name ?? "برومبت"} على خيال`, description: d, openGraph: { title: p.title ?? "برومبت على خيال", description: d, images: p.images?.[0]?.url ? [p.images[0].url] : undefined } };
}

export default async function Page({ params }: { params: { id: string } }) {
  const p = await get(params.id); if (!p) notFound();
  const name = p.author?.display_name ?? p.author?.username ?? "مستخدم";
  const initial = name.trim().slice(0, 1);
  const text = p.enhanced ?? p.body;
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-4 pt-4">
      <Link href="/" className="btn btn-ghost self-start !min-h-9">← خيال</Link>

      <article className="prompt-card card">
        <header className="prompt-card-head">
          <Link href={`/profile/${p.author?.id}`} className="avatar h-10 w-10 shrink-0 bg-brand-tint text-brand-ink" data-i={initial} aria-label={`الملف الشخصي: ${name}`} />
          <div className="min-w-0 flex-1">
            <Link href={`/profile/${p.author?.id}`} className="block truncate text-sm font-semibold text-charcoal">{name}</Link>
            {p.author?.verified && <span title="حساب موثّق" aria-label="حساب موثّق" className="inline-flex align-middle text-info-ink"><BadgeCheck size={15} fill="currentColor" fillOpacity={0.16} /></span>}
            {p.author?.username && <span dir="ltr" className="truncate text-caption text-smoke">@{p.author.username}</span>}
          </div>
        </header>

        {/* بطاقة المبدع المختصرة في المعاينة */}
        {p.author?.id && p.author.card_fx != null && (
          <CreatorCardSlot
            compact
            fxRaw={p.author.card_fx}
            profileId={p.author.id}
            profile={{ name, username: p.author.username, avatar_url: (p.author as { avatar_url?: string }).avatar_url, prompts: 0, likes: 0, followers: 0 }}
            className="mb-1"
          />
        )}

        {p.images?.length ? (
          <div className="prompt-card-media">
            <Gallery images={p.images} />
            {/* طبقة العنوان نفسها المستعملة في بطاقة الخلاصة — العنوان يعلو حافّة الوسائط */}
            {p.title && <p className="prompt-media-title">{p.title}</p>}
          </div>
        ) : (
          <div className="prompt-card-media prompt-card-media--cover"><PromptCover title={p.title} text={p.body} author={name} /></div>
        )}

        {(p.category_id != null || !!p.tags?.length) && (
          <div className="prompt-card-tags">{p.tags?.slice(0, 3).map((t) => <span key={t} className="chip">{t}</span>)}</div>
        )}

        <div className="prompt-card-copy-wrap">
          <GatedPrompt text={text} ownerId={p.author?.id} locked={p.locked} hidden={p.hidden} />
        </div>
      </article>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-bold">التعليقات</h2>
        <div className="flex min-h-[320px] flex-col"><Comments promptId={p.id} /></div>
      </section>
    </main>
  );
}
