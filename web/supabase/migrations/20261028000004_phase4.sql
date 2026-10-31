-- HOST LESTER — Phase 4: Special Events (e.g. Kasalang Tagaytay) and Google Sheets mirror.

-- ─── Special events: series → editions → entries ────────────────────────────
create table public.event_series (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  created_at timestamptz not null default now()
);

create type public.fee_mode as enum ('flat', 'per_entry');
create type public.edition_status as enum ('planning', 'open', 'done', 'cancelled');

create table public.event_editions (
  id uuid primary key default gen_random_uuid(),
  series_id uuid not null references public.event_series (id) on delete cascade,
  name text not null,
  event_date date not null,
  start_time time,
  end_time time,
  venue text,
  event_type public.event_type not null default 'wedding',  -- used when an entry becomes a booking
  status public.edition_status not null default 'planning',
  fee_mode public.fee_mode not null default 'flat',
  flat_fee numeric(12, 2) not null default 0 check (flat_fee >= 0),       -- whole-event fee
  per_entry_fee numeric(12, 2) not null default 0 check (per_entry_fee >= 0), -- default fee per entry
  flat_paid numeric(12, 2) not null default 0 check (flat_paid >= 0),    -- collected on the flat fee
  -- Custom entry fields: [{ "key": "groom", "label": "Groom", "type": "text"|"number"|"date"|"select", "options": [...] }]
  fields jsonb not null default '[]'::jsonb,
  notes text,
  created_at timestamptz not null default now()
);
create index event_editions_series_idx on public.event_editions (series_id, event_date);

create table public.edition_entries (
  id uuid primary key default gen_random_uuid(),
  edition_id uuid not null references public.event_editions (id) on delete cascade,
  name text not null,                       -- e.g. the couple
  contact text,
  email text,
  data jsonb not null default '{}'::jsonb,  -- values for the edition's custom fields
  fee numeric(12, 2),                       -- null = use the edition's per-entry fee
  paid numeric(12, 2) not null default 0 check (paid >= 0),
  booking_id uuid references public.bookings (id) on delete set null,
  created_at timestamptz not null default now()
);
create index edition_entries_edition_idx on public.edition_entries (edition_id);

alter table public.event_series enable row level security;
alter table public.event_editions enable row level security;
alter table public.edition_entries enable row level security;
create policy admin_all on public.event_series for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy admin_all on public.event_editions for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy admin_all on public.edition_entries for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ─── Google Sheets mirror ───────────────────────────────────────────────────
-- Push-only: the app is the source of truth; each month is written to a "Mon YYYY" tab.
alter table public.google_integrations
  add column sheet_id text,
  add column sheet_synced_at timestamptz;
