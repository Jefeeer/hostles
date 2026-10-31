import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { logActivity } from "@/lib/activity";
import { encrypt } from "@/lib/crypto";
import { requireAdmin } from "@/lib/data";
import { oauthClient } from "@/lib/google";

export async function GET(req: Request) {
  const supabase = await requireAdmin();
  const url = new URL(req.url);
  const jar = await cookies();
  const expected = jar.get("hl_google_state")?.value;
  jar.delete("hl_google_state");
  const back = (q: string) => NextResponse.redirect(new URL(`/settings?google=${q}`, req.url));

  if (url.searchParams.get("error")) return back("denied");
  if (!expected || url.searchParams.get("state") !== expected) return back("bad_state");

  try {
    const client = oauthClient();
    const { tokens } = await client.getToken(url.searchParams.get("code") ?? "");
    if (!tokens.refresh_token) return back("no_refresh_token");
    const email = tokens.id_token ? (await client.verifyIdToken({ idToken: tokens.id_token, audience: process.env.GOOGLE_CLIENT_ID })).getPayload()?.email : null;

    const { error } = await supabase.from("google_integrations").upsert({
      id: 1, email: email ?? null, calendar_id: "primary", refresh_token_enc: encrypt(tokens.refresh_token),
      scopes: tokens.scope ?? null, connected_at: new Date().toISOString(), last_error: null,
    });
    if (error) throw error;
    await logActivity(supabase, { entity_type: "settings", action: "google.connected", summary: `Google Calendar connected (${email ?? "account"})` });
    return back("connected");
  } catch (e) {
    console.error("Google OAuth failed", e);
    return back("error");
  }
}
