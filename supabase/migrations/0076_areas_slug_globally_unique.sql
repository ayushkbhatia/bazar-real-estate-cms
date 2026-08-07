-- 0076_areas_slug_globally_unique.sql
-- Areas: make `slug` unique across the whole table.
--
-- `0001_core.sql` constrains `unique (parent_id, slug)`, which allows the same
-- slug under two different parents — e.g. a "marina" sub-community under both
-- Al Reem and Yas. That was survivable while areas were seeded by hand, but
-- the public URL space is flat: both rows claim `/areas/marina`, and the page
-- lookup (`.eq('slug', …)`) can only resolve one of them. Now that staff can
-- add an area from the property wizard, the collision is a matter of time.
--
-- Two steps: rename any existing collisions, then add the global index.
-- Idempotent — re-running is a no-op once the index exists.

-- 1. De-duplicate. The earliest row keeps the slug; later ones get a numeric
--    suffix. Looped because a suffixed slug can itself collide with an
--    unrelated existing row ("marina-2" already taken); each pass renames
--    strictly fewer rows, so this terminates.
do $$
declare
  renamed integer;
  passes  integer := 0;
begin
  loop
    with ranked as (
      select id,
             slug,
             row_number() over (partition by slug order by created_at, id) as rn
      from public.areas
    ),
    renames as (
      update public.areas a
      set slug = r.slug || '-' || r.rn
      from ranked r
      where a.id = r.id
        and r.rn > 1
      returning a.id
    )
    select count(*) into renamed from renames;

    exit when renamed = 0;

    passes := passes + 1;
    if passes > 10 then
      raise exception 'areas slug de-duplication did not converge after 10 passes';
    end if;
  end loop;
end $$;

-- 2. One area, one public link.
create unique index if not exists areas_slug_unique on public.areas (slug);

comment on index public.areas_slug_unique is
  'Slugs address a flat public URL space (/areas/<slug>), so they must be unique table-wide, not just per parent.';
