"use client";
// app/auth/reset/page.tsx — تعيين كلمة مرور جديدة بعد رابط الاستعادة (PKCE)
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { sb } from "@/lib/supabase";
export default function Reset() {
  const r = useRouter(), [pw, setPw] = useState(""), [msg, setMsg] = useState(""), [ready, setReady] = useState(false), [busy, setBusy] = useState(false);
  useEffect(() => {
    (async () => {
      const code = new URLSearchParams(location.search).get("code");
      if (code) await sb.auth.exchangeCodeForSession(code);
      setReady(!!(await sb.auth.getSession()).data.session);
    })();
  }, []);
  async function save() { setBusy(true); const { error } = await sb.auth.updateUser({ password: pw }); setBusy(false); if (error) setMsg(error.message); else r.replace("/"); }
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 py-8">
      <h1 className="text-2xl font-semibold">كلمة مرور جديدة</h1>
      {!ready ? <p className="text-graphite">الرابط غير صالح أو منتهي. اطلب رابطاً جديداً من صفحة الدخول.</p> : <>
        <input type="password" dir="ltr" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="كلمة المرور الجديدة" autoComplete="new-password" className="field px-4" />
        {msg && <p role="alert" className="text-caption">{msg}</p>}
        <button onClick={save} disabled={busy || pw.length < 6} className="btn btn-primary w-full !min-h-10 disabled:bg-mist disabled:text-ash disabled:shadow-none">{busy ? "…" : "حفظ"}</button></>}
    </main>
  );
}
