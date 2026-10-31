# Host Lester: Booking & Automation Portal

A private booking and business portal for **Host Lester** (events host / emcee and voice-over talent).
Each booking is entered once, and the calendar, records, exports and (in later phases) contracts, emails and reminders all build on it.

- **Stack:** Next.js 16 (App Router) · TypeScript · Supabase (Postgres, Auth, RLS) · Tailwind v4 + shadcn/ui
- **Locale:** PHP (₱), Asia/Manila
- **Brand:** logo and palette from [`Jefeeer/hostles`](https://github.com/Jefeeer/hostles): brand orange `#FF6600`, stage black `#0E0C0B`, cream `#F4ECDF`, Manrope

## Status

| Phase | Scope | Status |
|---|---|---|
| 1 | Auth, schema + RLS, bookings CRUD, Kanban pipeline, monthly calendar & sheet views, filters, summary, Excel/CSV/PDF export, clients, packages | ✅ Done |
| 2 | Business rules, double-booking check, Google Calendar sync, contracts + e-signature, emails (Resend) + Outbox | ✅ Done (rules are **defaults**, see below) |
| 3 | Client page + payment-proof upload, daily reminders (Vercel Cron), public booking page `/book` | ✅ Done |
| 4 | Special Events (series → editions, custom fields, flat / per-entry fees, duplicate, entry → booking), Google Sheets mirror | ✅ Done |

## Try it now: demo mode (no setup)

```bash
pnpm install
pnpm demo        # http://localhost:3000 · login: demo@hostlester.local / demo1234
```

Demo mode runs the real app against an **in-memory Postgres** (PGlite) built from the same migrations + seed. There's no Supabase, Docker or keys. Data resets when the server restarts. Emails go to **Outbox** (sidebar). Open a contract email there and click the link to sign as the client.

To walk through the full flow, open a booking, click **Send contract**, open the email in the Outbox, then sign it. The booking becomes **Signed** and the deposit email appears in the Outbox. Record the deposit as verified: the receipt is emailed and the booking moves to **Deposit Paid**.

## Setup (real database)

You need **Node 20.9+** and **pnpm**. Pick a database option.

### Option A: Hosted Supabase (no Docker)

1. Create a free project at [supabase.com](https://supabase.com). Choose the **Southeast Asia (Singapore)** region; it's the closest to Manila.
2. Copy the env template and fill it from **Project Settings → API**:
   ```bash
   cp .env.example .env.local
   # NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
   ```
3. Push the schema and demo data:
   ```bash
   pnpm install
   pnpm supabase login
   pnpm supabase link --project-ref <your-project-ref>
   pnpm supabase db push --include-seed     # drop --include-seed for production
   ```
4. In the dashboard, go to **Authentication → Sign In / Providers** and turn **off** "Allow new users to sign up".

### Option B: Local Supabase (Docker Desktop)

```bash
pnpm install
pnpm db:start            # starts Postgres/Auth/Storage, runs migrations + seed.sql
pnpm supabase status     # prints the URL + anon + service_role keys → put them in .env.local
```
`pnpm db:reset` wipes the local database and re-seeds it.

### Then (both options)

```bash
pnpm admin:create lester@example.com 'a-strong-password'   # sign-ups are disabled; this creates the admin
pnpm dev                                                    # http://localhost:3000
```

### Google Calendar (optional)

1. In [Google Cloud Console](https://console.cloud.google.com/): create a project, then enable the **Google Calendar API**.
2. Set up the **OAuth consent screen** (External, add Lester's Gmail as a test user).
3. Under **Credentials**, create an OAuth client ID of type **Web application**. Set the authorized redirect URI to `{APP_URL}/google/callback` (e.g. `http://localhost:3000/google/callback`).
4. Put `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` and a fresh `GOOGLE_TOKEN_KEY` in `.env.local`, then go to **Settings → Google Calendar → Connect**.

The refresh token is stored AES-256-GCM-encrypted. Holds appear as `[HOLD] …` (tentative, yellow). Signed and later statuses are confirmed (orange). Cancelling deletes the event.

### Phase 3 pieces

- **Client page `/p/<token>`**: booking details, balance, payment instructions, proof upload (JPG/PNG/WEBP/HEIC/PDF, 4 MB, file type checked by content), signed-contract download. Links arrive in the signed, receipt and reminder emails, or use **Get client page link** on a booking to share by Messenger. Proofs land unverified; view and verify them on the booking.
- **Proof storage**: the private Supabase Storage bucket `payment-proofs` (created by the migration). Demo mode keeps files in memory.
- **Reminders** (Settings → Reminders): balance due soon / on the day, program request, thank-you + review (fully paid only), holds expiring, and a morning digest to you. Each goes out once per booking. Vercel Cron calls `/api/cron/daily` at 00:00 UTC (8:00 AM Manila) with `CRON_SECRET`. On localhost use **Run today's reminders now**.
- **Public booking page `/book`**: packages, a calendar that only crosses out fully booked dates (no details shown), and an inquiry form. Each inquiry creates the client and booking, holds the date when it's clear, alerts you and auto-replies. Spam guards: a hidden field, a minimum fill time, and 20 inquiries an hour site-wide.

### Phase 4 pieces

- **Special events** (sidebar → Events): a series (e.g. Kasalang Tagaytay) has one edition per year. Each edition has its own entry fields (one per line: `Label | type | options`), a flat fee for the whole event or a fee per entry, and a CSV export. **Duplicate for next year** copies the setup without the entries. **Make booking** turns an entry into a normal client + booking; anything already paid becomes a verified payment, so it isn't counted twice.
- **Google Sheets mirror**: once Google is connected, the app creates its own spreadsheet ("Host Lester · Monthly records"). It writes one tab per month ("Oct 2026") using the same columns as the exports, refreshed each morning (this month and next) or with **Records → Sync to Sheet**. The mirror is push-only: edit in the app, not the sheet. It uses the `drive.file` scope, so the app can only see files it created. If you connected Google before Phase 4, disconnect and connect again.

### Email via Resend (optional)

Create an API key at [resend.com](https://resend.com), set `RESEND_API_KEY`, verify the sending domain, and set **Settings → Email → From**. Without a key, every email is saved to the **Outbox** instead.

## Scripts

| Script | What it does |
|---|---|
| `pnpm dev` / `build` / `start` | Next.js |
| `pnpm typecheck` / `lint` | Checks |
| `pnpm db:check` | Runs all migrations + seed in an **in-memory Postgres (PGlite)** and asserts RLS. No Docker needed. |
| `pnpm admin:create <email> <pw>` | Create or promote the admin user |
| `pnpm demo` | Run on localhost with the in-memory demo database |

## How it's built

- **One source of truth.** A single `bookings` table. "Monthly sheets" are queries, not files: `/records?y=2026&m=10`.
- **Money is derived, never stored.** `booking_financials` (view) = rate − verified payments → `paid`, `balance`, `payment_status`. Only **verified** payments count as collected.
- **Dates.** Events store a Manila-local `event_date` + `start_time`/`end_time`. Manila has no DST, so this is exact and avoids midnight-UTC bugs.
- **Monthly summary.** `month_summary(year, month)` RPC returns expected/collected/outstanding/busiest dates/by type for the month, last month and the same month last year. Bookings are grouped by **event month**.
- **Pipeline changes** all go through `transitionBooking()` (`src/lib/automations.ts`): Kanban, the form, and the client signing page alike. What runs on each move:
  - any status → sync Google Calendar
  - → Contract Sent → generate a contract from the default template, then email the signing link
  - → Signed → email deposit instructions
  - payment verified → receipt email, then auto-advance to Deposit Paid / Fully Paid
  - → Cancelled → void open contracts, remove the calendar event (cancellation email is off by default)
- **Double-booking check** (`src/lib/conflicts.ts`) runs live in the booking form and whenever a booking starts holding a date. It checks other bookings (max per day, hours between events) and Google Calendar. "Book anyway" overrides.
- **Contracts** are snapshots: the merged text is stored at send time, so editing the template never changes a sent contract. Links carry a random token; only its SHA-256 is stored. Links expire and are voided when re-sent. At signing the app records name, typed or drawn signature, time, IP and a SHA-256 fingerprint; these are printed on the PDF. PDFs are generated from that stored record, so no file storage is needed.
- **Activity log.** Every change writes to `activity_log`. Its unique `dedupe_key` makes automations idempotent: logging the same key twice is a no-op.
- **Security.** RLS on every table; only users in `admins` can read or write. Public and client pages (Phase 3) will use narrow `security definer` RPCs, never table access.
- **Sheet columns.** Order, labels and visibility live in `settings.sheet_columns` (Settings → Monthly sheet columns) and drive the table view and all exports.

### Layout

```
supabase/migrations/   schema, RLS, views, RPCs, default settings
supabase/seed.sql      demo data, dates relative to today (Filipino names, Cavite/Tagaytay/Manila venues)
src/proxy.ts           session refresh + auth redirect (Next 16 "proxy", formerly middleware)
src/lib/data.ts        queries (requireAdmin, listBookings, month summary…)
src/lib/automations.ts transitionBooking + logActivity
src/lib/sheet.ts       sheet column definitions shared by table + exports
src/app/(admin)/       dashboard, bookings (Kanban, detail, form), records (+ export), clients, settings
```

## Business rules: defaults in use (not yet confirmed)

Editable in **Settings → Business rules**. Current defaults: 30% deposit due 7 days after signing; balance due 7 days before the event; holds last 7 days (alert only); max 2 events a day with 3 hours between; VO projects don't block dates; signing links valid 14 days. The contract wording and payment instructions are placeholders too. Still to confirm:
- Deposit: % or fixed, and when it's due
- Balance due date and reminder timing
- Hold duration, and auto-release vs alert-only
- Double-booking rule: max events/day, buffer between events, and whether VO projects block dates
- Contract terms (cancellation / refund / rebooking)
- Column layout of the existing monthly Google Sheet
- Sending email domain for Resend
- Real GCash / bank details for the payment instructions
