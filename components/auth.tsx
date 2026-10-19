"use client";
// components/auth.tsx — مدير حالة الجلسة: loading → in | out
import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { sb } from "@/lib/supabase";
import type { Tier } from "@/lib/access";

export type AuthStatus = "loading" | "in" | "out";
export type Me = { id: string; plan?: string; email?: string; display_name?: string | null; username?: string | null; avatar_url?: string | null };
type Ctx = { status: AuthStatus; me: Me | null; tier: Tier; signOut: () => Promise<void> };

const AuthCtx = createContext<Ctx>({ status: "loading", me: null, tier: "guest", signOut: async () => {} });
export const useAuth = () => useContext(AuthCtx);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [me, setMe] = useState<Me | null>(null);

  useEffect(() => {
    let dead = false;
    const load = async (user?: { id: string; email?: string } | null) => {
      if (!user) { if (!dead) { setMe(null); setStatus("out"); } return; }
      try { localStorage.setItem("khiyal:email", user.email ?? ""); } catch {}
      const { data } = await sb.from("profiles").select("display_name,username,avatar_url").eq("id", user.id).maybeSingle();
      let plan: string | undefined;
      try { const r = await sb.from("profiles").select("plan").eq("id", user.id).maybeSingle(); if (!r.error) plan = (r.data as any)?.plan; } catch {} // العمود اختياري حتى تُنفَّذ الهجرة
      if (!dead) { setMe({ id: user.id, email: user.email, plan, ...(data ?? {}) }); setStatus("in"); }
    };
    // تحقق صامت من الجلسة المخزّنة عند الإقلاع
    sb.auth.getSession().then(({ data }) => load(data.session?.user)).catch(() => !dead && setStatus("out"));
    const { data: sub } = sb.auth.onAuthStateChange((_e, s) => { setTimeout(() => load(s?.user), 0); });
    return () => { dead = true; sub.subscription.unsubscribe(); };
  }, []);

  const signOut = useCallback(async () => {
    await sb.auth.signOut();
    setMe(null); setStatus("out");
    router.replace("/");
  }, [router]);

  const tier: Tier = status !== "in" ? "guest" : me?.plan === "pro" ? "pro" : "free";
  const value = useMemo(() => ({ status, me, tier, signOut }), [status, me, tier, signOut]);
  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}
