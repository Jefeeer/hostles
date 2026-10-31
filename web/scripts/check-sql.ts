// Runs all migrations + seed against an in-memory Postgres (PGlite) with a stubbed
// Supabase `auth` schema. Lets us validate SQL without Docker or a hosted project.
//   pnpm db:check
import { PGlite } from "@electric-sql/pglite";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dirname, "..", "supabase");

const authStub = `
  create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
  create schema auth;
  create table auth.users (id uuid primary key default gen_random_uuid(), email text);
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  create schema storage;
  create table storage.buckets (id text primary key, name text, public boolean default false,
    file_size_limit bigint, allowed_mime_types text[]);
  create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text, owner uuid);
  alter table storage.objects enable row level security;
  grant usage on schema public to anon, authenticated;
`;

async function main() {
  const db = new PGlite();
  await db.exec(authStub);

  const migrations = readdirSync(join(root, "migrations")).filter((f) => f.endsWith(".sql")).sort();
  for (const f of migrations) {
    await db.exec(readFileSync(join(root, "migrations", f), "utf8"));
    console.log("✓ migration", f);
  }
  await db.exec(readFileSync(join(root, "seed.sql"), "utf8"));
  console.log("✓ seed.sql");

  const q = async (sql: string) => (await db.query(sql)).rows;
  console.log(await q(`select status, count(*)::int from public.bookings group by 1 order by 1`));
  console.log(await q(`select payment_status, count(*)::int from public.booking_financials group by 1`));
  const now = new Date();
  const [summary] = await q(
    `select public.month_summary(${now.getFullYear()}, ${now.getMonth() + 1}) as s`,
  );
  console.log(JSON.stringify((summary as { s: unknown }).s, null, 2));

  // RLS: a non-admin authenticated user must see nothing.
  await db.exec(`
    grant select on all tables in schema public to authenticated;
    insert into auth.users (id) values ('00000000-0000-0000-0000-000000000001');
    set role authenticated;
    select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', false);
  `);
  const [{ n }] = (await q(`select count(*)::int as n from public.bookings`)) as { n: number }[];
  if (n !== 0) throw new Error(`RLS leak: non-admin saw ${n} bookings`);
  await db.exec(`reset role; insert into public.admins values ('00000000-0000-0000-0000-000000000001'); set role authenticated;`);
  const [{ n: n2 }] = (await q(`select count(*)::int as n from public.bookings`)) as { n: number }[];
  if (n2 === 0) throw new Error("admin sees no bookings");
  console.log(`✓ RLS: non-admin sees 0, admin sees ${n2}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
