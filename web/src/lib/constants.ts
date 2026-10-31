import type { BookingStatus, EventType, PaymentMethod, PaymentKind, PaymentStatus } from "./types";

export const STATUS_LABEL: Record<BookingStatus, string> = {
  inquiry: "Inquiry",
  on_hold: "On Hold",
  contract_sent: "Contract Sent",
  signed: "Signed",
  deposit_paid: "Deposit Paid",
  fully_paid: "Fully Paid",
  done: "Done",
  cancelled: "Cancelled",
};

/** Kanban columns, in pipeline order. Cancelled is a separate drop target. */
export const PIPELINE: BookingStatus[] = [
  "inquiry", "on_hold", "contract_sent", "signed", "deposit_paid", "fully_paid", "done",
];

/** Badge classes per status. */
export const STATUS_STYLE: Record<BookingStatus, string> = {
  inquiry: "bg-sky-100 text-sky-900 dark:bg-sky-950 dark:text-sky-200",
  on_hold: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
  contract_sent: "bg-violet-100 text-violet-900 dark:bg-violet-950 dark:text-violet-200",
  signed: "bg-indigo-100 text-indigo-900 dark:bg-indigo-950 dark:text-indigo-200",
  deposit_paid: "bg-brand-soft text-brand-ink",
  fully_paid: "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200",
  done: "bg-stone-200 text-stone-800 dark:bg-stone-800 dark:text-stone-200",
  cancelled: "bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-200",
};

export const EVENT_LABEL: Record<EventType, string> = {
  wedding: "Wedding",
  debut: "Debut",
  birthday: "Birthday",
  corporate: "Corporate",
  vo_project: "VO Project",
  other: "Other",
};

/** Calendar color per event type: a dot color plus a soft chip. */
export const EVENT_STYLE: Record<EventType, { dot: string; chip: string; hex: string }> = {
  wedding:    { hex: "#FF6600", dot: "bg-brand",       chip: "bg-brand-soft text-brand-ink border-l-brand" },
  debut:      { hex: "#EC4899", dot: "bg-pink-500",    chip: "bg-pink-50 text-pink-900 border-l-pink-500 dark:bg-pink-950 dark:text-pink-100" },
  birthday:   { hex: "#0EA5E9", dot: "bg-sky-500",     chip: "bg-sky-50 text-sky-900 border-l-sky-500 dark:bg-sky-950 dark:text-sky-100" },
  corporate:  { hex: "#4F46E5", dot: "bg-indigo-600",  chip: "bg-indigo-50 text-indigo-900 border-l-indigo-600 dark:bg-indigo-950 dark:text-indigo-100" },
  vo_project: { hex: "#059669", dot: "bg-emerald-600", chip: "bg-emerald-50 text-emerald-900 border-l-emerald-600 dark:bg-emerald-950 dark:text-emerald-100" },
  other:      { hex: "#78716C", dot: "bg-stone-500",   chip: "bg-stone-100 text-stone-800 border-l-stone-500 dark:bg-stone-800 dark:text-stone-100" },
};

export const PAYMENT_STATUS_LABEL: Record<PaymentStatus, string> = {
  unpaid: "Unpaid",
  partial: "Partial",
  paid: "Paid",
  "n/a": "-",
};

export const METHOD_LABEL: Record<PaymentMethod, string> = {
  gcash: "GCash",
  bank_transfer: "Bank transfer",
  cash: "Cash",
  other: "Other",
};

export const KIND_LABEL: Record<PaymentKind, string> = {
  deposit: "Deposit",
  balance: "Balance",
  other: "Other",
};
