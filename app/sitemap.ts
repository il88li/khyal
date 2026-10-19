// app/sitemap.ts — خريطة الموقع: الصفحات العامة + أحدث البرومبتات (مع إعادة توليد كل ساعة)
import type { MetadataRoute } from "next";
import { createClient } from "@supabase/supabase-js";

export const revalidate = 3600;

const BASE = "https://khiyal-web.vercel.app";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const statics: MetadataRoute.Sitemap = [
    { url: `${BASE}/`, changeFrequency: "hourly", priority: 1 },
    { url: `${BASE}/search`, changeFrequency: "daily", priority: 0.8 },
    { url: `${BASE}/community`, changeFrequency: "daily", priority: 0.7 },
    { url: `${BASE}/pricing`, changeFrequency: "weekly", priority: 0.6 },
    { url: `${BASE}/safety`, changeFrequency: "monthly", priority: 0.4 },
    { url: `${BASE}/privacy`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${BASE}/terms`, changeFrequency: "yearly", priority: 0.3 },
  ];
  try {
    const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });
    const { data } = await sb.from("prompts").select("id,created_at").order("created_at", { ascending: false }).limit(500);
    const posts = (data ?? []).map((p: any) => ({ url: `${BASE}/p/${p.id}`, lastModified: p.created_at ? new Date(p.created_at) : undefined, changeFrequency: "weekly" as const, priority: 0.6 }));
    return [...statics, ...posts];
  } catch {
    return statics;
  }
}
