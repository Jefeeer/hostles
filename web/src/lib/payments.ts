import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { logActivity } from "./activity";
import { sendTemplateEmail } from "./email";
import { php } from "./format";
import { bookingFields } from "./merge";
import { appUrl, getEmailSettings, getRules } from "./settings";
import { MAX_PROOF_BYTES, PROOF_TYPES, putProof, sniffType } from "./storage";
import { METHOD_LABEL } from "./constants";
import type { BookingRow, PaymentMethod } from "./types";

export type ClientPaymentInput = { amount: number; method: PaymentMethod; reference?: string; file: File };

/** A client uploads GCash/bank proof from their portal. Stored unverified until Lester verifies it. */
export async function submitClientPayment(supabase: SupabaseClient, b: BookingRow, input: ClientPaymentInput) {
  if (["cancelled", "done"].includes(b.status)) throw new Error("This booking isn't accepting payments.");
  if (!(input.amount > 0) || input.amount > Math.max(b.fin.balance, 1) * 1.05 + 1) throw new Error(`Please enter an amount up to ${php(b.fin.balance)}.`);
  if (input.file.size === 0) throw new Error("Please attach your screenshot or receipt.");
  if (input.file.size > MAX_PROOF_BYTES) throw new Error("That file is over 4 MB. Please send a smaller screenshot.");

  // Abuse guard: a handful of pending proofs per booking is plenty.
  const { data: pending } = await supabase.from("payments").select("id").eq("booking_id", b.id).eq("submitted_by", "client").is("verified_at", null);
  if ((pending?.length ?? 0) >= 5) throw new Error("You already have several payments waiting to be verified. Lester will check them soon.");

  const bytes = new Uint8Array(await input.file.arrayBuffer());
  const type = sniffType(bytes);
  if (!type || !PROOF_TYPES[type]) throw new Error("Please upload a photo (JPG, PNG, WEBP, HEIC) or a PDF.");

  const path = `${b.id}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${PROOF_TYPES[type]}`;
  await putProof(path, bytes, type);

  const { data: verifiedDeposit } = await supabase.from("payments").select("id").eq("booking_id", b.id).eq("kind", "deposit").not("verified_at", "is", null).limit(1);
  const kind = (verifiedDeposit?.length ?? 0) > 0 || b.fin.paid >= b.deposit_amount ? "balance" : "deposit";
  const { data: payment, error } = await supabase
    .from("payments")
    .insert({
      booking_id: b.id, kind, method: input.method, amount: input.amount, reference: input.reference || null,
      proof_path: path, proof_content_type: type, submitted_by: "client",
      paid_on: new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Manila" }),
    })
    .select("id")
    .single();
  if (error) throw error;

  await logActivity(supabase, {
    actor: "client", entity_type: "booking", entity_id: b.id, action: "payment.submitted",
    summary: `Client uploaded proof: ${php(input.amount)} (${METHOD_LABEL[input.method]})`, details: { payment_id: payment.id },
  });

  const rules = await getRules(supabase);
  const fields = {
    ...bookingFields(b, rules),
    payment_amount: php(input.amount), payment_method: METHOD_LABEL[input.method], payment_reference: input.reference || "-",
    booking_url: `${appUrl()}/bookings/${b.id}`,
  };
  const { notify_email } = await getEmailSettings(supabase);
  await sendTemplateEmail(supabase, { key: "payment_submitted_admin", to: notify_email, bookingId: b.id, dedupeKey: `payment_submitted_admin:${payment.id}`, fields, actor: "client" });
  await sendTemplateEmail(supabase, { key: "payment_submitted", to: b.client?.email, bookingId: b.id, dedupeKey: `payment_submitted:${payment.id}`, fields, actor: "client", portal: { bookingId: b.id, eventDate: b.event_date } });
  return payment.id as string;
}
