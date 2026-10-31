import { findContractByToken } from "@/lib/contracts";
import { contractPdfResponse } from "@/lib/pdf/render-contract";
import { createServiceClient } from "@/lib/supabase/server";

export async function GET(_req: Request, ctx: RouteContext<"/c/[token]/pdf">) {
  const { token } = await ctx.params;
  const found = await findContractByToken(await createServiceClient(), token);
  if (!found || found.contract.status === "void") return new Response("Not found", { status: 404 });
  return contractPdfResponse(found.contract, found.booking.client?.full_name ?? "Client", true);
}
