-- HOST LESTER — Phase 2: business rules, Google Calendar, contracts + e-sign, emails.

-- ─── Business rules (DEFAULTS — not yet confirmed by Lester; editable in Settings) ──
insert into public.settings (key, value) values
('rules', jsonb_build_object(
  'deposit_percent', 30,          -- default deposit = 30% of rate
  'deposit_due_days', 7,          -- deposit due N days after signing
  'balance_due_days_before', 7,   -- balance due N days before the event
  'hold_days', 7,                 -- a hold lasts N days
  'hold_auto_release', false,     -- false = alert only
  'max_events_per_day', 2,
  'buffer_hours', 3,              -- minimum gap between two events on the same day
  'vo_blocks_calendar', false,    -- VO projects don't block event dates
  'contract_link_days', 14,       -- signing link expiry
  'confirmed', false              -- flips to true once Lester confirms these
)),
('email', jsonb_build_object(
  'from', 'Host Lester <onboarding@resend.dev>',
  'reply_to', null,
  'notify_email', 'lester@example.com',  -- where "new inquiry" alerts go
  'signature', E'Lester\nEvents Host · Voice-over'
)),
('payment_instructions', to_jsonb(E'GCash: 0917 XXX XXXX (Lester ...)\nBPI: XXXX-XXXX-XX (Lester ...)\n\nPlease send a screenshot of your payment with your booking reference.'::text))
on conflict (key) do nothing;

-- ─── Google Calendar ────────────────────────────────────────────────────────
-- Refresh token is AES-GCM encrypted by the app (GOOGLE_TOKEN_KEY); never readable by clients.
create table public.google_integrations (
  id int primary key default 1 check (id = 1),     -- single admin account
  email text,
  calendar_id text not null default 'primary',
  refresh_token_enc text not null,
  scopes text,
  connected_at timestamptz not null default now(),
  last_error text
);
alter table public.google_integrations enable row level security;
create policy admin_all on public.google_integrations for all to authenticated using (public.is_admin()) with check (public.is_admin());

alter table public.bookings
  add column google_event_id text,
  add column google_synced_at timestamptz;

-- ─── Contracts ──────────────────────────────────────────────────────────────
create table public.contract_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  body text not null,               -- "# Heading" lines + paragraphs, with {{merge_fields}}
  version int not null default 1,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index contract_templates_one_default on public.contract_templates (is_default) where is_default;
create trigger contract_templates_touch before update on public.contract_templates for each row execute function public.touch_updated_at();

create type public.contract_status as enum ('sent', 'signed', 'void');

create table public.contracts (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings (id) on delete cascade,
  template_id uuid references public.contract_templates (id) on delete set null,
  template_version int,
  title text not null,
  body text not null,               -- merged snapshot: what the client actually signs
  status public.contract_status not null default 'sent',
  token_hash text not null unique,  -- sha256 of the link token; the token itself is never stored
  expires_at timestamptz not null,
  viewed_at timestamptz,
  signer_name text,
  signature_text text,              -- typed signature
  signature_image text,             -- drawn signature (PNG data URL)
  signed_at timestamptz,
  signer_ip text,
  signer_user_agent text,
  content_hash text,                -- sha256(body + signature + signed_at) at signing
  created_at timestamptz not null default now()
);
create index contracts_booking_idx on public.contracts (booking_id, created_at desc);
-- At most one open (sent) contract per booking.
create unique index contracts_one_open on public.contracts (booking_id) where status = 'sent';

-- ─── Emails ─────────────────────────────────────────────────────────────────
create table public.email_templates (
  key text primary key,             -- e.g. 'contract_sent'
  name text not null,
  description text,
  subject text not null,
  body text not null,               -- paragraphs with {{merge_fields}}
  enabled boolean not null default true,
  updated_at timestamptz not null default now()
);
create trigger email_templates_touch before update on public.email_templates for each row execute function public.touch_updated_at();

-- Every email the app sends (or would send, without a Resend key) lands here.
create table public.email_outbox (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  template_key text,
  booking_id uuid references public.bookings (id) on delete set null,
  to_email text not null,
  subject text not null,
  html text not null,
  text_body text not null,
  status text not null default 'queued',   -- sent | simulated | failed | skipped
  provider_id text,
  error text
);
create index email_outbox_created_idx on public.email_outbox (created_at desc);

alter table public.contract_templates enable row level security;
alter table public.contracts          enable row level security;
alter table public.email_templates    enable row level security;
alter table public.email_outbox       enable row level security;
create policy admin_all on public.contract_templates for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy admin_all on public.contracts          for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy admin_all on public.email_templates    for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy admin_all on public.email_outbox       for all to authenticated using (public.is_admin()) with check (public.is_admin());
-- Clients reach their contract only through the server (service role) after the
-- token hash matches; there is deliberately no anon policy.

-- ─── Default templates (DEFAULT wording — review with Lester) ───────────────
insert into public.contract_templates (name, is_default, body) values
('Hosting Services Agreement', true, $tpl$# Hosting Services Agreement

Reference: {{ref}} · Date issued: {{today}}

This agreement is between {{host_name}} ("the Host") and {{client_name}} ("the Client") for hosting services at the event below.

# Event details

Event: {{event_title}} ({{event_type}})
Date: {{event_date}}
Time: {{event_time}}
Venue: {{venue}}
Package: {{package}}

# Fees and payment

Total professional fee: {{rate}}
Reservation deposit: {{deposit}}, due on or before {{deposit_due}}. The date is only secured once the deposit is received.
Remaining balance: {{balance}}, due on or before {{balance_due}}.
Payments may be made via GCash or bank transfer. Please send proof of payment with the booking reference.

# Program and preparation

The Client will send the final program, timeline, names (with pronunciation) and special segments at least one (1) week before the event. The Host will coordinate with the Client's coordinator for the run of show.

# Cancellation and rebooking

The reservation deposit is non-refundable. If the Client cancels, payments made beyond the deposit will be refunded less any costs already incurred. The event may be moved to a new date once, within twelve (12) months, subject to the Host's availability.

# Overtime

Services beyond the agreed time are charged at a rate to be agreed with the Host on the day.

# Force majeure

Neither party is liable for failure to perform due to causes beyond reasonable control (e.g. typhoons, government restrictions). Both parties will work in good faith to reschedule.

# Agreement

By signing below, the Client confirms they have read and agree to these terms.
$tpl$);

insert into public.email_templates (key, name, description, subject, body) values
('inquiry_autoreply', 'Inquiry auto-reply', 'To the client when an inquiry comes in',
 'Thank you for your inquiry, {{client_first_name}}!',
 $t$Hi {{client_first_name}},

Thank you for considering me for {{event_title}} on {{event_date}}! I've received your inquiry and I'm holding the date for you until {{hold_until}}.

I'll get back to you shortly with the details. Feel free to reply to this email with any questions.

{{signature}}$t$),
('new_inquiry_admin', 'New inquiry (to you)', 'Notifies you about a new inquiry',
 'New inquiry: {{event_title}} · {{event_date}}',
 $t$New inquiry from {{client_name}} ({{client_phone}}, {{client_email}}).

Event: {{event_title}} ({{event_type}})
Date: {{event_date}} {{event_time}}
Venue: {{venue}}

Open it: {{booking_url}}$t$),
('contract_sent', 'Contract ready to sign', 'Sent with the signing link when a booking moves to Contract Sent',
 'Your contract for {{event_title}} · please review & sign',
 $t$Hi {{client_first_name}},

Your hosting agreement for {{event_title}} on {{event_date}} is ready. Please review and sign it here:

{{contract_url}}

This link expires on {{contract_expires}}. Once signed, I'll send the deposit details to secure your date.

{{signature}}$t$),
('contract_signed', 'Signed + deposit instructions', 'After the client signs',
 'Signed! Next step: your reservation deposit ({{deposit}})',
 $t$Hi {{client_first_name}},

Thank you for signing! Your date ({{event_date}}) will be fully secured once the reservation deposit of {{deposit}} is received, on or before {{deposit_due}}.

{{payment_instructions}}

You can download your signed contract here: {{contract_url}}

{{signature}}$t$),
('payment_receipt', 'Payment receipt', 'When you verify a payment',
 'Payment received: {{payment_amount}} · {{ref}}',
 $t$Hi {{client_first_name}},

I've received your payment of {{payment_amount}} for {{event_title}}. Thank you!

Total fee: {{rate}}
Paid so far: {{paid}}
Remaining balance: {{balance}}{{balance_due_line}}

{{signature}}$t$),
('booking_cancelled', 'Booking cancelled', 'When a booking is cancelled (off by default)',
 'Booking cancelled · {{event_title}}',
 $t$Hi {{client_first_name}},

This confirms that the booking for {{event_title}} on {{event_date}} has been cancelled.

{{signature}}$t$);

update public.email_templates set enabled = false where key = 'booking_cancelled';
