import { requireAdmin } from "@/lib/data";
import { getProof } from "@/lib/storage";

/** Admin-only view of an uploaded payment proof. */
export async function GET(_req: Request, ctx: RouteContext<"/payments/[id]/proof">) {
  const { id } = await ctx.params;
  const supabase = await requireAdmin();
  const { data: p } = await supabase.from("payments").select("proof_path").eq("id", id).maybeSingle();
  if (!p?.proof_path) return new Response("Not found", { status: 404 });
  const file = await getProof(p.proof_path);
  if (!file) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(file.data), {
    headers: {
      "Content-Type": file.contentType,
      "Content-Disposition": "inline",
      "Cache-Control": "private, no-store",
      // Proofs are user uploads: never let them run as a page.
      "Content-Security-Policy": "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; sandbox",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
