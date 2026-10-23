-- 0170 · Only what is live on the site keeps an area from being deleted.
--
-- 0167's guard counted every listing and project pointing at an area —
-- drafts, listings in review, off-market and archived ones, soft-deleted rows,
-- unpublished projects. None of those is on the site, yet any one of them
-- refused the delete, so an editor tidying the catalogue was told to move
-- records nobody can see.
--
-- What blocks now is what the public can read, by the same rules as the
-- public RLS policies:
--   · a listing with status = 'published' and deleted_at is null
--     (properties_public_read, 0001);
--   · a project with published_at set (developments_public_read, 0009);
--   · any area inside it, as before — a child area is part of the hierarchy,
--     not a record that can be left without one.
--
-- Everything else pointing at the area is detached in the same transaction:
-- its area_id / sub_community_id / building_id set to null, so the ON DELETE
-- RESTRICT foreign keys (kept as the backstop for live rows) don't refuse.
-- The record survives, unplaced, and needs an area before it goes live again.
-- The CMS names those records before the delete and writes their ids into
-- the audit entry.

create or replace function public.areas_guard_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  n_properties int;
  n_developments int;
  n_children int;
  parts text[] := '{}';
begin
  select count(*) into n_properties
    from public.properties
   where old.id in (area_id, sub_community_id, building_id)
     and status = 'published'
     and deleted_at is null;
  select count(*) into n_developments
    from public.developments
   where area_id = old.id
     and published_at is not null;
  select count(*) into n_children
    from public.areas where parent_id = old.id;

  if n_properties + n_developments + n_children = 0 then
    update public.properties set area_id = null where area_id = old.id;
    update public.properties set sub_community_id = null where sub_community_id = old.id;
    update public.properties set building_id = null where building_id = old.id;
    update public.developments set area_id = null where area_id = old.id;
    return old;
  end if;

  if n_properties > 0 then
    parts := parts || format('%s published %s', n_properties,
      case when n_properties = 1 then 'listing' else 'listings' end);
  end if;
  if n_developments > 0 then
    parts := parts || format('%s published %s', n_developments,
      case when n_developments = 1 then 'project' else 'projects' end);
  end if;
  if n_children > 0 then
    parts := parts || format('%s %s inside it', n_children,
      case when n_children = 1 then 'area' else 'areas' end);
  end if;

  raise exception 'Area "%" is still in use by %. Move them to another area first.',
    old.name,
    case when cardinality(parts) = 1 then parts[1]
         else array_to_string(parts[1:cardinality(parts) - 1], ', ')
              || ' and ' || parts[cardinality(parts)] end
    using errcode = 'foreign_key_violation',
          hint = 'Reassign the published listings, projects and areas inside it, then delete again.';
end;
$$;

revoke all on function public.areas_guard_delete() from public, anon, authenticated;

comment on function public.areas_guard_delete() is
  'Refuses to delete an area that a published listing, published project or child area still points at; detaches unpublished listings and projects instead (0167, 0170). The ON DELETE RESTRICT foreign keys are the backstop.';
