import "server-only";
import { google, type calendar_v3 } from "googleapis";
import type { SupabaseClient } from "@supabase/supabase-js";
import { decrypt } from "./crypto";
import { appUrl } from "./settings";
import { TZ } from "./format";
import type { BookingRow, BookingStatus } from "./types";

export const GOOGLE_SCOPES = [
  "openid",
  "email",
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar.readonly",
  // Sheets mirror: only files this app creates, never his other Drive files.
  "https://www.googleapis.com/auth/drive.file",
];
export const SHEETS_SCOPE = "https://www.googleapis.com/auth/drive.file";

export const googleConfigured = () =>
  !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.GOOGLE_TOKEN_KEY);

export function oauthClient() {
  return new google.auth.OAuth2(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET, `${appUrl()}/google/callback`);
}

/** OAuth client for the connected account, or null when not connected/configured. */
export async function googleAuth(supabase: SupabaseClient) {
  if (!googleConfigured()) return null;
  const { data } = await supabase.from("google_integrations").select("refresh_token_enc, calendar_id, scopes, sheet_id").eq("id", 1).maybeSingle();
  if (!data) return null;
  const auth = oauthClient();
  auth.setCredentials({ refresh_token: decrypt(data.refresh_token_enc) });
  return { auth, row: data as { calendar_id: string; scopes: string | null; sheet_id: string | null } };
}

async function calendar(supabase: SupabaseClient): Promise<{ cal: calendar_v3.Calendar; calendarId: string } | null> {
  const g = await googleAuth(supabase);
  return g && { cal: google.calendar({ version: "v3", auth: g.auth }), calendarId: g.row.calendar_id };
}

const TENTATIVE: BookingStatus[] = ["inquiry", "on_hold", "contract_sent"];

function eventBody(b: BookingRow): calendar_v3.Schema$Event {
  const tentative = TENTATIVE.includes(b.status);
  const timed = !!b.start_time;
  const endTime = b.end_time ?? b.start_time;
  // Overnight events (e.g. 5 PM – 1 AM) end the next day.
  const endDate = timed && endTime! <= b.start_time! && b.end_time
    ? new Date(new Date(`${b.event_date}T00:00:00Z`).getTime() + 86_400_000).toISOString().slice(0, 10)
    : b.event_date;
  return {
    summary: `${tentative ? "[HOLD] " : ""}${b.title ?? b.client?.full_name ?? b.ref}`,
    location: b.venue ?? undefined,
    description: [`${b.ref} · ${b.status.replace("_", " ")}`, b.client?.phone && `Client: ${b.client.full_name} ${b.client.phone}`, `${appUrl()}/bookings/${b.id}`]
      .filter(Boolean).join("\n"),
    status: tentative ? "tentative" : "confirmed",
    colorId: tentative ? "5" : "6", // banana for holds, tangerine for confirmed
    start: timed ? { dateTime: `${b.event_date}T${b.start_time}`, timeZone: TZ } : { date: b.event_date },
    end: timed ? { dateTime: `${endDate}T${endTime}`, timeZone: TZ } : { date: b.event_date },
    extendedProperties: { private: { hostLesterBookingId: b.id } },
  };
}

export type SyncResult = { ok: true; action: "created" | "updated" | "deleted" | "skipped"; reason?: string } | { ok: false; error: string };

/** Create/update/delete the booking's Google Calendar event to match its status. Never throws. */
export async function syncBookingEvent(supabase: SupabaseClient, b: BookingRow): Promise<SyncResult> {
  try {
    const c = await calendar(supabase);
    if (!c) return { ok: true, action: "skipped", reason: googleConfigured() ? "Google Calendar not connected" : "Google not configured" };

    const remove = b.status === "cancelled" || (b.event_type === "vo_project" && !b.start_time);
    if (remove) {
      if (b.google_event_id) {
        await c.cal.events.delete({ calendarId: c.calendarId, eventId: b.google_event_id }).catch((e) => {
          if (e?.code !== 404 && e?.code !== 410) throw e;
        });
        await supabase.from("bookings").update({ google_event_id: null, google_synced_at: new Date().toISOString() }).eq("id", b.id);
        return { ok: true, action: "deleted" };
      }
      return { ok: true, action: "skipped", reason: "nothing to remove" };
    }

    const body = eventBody(b);
    let id = b.google_event_id;
    if (id) {
      try {
        await c.cal.events.update({ calendarId: c.calendarId, eventId: id, requestBody: body });
      } catch (e) {
        if ((e as { code?: number })?.code !== 404 && (e as { code?: number })?.code !== 410) throw e;
        id = null; // deleted in Google: recreate below
      }
    }
    const action = id ? "updated" : "created";
    if (!id) {
      const res = await c.cal.events.insert({ calendarId: c.calendarId, requestBody: body });
      id = res.data.id!;
    }
    await supabase.from("bookings").update({ google_event_id: id, google_synced_at: new Date().toISOString() }).eq("id", b.id);
    return { ok: true, action };
  } catch (e) {
    const error = (e as Error).message ?? String(e);
    await supabase.from("google_integrations").update({ last_error: error }).eq("id", 1);
    return { ok: false, error };
  }
}

export type BusyItem = { summary: string; start: string; end: string; allDay: boolean };

/** Other events on his Google Calendar that day (excluding this app's own event for the booking). */
export async function googleBusyOn(supabase: SupabaseClient, date: string, excludeEventId?: string | null): Promise<BusyItem[] | null> {
  try {
    const c = await calendar(supabase);
    if (!c) return null;
    const res = await c.cal.events.list({
      calendarId: c.calendarId,
      timeMin: `${date}T00:00:00+08:00`,
      timeMax: `${date}T23:59:59+08:00`,
      singleEvents: true,
      orderBy: "startTime",
      timeZone: TZ,
    });
    return (res.data.items ?? [])
      .filter((e) => e.id !== excludeEventId && e.status !== "cancelled" && e.transparency !== "transparent")
      .map((e) => ({
        summary: e.summary ?? "(busy)",
        start: e.start?.dateTime ?? e.start?.date ?? "",
        end: e.end?.dateTime ?? e.end?.date ?? "",
        allDay: !e.start?.dateTime,
      }));
  } catch {
    return null;
  }
}
