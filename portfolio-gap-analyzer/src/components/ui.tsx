import Link from "next/link";
import type { ReactNode } from "react";

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`card ${className}`}>{children}</div>;
}

export function SectionHeading({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
      <div className="max-w-2xl">
        <h2 className="text-[15px] font-semibold tracking-tight text-[var(--text)]">{title}</h2>
        {description ? <p className="mt-1 text-[13px] leading-relaxed text-[var(--text-muted)]">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function Stat({
  label,
  value,
  detail,
  tone = "neutral",
}: {
  label: string;
  value: string;
  detail?: string;
  tone?: "neutral" | "over" | "under" | "warn";
}) {
  const toneClass =
    tone === "over"
      ? "text-[var(--over)]"
      : tone === "under"
        ? "text-[var(--under)]"
        : tone === "warn"
          ? "text-[var(--warn)]"
          : "text-[var(--text)]";
  return (
    <div className="px-4 py-3">
      <div className="text-[11px] uppercase tracking-wide text-[var(--text-faint)]">{label}</div>
      <div className={`tnum mt-1 text-[19px] font-semibold leading-none ${toneClass}`}>{value}</div>
      {detail ? <div className="mt-1.5 text-[12px] leading-snug text-[var(--text-muted)]">{detail}</div> : null}
    </div>
  );
}

export function StatGrid({ children }: { children: ReactNode }) {
  return (
    <div className="grid grid-cols-2 divide-x divide-y divide-[var(--border)] sm:grid-cols-3 lg:grid-cols-4 [&>*]:border-[var(--border)]">
      {children}
    </div>
  );
}

export function Pill({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "over" | "under" | "accent" | "warn";
}) {
  const map = {
    neutral: "bg-[var(--surface-2)] text-[var(--text-muted)] border-[var(--border)]",
    over: "bg-[var(--over-soft)] text-[var(--over)] border-[var(--over)]/25",
    under: "bg-[var(--under-soft)] text-[var(--under)] border-[var(--under)]/25",
    accent: "bg-[var(--accent-soft)] text-[var(--accent-text)] border-[var(--accent)]/25",
    warn: "bg-[var(--warn-soft)] text-[var(--warn)] border-[var(--warn)]/25",
  } as const;
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${map[tone]}`}>
      {children}
    </span>
  );
}

export function Callout({
  title,
  children,
  tone = "neutral",
}: {
  title?: string;
  children: ReactNode;
  tone?: "neutral" | "warn" | "accent";
}) {
  const map = {
    neutral: "border-[var(--border)] bg-[var(--surface-2)]",
    warn: "border-[var(--warn)]/30 bg-[var(--warn-soft)]",
    accent: "border-[var(--accent)]/25 bg-[var(--accent-soft)]",
  } as const;
  return (
    <div className={`rounded-[var(--radius)] border px-4 py-3 ${map[tone]}`}>
      {title ? <div className="mb-1 text-[12px] font-semibold text-[var(--text)]">{title}</div> : null}
      <div className="text-[12.5px] leading-relaxed text-[var(--text-muted)]">{children}</div>
    </div>
  );
}

export function LearnLink({ slug, children }: { slug: string; children: ReactNode }) {
  return (
    <Link
      href={`/learn/${slug}`}
      className="inline-flex items-center gap-1 text-[12px] font-medium text-[var(--accent-text)] hover:underline"
    >
      {children}
      <span aria-hidden="true">→</span>
    </Link>
  );
}

export function EmptyState({
  title,
  children,
  action,
}: {
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <Card className="px-6 py-12 text-center">
      <h3 className="text-[15px] font-semibold text-[var(--text)]">{title}</h3>
      <p className="mx-auto mt-2 max-w-md text-[13px] leading-relaxed text-[var(--text-muted)]">{children}</p>
      {action ? <div className="mt-5 flex justify-center gap-3">{action}</div> : null}
    </Card>
  );
}

export function Button({
  children,
  onClick,
  href,
  variant = "primary",
  type = "button",
  disabled,
}: {
  children: ReactNode;
  onClick?: () => void;
  href?: string;
  variant?: "primary" | "secondary" | "ghost";
  type?: "button" | "submit";
  disabled?: boolean;
}) {
  const base =
    "inline-flex items-center justify-center gap-1.5 rounded-lg px-3.5 py-2 text-[13px] font-medium transition-colors disabled:opacity-50 disabled:pointer-events-none";
  const map = {
    primary: "bg-[var(--accent)] text-white hover:opacity-90",
    secondary: "border border-[var(--border-strong)] bg-[var(--surface)] text-[var(--text)] hover:bg-[var(--surface-2)]",
    ghost: "text-[var(--text-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--text)]",
  } as const;
  const className = `${base} ${map[variant]}`;
  if (href) {
    return (
      <Link href={href} className={className}>
        {children}
      </Link>
    );
  }
  return (
    <button type={type} onClick={onClick} disabled={disabled} className={className}>
      {children}
    </button>
  );
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="block text-[12px] font-medium text-[var(--text)]">{label}</span>
      {hint ? <span className="mt-0.5 block text-[11.5px] leading-snug text-[var(--text-muted)]">{hint}</span> : null}
      <div className="mt-1.5">{children}</div>
    </label>
  );
}

export const inputClass =
  "tnum w-full rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-3 py-2 text-[13px] text-[var(--text)] placeholder:text-[var(--text-faint)]";
