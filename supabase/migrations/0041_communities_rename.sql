-- 0041_communities_rename.sql
-- Client-directed label rename: "Areas" -> "Communities" (nav tab + all
-- panel content). Bundled with the /areas -> /communities route move
-- (see next.config.ts redirects + the git-mv'd route directory).
--
-- Keeps slug='areas' on the tab row (only the admin /admin/navigation
-- deep-link depends on the slug; nothing user-facing does), so this is
-- a pure label/href content update, safely re-runnable.

update public.megamenu_tabs
set label = 'Communities',
    panel_title = 'Abu Dhabi communities',
    panel_title_href = '/communities'
where slug = 'areas';

-- Every item/tile href that starts with /areas -> /communities. Covers
-- both path form (/areas/saadiyat-island) and query form
-- (/areas?emirate=dubai) since both share the /areas prefix.
update public.megamenu_items
set href = '/communities' || substring(href from 7)
where href like '/areas%';

update public.megamenu_featured_tiles
set href = '/communities' || substring(href from 7)
where href like '/areas%';
