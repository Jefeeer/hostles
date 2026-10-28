# Lester Events Host — Next.js site + demo admin

```
npm install
npm run build && npm start     # http://localhost:3003  (or: npm run dev)
```

- Site: `/` (cover, about, videos, feedback, gallery, inquiry), `/videos`, `/gallery`
- Admin: `/admin`, password `lester-demo` (override with `ADMIN_PASSWORD=...`)
- Content is saved to `data/site.json` (until the first save, `data/site.default.json` is used); uploads go to `data/uploads/`.
  "Restore demo content" in the admin deletes `site.json`, so the defaults are used again.

Demo limits: one shared password; content and uploads are stored on the local disk, so this
does not persist on Vercel — move content to a database and uploads to Blob storage before going live.
