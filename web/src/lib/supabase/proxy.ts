import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Public: client contract (/c/) and portal (/p/) links are token-protected; /book is the
// public inquiry page; cron checks its own secret. Trailing slashes matter: "/c" would match "/clients".
// The public website: "/" (matched exactly below), its pages, uploaded media and the SEO files in public/.
const PUBLIC_PATHS = ["/login", "/auth", "/c/", "/p/", "/book", "/api/cron/", "/videos", "/gallery", "/site-media/", "/assets/",
  "/robots.txt", "/sitemap.xml", "/sitemap.html", "/llms.txt", "/entity.json", "/ai-info.html"];

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  // `pnpm demo`: session is a plain cookie (see src/lib/demo/client.ts).
  if (process.env.DEMO_MODE === "1") {
    return gate(request, response, request.cookies.has("hl_demo_session"));
  }

  // Not configured yet (fresh clone): send everything to the login page, which explains.
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    if (request.nextUrl.pathname.startsWith("/login")) return response;
    return NextResponse.redirect(new URL("/login?error=config", request.url));
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(toSet) {
          toSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          toSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    },
  );

  const { data } = await supabase.auth.getClaims();
  return gate(request, response, !!data?.claims);
}

function gate(request: NextRequest, response: NextResponse, signedIn: boolean) {
  const path = request.nextUrl.pathname;

  if (!signedIn && path !== "/" && !PUBLIC_PATHS.some((p) => path.startsWith(p))) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = path === "/dashboard" ? "" : `?next=${encodeURIComponent(path + request.nextUrl.search)}`;
    return NextResponse.redirect(url);
  }
  // ?error=forbidden means signed in but not an admin: let the login page explain.
  if (signedIn && path === "/login" && !request.nextUrl.searchParams.has("error")) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }
  return response;
}
