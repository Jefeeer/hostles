"use server";

import { revalidatePath } from "next/cache";
import { redirect, RedirectType } from "next/navigation";
import { z } from "zod";
import { getBooking, requireAdmin } from "@/lib/data";
import { issueContract } from "@/lib/contracts";
import { mintPortalUrl } from "@/lib/portal";
import { logActivity } from "@/lib/activity";
import { ConflictError, onPaymentVerified, resyncCalendar, transitionBooking } from "@/lib/automations";
import { BLOCKING, checkConflicts, type ConflictReport } from "@/lib/conflicts";
import { BOOKING_STATUSES, EVENT_TYPES, PAYMENT_KINDS, PAYMENT_METHODS, type BookingStatus } from "@/lib/types";

export type FormState = { error?: string; fieldErrors?: Record<string, string[] | undefined>; conflicts?: string[] } | undefined;

const blank = (v: unknown) => (v === "" || v === null ? undefined : v);
const optText = z.preprocess(blank, z.string().trim().max(2000).optional());
const money = z.preprocess((v) => (blank(v) === undefined ? 0 : Number(String(v).replace(/[₱,\s]/g, ""))), z.number().min(0).max(10_000_000));
const optTime = z.preprocess(blank, z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, "Use HH:MM").optional());

const bookingSchema = z
  .object({
    client_id: z.preprocess(blank, z.uuid().optional()),
    new_client_name: optText,
    new_client_partner: optText,
    new_client_phone: optText,
    new_client_email: z.preprocess(blank, z.email("Invalid email").optional()),
    title: optText,
    event_type: z.enum(EVENT_TYPES),
    event_date: z.iso.date("Pick a date"),
    start_time: optTime,
    end_time: optTime,
    venue: optText,
    venue_address: optText,
    package_id: z.preprocess(blank, z.uuid().optional()),
    rate: money,
    deposit_amount: money,
    status: z.enum(BOOKING_STATUSES).default("inquiry"),
    hold_expires_at: z.preprocess(blank, z.iso.date().optional()),
    coordinator: optText,
    guest_count: z.preprocess((v) => (blank(v) === undefined ? undefined : Number(v)), z.number().int().min(0).optional()),
    notes: optText,
    allow_conflict: z.preprocess((v) => v === "on", z.boolean()),
  })
  .refine((d) => d.client_id || d.new_client_name, { path: ["client_id"], message: "Pick a client or add a new one" })
  .refine((d) => d.deposit_amount <= d.rate, { path: ["deposit_amount"], message: "Deposit can't exceed the rate" });

function parseBooking(formData: FormData) {
  return bookingSchema.safeParse(Object.fromEntries(formData));
}

function bookingColumns(d: z.infer<typeof bookingSchema>, clientId: string) {
  return {
    client_id: clientId,
    title: d.title ?? null,
    event_type: d.event_type,
    event_date: d.event_date,
    start_time: d.start_time ?? null,
    end_time: d.end_time ?? null,
    venue: d.venue ?? null,
    venue_address: d.venue_address ?? null,
    package_id: d.package_id ?? null,
    rate: d.rate,
    deposit_amount: d.deposit_amount,
    // Hold expiry is end of that day, Manila time.
    hold_expires_at: d.hold_expires_at ? `${d.hold_expires_at}T23:59:59+08:00` : null,
    coordinator: d.coordinator ?? null,
    guest_count: d.guest_count ?? null,
    notes: d.notes ?? null,
  };
}

function revalidateAll() {
  revalidatePath("/", "layout");
}

export async function createBooking(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = parseBooking(formData);
  if (!parsed.success) return { fieldErrors: z.flattenError(parsed.error).fieldErrors };
  const d = parsed.data;
  const supabase = await requireAdmin();

  if (BLOCKING.includes(d.status) && !d.allow_conflict) {
    const report = await checkConflicts(supabase, d);
    if (report.blocking.length) return { conflicts: report.blocking };
  }

  let clientId = d.client_id;
  if (!clientId) {
    const { data, error } = await supabase
      .from("clients")
      .insert({ full_name: d.new_client_name, partner_name: d.new_client_partner ?? null, phone: d.new_client_phone ?? null, email: d.new_client_email ?? null })
      .select("id")
      .single();
    if (error) return { error: error.message };
    clientId = data.id as string;
  }

  const { data: booking, error } = await supabase
    .from("bookings")
    .insert({ ...bookingColumns(d, clientId), status: "inquiry" })
    .select("id, ref, title")
    .single();
  if (error) return { error: error.message };

  await logActivity(supabase, {
    entity_type: "booking", entity_id: booking.id, action: "booking.created",
    summary: `${booking.ref} created: ${d.title ?? d.new_client_name ?? ""}`.trim(),
  });
  // Status goes through the pipeline so calendar/contract/email automations fire.
  if (d.status === "inquiry") await resyncCalendar(supabase, booking.id);
  else await transitionBooking(supabase, booking.id, d.status, { force: true });
  revalidateAll();
  redirect(`/bookings/${booking.id}?created=1`, RedirectType.replace);
}

export async function updateBooking(id: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = parseBooking(formData);
  if (!parsed.success) return { fieldErrors: z.flattenError(parsed.error).fieldErrors };
  const d = parsed.data;
  const supabase = await requireAdmin();

  if (BLOCKING.includes(d.status) && !d.allow_conflict) {
    const { data: cur } = await supabase.from("bookings").select("google_event_id").eq("id", id).single();
    const report = await checkConflicts(supabase, { ...d, excludeId: id, excludeGoogleEventId: cur?.google_event_id });
    if (report.blocking.length) return { conflicts: report.blocking };
  }

  const { data: cur } = await supabase.from("bookings").select("status").eq("id", id).single();
  const { error } = await supabase.from("bookings").update(bookingColumns(d, d.client_id!)).eq("id", id);
  if (error) return { error: error.message };
  // Status goes through the pipeline so automations fire; otherwise just keep the calendar in step.
  if (cur?.status !== d.status) await transitionBooking(supabase, id, d.status, { force: true });
  else await resyncCalendar(supabase, id);

  await logActivity(supabase, { entity_type: "booking", entity_id: id, action: "booking.updated", summary: "Booking details updated" });
  revalidateAll();
  redirect(`/bookings/${id}?saved=1`);
}

/** Returns an error instead of throwing: Next hides thrown messages in production. */
export async function moveBooking(id: string, to: BookingStatus, opts: { reason?: string; force?: boolean } = {}): Promise<{ ok: true } | { ok: false; conflicts?: string[]; error?: string }> {
  if (!BOOKING_STATUSES.includes(to)) return { ok: false, error: "Invalid status" };
  const supabase = await requireAdmin();
  try {
    await transitionBooking(supabase, id, to, opts);
  } catch (e) {
    if (e instanceof ConflictError) return { ok: false, conflicts: e.reasons };
    return { ok: false, error: (e as Error).message };
  }
  revalidateAll();
  return { ok: true };
}

/** Live double-booking check for the booking form. */
export async function checkBookingConflicts(input: { event_date: string; start_time?: string; end_time?: string; event_type: (typeof EVENT_TYPES)[number]; id?: string }): Promise<ConflictReport | null> {
  if (!/^d{4}-d{2}-d{2}$/.test(input.event_date) || !EVENT_TYPES.includes(input.event_type)) return null;
  const supabase = await requireAdmin();
  let excludeGoogleEventId: string | null = null;
  if (input.id) {
    const { data } = await supabase.from("bookings").select("google_event_id").eq("id", input.id).maybeSingle();
    excludeGoogleEventId = data?.google_event_id ?? null;
  }
  return checkConflicts(supabase, { ...input, start_time: input.start_time || null, end_time: input.end_time || null, excludeId: input.id, excludeGoogleEventId });
}

export async function deleteBooking(id: string) {
  const supabase = await requireAdmin();
  const { data, error } = await supabase.from("bookings").delete().eq("id", id).select("ref, title").single();
  if (error) throw error;
  await logActivity(supabase, { entity_type: "booking", entity_id: id, action: "booking.deleted", summary: `${data.ref} deleted: ${data.title ?? ""}` });
  revalidateAll();
  redirect("/bookings");
}

// ─── Payments ───────────────────────────────────────────────────────────────

const paymentSchema = z.object({
  kind: z.enum(PAYMENT_KINDS),
  method: z.enum(PAYMENT_METHODS),
  amount: money.refine((n) => n > 0, "Enter an amount"),
  paid_on: z.iso.date(),
  reference: optText,
  notes: optText,
  verified: z.preprocess((v) => v === "on", z.boolean()),
});

export async function addPayment(bookingId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = paymentSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: z.flattenError(parsed.error).fieldErrors };
  const { verified, ...p } = parsed.data;
  const supabase = await requireAdmin();
  const { data, error } = await supabase
    .from("payments")
    .insert({ ...p, booking_id: bookingId, verified_at: verified ? new Date().toISOString() : null })
    .select("id")
    .single();
  if (error) return { error: error.message };
  await logActivity(supabase, {
    entity_type: "booking", entity_id: bookingId, action: "payment.recorded",
    summary: `Payment recorded: ₱${p.amount.toLocaleString("en-PH")} (${p.kind})${verified ? ", verified" : ""}`,
    details: { payment_id: data.id },
  });
  if (verified) await onPaymentVerified(supabase, data.id);
  revalidateAll();
  return {};
}

export async function verifyPayment(paymentId: string) {
  const supabase = await requireAdmin();
  const { data, error } = await supabase
    .from("payments")
    .update({ verified_at: new Date().toISOString() })
    .eq("id", paymentId)
    .is("verified_at", null)
    .select("booking_id, amount, kind")
    .maybeSingle();
  if (error) throw error;
  if (data) {
    await logActivity(supabase, {
      entity_type: "booking", entity_id: data.booking_id, action: "payment.verified",
      summary: `Payment verified: ₱${Number(data.amount).toLocaleString("en-PH")} (${data.kind})`,
      dedupe_key: `payment.verified:${paymentId}`,
    });
    await onPaymentVerified(supabase, paymentId);
  }
  revalidateAll();
}

export async function deletePayment(paymentId: string) {
  const supabase = await requireAdmin();
  const { data, error } = await supabase.from("payments").delete().eq("id", paymentId).select("booking_id, amount").single();
  if (error) throw error;
  await logActivity(supabase, {
    entity_type: "booking", entity_id: data.booking_id, action: "payment.deleted",
    summary: `Payment removed: ₱${Number(data.amount).toLocaleString("en-PH")}`,
  });
  revalidateAll();
}

// ─── Contracts ──────────────────────────────────────────────────────────────

/** Generate (or regenerate) the contract and email the signing link. */
export async function sendContract(bookingId: string): Promise<{ ok: boolean; message: string; conflicts?: string[] }> {
  const supabase = await requireAdmin();
  const { data: b } = await supabase.from("bookings").select("status").eq("id", bookingId).single();
  try {
    if (["inquiry", "on_hold"].includes(b?.status)) {
      // Moving to Contract Sent issues the contract as part of the pipeline.
      await transitionBooking(supabase, bookingId, "contract_sent");
    } else {
      const booking = await getBooking(supabase, bookingId);
      const { email } = await issueContract(supabase, booking!, "admin");
      revalidateAll();
      return { ok: true, message: email.status === "sent" ? "New signing link emailed" : email.status === "simulated" ? "New link saved to Outbox (email not configured)" : `Contract created; email ${email.status}: ${email.reason ?? ""}` };
    }
  } catch (e) {
    if (e instanceof ConflictError) return { ok: false, message: "Date conflict", conflicts: e.reasons };
    return { ok: false, message: (e as Error).message };
  }
  revalidateAll();
  return { ok: true, message: "Contract sent" };
}

/** A fresh client-portal link to share by Messenger/SMS. */
export async function createPortalLink(bookingId: string): Promise<string> {
  const supabase = await requireAdmin();
  const { data: b } = await supabase.from("bookings").select("event_date").eq("id", bookingId).single();
  const url = await mintPortalUrl(supabase, bookingId, b!.event_date);
  await logActivity(supabase, { entity_type: "booking", entity_id: bookingId, action: "portal.link_created", summary: "Client page link created" });
  return url;
}
