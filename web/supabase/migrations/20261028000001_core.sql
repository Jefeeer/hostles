-- HOST LESTER — Phase 1 core schema
-- All business times are Asia/Manila (no DST), so events store a local date + local times.

set check_function_bodies = off;

-- ─── Enums ──────────────────────────────────────────────────────────────────
create type public.booking_status as enum (
  'inquiry', 'on_hold', 'contract_sent', 'signed',
  'deposit_paid', 'fully_paid', 'done', 'cancelled'
);
create type public.event_type as enum (
  'wedding', 'debut', 'birthday', 'corporate', 'vo_project', 'other'
);
create type public.payment_kind as enum ('deposit', 'balance', 'other');
create type public.payment_method as enum ('gcash', 'bank_transfer', 'cash', 'other');

-- ─── Admins ─────────────────────────────────────────────────────────────────
-- Sign-ups are disabled; admins are created with `pnpm admin:create`.
create table public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create function public.is_admin() returns boolean
language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.admins where user_id = auth.uid()) $$;

create function public.touch_updated_at() returns trigger
language plpgsql set search_path = ''
as $$ begin new.updated_at = now(); return new; end $$;

-- ─── Clients ────────────────────────────────────────────────────────────────
create table public.clients (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  partner_name text,                 -- e.g. the other half of the couple
  email text,
  phone text,
  facebook text,
  city text,
  pronunciation_notes text,          -- names & how to say them on the mic
  story text,                        -- couple's story / material for spiels
  program_notes text,                -- program flow notes
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index clients_name_idx on public.clients using gin (to_tsvector('simple', full_name || ' ' || coalesce(partner_name, '')));
create trigger clients_touch before update on public.clients for each row execute function public.touch_updated_at();

-- ─── Packages ───────────────────────────────────────────────────────────────
create table public.packages (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  event_type public.event_type,      -- null = any event type
  description text,
  inclusions text[] not null default '{}',
  rate numeric(12,2) not null default 0 check (rate >= 0),
  hours numeric(4,1),
  is_active boolean not null default true,
  is_public boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger packages_touch before update on public.packages for each row execute function public.touch_updated_at();

-- ─── Bookings ───────────────────────────────────────────────────────────────
create sequence public.booking_no_seq;

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  no bigint not null unique default nextval('public.booking_no_seq'),
  ref text generated always as ('HL-' || lpad(no::text, 4, '0')) stored,
  client_id uuid not null references public.clients (id) on delete restrict,
  title text,                        -- e.g. "Paolo & Bea Wedding"; defaults to client name in the UI
  event_type public.event_type not null,
  event_date date not null,          -- Asia/Manila local date
  start_time time,                   -- Asia/Manila local time
  end_time time,
  venue text,
  venue_address text,
  package_id uuid references public.packages (id) on delete set null,
  rate numeric(12,2) not null default 0 check (rate >= 0),
  deposit_amount numeric(12,2) not null default 0 check (deposit_amount >= 0),
  status public.booking_status not null default 'inquiry',
  status_changed_at timestamptz not null default now(),
  hold_expires_at timestamptz,
  cancelled_reason text,
  source text not null default 'manual',   -- manual | public_form | special_event
  coordinator text,
  guest_count int,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint deposit_le_rate check (deposit_amount <= rate)
);
create index bookings_event_date_idx on public.bookings (event_date);
create index bookings_status_idx on public.bookings (status);
create index bookings_client_idx on public.bookings (client_id);
create trigger bookings_touch before update on public.bookings for each row execute function public.touch_updated_at();

create function public.bookings_status_changed() returns trigger
language plpgsql set search_path = ''
as $$
begin
  if new.status is distinct from old.status then
    new.status_changed_at = now();
  end if;
  return new;
end $$;
create trigger bookings_status_changed before update of status on public.bookings
  for each row execute function public.bookings_status_changed();

-- ─── Payments ───────────────────────────────────────────────────────────────
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings (id) on delete cascade,
  kind public.payment_kind not null default 'deposit',
  method public.payment_method not null default 'gcash',
  amount numeric(12,2) not null check (amount > 0),
  paid_on date not null default (now() at time zone 'Asia/Manila')::date,
  reference text,                    -- GCash ref no. / bank ref
  proof_path text,                   -- Supabase Storage path (Phase 3)
  verified_at timestamptz,           -- only verified payments count as collected
  notes text,
  created_at timestamptz not null default now()
);
create index payments_booking_idx on public.payments (booking_id);

-- ─── Activity log ───────────────────────────────────────────────────────────
-- Every automation writes here. dedupe_key makes automations idempotent:
-- inserting the same key twice is a no-op (on conflict do nothing).
create table public.activity_log (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  actor text not null default 'system',   -- 'admin' | 'system' | 'client' | 'cron'
  entity_type text not null,              -- 'booking' | 'client' | 'payment' | ...
  entity_id uuid,
  action text not null,                   -- e.g. 'booking.status_changed'
  summary text,
  details jsonb not null default '{}',
  dedupe_key text unique
);
create index activity_log_entity_idx on public.activity_log (entity_type, entity_id, at desc);

-- ─── Settings ───────────────────────────────────────────────────────────────
create table public.settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);
create trigger settings_touch before update on public.settings for each row execute function public.touch_updated_at();

-- ─── Derived money ──────────────────────────────────────────────────────────
-- Balance is never stored: it is always rate − verified payments.
create view public.booking_financials with (security_invoker = true) as
select
  b.id as booking_id,
  b.rate,
  b.deposit_amount,
  coalesce(sum(p.amount) filter (where p.verified_at is not null), 0)::numeric(12,2) as paid,
  greatest(b.rate - coalesce(sum(p.amount) filter (where p.verified_at is not null), 0), 0)::numeric(12,2) as balance,
  case
    when b.rate = 0 then 'n/a'
    when coalesce(sum(p.amount) filter (where p.verified_at is not null), 0) >= b.rate then 'paid'
    when coalesce(sum(p.amount) filter (where p.verified_at is not null), 0) > 0 then 'partial'
    else 'unpaid'
  end as payment_status
from public.bookings b
left join public.payments p on p.booking_id = b.id
group by b.id;

-- Monthly summary. Bookings are bucketed by event month; collected = verified
-- payments on those bookings (matches how his monthly sheets are organised).
create function public.month_summary(p_year int, p_month int)
returns jsonb
language sql stable security invoker set search_path = ''
as $$
  with bounds as (
    select make_date(p_year, p_month, 1) as m0
  ),
  periods(label, start_d) as (
    select 'current',   m0                         from bounds union all
    select 'prev',      (m0 - interval '1 month')::date from bounds union all
    select 'last_year', (m0 - interval '1 year')::date  from bounds
  ),
  agg as (
    select pr.label,
      count(b.id) filter (where b.status <> 'cancelled')                         as bookings,
      count(b.id) filter (where b.status = 'cancelled')                          as cancelled,
      coalesce(sum(f.rate)    filter (where b.status <> 'cancelled'), 0)          as expected,
      coalesce(sum(f.paid)    filter (where b.status <> 'cancelled'), 0)          as collected,
      coalesce(sum(f.balance) filter (where b.status <> 'cancelled'), 0)          as outstanding
    from periods pr
    left join public.bookings b
      on b.event_date >= pr.start_d and b.event_date < (pr.start_d + interval '1 month')::date
    left join public.booking_financials f on f.booking_id = b.id
    group by pr.label
  ),
  busiest as (
    select b.event_date, count(*) as n
    from public.bookings b, bounds
    where b.event_date >= bounds.m0 and b.event_date < (bounds.m0 + interval '1 month')::date
      and b.status <> 'cancelled'
    group by b.event_date
    order by n desc, b.event_date
    limit 5
  ),
  by_type as (
    select b.event_type, count(*) as n
    from public.bookings b, bounds
    where b.event_date >= bounds.m0 and b.event_date < (bounds.m0 + interval '1 month')::date
      and b.status <> 'cancelled'
    group by b.event_type
  )
  select jsonb_build_object(
    'current',   (select to_jsonb(a) - 'label' from agg a where label = 'current'),
    'prev',      (select to_jsonb(a) - 'label' from agg a where label = 'prev'),
    'last_year', (select to_jsonb(a) - 'label' from agg a where label = 'last_year'),
    'busiest',   coalesce((select jsonb_agg(jsonb_build_object('date', event_date, 'count', n)) from busiest), '[]'::jsonb),
    'by_type',   coalesce((select jsonb_object_agg(event_type, n) from by_type), '{}'::jsonb)
  )
$$;

-- ─── Row Level Security ─────────────────────────────────────────────────────
-- Phase 1: only admins can touch anything. Public/client access in later phases
-- goes through narrow security-definer RPCs, never through table policies.
alter table public.admins       enable row level security;
alter table public.clients      enable row level security;
alter table public.packages     enable row level security;
alter table public.bookings     enable row level security;
alter table public.payments     enable row level security;
alter table public.activity_log enable row level security;
alter table public.settings     enable row level security;

create policy admins_self_read on public.admins for select to authenticated using (user_id = auth.uid());

create policy admin_all on public.clients      for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy admin_all on public.packages     for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy admin_all on public.bookings     for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy admin_all on public.payments     for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy admin_all on public.activity_log for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy admin_all on public.settings     for all to authenticated using (public.is_admin()) with check (public.is_admin());

revoke all on function public.month_summary(int, int) from anon;

-- ─── Default settings ───────────────────────────────────────────────────────
-- Business rules (deposit %, hold duration, double-booking rule) are added in
-- Phase 2 once confirmed. Column layout mirrors his monthly sheet; editable in
-- Settings → Monthly sheet columns.
insert into public.settings (key, value) values
('business', jsonb_build_object(
  'name', 'Host Lester',
  'tagline', 'Events Host · Voice-over',
  'timezone', 'Asia/Manila',
  'currency', 'PHP'
)),
('sheet_columns', '[
  {"key": "day",        "label": "Day",      "visible": true},
  {"key": "date",       "label": "Date",     "visible": true},
  {"key": "client",     "label": "Client",   "visible": true},
  {"key": "event_type", "label": "Event",    "visible": true},
  {"key": "time",       "label": "Time",     "visible": true},
  {"key": "venue",      "label": "Venue",    "visible": true},
  {"key": "package",    "label": "Package",  "visible": true},
  {"key": "rate",       "label": "Rate",     "visible": true},
  {"key": "deposit",    "label": "Deposit",  "visible": true},
  {"key": "paid",       "label": "Paid",     "visible": true},
  {"key": "balance",    "label": "Balance",  "visible": true},
  {"key": "status",     "label": "Status",   "visible": true},
  {"key": "phone",      "label": "Contact",  "visible": false},
  {"key": "coordinator","label": "Coordinator","visible": false},
  {"key": "ref",        "label": "Ref",      "visible": false},
  {"key": "notes",      "label": "Notes",    "visible": true}
]'::jsonb);
