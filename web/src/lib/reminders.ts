import "server-only";
import { addDays, differenceInCalendarDays, endOfMonth, format, subDays } from "date-fns";
import type { SupabaseClient } from "@supabase/supabase-js";
import { logActivity } from "./activity";
import { transitionBooking } from "./automations";
import { listBookings } from "./data";
import { sendTemplateEmail } from "./email";
import { fmtDate, fmtTimeRange, parseDay, php, todayISO } from "./format";
import { bookingFields } from "./merge";
import { appUrl, getEmailSettings, getPaymentInstructions, getRules, type Rules } from "./settings";
import { getSetting } from "./data";
import { syncMonthToSheet } from "./sheets";
import type { BookingRow } from "./types";

type Rule = { key: string; name: string; template_key: string | null; offset_days: number; enabled: boolean };
export type JobReport = { date: string; sent: string[]; skipped: string[]; actions: string[] };

const iso = (d: Date) => format(d, "yyyy-MM-dd");

/**
 * The daily job (Vercel Cron 08:00 Manila, or Settings → Run now).
 * Windows instead of exact days, so a missed run still catches up; dedupe keys
 * guarantee each reminder goes out once.
 */
export async function runDailyJobs(supabase: SupabaseClient, today = todayISO()): Promise<JobReport> {
  const report: JobReport = { date: today, sent: [], skipped: [], actions: [] };
  const [rules, { data: ruleRows }, payInstr, reviewLink] = await Promise.all([
    getRules(supabase),
    supabase.from("reminder_rules").select("*"),
    getPaymentInstructions(supabase),
    getSetting<string>(supabase, "review_link", ""),
  ]);
  const rule = (k: string) => ((ruleRows ?? []) as Rule[]).find((r) => r.key === k && r.enabled);
  const t = parseDay(today);

  const active = await listBookings(supabase, {
    from: iso(subDays(t, 14)),
    statuses: ["on_hold", "contract_sent", "signed", "deposit_paid", "fully_paid", "done"],
  });

  const send = async (r: Rule, b: BookingRow, dedupe: string, extra: Record<string, string> = {}) => {
    if (!r.template_key) return;
    const res = await sendTemplateEmail(supabase, {
      key: r.template_key, to: b.client?.email, bookingId: b.id, actor: "cron", dedupeKey: dedupe,
      fields: { ...bookingFields(b, rules), payment_instructions: payInstr, review_link: reviewLink, ...extra },
      portal: { bookingId: b.id, eventDate: b.event_date },
    });
    const label = `${r.name}: ${b.title ?? b.ref}`;
    if (res.status === "sent" || res.status === "simulated") report.sent.push(label);
    else if (res.status !== "duplicate") report.skipped.push(`${label} (${res.reason ?? res.status})`);
  };

  // 1) Balance reminders: window before the due date, and on/after it until the event.
  for (const b of active.filter((b) => ["signed", "deposit_paid"].includes(b.status) && b.fin.balance > 0 && b.event_date >= today)) {
    const due = subDays(parseDay(b.event_date), rules.balance_due_days_before);
    const daysToDue = differenceInCalendarDays(due, t);
    const soon = rule("balance_due_soon");
    if (soon && daysToDue > 0 && daysToDue <= soon.offset_days) await send(soon, b, `reminder:balance_soon:${b.id}:${iso(due)}`);
    const onDay = rule("balance_due_today");
    if (onDay && daysToDue <= -onDay.offset_days && daysToDue <= 0) await send(onDay, b, `reminder:balance_due:${b.id}:${iso(due)}`);
  }

  // 2) Program & timeline request, N days before.
  const program = rule("program_request");
  if (program) {
    for (const b of active.filter((b) => ["signed", "deposit_paid", "fully_paid"].includes(b.status) && b.event_type !== "vo_project")) {
      const days = differenceInCalendarDays(parseDay(b.event_date), t);
      if (days >= 0 && days <= program.offset_days) await send(program, b, `reminder:program:${b.id}`);
    }
  }

  // 3) After the event: fully paid → Done; thank-you + review request.
  for (const b of active.filter((b) => b.event_date < today && b.status === "fully_paid")) {
    await transitionBooking(supabase, b.id, "done", { actor: "cron", force: true });
    report.actions.push(`Marked done: ${b.title ?? b.ref}`);
  }
  const thanks = rule("thank_you");
  if (thanks) {
    // Only once paid in full: no "please review me" while a balance is still owed.
    for (const b of active.filter((b) => ["fully_paid", "done"].includes(b.status) && b.fin.balance <= 0)) {
      const since = differenceInCalendarDays(t, parseDay(b.event_date));
      if (since >= thanks.offset_days && since <= thanks.offset_days + 6) await send(thanks, b, `reminder:thanks:${b.id}`);
    }
  }

  // 4) Holds: auto-release expired ones if the rule says so; otherwise they go in the digest.
  const holdRule = rule("hold_expiring");
  const holds = active.filter((b) => b.status === "on_hold" && b.hold_expires_at);
  const expiring = holds.filter((b) => new Date(b.hold_expires_at!).getTime() < addDays(new Date(), holdRule?.offset_days ?? 1).getTime());
  if (rules.hold_auto_release) {
    for (const b of expiring.filter((b) => new Date(b.hold_expires_at!) < new Date())) {
      await transitionBooking(supabase, b.id, "inquiry", { actor: "cron", reason: "Hold expired" });
      report.actions.push(`Released expired hold: ${b.title ?? b.ref}`);
    }
  }

  // 5) Google Sheet mirror: this month and next.
  for (const d of [t, addDays(endOfMonth(t), 1)]) {
    const r = await syncMonthToSheet(supabase, d.getFullYear(), d.getMonth() + 1);
    if (r.ok && r.action === "synced") report.actions.push(`Google Sheet: ${r.tab} updated`);
    else if (!r.ok) report.skipped.push(`Google Sheet (${r.error})`);
  }

  // 6) Morning digest to Lester.
  const digest = rule("admin_digest");
  if (digest) await sendDigest(supabase, today, rules, active, holdRule ? expiring : [], report);

  await logActivity(supabase, {
    actor: "cron", entity_type: "system", action: "cron.daily",
    summary: `Daily job: ${report.sent.length} sent, ${report.actions.length} actions, ${report.skipped.length} skipped`,
    details: report,
  });
  return report;
}

async function sendDigest(supabase: SupabaseClient, today: string, rules: Rules, active: BookingRow[], expiring: BookingRow[], report: JobReport) {
  const t = parseDay(today);
  const tomorrow = iso(addDays(t, 1));
  const line = (b: BookingRow) => `- ${b.title ?? b.ref}${b.start_time ? `, ${fmtTimeRange(b.start_time, b.end_time)}` : ""}${b.venue ? ` @ ${b.venue}` : ""}${b.fin.balance > 0 ? ` (balance ${php(b.fin.balance)})` : ""}`;

  const todays = active.filter((b) => b.event_date === today);
  const tomorrows = active.filter((b) => b.event_date === tomorrow);
  const overdue = active.filter((b) => ["signed", "deposit_paid", "done"].includes(b.status) && b.fin.balance > 0
    && iso(subDays(parseDay(b.event_date), rules.balance_due_days_before)) < today);
  const { data: toVerify } = await supabase.from("payments").select("id").is("verified_at", null);

  const sections: string[] = [];
  if (todays.length) sections.push(`TODAY\n${todays.map(line).join("\n")}`);
  if (tomorrows.length) sections.push(`TOMORROW\n${tomorrows.map(line).join("\n")}`);
  if (expiring.length) sections.push(`HOLDS EXPIRING\n${expiring.map((b) => `- ${b.title ?? b.ref} (${fmtDate(b.event_date, "MMM d")}), hold ends ${format(new Date(b.hold_expires_at!), "MMM d")}`).join("\n")}`);
  if (toVerify?.length) sections.push(`PAYMENTS TO VERIFY\n- ${toVerify.length} waiting`);
  if (overdue.length) sections.push(`BALANCES PAST DUE\n${overdue.map(line).join("\n")}`);
  if (report.sent.length) sections.push(`SENT THIS MORNING\n${report.sent.map((s) => `- ${s}`).join("\n")}`);
  if (!sections.length) return;

  const { notify_email } = await getEmailSettings(supabase);
  const title = [todays.length && `${todays.length} event${todays.length > 1 ? "s" : ""}`, expiring.length && `${expiring.length} hold${expiring.length > 1 ? "s" : ""} expiring`, toVerify?.length && `${toVerify.length} to verify`]
    .filter(Boolean).join(" · ") || "your summary";
  const res = await sendTemplateEmail(supabase, {
    key: "admin_digest", to: notify_email, actor: "cron", dedupeKey: `digest:${today}`,
    fields: { digest_title: title, digest_body: sections.join("\n\n"), app_url: appUrl() },
  });
  if (res.status === "sent" || res.status === "simulated") report.sent.push(`Daily digest → ${notify_email}`);
}
