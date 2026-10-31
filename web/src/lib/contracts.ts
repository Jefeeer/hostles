import "server-only";
import { addDays, format } from "date-fns";
import type { SupabaseClient } from "@supabase/supabase-js";
import { logActivity } from "./activity";
import { randomToken, sha256 } from "./crypto";
import { getBooking } from "./data";
import { sendTemplateEmail } from "./email";
import { bookingFields, renderTemplate } from "./merge";
import { appUrl, getPaymentInstructions, getRules } from "./settings";
import type { BookingRow, Contract } from "./types";

export const contractUrl = (token: string) => `${appUrl()}/c/${token}`;

/**
 * Generate a contract from the default template, void any open one, and email the
 * signing link. Returns the raw token (only ever held in memory / the email).
 */
export async function issueContract(supabase: SupabaseClient, booking: BookingRow, actor: "admin" | "system" = "system") {
  const rules = await getRules(supabase);
  const { data: tpl, error: tplErr } = await supabase.from("contract_templates").select("id, name, body, version").eq("is_default", true).maybeSingle();
  if (tplErr) throw tplErr;
  if (!tpl) throw new Error("No default contract template. Add one in Settings.");

  // Only one open contract per booking: void the previous link.
  await supabase.from("contracts").update({ status: "void" }).eq("booking_id", booking.id).eq("status", "sent");

  const token = randomToken();
  const expires = addDays(new Date(), rules.contract_link_days);
  const fields = bookingFields(booking, rules);
  const { data: contract, error } = await supabase
    .from("contracts")
    .insert({
      booking_id: booking.id,
      template_id: tpl.id,
      template_version: tpl.version,
      title: `${tpl.name}: ${fields.event_title}`,
      body: renderTemplate(tpl.body, fields),
      token_hash: sha256(token),
      expires_at: expires.toISOString(),
    })
    .select("id")
    .single();
  if (error) throw error;

  await logActivity(supabase, { actor, entity_type: "booking", entity_id: booking.id, action: "contract.issued", summary: `Contract generated (link valid until ${format(expires, "MMM d")})`, details: { contract_id: contract.id } });

  const email = await sendTemplateEmail(supabase, {
    key: "contract_sent",
    to: booking.client?.email,
    bookingId: booking.id,
    dedupeKey: `contract_sent:${contract.id}`,
    fields: { ...fields, contract_url: contractUrl(token), contract_expires: format(expires, "MMMM d, yyyy") },
  });
  return { contractId: contract.id as string, token, email };
}

export async function findContractByToken(supabase: SupabaseClient, token: string) {
  if (!/^[A-Za-z0-9_-]{30,60}$/.test(token)) return null;
  const { data } = await supabase.from("contracts").select("*").eq("token_hash", sha256(token)).maybeSingle<Contract>();
  if (!data) return null;
  const booking = await getBooking(supabase, data.booking_id);
  return booking ? { contract: data, booking } : null;
}

export type SignInput = { name: string; signatureText?: string; signatureImage?: string; ip?: string; userAgent?: string };

/** Client signs via their link. Moves the booking to Signed (which emails deposit instructions). */
export async function signContract(supabase: SupabaseClient, token: string, input: SignInput) {
  const found = await findContractByToken(supabase, token);
  if (!found) throw new Error("This signing link is not valid.");
  const { contract, booking } = found;
  if (contract.status === "signed") return found;
  if (contract.status === "void") throw new Error("This link was replaced by a newer contract. Please use the latest email.");
  if (new Date(contract.expires_at) < new Date()) throw new Error("This signing link has expired. Please ask Lester for a new one.");

  const signedAt = new Date().toISOString();
  const content_hash = sha256([contract.body, input.name, input.signatureText ?? "", input.signatureImage ?? "", signedAt].join("\n"));
  const { error } = await supabase
    .from("contracts")
    .update({
      status: "signed", signer_name: input.name, signature_text: input.signatureText ?? null, signature_image: input.signatureImage ?? null,
      signed_at: signedAt, signer_ip: input.ip ?? null, signer_user_agent: input.userAgent ?? null, content_hash,
    })
    .eq("id", contract.id)
    .eq("status", "sent");
  if (error) throw error;

  await logActivity(supabase, { actor: "client", entity_type: "booking", entity_id: booking.id, action: "contract.signed", summary: `Contract signed by ${input.name}`, details: { contract_id: contract.id, ip: input.ip } });

  // Late import: automations imports this module.
  const { transitionBooking } = await import("./automations");
  if (["inquiry", "on_hold", "contract_sent"].includes(booking.status)) {
    await transitionBooking(supabase, booking.id, "signed", { actor: "client", force: true, contractUrl: contractUrl(token) });
  }
  return findContractByToken(supabase, token);
}

/** Deposit-instructions email after signing (idempotent per contract). */
export async function sendSignedEmail(supabase: SupabaseClient, booking: BookingRow, contractUrlForClient?: string) {
  const rules = await getRules(supabase);
  const { data: c } = await supabase.from("contracts").select("id").eq("booking_id", booking.id).eq("status", "signed").order("signed_at", { ascending: false }).limit(1).maybeSingle();
  return sendTemplateEmail(supabase, {
    key: "contract_signed",
    to: booking.client?.email,
    bookingId: booking.id,
    dedupeKey: `contract_signed:${c?.id ?? booking.id}`,
    portal: { bookingId: booking.id, eventDate: booking.event_date },
    fields: {
      ...bookingFields(booking, rules),
      payment_instructions: await getPaymentInstructions(supabase),
      contract_url: contractUrlForClient ?? "(reply to this email for a copy)",
    },
  });
}
