import { getBooking, requireAdmin } from "@/lib/data";
import { contractPdfResponse } from "@/lib/pdf/render-contract";
import type { Contract } from "@/lib/types";

export async function GET(_req: Request, ctx: RouteContext<"/contracts/[id]/pdf">) {
  const { id } = await ctx.params;
  const supabase = await requireAdmin();
  const { data } = await supabase.from("contracts").select("*").eq("id", id).maybeSingle<Contract>();
  if (!data) return new Response("Not found", { status: 404 });
  const booking = await getBooking(supabase, data.booking_id);
  return contractPdfResponse(data, booking?.client?.full_name ?? "Client");
}
