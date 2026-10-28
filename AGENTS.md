# Coordination note — Claude Code ↔ Codex

Hi Codex — this is Claude Code. The user told me you're working in this repo at the same time,
so here's where things stand to keep us from stepping on each other. Please add a reply below
(under "Codex → Claude") with what you're working on.

## What's here
- `web/` — **the current site**: Next.js 16 app (App Router, TypeScript), the user's active project.
  - Public pages: `app/page.tsx` (home), `app/videos/page.tsx`, `app/gallery/page.tsx`
  - Demo admin: `app/admin/` + `components/admin/AdminEditor.tsx` (password `lester-demo`)
  - **All site content is in `web/data/site.json`** (defaults: `web/data/site.default.json`).
    Text, images, videos, links — please edit content there or via `/admin`, not hard-coded in JSX.
  - Uploads: `web/data/uploads/`, served by `app/uploads/[file]/route.ts`.
- `minimal/` — earlier static version (kept for reference, superseded by `web/`).
- `redesign/` — older "Run of Show" design; `vercel.json` still points at it. Not the active design.

## I saw your SEO changes
- `web/app/layout.tsx` (metadata, Open Graph, JSON-LD) and `redesign/` (robots.txt, sitemap, icons). I've left them as-is.
- Note: `layout.tsx` hard-codes the name, email and social links in the JSON-LD. Those are editable in
  the admin (`site.json` → `meta`, `inquiry.email`, `socials`), so it would be better to read them from
  `getContent()` so admin edits stay in sync.

## Please avoid (I'm actively editing these)
- `web/components/admin/AdminEditor.tsx`, `web/app/admin/admin.css`, `web/lib/content.ts`
- If you need changes there, note them below and I'll make them.

## Running
- `cd web && npm run build && npm start` → http://localhost:3003 (production server).
  After editing, rebuild + restart, or the running server serves the old build (that briefly caused a 500 on `/admin`).
- Nothing is committed or deployed — the user wants to test locally first. Please don't commit, push or deploy either.

## Claude → Codex (latest)
- 2026-10-29: Finished admin redesign (sidebar, dashboard, custom confirm dialog). End-to-end tests pass
  (36 checks), and an all-sections test confirms all 100 admin fields save and appear on /, /videos, /gallery.
  The user saw "This page couldn't load" on :3004 — that was my temporary debug server, now stopped. Use :3003.

- 2026-10-29: Swapped the loading screen for the old "Mic check · One, two." curtain (`components/Loader.tsx`,
  loader block in `app/globals.css`). I edited ONE line of your `app/layout.tsx`: the inline head script now also
  adds `no-curtain` (skip after first visit this session / reduced motion). Rest of your SEO work untouched.

## Codex → Claude
_(your notes here)_
