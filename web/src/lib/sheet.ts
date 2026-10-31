// Column definitions for the monthly "sheet" (table view + CSV/Excel/PDF exports).
// Order, labels and visibility come from settings.sheet_columns so they can match
// his existing Google Sheet; these are just the fields available.
import { EVENT_LABEL, PAYMENT_STATUS_LABEL, STATUS_LABEL } from "./constants";
import { fmtDate, fmtTimeRange } from "./format";
import type { BookingRow, SheetColumn } from "./types";

type Field = {
  label: string;
  /** Raw value: numbers stay numbers so Excel can sum them. */
  value: (b: BookingRow) => string | number;
  money?: boolean;
  width?: number; // Excel column width (chars)
};

export const SHEET_FIELDS: Record<string, Field> = {
  day:         { label: "Day",         value: (b) => fmtDate(b.event_date, "EEE"), width: 6 },
  date:        { label: "Date",        value: (b) => fmtDate(b.event_date, "MMM d"), width: 9 },
  ref:         { label: "Ref",         value: (b) => b.ref, width: 9 },
  client:      { label: "Client",      value: (b) => b.title ?? b.client?.full_name ?? "", width: 30 },
  client_name: { label: "Client name", value: (b) => [b.client?.full_name, b.client?.partner_name].filter(Boolean).join(" & "), width: 28 },
  event_type:  { label: "Event",       value: (b) => EVENT_LABEL[b.event_type], width: 11 },
  time:        { label: "Time",        value: (b) => fmtTimeRange(b.start_time, b.end_time), width: 18 },
  venue:       { label: "Venue",       value: (b) => b.venue ?? "", width: 30 },
  package:     { label: "Package",     value: (b) => b.package?.name ?? "", width: 18 },
  rate:        { label: "Rate",        value: (b) => b.rate, money: true, width: 11 },
  deposit:     { label: "Deposit",     value: (b) => b.deposit_amount, money: true, width: 11 },
  paid:        { label: "Paid",        value: (b) => b.fin.paid, money: true, width: 11 },
  balance:     { label: "Balance",     value: (b) => b.fin.balance, money: true, width: 11 },
  payment:     { label: "Payment",     value: (b) => PAYMENT_STATUS_LABEL[b.fin.payment_status], width: 9 },
  status:      { label: "Status",      value: (b) => STATUS_LABEL[b.status], width: 13 },
  phone:       { label: "Contact",     value: (b) => b.client?.phone ?? "", width: 14 },
  email:       { label: "Email",       value: (b) => b.client?.email ?? "", width: 26 },
  coordinator: { label: "Coordinator", value: (b) => b.coordinator ?? "", width: 20 },
  guests:      { label: "Guests",      value: (b) => b.guest_count ?? "", width: 7 },
  notes:       { label: "Notes",       value: (b) => b.notes ?? "", width: 36 },
};

/** Visible columns in configured order, ignoring unknown keys. */
export function activeColumns(config: SheetColumn[]) {
  const cols = config.filter((c) => c.visible && SHEET_FIELDS[c.key]);
  return (cols.length ? cols : [{ key: "date", label: "Date", visible: true }, { key: "client", label: "Client", visible: true }])
    .map((c) => ({ ...c, field: SHEET_FIELDS[c.key] }));
}

/** Merge saved config with any fields added since, so new fields show up (hidden) in Settings. */
export function withAllFields(config: SheetColumn[]): SheetColumn[] {
  const known = new Set(config.map((c) => c.key));
  return [
    ...config.filter((c) => SHEET_FIELDS[c.key]),
    ...Object.entries(SHEET_FIELDS).filter(([k]) => !known.has(k)).map(([key, f]) => ({ key, label: f.label, visible: false })),
  ];
}
