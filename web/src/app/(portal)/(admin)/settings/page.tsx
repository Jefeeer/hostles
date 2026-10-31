import Link from "next/link";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { ActionForm } from "@/components/action-form";
import { PageHeader } from "@/components/bits";
import { ConfirmButton } from "@/components/confirm-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { getSetting, getSheetColumns, listPackages, requireAdmin } from "@/lib/data";
import { resendConfigured } from "@/lib/email";
import { fmtStamp } from "@/lib/format";
import { googleConfigured } from "@/lib/google";
import { MERGE_FIELDS } from "@/lib/merge";
import { getEmailSettings, getPaymentInstructions, getRules } from "@/lib/settings";
import { withAllFields } from "@/lib/sheet";
import type { EmailTemplate } from "@/lib/types";
import {
  disconnectGoogle, saveContractTemplate, saveEmailSettings, saveEmailTemplate, savePackage, saveReminderRule, saveReviewLink, saveRules,
} from "./actions";
import { RunRemindersButton } from "./run-reminders";
import { ColumnsEditor } from "./columns-editor";
import { PackageEditor } from "./package-editor";

export const metadata: Metadata = { title: "Settings" };

const GOOGLE_MSG: Record<string, string> = {
  connected: "Google Calendar connected.",
  denied: "Google sign-in was cancelled.",
  bad_state: "That sign-in link expired. Please try again.",
  no_refresh_token: "Google didn't return offline access. Remove the app at myaccount.google.com/permissions and connect again.",
  not_configured: "Add GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET and GOOGLE_TOKEN_KEY to .env.local first (see README).",
  error: "Couldn't connect to Google. Check the server log.",
};

export default async function SettingsPage({ searchParams }: PageProps<"/settings">) {
  const { google: googleMsg } = await searchParams;
  const supabase = await requireAdmin();
  const [columns, packages, rules, email, payInstr, { data: gi }, { data: contractTpl }, { data: emailTpls }, { data: reminders }, reviewLink] = await Promise.all([
    getSheetColumns(supabase),
    listPackages(supabase),
    getRules(supabase),
    getEmailSettings(supabase),
    getPaymentInstructions(supabase),
    supabase.from("google_integrations").select("email, connected_at, last_error, sheet_id, sheet_synced_at, scopes").eq("id", 1).maybeSingle(),
    supabase.from("contract_templates").select("id, name, body, version").eq("is_default", true).maybeSingle(),
    supabase.from("email_templates").select("*").order("key"),
    supabase.from("reminder_rules").select("*").order("sort_order"),
    getSetting<string>(supabase, "review_link", ""),
  ]);

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="Settings" />
      <nav aria-label="Settings sections" className="-mx-4 mb-6 flex gap-2 overflow-x-auto px-4 text-sm sm:mx-0 sm:flex-wrap sm:px-0">
        {[["rules", "Business rules"], ["google", "Google Calendar"], ["email", "Email"], ["contract", "Contract"], ["templates", "Email templates"], ["reminders", "Reminders"], ["sheet", "Sheet columns"], ["packages", "Packages"]].map(([id, label]) => (
          <a key={id} href={`#${id}`} className="shrink-0 rounded-full border bg-card px-3 py-1.5 font-medium hover:border-brand/50">{label}</a>
        ))}
      </nav>

      <div className="space-y-8">
        <Section id="rules" title="Business rules"
          badge={!rules.confirmed ? <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-900 dark:bg-amber-950 dark:text-amber-200">Defaults, not yet confirmed</span> : undefined}
          description="Used for suggested deposits, due dates, hold expiry, signing links and the double-booking check.">
          <ActionForm action={saveRules} success="Business rules saved">
            <div className="grid gap-4 sm:grid-cols-3">
              <NumField name="deposit_percent" label="Deposit (% of rate)" value={rules.deposit_percent} />
              <NumField name="deposit_due_days" label="Deposit due (days after signing)" value={rules.deposit_due_days} />
              <NumField name="balance_due_days_before" label="Balance due (days before event)" value={rules.balance_due_days_before} />
              <NumField name="hold_days" label="Hold lasts (days)" value={rules.hold_days} />
              <NumField name="max_events_per_day" label="Max events per day" value={rules.max_events_per_day} />
              <NumField name="buffer_hours" label="Hours between events" value={rules.buffer_hours} step="0.5" />
              <NumField name="contract_link_days" label="Signing link valid (days)" value={rules.contract_link_days} />
            </div>
            <div className="mt-4 space-y-2 text-sm">
              <Check name="vo_blocks_calendar" checked={rules.vo_blocks_calendar}>VO projects block the date (otherwise they never conflict with events)</Check>
              <Check name="hold_auto_release" checked={rules.hold_auto_release}>Auto-release expired holds (otherwise: alert only)</Check>
              <Check name="confirmed" checked={rules.confirmed}>These rules are confirmed</Check>
            </div>
          </ActionForm>
        </Section>

        <Section id="google" title="Google Calendar & Sheets" description="Holds appear as “[HOLD] …” (tentative, yellow); confirmed bookings turn orange. Cancelling removes the event. The double-booking check also reads your calendar. Monthly records are mirrored to a Google Sheet the app creates (one tab per month, refreshed each morning or with Records → Sync to Sheet).">
          {typeof googleMsg === "string" && GOOGLE_MSG[googleMsg] && (
            <p className="mb-3 rounded-lg bg-muted px-3 py-2 text-sm">{GOOGLE_MSG[googleMsg]}</p>
          )}
          {!googleConfigured() ? (
            <p className="text-sm text-muted-foreground">Not set up on this server. Add the Google OAuth keys to <code>.env.local</code> (README → Google Calendar). Until then, bookings are saved normally and calendar steps are skipped and logged.</p>
          ) : gi ? (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-sm">
                <p className="font-semibold">Connected{gi.email && ` as ${gi.email}`}</p>
                <p className="text-muted-foreground">Since {fmtStamp(gi.connected_at)}</p>
                {gi.last_error && <p className="mt-1 text-destructive">Last error: {gi.last_error}</p>}
                {gi.sheet_id
                  ? <p className="mt-1">Sheet mirror: <a className="font-semibold text-brand-deep hover:underline dark:text-brand" href={`https://docs.google.com/spreadsheets/d/${gi.sheet_id}`} target="_blank" rel="noreferrer">open</a>{gi.sheet_synced_at && ` · synced ${fmtStamp(gi.sheet_synced_at)}`}</p>
                  : gi.scopes && !gi.scopes.includes("drive.file") && <p className="mt-1 text-muted-foreground">Disconnect and connect again to turn on the Google Sheet mirror.</p>}
              </div>
              <ConfirmButton variant="outline" action={disconnectGoogle} title="Disconnect Google Calendar?" description="Existing calendar events stay; the app stops updating them." confirmLabel="Disconnect">
                Disconnect
              </ConfirmButton>
            </div>
          ) : (
            <Button asChild className="font-semibold"><a href="/google/connect">Connect Google Calendar</a></Button>
          )}
        </Section>

        <Section id="email" title="Email" description={resendConfigured() ? "Sending through Resend." : "RESEND_API_KEY isn't set, so emails are saved to the Outbox instead of being sent."}>
          <p className="mb-4 text-sm"><Link href="/outbox" className="font-semibold text-brand-deep hover:underline dark:text-brand">Open Outbox →</Link></p>
          <ActionForm action={saveEmailSettings} success="Email settings saved">
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField name="from" label="From" value={email.from} hint="Use a verified Resend domain, e.g. Host Lester <bookings@yourdomain.com>" />
              <TextField name="reply_to" label="Reply-to (optional)" value={email.reply_to ?? ""} type="email" />
              <TextField name="notify_email" label="Send me alerts at" value={email.notify_email} type="email" />
              <div className="space-y-1.5"><Label htmlFor="signature">Email sign-off</Label><Textarea id="signature" name="signature" rows={2} defaultValue={email.signature} /></div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="payment_instructions">Payment instructions (GCash / bank)</Label>
                <Textarea id="payment_instructions" name="payment_instructions" rows={4} defaultValue={payInstr} />
                <p className="text-xs text-muted-foreground">Sent to clients after they sign. Placeholder text until you add your real details.</p>
              </div>
            </div>
          </ActionForm>
        </Section>

        <Section id="contract" title="Contract template" description={`“# Heading” lines become section titles. Editing saves a new version; contracts already sent keep their wording.${contractTpl ? ` Current: v${contractTpl.version}.` : ""}`}>
          {contractTpl && (
            <ActionForm action={saveContractTemplate.bind(null, contractTpl.id)} success="Contract template saved">
              <div className="space-y-3">
                <TextField name="name" label="Name" value={contractTpl.name} />
                <Textarea name="body" aria-label="Contract text" rows={18} defaultValue={contractTpl.body} className="font-mono text-[13px] leading-relaxed" />
                <MergeFieldHelp />
              </div>
            </ActionForm>
          )}
        </Section>

        <Section id="templates" title="Email templates" description="Change the wording any time; no redeploy needed.">
          <div className="space-y-2">
            {((emailTpls ?? []) as EmailTemplate[]).map((t) => (
              <details key={t.key} className="rounded-lg border">
                <summary className="flex cursor-pointer items-center justify-between gap-3 p-3">
                  <span><span className="font-semibold">{t.name}</span> <span className="text-xs text-muted-foreground">· {t.description}</span></span>
                  {!t.enabled && <span className="shrink-0 text-xs text-muted-foreground">off</span>}
                </summary>
                <div className="border-t p-3">
                  <ActionForm action={saveEmailTemplate.bind(null, t.key)} success="Template saved">
                    <div className="space-y-3">
                      <TextField name="subject" label="Subject" value={t.subject} />
                      <Textarea name="body" aria-label="Message" rows={9} defaultValue={t.body} />
                      <Check name="enabled" checked={t.enabled}>Send this email automatically</Check>
                    </div>
                  </ActionForm>
                </div>
              </details>
            ))}
          </div>
          <div className="mt-3"><MergeFieldHelp extra={[["contract_url", "Signing / download link"], ["contract_expires", "Link expiry date"], ["payment_amount", "Payment just received"], ["hold_until", "Hold expiry"], ["booking_url", "Link to the booking (for you)"], ["portal_url", "Client page: balance, upload proof, contract"], ["review_link", "Review link (Reminders)"], ["hold_line", "Hold note (inquiry auto-reply)"]]} /></div>
        </Section>

        <Section id="reminders" title="Reminders" description="A daily job (8:00 AM Manila on Vercel) sends these. Each reminder goes out once per booking; if a day is missed, it catches up the next morning.">
          <div className="space-y-2">
            {((reminders ?? []) as { key: string; name: string; description: string; offset_days: number; enabled: boolean }[]).map((r) => (
              <ActionForm key={r.key} action={saveReminderRule.bind(null, r.key)} className="rounded-lg border p-3">
                <p className="font-semibold">{r.name}</p>
                <div className="mt-2 flex flex-wrap items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Input name="offset_days" type="number" min={0} max={60} defaultValue={r.offset_days} className="w-20" aria-label={`${r.name}: days`} />
                    <span className="text-sm text-muted-foreground">{r.description}</span>
                  </div>
                  <Check name="enabled" checked={r.enabled}>On</Check>
                </div>
              </ActionForm>
            ))}
          </div>
          <ActionForm action={saveReviewLink} success="Review link saved" className="mt-4">
            <TextField name="review_link" label="Review link (used in the thank-you email)" value={reviewLink} />
          </ActionForm>
          <div className="mt-4"><RunRemindersButton /></div>
        </Section>

        <Section id="sheet" title="Monthly sheet columns" description="Match the column order and labels of your Google Sheet. Used by the Sheet view and Excel/CSV/PDF exports.">
          <ColumnsEditor initial={withAllFields(columns)} />
        </Section>

        <Section id="packages" title="Packages & rates" description="Picking a package on a booking fills in its rate and a suggested deposit. Changing a rate here doesn't change existing bookings.">
          <div className="space-y-2">
            {packages.map((p) => <PackageEditor key={p.id} pkg={p} action={savePackage.bind(null, p.id)} />)}
            <PackageEditor action={savePackage.bind(null, null)} />
          </div>
        </Section>
      </div>
    </div>
  );
}

function Section({ id, title, description, badge, children }: { id: string; title: string; description: string; badge?: ReactNode; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-20 rounded-xl border bg-card p-4 sm:p-6">
      <div className="flex flex-wrap items-center gap-2"><h2 className="text-lg font-bold">{title}</h2>{badge}</div>
      <p className="mb-4 text-sm text-muted-foreground">{description}</p>
      {children}
    </section>
  );
}

function NumField({ name, label, value, step = "1" }: { name: string; label: string; value: number; step?: string }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} type="number" inputMode="decimal" step={step} min={0} defaultValue={value} className="tabular h-10" />
    </div>
  );
}

function TextField({ name, label, value, hint, type = "text" }: { name: string; label: string; value: string; hint?: string; type?: string }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} type={type} defaultValue={value} className="h-10" />
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function Check({ name, checked, children }: { name: string; checked: boolean; children: ReactNode }) {
  return (
    <label className="flex items-start gap-2.5 text-sm">
      <input type="checkbox" name={name} defaultChecked={checked} className="mt-0.5 size-4 accent-[var(--brand)]" />
      {children}
    </label>
  );
}

function MergeFieldHelp({ extra = [] }: { extra?: [string, string][] }) {
  return (
    <details className="text-sm">
      <summary className="cursor-pointer font-medium text-muted-foreground">Merge fields you can use</summary>
      <ul className="mt-2 grid gap-x-4 gap-y-1 sm:grid-cols-2">
        {[...MERGE_FIELDS, ...extra].map(([k, d]) => (
          <li key={k}><code className="rounded bg-muted px-1 text-xs">{`{{${k}}}`}</code> <span className="text-muted-foreground">{d}</span></li>
        ))}
      </ul>
    </details>
  );
}
