import { contractPdfResponse } from "@/lib/pdf/render-contract";
import { findBookingByPortalToken } from "@/lib/portal";
import { createServiceClient } from "@/lib/supabase/server";
import type { Contract } from "@/lib/types";

/** Signed contract download from the client portal. */
export async function GET(_req: Request, ctx: RouteContext<"/p/[token]/contract">) {
  const { token } = await ctx.params;
  const supabase = await createServiceClient();
  const b = await findBookingByPortalToken(supabase, token);
  if (!b) return new Response("Not found", { status: 404 });
  const { data } = await supabase.from("contracts").select("*").eq("booking_id", b.id).eq("status", "signed").order("signed_at", { ascending: false }).limit(1).maybeSingle<Contract>();
  if (!data) return new Response("Not found", { status: 404 });
  return contractPdfResponse(data, b.client?.full_name ?? "Client", true);
}
