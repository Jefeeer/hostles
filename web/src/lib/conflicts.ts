import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { googleBusyOn, type BusyItem } from "./google";
import { getRules, type Rules } from "./settings";
import type { BookingStatus, EventType } from "./types";

/** Statuses that hold the date. Inquiries are shown as a heads-up but don't block. */
export const BLOCKING: BookingStatus[] = ["on_hold", "contract_sent", "signed", "deposit_paid", "fully_paid"];

export type ConflictInput = {
  event_date: string;
  start_time?: string | null;
  end_time?: string | null;
  event_type: EventType;
  excludeId?: string;
  excludeGoogleEventId?: string | null;
};

export type ConflictReport = {
  /** Hard conflicts: saving/confirming should be refused unless overridden. */
  blocking: string[];
  /** Heads-ups: other inquiries that day, Google events, etc. */
  warnings: string[];
  sameDay: { id: string; title: string; status: BookingStatus; start_time: string | null; end_time: string | null }[];
  google: BusyItem[] | null; // null = Google not connected
};

const toMin = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};

/** Minutes between two time ranges (negative = overlap). Overnight ends are pushed past midnight. */
function gap(a: [string, string | null], b: [string, string | null]) {
  const span = ([s, e]: [string, string | null]): [number, number] => {
    const start = toMin(s);
    let end = e ? toMin(e) : start + 4 * 60; // assume 4 hrs when no end time
    if (end <= start) end += 24 * 60;
    return [start, end];
  };
  const [as, ae] = span(a);
  const [bs, be] = span(b);
  return Math.max(bs - ae, as - be);
}

/** Double-booking check against the database and (if connected) Google Calendar. */
export async function checkConflicts(supabase: SupabaseClient, input: ConflictInput, rules?: Rules): Promise<ConflictReport> {
  const r = rules ?? (await getRules(supabase));
  const report: ConflictReport = { blocking: [], warnings: [], sameDay: [], google: null };

  // VO projects are done from the home studio; by default they never block or get blocked.
  if (input.event_type === "vo_project" && !r.vo_blocks_calendar) return report;

  let q = supabase.from("bookings").select("id, title, status, event_type, start_time, end_time").eq("event_date", input.event_date).neq("status", "cancelled");
  if (input.excludeId) q = q.neq("id", input.excludeId);
  const { data } = await q;
  const others = (data ?? []).filter((o) => r.vo_blocks_calendar || o.event_type !== "vo_project");
  report.sameDay = others;

  const holding = others.filter((o) => BLOCKING.includes(o.status as BookingStatus) || o.status === "done");
  if (holding.length >= r.max_events_per_day) {
    report.blocking.push(`Already ${holding.length} booking${holding.length > 1 ? "s" : ""} that day (limit ${r.max_events_per_day}).`);
  }
  for (const o of holding) {
    if (input.start_time && o.start_time) {
      const g = gap([input.start_time, input.end_time ?? null], [o.start_time, o.end_time]);
      if (g < r.buffer_hours * 60) {
        report.blocking.push(g < 0
          ? `Overlaps with "${o.title}".`
          : `Only ${Math.round(g / 6) / 10} hrs from "${o.title}" (need ${r.buffer_hours}).`);
      }
    } else if (!report.blocking.length) {
      report.warnings.push(`"${o.title}" is the same day. Add times to check the ${r.buffer_hours}-hour buffer.`);
    }
  }
  for (const o of others.filter((o) => o.status === "inquiry")) report.warnings.push(`Inquiry the same day: "${o.title}".`);

  report.google = await googleBusyOn(supabase, input.event_date, input.excludeGoogleEventId);
  for (const ev of report.google ?? []) {
    // Skip events this app created for other bookings (already counted above).
    if (others.some((o) => ev.summary.endsWith(o.title ?? "\u0000"))) continue;
    report.warnings.push(`Google Calendar: "${ev.summary}"${ev.allDay ? " (all day)" : ` ${ev.start.slice(11, 16)}–${ev.end.slice(11, 16)}`}.`);
  }
  return report;
}
