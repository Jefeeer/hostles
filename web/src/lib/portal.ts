import "server-only";
import { addDays, max } from "date-fns";
import type { SupabaseClient } from "@supabase/supabase-js";
import { randomToken, sha256 } from "./crypto";
import { getBooking } from "./data";
import { parseDay } from "./format";
import { appUrl } from "./settings";

/**
 * A fresh client-portal link for a booking (one per email; only the hash is stored).
 * Valid until 60 days after the event, and at least 30 days from now.
 */
export async function mintPortalUrl(supabase: SupabaseClient, bookingId: string, eventDate: string) {
  const token = randomToken();
  const expires = max([addDays(parseDay(eventDate), 60), addDays(new Date(), 30)]);
  const { error } = await supabase.from("booking_links").insert({ booking_id: bookingId, token_hash: sha256(token), expires_at: expires.toISOString() });
  if (error) throw error;
  return `${appUrl()}/p/${token}`;
}

export async function findBookingByPortalToken(supabase: SupabaseClient, token: string) {
  if (!/^[A-Za-z0-9_-]{30,60}$/.test(token)) return null;
  const { data: link } = await supabase.from("booking_links").select("id, booking_id, expires_at").eq("token_hash", sha256(token)).maybeSingle();
  if (!link || new Date(link.expires_at) < new Date()) return null;
  const booking = await getBooking(supabase, link.booking_id);
  if (!booking) return null;
  await supabase.from("booking_links").update({ last_used_at: new Date().toISOString() }).eq("id", link.id);
  return booking;
}
