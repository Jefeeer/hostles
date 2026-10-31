"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { logActivity } from "@/lib/activity";
import { requireAdmin } from "@/lib/data";
import { SHEET_FIELDS } from "@/lib/sheet";
import { EVENT_TYPES } from "@/lib/types";
import type { FormState } from "../bookings/actions";

const columnsSchema = z.array(
  z.object({
    key: z.string().refine((k) => k in SHEET_FIELDS, "Unknown column"),
    label: z.string().trim().min(1).max(40),
    visible: z.boolean(),
  }),
);

export async function saveSheetColumns(columns: unknown) {
  const parsed = columnsSchema.parse(columns);
  const supabase = await requireAdmin();
  const { error } = await supabase.from("settings").upsert({ key: "sheet_columns", value: parsed });
  if (error) throw error;
  await logActivity(supabase, { entity_type: "settings", action: "settings.sheet_columns", summary: "Monthly sheet columns updated" });
  revalidatePath("/", "layout");
}

const blank = (v: unknown) => (v === "" ? null : v);
const packageSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  event_type: z.preprocess(blank, z.enum(EVENT_TYPES).nullable()),
  description: z.preprocess(blank, z.string().trim().max(1000).nullable()),
  inclusions: z.preprocess((v) => String(v ?? "").split("\n").map((s) => s.trim()).filter(Boolean), z.array(z.string().max(200))),
  rate: z.preprocess((v) => Number(String(v).replace(/[₱,\s]/g, "")), z.number().min(0)),
  hours: z.preprocess((v) => (blank(v) === null ? null : Number(v)), z.number().min(0).max(24).nullable()),
  is_active: z.preprocess((v) => v === "on", z.boolean()),
  is_public: z.preprocess((v) => v === "on", z.boolean()),
});

export async function savePackage(id: string | null, _prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = packageSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: z.flattenError(parsed.error).fieldErrors };
  const supabase = await requireAdmin();
  const { error } = id
    ? await supabase.from("packages").update(parsed.data).eq("id", id)
    : await supabase.from("packages").insert({ ...parsed.data, sort_order: 100 });
  if (error) return { error: error.message };
  await logActivity(supabase, { entity_type: "package", entity_id: id, action: id ? "package.updated" : "package.created", summary: `Package "${parsed.data.name}" saved` });
  revalidatePath("/", "layout");
  return {};
}

// ─── Phase 2 settings ───────────────────────────────────────────────────────

const num = (min: number, max: number) => z.preprocess((v) => Number(v), z.number().min(min).max(max));
const bool = z.preprocess((v) => v === "on", z.boolean());

const rulesSchema = z.object({
  deposit_percent: num(0, 100),
  deposit_due_days: num(0, 90),
  balance_due_days_before: num(0, 120),
  hold_days: num(1, 60),
  hold_auto_release: bool,
  max_events_per_day: num(1, 5),
  buffer_hours: num(0, 12),
  vo_blocks_calendar: bool,
  contract_link_days: num(1, 90),
  confirmed: bool,
});

async function saveSetting(key: string, value: unknown, summary: string) {
  const supabase = await requireAdmin();
  const { error } = await supabase.from("settings").upsert({ key, value });
  if (error) return { error: error.message };
  await logActivity(supabase, { entity_type: "settings", action: `settings.${key}`, summary });
  revalidatePath("/", "layout");
  return {};
}

export async function saveRules(_prev: FormState, fd: FormData): Promise<FormState> {
  const parsed = rulesSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { fieldErrors: z.flattenError(parsed.error).fieldErrors };
  return saveSetting("rules", parsed.data, "Business rules updated");
}

const emailSchema = z.object({
  from: z.string().trim().min(3).max(200),
  reply_to: z.preprocess((v) => (v === "" ? null : v), z.email().nullable()),
  notify_email: z.email("Enter a valid email"),
  signature: z.string().trim().max(500),
  payment_instructions: z.string().trim().max(2000),
});

export async function saveEmailSettings(_prev: FormState, fd: FormData): Promise<FormState> {
  const parsed = emailSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { fieldErrors: z.flattenError(parsed.error).fieldErrors };
  const { payment_instructions, ...email } = parsed.data;
  const r = await saveSetting("email", email, "Email settings updated");
  if (r.error) return r;
  return saveSetting("payment_instructions", payment_instructions, "Payment instructions updated");
}

export async function saveContractTemplate(id: string, _prev: FormState, fd: FormData): Promise<FormState> {
  const name = String(fd.get("name") ?? "").trim();
  const body = String(fd.get("body") ?? "").trim();
  if (!name || body.length < 20) return { error: "Name and contract text are required." };
  const supabase = await requireAdmin();
  const { data: cur } = await supabase.from("contract_templates").select("version, body, name").eq("id", id).single();
  if (cur && cur.body === body && cur.name === name) return {};
  // New version number; already-issued contracts keep their own snapshot.
  const { error } = await supabase.from("contract_templates").update({ name, body, version: (cur?.version ?? 0) + 1 }).eq("id", id);
  if (error) return { error: error.message };
  await logActivity(supabase, { entity_type: "settings", action: "settings.contract_template", summary: `Contract template updated to v${(cur?.version ?? 0) + 1}` });
  revalidatePath("/", "layout");
  return {};
}

export async function saveEmailTemplate(key: string, _prev: FormState, fd: FormData): Promise<FormState> {
  const subject = String(fd.get("subject") ?? "").trim();
  const body = String(fd.get("body") ?? "").trim();
  if (!subject || !body) return { error: "Subject and message are required." };
  const supabase = await requireAdmin();
  const { error } = await supabase.from("email_templates").update({ subject, body, enabled: fd.get("enabled") === "on" }).eq("key", key);
  if (error) return { error: error.message };
  await logActivity(supabase, { entity_type: "settings", action: "settings.email_template", summary: `Email template "${key}" updated` });
  revalidatePath("/", "layout");
  return {};
}

export async function disconnectGoogle() {
  const supabase = await requireAdmin();
  await supabase.from("google_integrations").delete().eq("id", 1);
  await logActivity(supabase, { entity_type: "settings", action: "google.disconnected", summary: "Google Calendar disconnected" });
  revalidatePath("/", "layout");
}

export async function saveReminderRule(key: string, _prev: FormState, fd: FormData): Promise<FormState> {
  const offset = Number(fd.get("offset_days"));
  if (!Number.isInteger(offset) || offset < 0 || offset > 60) return { error: "Days must be 0–60." };
  const supabase = await requireAdmin();
  const { error } = await supabase.from("reminder_rules").update({ offset_days: offset, enabled: fd.get("enabled") === "on" }).eq("key", key);
  if (error) return { error: error.message };
  revalidatePath("/settings");
  return {};
}

export async function saveReviewLink(_prev: FormState, fd: FormData): Promise<FormState> {
  const url = String(fd.get("review_link") ?? "").trim();
  if (url && !/^https?:\/\//.test(url)) return { error: "Use a full link starting with https://" };
  return saveSetting("review_link", url, "Review link updated");
}

/** Settings → Reminders → Run now (same job Vercel Cron runs each morning). */
export async function runRemindersNow() {
  const supabase = await requireAdmin();
  const { runDailyJobs } = await import("@/lib/reminders");
  const report = await runDailyJobs(supabase);
  revalidatePath("/", "layout");
  return report;
}
