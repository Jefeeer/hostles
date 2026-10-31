"use server";

import { revalidatePath } from "next/cache";
import { redirect, RedirectType } from "next/navigation";
import { z } from "zod";
import { logActivity } from "@/lib/activity";
import { requireAdmin } from "@/lib/data";
import { convertEntryToBooking, duplicateEdition, parseFieldDefs, type FieldDef } from "@/lib/events";
import { EVENT_TYPES } from "@/lib/types";
import type { FormState } from "../bookings/actions";

const blank = (v: unknown) => (v === "" ? null : v);
const text = (max = 200) => z.preprocess(blank, z.string().trim().max(max).nullable());
const money = z.preprocess((v) => (v === "" || v == null ? 0 : Number(String(v).replace(/[₱,\s]/g, ""))), z.number().min(0, "Can't be negative"));
const optMoney = z.preprocess((v) => (v === "" || v == null ? null : Number(String(v).replace(/[₱,\s]/g, ""))), z.number().min(0).nullable());
const time = z.preprocess(blank, z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/).nullable());

export async function createSeries(_prev: FormState, fd: FormData): Promise<FormState> {
  const parsed = z.object({ name: z.string().trim().min(1, "Name is required").max(120), description: text(1000) }).safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { fieldErrors: z.flattenError(parsed.error).fieldErrors };
  const supabase = await requireAdmin();
  const { data, error } = await supabase.from("event_series").insert(parsed.data).select("id").single();
  if (error) return { error: error.message };
  await logActivity(supabase, { entity_type: "series", entity_id: data.id, action: "series.created", summary: `Special event series: ${parsed.data.name}` });
  revalidatePath("/events");
  return {};
}

const editionSchema = z.object({
  series_id: z.uuid(),
  name: z.string().trim().min(1, "Name is required").max(160),
  event_date: z.iso.date("Pick a date"),
  start_time: time,
  end_time: time,
  venue: text(),
  event_type: z.enum(EVENT_TYPES),
  status: z.enum(["planning", "open", "done", "cancelled"]),
  fee_mode: z.enum(["flat", "per_entry"]),
  flat_fee: money,
  flat_paid: money,
  per_entry_fee: money,
  notes: text(2000),
});

export async function saveEdition(id: string | null, _prev: FormState, fd: FormData): Promise<FormState> {
  const parsed = editionSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { fieldErrors: z.flattenError(parsed.error).fieldErrors };
  const supabase = await requireAdmin();
  const q = id
    ? supabase.from("event_editions").update(parsed.data).eq("id", id).select("id").single()
    : supabase.from("event_editions").insert({ ...parsed.data, fields: parseFieldDefs("Name\nContact number") }).select("id").single();
  const { data, error } = await q;
  if (error) return { error: error.message };
  await logActivity(supabase, { entity_type: "edition", entity_id: data.id, action: id ? "edition.updated" : "edition.created", summary: `${parsed.data.name} ${id ? "updated" : "created"}` });
  revalidatePath("/events", "layout");
  if (!id) redirect(`/events/${data.id}`, RedirectType.replace);
  return {};
}

export async function saveFields(id: string, _prev: FormState, fd: FormData): Promise<FormState> {
  const fields = parseFieldDefs(String(fd.get("fields") ?? ""));
  if (fields.length > 30) return { error: "Up to 30 fields." };
  const supabase = await requireAdmin();
  const { error } = await supabase.from("event_editions").update({ fields }).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath(`/events/${id}`);
  return {};
}

export async function saveEntry(editionId: string, entryId: string | null, _prev: FormState, fd: FormData): Promise<FormState> {
  const parsed = z.object({
    name: z.string().trim().min(1, "Name is required").max(160),
    contact: text(60),
    email: z.preprocess(blank, z.email("Invalid email").nullable()),
    fee: optMoney,
    paid: money,
  }).safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { fieldErrors: z.flattenError(parsed.error).fieldErrors };
  const supabase = await requireAdmin();
  const { data: ed } = await supabase.from("event_editions").select("fields").eq("id", editionId).single();
  const data: Record<string, string> = {};
  for (const f of (ed?.fields ?? []) as FieldDef[]) {
    const v = String(fd.get(`f_${f.key}`) ?? "").trim().slice(0, 500);
    if (v) data[f.key] = v;
  }
  const row = { ...parsed.data, data };
  const { error } = entryId
    ? await supabase.from("edition_entries").update(row).eq("id", entryId).eq("edition_id", editionId)
    : await supabase.from("edition_entries").insert({ ...row, edition_id: editionId });
  if (error) return { error: error.message };
  revalidatePath(`/events/${editionId}`);
  return {};
}

export async function deleteEntry(editionId: string, entryId: string) {
  const supabase = await requireAdmin();
  await supabase.from("edition_entries").delete().eq("id", entryId).eq("edition_id", editionId);
  revalidatePath(`/events/${editionId}`);
}

export async function deleteEdition(id: string) {
  const supabase = await requireAdmin();
  const { data } = await supabase.from("event_editions").delete().eq("id", id).select("name");
  await logActivity(supabase, { entity_type: "edition", entity_id: id, action: "edition.deleted", summary: `${data?.[0]?.name ?? "Edition"} deleted` });
  revalidatePath("/events", "layout");
  redirect("/events");
}

export async function duplicateEditionAction(id: string) {
  const supabase = await requireAdmin();
  const copy = await duplicateEdition(supabase, id);
  revalidatePath("/events", "layout");
  redirect(`/events/${copy}`);
}

export async function convertEntry(editionId: string, entryId: string) {
  const supabase = await requireAdmin();
  const bookingId = await convertEntryToBooking(supabase, entryId);
  revalidatePath("/", "layout");
  redirect(`/bookings/${bookingId}`);
}
