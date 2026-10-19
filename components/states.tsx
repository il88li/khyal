"use client";
// components/states.tsx — حالات التحميل والفراغ والخطأ الموحّدة
import { motion } from "framer-motion";
import { AlertTriangle, Inbox, RotateCw, Sparkles } from "@/components/icons";
import type { LucideIcon } from "@/components/icons";
import Link from "next/link";
import { useState } from "react";
import type { ImgHTMLAttributes } from "react";

const W = ["92%", "100%", "78%", "96%", "64%", "88%"];

/** صورة آمنة: تتحول إلى مربّع محايد أنيق عند فشل التحميل بدل أيقونة مكسورة */
export function SafeImg({ className = "", alt = "", ...rest }: ImgHTMLAttributes<HTMLImageElement>) {
  const [err, setErr] = useState(false);
  if (err)
    return (
      <span className={`flex items-center justify-center bg-mist text-ash ${className}`} aria-hidden>
        <Sparkles size={18} />
      </span>
    );
  return <img alt={alt} className={className} loading="lazy" decoding="async" onError={() => setErr(true)} {...rest} />;
}

/** هيكل تحميل: lines (نص) · card (بطاقات برومبت) · grid (شبكة 4:5) · list (صفوف) */
export function Skeleton({
  variant = "lines",
  lines = 5,
  count = 3,
  className = "",
}: {
  variant?: "lines" | "card" | "promptCard" | "grid" | "list";
  lines?: number;
  count?: number;
  className?: string;
}) {
  const label = "جارٍ التحميل";
  if (variant === "promptCard")
    return (
      <div className={`flex flex-col gap-4 ${className}`} role="status" aria-busy="true" aria-label={label}>
        {Array.from({ length: count }, (_, i) => (
          <div key={i} className="prompt-card card prompt-card-skel">
            <div className="prompt-card-head">
              <div className="skel h-10 w-10 !rounded-full" />
              <div className="flex flex-1 flex-col gap-2"><div className="skel h-3 w-1/3" /><div className="skel h-2.5 w-1/5" /></div>
              <div className="skel h-9 w-20 !rounded-full" />
            </div>
            <div className="skel aspect-[4/3] w-full" />
            <div className="prompt-card-copy-wrap flex flex-col gap-2">
              <div className="skel h-3.5 w-2/3" />
              <div className="skel h-3 w-full" />
              <div className="skel h-3 w-4/5" />
            </div>
            <div className="flex items-center gap-3">
              <div className="skel h-9 w-16 !rounded-full" />
              <div className="skel h-9 w-16 !rounded-full" />
              <div className="skel ml-auto h-9 w-28 !rounded-full" />
            </div>
          </div>
        ))}
      </div>
    );
  if (variant === "card")
    return (
      <div className={`flex flex-col gap-4 ${className}`} role="status" aria-busy="true" aria-label={label}>
        {Array.from({ length: count }, (_, i) => (
          <div key={i} className="card flex flex-col gap-4 p-4">
            <div className="flex items-center gap-4">
              <div className="skel h-10 w-10 !rounded-full" />
              <div className="flex flex-1 flex-col gap-2"><div className="skel h-3 w-1/3" /><div className="skel h-3 w-1/4" /></div>
            </div>
            <div className="skel aspect-video w-full !rounded-xl" />
            <div className="skel h-3 w-full" /><div className="skel h-3 w-2/3" />
          </div>
        ))}
      </div>
    );
  if (variant === "grid")
    return (
      <div className={`grid grid-cols-2 gap-4 ${className}`} role="status" aria-busy="true" aria-label={label}>
        {Array.from({ length: count }, (_, i) => <div key={i} className="skel aspect-[4/5] !rounded-xl" />)}
      </div>
    );
  if (variant === "list")
    return (
      <div className={`flex flex-col gap-4 ${className}`} role="status" aria-busy="true" aria-label={label}>
        {Array.from({ length: count }, (_, i) => <div key={i} className="skel h-16 !rounded-xl" />)}
      </div>
    );
  return (
    <div className={`flex flex-col gap-4 ${className}`} role="status" aria-busy="true" aria-label={label}>
      {Array.from({ length: lines }, (_, i) => <div key={i} className="skel h-3.5" style={{ width: W[i % W.length] }} />)}
    </div>
  );
}

type Action = { label: string; href?: string; onClick?: () => void };

/** حالة فارغة: أيقونة + عنوان + إجراء اختياري */
export function EmptyState({
  icon: Icon = Inbox,
  title,
  hint,
  action,
  className = "",
}: {
  icon?: LucideIcon;
  title: string;
  hint?: string;
  action?: Action;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.25, ease: [0.2, 0, 0, 1] }}
      className={`flex flex-col items-center gap-4 p-4 py-12 text-center ${className}`}
    >
      <span className="flex h-16 w-16 items-center justify-center rounded-xl bg-brand-tint text-brand-ink"><Icon size={28} /></span>
      <div className="flex flex-col gap-1">
        <p className="text-lg font-semibold text-charcoal">{title}</p>
        {hint && <p className="max-w-[32ch] text-sm text-graphite">{hint}</p>}
      </div>
      {action && (action.href
        ? <Link href={action.href} className="btn btn-primary">{action.label}</Link>
        : <button onClick={action.onClick} className="btn btn-primary">{action.label}</button>)}
    </motion.div>
  );
}

/** حالة خطأ مع إعادة المحاولة */
export function ErrorState({
  message = "تعذّر تحميل المحتوى. تحقق من الاتصال ثم حاول مجدداً.",
  onRetry,
  className = "",
}: {
  message?: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <motion.div
      role="alert"
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.25, ease: [0.2, 0, 0, 1] }}
      className={`flex flex-col items-center gap-4 p-4 py-12 text-center ${className}`}
    >
      <span className="flex h-16 w-16 items-center justify-center rounded-xl bg-danger-tint text-danger"><AlertTriangle size={28} /></span>
      <p className="max-w-[32ch] text-base text-graphite">{message}</p>
      {onRetry && <button onClick={onRetry} className="btn btn-primary"><RotateCw size={16} />إعادة المحاولة</button>}
    </motion.div>
  );
}
