"use client";
// lib/verification.ts — توثيق الحسابات: قياس الشروط + إرسال الطلب (RPC آمن من جهة الخادم)
import { sb, toast, explain } from "@/lib/supabase";
import type { VerificationStats } from "@/types";

export const VERIFY_RULES = [
  { key: "prompts", label: "برومبتات منشورة", min: "min_prompts" },
  { key: "likes", label: "إعجابات مستلمة", min: "min_likes" },
  { key: "followers", label: "متابعون", min: "min_followers" },
  { key: "days", label: "أيام منذ إنشاء الحساب", min: "min_days" },
] as const;

const REASON: Record<string, string> = {
  auth: "سجّل الدخول أولاً.",
  already: "حسابك موثّق بالفعل ✓",
  not_eligible: "لم تستوفِ شروط التوثيق بعد.",
  pending: "طلبك قيد المراجعة بالفعل.",
};

/** يجلب شروط التوثيق وتقدّم المستخدم الحالي (أو حساب محدد) */
export async function verificationStats(userId?: string): Promise<VerificationStats | null> {
  const { data, error } = await sb.rpc("verification_stats", { p_user: userId ?? null });
  if (error) { toast(explain(error), "error"); return null; }
  return data as VerificationStats;
}

/** يرسل طلب توثيق (يتحقّق من الأهلية من جهة الخادم) */
export async function requestVerification(note?: string): Promise<boolean> {
  const { data, error } = await sb.rpc("request_verification", { p_note: note?.trim() || null });
  if (error) { toast(explain(error), "error"); return false; }
  const r = (data ?? {}) as { ok?: boolean; reason?: string };
  if (r.ok) { toast("تم إرسال طلب التوثيق، سنراجعه قريباً.", "success"); return true; }
  toast(REASON[r.reason ?? ""] ?? "تعذّر إرسال الطلب.", "error");
  return false;
}
