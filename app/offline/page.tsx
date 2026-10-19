"use client";
// app/offline/page.tsx — تظهر عند انقطاع الاتصال؛ تعيد المحاولة تلقائياً وتعود للصفحة فور رجوع الشبكة
import { useEffect } from "react";
export default function Offline() {
  useEffect(() => {
    const t = setInterval(() => { fetch("/manifest.webmanifest", { cache: "no-store" }).then((r) => r.ok && location.reload()).catch(() => {}); }, 4000);
    return () => clearInterval(t);
  }, []);
  return (
    <main className="flex min-h-[70dvh] flex-col items-center justify-center gap-4 text-center">
      <h1 className="text-2xl font-bold tracking-tight">لا يوجد اتصال</h1>
      <p className="text-graphite">سنعيد المحاولة تلقائياً فور رجوع الإنترنت.</p>
      <button onClick={() => location.reload()} className="btn btn-primary">إعادة المحاولة</button>
    </main>
  );
}
