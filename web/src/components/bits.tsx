import type { ReactNode } from "react";
import { TrendingDown, TrendingUp } from "lucide-react";
import { EVENT_LABEL, EVENT_STYLE, PAYMENT_STATUS_LABEL, STATUS_LABEL, STATUS_STYLE } from "@/lib/constants";
import { pctChange } from "@/lib/format";
import type { BookingStatus, EventType, PaymentStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

export function StatusBadge({ status, className }: { status: BookingStatus; className?: string }) {
  return (
    <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold whitespace-nowrap", STATUS_STYLE[status], className)}>
      {STATUS_LABEL[status]}
    </span>
  );
}

export function EventTypeTag({ type, className }: { type: EventType; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground whitespace-nowrap", className)}>
      <span className={cn("size-2 rounded-full", EVENT_STYLE[type].dot)} aria-hidden />
      {EVENT_LABEL[type]}
    </span>
  );
}

const PAY_STYLE: Record<PaymentStatus, string> = {
  unpaid: "text-red-700 dark:text-red-300",
  partial: "text-amber-700 dark:text-amber-300",
  paid: "text-emerald-700 dark:text-emerald-300",
  "n/a": "text-muted-foreground",
};

export function PaymentTag({ status }: { status: PaymentStatus }) {
  return <span className={cn("text-xs font-semibold", PAY_STYLE[status])}>{PAYMENT_STATUS_LABEL[status]}</span>;
}

export function PageHeader({ title, description, actions }: { title: ReactNode; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Delta({ cur, prev, label }: { cur: number; prev: number; label: string }) {
  const pct = pctChange(cur, prev);
  if (pct === null) return <span className="text-xs text-muted-foreground">No data {label}</span>;
  const up = pct >= 0;
  const Icon = up ? TrendingUp : TrendingDown;
  return (
    <span className={cn("inline-flex items-center gap-1 text-xs font-medium", up ? "text-emerald-700 dark:text-emerald-300" : "text-red-700 dark:text-red-300")}>
      <Icon className="size-3.5" aria-hidden />
      {up ? "+" : ""}{pct}% <span className="font-normal text-muted-foreground">{label}</span>
    </span>
  );
}

export function Stat({ label, value, sub, accent }: { label: string; value: ReactNode; sub?: ReactNode; accent?: boolean }) {
  return (
    <div className={cn("rounded-xl border bg-card p-4", accent && "border-brand/40 bg-brand-soft/40")}>
      <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{label}</p>
      <p className="tabular mt-1.5 text-2xl font-bold tracking-tight">{value}</p>
      {sub && <div className="mt-1 space-y-0.5">{sub}</div>}
    </div>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <p className="rounded-lg border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">{children}</p>;
}
