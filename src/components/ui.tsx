import Link from "next/link";
import clsx from "clsx";
import type { ComponentProps, ReactNode } from "react";
import { Star } from "@phosphor-icons/react/ssr";
import { initials } from "@/lib/format";

export const cn = clsx;

// --- buttons -----------------------------------------------------------------

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

export function buttonClass(variant: Variant = "primary", size: Size = "md", extra?: string) {
  return cn(
    "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[10px] font-semibold",
    "transition-[background-color,border-color,color,transform] duration-200 active:translate-y-px",
    "disabled:pointer-events-none disabled:opacity-50",
    size === "sm" && "h-8 px-3.5 text-sm",
    size === "md" && "h-10 px-5 text-sm",
    size === "lg" && "h-12 px-6 text-base",
    variant === "primary" && "bg-accent text-accent-ink hover:bg-accent-strong",
    variant === "secondary" && "border border-line-strong bg-surface text-ink hover:border-ink-3",
    variant === "ghost" && "text-ink-2 hover:bg-surface-2 hover:text-ink",
    variant === "danger" && "border border-danger/30 bg-surface text-danger hover:bg-danger-soft",
    extra,
  );
}

export function Button({
  variant,
  size,
  className,
  ...props
}: ComponentProps<"button"> & { variant?: Variant; size?: Size }) {
  return <button className={buttonClass(variant, size, className)} {...props} />;
}

export function LinkButton({
  variant,
  size,
  className,
  ...props
}: ComponentProps<typeof Link> & { variant?: Variant; size?: Size }) {
  return <Link className={buttonClass(variant, size, className)} {...props} />;
}

// --- surfaces ------------------------------------------------------------------

export function Card({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn("rounded-2xl border border-line bg-surface shadow-card", className)}
      {...props}
    />
  );
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">{title}</h1>
        {description && <p className="mt-1.5 max-w-[65ch] text-ink-3">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 gap-2">{actions}</div>}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon?: ReactNode;
  title: string;
  body?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed border-line-strong px-6 py-12 text-center">
      {icon && <div className="mb-3 text-ink-3">{icon}</div>}
      <p className="font-medium">{title}</p>
      {body && <p className="mt-1 max-w-sm text-sm text-ink-3">{body}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

// --- badges ----------------------------------------------------------------------

type Tone = "neutral" | "accent" | "warn" | "danger" | "info";

export function Badge({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center gap-1 rounded-full px-2.5 text-xs font-medium",
        tone === "neutral" && "bg-surface-2 text-ink-2",
        tone === "accent" && "bg-accent-soft text-accent-strong",
        tone === "warn" && "bg-warn-soft text-warn",
        tone === "danger" && "bg-danger-soft text-danger",
        tone === "info" && "bg-info-soft text-info",
      )}
    >
      {children}
    </span>
  );
}

const bookingTone: Record<string, [Tone, string]> = {
  REQUESTED: ["warn", "Waiting for sitter"],
  ACCEPTED: ["accent", "Confirmed"],
  AWAITING_CONFIRMATION: ["warn", "Waiting for parent"],
  AWAITING_PAYMENT: ["info", "Payment approval"],
  DECLINED: ["neutral", "Declined"],
  EXPIRED: ["neutral", "Expired"],
  CANCELLED: ["neutral", "Cancelled"],
  COMPLETED: ["info", "Completed"],
  DISPUTED: ["danger", "Dispute"],
};

export function BookingStatus({ status, ended }: { status: string; ended?: boolean }) {
  // Accepted and already over, but the sitter hasn't marked it done yet.
  if (status === "ACCEPTED" && ended) return <Badge tone="warn">Waiting to be marked done</Badge>;
  const [tone, label] = bookingTone[status] ?? ["neutral", status];
  return <Badge tone={tone}>{label}</Badge>;
}

// --- people ----------------------------------------------------------------------

export function Avatar({
  src,
  first,
  last,
  size = 40,
  className,
}: {
  src?: string | null;
  first: string;
  last: string;
  size?: number;
  className?: string;
}) {
  const style = { width: size, height: size, fontSize: Math.max(11, size * 0.36) };
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- small avatars from uploads and several hosts
      <img
        src={src}
        alt={`${first} ${last}`}
        width={size}
        height={size}
        style={style}
        className={cn("shrink-0 rounded-full object-cover", className)}
      />
    );
  }
  return (
    <span
      style={style}
      aria-hidden
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full bg-accent-soft font-semibold text-accent-strong",
        className,
      )}
    >
      {initials(first, last)}
    </span>
  );
}

export function Rating({ avg, count, size = "sm" }: { avg: number; count: number; size?: "sm" | "md" }) {
  if (!count) return <span className="text-sm text-ink-3">New</span>;
  return (
    <span className={cn("inline-flex items-center gap-1 tabular", size === "sm" ? "text-sm" : "text-base")}>
      <Star weight="fill" className="text-sun" aria-hidden />
      <span className="font-medium">{avg.toFixed(1)}</span>
      <span className="text-ink-3">({count})</span>
    </span>
  );
}

export function Stars({ value }: { value: number }) {
  return (
    <span className="inline-flex gap-0.5" aria-label={`${value} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} weight={i <= value ? "fill" : "regular"} className={i <= value ? "text-sun" : "text-line-strong"} />
      ))}
    </span>
  );
}

// --- forms -----------------------------------------------------------------------

export const inputClass = cn(
  "h-11 w-full rounded-[10px] border border-line-strong bg-surface px-3.5 text-[15px] text-ink",
  "placeholder:text-ink-3 transition-[border-color,box-shadow] duration-150",
  "focus:border-accent focus:outline-none focus:ring-4 focus:ring-accent/15",
  "aria-[invalid=true]:border-danger",
);

export function Field({
  label,
  htmlFor,
  error,
  hint,
  children,
  className,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <label htmlFor={htmlFor} className="text-sm font-medium text-ink-2">
        {label}
      </label>
      {children}
      {hint && !error && <p className="text-xs text-ink-3">{hint}</p>}
      {error && (
        <p id={`${htmlFor}-error`} className="text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cn(inputClass, className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea className={cn(inputClass, "h-auto min-h-24 py-2.5", className)} {...props} />;
}

export function Select({ className, ...props }: ComponentProps<"select">) {
  return <select className={cn(inputClass, "pr-8", className)} {...props} />;
}

export function Alert({ tone = "danger", children }: { tone?: Tone; children: ReactNode }) {
  return (
    <div
      role={tone === "danger" ? "alert" : "status"}
      className={cn(
        "rounded-[10px] px-4 py-3 text-sm",
        tone === "danger" && "bg-danger-soft text-danger",
        tone === "accent" && "bg-accent-soft text-accent-strong",
        tone === "warn" && "bg-warn-soft text-warn",
        tone === "info" && "bg-info-soft text-info",
        tone === "neutral" && "bg-surface-2 text-ink-2",
      )}
    >
      {children}
    </div>
  );
}
