import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSetting } from "./data";

export type Rules = {
  deposit_percent: number;
  deposit_due_days: number;
  balance_due_days_before: number;
  hold_days: number;
  hold_auto_release: boolean;
  max_events_per_day: number;
  buffer_hours: number;
  vo_blocks_calendar: boolean;
  contract_link_days: number;
  confirmed: boolean;
};

// DEFAULTS until Lester confirms (also seeded by migration 0002).
export const DEFAULT_RULES: Rules = {
  deposit_percent: 30,
  deposit_due_days: 7,
  balance_due_days_before: 7,
  hold_days: 7,
  hold_auto_release: false,
  max_events_per_day: 2,
  buffer_hours: 3,
  vo_blocks_calendar: false,
  contract_link_days: 14,
  confirmed: false,
};

export type EmailSettings = { from: string; reply_to: string | null; notify_email: string; signature: string };
export const DEFAULT_EMAIL: EmailSettings = {
  from: "Host Lester <onboarding@resend.dev>",
  reply_to: null,
  notify_email: "lester@example.com",
  signature: "Lester\nEvents Host · Voice-over",
};

export async function getRules(supabase: SupabaseClient): Promise<Rules> {
  return { ...DEFAULT_RULES, ...(await getSetting<Partial<Rules>>(supabase, "rules", {})) };
}
export async function getEmailSettings(supabase: SupabaseClient): Promise<EmailSettings> {
  return { ...DEFAULT_EMAIL, ...(await getSetting<Partial<EmailSettings>>(supabase, "email", {})) };
}
export const getPaymentInstructions = (supabase: SupabaseClient) => getSetting<string>(supabase, "payment_instructions", "");

export const appUrl = () => (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
