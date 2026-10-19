"use client";
// app/notifications/page.tsx — إشعارات حيّة (Realtime) + روابط عميقة + قراءة فورية
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Bell } from "@/components/icons";
import { EmptyState, Skeleton } from "@/components/states";
import { sb, uid, ago } from "@/lib/supabase";

type N = { id: string; title: string; body: string; link: string | null; read: boolean; created_at: string };
export default function Notifications() {
  const r = useRouter(), [items, setItems] = useState<N[] | null>(null);
  useEffect(() => {
    let ch: ReturnType<typeof sb.channel> | undefined;
    uid().then(async (id) => {
      if (!id) return;
      const { data } = await sb.from("notifications").select("id,title,body,link,read,created_at").eq("user_id", id).order("created_at", { ascending: false }).limit(50);
      setItems(data ?? []);
      ch = sb.channel("notif-page").on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${id}` }, (p: any) => setItems((a) => [p.new, ...(a ?? [])])).subscribe();
    });
    return () => { if (ch) sb.removeChannel(ch); };
  }, []);
  const open = (n: N) => { if (!n.read) { setItems((a) => a!.map((x) => (x.id === n.id ? { ...x, read: true } : x))); sb.from("notifications").update({ read: true }).eq("id", n.id).then(() => {}); } if (n.link) r.push(n.link); };
  const readAll = async () => { const id = await uid(); setItems((a) => a!.map((x) => ({ ...x, read: true }))); await sb.from("notifications").update({ read: true }).eq("user_id", id!).eq("read", false); };
  return (
    <main className="flex flex-col gap-4 pt-4">
      <header className="flex items-center justify-between gap-2"><Link href="/requests" className="btn btn-soft !min-h-10 !px-3 !text-caption">طلبات المتابعة</Link>
        {items?.some((n) => !n.read) && <button onClick={readAll} className="btn btn-soft">قراءة الكل</button>}</header>
      {!items ? <Skeleton variant="list" count={5} />
        : !items.length ? <EmptyState icon={Bell} title="لا توجد إشعارات" hint="ستظهر هنا الإعجابات والمتابعات والتعليقات." />
        : items.map((n) => (
          <button key={n.id} onClick={() => open(n)} className={`flex min-h-[76px] flex-col gap-1 rounded-xl border p-4 text-start active:opacity-70 ${n.read ? "border-silver bg-snow" : "border-brand/40 bg-brand-tint"}`}>
            <span className="flex items-center justify-between gap-2"><span className="text-sm font-medium">{n.title}</span><span className="shrink-0 text-caption text-smoke">{ago(n.created_at)}</span></span>
            <span className="truncate text-sm text-graphite">{n.body}</span></button>))}
    </main>
  );
}
