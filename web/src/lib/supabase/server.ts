import { createServerClient } from "@supabase/ssr";
import { createClient as createJsClient, type SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

export async function createClient(): Promise<SupabaseClient> {
  const cookieStore = await cookies();
  if (process.env.DEMO_MODE === "1") {
    const { createDemoClient } = await import("@/lib/demo/client");
    return createDemoClient(cookieStore);
  }
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll(toSet) {
          try {
            toSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {
            // Called from a Server Component; proxy.ts refreshes the session instead.
          }
        },
      },
    },
  );
}

/** Service-role client. Server-only: bypasses RLS. Used by scripts, cron and public RPC routes. */
export function createAdminClient() {
  return createJsClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Server-side client for public pages that have already proven access some other way
 * (e.g. a contract link token). Service role in production; the in-memory DB in demo mode.
 */
export async function createServiceClient(): Promise<SupabaseClient> {
  if (process.env.DEMO_MODE === "1") {
    const { createDemoClient } = await import("@/lib/demo/client");
    return createDemoClient(await cookies());
  }
  return createAdminClient();
}
