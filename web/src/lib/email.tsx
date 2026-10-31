import "server-only";
import { Body, Container, Head, Hr, Html, Img, Link, Preview, Section, Text } from "@react-email/components";
import { render } from "@react-email/render";
import type { SupabaseClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { logActivity } from "./activity";
import { renderTemplate } from "./merge";
import { mintPortalUrl } from "./portal";
import { appUrl, getEmailSettings } from "./settings";
import type { EmailTemplate } from "./types";

export const resendConfigured = () => !!process.env.RESEND_API_KEY;

/** Branded wrapper. Body is plain text: blank lines split paragraphs, URLs become links. */
export function EmailLayout({ preview, body }: { preview: string; body: string }) {
  const paragraphs = body.trim().split(/\n{2,}/);
  return (
    <Html lang="en">
      <Head />
      <Preview>{preview}</Preview>
      <Body style={{ backgroundColor: "#f4ecdf", fontFamily: "Manrope, Helvetica, Arial, sans-serif", margin: 0, padding: "24px 0" }}>
        <Container style={{ backgroundColor: "#ffffff", borderRadius: 12, maxWidth: 560, overflow: "hidden" }}>
          <Section style={{ backgroundColor: "#0e0c0b", padding: "20px 28px" }}>
            <Img src={`${appUrl()}/brand/lester-script.png`} alt="Lester" width="96" height="65" />
          </Section>
          <Section style={{ padding: "8px 28px 20px" }}>
            {paragraphs.map((p, i) => (
              <Text key={i} style={{ color: "#17110c", fontSize: 15, lineHeight: "24px", whiteSpace: "pre-line" }}>
                {p.split(/(https?:\/\/\S+)/g).map((part, j) =>
                  /^https?:\/\//.test(part) ? (
                    <Link key={j} href={part} style={{ color: "#c24700", fontWeight: 700 }}>{part}</Link>
                  ) : (
                    part
                  ),
                )}
              </Text>
            ))}
          </Section>
          <Hr style={{ borderColor: "#e6dccb", margin: 0 }} />
          <Text style={{ color: "#6b5e52", fontSize: 12, padding: "0 28px" }}>Host Lester · Events Host · Voice-over</Text>
        </Container>
      </Body>
    </Html>
  );
}

type SendArgs = {
  key: string;
  to: string | null | undefined;
  fields: Record<string, string>;
  bookingId?: string | null;
  /** Prevents sending the same automated email twice. */
  dedupeKey?: string;
  actor?: "admin" | "system" | "client" | "cron";
  /** Mint a fresh client-portal link as {{portal_url}} (only if the email actually goes out). */
  portal?: { bookingId: string; eventDate: string };
};

export type SendResult = { status: "sent" | "simulated" | "failed" | "skipped" | "duplicate"; reason?: string };

/** Render a DB email template and send it via Resend (or record it as simulated without a key). */
export async function sendTemplateEmail(supabase: SupabaseClient, a: SendArgs): Promise<SendResult> {
  const { data: tpl } = await supabase.from("email_templates").select("*").eq("key", a.key).maybeSingle<EmailTemplate>();
  if (!tpl) return { status: "skipped", reason: `No template "${a.key}"` };
  if (!tpl.enabled) return { status: "skipped", reason: `"${tpl.name}" is turned off` };
  if (!a.to) {
    await logActivity(supabase, { actor: a.actor ?? "system", entity_type: "booking", entity_id: a.bookingId, action: "email.skipped", summary: `"${tpl.name}" not sent: no email address on file` });
    return { status: "skipped", reason: "No email address on file" };
  }

  if (a.dedupeKey) {
    const fresh = await logActivity(supabase, {
      actor: a.actor ?? "system", entity_type: "booking", entity_id: a.bookingId, action: `email.${a.key}`,
      summary: `Email "${tpl.name}" → ${a.to}`, dedupe_key: `email:${a.dedupeKey}`,
    });
    if (!fresh) return { status: "duplicate" };
  }

  const settings = await getEmailSettings(supabase);
  const fields: Record<string, string> = { signature: settings.signature, app_url: appUrl(), ...a.fields };
  if (a.portal) fields.portal_url = await mintPortalUrl(supabase, a.portal.bookingId, a.portal.eventDate);
  const subject = renderTemplate(tpl.subject, fields);
  const text = renderTemplate(tpl.body, fields);
  const html = await render(<EmailLayout preview={subject} body={text} />);

  const { data: row } = await supabase
    .from("email_outbox")
    .insert({ template_key: a.key, booking_id: a.bookingId ?? null, to_email: a.to, subject, html, text_body: text, status: "queued" })
    .select("id")
    .single();

  let result: SendResult;
  if (!resendConfigured()) {
    result = { status: "simulated", reason: "RESEND_API_KEY not set: saved to Outbox only" };
    await supabase.from("email_outbox").update({ status: "simulated" }).eq("id", row?.id);
  } else {
    const res = await new Resend(process.env.RESEND_API_KEY).emails.send({
      from: settings.from, to: a.to, subject, html, text, replyTo: settings.reply_to ?? undefined,
    });
    result = res.error ? { status: "failed", reason: res.error.message } : { status: "sent" };
    await supabase.from("email_outbox")
      .update({ status: result.status, provider_id: res.data?.id ?? null, error: res.error?.message ?? null })
      .eq("id", row?.id);
  }

  if (!a.dedupeKey) {
    await logActivity(supabase, { actor: a.actor ?? "admin", entity_type: "booking", entity_id: a.bookingId, action: `email.${a.key}`, summary: `Email "${tpl.name}" → ${a.to} (${result.status})` });
  } else if (result.status === "failed") {
    await logActivity(supabase, { entity_type: "booking", entity_id: a.bookingId, action: "email.failed", summary: `Email "${tpl.name}" failed: ${result.reason}` });
  }
  return result;
}
