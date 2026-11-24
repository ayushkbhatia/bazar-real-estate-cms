-- 0179 · Buy menu: Al Raha pointed at an area that does not exist.
--
-- "Al Raha" under Buy → Abu Dhabi Locations linked to
-- /buy/search?area=al-raha-beach, and no area has that slug, so the search
-- filtered to nothing and showed "0" (found 24 Nov 2026 while adding 0178).
-- The area is `al-raha` (3 published listings that day). It was the only menu
-- link naming a missing area. Data only; idempotent.

update public.megamenu_items
   set href = '/buy/search?area=al-raha'
 where href = '/buy/search?area=al-raha-beach';
