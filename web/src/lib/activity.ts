import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

export type LogEntry = {
  actor?: "admin" | "system" | "client" | "cron";
  entity_type: string;
  entity_id?: string | null;
  action: string;
  summary?: string;
  details?: Record<string, unknown>;
  /** Same key twice = no-op. This is what makes automations idempotent. */
  dedupe_key?: string;
};

/** Returns false when dedupe_key was already logged (the step already ran). */
export async function logActivity(supabase: SupabaseClient, entry: LogEntry): Promise<boolean> {
  const { data, error } = await supabase
    .from("activity_log")
    .upsert({ actor: "admin", details: {}, ...entry }, { onConflict: "dedupe_key", ignoreDuplicates: true })
    .select("id");
  if (error) throw error;
  return (data?.length ?? 0) > 0;
}
