-- Search relocated: /buy /rent /off-plan are now marketing landings; the
-- filter results live at /buy/search, /rent/search, /off-plan/search. Repoint
-- the megamenu filter items (e.g. /buy?type=apartment) directly at the search
-- route so clicks don't take an extra redirect hop through the landing's guard.
-- The tab panel titles keep pointing at the bare landing (/buy etc.).
-- Idempotent: LIKE '/buy?%' no longer matches once rewritten to '/buy/search?'.
update public.megamenu_items
  set href = replace(href, '/buy?', '/buy/search?')
  where href like '/buy?%';

update public.megamenu_items
  set href = replace(href, '/rent?', '/rent/search?')
  where href like '/rent?%';

update public.megamenu_items
  set href = replace(href, '/off-plan?', '/off-plan/search?')
  where href like '/off-plan?%';
