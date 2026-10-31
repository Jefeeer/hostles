import { isDemo } from "@/lib/demo/db";
import { getDemoSiteMedia, siteMediaPublicUrl } from "@/lib/storage";

// Demo mode serves website uploads from the in-memory DB. Real uploads already use the bucket's public URL;
// redirect there in case a /site-media/ link was pasted in.
// ponytail: no Range support, so Safari may not play demo videos; real deployments are served by Supabase.
export async function GET(_req: Request, { params }: RouteContext<"/site-media/[name]">) {
  const { name } = await params;
  if (!isDemo()) return Response.redirect(siteMediaPublicUrl(name), 302);
  const file = await getDemoSiteMedia(name);
  if (!file) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(file.data), { headers: { "Content-Type": file.contentType, "Cache-Control": "public, max-age=31536000, immutable" } });
}
