-- 0055_property_developer.sql
-- Property listing wizard — make Developer a first-class, capturable field.
--
-- Until now a property's developer was only reachable indirectly and optionally
-- via development_id -> developments.developer_id. The listing editor now has a
-- required Developer picker, so we add a direct developer_id FK on properties.
--
-- The column is NULLABLE at the DB layer on purpose: the minimal "create draft"
-- action (app/(admin)/admin/properties/new) never sets it, so a fresh draft has
-- no developer yet. Requiredness is enforced in the app (propertyOverviewSchema
-- + the publish pre-flight gate), not by a NOT NULL constraint — that keeps the
-- create flow working and avoids failing inserts for legacy rows.
--
-- on delete restrict mirrors developments.developer_id: you can't delete a
-- developer that still has listings pointing at it.

set local search_path = public, auth, extensions;

alter table public.properties
  add column if not exists developer_id uuid references public.developers(id) on delete restrict;

-- Backfill existing rows from their development's developer where derivable.
update public.properties p
   set developer_id = d.developer_id
  from public.developments d
 where p.development_id = d.id
   and p.developer_id is null;

create index if not exists properties_developer_idx
  on public.properties (developer_id);
