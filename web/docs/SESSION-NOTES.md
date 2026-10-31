# Host Lester: build session notes

**Dates:** 2026-10-28 → 2026-10-29
**Project:** `C:\Users\ThinkPad\Documents\host-lester`
**What it is:** a private booking and automation portal for Lester, a Philippines wedding host / emcee and VO talent.
**Status:** all 4 phases from the spec are built and verified in demo mode, plus UI refinements. Nothing is committed to git yet.

---

## 1. Run it

```bash
cd host-lester
pnpm install
pnpm demo          # http://localhost:3000
```

- **Login:** `demo@hostlester.local` / `demo1234` (pre-filled on the login page)
- **Demo mode:** an in-memory Postgres (PGlite) is built from the real migrations and seed. No Supabase, Docker or API keys are needed.
- **Data resets** every time the server restarts.
- **Emails** are not sent. They land in **Outbox** (sidebar), and the links inside them work.
- **Public pages** need no login:
  - `/book`: inquiry form
  - `/c/<token>`: contract signing
  - `/p/<token>`: client page

| Command | Does |
|---|---|
| `pnpm demo` | Run on localhost with the in-memory demo DB |
| `pnpm dev` | Run against a real Supabase (needs `.env.local`) |
| `pnpm db:check` | Run all migrations + seed in PGlite and assert RLS |
| `pnpm lint` / `pnpm typecheck` / `pnpm build` | Static checks / production build |
| `pnpm admin:create <email> <pw>` | Create the single admin (real Supabase) |

Full setup for Supabase, Google Cloud OAuth, Resend and Vercel Cron is in `README.md`.

---

## 2. Stack and key decisions

**Framework and data:**
- Next.js 16 (App Router, Turbopack) + TypeScript.
- Next 16 specifics: `proxy.ts` instead of middleware; `cacheComponents: false`, because every page is per-user.
- Supabase: Postgres, Auth with a single admin and sign-ups disabled, Storage, and RLS via `is_admin()`.
- Tailwind v4 + shadcn/ui (radix, nova). Zod 4, date-fns + `@date-fns/tz`.
- Locale: PHP ₱, timezone Asia/Manila.

**Integrations and documents:**
- googleapis for Calendar + Sheets; the OAuth refresh token is AES-256-GCM encrypted.
- Resend + React Email.
- `@react-pdf/renderer` for PDFs; exceljs for Excel.
- Vercel Cron.

**Branding:**
- Taken from GitHub `Jefeeer/hostles`: the orange script "Lester" logo.
- Palette: brand `#FF6600`, deep `#C24700`, stage `#0E0C0B`, cream `#F4ECDF`, ink `#17110C`, gold `#E9C46A`.
- Font: Manrope.
- Orange buttons use dark text, because white on orange fails contrast.

**Design rules held throughout:**
- **Money is derived, never stored.** The `booking_financials` view computes balance = rate − *verified* payments.
- **One entry point for pipeline moves:** `transitionBooking()` in `src/lib/automations.ts`.
- **Automations are idempotent.** `activity_log.dedupe_key` stops anything running twice, and every step is logged and never throws.
- **Contracts are snapshots.** The merged text is stored at send time. Links carry a random token; only its SHA-256 is stored.
- **Server actions return `{ ok, error, conflicts }` instead of throwing**, because Next hides thrown messages in production.

---

## 3. What was built

### Phase 1: core
- Auth (single admin), schema + RLS.
- Bookings Kanban pipeline: Inquiry → On Hold → Contract Sent → Signed → Deposit Paid → Fully Paid → Done (+ Cancelled), with drag-and-drop via dnd-kit.
- Bookings CRUD and clients.
- Packages and rates.
- Dashboard.
- Monthly records:
  - calendar grid, plus an agenda list on phones;
  - a sheet table with configurable columns that mirror his Google Sheet;
  - filters and a month summary compared with last month and last year;
  - Excel / CSV / PDF export.
- Seed: 170 realistic bookings (Filipino names; Cavite, Tagaytay and Manila venues).
- PWA icons and manifest from the logo.

### Phase 2: rules, calendar, contracts, email
- **Business rules** are editable in Settings (defaults in §5).
- **Double-booking check** against the database and Google Calendar: max events per day, buffer hours, VO exemption. It shows live in the form, with a "Book anyway" override.
- **Google Calendar sync:** holds show as `[HOLD]` (tentative, yellow) and turn confirmed (orange) once signed. Cancelling deletes the event.
- **Contracts + e-signature:**
  - The contract is generated from a template with merge fields and gets an expiring link.
  - The client signs typed or drawn.
  - The record keeps name, time, IP and a SHA-256 fingerprint, and a PDF is generated.
- **Emails** for the automatic auto-reply, new inquiry, contract sent/signed, receipt and cancellation, with templates editable in Settings. With no Resend key, emails go to the **Outbox**.

### Phase 3: client page, reminders, public booking
- **Client page `/p/<token>`:**
  - booking details, balance and payment instructions;
  - **payment-proof upload** (JPG/PNG/WEBP/HEIC/PDF, 4 MB, file type checked by content, photos shrunk in the browser);
  - signed-contract download.
- **Proofs** go to a private Storage bucket and arrive unverified. "View proof" and verify are on the booking; verifying sends a receipt and auto-advances the status.
- **Daily reminders** (Vercel Cron 8 AM Manila, or **Run now** in Settings):
  - balance due soon / today;
  - program request;
  - thank-you + review (fully paid only);
  - holds expiring;
  - morning digest to Lester.
- **Public `/book`:**
  - packages, and an availability calendar that only crosses out fully booked dates;
  - an inquiry form that creates the client and booking, holds the date when it's clear, alerts Lester and auto-replies;
  - spam guards: a hidden field, a minimum fill time, and a cap of 20 an hour.

### Phase 4: special events + Sheets
- **Special Events** (`/events`): series → editions (e.g. Kasalang Tagaytay 2025 / 2026).
  - Each edition has its own entry fields (`Label | type | options`).
  - Fees are flat for the whole event or per entry.
  - **Duplicate for next year** copies the setup without entries.
  - **Make booking** turns an entry into a client + booking, carrying any amount paid over without counting it twice.
  - Entries export to CSV.
- **Google Sheets mirror:**
  - The app creates its own spreadsheet, with one tab per month ("Oct 2026") and the same columns as the exports.
  - It refreshes every morning, or with **Records → Sync to Sheet**.
  - It is push-only and uses the `drive.file` scope, so the app sees only files it created.

### UI refinements (after the phases)
- **Drawers instead of page jumps:**
  - New booking / New client / New edition open in a right-side drawer, using intercepting routes in `src/app/(admin)/@drawer/`.
  - Clicking a booking in the calendar, agenda or sheet view opens a summary drawer on Records (`?booking=<id>`).
  - Opening those links directly still loads the full page.
- **Dark-mode dropdown fix:** `color-scheme` follows the theme, so native selects, date/time pickers and scrollbars match it. Options were previously unreadable.
- **Light / Dark / System switch:** in the sidebar, plus a sun/moon button in the phone header. It is stored per device and applied in `<head>` before paint (no flash). Toasts follow it too.
- **Smaller sidebar logo** (56px, "EVENTS HOST" beside it). The sidebar scrolls when the window is short.

---

## 4. Verification done

| Area | How | Result |
|---|---|---|
| SQL (4 migrations + seed + RLS) | `pnpm db:check` in PGlite | ✅ non-admin sees 0 rows, admin sees 170 |
| Phase 1–4 logic | Throwaway scripts against the demo DB (24 checks across all phases, plus 19 for the Phase 2 flow) | ✅ all passed |
| Contract PDFs | Rendered typed / drawn / unsigned | ✅ |
| Every page + export | HTTP sweep with and without login | ✅ admin pages need login; public pages open |
| Drawers | Clicked through in Edge (headless, playwright-core in scratchpad) | ✅ 14/14, no browser errors |
| Themes + dropdown contrast | Edge, Windows set to dark and to light | ✅ 21/21; options 15:1 (dark), 19:1 (light) |
| Static | `pnpm lint`, `pnpm typecheck`, `pnpm build` | ✅ |

**Bugs found and fixed during verification:**
- The thank-you email went to a couple who still owed money; it now goes to fully paid bookings only.
- `/book` was prerendered at build time; it is now dynamic, so availability stays live.
- Both sample editions were named "2026"; the past one is now a year earlier.
- A drawer catch-all route made `/login`, `/book`, `/p`, `/c` return 404. I replaced it with a URL check inside the drawer.
- The drawer wasn't full width on phones.
- A ColorZilla browser extension caused a hydration warning (`suppressHydrationWarning` on `<html>`/`<body>`).

**Not verified (needs real accounts):**
- Google Calendar / Sheets with a real Google account.
- Real email through Resend.
- Supabase Storage uploads.
- Vercel Cron on a deployment.

Without keys, each of these skips safely and logs why in the booking's activity log.

---

## 5. Business rules: defaults in use (not confirmed)

The user said to use defaults until Lester confirms. Change them in **Settings → Business rules**, which shows "Defaults, not yet confirmed".

| Rule | Default |
|---|---|
| Deposit | 30% of the rate, due 7 days after signing |
| Balance | due 7 days before the event |
| Holds | 7 days, alert only (no auto-release) |
| Double-booking | max 2 events per day, 3 hours between |
| VO projects | don't block dates |
| Signing links | expire after 14 days |
| Public inquiries | hold the date automatically when it's free |

**Placeholders still to replace:**
- contract wording;
- GCash / bank details (payment instructions);
- review link (Facebook placeholder);
- sending email domain;
- notify email (`lester@example.com`);
- the column order of his real Google Sheet.

---

## 6. Where things live

```
supabase/migrations/
  …0001_core.sql       bookings, clients, packages, payments, activity_log, settings, financials view, month_summary
  …0002_phase2.sql     rules/email settings, google_integrations, contracts + templates, email_templates, email_outbox
  …0003_phase3.sql     booking_links, payment proofs bucket, reminder_rules, public_busy_dates()
  …0004_phase4.sql     event_series / event_editions / edition_entries, Sheets columns
supabase/seed.sql      170 bookings + Kasalang Tagaytay editions

src/lib/
  automations.ts       transitionBooking(), onPaymentVerified(): every pipeline side effect
  conflicts.ts         double-booking rules
  contracts.ts         issue / find / sign contracts
  email.tsx            sendTemplateEmail() (Resend or Outbox, deduped)
  google.ts, sheets.ts Calendar sync, Sheets mirror
  portal.ts, payments.ts, storage.ts   client page links, proof uploads
  reminders.ts         runDailyJobs()
  events.ts            special events: fields, totals, duplicate, convert
  demo/                PGlite DB + supabase-js-compatible adapter (demo mode only)

src/app/
  (admin)/             all admin pages; @drawer/ = intercepted "new" drawers
  book/                public inquiry page
  c/[token]/           contract signing
  p/[token]/           client page
  api/cron/daily/      Vercel Cron endpoint (CRON_SECRET)
src/components/
  route-drawer.tsx     right-side drawer
  theme.tsx            theme script, switches, toaster
```

---

## 7. Next steps

1. **Confirm business rules** and replace the placeholders (§5).
2. **Commit to git.** Nothing is committed yet.
3. **Go live:**
   - Create a Supabase project and run the migrations.
   - Run `pnpm admin:create`.
   - Set up Google Cloud OAuth: enable the Calendar API; redirect URI `{APP_URL}/google/callback`.
   - Add a Resend key and verify the domain.
   - Deploy to Vercel with `CRON_SECRET`.
   - The steps are in `README.md`.
4. Then test the real integrations listed under "Not verified" above.

**Optional ideas raised but not built:**
- Open the Kanban card details in the drawer too.
- Push to the Sheet on every booking change, not just daily and on demand.
