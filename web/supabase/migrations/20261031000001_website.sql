-- HOST LESTER — public website (landing page) merged into the portal.
-- Content lives in public.settings under key 'site' (admin-only by RLS; public pages read it server-side).

-- Public bucket for photos/videos uploaded from the website editor. Uploads go through
-- signed upload URLs created by the server for admins, so no storage policies are needed.
-- 50 MB is the per-file cap on Supabase's free plan.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('site-media', 'site-media', true, 52428800,
        array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/webm', 'video/quicktime'])
on conflict (id) do nothing;
