// Merge fields for contract and email templates: {{client_name}}, {{event_date}}, …
import { addDays, format, subDays } from "date-fns";
import { EVENT_LABEL } from "./constants";
import { fmtDate, fmtTimeRange, parseDay, php } from "./format";
import type { BookingRow } from "./types";
import type { Rules } from "./settings";

export const MERGE_FIELDS: [string, string][] = [
  ["ref", "Booking reference (HL-0042)"],
  ["client_name", "Client full name (and partner)"],
  ["client_first_name", "Client first name"],
  ["client_phone", "Client mobile"],
  ["client_email", "Client email"],
  ["event_title", "Event title"],
  ["event_type", "Wedding, Debut, …"],
  ["event_date", "Saturday, October 3, 2026"],
  ["event_time", "5:00 PM – 9:00 PM"],
  ["venue", "Venue"],
  ["package", "Package name"],
  ["rate", "Total fee (₱)"],
  ["deposit", "Deposit (₱)"],
  ["balance", "Balance after deposit (₱)"],
  ["paid", "Paid so far (₱)"],
  ["deposit_due", "Deposit due date"],
  ["balance_due", "Balance due date"],
  ["host_name", "Your name"],
  ["today", "Today's date"],
  ["signature", "Your email sign-off"],
  ["payment_instructions", "GCash / bank details"],
];

export function bookingFields(b: BookingRow, rules: Rules, extra: Record<string, string> = {}): Record<string, string> {
  const client = [b.client?.full_name, b.client?.partner_name].filter(Boolean).join(" & ");
  const first = b.client?.full_name?.split(" ")[0] ?? "there";
  const balanceDue = format(subDays(parseDay(b.event_date), rules.balance_due_days_before), "MMMM d, yyyy");
  return {
    ref: b.ref,
    client_name: client || "Client",
    client_first_name: first,
    client_phone: b.client?.phone ?? "-",
    client_email: b.client?.email ?? "-",
    event_title: b.title ?? `${EVENT_LABEL[b.event_type]} of ${client}`,
    event_type: EVENT_LABEL[b.event_type],
    event_date: fmtDate(b.event_date, "EEEE, MMMM d, yyyy"),
    event_time: fmtTimeRange(b.start_time, b.end_time) || "To be confirmed",
    venue: b.venue ?? "To be confirmed",
    package: b.package?.name ?? "Custom",
    rate: php(b.rate),
    deposit: php(b.deposit_amount),
    balance: php(Math.max(b.rate - b.deposit_amount, 0)),
    paid: php(b.fin.paid),
    deposit_due: format(addDays(new Date(), rules.deposit_due_days), "MMMM d, yyyy"),
    balance_due: balanceDue,
    balance_due_line: b.fin.balance > 0 ? `\nBalance due on or before: ${balanceDue}` : "",
    host_name: "Lester",
    today: format(new Date(), "MMMM d, yyyy"),
    ...extra,
  };
}

/** Replace {{field}}; unknown fields are left visible so mistakes are easy to spot. */
export function renderTemplate(tpl: string, fields: Record<string, string>) {
  return tpl.replace(/\{\{\s*(\w+)\s*\}\}/g, (m, k: string) => fields[k] ?? m);
}
