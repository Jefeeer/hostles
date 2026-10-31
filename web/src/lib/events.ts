import "server-only";
import { addYears, format } from "date-fns";
import type { SupabaseClient } from "@supabase/supabase-js";
import { logActivity } from "./activity";
import { parseDay } from "./format";
import type { BookingFinancials, EventType } from "./types";

export type FieldDef = { key: string; label: string; type: "text" | "number" | "date" | "select"; options?: string[] };
export type Edition = {
  id: string; series_id: string; name: string; event_date: string; start_time: string | null; end_time: string | null;
  venue: string | null; event_type: EventType; status: "planning" | "open" | "done" | "cancelled";
  fee_mode: "flat" | "per_entry"; flat_fee: number; per_entry_fee: number; flat_paid: number;
  fields: FieldDef[]; notes: string | null; created_at: string;
};
export type Entry = {
  id: string; edition_id: string; name: string; contact: string | null; email: string | null;
  data: Record<string, string>; fee: number | null; paid: number; booking_id: string | null; created_at: string;
};

const FIELD_TYPES = ["text", "number", "date", "select"] as const;

/** One field per line: `Label | type | option 1, option 2` (type defaults to text). */
export function parseFieldDefs(src: string): FieldDef[] {
  const seen = new Set<string>();
  return src.split("\n").map((l) => l.trim()).filter(Boolean).map((line) => {
    const [label, rawType = "text", opts = ""] = line.split("|").map((s) => s.trim());
    const type = (FIELD_TYPES as readonly string[]).includes(rawType.toLowerCase()) ? (rawType.toLowerCase() as FieldDef["type"]) : "text";
    let key = label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 40) || "field";
    while (seen.has(key)) key += "_";
    seen.add(key);
    const options = type === "select" ? opts.split(",").map((o) => o.trim()).filter(Boolean) : undefined;
    return { key, label: label.slice(0, 60), type, ...(options ? { options } : {}) };
  });
}
export const fieldDefsToText = (fields: FieldDef[]) =>
  fields.map((f) => [f.label, f.type, f.options?.join(", ")].filter((x, i) => i < 2 || x).join(" | ")).join("\n");

/**
 * Money for an edition. Flat: one fee for the whole event. Per entry: each entry's fee
 * (or the default). Converted entries count their booking's payments instead, so nothing is counted twice.
 */
export function editionTotals(e: Edition, entries: Entry[], fin: Map<string, BookingFinancials>) {
  if (e.fee_mode === "flat") return { expected: e.flat_fee, collected: e.flat_paid, entries: entries.length };
  let expected = 0, collected = 0;
  for (const x of entries) {
    expected += entryFee(e, x);
    collected += x.booking_id ? (fin.get(x.booking_id)?.paid ?? 0) : x.paid;
  }
  return { expected, collected, entries: entries.length };
}
export const entryFee = (e: Edition, x: Entry) => (e.fee_mode === "flat" ? 0 : x.fee ?? e.per_entry_fee);

/** Next year's edition with the same setup (no entries). The year in the name moves too. */
export async function duplicateEdition(supabase: SupabaseClient, id: string) {
  const { data: e, error } = await supabase.from("event_editions").select("*").eq("id", id).single<Edition>();
  if (error) throw error;
  const date = format(addYears(parseDay(e.event_date), 1), "yyyy-MM-dd");
  const year = parseDay(e.event_date).getFullYear();
  const name = e.name.includes(String(year)) ? e.name.replace(String(year), String(year + 1)) : `${e.name} (copy)`;
  const { data: copy, error: err2 } = await supabase.from("event_editions").insert({
    series_id: e.series_id, name, event_date: date, start_time: e.start_time, end_time: e.end_time, venue: e.venue,
    event_type: e.event_type, fee_mode: e.fee_mode, flat_fee: e.flat_fee, per_entry_fee: e.per_entry_fee,
    fields: e.fields, notes: e.notes, status: "planning",
  }).select("id").single();
  if (err2) throw err2;
  await logActivity(supabase, { entity_type: "edition", entity_id: copy.id, action: "edition.duplicated", summary: `${name} created from ${e.name}` });
  return copy.id as string;
}

/**
 * Turn an entry into a regular booking (client + booking, plus any amount already paid
 * as a verified payment). Idempotent: an entry that already has a booking returns it.
 */
export async function convertEntryToBooking(supabase: SupabaseClient, entryId: string): Promise<string> {
  const { data: x, error } = await supabase.from("edition_entries").select("*").eq("id", entryId).single<Entry>();
  if (error) throw error;
  if (x.booking_id) return x.booking_id;
  const { data: e } = await supabase.from("event_editions").select("*").eq("id", x.edition_id).single<Edition>();
  if (!e) throw new Error("Edition not found");

  const { data: client, error: cErr } = await supabase.from("clients")
    .insert({ full_name: x.name, phone: x.contact, email: x.email?.toLowerCase() || null, notes: `From ${e.name}` })
    .select("id").single();
  if (cErr) throw cErr;
  const rate = entryFee(e, x);
  const { data: b, error: bErr } = await supabase.from("bookings").insert({
    client_id: client.id, title: `${x.name} · ${e.name}`, event_type: e.event_type, event_date: e.event_date,
    start_time: e.start_time, end_time: e.end_time, venue: e.venue, rate, deposit_amount: 0, source: "special_event",
    notes: Object.entries(x.data).map(([k, v]) => `${e.fields.find((f) => f.key === k)?.label ?? k}: ${v}`).join("\n") || null,
  }).select("id").single();
  if (bErr) throw bErr;

  // Claim the entry; if someone converted it at the same moment, undo ours and use theirs.
  const { data: claimed } = await supabase.from("edition_entries").update({ booking_id: b.id }).eq("id", x.id).is("booking_id", null).select("id");
  if (!claimed?.length) {
    await supabase.from("bookings").delete().eq("id", b.id);
    await supabase.from("clients").delete().eq("id", client.id);
    const { data: again } = await supabase.from("edition_entries").select("booking_id").eq("id", x.id).single();
    return again!.booking_id as string;
  }
  if (x.paid > 0) {
    await supabase.from("payments").insert({
      booking_id: b.id, kind: "other", method: "other", amount: Math.min(x.paid, rate || x.paid), paid_on: format(new Date(), "yyyy-MM-dd"),
      verified_at: new Date().toISOString(), notes: `Paid on the ${e.name} list before conversion`,
    });
    await supabase.from("edition_entries").update({ paid: 0 }).eq("id", x.id);
  }
  await logActivity(supabase, {
    entity_type: "booking", entity_id: b.id, action: "edition.entry_converted",
    summary: `Created from ${e.name} entry: ${x.name}`, dedupe_key: `entry_convert:${x.id}`,
  });
  return b.id as string;
}
