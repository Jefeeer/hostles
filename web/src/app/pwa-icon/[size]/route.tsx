import { brandIcon } from "@/lib/brand-icon";

// /pwa-icon/192, /pwa-icon/512, /pwa-icon/512-maskable
export async function GET(_req: Request, ctx: RouteContext<"/pwa-icon/[size]">) {
  const { size } = await ctx.params;
  const px = Number.parseInt(size, 10);
  if (![192, 512].includes(px)) return new Response("Not found", { status: 404 });
  return brandIcon(px, { maskable: size.endsWith("-maskable") });
}
