-- 0035_megamenu_area_slug_alignment.sql
-- Sprint 15 Phase 4: align megamenu area slugs with the actual seeded
-- area slugs from seed.sql + 0034_catalogue_seed_expansion.sql.
--
-- Three menu hrefs use short-form slugs that don't match what's in the
-- areas table:
--
--   · /areas/al-reem            → seed has al-reem-island          (404)
--   · /off-plan?area=al-reem    → query filter never matches       (empty)
--   · /off-plan?area=saadiyat   → query filter never matches       (empty)
--                                  (seed has saadiyat-island + sub-communities)
--
-- Updating the menu hrefs is lower-risk than renaming seeded slugs,
-- which would cascade through area_id foreign keys on developments,
-- properties, and the area-guide query layer.

update public.megamenu_items
set href = '/areas/al-reem-island'
where href = '/areas/al-reem';

update public.megamenu_items
set href = '/off-plan?area=al-reem-island'
where href = '/off-plan?area=al-reem';

update public.megamenu_items
set href = '/off-plan?area=saadiyat-island'
where href = '/off-plan?area=saadiyat';
