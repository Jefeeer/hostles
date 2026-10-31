import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  // Skip static assets, icons and the PWA manifest.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon|apple-icon|pwa-icon|manifest.webmanifest|brand/|.*\\.(?:png|jpg|jpeg|svg|webp|woff2)$).*)"],
};
