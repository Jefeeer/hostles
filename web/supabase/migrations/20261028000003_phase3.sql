-- HOST LESTER — Phase 3: client portal + payment proofs, reminders, public booking page.

-- ─── Client portal links ────────────────────────────────────────────────────
-- Each email can mint a fresh link; only the SHA-256 of the token is stored.
create table public.booking_links (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings (id) on delete cascade,
  token_hash text not null unique,
  purpose text not null default 'portal',
  expires_at timestamptz not null,
  last_used_at timestamptz,
  created_at timestamptz not null default now()
);
create index booking_links_booking_idx on public.booking_links (booking_id);
alter table public.booking_links enable row level security;
create policy admin_all on public.booking_links for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ─── Payment proofs ─────────────────────────────────────────────────────────
alter table public.payments
  add column submitted_by text not null default 'admin',   -- 'admin' | 'client'
  add column proof_content_type text;

-- Private bucket; files are only read through the admin app (service role).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('payment-proofs', 'payment-proofs', false, 5242880,
        array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'application/pdf'])
on conflict (id) do nothing;

-- ─── Reminder rules (editable; run by the daily job) ────────────────────────
create table public.reminder_rules (
  key text primary key,
  name text not null,
  description text,
  template_key text references public.email_templates (key),
  offset_days int not null default 0,
  enabled boolean not null default true,
  sort_order int not null default 0
);
alter table public.reminder_rules enable row level security;
create policy admin_all on public.reminder_rules for all to authenticated using (public.is_admin()) with check (public.is_admin());

insert into public.settings (key, value) values
('review_link', to_jsonb('https://www.facebook.com/'::text))
on conflict (key) do nothing;

insert into public.email_templates (key, name, description, subject, body) values
('payment_submitted_admin', 'Payment proof uploaded (to you)', 'A client uploaded a GCash/bank proof',
 'Payment proof: {{payment_amount}} · {{event_title}}',
 $t${{client_name}} uploaded a payment proof of {{payment_amount}} ({{payment_method}}, ref {{payment_reference}}) for {{event_title}} on {{event_date}}.

Verify it here: {{booking_url}}$t$),
('payment_submitted', 'Proof received (to client)', 'Confirms the upload to the client',
 'Got your payment proof · {{ref}}',
 $t$Hi {{client_first_name}},

Thank you! I've received your payment proof of {{payment_amount}}. I'll confirm once it reflects in my account, and you'll get a receipt.

Your booking page: {{portal_url}}

{{signature}}$t$),
('balance_reminder', 'Balance reminder', 'Before the balance due date',
 'Reminder: remaining balance of {{balance}} due {{balance_due}}',
 $t$Hi {{client_first_name}},

A friendly reminder that the remaining balance of {{balance}} for {{event_title}} ({{event_date}}) is due on or before {{balance_due}}.

{{payment_instructions}}

You can upload your proof of payment here: {{portal_url}}

{{signature}}$t$),
('program_request', 'Program & timeline request', 'About a week before the event',
 'One week to go! Please send your program & timeline',
 $t$Hi {{client_first_name}},

We're one week away from {{event_title}} on {{event_date}}!

To make sure everything flows perfectly, please send me:
- Final program and timeline
- Names of the entourage / VIPs, with pronunciation
- Special segments, games or surprises
- Your coordinator's contact number

Just reply to this email. Excited to host for you!

{{signature}}$t$),
('thank_you', 'Thank you + review request', 'The day after the event',
 'Thank you, {{client_first_name}}!',
 $t$Hi {{client_first_name}},

Thank you for letting me be part of {{event_title}}! It was an honor to host for you.

If you have a minute, a short review would mean a lot: {{review_link}}

{{signature}}$t$),
('admin_digest', 'Daily digest (to you)', 'Your morning summary',
 'Today: {{digest_title}}',
 $t${{digest_body}}

Open the dashboard: {{app_url}}$t$);

-- Point clients to their portal after signing and in receipts.
update public.email_templates set body = $t$Hi {{client_first_name}},

Thank you for signing! Your date ({{event_date}}) will be fully secured once the reservation deposit of {{deposit}} is received, on or before {{deposit_due}}.

{{payment_instructions}}

Upload your proof of payment and download your signed contract here: {{portal_url}}

{{signature}}$t$ where key = 'contract_signed';

update public.email_templates set body = $t$Hi {{client_first_name}},

I've received your payment of {{payment_amount}} for {{event_title}}. Thank you!

Total fee: {{rate}}
Paid so far: {{paid}}
Remaining balance: {{balance}}{{balance_due_line}}

Your booking page: {{portal_url}}

{{signature}}$t$ where key = 'payment_receipt';

insert into public.reminder_rules (key, name, description, template_key, offset_days, sort_order) values
('balance_due_soon', 'Balance due soon', 'Days before the balance due date', 'balance_reminder', 3, 1),
('balance_due_today', 'Balance due today', 'On the balance due date (0 = that day)', 'balance_reminder', 0, 2),
('program_request', 'Send your program', 'Days before the event', 'program_request', 7, 3),
('thank_you', 'Thank you + review', 'Days after the event', 'thank_you', 1, 4),
('hold_expiring', 'Holds expiring (to you)', 'Alert when a hold expires within N days', null, 1, 5),
('admin_digest', 'Daily digest (to you)', 'Morning summary of upcoming events and to-dos', 'admin_digest', 0, 6);

-- ─── Public availability (no event details) ─────────────────────────────────
-- Dates that are fully booked, for the public booking page. Callable without login.
create function public.public_busy_dates(p_from date, p_to date)
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select coalesce(jsonb_agg(d order by d), '[]'::jsonb) from (
    select b.event_date as d
    from public.bookings b
    where b.event_date between p_from and p_to
      and b.status in ('on_hold', 'contract_sent', 'signed', 'deposit_paid', 'fully_paid', 'done')
      and (b.event_type <> 'vo_project'
           or coalesce((select (value->>'vo_blocks_calendar')::boolean from public.settings where key = 'rules'), false))
    group by b.event_date
    having count(*) >= coalesce((select (value->>'max_events_per_day')::int from public.settings where key = 'rules'), 2)
  ) busy
$$;
grant execute on function public.public_busy_dates(date, date) to anon, authenticated;

-- Public-form inquiries may or may not get a hold (it depends on conflicts).
update public.email_templates set body = $t$Hi {{client_first_name}},

Thank you for considering me for {{event_title}} on {{event_date}}! I've received your inquiry{{hold_line}}.

I'll get back to you shortly with the details. Feel free to reply to this email with any questions.

{{signature}}$t$ where key = 'inquiry_autoreply';
