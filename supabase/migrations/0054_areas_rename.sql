-- 0054_areas_rename.sql
-- Reverts 0041: the client wants the nav tab + route back to "Areas" / /areas.
-- Ships alongside the /communities -> /areas route move (git-mv'd route dir +
-- next.config.ts redirects). Pure label/href content update on the DB-driven
-- megamenu; slug stays 'areas', so this is safely re-runnable.

update public.megamenu_tabs
set label = 'Areas',
    panel_title = 'Abu Dhabi areas',
    panel_title_href = '/areas'
where slug = 'areas';

-- Every item/tile href that starts with /communities -> /areas. Covers path
-- form (/communities/saadiyat-island) and query form (/communities?emirate=…)
-- since both share the prefix. len('/communities') = 12, so substring from 13.
update public.megamenu_items
set href = '/areas' || substring(href from 13)
where href like '/communities%';

update public.megamenu_featured_tiles
set href = '/areas' || substring(href from 13)
where href like '/communities%';
