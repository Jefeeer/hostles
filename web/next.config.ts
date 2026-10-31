import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // Portal pages are per-user (auth cookie) and the public site reads live content, so prerendering buys nothing here.
  cacheComponents: false,
  // PGlite ships wasm + data files; load it from node_modules instead of bundling (demo mode only).
  serverExternalPackages: ["@electric-sql/pglite"],
  // The sign-in page is /login; common guesses go there too.
  redirects: async () => ["/signin", "/sign-in", "/admin"].map((source) => ({ source, destination: "/login", permanent: false })),
  experimental: {
    // Two root layouts (public site + portal) need a global 404: src/app/global-not-found.tsx.
    globalNotFound: true,
    // Payment-proof uploads (capped at 4 MB in src/lib/storage.ts; Vercel's request limit is 4.5 MB).
    serverActions: { bodySizeLimit: "4.5mb" },
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
