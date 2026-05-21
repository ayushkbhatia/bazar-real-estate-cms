-- 0002_storage.sql
-- Supabase Storage bucket "media" + RLS policies.
-- Bucket is public-read. Writes are gated by the public.is_staff() helper
-- from 0001_core.sql.

-- Idempotent bucket creation
insert into storage.buckets (id, name, public)
  values ('media', 'media', true)
  on conflict (id) do update set public = excluded.public;

-- Public read of every object in the bucket.
drop policy if exists "media_public_read" on storage.objects;
create policy "media_public_read"
  on storage.objects for select
  using (bucket_id = 'media');

-- Staff-only upload.
drop policy if exists "media_staff_insert" on storage.objects;
create policy "media_staff_insert"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'media' and public.is_staff());

-- Staff-only update (e.g. metadata).
drop policy if exists "media_staff_update" on storage.objects;
create policy "media_staff_update"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'media' and public.is_staff())
  with check (bucket_id = 'media' and public.is_staff());

-- Staff-only delete.
drop policy if exists "media_staff_delete" on storage.objects;
create policy "media_staff_delete"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'media' and public.is_staff());
