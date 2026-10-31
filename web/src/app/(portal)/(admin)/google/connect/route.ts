import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { randomToken } from "@/lib/crypto";
import { requireAdmin } from "@/lib/data";
import { GOOGLE_SCOPES, googleConfigured, oauthClient } from "@/lib/google";

export async function GET(req: Request) {
  await requireAdmin();
  if (!googleConfigured()) return NextResponse.redirect(new URL("/settings?google=not_configured", req.url));

  const state = randomToken();
  (await cookies()).set("hl_google_state", state, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 600, secure: req.url.startsWith("https") });
  const url = oauthClient().generateAuthUrl({
    access_type: "offline",
    prompt: "consent", // always return a refresh token
    scope: GOOGLE_SCOPES,
    state,
    include_granted_scopes: true,
  });
  return NextResponse.redirect(url);
}
