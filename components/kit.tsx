"use client";
// components/kit.tsx — مكتبة المكوّنات القابلة للتركيب (Button · Card · Form · Tabs · Alert …)
import Link from "next/link";
import { useId } from "react";
import { AlertTriangle, CheckCircle, ChevronLeft, ChevronRight, Info, Loader2, X } from "./icons";

export { BottomSheet, Modal } from "./ui";
export { EmptyState, ErrorState, Skeleton } from "./states";
export { BottomNav as Navigation, Sidebar } from "./chrome";

const cx = (...a: (string | false | undefined)[]) => a.filter(Boolean).join(" ");

/* ── Button: xs–xl × primary/secondary/success/error/warning/transparent ── */
export type ButtonVariant = "primary" | "secondary" | "success" | "error" | "warning" | "transparent";
export type ButtonSize = "xs" | "sm" | "md" | "lg" | "xl";
type BtnProps = Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "className"> & {
  variant?: ButtonVariant; size?: ButtonSize; loading?: boolean; href?: string; icon?: React.ReactNode; className?: string;
};
export function Button({ variant = "primary", size = "md", loading, href, icon, className, children, ...r }: BtnProps) {
  const c = cx("btn", `btn-${variant}`, `btn-${size}`, className);
  if (href) return <Link href={href} className={c}>{icon}{children}</Link>;
  return (
    <button {...r} type={r.type ?? "button"} disabled={r.disabled || loading} aria-busy={loading || undefined} className={c}>
      {loading ? <Loader2 size={16} className="animate-spin" /> : icon}{children}
    </button>
  );
}

/* ── Card / Header / Hero ── */
export function Card({ interactive, className, children, ...r }: React.HTMLAttributes<HTMLDivElement> & { interactive?: boolean }) {
  return <div {...r} className={cx("card p-4", interactive && "card-interactive", className)}>{children}</div>;
}
export function Header({ title, lead, actions }: { title: string; lead?: string; actions?: React.ReactNode }) {
  return (
    <header className="flex items-end justify-between gap-4">
      <div className="min-w-0"><h1 className="text-2xl font-bold text-charcoal">{title}</h1>{lead && <p className="mt-1 text-base text-graphite">{lead}</p>}</div>
      {actions && <div className="flex shrink-0 gap-2">{actions}</div>}
    </header>
  );
}
export function Hero({ title, lead, actions }: { title: string; lead?: string; actions?: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-4 py-6">
      <h1 className="max-w-[18ch] text-2xl font-bold text-charcoal">{title}</h1>
      {lead && <p className="max-w-[44ch] text-base text-graphite">{lead}</p>}
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </section>
  );
}

/* ── حقول النماذج: التسمية + الخطأ + التلميح مرتبطة بـ aria ── */
type FieldBase = { label: string; hint?: string; error?: string };
function Field({ id, label, hint, error, children }: FieldBase & { id: string; children: React.ReactNode }) {
  return (
    <div className="fld" data-invalid={error ? "1" : undefined}>
      <label htmlFor={id} className="fld-label">{label}</label>
      {children}
      {(error || hint) && <p id={`${id}-d`} className="fld-hint" role={error ? "alert" : undefined}>{error ?? hint}</p>}
    </div>
  );
}
const ariaOf = (id: string, f: FieldBase) => ({ id, "aria-invalid": f.error ? true : undefined, "aria-describedby": f.error || f.hint ? `${id}-d` : undefined });

export function TextInput({ label, hint, error, className, ...r }: FieldBase & React.InputHTMLAttributes<HTMLInputElement>) {
  const id = useId();
  return <Field id={id} label={label} hint={hint} error={error}><input {...r} {...ariaOf(id, { label, hint, error })} className={cx("field px-4", className)} /></Field>;
}
export function TextArea({ label, hint, error, className, ...r }: FieldBase & React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const id = useId();
  return <Field id={id} label={label} hint={hint} error={error}><textarea {...r} {...ariaOf(id, { label, hint, error })} className={cx("field resize-none px-4 py-3", className)} /></Field>;
}
export function Select({ label, hint, error, options, className, ...r }: FieldBase & { options: [string, string][] } & React.SelectHTMLAttributes<HTMLSelectElement>) {
  const id = useId();
  return (
    <Field id={id} label={label} hint={hint} error={error}>
      <select {...r} {...ariaOf(id, { label, hint, error })} className={cx("field px-4", className)}>{options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
    </Field>
  );
}
export function FileInput({ label, hint, error, ...r }: FieldBase & React.InputHTMLAttributes<HTMLInputElement>) {
  const id = useId();
  return <Field id={id} label={label} hint={hint} error={error}><input {...r} type="file" {...ariaOf(id, { label, hint, error })} className="field file:me-4 file:rounded-full file:border-0 file:bg-brand-tint file:px-4 file:py-1 file:text-brand-ink" /></Field>;
}
export function Checkbox({ label, ...r }: { label: string } & Omit<React.InputHTMLAttributes<HTMLInputElement>, "type">) {
  return <label className="choice"><input {...r} type="checkbox" /><span>{label}</span></label>;
}
export function Radio({ label, ...r }: { label: string } & Omit<React.InputHTMLAttributes<HTMLInputElement>, "type">) {
  return <label className="choice"><input {...r} type="radio" /><span>{label}</span></label>;
}
export function Form({ className, ...r }: React.FormHTMLAttributes<HTMLFormElement>) {
  return <form {...r} className={cx("flex flex-col gap-4", className)} />;
}

/* ── Tabs / Alert / Breadcrumbs / Pagination ── */
export function Tabs<T extends string>({ items, value, onChange }: { items: [T, string][]; value: T; onChange: (v: T) => void }) {
  return (
    <div role="tablist" className="tabs2">
      {items.map(([v, l]) => <button key={v} role="tab" aria-selected={value === v} data-on={value === v ? "1" : "0"} onClick={() => onChange(v)}>{l}</button>)}
    </div>
  );
}
const ALERT = { info: Info, success: CheckCircle, warning: AlertTriangle, error: AlertTriangle } as const;
export function Alert({ tone = "info", title, children, onClose }: { tone?: keyof typeof ALERT; title?: string; children?: React.ReactNode; onClose?: () => void }) {
  const Icon = ALERT[tone];
  return (
    <div role={tone === "error" ? "alert" : "status"} className={`alert alert-${tone}`}>
      <Icon size={24} />
      <div className="min-w-0 flex-1">{title && <p className="font-semibold">{title}</p>}{children && <p className="text-sm">{children}</p>}</div>
      {onClose && <button onClick={onClose} aria-label="إغلاق" className="icon-btn"><X size={16} /></button>}
    </div>
  );
}
export function Breadcrumbs({ items }: { items: { label: string; href?: string }[] }) {
  return (
    <nav aria-label="مسار التنقل"><ol className="flex flex-wrap items-center gap-1 text-sm text-smoke">
      {items.map((it, i) => (
        <li key={i} className="flex items-center gap-1">
          {it.href && i < items.length - 1 ? <Link href={it.href} className="text-brand-ink">{it.label}</Link> : <span aria-current="page" className="text-charcoal">{it.label}</span>}
          {i < items.length - 1 && <ChevronLeft size={16} />}
        </li>))}
    </ol></nav>
  );
}
export function Pagination({ page, pages, onChange }: { page: number; pages: number; onChange: (p: number) => void }) {
  return (
    <nav aria-label="الصفحات" className="flex items-center justify-center gap-2">
      <button className="icon-btn" disabled={page <= 1} onClick={() => onChange(page - 1)} aria-label="السابق"><ChevronRight size={16} /></button>
      <span className="text-sm text-graphite tabular-nums">{page} / {pages}</span>
      <button className="icon-btn" disabled={page >= pages} onClick={() => onChange(page + 1)} aria-label="التالي"><ChevronLeft size={16} /></button>
    </nav>
  );
}
