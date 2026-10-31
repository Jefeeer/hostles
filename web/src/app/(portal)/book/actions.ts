"use server";

import { format } from "date-fns";
import { headers } from "next/headers";
import { z } from "zod";
import { logActivity } from "@/lib/activity";
import { ConflictError, transitionBooking } from "@/lib/automations";
import { getBooking } from "@/lib/data";
import { sendTemplateEmail } from "@/lib/email";
import { todayISO } from "@/lib/format";
import { bookingFields } from "@/lib/merge";
import { appUrl, getEmailSettings, getRules } from "@/lib/settings";
import { createServiceClient } from "@/lib/supabase/server";
import { EVENT_TYPES, type EventType } from "@/lib/types";

const opt = z.string().trim().max(200).optional().transform((v) => v || null);

// The website form sends Lester's own labels ("Corporate event", "Voice-over"...); map them onto booking types.
const EVENT_WORDS: [RegExp, EventType][] = [[/wedding/i, "wedding"], [/debut/i, "debut"], [/birthday/i, "birthday"], [/corporate/i, "corporate"], [/voice|vo\b/i, "vo_project"]];
const toEventType = (v: unknown) =>
  (EVENT_TYPES as readonly unknown[]).includes(v) ? v : EVENT_WORDS.find(([re]) => re.test(String(v ?? "")))?.[1] ?? "other";

const schema = z.object({
  full_name: z.string().trim().min(2, "Please enter your name").max(120),
  partner_name: opt,
  email: z.email("Please enter a valid email").max(160),
  // Optional: the website's short form doesn't ask for it; /book still does.
  phone: z.string().trim().max(40).optional().transform((v) => v || null)
    .refine((v) => !v || v.length >= 7, "Please enter your mobile number"),
  event_type: z.preprocess(toEventType, z.enum(EVENT_TYPES)),
  event_date: z.iso.date("Please pick a date"),
  start_time: z.string().regex(/^\d{2}:\d{2}$/).optional().or(z.literal("")).transform((v) => v || null),
  venue: opt,
  package_id: z.uuid().optional().or(z.literal("")).transform((v) => v || null),
  guest_count: z.preprocess((v) => (v === "" || v == null ? null : Number(v)), z.number().int().min(1).max(5000).nullable()),
  message: z.string().trim().max(2000).optional().transform((v) => v || null),
});

export type InquiryState = { error?: string; ok?: boolean; held?: boolean } | undefined;

export async function submitInquiry(_prev: InquiryState, fd: FormData): Promise<InquiryState> {
  // Bot traps: a hidden field humans never fill, and a minimum time on the page.
  if (fd.get("website") || Date.now() - Number(fd.get("t") ?? 0) < 3000) return { ok: true };

  const parsed = schema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Please check the form." };
  const v = parsed.data;
  if (v.event_date <= todayISO()) return { error: "Please pick a future date." };
  // Keep the visitor's own wording when it didn't map to a specific type (e.g. "Private celebration").
  const label = String(fd.get("event_type") ?? "").trim().slice(0, 80);
  if (v.event_type === "other" && label && label.toLowerCase() !== "other") v.message = [`Event: ${label}`, v.message].filter(Boolean).join("\n");

  const supabase = await createServiceClient();

  // Flood guard: cap public inquiries per hour across the whole site.
  const { data: recent } = await supabase.from("activity_log").select("id").eq("action", "booking.public_inquiry").gte("at", new Date(Date.now() - 3600_000).toISOString());
  if ((recent?.length ?? 0) >= 20) return { error: "Lots of inquiries right now. Please try again in an hour, or message Lester on Facebook." };

  const { data: busy } = await supabase.rpc("public_busy_dates", { p_from: v.event_date, p_to: v.event_date });
  if ((busy as string[] | null)?.length) return { error: "Sorry, that date is already fully booked. Please pick another date." };

  // Reuse the client record if this email has booked before.
  const { data: existing } = await supabase.from("clients").select("id").eq("email", v.email.toLowerCase()).limit(1).maybeSingle();
  let clientId = existing?.id as string | undefined;
  if (!clientId) {
    const { data: c, error } = await supabase.from("clients")
      .insert({ full_name: v.full_name, partner_name: v.partner_name, email: v.email.toLowerCase(), phone: v.phone })
      .select("id").single();
    if (error) return { error: "Something went wrong. Please try again." };
    clientId = c.id;
  }

  const rules = await getRules(supabase);
  const { data: pkg } = v.package_id
    ? await supabase.from("packages").select("rate").eq("id", v.package_id).eq("is_public", true).eq("is_active", true).maybeSingle()
    : { data: null };
  const rate = Number(pkg?.rate ?? 0);
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim();
  const { data: booking, error } = await supabase.from("bookings").insert({
    client_id: clientId, event_type: v.event_type, event_date: v.event_date, start_time: v.start_time, venue: v.venue,
    package_id: pkg ? v.package_id : null, rate, deposit_amount: Math.round((rate * rules.deposit_percent) / 100),
    guest_count: v.guest_count, notes: v.message, source: "public_form",
  }).select("id").single();
  if (error) return { error: "Something went wrong. Please try again." };

  await logActivity(supabase, {
    actor: "client", entity_type: "booking", entity_id: booking.id, action: "booking.public_inquiry",
    summary: `New inquiry from the booking page: ${v.full_name}`, details: { ip },
  });

  // Hold the date if it's clear; otherwise leave it as an inquiry for Lester to sort out.
  let held = true;
  try {
    await transitionBooking(supabase, booking.id, "on_hold", { actor: "client", reason: "Booking page inquiry" });
  } catch (e) {
    if (!(e instanceof ConflictError)) throw e;
    held = false;
  }

  const b = (await getBooking(supabase, booking.id))!;
  const fields = {
    ...bookingFields(b, rules),
    booking_url: `${appUrl()}/bookings/${b.id}`,
    hold_line: held && b.hold_expires_at ? ` and I'm holding the date for you until ${format(new Date(b.hold_expires_at), "MMMM d")}` : "",
  };
  const { notify_email } = await getEmailSettings(supabase);
  await sendTemplateEmail(supabase, { key: "new_inquiry_admin", to: notify_email, bookingId: b.id, dedupeKey: `new_inquiry_admin:${b.id}`, fields, actor: "client" });
  await sendTemplateEmail(supabase, { key: "inquiry_autoreply", to: v.email, bookingId: b.id, dedupeKey: `inquiry_autoreply:${b.id}`, fields, actor: "client" });
  return { ok: true, held };
}
