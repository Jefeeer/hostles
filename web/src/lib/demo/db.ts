import "server-only";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

// DEMO MODE ONLY (`pnpm demo`): an in-memory Postgres built from the real
// migrations + seed. Data resets whenever the dev server restarts.

export const DEMO_USER_ID = "00000000-0000-4000-8000-00000000d3e0";
export const DEMO_EMAIL = "demo@hostlester.local";
export const DEMO_PASSWORD = "demo1234";

export const isDemo = () => process.env.DEMO_MODE === "1";

// Minimal stand-in for Supabase's auth schema; auth.uid() is always the demo admin.
const authStub = `
  create role anon nologin; create role authenticated nologin; create role service_role nologin;
  create schema auth;
  create table auth.users (id uuid primary key, email text);
  create function auth.uid() returns uuid language sql stable as $$ select '${DEMO_USER_ID}'::uuid $$;
  create schema storage;
  create table storage.buckets (id text primary key, name text, public boolean default false, file_size_limit bigint, allowed_mime_types text[]);
  -- Stand-in for Supabase Storage (see src/lib/storage.ts).
  create table storage.demo_files (path text primary key, content_type text not null, data bytea not null);
`;

// Return what PostgREST would: dates/times as strings, timestamps as ISO, numbers as numbers.
const toIso = (v: string) => new Date(v.replace(" ", "T").replace(/([+-]\d\d)$/, "$1:00")).toISOString();
const parsers = {
  1082: (v: string) => v, // date
  1083: (v: string) => v, // time
  1114: (v: string) => toIso(v + "+00"), // timestamp
  1184: toIso, // timestamptz
  1700: Number, // numeric
  20: Number, // int8
};

async function boot() {
  const db = new PGlite({ parsers });
  const root = join(process.cwd(), "supabase");
  await db.exec(authStub);
  for (const f of readdirSync(join(root, "migrations")).filter((f) => f.endsWith(".sql")).sort()) {
    await db.exec(readFileSync(join(root, "migrations", f), "utf8"));
  }
  await db.exec(readFileSync(join(root, "seed.sql"), "utf8"));
  await db.query(`insert into auth.users (id, email) values ($1, $2)`, [DEMO_USER_ID, DEMO_EMAIL]);
  await db.query(`insert into public.admins (user_id) values ($1)`, [DEMO_USER_ID]);
  console.log("[demo] in-memory database ready");
  return db;
}

// One instance per server process (survives hot reloads).
const g = globalThis as unknown as { __hlDemoDb?: Promise<PGlite> };
export const demoDb = () => (g.__hlDemoDb ??= boot());
