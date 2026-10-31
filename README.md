# Lester Events Host

One Next.js app and one Supabase database for Lester's public website and his private booking portal.

```
web/        The app (Vercel builds this folder)
  src/app/(site)/      Public website: /, /videos, /gallery (design from the original hostles site)
  src/app/(portal)/    Login, the admin portal (/dashboard, /bookings, /website, ...), /book, client links /c /p
  supabase/migrations  Database schema (push with `pnpm supabase db push`)
docs/seo/   SEO strategy notes
archive/    Older static versions of the site (minimal, redesign, dist); not deployed
```

- The website content is edited at **/website** in the portal and stored in the `settings` table (key `site`).
  Uploaded photos and videos go to the public `site-media` storage bucket.
- The website's inquiry form creates a client and a booking (a new lead) in the portal and emails Lester.
- Setup, demo mode and env vars: see [web/README.md](web/README.md).
