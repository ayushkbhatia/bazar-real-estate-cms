-- 0033_megamenu_slug_fixes.sql
-- Fix slug mismatches in the megamenu seed (0031_megamenu.sql) where the
-- referenced URL doesn't match the actual page directory.
--
-- Property management: the page directory is /services/manage but the
-- megamenu seed pointed at /services/property-management, so the link
-- 404'd. Update the 2 column items (one in Rent, one in Services) and
-- the 1 featured tile under Rent.

update public.megamenu_items
set href = '/services/manage'
where href = '/services/property-management';

update public.megamenu_featured_tiles
set href = '/services/manage'
where href = '/services/property-management';
