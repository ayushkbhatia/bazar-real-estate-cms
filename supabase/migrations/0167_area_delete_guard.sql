-- 0167 · An area can't be deleted while anything still sits in it.
--
-- Every column that places a record in an area was ON DELETE SET NULL (0001):
-- deleting an area quietly emptied `properties.area_id`, `sub_community_id`
-- and `building_id`, `developments.area_id`, and the `parent_id` of every area
-- inside it. The listing or project survived but lost its location — it fell
-- out of every area filter, its breadcrumb and map context went blank, and a
-- sub-community became a top-level area. Nothing said so, and nothing could
-- put the link back.
--
-- The CMS now offers a delete (Pages & blocks → Areas → Record), refused while
-- the area is in use. This makes the database refuse it too, whatever deletes
-- the row — the CMS, the API with a service key, or the SQL editor:
--
--   1. Those five foreign keys become ON DELETE RESTRICT.
--   2. A BEFORE DELETE trigger raises first, naming what is still linked, so
--      the error explains itself instead of quoting a constraint name.
--
-- Left as they were, deliberately:
--   · `area_guides.area_id` CASCADE — the guide is the area's own page content
--     and means nothing without it.
--   · `valuation_requests.area_id` SET NULL — a lead's answer to "where is the
--     property"; the request stands without it, and a lead must never be the
--     reason an editor can't tidy the catalogue.
--
-- Existing rows already satisfy every constraint (they are the same columns),
-- so re-adding them can't fail. Safe to apply before the code: nothing
-- deployed deletes areas today.

alter table public.properties
  drop constraint properties_area_id_fkey,
  add constraint properties_area_id_fkey
    foreign key (area_id) references public.areas(id) on delete restrict,
  drop constraint properties_sub_community_id_fkey,
  add constraint properties_sub_community_id_fkey
    foreign key (sub_community_id) references public.areas(id) on delete restrict,
  drop constraint properties_building_id_fkey,
  add constraint properties_building_id_fkey
    foreign key (building_id) references public.areas(id) on delete restrict;

alter table public.developments
  drop constraint developments_area_id_fkey,
  add constraint developments_area_id_fkey
    foreign key (area_id) references public.areas(id) on delete restrict;

alter table public.areas
  drop constraint areas_parent_id_fkey,
  add constraint areas_parent_id_fkey
    foreign key (parent_id) references public.areas(id) on delete restrict;

-- Security definer so the counts are whole: a caller whose RLS hides some
-- listings (drafts, another advisor's) must still be told they exist.
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
   where old.id in (area_id, sub_community_id, building_id);
  select count(*) into n_developments
    from public.developments where area_id = old.id;
  select count(*) into n_children
    from public.areas where parent_id = old.id;

  if n_properties + n_developments + n_children = 0 then
    return old;
  end if;

  if n_properties > 0 then
    parts := parts || format('%s %s', n_properties,
      case when n_properties = 1 then 'listing' else 'listings' end);
  end if;
  if n_developments > 0 then
    parts := parts || format('%s %s', n_developments,
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
          hint = 'Reassign the linked listings, projects and areas, then delete again.';
end;
$$;

revoke all on function public.areas_guard_delete() from public, anon, authenticated;

create trigger areas_guard_delete
  before delete on public.areas
  for each row execute function public.areas_guard_delete();

comment on function public.areas_guard_delete() is
  'Refuses to delete an area that a property, development or child area still points at (0167). The ON DELETE RESTRICT foreign keys are the backstop.';
