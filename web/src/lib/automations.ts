import "server-only";
import { addDays } from "date-fns";
import type { SupabaseClient } from "@supabase/supabase-js";
import { logActivity } from "./activity";
import { BLOCKING, checkConflicts } from "./conflicts";
import { issueContract, sendSignedEmail } from "./contracts";
import { getBooking } from "./data";
import { sendTemplateEmail } from "./email";
import { syncBookingEvent } from "./google";
import { bookingFields } from "./merge";
import { getRules } from "./settings";
import { STATUS_LABEL } from "./constants";
import { php } from "./format";
import type { BookingStatus } from "./types";

export { logActivity } from "./activity";

export class ConflictError extends Error {
  constructor(public reasons: string[]) {
    super(reasons.join(" "));
  }
}

type TransitionOpts = {
  reason?: string;
  actor?: "admin" | "system" | "client" | "cron";
  /** Skip the double-booking check (admin chose "book anyway", or the client signed). */
  force?: boolean;
  /** Signing link to include in the post-signing email. */
  contractUrl?: string;
};

/**
 * The single entry point for moving a booking through the pipeline: Kanban drag,
 * the status menu, the booking form, and the client signing page all call this.
 */
export async function transitionBooking(supabase: SupabaseClient, bookingId: string, to: BookingStatus, opts: TransitionOpts = {}) {
  const before = await getBooking(supabase, bookingId);
  if (!before) throw new Error("Booking not found");
  const from = before.status;
  if (from === to) return;

  // Double-booking check whenever a booking starts holding the date.
  if (BLOCKING.includes(to) && !BLOCKING.includes(from) && !opts.force) {
    const report = await checkConflicts(supabase, { ...before, excludeId: before.id, excludeGoogleEventId: before.google_event_id });
    if (report.blocking.length) throw new ConflictError(report.blocking);
  }

  const patch: Record<string, unknown> = { status: to };
  if (to === "cancelled") patch.cancelled_reason = opts.reason ?? null;
  if (to === "on_hold" && !before.hold_expires_at) {
    patch.hold_expires_at = addDays(new Date(), (await getRules(supabase)).hold_days).toISOString();
  }
  const { error } = await supabase.from("bookings").update(patch).eq("id", bookingId);
  if (error) throw error;

  await logActivity(supabase, {
    actor: opts.actor ?? "admin",
    entity_type: "booking",
    entity_id: bookingId,
    action: "booking.status_changed",
    summary: `${before.title ?? "Booking"}: ${STATUS_LABEL[from]} → ${STATUS_LABEL[to]}`,
    details: { from, to, reason: opts.reason },
  });

  await runAutomations(supabase, bookingId, to, opts);
}

/** Side effects for arriving in a status. Each step is idempotent and logged; failures are logged, not thrown. */
async function runAutomations(supabase: SupabaseClient, bookingId: string, to: BookingStatus, opts: TransitionOpts) {
  const b = await getBooking(supabase, bookingId);
  if (!b) return;

  await step(supabase, bookingId, "calendar", async () => {
    const r = await syncBookingEvent(supabase, b);
    return r.ok ? `Google Calendar: ${r.action}${r.reason ? ` (${r.reason})` : ""}` : `Google Calendar error: ${r.error}`;
  });

  if (to === "contract_sent") {
    await step(supabase, bookingId, "contract", async () => {
      const { email } = await issueContract(supabase, b);
      return `Contract link ${emailNote(email.status, email.reason)}`;
    });
  }

  if (to === "signed") {
    await step(supabase, bookingId, "deposit_email", async () => {
      const r = await sendSignedEmail(supabase, b, opts.contractUrl);
      return `Deposit instructions ${emailNote(r.status, r.reason)}`;
    });
  }

  if (to === "cancelled") {
    await supabase.from("contracts").update({ status: "void" }).eq("booking_id", bookingId).eq("status", "sent");
    const rules = await getRules(supabase);
    await sendTemplateEmail(supabase, { key: "booking_cancelled", to: b.client?.email, bookingId, dedupeKey: `cancelled:${bookingId}`, fields: bookingFields(b, rules) });
  }
}

/** Receipt email + auto-advance when a payment is verified. */
export async function onPaymentVerified(supabase: SupabaseClient, paymentId: string) {
  const { data: p } = await supabase.from("payments").select("booking_id, amount").eq("id", paymentId).single();
  const b = await getBooking(supabase, p!.booking_id);
  if (!b) return;
  const rules = await getRules(supabase);

  await step(supabase, b.id, "receipt", async () => {
    const r = await sendTemplateEmail(supabase, {
      key: "payment_receipt", to: b.client?.email, bookingId: b.id, dedupeKey: `receipt:${paymentId}`,
      portal: { bookingId: b.id, eventDate: b.event_date },
      fields: { ...bookingFields(b, rules), payment_amount: php(p!.amount), paid: php(b.fin.paid), balance: php(b.fin.balance) },
    });
    return `Receipt ${emailNote(r.status, r.reason)}`;
  });

  // Advance the pipeline: fully paid, or deposit covered.
  const next: BookingStatus | null =
    b.fin.balance <= 0 && b.rate > 0 && b.status !== "done" && b.status !== "fully_paid" ? "fully_paid"
    : b.fin.paid >= b.deposit_amount && ["inquiry", "on_hold", "contract_sent", "signed"].includes(b.status) ? "deposit_paid"
    : null;
  if (next) await transitionBooking(supabase, b.id, next, { actor: "system", force: true });
}

function emailNote(status: string, reason?: string) {
  return status === "sent" ? "emailed to client"
    : status === "simulated" ? "saved to Outbox (email not configured)"
    : status === "duplicate" ? "already sent"
    : `not emailed: ${reason ?? status}`;
}

async function step(supabase: SupabaseClient, bookingId: string, name: string, fn: () => Promise<string>) {
  try {
    const summary = await fn();
    await logActivity(supabase, { actor: "system", entity_type: "booking", entity_id: bookingId, action: `automation.${name}`, summary });
  } catch (e) {
    await logActivity(supabase, { actor: "system", entity_type: "booking", entity_id: bookingId, action: `automation.${name}.failed`, summary: `${name} failed: ${(e as Error).message}` });
  }
}

/** Keep Google Calendar in step after details change (date, time, venue). */
export async function resyncCalendar(supabase: SupabaseClient, bookingId: string) {
  const b = await getBooking(supabase, bookingId);
  if (!b) return;
  await step(supabase, bookingId, "calendar", async () => {
    const r = await syncBookingEvent(supabase, b);
    return r.ok ? `Google Calendar: ${r.action}${r.reason ? ` (${r.reason})` : ""}` : `Google Calendar error: ${r.error}`;
  });
}
